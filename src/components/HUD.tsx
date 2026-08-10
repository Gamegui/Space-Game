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
      <div className="absolute top-0 left-0 right-0 px-6 pt-3 flex justify-between items-start pointer-events-none z-10">
        {/* Left: HP + Shield + XP */}
        <div className="w-56 space-y-1.5 bg-slate-950/75 p-2.5 rounded-xl border border-slate-800/80 backdrop-blur-sm shadow-xl">
          {/* HP */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-0.5">
              <span className="text-red-400 font-bold">❤️ HP</span>
              <span className="text-white font-bold">{Math.ceil(player.hp)}/{player.maxHp}</span>
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
                <span className="text-sky-400 font-bold">🛡️ SHIELD</span>
                <span className="text-sky-300 font-bold">{Math.ceil(player.shield.hp)}/{player.shield.maxHp}</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-sky-400 to-blue-500"
                  style={{ width: `${shieldPct * 100}%` }}
                />
              </div>
            </div>
          )}
          {/* XP */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-0.5">
              <span className="text-purple-400 font-bold">⭐ LVL {player.level}</span>
              <span className="text-purple-300 font-bold">{player.xp}/{player.xpToNext} XP</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-purple-400 via-fuchsia-500 to-indigo-500"
                style={{ width: `${Math.min(100, xpPct * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Wave + Status */}
        <div className="text-center bg-slate-950/75 px-6 py-2 rounded-xl border border-slate-800/80 backdrop-blur-sm shadow-xl">
          <div className="text-xs text-slate-400 font-mono tracking-widest">WAVE</div>
          <div className="text-3xl font-black text-white font-mono leading-none my-0.5">{wave}</div>
          <div className="text-xs text-slate-400 font-mono">👾 {enemiesLeft} remaining</div>
          {player.combo > 1 && (
            <div className="text-xs text-yellow-400 font-mono font-black animate-pulse mt-1">
              🔥 COMBO x{player.combo}! (+{player.combo * 5}%)
            </div>
          )}
          {timeSlow && (
            <div className="text-xs text-cyan-400 font-mono font-bold animate-pulse mt-1">⏱ TIME SLOW ACTIVE</div>
          )}
          {player.rapidBoostTimer > 0 && (
            <div className="text-xs text-sky-400 font-mono font-bold animate-pulse mt-0.5">⚡ OVERDRIVE ({Math.ceil(player.rapidBoostTimer / 60)}s)</div>
          )}
        </div>

        {/* Right: Score + Kills */}
        <div className="text-right w-56 bg-slate-950/75 p-2.5 rounded-xl border border-slate-800/80 backdrop-blur-sm font-mono shadow-xl">
          <div className="text-xs text-yellow-400 font-bold tracking-widest">SCORE</div>
          <div className="text-2xl font-black text-white">{player.score.toLocaleString()}</div>
          <div className="text-xs text-slate-300 mt-0.5">💀 {player.kills} kills</div>
          {player.goldMultiplier > 1 && (
            <div className="text-xs text-yellow-300 font-bold">×{player.goldMultiplier.toFixed(1)} Multiplier</div>
          )}
        </div>
      </div>

      {/* Boss HP bar */}
      {bossActive && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 w-96 z-10 pointer-events-none">
          <div className="text-center text-sm font-black text-red-400 font-mono tracking-widest mb-1 animate-pulse">
            ☠️ {bossName} ☠️
          </div>
          <div className="h-4 bg-slate-900 rounded-full border-2 border-red-800 overflow-hidden shadow-lg shadow-red-950">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${bossHpPct * 100}%`,
                background: "linear-gradient(90deg, #dc2626, #ef4444, #f97316)",
                boxShadow: "0 0 12px #ef4444",
              }}
            />
          </div>
          <div className="text-center text-xs text-red-300 font-mono mt-0.5 font-bold">
            {Math.ceil(bossHpPct * 100)}%
          </div>
        </div>
      )}

      {/* Bottom: abilities */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {player.nukeCharges > 0 && (
          <button
            onClick={onNuke}
            className="px-4 py-2 bg-red-900/90 border border-red-500 text-red-100 rounded-xl text-xs font-mono font-black hover:bg-red-700 active:scale-95 transition-all pointer-events-auto shadow-lg shadow-red-950/50 cursor-pointer"
          >
            ☢️ NUKE ×{player.nukeCharges}
            <div className="text-[10px] text-red-300 opacity-80">[X] KEY</div>
          </button>
        )}
        {player.timeSlow && (
          <button
            onClick={onTimeSlow}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-black transition-all pointer-events-auto shadow-lg cursor-pointer ${
              player.timeSlowCooldown > 0
                ? "bg-slate-800/80 border border-slate-600 text-slate-500"
                : "bg-cyan-900/90 border border-cyan-500 text-cyan-100 hover:bg-cyan-700 active:scale-95 shadow-cyan-950/50"
            }`}
          >
            ⏱️ SLOW {player.timeSlowCooldown > 0 ? `(${Math.ceil(player.timeSlowCooldown / 60)}s)` : ""}
            <div className="text-[10px] opacity-80">[C] KEY</div>
          </button>
        )}
      </div>

      {/* Upgrades mini-display */}
      {player.upgrades.length > 0 && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 max-w-[240px] z-10 pointer-events-none">
          {player.upgrades.slice(0, 10).map(u => (
            <div key={u.id} className="text-[11px] px-2 py-0.5 bg-slate-900/90 text-sky-300 rounded-md font-mono border border-slate-700/60 leading-none">
              {u.id.split("_")[0]} ×{u.level}
            </div>
          ))}
        </div>
      )}

      {/* Satellites/drones count */}
      {(player.satellites.length > 0 || player.drones.length > 0) && (
        <div className="absolute bottom-3 right-3 text-right z-10 pointer-events-none space-y-1">
          {player.satellites.length > 0 && (
            <div className="text-xs px-2.5 py-1 bg-slate-900/80 border border-yellow-500/40 rounded-lg text-yellow-400 font-mono font-bold">
              🛰️ Orbitals: {player.satellites.length}
            </div>
          )}
          {player.drones.length > 0 && (
            <div className="text-xs px-2.5 py-1 bg-slate-900/80 border border-purple-500/40 rounded-lg text-purple-400 font-mono font-bold">
              🤖 Drones: {player.drones.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
