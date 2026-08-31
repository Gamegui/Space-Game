// ─── Автоматический перф-репортер (только DEV) ───────────────────────────────
// Проблема: при жёстком зависании страницы UI мёртв — логи не скачать кнопкой.
// Решение:
//  1. Каждое медленное событие немедленно улетает POST-ом на dev-сервер
//     (vite middleware пишет .perf-logs.ndjson) — ещё ДО финального фриза.
//  2. Watchdog-воркер живёт в отдельном потоке: если главный поток перестал
//     отвечать дольше 3 секунд — воркер сам шлёт отчёт о зависании с данными
//     последнего кадра (из его памяти).
//  3. Зеркало в localStorage: после перезагрузки страницы логи прошлого
//     сеанса досылаются на сервер с пометкой RECOVERED.
// В продакшене все функции — no-op (import.meta.env.DEV).

const ENDPOINT = "/__perf_log";
const LOCAL_STORAGE_KEY = "perf_log_mirror";
const MIRROR_MAX_LINES = 60;

function isDev(): boolean {
  // Только диагностическая сборка (VITE_PERF=true). Релиз и обычный dev
  // не шлют [perf]-логи и не поднимают watchdog.
  return import.meta.env.VITE_PERF === "true";
}

function mirror(line: string): void {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    const lines = stored ? stored.split("\n") : [];
    lines.push(line);
    while (lines.length > MIRROR_MAX_LINES) lines.shift();
    localStorage.setItem(LOCAL_STORAGE_KEY, lines.join("\n"));
  } catch { /* хранилище недоступно — не критично, сервер всё равно получил */ }
}

function postViaGet(record: Record<string, unknown>): void {
  // GET-фолбэк: некоторые прокси не пропускают POST из iframe. Ограничение
  // длины URL ~8 КБ — большие пачки (RECOVERED) режем на части.
  const parts: string[] = [];
  let current: Record<string, unknown>[] = [];
  let size = 0;
  const items = Array.isArray((record as { lines?: unknown[] }).lines)
    ? ((record as { lines: unknown[] }).lines as unknown[])
    : [record];
  const kind = record.kind as string;
  for (const item of items) {
    const encoded = encodeURIComponent(JSON.stringify(item));
    if (size + encoded.length > 3500 && current.length > 0) {
      parts.push(JSON.stringify(current));
      current = [];
      size = 0;
    }
    current.push(item as Record<string, unknown>);
    size += encoded.length;
  }
  if (current.length > 0) parts.push(JSON.stringify(current));
  parts.forEach((part, index) => {
    const payload = { kind, part: index + 1, parts: parts.length, lines: JSON.parse(part) };
    try {
      void fetch(`${ENDPOINT}?d=${encodeURIComponent(JSON.stringify(payload))}`).catch(() => {});
    } catch { /* ignore */ }
  });
}

function post(record: Record<string, unknown>): void {
  const body = JSON.stringify(record);
  // 1) sendBeacon — самый живучий (ставится в очередь браузером)
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch { /* ignore */ }
  // 2) fetch POST keepalive
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => postViaGet(record)); // 3) GET-фолбэк
    return;
  } catch { /* ignore */ }
  postViaGet(record);
}

/** Отправить запись о медленном кадре/инциденте (DEV-only). */
export function reportPerfEvent(kind: string, data: Record<string, unknown>): void {
  if (!isDev()) return;
  const record = { kind, t: Date.now(), ...data };
  const line = JSON.stringify(record);
  mirror(line);
  post(record);
}

/** Beacon старта сессии: подтверждает, что страница с репортером загружена
 *  и канал до dev-сервера работает (иначе диагностика слепа). */
export function reportSessionStart(): void {
  if (!isDev()) return;
  reportPerfEvent("SESSION_START", {
    ua: navigator.userAgent,
    cores: navigator.hardwareConcurrency ?? -1,
    dpr: devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
    storage: (() => { try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return "ok"; } catch { return "blocked"; } })(),
    time: new Date().toISOString(),
  });
}

/** Логи прошлого сеанса после перезагрузки: вернуть строки для показа в
 *  кнопке PERF (локальная диагностическая сборка работает с file://, где
 *  POST недоступен — localStorage остаётся единственным хранилищем). */
export function recoverPerfMirror(): string[] {
  if (!isDev()) return [];
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return [];
    const lines = stored.split("\n").filter(Boolean);
    if (lines.length === 0) return [];
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    post({ kind: "RECOVERED", t: Date.now(), lines, note: "логи предыдущего сеанса (перезагрузка после зависания?)" });
    return lines;
  } catch { return []; }
}

/**
 * Watchdog зависаний: главный поток шлёт beat каждое анимационное событие;
 * воркер из отдельного потока замечает, если биение пропало > 3 с, и сам
 * отправляет отчёт (fetch воркера работает, даже когда главный поток заблокирован).
 */
export function startFreezeWatchdog(): (payload: Record<string, unknown>, hidden: boolean) => void {
  if (!isDev() || typeof Worker === "undefined") return () => {};

  const workerSrc = `
    let lastBeat = performance.now();
    let lastPayload = null;
    let pageHidden = false;
    onmessage = (e) => {
      const msg = e.data || {};
      if (msg.type === "beat") {
        lastBeat = performance.now();
        if (msg.payload) lastPayload = msg.payload;
        pageHidden = Boolean(msg.hidden);
      }
    };
    setInterval(() => {
      const blockedMs = performance.now() - lastBeat;
      if (!pageHidden && blockedMs > 3000 && lastPayload) {
        const record = { kind: "FREEZE", t: Date.now(), blockedMs: Math.round(blockedMs), last: lastPayload };
        const ok = navigator.sendBeacon("/__perf_log", new Blob([JSON.stringify(record)], { type: "application/json" }));
        if (!ok) {
          fetch("/__perf_log?d=" + encodeURIComponent(JSON.stringify(record))).catch(() => {});
        }
        lastBeat = performance.now(); // одно сообщение за цикл блокировки
      }
    }, 1500);
  `;

  let worker: Worker | null = null;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: "text/javascript" })));
  } catch {
    return () => {};
  }

  return (payload: Record<string, unknown>, hidden: boolean) => {
    try {
      worker?.postMessage({ type: "beat", payload, hidden });
    } catch { /* ignore */ }
  };
}
