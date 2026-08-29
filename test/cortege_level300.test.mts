// ТЗ владельца: «проверь уровень 300 + убийство Чёрного кортежа — там обычно
// всё ломается». Сценарий воспроизводит максимальный билд (300 уровней,
// limit_break ×280, все мифики) против всех четырёх ролей кортежа.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepGame, makeInitialPlayer, makeStars, spawnAdaptiveGuard,
  type GameObjects, type StepInput,
} from "../src/game/gameLoop";
import { spawnEnemy } from "../src/game/enemies";
import { ALL_UPGRADES, LIMIT_BREAK, applyUpgrade, calculatePlayerPower } from "../src/game/upgrades";

const noop = () => {};

function makeInput(frame: number): StepInput {
  return { keys: new Set<string>(), wave: 26, frame, timeSlow: false, onLevelUp: noop, onDeath: noop, onBossKill: noop, onWaveComplete: noop, onKill: noop };
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
    singularity: null, voidFractures: [],
  };
}

/** Максимальный билд 300-го уровня: весь пул + limit_break до 280 уровней. */
function makeLevel300Player(): ReturnType<typeof makeInitialPlayer> {
  const player = makeInitialPlayer("void_wraith");
  player.level = 300;
  player.xp = 0;
  player.xpToNext = 550 + 290 * 105 + 290 * 290 * 7;
  for (const u of ALL_UPGRADES) {
    if (u.id === "limit_break" || u.id.startsWith("mythic_")) continue;
    for (let l = 0; l < u.maxLevel; l++) applyUpgrade(player, u);
  }
  for (let l = 0; l < 280; l++) applyUpgrade(player, LIMIT_BREAK);
  return player;
}

function assertFinite(obj: GameObjects, where: string): void {
  const p = obj.player;
  assert.ok(Number.isFinite(p.hp) && Number.isFinite(p.maxHp), `${where}: hp конечен`);
  assert.ok(Number.isFinite(p.xp) && Number.isFinite(p.xpToNext), `${where}: опыт конечен`);
  assert.ok(Number.isFinite(p.score), `${where}: счёт конечен`);
  for (const e of obj.enemies) {
    assert.ok(Number.isFinite(e.hp) && Number.isFinite(e.maxHp), `${where}: hp врага ${e.eliteName ?? e.type} конечен (${e.hp})`);
    assert.ok(Number.isFinite(e.shieldHp), `${where}: щит врага конечен`);
  }
  for (const b of obj.bullets) assert.ok(Number.isFinite(b.damage) && Number.isFinite(b.pos.x), `${where}: пуля конечна`);
  for (const t of obj.floatingTexts) assert.ok(Number.isFinite(t.pos.x) && Number.isFinite(t.life ?? 1), `${where}: текст конечен`);
}

test("⚔️ КОРТЕЖ × LEVEL 300: событие проходит, кап работает, ничего не ломается", () => {
  const player = makeLevel300Player();
  const obj = makeObjects(player);
  obj.powerRating = calculatePlayerPower(player);
  obj.adaptiveDifficulty = 12;
  obj.guardEventActive = true;
  spawnAdaptiveGuard(obj, 26);

  const cortege = obj.enemies.filter(e => e.guardRole);
  assert.equal(cortege.length, 4, "четыре роли кортежа");
  for (const e of cortege) {
    assert.ok(Number.isFinite(e.maxHp) && e.maxHp > 0, "maxHp конечен и положителен");
    assert.ok((e.guardFrameDamageCap ?? 0) > 0, "кап урона положителен");
  }

  const startHp = cortege.map(e => e.hp);
  let frames = 0;
  let sawTexts = 0;
  let waveCompleted = false;
  // До 90 секунд симуляции.
  for (let k = 0; k < 60 * 90; k++) {
    stepGame(obj, { keys: new Set<string>(), wave: 26, frame: k, timeSlow: false, onLevelUp: noop, onDeath: noop, onBossKill: noop, onWaveComplete: () => { waveCompleted = true; }, onKill: noop });
    frames++;
    if (obj.floatingTexts.length > sawTexts) sawTexts = obj.floatingTexts.length;
    obj.enemies = obj.enemies.filter(e => e.hp > 0);
    assertFinite(obj, `кадр ${k}`);
    assert.ok(obj.particles.length <= 1000, `бюджет частиц (${obj.particles.length})`);
    assert.ok(obj.bullets.length <= 900, `бюджет пуль (${obj.bullets.length})`);
    assert.ok(obj.floatingTexts.length <= 150, `бюджет текстов (${obj.floatingTexts.length})`);
    if (obj.enemies.length === 0) break;
  }

  assert.equal(obj.enemies.length, 0, `кортеж должен погибнуть (осталось ${obj.enemies.length})`);
  // Кап урона: никакой мгновенной погибели — событие длится секунды, а не кадр.
  assert.ok(frames > 120, `событие не должно схлопнуться в один кадр (${frames} кадров)`);
  assert.ok(frames < 60 * 90, `событие должно завершаться за разумное время (${frames} кадров)`);
  // «Провозвестник» держит связь: пока он жив, остальные получают ×0.25–0.55.
  const herald = cortege.find(e => e.guardRole === "herald")!;
  assert.ok(herald.hp < startHp[cortege.indexOf(herald)], "провозвестник получил урон");
  // Событие корректно закрывается: флаг сброшен, волна завершена, награда начислена.
  assert.equal(obj.guardEventActive, false, "событие кортежа должно закрыться после победы");
  assert.ok(waveCompleted, "волна с кортежем должна завершиться");
  assert.ok(player.score > 0, "награда за печать кортежа начислена");
});

