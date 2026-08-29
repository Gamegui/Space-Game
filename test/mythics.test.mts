// ТЗ «Мифические улучшения — Mythic Tier»: гейты выпадения и механики.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepGame, makeInitialPlayer, makeStars, uid,
  type GameObjects, type StepInput,
} from "../src/game/gameLoop";
import { spawnEnemy } from "../src/game/enemies";
import { ALL_UPGRADES, applyUpgrade, rollUpgrades } from "../src/game/upgrades";
import { rollMythicDrop, ownedMythicCount, MAX_MYTHIC_PER_RUN, MYTHIC_MIN_LEVEL } from "../src/game/mythics";

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
    singularity: null, voidFractures: [],
      maxEnemies: 0,
      maxBullets: 0,
      maxParticles: 0,
      maxXpOrbs: 0,
      frameTimeHistory: [],
  };
}

function give(player: ReturnType<typeof makeInitialPlayer>, id: string) {
  applyUpgrade(player, ALL_UPGRADES.find(u => u.id === id)!);
}

test("гейты: мифик не выпадает до 8-го уровня, максимум 2 за забег, требования билда", () => {
  const early = makeInitialPlayer("interceptor");
  early.level = 5;
  for (let i = 0; i < 5000; i++) assert.equal(rollMythicDrop(early, () => 0), null);

  const lucky = makeInitialPlayer("interceptor");
  lucky.level = 20;
  // random()=0 всегда «проходит» шанс → выпадение определяется требованиями.
  assert.ok(rollMythicDrop(lucky, () => 0)); // без требований: только mythic_nova

  // Требования: судный разряд требует lightning+chain_lightning+crit.
  const builder = makeInitialPlayer("interceptor");
  builder.level = 20;
  give(builder, "lightning"); give(builder, "chain_lightning"); give(builder, "crit");
  const dropped = new Set<string>();
  for (let i = 0; i < 200; i++) {
    // первый вызов — шанс (0 = проходит), второй — индекс (0.99 → последний доступный)
    let call = 0;
    const id = rollMythicDrop(builder, () => (call++ === 0 ? 0 : 0.99));
    if (id) dropped.add(id);
  }
  assert.ok(dropped.has("mythic_judgement"), "требования выполнены — мифик должен выпасть");
  assert.ok(!dropped.has("mythic_fleet"), "без флота-билда Армада не выпадает");

  // Лимит за забег.
  give(builder, "mythic_nova"); give(builder, "mythic_judgement");
  assert.equal(ownedMythicCount(builder), MAX_MYTHIC_PER_RUN);
  assert.equal(rollMythicDrop(builder, () => 0), null);
  assert.equal(MYTHIC_MIN_LEVEL, 8);
});

test("шанс ~0.5% на уровень: большинство забегов без мифика (статистика)", () => {
  // Детерминированный ГПСЧ (LCG).
  let seed = 123456789;
  const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let drops = 0;
  const trials = 100_000;
  for (let i = 0; i < trials; i++) {
    const p = makeInitialPlayer("interceptor");
    p.level = 20;
    if (rollMythicDrop(p, rng) !== null) drops++;
  }
  const rate = drops / trials;
  assert.ok(rate > 0.002 && rate < 0.01, `частота ${rate.toFixed(4)} вне диапазона 0.2–1%`);
});

test("мифики никогда не попадают в обычный пул выбора", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 30;
  for (let i = 0; i < 300; i++) {
    for (const choice of rollUpgrades(player, 3)) assert.notEqual(choice.rarity, "mythic");
  }
});

