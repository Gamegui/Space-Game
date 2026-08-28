// ─── Meta-progression (v1.5.0) ──────────────────────────────────────────────
// Permanent, cross-run progression. Every run earns "Осколки ядра" (Core Shards)
// even on death, spent in the Hangar on permanent upgrades. State is cloud-saved
// through the Yandex Player Data API (key `meta_v1`) with a localStorage fallback
// for development and guests.

import type { PlayerState } from "./types";
import { ALL_UPGRADES, applyUpgrade } from "./upgrades";

export interface MetaUpgradeDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  /** Apply the owned level to a fresh run's player state. */
  apply: (state: PlayerState, level: number) => void;
}

export interface MissionDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  reward: number; // shards
  /** Returns the numeric progress for this mission given the run result + totals. */
  progress: (ctx: MissionContext) => number;
  /** Completion threshold (progress >= this). */
  goal: number;
}

export interface RunResult {
  score: number;
  wave: number;
  kills: number;
  bossesKilled: number;
  elitesKilled: number;
  powerupsCollected: number;
  synergiesUnlocked: number;
  evolutionsTriggered: number;
  accuracy: number; // 0..100
  shotsFired: number;
  durationSec: number;
  victory: boolean;
  revived: boolean;
  bossDamageTaken: number; // damage taken during any boss
  shipClass: string;
}

export interface MissionContext {
  run: RunResult;
  totals: {
    kills: number;
    bossesKilled: number;
    elitesKilled: number;
    powerupsCollected: number;
    runs: number;
    shardsEarned: number;
    synergies: number;
    evolutions: number;
  };
  unlockedProducts: string[];
}

export interface MetaState {
  version: number;
  shards: number;
  upgrades: Record<string, number>;
  unlockedProducts: string[];
  missions: Record<string, number>; // id -> best progress
  claimedMissions: Record<string, boolean>;
  totals: {
    kills: number;
    bossesKilled: number;
    elitesKilled: number;
    powerupsCollected: number;
    runs: number;
    shardsEarned: number;
    synergies: number;
    evolutions: number;
  };
}

export const META_KEY = "meta_v1";

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: "reinforced_hull", name: "Усиленный корпус", icon: "🛡️", maxLevel: 5, baseCost: 40,
    description: "+20 к макс. HP за уровень (старт каждого забега)",
    apply: (s, l) => { s.maxHp += 20 * l; s.hp = s.maxHp; },
  },
  {
    id: "energy_shield", name: "Энергощит", icon: "🔵", maxLevel: 5, baseCost: 40,
    description: "+15 к щиту за уровень",
    apply: (s, l) => {
      if (!s.shield) s.shield = { hp: 0, maxHp: 0, regenTimer: 0 };
      s.shield.maxHp += 15 * l;
      s.shield.hp = s.shield.maxHp;
    },
  },
  {
    id: "tractor_beam", name: "Тракторный луч", icon: "🧲", maxLevel: 5, baseCost: 35,
    description: "+30 к радиусу притяжения опыта за уровень",
    apply: (s, l) => { s.magnetRange += 30 * l; },
  },
  {
    id: "field_logistics", name: "Полевая логистика", icon: "♻️", maxLevel: 3, baseCost: 60,
    description: "+1 бесплатный реролл за уровень (старт забега)",
    apply: () => { /* handled in App.tsx (rerollsLeft) */ },
  },
  {
    id: "core_overclock", name: "Разгон ядра", icon: "💠", maxLevel: 5, baseCost: 50,
    description: "+5% к урону снарядов за уровень",
    apply: (s, l) => { s.bulletDamage *= 1 + 0.05 * l; },
  },
  {
    id: "adaptive_targeting", name: "Адаптивное наведение", icon: "🎯", maxLevel: 5, baseCost: 45,
    description: "+0.02 к силе самонаведения за уровень",
    apply: (s, l) => { s.homing = true; s.homingStrength += 0.02 * l; },
  },
  {
    id: "vanguard_armed", name: "Авангард", icon: "⚔️", maxLevel: 1, baseCost: 90,
    description: "Каждый забег начинается со случайного общего улучшения",
    apply: (s) => {
      const commons = ALL_UPGRADES.filter(u => u.rarity === "common" && u.maxLevel >= 1);
      if (commons.length > 0) {
        const pick = commons[Math.floor(Math.random() * commons.length)];
        applyUpgrade(s, pick);
      }
    },
  },
  {
    id: "shard_magnet", name: "Магнит осколков", icon: "✨", maxLevel: 5, baseCost: 55,
    description: "+10% к получаемым осколкам за уровень",
    apply: () => { /* handled in shard earning formula */ },
  },
  {
    id: "quick_start", name: "Быстрый старт", icon: "💣", maxLevel: 2, baseCost: 50,
    description: "+1 ядерный заряд за уровень (старт забега)",
    apply: (s, l) => { s.nukeCharges += l; },
  },
];

