// ТЗ v1.6.0 §11.5/§12 — производительность поздних волн при максимуме эффектов
// и корректность пробития (одна цель не бьётся одним снарядом повторно).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepGame, makeInitialPlayer, makeStars, VOID_SOUL_MAX, PARTICLE_LIMITS,
  particleDebugStats,
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
  singularity: null,
  voidFractures: [],
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
      assert.ok(obj.particles.length <= PARTICLE_LIMITS.high, `частиц ${obj.particles.length}`);
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

test("стресс-каскад: массовая гибель со взрывами не ломает лимиты частиц (§14)", () => {
  // Сценарий зависания из ТЗ: взрывные снаряды + цепная детонация + рой +
  // плотная толпа. Каждый убитый враг раньше порождал взрыв с 5 частицами
  // НА КАЖДОГО врага в радиусе — до 6000 частиц за кадр.
  const player = makeInitialPlayer("void_wraith");
  player.level = 40;
  for (const id of [
    "damage_up", "rapid_fire", "explosive", "multi_explosion", "big_bullets",
    "double_shot", "bullet_hail", "spread_shot", "piercing", "homing",
    "chain_detonation", "megaton", "crit",
  ]) maxOut(player, id);
  unlockAvailableSynergies(player);
  checkEvolutions(player);
  player.voidSouls = VOID_SOUL_MAX;

  const obj = makeObjects(player);
  const types = ["scout", "fighter", "bomber", "tank", "spinner", "charger", "healer", "artillery"] as const;
  // Плотная толпа прямо над кораблём: каждый взрыв накрывает всех.
  const pack = () => {
    while (obj.enemies.length < 60) {
      const e = spawnEnemy(types[obj.enemies.length % types.length], 10);
      e.pos = { x: 480 + (Math.random() - 0.5) * 300, y: 120 + (Math.random() - 0.5) * 300 };
      obj.enemies.push(e);
    }
  };
  pack();

  const steps = 360;
  const started = performance.now();
  let maxActive = 0;
  let maxSpawnedPerFrame = 0;
  const xpBefore = player.xp;
  for (let frame = 0; frame < steps; frame++) {
    stepGame(obj, { ...makeInput(), frame });
    if (frame % 30 === 0) pack();
    const stats = particleDebugStats();
    assert.ok(stats.active <= PARTICLE_LIMITS.high, `кадр ${frame}: активных частиц ${stats.active} > ${PARTICLE_LIMITS.high}`);
    assert.ok(stats.spawnedThisFrame <= 80, `кадр ${frame}: создано за кадр ${stats.spawnedThisFrame} > 80`);
    maxActive = Math.max(maxActive, stats.active);
    maxSpawnedPerFrame = Math.max(maxSpawnedPerFrame, stats.spawnedThisFrame);
  }
  const elapsed = performance.now() - started;

  // Игровая логика не зависит от визуальных лимитов: убийства и опыт идут.
  assert.ok(player.kills > 30, `убийств ${player.kills} — логика должна работать`);
  assert.ok(player.xp > xpBefore || player.level > 40, "опыт должен начисляться");
  // Пул работает: погасшие частицы вернулись в пул для переиспользования.
  assert.ok(particleDebugStats().pooled > 0, "пул должен накапливать освобождённые частицы");
  const perStep = elapsed / steps;
  assert.ok(perStep < 8, `средний шаг ${perStep.toFixed(3)} мс`);
  console.log(`    cascade stress: убийств ${player.kills}, макс. частиц ${maxActive}/${PARTICLE_LIMITS.high}, макс. за кадр ${maxSpawnedPerFrame}/80, пул ${particleDebugStats().pooled}, ${perStep.toFixed(3)} мс/шаг`);
});

