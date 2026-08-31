// ТЗ v1.8.0 «Усиление мификов + оптимизация»: проверки новых поведений.
// Дроп-логика мификов не изменилась (покрыта mythics.test.mts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepGame, makeInitialPlayer, makeStars,
  overdriveCritBonus, grantMythicXp, triggerJudgement,
  type GameObjects, type StepInput,
} from "../src/game/gameLoop";
import { spawnEnemy } from "../src/game/enemies";
import { ALL_UPGRADES, applyUpgrade } from "../src/game/upgrades";

const noop = () => {};

function makeInput(frame: number): StepInput {
  return { keys: new Set<string>(), wave: 10, frame, timeSlow: false, onLevelUp: noop, onDeath: noop, onBossKill: noop, onWaveComplete: noop, onKill: noop };
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
    singularity: null, voidFractures: [], hazards: [],
  };
}

function give(player: ReturnType<typeof makeInitialPlayer>, id: string) {
  applyUpgrade(player, ALL_UPGRADES.find(u => u.id === id)!);
}

function place(e: ReturnType<typeof spawnEnemy>, x: number, y: number, hp?: number) {
  e.pos = { x, y };
  // Патрульные типы (tank) держат внутренние цели — фиксируем, чтобы не уплывали.
  e.centerX = x;
  e.centerY = y;
  e.targetY = y;
  e.vel.x = 0;
  if (hp !== undefined) e.hp = e.maxHp = hp;
  return e;
}

test("🔥 OVERDRIVE-крит: бонус только в активном окне перегрузки", () => {
  const player = makeInitialPlayer("interceptor");
  assert.deepEqual(overdriveCritBonus(player), { chance: 0, multiplier: 0 }, "вне перегрузки бонуса нет");
  player.overdriveTimer = 300;
  const bonus = overdriveCritBonus(player);
  assert.ok(Math.abs(bonus.chance - 0.10) < 1e-9, "шанс +10% в окне");
  assert.ok(Math.abs(bonus.multiplier - 0.25) < 1e-9, "множитель +0.25 в окне");
  player.overdriveTimer = 0;
  assert.equal(overdriveCritBonus(player).chance, 0, "после окна бонус исчезает без отката");
});

test("☀️ Сверхновая: после взрыва 3 c разгона орудия (rapidBoostTimer)", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 20;
  give(player, "mythic_nova");
  const obj = makeObjects(player);
  player.novaCore = 100;
  player.novaFuseTimer = 1;
  // Жертва выживает (элита с большим HP): иначе её смерть в том же шаге
  // снова зарядила бы ядро на +1 — и это корректное поведение.
  const victim = place(spawnEnemy("tank", 1), player.pos.x, player.pos.y - 80, 1_000_000);
  victim.isElite = true;
  obj.enemies.push(victim);
  stepGame(obj, makeInput(1)); // фитиль сгорает → взрыв
  assert.equal(player.novaCore, 0, "ядро сброшено взрывом");
  assert.ok(victim.hp < 1_000_000, "элита получила урон взрыва");
  assert.equal(player.rapidBoostTimer, 180, "после взрыва — 3 c (180 кадров) разгона");
  // Разгон убывает со временем тем же механизмом, что и бонус-пикап.
  for (let k = 2; k <= 181; k++) stepGame(obj, makeInput(k));
  assert.equal(player.rapidBoostTimer, 0, "разгон временный и заканчивается сам");
});

test("⚡ Судный Разряд: эскалация +8% за убийство, потолок ×1.8, цепь бьёт без повторов", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 20;
  give(player, "mythic_judgement");
  const obj = makeObjects(player);
  // Источник (цель крета) + цепь из двух целей; третья — толстая, по ней видно
  // точный эскалированный урон: 150 → убийство → 150*1.08 = 162.
  const source = place(spawnEnemy("scout", 1), 480, 300, 100);   // умрёт первым? нет:
  // source сам не получает урон (он в struck), цепь идёт по ближайшим.
  const first = place(spawnEnemy("scout", 1), 500, 300, 150);    // 150 урона — впритык убивает
  const second = place(spawnEnemy("scout", 1), 520, 300, 1000);  // получает 150*1.08
  obj.enemies.push(source, first, second);
  triggerJudgement(obj, source, 100);
  assert.ok(first.hp <= 0, `первая цель убита (hp=${first.hp})`);
  assert.ok(Math.abs(second.hp - 838) < 0.5, `вторая цель получила 162 урона (hp=${second.hp})`);
  assert.equal(obj.lightnings.length, 2, "по числу прыжков");
  assert.equal(obj.lightnings[0].life, 18, "молнии живут 18 тиков (заметнее)");
});

