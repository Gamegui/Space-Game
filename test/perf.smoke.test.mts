// ТЗ v1.6.0 §11.5/§12 — производительность поздних волн при максимуме эффектов
// и корректность пробития (одна цель не бьётся одним снарядом повторно).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepGame, makeInitialPlayer, makeStars, VOID_SOUL_MAX,
  type GameObjects, type StepInput,
} from "../src/game/gameLoop";
import { spawnEnemy } from "../src/game/enemies";
import { applyUpgrade, getUpgradeLevel } from "../src/game/upgrades";
import { unlockAvailableSynergies } from "../src/game/synergies";
import { checkEvolutions } from "../src/game/evolutions";
import { ALL_UPGRADES } from "../src/game/upgrades";

const noop = () => {};

function makeInput(): StepInput {
  return { keys: new Set<string>(), wave: 40, frame: 0, timeSlow: false, onLevelUp: noop, onDeath: noop, onBossKill: noop, onWaveComplete: noop, onKill: noop };
}

function makeObjects(player: ReturnType<typeof makeInitialPlayer>): GameObjects {
  return {
    player,
    bullets: [], enemies: [], particles: [], xpOrbs: [], mines: [], lightnings: [],
    stars: makeStars(), floatingTexts: [], powerups: [],
    blackHolePos: null, blackHoleTimer: 0, explosions: [],
    waveEnemyQueue: [], waveSpawnTimer: 0, bossActive: false, boss: null, waveTimer: 0,
    screenShake: 0, powerRating: 100, adaptiveDifficulty: 1,
    routeXpMultiplier: 1, routeScoreMultiplier: 1, activeRoute: "warzone", routeEffect: "none",
    performanceTier: 2, performanceAuto: false, waveStartedFrame: 0,
    guardSpawnedThisWave: false, fastClearStreak: 0, guardEventActive: false,
  };
}

function maxOut(player: ReturnType<typeof makeInitialPlayer>, id: string) {
  const def = ALL_UPGRADES.find(u => u.id === id)!;
  while (getUpgradeLevel(player, id) < def.maxLevel) applyUpgrade(player, def);
}

test("пробитие не бьёт одну цель повторно при длительном перекрытии", () => {
  const player = makeInitialPlayer("interceptor");
  player.pos = { x: 480, y: 620 };
  const obj = makeObjects(player);
  const enemy = spawnEnemy("tank", 20);
  enemy.pos = { x: 120, y: 120 };
  enemy.hp = enemy.maxHp = 1_000_000;
  enemy.shieldHp = enemy.maxShieldHp = 0; // танк со щитом уходит в ветку щита
  obj.enemies.push(enemy);
  const dmg = 2;
  obj.bullets.push({
    id: 1, pos: { x: 120, y: 120 }, vel: { x: 0, y: 0 },
    fromPlayer: true, damage: dmg, size: 4, color: "#fff", pierce: 3, homing: false,
  });
  for (let frame = 0; frame < 40; frame++) {
    obj.performanceTier = 2;
    stepGame(obj, { ...makeInput(), frame });
    obj.bullets = obj.bullets.filter(b => b.id === 1);
    obj.particles.length = 0;
    obj.floatingTexts.length = 0;
    obj.xpOrbs.length = 0;
  }
  const lost = 1_000_000 - enemy.hp;
  assert.ok(lost <= dmg * 2, `одна цель получила ${lost} урона за 40 кадров перекрытия — повторные попадания`);
  assert.ok(lost > 0, "первое попадание должно наносить урон");
});

test("поздние волны при максимуме эффектов: производительность и стабильность (билд «Немезида»)", () => {
  // ТЗ §12 Билд 7: души, двойные болты, фаза, эхо, щит, ранние Epic+,
  // плюс multishot/пробитие/взрывы/молнии/спутники/дроны/аура.
  const player = makeInitialPlayer("void_wraith");
  player.level = 40;
  for (const id of [
    "damage_up", "big_bullets", "rapid_fire", "piercing", "explosive", "homing",
    "double_shot", "spread_shot", "bullet_hail", "lightning", "chain_lightning",
    "crit", "satellite_1", "drone_1", "drone_link", "drone_swarm", "aura",
    "shield", "shield_regen", "life_steal", "magnet", "bullet_speed",
    "phase_discharge", "singularity_rounds", "multi_explosion", "megaton",
  ]) maxOut(player, id);
  unlockAvailableSynergies(player);
  checkEvolutions(player);
  player.voidSouls = VOID_SOUL_MAX;
  player.hp = player.maxHp;

  const obj = makeObjects(player);
  const types = ["scout", "fighter", "bomber", "tank", "spinner", "charger", "healer", "artillery"] as const;
  const topUp = () => {
    while (obj.enemies.length < 60) {
      const e = spawnEnemy(types[obj.enemies.length % types.length], 40);
      e.pos = { x: 60 + Math.random() * 840, y: 60 + Math.random() * 400 };
      obj.enemies.push(e);
    }
  };
  topUp();

  const steps = 600;
  const started = performance.now();
  let maxBullets = 0;
  for (let frame = 0; frame < steps; frame++) {
    stepGame(obj, { ...makeInput(), frame });
    if (frame % 60 === 0) topUp();
    maxBullets = Math.max(maxBullets, obj.bullets.length);
    // Бюджеты объектов (ТЗ §11.1/11.2) — не бесконтрольный рост.
    if (frame % 120 === 0) {
      assert.ok(obj.particles.length < 900, `частиц ${obj.particles.length}`);
      assert.ok(obj.floatingTexts.length < 500, `текстов ${obj.floatingTexts.length}`);
    }
  }
  const elapsed = performance.now() - started;
  const perStep = elapsed / steps;
  assert.ok(Number.isFinite(player.pos.x) && Number.isFinite(player.hp));
  for (const b of obj.bullets) assert.ok(Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y));
  assert.ok(maxBullets < 1500, `снарядов ${maxBullets} — дальность полёта должна ограничивать пул`);
  // Порог с запасом под медленные CI-машины: локально шаг занимает доли мс.
  assert.ok(perStep < 8, `средний шаг ${perStep.toFixed(3)} мс превышает бюджет`);
  console.log(`    late-wave sim: ${steps} шагов за ${elapsed.toFixed(0)} мс (${perStep.toFixed(3)} мс/шаг), максимум снарядов ${maxBullets}, врагов добито: ${player.kills}`);
});