export function metaUpgradeCost(def: MetaUpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * (1 + currentLevel));
}

export function getMetaLevel(state: MetaState, id: string): number {
  return state.upgrades[id] ?? 0;
}

export function canBuyMetaUpgrade(state: MetaState, def: MetaUpgradeDef): boolean {
  return getMetaLevel(state, def.id) < def.maxLevel && state.shards >= metaUpgradeCost(def, getMetaLevel(state, def.id));
}

export function buyMetaUpgrade(state: MetaState, def: MetaUpgradeDef): boolean {
  if (!canBuyMetaUpgrade(state, def)) return false;
  const level = getMetaLevel(state, def.id);
  state.shards -= metaUpgradeCost(def, level);
  state.upgrades[def.id] = level + 1;
  return true;
}

/** Apply all owned permanent upgrades to a fresh run's player state. */
export function applyMetaToPlayer(state: MetaState, player: PlayerState): void {
  for (const def of META_UPGRADES) {
    const level = getMetaLevel(state, def.id);
    if (level > 0) def.apply(player, level);
  }
}

/** Bonus free rerolls granted by the field_logistics meta upgrade. */
export function metaBonusRerolls(state: MetaState): number {
  return getMetaLevel(state, "field_logistics");
}

/** Shard multiplier from shard_magnet + premium pass ownership. */
export function shardMultiplier(state: MetaState): number {
  const magnet = 1 + 0.1 * getMetaLevel(state, "shard_magnet");
  const pass = state.unlockedProducts.includes("premium_pass") ? 2 : 1;
  return magnet * pass;
}

export function computeShardsEarned(run: RunResult, state: MetaState): number {
  // v1.5.0 balance: the full Hangar max-out costs ~4.6k shards, so a typical
  // run must pay tens of shards and even a perfect victory run only a few
  // hundred (~10% of the curve) — otherwise the whole meta-progression
  // collapses in a single long run (kills grow superlinearly, hence the tiny
  // per-kill coefficient and the pre-multiplier cap as a safety valve).
  // Reference payouts: early death ≈ 7–15, wave 10–15 run ≈ 50–90,
  // wave 30 run ≈ 150–250, wave-50 victory ≈ 350–450.
  const base = Math.min(
    500,
    Math.floor(run.score / 1000 + run.wave * 3 + run.kills * 0.1 + (run.victory ? 60 : 0)),
  );
  const min = run.victory ? 15 : 5;
  return Math.max(min, Math.floor(base * shardMultiplier(state)));
}

/** Fold a finished run into the meta state: totals, shards, mission progress.
 *  Pure — never mutates `state`, always returns a fresh object. Purity is what
 *  lets App.tsx keep a pre-finalize snapshot and roll a premature finalization
 *  back when the player uses an ad-revive (see handleRevive). */
export function applyRunResult(state: MetaState, run: RunResult): { next: MetaState; earned: number; newlyCompleted: MissionDef[] } {
  const next: MetaState = {
    ...state,
    missions: { ...state.missions },
    claimedMissions: { ...state.claimedMissions },
    totals: { ...state.totals },
  };
  next.totals.kills += run.kills;
  next.totals.bossesKilled += run.bossesKilled;
  next.totals.elitesKilled += run.elitesKilled;
  next.totals.powerupsCollected += run.powerupsCollected;
  next.totals.runs += 1;
  next.totals.synergies += run.synergiesUnlocked;
  next.totals.evolutions += run.evolutionsTriggered;
  const earned = computeShardsEarned(run, next);
  next.shards += earned;
  next.totals.shardsEarned += earned;
  const ctx: MissionContext = { run, totals: next.totals, unlockedProducts: next.unlockedProducts };
  const newlyCompleted = updateMissions(ctx, next);
  return { next, earned, newlyCompleted };
}