test("🌌 grantMythicXp: опыт мификов проходит тот же цикл уровней, что и сферы", () => {
  const player = makeInitialPlayer("interceptor");
  const obj = makeObjects(player);
  let levelUps = 0;
  grantMythicXp(obj, { onLevelUp: () => { levelUps++; } }, 35); // xpToNext = 30
  assert.equal(player.level, 2);
  assert.equal(player.xp, 5);
  assert.equal(levelUps, 1);
  grantMythicXp(obj, { onLevelUp: () => { levelUps++; } }, 10);
  assert.equal(player.level, 2, "мало опыта — без уровня");
  assert.equal(levelUps, 1);
});

test("👁 Конец Материи: снаряды получают наведение только во время Пустоты", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 20;
  give(player, "mythic_void");
  const obj = makeObjects(player);
  // Базовый кейс: без Пустоты наведения нет (homing в билде отсутствует).
  stepGame(obj, makeInput(10)); // кадр кратен темпу стрельбы — выстрел
  assert.ok(obj.bullets.length > 0, "выстрел произошёл");
  assert.ok(obj.bullets.every(b => !b.homing), "вне Пустоты снаряды не наводятся");
  // Активируем Пустоту и повторяем.
  player.entropy = 100;
  player.voidTimer = 0;
  stepGame(obj, makeInput(11));
  assert.ok(player.voidTimer > 0, "Пустота активировалась");
  obj.bullets.length = 0;
  stepGame(obj, makeInput(20));
  assert.ok(obj.bullets.length > 0, "выстрел во время Пустоты");
  assert.ok(obj.bullets.every(b => b.homing), "в Пустоте снаряды наводятся");
});

test("🛰 FINAL FLEET SALVO: главный калибр усилен на +15% в залпе", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 20;
  const obj = makeObjects(player);
  stepGame(obj, makeInput(10));
  assert.ok(obj.bullets.length > 0);
  const baseDamage = obj.bullets[0].damage; // без душ = bulletDamage
  obj.bullets.length = 0;
  player.fleetSalvoTimer = 60; // залп активен
  stepGame(obj, makeInput(20));
  assert.ok(obj.bullets.length > 0);
  const expected = player.bulletDamage * 1.15;
  for (const b of obj.bullets) {
    assert.ok(Math.abs(b.damage - expected) < 1e-6, `урон в залпе ${b.damage} = ${expected}`);
  }
  assert.ok(Math.abs(baseDamage - player.bulletDamage) < 1e-6, "вне залпа урон обычный");
});

test("стресс: все новые эффекты вместе — 600 шагов без NaN и с лимитами", () => {
  const player = makeInitialPlayer("void_wraith");
  player.level = 40;
  give(player, "mythic_nova");
  give(player, "mythic_singularity");
  give(player, "mythic_judgement");
  give(player, "mythic_overdrive");
  give(player, "mythic_fleet");
  give(player, "mythic_void");
  player.critChance = 0.4;
  player.bulletDamage = 40;
  const obj = makeObjects(player);
  for (let k = 0; k < 600; k++) {
    if (k % 40 === 0) {
      const e = place(spawnEnemy("tank", 10), 200 + (k % 7) * 80, 250, 4000);
      e.isElite = true;
      obj.enemies.push(e);
    }
    player.novaFuseTimer = (player.novaCore >= 100) ? 1 : player.novaFuseTimer;
    player.fleetSalvoTimer = k % 200 === 0 ? 90 : player.fleetSalvoTimer;
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(x => x.hp > 0);
    assert.ok(Number.isFinite(player.hp) && Number.isFinite(player.xp), "числа конечны");
    assert.ok(obj.bullets.length <= 900, `пули в разумных пределах (${obj.bullets.length})`);
    assert.ok(obj.particles.length <= 1000, `частицы в бюджете (${obj.particles.length})`);
  }
});
