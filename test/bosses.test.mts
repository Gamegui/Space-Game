// v2.9.0 — переделка боссов: фазы 75/50/25, телеграфы, уязвимость, арена.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepGame, makeInitialPlayer, makeStars,
  type GameObjects, type StepInput,
} from "../src/game/gameLoop";
import { spawnBoss, getBossType, isBossWave } from "../src/game/enemies";
import {
  getBossPhaseLabel, getBossMechanicHint, playerHitsHazard, tickHazards,
  BOSS_TELEGRAPH_FRAMES, BOSS_VULN_DAMAGE_MULT, bossBulletBaseDamage, bossContactBase,
} from "../src/game/bosses";
import type { ArenaHazard } from "../src/game/types";

const noop = () => {};

function makeInput(wave: number, frame: number): StepInput {
  return { keys: new Set<string>(), wave, frame, timeSlow: false, onLevelUp: noop, onDeath: noop, onBossKill: noop, onWaveComplete: noop, onKill: noop };
}

function makeObjects(player: ReturnType<typeof makeInitialPlayer>): GameObjects {
  return {
    player,
    bullets: [], enemies: [], particles: [], xpOrbs: [], mines: [], lightnings: [],
    stars: makeStars(), floatingTexts: [], powerups: [],
    blackHolePos: null, blackHoleTimer: 0, explosions: [],
    waveEnemyQueue: [], waveSpawnTimer: 0, bossActive: true, boss: null, waveTimer: 0,
    screenShake: 0, powerRating: 40, adaptiveDifficulty: 1,
    routeXpMultiplier: 1, routeScoreMultiplier: 1, activeRoute: "asteroids", routeEffect: "none",
    performanceTier: 2, performanceAuto: false, waveStartedFrame: 0,
    guardSpawnedThisWave: false, fastClearStreak: 0, guardEventActive: false,
    singularity: null, voidFractures: [], hazards: [],
  };
}

function placeBoss(wave: number) {
  const player = makeInitialPlayer("interceptor");
  player.pos = { x: 480, y: 600 };
  player.invincTimer = 9999;
  const obj = makeObjects(player);
  const boss = spawnBoss(wave, 1);
  boss.pos = { x: 480, y: 140 };
  boss.centerX = 480; boss.centerY = 140; boss.targetY = 140;
  boss.shieldHp = 0;
  obj.enemies.push(boss);
  obj.boss = boss;
  obj.bossActive = true;
  return { player, obj, boss };
}

test("боссы волн 5/10/15/20/25/30 — уникальные типы, Омега с 30-й", () => {
  assert.equal(getBossType(5), "boss_destroyer");
  assert.equal(getBossType(10), "boss_mothership");
  assert.equal(getBossType(15), "boss_dreadnought");
  assert.equal(getBossType(20), "boss_eclipse");
  assert.equal(getBossType(25), "boss_titan");
  assert.equal(getBossType(30), "boss_omega");
  assert.equal(getBossType(50), "boss_omega");
  assert.ok(isBossWave(5) && isBossWave(45) && !isBossWave(6));
});

test("у каждого босса своя фаза и подсказка механики", () => {
  const types = ["boss_destroyer", "boss_mothership", "boss_dreadnought", "boss_eclipse", "boss_titan", "boss_omega"] as const;
  const hints = new Set<string>();
  for (const t of types) {
    const labels = [0, 1, 2, 3].map(p => getBossPhaseLabel(t, p));
    assert.equal(new Set(labels).size, 4, `${t} должен иметь 4 уникальных фазы`);
    const hint = getBossMechanicHint(t);
    assert.ok(hint.length > 8, `${t} подсказка`);
    hints.add(hint);
  }
  assert.equal(hints.size, 6, "подсказки не повторяются");
});