// ─── Missions ────────────────────────────────────────────────────────────────

export const MISSIONS: MissionDef[] = [
  { id: "first_blood", name: "Первая кровь", icon: "🩸", reward: 5, goal: 1, description: "Уничтожьте 1 врага", progress: c => c.totals.kills },
  { id: "kill_100", name: "Истребитель", icon: "💀", reward: 10, goal: 100, description: "Уничтожьте 100 врагов", progress: c => c.totals.kills },
  { id: "kill_1000", name: "Жнец", icon: "☠️", reward: 25, goal: 1000, description: "Уничтожьте 1000 врагов", progress: c => c.totals.kills },
  { id: "wave_5", name: "Выжить 5 волн", icon: "🌊", reward: 10, goal: 5, description: "Достигните 5-й волны", progress: c => c.run.wave },
  { id: "wave_10", name: "Тактик", icon: "🎖️", reward: 15, goal: 10, description: "Достигните 10-й волны", progress: c => c.run.wave },
  { id: "wave_25", name: "Ветеран", icon: "🏅", reward: 30, goal: 25, description: "Достигните 25-й волны", progress: c => c.run.wave },
  { id: "wave_50", name: "Победитель", icon: "🏆", reward: 60, goal: 50, description: "Победите ОМЕГУ (волна 50)", progress: c => c.run.wave },
  { id: "boss_slayer", name: "Убийца боссов", icon: "👹", reward: 15, goal: 1, description: "Победите 1 босса", progress: c => c.totals.bossesKilled },
  { id: "boss_master", name: "Палач боссов", icon: "⚔️", reward: 30, goal: 10, description: "Победите 10 боссов", progress: c => c.totals.bossesKilled },
  { id: "elite_hunter", name: "Охотник на элиту", icon: "🎯", reward: 20, goal: 50, description: "Уничтожьте 50 элитных врагов", progress: c => c.totals.elitesKilled },
  { id: "synergy_apprentice", name: "Синергия", icon: "🔗", reward: 15, goal: 1, description: "Откройте 1 синергию", progress: c => c.totals.synergies },
  { id: "synergy_master", name: "Мастер связей", icon: "🌟", reward: 40, goal: 4, description: "Откройте все 4 синергии за забег", progress: c => c.run.synergiesUnlocked },
  { id: "rich", name: "Богач", icon: "💰", reward: 20, goal: 5000, description: "Наберите 5000 очков за забег", progress: c => c.run.score },
  { id: "richer", name: "Миллиардер", icon: "💎", reward: 50, goal: 50000, description: "Наберите 50000 очков за забег", progress: c => c.run.score },
  { id: "no_revive", name: "Без передышки", icon: "🚫", reward: 25, goal: 1, description: "Дойдите до 25 волны без revive", progress: c => (c.run.wave >= 25 && !c.run.revived ? 1 : 0) },
  { id: "sharpshooter", name: "Снайпер", icon: "🔭", reward: 25, goal: 1, description: "Точность 80%+ за 100+ выстрелов", progress: c => (c.run.shotsFired >= 100 && c.run.accuracy >= 80 ? 1 : 0) },
  { id: "collector", name: "Сборщик", icon: "📦", reward: 15, goal: 50, description: "Соберите 50 бонусов", progress: c => c.totals.powerupsCollected },
  { id: "collector_pro", name: "Кладоискатель", icon: "🗝️", reward: 25, goal: 200, description: "Соберите 200 бонусов", progress: c => c.totals.powerupsCollected },
  { id: "wraith_owner", name: "Призрак", icon: "👻", reward: 30, goal: 1, description: "Откройте корабль «Немезида»", progress: c => c.unlockedProducts.includes("void_wraith") ? 1 : 0 },
  { id: "pass_owner", name: "Ускоритель", icon: "⚡", reward: 30, goal: 1, description: "Откройте «Ускоритель прогресса»", progress: c => c.unlockedProducts.includes("premium_pass") ? 1 : 0 },
  { id: "persistent", name: "Упорный", icon: "🔁", reward: 15, goal: 10, description: "Сыграйте 10 забегов", progress: c => c.totals.runs },
  { id: "veteran", name: "Опытный", icon: "🎖️", reward: 30, goal: 50, description: "Сыграйте 50 забегов", progress: c => c.totals.runs },
  { id: "evolver", name: "Эволюционер", icon: "🧬", reward: 20, goal: 1, description: "Запустите 1 эволюцию оружия", progress: c => c.totals.evolutions },
  { id: "shard_hoarder", name: "Копитель", icon: "✨", reward: 20, goal: 500, description: "Заработайте 500 осколков всего", progress: c => c.totals.shardsEarned },
];

