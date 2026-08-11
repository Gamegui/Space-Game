import type { UpgradeDef } from "../game/types";
import type { PlayerState } from "../game/types";
import { getUpgradeLevel } from "../game/upgrades";

interface Props {
  choices: UpgradeDef[];
  player: PlayerState;
  onChoose: (u: UpgradeDef) => void;
  level: number;
}

const rarityColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  common:    { bg: "from-slate-800 to-slate-900", border: "border-slate-500", text: "text-slate-200", badge: "bg-slate-600 text-slate-200" },
  rare:      { bg: "from-blue-900 to-slate-900",  border: "border-blue-500",  text: "text-blue-100",  badge: "bg-blue-600 text-blue-100"  },
  epic:      { bg: "from-purple-900 to-slate-900",border: "border-purple-500",text: "text-purple-100",badge: "bg-purple-600 text-purple-100"},
  legendary: { bg: "from-amber-900 to-slate-900", border: "border-amber-500", text: "text-amber-100", badge: "bg-amber-500 text-amber-900" },
};

const rarityLabel: Record<string, string> = {
  common: "ОБЫЧНОЕ", rare: "РЕДКОЕ", epic: "ЭПИЧЕСКОЕ", legendary: "ЛЕГЕНДАРНОЕ",
};

const categoryIcon: Record<string, string> = {
  атака: "⚔️", защита: "🛡️", стихии: "🌊", спутники: "🤖",
  особое: "✨", утилиты: "⚙️",
};

export default function UpgradePanel({ choices, player, onChoose, level }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-20 rounded-2xl p-4">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="text-xs font-mono text-sky-400 tracking-widest mb-1 font-bold">НОВЫЙ УРОВЕНЬ!</div>
        <div className="text-3xl font-black text-white">Уровень <span className="text-yellow-400">{level}</span></div>
        <div className="text-xs text-slate-400 font-mono mt-1">Выберите улучшение для боевой системы:</div>
      </div>

      {/* Cards */}
      <div className="flex gap-4 px-4 max-w-4xl w-full justify-center">
        {choices.map((u) => {
          const c = rarityColors[u.rarity] || rarityColors.common;
          const currentLevel = getUpgradeLevel(player, u.id);
          const maxLevel = u.maxLevel;
          const stars = Array.from({ length: maxLevel }, (_, i) => i < currentLevel);

          return (
            <button
              key={u.id}
              onClick={() => onChoose(u)}
              className={`
                flex-1 min-w-[200px] max-w-[250px] p-5 rounded-2xl border-2 ${c.border}
                bg-gradient-to-b ${c.bg} ${c.text}
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
              <div className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${c.badge} inline-block mb-3 tracking-widest`}>
                {rarityLabel[u.rarity]}
              </div>

              {/* Icon + Name */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-3xl">{u.icon}</span>
                <div>
                  <div className="font-black text-base leading-tight">{u.name}</div>
                  <div className="text-xs opacity-60 font-mono">{categoryIcon[u.category]} {u.category}</div>
                </div>
              </div>

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
        })}
      </div>

      {/* Currently have */}
      {player.upgrades.length > 0 && (
        <div className="mt-6 text-center">
          <div className="text-xs text-slate-400 font-mono mb-2 font-bold">УСТАНОВЛЕННЫЕ МОДИФИКАЦИИ</div>
          <div className="flex flex-wrap gap-1.5 justify-center max-w-2xl">
            {player.upgrades.map(u => (
              <span key={u.id} className="text-xs px-2.5 py-1 bg-slate-900/90 text-sky-300 rounded-full border border-slate-700 font-mono">
                {u.id.replace(/_/g, " ")} ×{u.level}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
