// ТЗ v1.6.0 — точечные проверки переработанных улучшений и синергий.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeInitialPlayer } from "../src/game/gameLoop";
import {
  ALL_UPGRADES, applyUpgrade, getUpgradeLevel, rollUpgrades,
} from "../src/game/upgrades";
import { SYNERGIES, unlockAvailableSynergies } from "../src/game/synergies";

function find(id: string) {
  return ALL_UPGRADES.find(u => u.id === id)!;
}

function maxOut(player: ReturnType<typeof makeInitialPlayer>, id: string) {
  const def = find(id);
  while (getUpgradeLevel(player, id) < def.maxLevel) applyUpgrade(player, def);
}

test("Конденсатор щита: множитель регена + мгновенный ремонт (описание = реализация)", () => {
  const player = makeInitialPlayer("interceptor");
  player.shield = { hp: 10, maxHp: 100, regenTimer: 0 };
  applyUpgrade(player, find("shield_regen"));
  assert.equal(player.shieldRegenMultiplier, 1.25);
  assert.equal(player.shield!.hp, 35); // 10 + мгновенные 25
  applyUpgrade(player, find("shield_regen"));
  applyUpgrade(player, find("shield_regen"));
  assert.equal(player.shieldRegenMultiplier, 1.75);
  assert.equal(player.shield!.hp, Math.min(100, 35 + 25 + 25));
});

test("Конденсатор щита не предлагается без щита", () => {
  const noShield = makeInitialPlayer("interceptor");
  noShield.shield = null;
  noShield.level = 10;
  for (let i = 0; i < 200; i++) {
    for (const choice of rollUpgrades(noShield, 3)) assert.notEqual(choice.id, "shield_regen");
  }
  const withShield = makeInitialPlayer("interceptor");
  withShield.level = 10;
  assert.ok(withShield.shield);
  let seen = false;
  for (let i = 0; i < 400 && !seen; i++) seen = rollUpgrades(withShield, 3).some(c => c.id === "shield_regen");
  assert.ok(seen, "со щитом предмет должен появляться в пуле");
});

test("Силовое ядро: ступенчатая шкала 1–4 ×1.18, 5–8 ×1.12", () => {
  const player = makeInitialPlayer("interceptor");
  const base = player.bulletDamage; // 1.3
  for (let level = 1; level <= 8; level++) {
    applyUpgrade(player, find("damage_up"));
    const expected = base * (level <= 4 ? Math.pow(1.18, level) : Math.pow(1.18, 4) * Math.pow(1.12, level - 4));
    assert.ok(Math.abs(player.bulletDamage - expected) < 1e-9, `level ${level}: ${player.bulletDamage} vs ${expected}`);
  }
  // Полный стек ≈ ×3.05 — против прежних ×4.3 при 8 уровнях.
  assert.ok(player.bulletDamage / base > 3.0 && player.bulletDamage / base < 3.1);
});

test("Полный атакующий стек упирается в глобальный кап урона (ТЗ 3.7)", () => {
  const player = makeInitialPlayer("dreadnought");
  for (const id of ["damage_up", "big_bullets", "rapid_fire", "overdrive_reactor", "stellar_core", "megaton", "revenge", "power_surge"]) maxOut(player, id);
  // Билд 1 «Классический урон»: ядро + калибр + скорострельность + реактор + звёздное ядро…
  // Полный стек даёт ~×49 урона и остаётся ограниченным глобальным капом 75.
  assert.ok(player.bulletDamage > 40 && player.bulletDamage <= 75, `bulletDamage=${player.bulletDamage}`);
  assert.ok(player.fireRate >= 3);
});

test("Широкий сектор: кап 85° и сужение крайних снарядов на чётных уровнях", () => {
  const player = makeInitialPlayer("interceptor");
  maxOut(player, "spread_shot");
  assert.equal(player.spreadAngle, 40); // 4 × 10, кап не достигнут
  assert.equal(player.spreadTighten, 0.2); // уровни 2 и 4
  const wide = makeInitialPlayer("interceptor");
  wide.spreadAngle = 80;
  applyUpgrade(wide, find("spread_shot"));
  assert.equal(wide.spreadAngle, 85); // кап разброса
  assert.equal(wide.spreadTighten, 0); // уровень 1: floor(1/2) = 0 — сужение с 2-го уровня
  const lvl2 = makeInitialPlayer("interceptor");
  applyUpgrade(lvl2, find("spread_shot"));
  applyUpgrade(lvl2, find("spread_shot"));
  assert.equal(lvl2.spreadTighten, 0.1); // 2-й уровень → −10% разброса крайних снарядов
});

test("Турбодвигатель: +25% за уровень, роль разведена с Форсажем", () => {
  const player = makeInitialPlayer("interceptor");
  const base = player.speed;
  maxOut(player, "turbo_engine");
  // 5.4 × 1.25³ ≈ 10.55 — упирается в поднятый кап 10.5 (раньше было 8.5).
  assert.equal(player.speed, 10.5);
  const single = makeInitialPlayer("interceptor");
  applyUpgrade(single, find("turbo_engine"));
  assert.ok(Math.abs(single.speed - base * 1.25) < 1e-9, "один уровень = ровно +25%");
});

test("Ускоритель плазмы: дальность +10% за уровень", () => {
  const player = makeInitialPlayer("interceptor");
  maxOut(player, "bullet_speed");
  assert.equal(player.bulletRangeBonus, 0.4);
});

test("Магнитный гравизахват: +70 радиус и +10% притяжение за уровень", () => {
  const player = makeInitialPlayer("interceptor");
  const baseRange = player.magnetRange;
  maxOut(player, "magnet");
  assert.equal(player.magnetRange, baseRange + 280);
  assert.equal(player.magnetPullBonus, 0.4);
});

test("Синергии Немезиды открываются только у Немезиды", () => {
  const wraith = makeInitialPlayer("void_wraith");
  for (const id of ["life_steal", "aura"]) applyUpgrade(wraith, find(id));
  const unlocked = unlockAvailableSynergies(wraith);
  assert.ok(unlocked.some(s => s.id === "void_hunger"));
  assert.equal(wraith.voidHunger, true);

  const interceptor = makeInitialPlayer("interceptor");
  for (const id of ["life_steal", "aura"]) applyUpgrade(interceptor, find(id));
  const unlocked2 = unlockAvailableSynergies(interceptor);
  assert.ok(!unlocked2.some(s => s.id === "void_hunger"));
  assert.equal(interceptor.voidHunger, false);

  const wraith2 = makeInitialPlayer("void_wraith");
  for (const id of ["phase_discharge", "homing", "singularity_rounds"]) applyUpgrade(wraith2, find(id));
  unlockAvailableSynergies(wraith2);
  assert.equal(wraith2.ghostArsenal, true);
  assert.ok(SYNERGIES.length >= 6);
});