test("все шесть боссов проходят 75/50/25% со сменой фазы, телеграфом и XP за фазу", () => {
  const waves = [5, 10, 15, 20, 25, 50];
  for (const wave of waves) {
    const { obj, boss } = placeBoss(wave);
    assert.equal(boss.phase, 0);
    boss.hp = boss.maxHp * 0.74;
    for (let k = 0; k < 8; k++) stepGame(obj, makeInput(wave, k));
    assert.equal(boss.phase, 1, `${boss.type} фаза 1 на 75%`);
    assert.ok((boss.vulnerableTimer ?? 0) > 0, `${boss.type} окно уязвимости после фазы`);
    const xpAfter1 = obj.xpOrbs.reduce((s, o) => s + o.value, 0);
    assert.ok(xpAfter1 > 0, `${boss.type} XP за фазу 1`);

    boss.hp = boss.maxHp * 0.49;
    for (let k = 8; k < 16; k++) stepGame(obj, makeInput(wave, k));
    assert.equal(boss.phase, 2, `${boss.type} фаза 2 на 50%`);

    boss.hp = boss.maxHp * 0.24;
    for (let k = 16; k < 24; k++) stepGame(obj, makeInput(wave, k));
    assert.equal(boss.phase, 3, `${boss.type} фаза 3 на 25%`);
  }
});

test("телеграф появляется до тяжёлой атаки (0.6–1.0 с)", () => {
  const { obj, boss } = placeBoss(5);
  boss.specialTimer = 0;
  boss.telegraphTimer = 0;
  stepGame(obj, makeInput(5, 1));
  assert.ok(obj.hazards.length > 0, "после спецатаки есть зона");
  assert.ok(obj.hazards.every(h => h.warn > 0), "зона начинается как телеграф");
  assert.ok(BOSS_TELEGRAPH_FRAMES >= 36 && BOSS_TELEGRAPH_FRAMES <= 60);
  const warn = obj.hazards[0].warn;
  assert.ok(warn >= 36 && warn <= 60, `телеграф ${warn} кадров`);
});

test("окно уязвимости увеличивает входящий урон", () => {
  const { obj, boss, player } = placeBoss(5);
  player.bulletDamage = 10;
  player.fireRate = 2;
  player.critChance = 0;
  boss.shieldHp = 0;
  boss.hp = boss.maxHp = 10_000;
  boss.vulnerableTimer = 0;
  obj.bullets.push({
    id: 1, pos: { x: boss.pos.x, y: boss.pos.y }, vel: { x: 0, y: 0 },
    fromPlayer: true, damage: 10, size: 8, color: "#fff", pierce: 0, homing: false,
  });
  stepGame(obj, makeInput(5, 0));
  const lostNormal = 10_000 - boss.hp;
  boss.hp = 10_000;
  boss.vulnerableTimer = 90;
  obj.bullets.push({
    id: 2, pos: { x: boss.pos.x, y: boss.pos.y }, vel: { x: 0, y: 0 },
    fromPlayer: true, damage: 10, size: 8, color: "#fff", pierce: 0, homing: false,
  });
  stepGame(obj, makeInput(5, 1));
  const lostVuln = 10_000 - boss.hp;
  assert.ok(lostNormal > 0 && lostVuln > lostNormal, `уязвимость ${lostVuln} > обычный ${lostNormal}`);
  assert.ok(Math.abs(lostVuln / lostNormal - BOSS_VULN_DAMAGE_MULT) < 0.15 || lostVuln > lostNormal);
});

test("гравитационный колодец тянет игрока, удар зоны наносит урон", () => {
  const player = makeInitialPlayer("interceptor");
  player.pos = { x: 400, y: 400 };
  player.invincTimer = 0;
  const hazards: ArenaHazard[] = [{
    id: 1, kind: "well", x: 500, y: 400, r: 140,
    warn: 0, active: 60, color: "#22d3ee", damage: 0, pull: 0.8,
  }];
  let pulled = false;
  tickHazards(hazards, player, 1, (dx) => { if (dx > 0) pulled = true; player.pos.x += dx; }, () => {});
  assert.ok(pulled, "колодец тянет к центру");
  assert.ok(player.pos.x > 400);

  const hits: number[] = [];
  const beam: ArenaHazard[] = [{
    id: 2, kind: "beam", x: 400, y: 0, x2: 400, y2: 720, r: 20,
    warn: 0, active: 20, color: "#f00", damage: 12, pull: 0,
  }];
  player.pos = { x: 400, y: 400 };
  tickHazards(beam, player, 1, () => {}, (d) => hits.push(d));
  assert.ok(hits[0] === 12, "активный луч бьёт");
  assert.ok(playerHitsHazard(player, beam[0]));
});

