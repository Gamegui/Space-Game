import { test } from "node:test";
import assert from "node:assert/strict";
import {
  META_UPGRADES, metaUpgradeCost, getMetaLevel, canBuyMetaUpgrade, buyMetaUpgrade,
  applyMetaToPlayer, metaBonusRerolls, shardMultiplier, computeShardsEarned,
  applyRunResult,
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
  // base = floor(1200/1000 + 30 + 4) = 35; x2 pass = 70
  assert.equal(computeShardsEarned(run, s), 70);
});

test("shard economy: one run can never buy out the Hangar", () => {
  const fullCost = META_UPGRADES.reduce((sum, def) => {
    let cost = 0;
    for (let level = 0; level < def.maxLevel; level++) cost += metaUpgradeCost(def, level);
    return sum + cost;
  }, 0);
  assert.ok(fullCost > 4000, `fullCost=${fullCost}`);
  // A strong victory run (wave 50, 60k score, 1500 kills).
  const victoryEarned = computeShardsEarned(
    runResult({ score: 60_000, wave: 50, kills: 1500, victory: true }),
    defaultMetaState(),
  );
  // Even the best run pays a few hundred shards — a small fraction of the
  // full curve, so maxing everything takes many runs, not one.
  assert.ok(victoryEarned >= 350 && victoryEarned <= 450, `victoryEarned=${victoryEarned}`);
  assert.ok(victoryEarned < fullCost / 8, `victoryEarned=${victoryEarned}, fullCost=${fullCost}`);
  // A typical mid run (wave 12, 8k score, 300 kills) pays tens of shards.
  const midEarned = computeShardsEarned(runResult({ score: 8_000, wave: 12, kills: 300 }), defaultMetaState());
  assert.ok(midEarned >= 50 && midEarned <= 100, `midEarned=${midEarned}`);
  // Score/kills inflation is capped: an absurd 500k-score, 8k-kill run pays
  // the same as the cap allows, never thousands.
  const absurdEarned = computeShardsEarned(runResult({ score: 500_000, wave: 80, kills: 8_000, victory: true }), defaultMetaState());
  assert.ok(absurdEarned <= 500, `absurdEarned=${absurdEarned}`);
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

test("applyRunResult is pure — enables the revive rollback", () => {
  const start = defaultMetaState();
  start.shards = 7;
  const frozen = JSON.parse(JSON.stringify(start)) as MetaState;
  const run = runResult({ score: 3000, wave: 6, kills: 120, bossesKilled: 1, powerupsCollected: 9 });
  const { next, earned } = applyRunResult(start, run);
  assert.ok(earned > 0);
  assert.equal(next.shards, 7 + earned);
  assert.equal(next.totals.kills, 120);
  assert.equal(next.totals.runs, 1);
  assert.equal(next.totals.bossesKilled, 1);
  // The input state must be untouched: App.tsx keeps it as the pre-finalize
  // snapshot and restores it when the player revives after the death screen.
  assert.deepEqual(start, frozen);
});

test("revive rollback: restoring the snapshot re-awards the full run exactly once", () => {
  const start = defaultMetaState();
  // First death at wave 8 → premature finalize from the snapshot…
  const first = applyRunResult(start, runResult({ score: 2000, wave: 8, kills: 60 }));
  // …revive → App restores the snapshot, run continues, true end at wave 12.
  const final = applyRunResult(start, runResult({ score: 5000, wave: 12, kills: 150 }));
  const uninterrupted = applyRunResult(defaultMetaState(), runResult({ score: 5000, wave: 12, kills: 150 }));
  assert.deepEqual(final.next, uninterrupted.next);
  assert.ok(first.earned > 0);
  // Double-finalizing WITHOUT a rollback must not silently equal a single one
  // (guards the runFinalizedRef contract in App.tsx).
  const doubleFinalize = applyRunResult(first.next, runResult({ score: 5000, wave: 12, kills: 150 }));
  assert.notDeepEqual(doubleFinalize.next, uninterrupted.next);
});

test("applyRunResult completes and reports newly finished missions", () => {
  const start = defaultMetaState();
  const { next, newlyCompleted } = applyRunResult(start, runResult({ score: 6000, wave: 12, kills: 130 }));
  const ids = newlyCompleted.map(m => m.id);
  assert.ok(ids.includes("first_blood"));
  assert.ok(ids.includes("kill_100"));
  assert.ok(ids.includes("wave_10"));
  assert.ok(ids.includes("rich"));
  const rich = MISSIONS.find(m => m.id === "rich")!;
  assert.equal(isMissionComplete(rich, next), true);
  assert.equal(next.claimedMissions[rich.id], undefined);
});

test("no_revive mission only completes when the run was not revived", () => {
  const s = defaultMetaState();
  const clean = applyRunResult(s, runResult({ wave: 25 }));
  assert.ok(clean.newlyCompleted.some(m => m.id === "no_revive"));
  const revived = applyRunResult(s, runResult({ wave: 25, revived: true }));
  assert.ok(!revived.newlyCompleted.some(m => m.id === "no_revive"));
});
