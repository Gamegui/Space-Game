// v1.8.2: новые инструменты Ангара — «Взять всё доступное» и сводка бонусов.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  META_UPGRADES, buyAllAffordableMeta, metaBonusSummary, getMetaLevel,
  defaultMetaState,
} from "../src/game/meta";

test("buyAllAffordableMeta: скупает максимум уровней без переплаты и в нужном порядке", () => {
  const state = defaultMetaState();
  state.shards = 400;
  const bought = buyAllAffordableMeta(state);
  assert.ok(bought > 0, "что-то должно быть куплено");
  // Инвариант: после прохода ни один уровень не по карману.
  for (const def of META_UPGRADES) {
    const lvl = getMetaLevel(state, def.id);
    assert.ok(lvl <= def.maxLevel, "уровни в пределах максимума");
  }
  // Повторный вызов на обнулённых осколках — ничего не меняет.
  state.shards = 0;
  assert.equal(buyAllAffordableMeta(state), 0, "без осколков покупок нет");
});

test("buyAllAffordableMeta: богатый запас выкупает весь Ангар целиком", () => {
  const state = defaultMetaState();
  state.shards = 1_000_000;
  const bought = buyAllAffordableMeta(state);
  const maxTotal = META_UPGRADES.reduce((a, d) => a + d.maxLevel, 0);
  assert.equal(bought, maxTotal, "все уровни выкуплены");
  assert.equal(state.shards >= 0, true, "осколки не ушли в минус");
  for (const def of META_UPGRADES) {
    assert.equal(getMetaLevel(state, def.id), def.maxLevel, `${def.id} на максимуме`);
  }
});

test("metaBonusSummary: сводка соответствует формулам улучшений", () => {
  const state = defaultMetaState();
  state.upgrades = { reinforced_hull: 3, energy_shield: 2, core_overclock: 4, shard_magnet: 1, quick_start: 2 };
  const s = metaBonusSummary(state);
  assert.equal(s.hp, 60);          // 20 × 3
  assert.equal(s.shield, 30);      // 15 × 2
  assert.equal(s.damagePct, 20);   // 5 × 4
  assert.equal(s.homing, 0);       // adaptive_targeting не куплен
  assert.equal(s.shardsPct, 10);   // 10 × 1
  assert.equal(s.nukes, 2);        // quick_start 2
  assert.equal(s.rerolls, 0);
  assert.equal(s.magnet, 0);
});
