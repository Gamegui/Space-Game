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
  return import.meta.env.DEV;
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

function post(record: Record<string, unknown>): void {
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ });
  } catch { /* нет сети — остаётся localStorage */ }
}

/** Отправить запись о медленном кадре/инциденте (DEV-only). */
export function reportPerfEvent(kind: string, data: Record<string, unknown>): void {
  if (!isDev()) return;
  const record = { kind, t: Date.now(), ...data };
  const line = JSON.stringify(record);
  mirror(line);
  post(record);
}

/** Дослать логи прошлого сеанса после перезагрузки (вызывать один раз при старте). */
export function recoverPerfMirror(): void {
  if (!isDev()) return;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return;
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    const lines = stored.split("\n").filter(Boolean);
    if (lines.length === 0) return;
    post({ kind: "RECOVERED", t: Date.now(), lines, note: "логи предыдущего сеанса (перезагрузка после зависания?)" });
  } catch { /* ignore */ }
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
        fetch("/__perf_log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "FREEZE", t: Date.now(), blockedMs: Math.round(blockedMs), last: lastPayload }),
        }).catch(() => {});
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