export function missionProgress(def: MissionDef, ctx: MissionContext): number {
  return Math.max(0, Math.min(def.goal, def.progress(ctx)));
}

export function isMissionComplete(def: MissionDef, state: MetaState): boolean {
  return (state.missions[def.id] ?? 0) >= def.goal;
}

/** Update mission best-progress and return newly-completed (unclaimed) missions. */
export function updateMissions(ctx: MissionContext, state: MetaState): MissionDef[] {
  const newly: MissionDef[] = [];
  for (const def of MISSIONS) {
    const prog = missionProgress(def, ctx);
    if (prog > (state.missions[def.id] ?? 0)) state.missions[def.id] = prog;
    if (prog >= def.goal && !(state.claimedMissions[def.id])) newly.push(def);
  }
  return newly;
}

/** Claim a completed mission's shard reward. */
export function claimMission(state: MetaState, def: MissionDef): boolean {
  if (!isMissionComplete(def, state) || state.claimedMissions[def.id]) return false;
  state.shards += def.reward;
  state.claimedMissions[def.id] = true;
  return true;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export function defaultMetaState(): MetaState {
  return {
    version: 1,
    shards: 0,
    upgrades: {},
    unlockedProducts: [],
    missions: {},
    claimedMissions: {},
    totals: { kills: 0, bossesKilled: 0, elitesKilled: 0, powerupsCollected: 0, runs: 0, shardsEarned: 0, synergies: 0, evolutions: 0 },
  };
}

/** Merge loaded state defensively against corrupted/partial saves. */
export function normalizeMetaState(loaded: unknown): MetaState {
  const base = defaultMetaState();
  if (!loaded || typeof loaded !== "object") return base;
  const l = loaded as Record<string, unknown>;
  try {
    base.shards = Math.max(0, Math.floor(Number(l.shards) || 0));
    if (l.upgrades && typeof l.upgrades === "object") {
      for (const [k, v] of Object.entries(l.upgrades as Record<string, unknown>)) {
        const n = Math.max(0, Math.floor(Number(v) || 0));
        if (n > 0) base.upgrades[k] = n;
      }
    }
    if (Array.isArray(l.unlockedProducts)) {
      base.unlockedProducts = l.unlockedProducts.filter(x => typeof x === "string");
    }
    if (l.missions && typeof l.missions === "object") {
      for (const [k, v] of Object.entries(l.missions as Record<string, unknown>)) {
        const n = Math.max(0, Math.floor(Number(v) || 0));
        if (n > 0) base.missions[k] = n;
      }
    }
    if (l.claimedMissions && typeof l.claimedMissions === "object") {
      for (const [k, v] of Object.entries(l.claimedMissions as Record<string, unknown>)) {
        if (v) base.claimedMissions[k] = true;
      }
    }
    if (l.totals && typeof l.totals === "object") {
      const t = l.totals as Record<string, unknown>;
      for (const key of Object.keys(base.totals) as (keyof MetaState["totals"])[]) {
        base.totals[key] = Math.max(0, Math.floor(Number(t[key]) || 0));
      }
    }
  } catch { /* corrupted save — start fresh */ }
  return base;
}