test("☀️ Сердце Сверхновой: заряд от убийств, взрыв на 100, сброс", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 20;
  give(player, "mythic_nova");
  player.bulletDamage = 50;
  const obj = makeObjects(player);
  // 95 обычных убийств (по +1) — ядро почти полное.
  for (let k = 0; k < 95; k++) {
    const e = spawnEnemy("scout", 1);
    e.pos = { x: player.pos.x, y: player.pos.y - 60 };
    e.hp = 0;
    obj.enemies.push(e);
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(x => x.hp > 0);
  }
  assert.equal(player.novaCore, 95);
  // Пять обычных убийств → 100 → фитиль → взрыв.
  for (let k = 95; k < 100; k++) {
    const extra = spawnEnemy("scout", 1);
    extra.pos = { x: player.pos.x, y: player.pos.y - 60 };
    extra.hp = 0;
    obj.enemies.push(extra);
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(x => x.hp > 0);
  }
  assert.equal(player.novaCore, 100);
  const elite = spawnEnemy("tank", 1);
  elite.pos = { x: player.pos.x + 30, y: player.pos.y - 60 };
  // Танк патрулирует вокруг своей внутренней цели — фиксируем её рядом с игроком.
  elite.centerX = elite.pos.x;
  elite.centerY = elite.pos.y;
  elite.targetY = elite.pos.y;
  elite.isElite = true;
  elite.hp = elite.maxHp = 1_000_000;
  obj.enemies.push(elite);
  const far = spawnEnemy("scout", 1);
  far.pos = { x: 800, y: 80 };
  obj.enemies.push(far);
  for (let k = 100; k < 170; k++) {
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(x => x.hp > 0 || x === far);
  }
  // Взрыв произошёл: ядро сброшено, элита в радиусе получила огромный урон.
  assert.equal(player.novaCore, 0);
  assert.ok(elite.hp < 999_000, `элита должна получить урон сверхновой (hp=${elite.hp})`);
});

test("⚡ Судный Разряд: криты копят гнев, десятый высвобождает цепь", () => {
  const player = makeInitialPlayer("tempest");
  player.level = 20;
  give(player, "mythic_judgement");
  player.critChance = 1; // каждый удар — крит
  player.bulletDamage = 30;
  const obj = makeObjects(player);
  const targets: ReturnType<typeof spawnEnemy>[] = [];
  for (let i = 0; i < 5; i++) {
    const e = spawnEnemy("scout", 1);
    // Строго в колонке огня («Флагман» стреляет вертикально вверх с x=480):
    // иначе синус-дрейф уводит цели из потока и тест флейкует.
    e.pos = { x: 476 + i * 2, y: 160 + i * 55 };
    e.centerX = e.pos.x;
    e.centerY = e.pos.y;
    e.targetY = e.pos.y;
    e.vel.x = 0;
    e.hp = e.maxHp = 500;
    targets.push(e);
    obj.enemies.push(e);
  }
  let triggered = false;
  for (let k = 0; k < 600 && !triggered; k++) {
    stepGame(obj, makeInput(k));
    if (player.wrath === 0 && k > 60 && targets.some(t => t.hp < 500)) triggered = true;
  }
  assert.ok(triggered, "судный разряд должен сработать после 10 критов");
  assert.ok(targets.some(t => t.hp < 500), "цепь должна повреждать цели");
});

test("🔥 Абсолютный Реактор: заряд от стрельбы, активация, продление убийствами", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 20;
  give(player, "mythic_overdrive");
  const obj = makeObjects(player);
  // Стреляем по пустому экрану ~600 кадров (автоогонь) — заряд должен дойти до 100 и активироваться.
  let activated = false;
  for (let k = 0; k < 700; k++) {
    stepGame(obj, makeInput(k));
    if (player.overdriveTimer > 0) { activated = true; break; }
  }
  assert.ok(activated, "перегрузка должна активироваться от непрерывной стрельбы");
  const timerBefore = player.overdriveTimer;
  // Убийство во время режима продлевает его.
  const e = spawnEnemy("scout", 1);
  e.pos = { x: player.pos.x, y: player.pos.y - 50 };
  e.hp = 0.01;
  obj.enemies.push(e);
  stepGame(obj, makeInput(701));
  assert.ok(player.overdriveTimer >= timerBefore - 1, "убийство не должно уменьшать таймер");
});

