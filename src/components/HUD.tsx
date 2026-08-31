import type { PlayerState } from "../game/types";
import { SYNERGIES } from "../game/synergies";
import { hasMythic } from "../game/mythics";

interface Props {
  player: PlayerState;
  wave: number;
  enemiesLeft: number;
  bossActive: boolean;
  bossName: string;
  bossHpPct: number;
  bossPhase?: string;
  bossVulnerable?: boolean;
  timeSlow: boolean;
  onNuke: () => void;
  onTimeSlow: () => void;
}

export default function HUD({
  player, wave, enemiesLeft, bossActive, bossName, bossHpPct,
  bossPhase, bossVulnerable,
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
        <div className="w-60 space-y-1.5 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 backdrop-blur-md shadow-xl">
          {/* HP */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-0.5">
              <span className="text-red-400 font-bold">❤️ ЗДОРОВЬЕ</span>
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
                <span className="text-sky-400 font-bold">🛡️ ЭНЕРГОЩИТ</span>
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
          {/* Void souls (premium Wraith kit) */}
          {player.shipClass === "void_wraith" && (
            <div>
              <div className="flex justify-between text-xs font-mono mb-0.5">
                <span className="text-fuchsia-400 font-bold">🌑 ДУШИ БЕЗДНЫ</span>
                <span className="text-fuchsia-300 font-bold">{player.voidSouls}/20 (+{Math.round(player.voidSouls * 1.5)}% урона)</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-fuchsia-500 via-purple-500 to-violet-600"
                  style={{ width: `${Math.min(100, (player.voidSouls / 20) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {/* ✦ Шкалы мифических сил */}
          {hasMythic(player, "mythic_nova") && (
            <MythicMeter icon="☀️" label="ЗВЁЗДНОЕ ЯДРО" value={Math.floor(player.novaCore)} max={100}
              color="from-amber-300 to-yellow-500" critical={player.novaCore >= 100} />
          )}
          {hasMythic(player, "mythic_singularity") && (
            <MythicMeter icon="🌌" label="КОЛЛАПС" value={Math.floor(player.collapseCharge)} max={50}
              color="from-violet-400 to-purple-600" />
          )}
          {hasMythic(player, "mythic_judgement") && (
            <MythicMeter icon="⚡" label="ГНЕВ БУРИ" value={player.wrath} max={10}
              color="from-yellow-200 to-amber-400" critical={player.wrath >= 10} />
          )}
          {hasMythic(player, "mythic_overdrive") && (
            <MythicMeter icon="🔥" label={player.overdriveTimer > 0 ? "OVERDRIVE!" : player.overdriveCooldown > 0 ? "ОСТЫВАНИЕ" : "ПЕРЕГРУЗКА"}
              value={player.overdriveTimer > 0 ? Math.round(player.overdriveTimer / 60 * 10) / 10 : Math.floor(player.overdriveCharge)}
              max={player.overdriveTimer > 0 ? 10 : 100} unit={player.overdriveTimer > 0 ? "с" : "%"}
              color="from-orange-300 to-red-500" critical={player.overdriveTimer > 0} />
          )}
          {hasMythic(player, "mythic_fleet") && (
            <MythicMeter icon="🛰️" label="АРМАДНЫЙ КАНАЛ" value={Math.floor(player.fleetCharge)} max={100}
              color="from-sky-300 to-blue-500" critical={player.fleetSalvoTimer > 0} />
          )}
          {hasMythic(player, "mythic_void") && (
            <MythicMeter icon="👁" label="ЭНТРОПИЯ ПУСТОТЫ" value={Math.floor(player.entropy)} max={100}
              color="from-fuchsia-300 to-purple-600" critical={player.voidTimer > 0} />
          )}
          {/* XP */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-0.5">
              <span className="text-purple-400 font-bold">⭐ УРОВЕНЬ {player.level}</span>
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
        <div className="text-center bg-slate-950/80 px-6 py-2.5 rounded-xl border border-slate-800/80 backdrop-blur-md shadow-xl">
          <div className="text-[11px] text-slate-400 font-mono tracking-widest font-bold">ВОЛНА</div>
          <div className="text-3xl font-black text-white font-mono leading-none my-0.5">{wave}</div>
          <div className="text-xs text-slate-400 font-mono">👾 осталось врагов: {enemiesLeft}</div>
          {player.combo > 1 && (
            <div className="text-xs text-yellow-400 font-mono font-black animate-pulse mt-1">
              🔥 СЕРИЯ x{player.combo}! (+{player.combo * 5}%)
            </div>
          )}
          {timeSlow && (
            <div className="text-xs text-cyan-400 font-mono font-bold animate-pulse mt-1">⏱ ЗАМЕДЛЕНИЕ ВРЕМЕНИ</div>
          )}
          {player.shipClass === "void_wraith" && player.ghostTimer > 0 && (
            <div className="text-xs text-fuchsia-400 font-mono font-black animate-pulse mt-1">👻 ФАЗА — НЕУЯЗВИМЫ</div>
          )}
          {player.rapidBoostTimer > 0 && (
            <div className="text-xs text-sky-400 font-mono font-bold animate-pulse mt-0.5">⚡ ОВЕРДРАЙВ ({Math.ceil(player.rapidBoostTimer / 60)}с)</div>
          )}
        </div>

        {/* Right: Score + Kills */}
        <div className="text-right w-60 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 backdrop-blur-md font-mono shadow-xl">
          <div className="text-[11px] text-yellow-400 font-bold tracking-widest">СЧЁТ ОЧКОВ</div>
          <div className="text-2xl font-black text-white">{player.score.toLocaleString()}</div>
          <div className="text-xs text-slate-300 mt-0.5">💀 Уничтожено: {player.kills}</div>
          {player.goldMultiplier > 1 && (
            <div className="text-xs text-yellow-300 font-bold">×{player.goldMultiplier.toFixed(1)} Множитель</div>
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
            {Math.ceil(bossHpPct * 100)}% ПРОЧНОСТИ
            {bossPhase ? ` · ФАЗА: ${bossPhase}` : ""}
            {bossVulnerable ? " · ⚠ УЯЗВИМ" : ""}
          </div>
        </div>
      )}

      {/* Bottom: abilities */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {/* Dash ability indicator */}
        <div
          className={`px-4 py-2 rounded-xl text-xs font-mono font-black border transition-all pointer-events-none shadow-lg ${
            player.dashCooldown > 0
              ? "bg-slate-900/80 border-slate-700 text-slate-500"
              : "bg-indigo-900/90 border-indigo-400 text-indigo-100 shadow-indigo-950/50"
          }`}
        >
          💨 РЫВОК [SHIFT]
          <div className="text-[10px] opacity-80">
            {player.dashCooldown > 0 ? `${(player.dashCooldown / 60).toFixed(1)}с` : "ГОТОВ"}
          </div>
        </div>

        {player.nukeCharges > 0 && (
          <button
            onClick={onNuke}
            className="px-4 py-2 bg-red-900/90 border border-red-500 text-red-100 rounded-xl text-xs font-mono font-black hover:bg-red-700 active:scale-95 transition-all pointer-events-auto shadow-lg shadow-red-950/50 cursor-pointer"
          >
            ☢️ ЯДЕРНЫЙ УДАР ×{player.nukeCharges}
            <div className="text-[10px] text-red-300 opacity-80">[X] КЛАВИША</div>
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
            ⏱️ ЗАМЕДЛЕНИЕ {player.timeSlowCooldown > 0 ? `(${Math.ceil(player.timeSlowCooldown / 60)}с)` : ""}
            <div className="text-[10px] opacity-80">[C] КЛАВИША</div>
          </button>
        )}
      </div>

      {/* Active build synergies */}
      {player.synergies.length > 0 && (
        <div className="absolute bottom-24 left-3 z-10 space-y-1 pointer-events-none">
          {player.synergies.map(id => {
            const synergy = SYNERGIES.find(item => item.id === id);
            return synergy ? (
              <div key={id} className="rounded-lg border border-fuchsia-500/60 bg-fuchsia-950/90 px-3 py-1.5 text-[10px] font-black text-fuchsia-200 shadow-lg">
                {synergy.icon} {synergy.name}
              </div>
            ) : null;
          })}
        </div>
      )}

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
              🛰️ Сателлиты: {player.satellites.length}
            </div>
          )}
          {player.drones.length > 0 && (
            <div className="text-xs px-2.5 py-1 bg-slate-900/80 border border-purple-500/40 rounded-lg text-purple-400 font-mono font-bold">
              🤖 Дроны: {player.drones.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** ✦ Шкала мифической силы: компактная полоса с пороговым свечением. */
function MythicMeter({ icon, label, value, max, color, unit = "", critical = false }: {
  icon: string; label: string; value: number; max: number; color: string; unit?: string; critical?: boolean;
}) {
  return (
    <div className={critical ? "animate-pulse" : ""}>
      <div className="flex justify-between text-[10px] font-mono mb-0.5">
        <span className={critical ? "text-amber-200 font-bold" : "text-amber-400/90 font-bold"}>{icon} {label}</span>
        <span className="text-amber-200/80 font-bold">{Math.floor(value)}/{max}{unit}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-amber-900/50">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-200`}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}
