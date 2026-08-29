// v1.8.3: ЭСКАЛАЦИЯ БЕЗДНЫ — после 60-й волны даже level-300 не косит врагов
// в один выстрел; слабые билды почти ничего не замечают (требование 2.8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { getAdaptiveDifficulty } from "../src/game/upgrades";
import { makeInitialPlayer, enemyDamageFactor, spawnAdaptiveGuard, makeStars, stepGame, type GameObjects, type StepInput } from "../src/game/gameLoop";
import { ALL_UPGRADES, LIMIT_BREAK, applyUpgrade } from "../src/game/upgrades";

const noop = () => {};

/** Макс-билд: весь пул + limit_break ×280 (как в тесте кортежа). */
function maxBuild(): ReturnType<typeof makeInitialPlayer> {
  const player = makeInitialPlayer("void_wraith");
  player.level = 300;
  for (const u of ALL_UPGRADES) {
    if (u.id === "limit_break" || u.id.startsWith("mythic_")) continue;
    for (let l = 0; l < u.maxLevel; l++) applyUpgrade(player, u);
  }
  for (let l = 0; l < 280; l++) applyUpgrade(player, LIMIT_BREAK);
  return player;
}

function midBuild(): ReturnType<typeof makeInitialPlayer> {
  const player = makeInitialPlayer("interceptor");
  player.level = 25;
  return player;
}

test("до 60-й волны эскалации нет: шкала зажата прежним капом 12", () => {
  const strong = getAdaptiveDifficulty(maxBuild(), 55);
  assert.ok(strong.scale <= 12, `wave 55: scale ${strong.scale} ≤ 12`);
  const weak = getAdaptiveDifficulty(midBuild(), 55);
  assert.ok(weak.scale <= 12, `wave 55 слабый: scale ${weak.scale} ≤ 12`);
});

test("⚔ после 60-й: макс-билд получает экспоненциальное давление", () => {
  // Базовая адаптивная шкала макс-билда на 61+ всего ~6-9 (expectedPower догоняет),
  // поэтому эскалация ×1.32/волну разгоняет её до сотен и тысяч:
  // волна 70 ≈ 93 (танк ~2.4k hp), 75 ≈ 352 (9k), 80 ≈ 1338 (35k), 90+ = кап 6000 (156k).
  const w61 = getAdaptiveDifficulty(maxBuild(), 61).scale;
  const w70 = getAdaptiveDifficulty(maxBuild(), 70).scale;
  const w80 = getAdaptiveDifficulty(maxBuild(), 80).scale;
  const w90 = getAdaptiveDifficulty(maxBuild(), 90).scale;
  assert.ok(w61 > 8, `волна 61: заметный первый шаг (${w61.toFixed(1)})`);
  assert.ok(w70 > 60, `волна 70: ${w70.toFixed(0)}`);
  assert.ok(w80 > 1000, `волна 80: ${w80.toFixed(0)}`);
  assert.ok(w90 > 3000, `волна 90: ${w90.toFixed(0)}`);
  assert.ok(w90 <= 6000, `кап шкалы (${w90.toFixed(0)} ≤ 6000)`);
  assert.ok(w70 > w61 && w80 > w70 && w90 > w80, "монотонный рост");
});

test("⚔ слабый билд эскалацию почти не чувствует (гейт по силе)", () => {
  const weakW75 = getAdaptiveDifficulty(midBuild(), 75).scale;
  const strongW75 = getAdaptiveDifficulty(maxBuild(), 75).scale;
  assert.ok(weakW75 < 40, `слабый билд на 75: ${weakW75.toFixed(1)} < 40`);
  assert.ok(strongW75 > 200, `макс-билд на 75: ${strongW75.toFixed(0)} > 200`);
  assert.ok(strongW75 > weakW75 * 5, "давление пропорционально силе билда");
});

test("enemyDamageFactor: волны 1–60 без изменений, дальше мягкий лог-рост", () => {
  // Прежняя формула: 1 + (scale-1)*0.35 — точное совпадение до 12.
  for (const s of [1, 4, 8, 12]) {
    const expected = 1 + (s - 1) * 0.35;
    assert.ok(Math.abs(enemyDamageFactor(s) - expected) < 1e-9, `scale ${s}: без регрессии`);
  }
  // Рост есть, но мягкий: шкала 2800 даёт ~×8.8, а не сотни.
  const f2800 = enemyDamageFactor(2800);
  assert.ok(f2800 > 8 && f2800 < 12, `2800 → ${f2800.toFixed(2)}`);
  assert.ok(enemyDamageFactor(6000) > f2800, "монотонность");
  // Пуля босса на волне 85 при шкале 2800: ~19 × 8.8 ≈ 167 урона — опасно,
  // но не мгновенная смерть при 500+ HP макс-билда.
  const bossBullet = (2.5 + 85 * 0.22) * f2800;
  assert.ok(bossBullet < 300, `урон пули босса ${bossBullet.toFixed(0)} < 300`);
});

test("интеграция: кортеж на волне 90 на порядок жирнее кортежа на 26-й", () => {
  const mk = (wave: number): { hp: number; obj: GameObjects } => {
    const player = maxBuild();
    const obj: GameObjects = {
      player, bullets: [], enemies: [], particles: [], xpOrbs: [], mines: [], lightnings: [],
      stars: makeStars(), floatingTexts: [], powerups: [],
      blackHolePos: null, blackHoleTimer: 0, explosions: [],
      waveEnemyQueue: [], waveSpawnTimer: 0, bossActive: false, boss: null, waveTimer: 0,
      screenShake: 0, powerRating: 1200, adaptiveDifficulty: getAdaptiveDifficulty(player, wave).scale,
      routeXpMultiplier: 1, routeScoreMultiplier: 1, activeRoute: "warzone", routeEffect: "none",
      performanceTier: 2, performanceAuto: false, waveStartedFrame: 0,
      guardSpawnedThisWave: false, fastClearStreak: 0, guardEventActive: true,
      singularity: null, voidFractures: [],
    };
    spawnAdaptiveGuard(obj, wave);
    const total = obj.enemies.reduce((a, e) => a + e.maxHp, 0);
    return { hp: total, obj };
  };
  const early = mk(26);
  const late = mk(90);
  assert.ok(late.hp > early.hp * 100, `поздний кортеж ×${(late.hp / early.hp).toFixed(0)} жирнее`);
  // И симуляция не ломается: пара шагов с поздним кортежем — все числа конечны.
  const input: StepInput = { keys: new Set<string>(), wave: 90, frame: 1, timeSlow: false, onLevelUp: noop, onDeath: noop, onBossKill: noop, onWaveComplete: noop, onKill: noop };
  for (let k = 0; k < 60; k++) {
    stepGame(late.obj, input);
    late.obj.enemies = late.obj.enemies.filter(e => e.hp > 0);
    assert.ok(Number.isFinite(late.obj.player.hp), "hp игрока конечен");
    if (late.obj.enemies.length === 0) break;
  }
});