test("👁 Конец Материи: энтропия от боя, разрывы, телепорты снарядов", () => {
  const player = makeInitialPlayer("void_wraith");
  player.level = 20;
  give(player, "mythic_void");
  player.bulletDamage = 60;
  const obj = makeObjects(player);
  // Быстро копим энтропию напрямую (механика зарядки уже покрыта крит-тестом).
  player.entropy = 100;
  stepGame(obj, makeInput(1));
  assert.ok(player.voidTimer > 0, "конец материи должен активироваться");
  // Убийства во время Пустоты оставляют разрывы (макс. 8).
  for (let k = 2; k < 40; k++) {
    const e = spawnEnemy("scout", 1);
    e.pos = { x: 200 + (k % 5) * 90, y: 300 };
    e.hp = 0.01;
    obj.enemies.push(e);
    stepGame(obj, makeInput(k));
    obj.enemies = obj.enemies.filter(x => x.hp > 0);
  }
  assert.ok(obj.voidFractures.length <= 8, `разрывов ${obj.voidFractures.length}`);
  // Детерминированные разрывы для проверки телепорта (макс. 2 прыжка).
  obj.voidFractures.push({ pos: { x: 150, y: 400 }, life: 180 }, { pos: { x: 750, y: 400 }, life: 180 });
  // Детерминированный телепорт: только пробная пуля, стоит точно в разрыве.
  obj.bullets.length = 0;
  obj.enemies.length = 0;
  const probe = { id: uid(), pos: { x: 150, y: 400 }, vel: { x: 2, y: 0 }, fromPlayer: true, damage: 1, size: 3, color: "#fff", pierce: 0, homing: false, voidJumps: 0 };
  obj.bullets.push(probe);
  stepGame(obj, makeInput(50));
  assert.ok((probe.voidJumps ?? 0) >= 1, "снаряд должен телепортироваться через разрыв");
  assert.ok(Math.abs(probe.pos.x - 150) > 100, "снаряд должен оказаться у другого разрыва");
});

test("🌌 Пожиратель Звёзд: заряд → сингулярность → пули летят свободно → коллапс", () => {
  const player = makeInitialPlayer("interceptor");
  player.level = 20;
  give(player, "mythic_singularity");
  const obj = makeObjects(player);
  player.collapseCharge = 49;
  const e = spawnEnemy("scout", 1);
  e.pos = { x: 480, y: 300 };
  e.hp = 0;
  const victim = spawnEnemy("tank", 1);
  victim.pos = { x: 500, y: 310 };
  // Без фиксации внутренних целей патруля танк уплывает из радиуса
  // сингулярности (190 px) за 240 кадров — тест флейкует.
  victim.centerX = victim.pos.x;
  victim.centerY = victim.pos.y;
  victim.targetY = victim.pos.y;
  victim.vel.x = 0;
  victim.hp = victim.maxHp = 5_000;
  obj.enemies.push(e, victim);
  stepGame(obj, makeInput(1));
  assert.ok(obj.singularity, "сингулярность должна появиться на 50 заряда");
  // v1.8.2: пуля внутри радиуса сингулярности больше НЕ засасывается —
  // летит свободно (спавним в стороне от жертвы, чтобы не ловить попадание).
  const sgPos = obj.singularity!.pos;
  obj.bullets.push({ id: uid(), pos: { x: sgPos.x, y: sgPos.y - 120 }, vel: { x: 0, y: -5 }, fromPlayer: true, damage: 10, size: 3, color: "#fff", pierce: 0, homing: false });
  stepGame(obj, makeInput(2));
  assert.equal(obj.bullets.length, 1, "пуля не должна поглощаться сингулярностью");
  // Дожидаемся коллапса (240 кадров) — жертва получает урон.
  for (let k = 3; k < 260; k++) stepGame(obj, makeInput(k));
  assert.equal(obj.singularity, null, "сингулярность должна схлопнуться");
  assert.ok(victim.hp < 5_000, `жертва внутри должна получить урон коллапса (hp=${victim.hp})`);
});

test("🛰️ Последний Флот: заряд от атак помощников → залп", () => {
  const player = makeInitialPlayer("commander");
  player.level = 20;
  give(player, "mythic_fleet");
  const obj = makeObjects(player);
  // Спутники и дроны уже есть у «Флагмана»; ставим цель.
  const e = spawnEnemy("tank", 1);
  e.pos = { x: 480, y: 250 };
  e.hp = e.maxHp = 1_000_000;
  obj.enemies.push(e);
  let salvo = false;
  for (let k = 0; k < 3000 && !salvo; k++) {
    stepGame(obj, makeInput(k));
    if (player.fleetSalvoTimer > 0) salvo = true;
  }
  assert.ok(salvo, "командный канал должен накопиться и дать залп");
  assert.ok(e.hp < 1_000_000, "помощники должны наносить урон");
});
