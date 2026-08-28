import { memo } from "react";
import type { UpgradeDef, PlayerState } from "../game/types";
import { getUpgradeLevel } from "../game/upgrades";
import { SYNERGIES } from "../game/synergies";
import { EVOLUTIONS } from "../game/evolutions";

export interface CardStyle {
  bg: string;
  border: string;
  text: string;
  badge: string;
}

const rarityLabel: Record<string, string> = {
  common: "ОБЫЧНОЕ", rare: "РЕДКОЕ", epic: "ЭПИЧЕСКОЕ", legendary: "ЛЕГЕНДАРНОЕ", mythic: "✦ МИФИЧЕСКОЕ ✦",
};

const categoryIcon: Record<string, string> = {
  атака: "⚔️", защита: "🛡️", стихии: "🌊", спутники: "🤖",
  особое: "✨", утилиты: "⚙️", миф: "✦",
};

interface Props {
  u: UpgradeDef;
  style: CardStyle;
  player: PlayerState;
  onChoose: (u: UpgradeDef) => void;
}

/**
 * Карточка выбора улучшения (v1.8.0 — извлечена из UpgradePanel).
 * Сохраняет ВСЕ подсказки оригинала: статус синергий (активна/завершает/в
 * процессе), прогресс эволюций, редкость, категорию, деления уровней.
 * memo безопасен: карточка перерисовывается только при смене пропов.
 */
export default memo(function ChoiceCard({ u, style, player, onChoose }: Props) {
  const currentLevel = getUpgradeLevel(player, u.id);
  const maxLevel = u.maxLevel;
  const visiblePips = Math.min(maxLevel, 8);
  const stars = Array.from({ length: visiblePips }, (_, i) => i < Math.min(currentLevel, visiblePips));
  const relatedSynergies = SYNERGIES.filter(synergy => synergy.requires.includes(u.id));
  // Индикатор прогресса эволюций: игрок видит, что строит билд
  // («до эволюции осталось 1 улучшение»).
  const relatedEvolutions = EVOLUTIONS.filter(evolution =>
    !player.evolved.includes(evolution.id) && evolution.requires.includes(u.id));

  return (
    <button
      key={u.id}
      onClick={() => onChoose(u)}
      className={`
        flex-1 min-w-0 max-w-[250px] p-4 rounded-2xl border-2 ${style.border}
        bg-gradient-to-b ${style.bg} ${style.text}
        transition-all duration-200
        hover:scale-105 hover:shadow-2xl hover:brightness-110
        active:scale-95
        text-left relative overflow-hidden
        group cursor-pointer
      `}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Rarity badge */}
      <div className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${style.badge} inline-block mb-3 tracking-widest`}>
        {rarityLabel[u.rarity]}
      </div>

      {/* Icon + Name */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="text-3xl">{u.icon}</span>
        <div>
          <div className="font-black text-base leading-tight">{u.name}</div>
          <div className="text-xs opacity-60 font-mono">{categoryIcon[u.category] ?? "✨"} {u.category}</div>
        </div>
      </div>

      {/* Synergy hint: explain why this card matters before selection. */}
      {relatedSynergies.length > 0 && (
        <div className="mb-2 space-y-1">
          {relatedSynergies.map(synergy => {
            const found = synergy.requires.filter(id => getUpgradeLevel(player, id) > 0).length;
            const afterPick = Math.min(synergy.requires.length, found + (currentLevel === 0 ? 1 : 0));
            const active = player.synergies.includes(synergy.id);
            const completes = !active && afterPick === synergy.requires.length;
            const style = active
              ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-200"
              : completes
                ? "border-amber-400 bg-amber-500/20 text-amber-200 animate-pulse"
                : "border-fuchsia-500/50 bg-fuchsia-950/70 text-fuchsia-200";
            return (
              <div key={synergy.id} className={`rounded-md border px-2 py-1 text-[9px] font-black leading-tight ${style}`}>
                {active ? "✓ АКТИВНА" : completes ? "✦ ЗАВЕРШАЕТ" : "🧬 ДЛЯ СИНЕРГИИ"}: {synergy.name} · {afterPick}/{synergy.requires.length}
              </div>
            );
          })}
        </div>
      )}

      {/* Evolution hint: super-synergy progress on this card. */}
      {relatedEvolutions.length > 0 && (
        <div className="mb-2 space-y-1">
          {relatedEvolutions.map(evolution => {
            const found = evolution.requires.filter(id => getUpgradeLevel(player, id) > 0).length;
            const afterPick = Math.min(evolution.requires.length, found + (currentLevel === 0 ? 1 : 0));
            const completes = afterPick === evolution.requires.length;
            return (
              <div key={evolution.id} className={`rounded-md border px-2 py-1 text-[9px] font-black leading-tight ${completes ? "border-orange-400 bg-orange-500/20 text-orange-200 animate-pulse" : "border-amber-600/50 bg-amber-950/60 text-amber-200"}`}>
                {completes ? "⚡ ЗАПУСКАЕТ ЭВОЛЮЦИЮ" : `🧬 ЭВОЛЮЦИЯ ${afterPick}/${evolution.requires.length}`}: {evolution.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Description */}
      <div className="text-xs opacity-85 leading-relaxed mb-4 min-h-[38px]">{u.description}</div>

      {/* Level indicator */}
      <div className="flex items-center gap-1.5 border-t border-white/10 pt-2.5">
        <span className="text-[11px] opacity-60 font-mono">УРОВЕНЬ</span>
        {stars.map((filled, i) => (
          <div
            key={i}
            className={`w-4 h-1.5 rounded-full transition-all ${
              filled ? "bg-current opacity-100" : "bg-white opacity-20"
            }`}
          />
        ))}
        <span className="text-xs opacity-70 font-mono ml-auto">
          {currentLevel}/{maxLevel}
        </span>
      </div>

      {/* Corner decoration */}
      <div className="absolute top-2 right-2 opacity-10 text-4xl font-black">
        {currentLevel > 0 ? `+${currentLevel}` : ""}
      </div>
    </button>
  );
});
