import { useEffect, useState } from "react";
import type { UpgradeDef, PlayerState } from "../game/types";

/**
 * Позиции CSS-искр события — константа модуля: создаётся один раз, а не на
 * каждый рендер (v1.8.0). 8 искр вместо 14 — событие торжественнее не стало
 * от количества DOM-узлов, а композиция стабильнее.
 */
const SPARK_POSITIONS: ReadonlyArray<{ left: string; top: string; delay: string; duration: string }> = [
  { left: "8%",  top: "16%", delay: "0s",    duration: "2s" },
  { left: "22%", top: "70%", delay: "0.17s", duration: "3s" },
  { left: "38%", top: "12%", delay: "0.34s", duration: "2.5s" },
  { left: "55%", top: "78%", delay: "0.51s", duration: "4s" },
  { left: "70%", top: "20%", delay: "0.68s", duration: "3.5s" },
  { left: "84%", top: "62%", delay: "0.85s", duration: "2s" },
  { left: "92%", top: "34%", delay: "1.02s", duration: "3s" },
  { left: "14%", top: "42%", delay: "1.19s", duration: "4s" },
];

interface Props {
  mythic: UpgradeDef;
  player: PlayerState;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * ✦ МИФИЧЕСКОЕ СОБЫТИЕ ✦ — специальная последовательность вместо обычных
 * карточек: остановка момента (затемнение) → вспышка энергии → заголовок →
 * карточка → выбор. Анимации — чистый CSS (ноль canvas-частиц, лимиты
 * перф-системы не затрагиваются). Для «Немезиды» добавляется фиолетовый
 * оттенок Бездны — чисто визуальное усиление (ТЗ §12).
 */
export default function MythicReveal({ mythic, player, onAccept, onDecline }: Props) {
  const [stage, setStage] = useState(0); // 0 затемнение, 1 вспышка, 2 заголовок, 3 карточка
  const wraith = player.shipClass === "void_wraith";

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 350);  // остановка момента
    const t2 = setTimeout(() => setStage(2), 1050); // вспышка
    const t3 = setTimeout(() => setStage(3), 1900); // карточка
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden ${stage === 0 ? "bg-black/92" : "bg-black/95"} backdrop-blur-md transition-all duration-300`}>
      {/* Радиальные лучи (CSS, не частицы) */}
      {stage >= 1 && (
        <div
          className="pointer-events-none absolute inset-[-50%] animate-[spin_14s_linear_infinite] opacity-70"
          style={{
            background: wraith
              ? "repeating-conic-gradient(from 0deg, rgba(232,121,249,0.16) 0deg 7deg, transparent 7deg 24deg)"
              : "repeating-conic-gradient(from 0deg, rgba(253,224,71,0.16) 0deg 7deg, transparent 7deg 24deg)",
          }}
        />
      )}
      {/* Белая вспышка */}
      {stage === 1 && <div className="pointer-events-none absolute inset-0 bg-white animate-[fadeOut_0.7s_ease-out_forwards]" />}
      {/* Золотое свечение позади карточки */}
      {stage >= 2 && (
        <div className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-3xl animate-pulse"
          style={{ background: wraith ? "radial-gradient(circle, rgba(232,121,249,0.35), transparent 70%)" : "radial-gradient(circle, rgba(253,224,71,0.35), transparent 70%)" }} />
      )}

      {/* Заголовок события */}
      {stage >= 2 && (
        <div className="relative mb-5 text-center animate-[mythicTitle_0.6s_cubic-bezier(0.2,2.2,0.4,1)_both]">
          <div className="text-4xl font-black tracking-wider bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(253,224,71,0.8)]">
            ✦ МИФИЧЕСКОЕ УЛУЧШЕНИЕ ✦
          </div>
          <div className="mt-2 font-mono text-[11px] tracking-[0.3em] text-amber-200/70">СИЛА, ВЫХОДЯЩАЯ ЗА ПРЕДЕЛЫ ОБЫЧНОЙ ТЕХНОЛОГИИ</div>
        </div>
      )}

      {/* Карточка мифика */}
      {stage >= 3 && (
        <div className="relative w-full max-w-md animate-[mythicCard_0.55s_cubic-bezier(0.2,1.8,0.4,1)_both]">
          <div className="absolute -inset-[3px] rounded-3xl animate-[mythicBorder_3s_ease-in-out_infinite]"
            style={{ background: "linear-gradient(120deg, #fde047, #ffffff, #f59e0b, #ffffff, #fde047)", backgroundSize: "300% 300%", filter: "drop-shadow(0 0 26px rgba(253,224,71,0.75))" }} />
          <div className="relative rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-slate-900 to-black p-6 text-center">
            <div className="mb-2 inline-block rounded-full bg-gradient-to-r from-amber-400 to-yellow-200 px-4 py-1 font-mono text-[11px] font-black tracking-[0.25em] text-black shadow-lg">✦ MYTHIC ✦</div>
            <div className="mb-3 text-6xl drop-shadow-[0_0_20px_rgba(253,224,71,0.9)] animate-[mythicFloat_2.4s_ease-in-out_infinite]">{mythic.icon}</div>
            <div className="mb-3 text-xl font-black leading-tight text-amber-100">{mythic.name}</div>
            <p className="mb-5 text-xs leading-relaxed text-amber-200/85">{mythic.description}</p>
            <button
              onClick={onAccept}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 py-4 text-base font-black text-black shadow-[0_0_30px_rgba(253,224,71,0.6)] transition-all hover:brightness-110 active:scale-95 cursor-pointer animate-[mythicBorder_3s_ease-in-out_infinite] bg-[length:300%_300%]"
            >
              ✦ ПРИНЯТЬ СИЛУ ✦
            </button>
            <button onClick={onDecline} className="mt-3 font-mono text-[10px] text-slate-500 underline underline-offset-4 hover:text-slate-300 cursor-pointer">
              отказаться и выбрать обычное улучшение
            </button>
          </div>
        </div>
      )}

      {/* CSS-«частицы» света вокруг (константа модуля, без canvas) */}
      {stage >= 3 && (
        <div className="pointer-events-none absolute inset-0">
          {SPARK_POSITIONS.map((p, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                left: p.left,
                top: p.top,
                background: wraith && i % 3 === 0 ? "#e879f9" : "#fde047",
                boxShadow: `0 0 10px ${wraith && i % 3 === 0 ? "#e879f9" : "#fde047"}`,
                animation: `mythicSpark ${p.duration} ease-in-out ${p.delay} infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
