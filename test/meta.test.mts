import { test } from "node:test";
import assert from "node:assert/strict";
import {
  META_UPGRADES, metaUpgradeCost, getMetaLevel, canBuyMetaUpgrade, buyMetaUpgrade,
  applyMetaToPlayer, metaBonusRerolls, shardMultiplier, computeShardsEarned,
  MISSIONS, missionProgress, isMissionComplete, updateMissions, claimMission,
  defaultMetaState, normalizeMetaState, type MetaState, type RunResult, type MissionContext,
} from "../src/game/meta";
import { makeInitialPlayer } from "../src/game/gameLoop";
import { checkEvolutions } from "../src/game/evolutions";
import { ALL_UPGRADES, applyUpgrade } from "../src/game/upgrades";

function runResult(over: Partial<RunResult> = {}): RunResult {
  return { score: 0, wave: 0, kills: 0, bossesKilled: 0, elitesKilled: 0, powerupsCollected: 0, synergiesUnlocked: 0, evolutionsTriggered: 0, accuracy: 0, shotsFired: 0, durationSec: 1, victory: false, revived: false, bossDamageTaken: 0, shipClass: "interceptor", ...over };
}
function ctx(state: MetaState, run: RunResult): MissionContext {
  return { run, totals: state.totals, unlockedProducts: state.unlockedProducts };
}

test("upgrade cost scales with level", () => {
  const def = META_UPGRADES.find(d => d.id === "reinforced_hull")!;
  assert.equal(metaUpgradeCost(def, 0), 40);
  assert.equal(metaUpgradeCost(def, 1), 80);
  assert.equal(metaUpgradeCost(def, 4), 200);
});

test("buying deducts shards, levels up, caps at maxLevel", () => {
  const s = { ...defaultMetaState(), shards: 1000 };
  const def = META_UPGRADES.find(d => d.id === "reinforced_hull")!;
  assert.equal(canBuyMetaUpgrade(s, def), true);
  assert.equal(buyMetaUpgrade(s, def), true);
  assert.equal(getMetaLevel(s, def.id), 1);
  assert.equal(s.shards, 960);
  for (let i = 0; i < 10; i++) buyMetaUpgrade(s, def);
  assert.equal(getMetaLevel(s, def.id), def.maxLevel);
  assert.equal(canBuyMetaUpgrade(s, def), false);
});

test("reinforced_hull adds max HP per level", () => {
  const s = { ...defaultMetaState(), upgrades: { reinforced_hull: 3 } };
  const base = makeInitialPlayer("interceptor");
  const baseHp = base.maxHp;
  applyMetaToPlayer(s, base);
  assert.equal(base.maxHp, baseHp + 60);
  assert.equal(base.hp, base.maxHp);
});

test("field_logistics rerolls + premium_pass doubles shards", () => {
  const s = { ...defaultMetaState(), upgrades: { field_logistics: 2 }, unlockedProducts: ["premium_pass"] };
  assert.equal(metaBonusRerolls(s), 2);
  const run = runResult({ score: 1200, wave: 10, kills: 40 });
  // base = floor(1200/120 + 40 + 60) = 110; x2 pass = 220
  assert.equal(computeShardsEarned(run, s), 220);
});

test("shard_magnet stacks with premium_pass", () => {
  const s = { ...defaultMetaState(), upgrades: { shard_magnet: 3 }, unlockedProducts: ["premium_pass"] };
  assert.ok(Math.abs(shardMultiplier(s) - 2.6) < 1e-6);
});

test("cumulative kill mission tracks across runs and rewards on claim", () => {
  let s = { ...defaultMetaState() };
  const kill100 = MISSIONS.find(m => m.id === "kill_100")!;
  s.totals.kills += 60;
  updateMissions(ctx(s, runResult({ kills: 60 })), s);
  s.totals.kills += 40;
  updateMissions(ctx(s, runResult({ kills: 40 })), s);
  assert.equal(isMissionComplete(kill100, s), true);
  const before = s.shards;
  assert.equal(claimMission(s, kill100), true);
  assert.equal(s.shards, before + kill100.reward);
  assert.equal(claimMission(s, kill100), false);
});

test("wave mission uses run wave", () => {
  const s = { ...defaultMetaState() };
  const w10 = MISSIONS.find(m => m.id === "wave_10")!;
  const c = ctx(s, runResult({ wave: 10 }));
  assert.equal(missionProgress(w10, c), 10);
  updateMissions(c, s);
  assert.equal(isMissionComplete(w10, s), true);
});

test("corrupted save falls back to defaults", () => {
  assert.equal(normalizeMetaState(null).shards, 0);
  assert.equal(normalizeMetaState("garbage" as unknown).shards, 0);
  assert.equal(normalizeMetaState({ shards: -5, upgrades: { x: -1 } }).shards, 0);
});

test("valid save round-trips", () => {
  const s = { ...defaultMetaState(), shards: 42, upgrades: { reinforced_hull: 2 }, unlockedProducts: ["premium_pass"] };
  const restored = normalizeMetaState(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.shards, 42);
  assert.equal(getMetaLevel(restored, "reinforced_hull"), 2);
  assert.ok(restored.unlockedProducts.includes("premium_pass"));
});

test("evolution triggers once when requirements owned", () => {
  const player = makeInitialPlayer("interceptor");
  for (const id of ["double_shot", "piercing", "explosive"]) {
    applyUpgrade(player, ALL_UPGRADES.find(u => u.id === id)!);
  }
  const triggered = checkEvolutions(player);
  assert.ok(triggered.some(e => e.id === "annihilator"));
  assert.equal(checkEvolutions(player).length, 0);
});