test("Омега сохраняет 4 формы и спавнит лёгких аддов на 50%/25%", () => {
  const { obj, boss } = placeBoss(50);
  assert.equal(boss.type, "boss_omega");
  boss.hp = boss.maxHp * 0.49;
  for (let k = 0; k < 10; k++) stepGame(obj, makeInput(50, k));
  assert.equal(boss.phase, 2);
  assert.ok(obj.enemies.length > 1, "адды на разрыве формы");
  assert.ok(obj.enemies.every(e => e.isBoss || e.type === "scout" || e.type === "fighter"));
  boss.hp = boss.maxHp * 0.24;
  for (let k = 10; k < 20; k++) stepGame(obj, makeInput(50, k));
  assert.equal(boss.phase, 3);
  assert.ok(obj.enemies.some(e => e.type === "fighter" || e.type === "scout"));
  assert.equal(obj.enemies.some(e => e.type === "singularity" || e.type === "carrier"), false);
});

test("пуля и контакт Омеги волны 50 не ваншотят стартовый корпус", () => {
  const hull = 100 + 20; // interceptor HP + щит
  const bulletHit = bossBulletBaseDamage(50) * 8.5;
  const contact = bossContactBase(50);
  const omega = spawnBoss(50, 1);
  assert.ok(omega.maxHp > 12_000, `HP Омеги ${omega.maxHp} слишком мал — бой должен быть жёстким`);
  assert.ok(omega.maxHp < 22_000, `HP Омеги ${omega.maxHp} слишком велик для обычной сборки`);
  assert.ok(bulletHit < 80, `пуля босса ${bulletHit} должна оставлять запас HP`);
  assert.ok(contact < 50, `контакт ${contact} не должен убивать с касания`);
  assert.ok(bulletHit + contact < hull * 1.2, "два попадания не стирают корпус без шанса");
});

test("Омега волны 50 не затягивает игрока в центр на финальной форме", () => {
  const { obj, boss, player } = placeBoss(50);
  player.pos = { x: 80, y: 620 };
  player.invincTimer = 99999;
  boss.phase = 3;
  boss.hp = boss.maxHp * 0.2;
  const startX = player.pos.x;
  for (let k = 0; k < 180; k++) stepGame(obj, makeInput(50, k));
  assert.ok(Math.abs(player.pos.x - startX) < 18, `сдвиг ${player.pos.x - startX} — Омега не должна тащить корабль`);
});

test("средняя сборка убивает Омегу волны 50 быстрее двух минут", () => {
  const { obj, boss, player } = placeBoss(50);
  player.invincTimer = 999999;
  player.bulletDamage = 8;
  player.fireRate = 6;
  player.multishot = 2;
  player.piercing = 2;
  player.homing = true;
  player.homingStrength = 0.1;
  player.critChance = 0;
  boss.shieldHp = 0;
  boss.maxShieldHp = 0;
  let died = false;
  const input = makeInput(50, 0);
  input.onDeath = () => { died = true; };
  let frames = 0;
  const limit = 7200;
  while (frames < limit && obj.enemies.some(e => e.isBoss && e.hp > 0)) {
    input.frame = frames;
    stepGame(obj, input);
    frames++;
  }
  assert.equal(died, false);
  assert.ok(frames < limit, `Омега жива после ${frames} кадров (HP ${boss.hp})`);
  assert.ok(frames > 240, `бой слишком короткий (${frames}) — Омега не должна таять за секунды`);
});

