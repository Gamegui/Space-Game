import { useEffect, useState } from "react";
import type { UpgradeDef } from "../game/types";
import type { PlayerState } from "../game/types";
import { ALL_UPGRADES, canUpgrade, getUpgradeLevel } from "../game/upgrades";
import { SYNERGIES } from "../game/synergies";
import { MYTHIC_IDS } from "../game/mythics";
import ChoiceCard, { type CardStyle } from "./ChoiceCard";
import { rarityCardStyles } from "./cardStyles";

interface Props {
  choices: UpgradeDef[];
  player: PlayerState;
  onChoose: (u: UpgradeDef) => void;
  level: number;
  rerollsLeft: number;
  banishesLeft: number;
  banishedCount: number;
  adAvailable: boolean;
  adPending: boolean;
  bonusChoiceUsed: boolean;
  onReroll: () => void;
  onAdReroll: () => void;
  onAdBonusChoice: () => void;
  onBanish: (upgrade: UpgradeDef) => void;
}

const rarityColors: Record<string, CardStyle> = rarityCardStyles;

export default function UpgradePanel({
  choices, player, onChoose, level, rerollsLeft, banishesLeft, banishedCount, adAvailable, adPending,
  bonusChoiceUsed, onReroll, onAdReroll, onAdBonusChoice, onBanish,
}: Props) {
  const [buildOpen, setBuildOpen] = useState(false);

  // Выбор улучшений горячими клавишами 1–4 (v1.8.2).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
      if (index >= 0 && choices[index]) { event.preventDefault(); onChoose(choices[index]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onChoose]);
  const availablePool = Math.max(0, ALL_UPGRADES.filter(upgrade => canUpgrade(player, upgrade)).length - banishedCount);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-20 rounded-2xl p-4">
      {/* Header */}
      <div className="mb-3 text-center">
        <div className="text-xs font-mono text-sky-400 tracking-widest mb-1 font-bold">НОВЫЙ УРОВЕНЬ!</div>
        <div className="text-3xl font-black text-white">Уровень <span className="text-yellow-400">{level}</span></div>
        <div className="text-xs text-slate-400 font-mono mt-1">Выберите улучшение для боевой системы <span className="text-slate-500">(клавиши 1–4)</span>:</div>
      </div>

      {/* Cards */}
      <div className="flex gap-3 px-3 max-w-[940px] w-full justify-center">
        {choices.map((u, index) => (
          <ChoiceCard key={u.id} u={u} style={rarityColors[u.rarity] ?? rarityColors.common} player={player} hotkey={index + 1} onChoose={onChoose} />
        ))}
      </div>

      {/* Choice controls */}
      <div className="mt-3 flex items-center justify-center gap-2 font-mono text-xs">
        {rerollsLeft > 0 ? (
          <button onClick={onReroll} disabled={adPending} className="rounded-lg border border-cyan-500 bg-cyan-950/90 px-4 py-2 font-black text-cyan-100 hover:bg-cyan-800 disabled:opacity-50 cursor-pointer">
            🔄 ПЕРЕВЫБОР · {rerollsLeft} БЕСПЛАТНО
          </button>
        ) : adAvailable ? (
          <button onClick={onAdReroll} disabled={adPending} className="rounded-lg border border-cyan-500 bg-cyan-950/90 px-4 py-2 font-black text-cyan-100 hover:bg-cyan-800 disabled:opacity-50 cursor-pointer">
            🎬 {adPending ? "ЗАГРУЗКА…" : "ПЕРЕВЫБОР ЗА РЕКЛАМУ"}
          </button>
        ) : null}
        {adAvailable && !bonusChoiceUsed && level >= 7 && choices.length < 4 && (
          <button onClick={onAdBonusChoice} disabled={adPending} className="rounded-lg border border-amber-500 bg-amber-950/90 px-4 py-2 font-black text-amber-100 hover:bg-amber-800 disabled:opacity-50 cursor-pointer">
            🎬 +4-Й ЭПИЧЕСКИЙ ИЛИ ЛЕГЕНДАРНЫЙ
          </button>
        )}
        {banishesLeft > 0 && (
          <div className="flex items-center gap-1 rounded-lg border border-rose-800 bg-rose-950/80 px-2 py-1 text-rose-200">
            <span className="font-black">ИЗГНАТЬ:</span>
            {choices.filter(choice => choice.id !== "limit_break").map((choice, index) => (
              <button key={choice.id} onClick={() => onBanish(choice)} title={`Убрать «${choice.name}» до конца забега`} className="rounded bg-rose-800 px-2 py-1 font-black hover:bg-rose-600 cursor-pointer">{index + 1}</button>
            ))}
          </div>
        )}
      </div>

      {/* Build details stay collapsed by default to keep mobile choice focused. */}
      <button onClick={() => setBuildOpen(open => !open)} className="mt-2 rounded-full border border-fuchsia-800 bg-fuchsia-950/70 px-4 py-1.5 text-[10px] font-black text-fuchsia-200 cursor-pointer">
        🧬 БИЛД · {player.upgrades.length} · ПУЛ: {availablePool}/{ALL_UPGRADES.length} {buildOpen ? "▲" : "▼"}
      </button>
      {buildOpen && (
        <div className="mt-2 grid w-full max-w-4xl grid-cols-2 gap-3 text-left">
          <div className="rounded-xl border border-fuchsia-900/70 bg-slate-950/80 p-2.5">
            <div className="mb-1.5 text-[10px] font-black tracking-widest text-fuchsia-300">СИНЕРГИИ БИЛДА</div>
            <div className="grid grid-cols-2 gap-1">
              {SYNERGIES.map(synergy => {
                const found = synergy.requires.filter(id => getUpgradeLevel(player, id) > 0).length;
                const active = player.synergies.includes(synergy.id);
                return <div key={synergy.id} className={`rounded px-2 py-1 text-[10px] font-bold ${active ? "bg-fuchsia-800 text-white" : "bg-slate-900 text-slate-400"}`}>
                  {synergy.icon} {synergy.name} · {active ? "ГОТОВО" : `${found}/${synergy.requires.length}`}
                </div>;
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5">
            {(() => {
              const mythics = player.upgrades.filter(u => (MYTHIC_IDS as readonly string[]).includes(u.id));
              return mythics.length > 0 ? (
                <div className="mb-1.5 rounded-lg border border-amber-500/60 bg-amber-950/40 p-1.5">
                  <div className="text-[10px] font-black tracking-widest text-amber-300">МИФИЧЕСКИЕ СИЛЫ · {mythics.length}</div>
                  {mythics.map(m => {
                    const def = ALL_UPGRADES.find(u => u.id === m.id);
                    return <div key={m.id} className="text-[10px] font-bold text-amber-200">✦ {def?.icon} {def?.name ?? m.id}</div>;
                  })}
                </div>
              ) : null;
            })()}
            <div className="mb-1.5 text-[10px] font-black tracking-widest text-slate-400">МОДИФИКАЦИИ · {player.upgrades.length}</div>
            <div className="max-h-14 overflow-y-auto pr-1 text-[10px] leading-5 text-sky-300">
              {player.upgrades.length === 0 ? "Пока не установлены" : player.upgrades.map(upgrade => `${upgrade.id.replace(/_/g, " ")} ×${upgrade.level}`).join(" · ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