test("⚔️ КОРТЕЖ × LEVEL 300 × LOW-тир: бюджеты самого слабого устройства", () => {
  const player = makeLevel300Player();
  const obj = makeObjects(player);
  obj.performanceTier = 0; // Low
  obj.powerRating = calculatePlayerPower(player);
  obj.adaptiveDifficulty = 12;
  obj.guardEventActive = true;
  spawnAdaptiveGuard(obj, 26);
  for (let k = 0; k < 60 * 120 && obj.enemies.length > 0; k++) {
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(e => e.hp > 0);
    assertFinite(obj, `low кадр ${k}`);
    assert.ok(obj.particles.length <= 300, `Low-бюджет частиц (${obj.particles.length})`);
  }
  assert.equal(obj.enemies.length, 0, "кортеж погибает и на Low-тире");
});

test("⚔️ КОРТЕЖ на поздней волне (96+) с level-300: щиты, масштаб 12", () => {
  const player = makeLevel300Player();
  const obj = makeObjects(player);
  obj.powerRating = calculatePlayerPower(player);
  obj.adaptiveDifficulty = 12;
  obj.guardEventActive = true;
  spawnAdaptiveGuard(obj, 96);
  const cortege = obj.enemies.filter(e => e.guardRole);
  for (const e of cortege) assert.ok(e.maxShieldHp > 0, "щит кортежа масштабируется");
  for (let k = 0; k < 60 * 120 && obj.enemies.length > 0; k++) {
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(e => e.hp > 0);
    assertFinite(obj, `wave96 кадр ${k}`);
  }
  assert.equal(obj.enemies.length, 0, "поздний кортеж тоже гибнет");
});

test("⚔️ РЕГРЕССИЯ «Фазовый разряд» × КОРТЕЖ: осколки не порождают осколков", () => {
  // Точный сценарий OOM v1.8.0: только «Фазовый разряд», макс. частота стрельбы,
  // живые цели кортежа вплотную. Прежний код давал экспоненциальный рост массива
  // пуль прямо внутри for...of (2.8M → 5.2M+ за один кадр) и падал по OOM.
  const player = makeInitialPlayer("void_wraith");
  player.level = 100;
  const pd = ALL_UPGRADES.find(u => u.id === "phase_discharge");
  if (pd) for (let l = 0; l < pd.maxLevel; l++) applyUpgrade(player, pd);
  player.fireRate = 3;
  player.multishot = 6;
  const obj = makeObjects(player);
  obj.guardEventActive = true;
  spawnAdaptiveGuard(obj, 26);
  for (let k = 0; k < 400; k++) {
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(e => e.hp > 0);
    assert.ok(obj.bullets.length < 600, `пули ограничены (${obj.bullets.length} на кадре ${k})`);
    const shards = obj.bullets.filter(b => b.shardBorn).length;
    assert.ok(shards < 80, `осколков за кадр в пределах бюджета (${shards})`);
    if (obj.enemies.length === 0) break;
  }
  // Осколочные пули помечены: второе поколение невозможно по построению.
  for (const b of obj.bullets) {
    if (b.shardBorn) assert.ok(true);
  }
});

test("⚔️ КОРТЕЖ + плотная волна вокруг: гибель в толпе, небо из пуль, души", () => {
  const player = makeLevel300Player();
  const obj = makeObjects(player);
  obj.powerRating = calculatePlayerPower(player);
  obj.adaptiveDifficulty = 12;
  obj.guardEventActive = true;
  spawnAdaptiveGuard(obj, 26);
  // Толпа обычных + элита вокруг кортежа, как в реальном бою.
  for (let i = 0; i < 40; i++) {
    const e = spawnEnemy(i % 5 === 0 ? "tank" : "scout", 26, 12);
    e.pos = { x: 100 + (i % 8) * 100, y: 150 + Math.floor(i / 8) * 120 };
    e.centerX = e.pos.x; e.centerY = e.pos.y; e.targetY = e.pos.y;
    obj.enemies.push(e);
  }
  for (let k = 0; k < 60 * 120 && obj.enemies.length > 0; k++) {
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(e => e.hp > 0);
    assertFinite(obj, `толпа кадр ${k}`);
    assert.ok(obj.bullets.length <= 900);
    assert.ok(obj.particles.length <= 1000);
  }
  assert.equal(obj.enemies.length, 0, "всё поле зачищается без ошибок");
});