test("билд §14-2/3: максимальный multishot + пробитие держат бюджеты", () => {
  const player = makeInitialPlayer("tempest");
  player.level = 40;
  for (const id of ["double_shot", "triple_shot", "spread_shot", "bullet_hail", "omnidirectional", "rapid_fire", "reload_speed", "piercing", "quantum_tunnel", "death_ray", "homing", "lightning", "chain_lightning"]) maxOut(player, id);
  unlockAvailableSynergies(player);
  checkEvolutions(player);
  const obj = makeObjects(player);
  const types = ["scout", "fighter", "spinner", "charger"] as const;
  const pack = () => {
    while (obj.enemies.length < 60) {
      const e = spawnEnemy(types[obj.enemies.length % types.length], 20);
      e.pos = { x: 60 + Math.random() * 840, y: 60 + Math.random() * 500 };
      obj.enemies.push(e);
    }
  };
  pack();
  const started = performance.now();
  for (let frame = 0; frame < 300; frame++) {
    stepGame(obj, { ...makeInput(), frame });
    if (frame % 30 === 0) pack();
    const stats = particleDebugStats();
    assert.ok(stats.active <= PARTICLE_LIMITS.high);
    assert.ok(obj.bullets.length <= 1500, `снарядов ${obj.bullets.length}`);
  }
  console.log(`    multishot/pierce stress: ${(elapsedOf(started) / 300).toFixed(3)} мс/шаг, убийств ${player.kills}`);
});

function elapsedOf(started: number): number {
  return performance.now() - started;
}

test("ТЗ mythic §18: все 6 мификов + максимальный билд — бюджеты и стабильность", () => {
  const player = makeInitialPlayer("void_wraith");
  player.level = 45;
  for (const id of [
    "damage_up", "big_bullets", "rapid_fire", "piercing", "explosive", "homing",
    "double_shot", "bullet_hail", "spread_shot", "lightning", "chain_lightning",
    "crit", "satellite_1", "drone_1", "drone_link", "drone_swarm", "aura",
    "shield", "life_steal", "magnet", "bullet_speed", "phase_discharge",
    "singularity_rounds", "multi_explosion", "megaton",
    // ВСЕ ШЕСТЬ МИФИКОВ
    "mythic_nova", "mythic_singularity", "mythic_judgement",
    "mythic_overdrive", "mythic_fleet", "mythic_void",
  ]) maxOut(player, id);
  unlockAvailableSynergies(player);
  checkEvolutions(player);
  player.voidSouls = VOID_SOUL_MAX;
  player.hp = player.maxHp;
  player.critChance = 1; // Судный Разряд работает постоянно
  player.entropy = 90;   // Пустота активируется почти сразу
  player.novaCore = 90;  // сверхновая на подходе
  player.collapseCharge = 48;

  const obj = makeObjects(player);
  const types = ["scout", "fighter", "bomber", "tank", "spinner", "charger", "healer", "artillery"] as const;
  const pack = () => {
    while (obj.enemies.length < 60) {
      const e = spawnEnemy(types[obj.enemies.length % types.length], 10);
      e.pos = { x: 100 + Math.random() * 760, y: 80 + Math.random() * 420 };
      obj.enemies.push(e);
    }
  };
  pack();
  const started = performance.now();
  let novaFired = false, singularitySpawned = false, voidActive = false, salvo = false;
  for (let frame = 0; frame < 900; frame++) {
    stepGame(obj, { ...makeInput(), frame });
    if (frame % 30 === 0) pack();
    if (player.novaCore === 0 && frame > 30) novaFired = true;
    if (obj.singularity) singularitySpawned = true;
    if (player.voidTimer > 0) voidActive = true;
    if (player.fleetSalvoTimer > 0) salvo = true;
    const stats = particleDebugStats();
    assert.ok(stats.active <= PARTICLE_LIMITS.high, `кадр ${frame}: частиц ${stats.active}`);
    assert.ok(stats.spawnedThisFrame <= 80, `кадр ${frame}: за кадр ${stats.spawnedThisFrame}`);
    assert.ok(obj.voidFractures.length <= 8, `разрывов ${obj.voidFractures.length}`);
    assert.ok(obj.bullets.length <= 1500, `снарядов ${obj.bullets.length}`);
    assert.ok(Number.isFinite(player.hp) && Number.isFinite(player.pos.x));
  }
  const perStep = (performance.now() - started) / 900;
  // Все мифические события действительно срабатывают в стрессе.
  assert.ok(novaFired, "сверхновая должна сработать");
  assert.ok(singularitySpawned, "сингулярность должна появиться");
  assert.ok(voidActive, "пустота должна активироваться");
  assert.ok(salvo, "залп флота должен произойти");
  assert.ok(perStep < 10, `мс/шаг ${perStep.toFixed(2)}`);
  console.log(`    mythic stress: ${perStep.toFixed(2)} мс/шаг, убийств ${player.kills}, пул частиц ${particleDebugStats().pooled}`);
});
