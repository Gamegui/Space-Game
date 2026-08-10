import type { PlayerState } from "../game/types";

interface Props {
  player: PlayerState;
  wave: number;
  enemiesLeft: number;
  bossActive: boolean;
  bossName: string;
  bossHpPct: number;
  timeSlow: boolean;
  onNuke: () => void;
  onTimeSlow: () => void;
}

export default function HUD({
  player, wave, enemiesLeft, bossActive, bossName, bossHpPct,
  timeSlow, onNuke, onTimeSlow
}: Props) {
  const hpPct = player.hp / player.maxHp;
  const xpPct = player.xp / player.xpToNext;
  const shieldPct = player.shield ? player.shield.hp / player.shield.maxHp : 0;

  return (
    <>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-2 flex justify-between items-start pointer-events-none z-10">
        {/* Left: HP + Shield */}
        <div className="w-44 space-y-1.5">
          {/* HP */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-0.5">
              <span className="text-red-400">❤️ HP</span>
              <span className="text-white">{Math.ceil(player.hp)}/{player.maxHp}</span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${hpPct * 100}%`,
                  background: hpPct > 0.6 ? "linear-gradient(90deg,#4ade80,#22c55e)" :
                              hpPct > 0.3 ? "linear-gradient(90deg,#fbbf24,#f59e0b)" :
                              "linear-gradient(90deg,#f87171,#ef4444)",
                }}
              />
            </div>
          </div>
          {/* Shield */}
          {player.shield && (
            <div>
              <div className="flex justify-between text-xs font-mono mb-0.5">
                <span className="text-blue-400">🛡️ SHIELD</span>
                <span className="text-blue-300">{Math.ceil(player.shield.hp)}/{player.shield.maxHp}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-blue-400 to-blue-600"
                  style={{ width: `${shieldPct * 100}%` }}
                />
              </div>
            </div>
          )}
          {/* XP */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-0.5">
              <span className="text-purple-400">⭐ LVL {player.level}</span>
              <span className="text-purple-300">{player.xp}/{player.xpToNext}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-purple-500 to-violet-600"
                style={{ width: `${xpPct * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Wave + Score */}
        <div className="text-center">
          <div className="text-xs text-slate-400 font-mono tracking-widest">WAVE</div>
          <div className="text-2xl font-black text-white font-mono">{wave}</div>
          <div className="text-xs text-slate-500 font-mono">{enemiesLeft} left</div>
          {timeSlow && (
            <div className="text-xs text-cyan-400 font-mono animate-pulse mt-1">⏱ SLOW</div>
          )}
        </div>

        {/* Right: Score + Kills */}
        <div className="text-right w-44">
          <div className="text-xs text-yellow-400 font-mono tracking-widest">SCORE</div>
          <div className="text-xl font-black text-white font-mono">{player.score.toLocaleString()}</div>
          <div className="text-xs text-slate-400 font-mono">💀 {player.kills} kills</div>
          {player.goldMultiplier > 1 && (
            <div className="text-xs text-yellow-300 font-mono">×{player.goldMultiplier.toFixed(1)}</div>
          )}
        </div>
      </div>

      {/* Boss HP bar */}
      {bossActive && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-80 z-10 pointer-events-none">
          <div className="text-center text-xs font-black text-red-400 font-mono tracking-widest mb-1 animate-pulse">
            ☠️ {bossName} ☠️
          </div>
          <div className="h-4 bg-slate-900 rounded-full border-2 border-red-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${bossHpPct * 100}%`,
                background: "linear-gradient(90deg, #dc2626, #ef4444, #f97316)",
                boxShadow: "0 0 12px #ef4444",
              }}
            />
          </div>
          <div className="text-center text-xs text-red-300 font-mono mt-0.5">
            {Math.ceil(bossHpPct * 100)}%
          </div>
        </div>
      )}

      {/* Bottom: abilities */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {player.nukeCharges > 0 && (
          <button
            onClick={onNuke}
            className="px-3 py-1.5 bg-red-900/80 border border-red-500 text-red-200 rounded-lg text-xs font-mono font-black hover:bg-red-700 active:scale-95 transition-all pointer-events-auto"
          >
            ☢️ NUKE ×{player.nukeCharges}
            <div className="text-[10px] text-red-400 opacity-70">[X]</div>
          </button>
        )}
        {player.timeSlow && (
          <button
            onClick={onTimeSlow}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-black transition-all pointer-events-auto ${
              player.timeSlowCooldown > 0
                ? "bg-slate-800/80 border border-slate-600 text-slate-500"
                : "bg-cyan-900/80 border border-cyan-500 text-cyan-200 hover:bg-cyan-700 active:scale-95"
            }`}
          >
            ⏱️ SLOW {player.timeSlowCooldown > 0 ? `(${Math.ceil(player.timeSlowCooldown / 60)}s)` : ""}
            <div className="text-[10px] opacity-70">[C]</div>
          </button>
        )}
      </div>

      {/* Upgrades mini-display */}
      {player.upgrades.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 max-w-[160px] z-10 pointer-events-none">
          {player.upgrades.slice(0, 8).map(u => (
            <div key={u.id} className="text-xs px-1 py-0.5 bg-slate-900/80 text-slate-400 rounded font-mono border border-slate-700/50 leading-none">
              {u.id.split("_")[0]} ×{u.level}
            </div>
          ))}
        </div>
      )}

      {/* Satellites/drones count */}
      {(player.satellites.length > 0 || player.drones.length > 0) && (
        <div className="absolute bottom-2 right-2 text-right z-10 pointer-events-none">
          {player.satellites.length > 0 && <div className="text-xs text-yellow-400 font-mono">🛰️ ×{player.satellites.length}</div>}
          {player.drones.length > 0 && <div className="text-xs text-purple-400 font-mono">🤖 ×{player.drones.length}</div>}
        </div>
      )}
    </>
  );
}