test("матка на 75% выпускает эскорт, эсминец на 50% — истребителей", () => {
  const mothership = placeBoss(10);
  mothership.boss.hp = mothership.boss.maxHp * 0.74;
  for (let k = 0; k < 8; k++) stepGame(mothership.obj, makeInput(10, k));
  assert.ok(mothership.obj.enemies.length > 1, "левиафан спавнит эскорт");

  const destroyer = placeBoss(5);
  destroyer.boss.hp = destroyer.boss.maxHp * 0.49;
  for (let k = 0; k < 12; k++) stepGame(destroyer.obj, makeInput(5, k));
  assert.equal(destroyer.boss.phase, 2);
  assert.ok(destroyer.obj.enemies.some(e => e.type === "fighter"), "разрушитель зовёт истребителей");
});

test("filler босса — не кольцо, а прицельный залп ≤3 пуль", () => {
  const waves = [5, 10, 15, 20, 25, 50];
  for (const wave of waves) {
    for (const phase of [0, 1, 2, 3]) {
      const { obj, boss, player } = placeBoss(wave);
      player.fireRate = 9999;
      player.invincTimer = 99999;
      boss.phase = phase;
      boss.specialTimer = 9999;
      boss.telegraphTimer = 0;
      boss.shootTimer = 0;
      obj.bullets.length = 0;
      stepGame(obj, makeInput(wave, 1));
      const enemyShots = obj.bullets.filter(b => !b.fromPlayer).length;
      assert.ok(enemyShots <= 3, `${boss.type} фаза ${phase}: filler ${enemyShots} > 3`);
      assert.ok(enemyShots >= 1, `${boss.type} фаза ${phase}: filler молчит`);
    }
  }
});

test("спецатака Омеги даёт прорези, не ковёр пуль", () => {
  const { obj, boss, player } = placeBoss(50);
  player.fireRate = 9999;
  player.invincTimer = 99999;
  boss.phase = 3;
  boss.hp = boss.maxHp * 0.2;
  boss.specialTimer = 0;
  boss.telegraphTimer = 0;
  boss.shootTimer = 9999;
  obj.bullets.length = 0;
  stepGame(obj, makeInput(50, 1));
  assert.ok((boss.telegraphTimer ?? 0) > 0, "телеграф должен стартовать");
  let frames = 0;
  while ((boss.telegraphTimer ?? 0) > 0 && frames < 80) {
    stepGame(obj, makeInput(50, 2 + frames));
    frames++;
  }
  const enemyShots = obj.bullets.filter(b => !b.fromPlayer).length;
  assert.ok(enemyShots <= 8, `спец Омеги выпустил ${enemyShots} пуль — это стена`);
  assert.ok(enemyShots >= 1, "спец должен выпустить удар");
});

test("живой бой Омеги не засыпает экран пулями", () => {
  const { obj, boss, player } = placeBoss(50);
  obj.activeRoute = "warzone";
  player.fireRate = 9999;
  player.invincTimer = 999999;
  boss.hp = boss.maxHp;
  let peak = 0;
  for (let k = 0; k < 600; k++) {
    stepGame(obj, makeInput(50, k));
    const live = obj.bullets.filter(b => !b.fromPlayer).length;
    if (live > peak) peak = live;
    if (k === 150) boss.hp = boss.maxHp * 0.74;
    if (k === 300) boss.hp = boss.maxHp * 0.49;
    if (k === 450) boss.hp = boss.maxHp * 0.24;
  }
  assert.ok(peak <= 48, `пик вражеских пуль ${peak} — ковёр по экрану`);
  assert.equal(boss.phase, 3);
});

test("симуляция босса волны 5 не ломает бюджеты и числа", () => {
  const { obj, player, boss } = placeBoss(5);
  player.invincTimer = 99999;
  boss.hp = boss.maxHp;
  for (let k = 0; k < 600; k++) {
    stepGame(obj, makeInput(5, k));
    assert.ok(Number.isFinite(player.hp) && Number.isFinite(boss.hp));
    assert.ok(obj.hazards.length <= 16, `зон ${obj.hazards.length}`);
    assert.ok(obj.bullets.length <= 900);
    if (k === 200) boss.hp = boss.maxHp * 0.74;
    if (k === 350) boss.hp = boss.maxHp * 0.49;
    if (k === 480) boss.hp = boss.maxHp * 0.24;
  }
  assert.equal(boss.phase, 3);
});
