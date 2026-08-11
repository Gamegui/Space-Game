import type { UpgradeDef, PlayerState } from "./types";

export const ALL_UPGRADES: UpgradeDef[] = [
  // ═══ ОРУЖИЕ И УРОН ═══
  {
    id: "double_shot", name: "Двойной залп", icon: "⚡", rarity: "common", category: "атака", maxLevel: 3,
    description: "+1 дополнительный снаряд за каждый выстрел",
    apply: (s, _l) => { s.multishot += 1; },
  },
  {
    id: "triple_shot", name: "Тройной веер", icon: "🔱", rarity: "rare", category: "атака", maxLevel: 2,
    description: "+2 снаряда веерным расхождением",
    apply: (s, _l) => { s.multishot += 2; s.spreadAngle += 8; },
  },
  {
    id: "spread_shot", name: "Широкий сектор", icon: "🌊", rarity: "common", category: "атака", maxLevel: 4,
    description: "Увеличивает угол веерной стрельбы",
    apply: (s, _l) => { s.spreadAngle += 10; s.multishot = Math.max(s.multishot, 1); },
  },
  {
    id: "rapid_fire", name: "Скорострельность", icon: "🔥", rarity: "common", category: "атака", maxLevel: 5,
    description: "Уменьшает задержку между выстрелами на 15%",
    apply: (s, _l) => { s.fireRate = Math.max(3, s.fireRate * 0.85); },
  },
  {
    id: "damage_up", name: "Силовое ядро", icon: "💠", rarity: "common", category: "атака", maxLevel: 8,
    description: "Урон снарядов +20%",
    apply: (s, _l) => { s.bulletDamage *= 1.2; },
  },
  {
    id: "big_bullets", name: "Тяжёлый калибр", icon: "🔵", rarity: "common", category: "атака", maxLevel: 4,
    description: "Размер снарядов +25%, урон +10%",
    apply: (s, _l) => { s.bulletSize *= 1.25; s.bulletDamage *= 1.1; },
  },
  {
    id: "bullet_speed", name: "Ускоритель плазмы", icon: "💨", rarity: "common", category: "атака", maxLevel: 4,
    description: "Скорость полёта снарядов +20%",
    apply: (s, _l) => { s.bulletSpeed *= 1.2; },
  },
  {
    id: "piercing", name: "Бронебойные снаряды", icon: "🗡️", rarity: "rare", category: "атака", maxLevel: 4,
    description: "Снаряды пробивают сквозь +1 цель",
    apply: (s, _l) => { s.piercing += 1; },
  },
  {
    id: "homing", name: "Самонаведение", icon: "🎯", rarity: "rare", category: "атака", maxLevel: 3,
    description: "Снаряды агрессивно наводятся на врагов",
    apply: (s, l) => { s.homing = true; s.homingStrength = 0.06 + l * 0.03; },
  },
  {
    id: "explosive", name: "Кассетный разрыв", icon: "💥", rarity: "rare", category: "атака", maxLevel: 3,
    description: "Снаряды взрываются при контакте",
    apply: (s, l) => { s.explosiveBullets = true; s.explosionRadius = 40 + l * 20; },
  },
  {
    id: "ricochet", name: "Рикошет", icon: "↩️", rarity: "rare", category: "атака", maxLevel: 3,
    description: "Снаряды отскакивают от стен",
    apply: (s, _l) => { s.ricochet = true; s.ricochetCount += 1; },
  },
  {
    id: "rear_shot", name: "Кормовая турель", icon: "🔙", rarity: "rare", category: "атака", maxLevel: 2,
    description: "Одновременная стрельба назад",
    apply: (s, _l) => { s.rearShot = true; },
  },
  {
    id: "spiral_shot", name: "Спиральный шквал", icon: "🌀", rarity: "epic", category: "атака", maxLevel: 2,
    description: "Автоматический вращающийся шквал снарядов",
    apply: (s, _l) => { s.spiralShot = true; },
  },
  {
    id: "wave_shot", name: "Волновой залп", icon: "〰️", rarity: "epic", category: "атака", maxLevel: 2,
    description: "Периодическая кольцевая ударная волна снарядов",
    apply: (s, _l) => { s.waveShot = true; },
  },
  {
    id: "snipe_mode", name: "Протокол снайпера", icon: "🔭", rarity: "rare", category: "атака", maxLevel: 1,
    description: "Трёхкратный урон, максимальная скорость и точность",
    apply: (s, _l) => { s.snipeMode = true; s.bulletDamage *= 3; s.bulletSpeed *= 2; s.spreadAngle = 0; },
  },
  {
    id: "mirror_shots", name: "Зеркальная матрица", icon: "🪞", rarity: "epic", category: "атака", maxLevel: 2,
    description: "Дублирование всех выстрелов в противоположную сторону",
    apply: (s, _l) => { s.mirrorShots = true; },
  },
  {
    id: "burn", name: "Зажигательные пули", icon: "🔥", rarity: "common", category: "стихии", maxLevel: 3,
    description: "+25% шанс поджечь врага периодическим уроном",
    apply: (s, _l) => { s.burnChance += 0.25; },
  },
  {
    id: "freeze", name: "Криогенный заряд", icon: "❄️", rarity: "common", category: "стихии", maxLevel: 3,
    description: "+20% шанс заморозить и замедлить врага",
    apply: (s, _l) => { s.freezeChance += 0.2; },
  },
  {
    id: "poison", name: "Токсичный снаряд", icon: "☠️", rarity: "common", category: "стихии", maxLevel: 3,
    description: "+30% шанс отравить цель кислотой",
    apply: (s, _l) => { s.poisonChance += 0.3; },
  },
  {
    id: "lightning", name: "Катушка Теслы", icon: "⚡", rarity: "rare", category: "стихии", maxLevel: 3,
    description: "+25% шанс вызвать цепную молнию по толпе",
    apply: (s, l) => { s.lightningChance += 0.25; s.lightningChain = Math.max(s.lightningChain, l + 1); },
  },
  {
    id: "crit", name: "Критическая матрица", icon: "🎲", rarity: "rare", category: "атака", maxLevel: 4,
    description: "+15% шанс критического удара, +50% урон крита",
    apply: (s, _l) => { s.critChance += 0.15; s.critMultiplier += 0.5; },
  },
  // ═══ СПУТНИКИ И ДРОНЫ ═══
  {
    id: "satellite_1", name: "Орбитальный сателлит", icon: "🛰️", rarity: "rare", category: "спутники", maxLevel: 4,
    description: "Развёртывание орбитального орудийного сателлита",
    apply: (s, l) => {
      if (s.satellites.length < 8) {
        const angle = (s.satellites.length / 8) * Math.PI * 2;
        s.satellites.push({ angle, radius: 80 + s.satellites.length * 10, speed: 0.03, level: l, shootTimer: 0 });
      } else {
        s.satellites.forEach(sat => { sat.level = l; });
      }
    },
  },
  {
    id: "satellite_speed", name: "Орбитальный разгон", icon: "🌐", rarity: "common", category: "спутники", maxLevel: 3,
    description: "Сателлиты вращаются быстрее и стреляют чаще",
    apply: (s, _l) => { s.satellites.forEach(sat => { sat.speed *= 1.4; }); },
  },
  {
    id: "drone_1", name: "Боевой дрон", icon: "🤖", rarity: "rare", category: "спутники", maxLevel: 3,
    description: "Дрон сопровождения с автонаведением на врагов",
    apply: (s, l) => {
      if (s.drones.length < 4) {
        s.drones.push({ id: Math.random(), pos: { x: s.pos.x, y: s.pos.y }, angle: 0, orbitAngle: s.drones.length * Math.PI / 2, orbitRadius: 120, speed: 2, shootTimer: 0, level: l });
      } else {
        s.drones.forEach(d => { d.level = Math.max(d.level, l); });
      }
    },
  },
  {
    id: "drone_swarm", name: "Рой дронов", icon: "🐝", rarity: "epic", category: "спутники", maxLevel: 2,
    description: "Дополнительно развёртывает +2 боевых дрона",
    apply: (s, l) => {
      for (let i = 0; i < 2 && s.drones.length < 6; i++) {
        s.drones.push({ id: Math.random(), pos: { x: s.pos.x, y: s.pos.y }, angle: 0, orbitAngle: s.drones.length * Math.PI / 3, orbitRadius: 130, speed: 2.5, shootTimer: 0, level: l });
      }
    },
  },
  // ═══ ЗАЩИТА И ВЫЖИВАНИЕ ═══
  {
    id: "shield", name: "Энергетический щит", icon: "🛡️", rarity: "rare", category: "защита", maxLevel: 4,
    description: "Генерирует самовосстанавливающееся силовое поле",
    apply: (s, l) => {
      if (!s.shield) s.shield = { hp: 50 * l, maxHp: 50 * l, regenTimer: 0, active: true };
      else { s.shield.maxHp += 50; s.shield.hp = Math.min(s.shield.hp + 50, s.shield.maxHp); }
    },
  },
  {
    id: "shield_regen", name: "Конденсатор щита", icon: "⚡🛡️", rarity: "common", category: "защита", maxLevel: 3,
    description: "Щит перезаряжается на 35% быстрее",
    apply: (_s, _l) => {},
  },
  {
    id: "max_hp", name: "Бронелисты корпуса", icon: "❤️", rarity: "common", category: "защита", maxLevel: 6,
    description: "Максимум HP +25, мгновенно лечит 25 HP",
    apply: (s, _l) => { s.maxHp += 25; s.hp = Math.min(s.hp + 25, s.maxHp); },
  },
  {
    id: "regen", name: "Наноботы регенерации", icon: "🩹", rarity: "rare", category: "защита", maxLevel: 4,
    description: "Постоянно восстанавливает +0.5 HP в секунду",
    apply: (s, _l) => { s.regenRate += 0.5; },
  },
  {
    id: "life_steal", name: "Вампирический контур", icon: "🧛", rarity: "rare", category: "защита", maxLevel: 3,
    description: "Поглощает 3% нанесённого урона в здоровье",
    apply: (s, _l) => { s.lifeSteal += 0.03; },
  },
  {
    id: "speed_up", name: "Форсажные двигатели", icon: "🚀", rarity: "common", category: "защита", maxLevel: 4,
    description: "Скорость манёвров корабля +15%",
    apply: (s, _l) => { s.speed *= 1.15; },
  },
  {
    id: "magnet", name: "Магнитный гравизахват", icon: "🧲", rarity: "common", category: "утилиты", maxLevel: 4,
    description: "Увеличивает скорость и дистанцию притяжения опыта",
    apply: (s, _l) => { s.magnetRange += 60; },
  },
  {
    id: "ghost", name: "Фазовый сдвиг", icon: "👻", rarity: "epic", category: "защита", maxLevel: 2,
    description: "Периодическая неуязвимость на 2 секунды",
    apply: (s, _l) => { s.ghostMode = true; },
  },
  {
    id: "aura", name: "Аура аннигиляции", icon: "🌟", rarity: "rare", category: "атака", maxLevel: 4,
    description: "Наносит постоянный урон всем врагам поблизости",
    apply: (s, _l) => { s.aura = true; s.auraDamage += 0.3; },
  },
  // ═══ СПЕЦИАЛЬНОЕ ═══
  {
    id: "mine_layer", name: "Минный заградитель", icon: "💣", rarity: "rare", category: "особое", maxLevel: 3,
    description: "Сбрасывает бесконтактные мины взрывного радиуса",
    apply: (s, _l) => { s.mineCount += 1; s.mineTimer = Math.max(60, s.mineTimer - 20); },
  },
  {
    id: "black_hole", name: "Проектор черной дыры", icon: "🕳️", rarity: "legendary", category: "особое", maxLevel: 2,
    description: "Периодически создаёт чёрную дыру, затягивающую врагов",
    apply: (s, _l) => { s.blackHole = true; s.blackHoleCooldown = 600; },
  },
  {
    id: "nuke", name: "Тактический ядерный заряд", icon: "☢️", rarity: "legendary", category: "особое", maxLevel: 3,
    description: "+1 заряд Screen-Wipe [Клавиша X]",
    apply: (s, _l) => { s.nukeCharges += 1; },
  },
  {
    id: "time_slow", name: "Хроно-разлом", icon: "⏱️", rarity: "legendary", category: "особое", maxLevel: 2,
    description: "Замедление времени на 50% [Клавиша C]",
    apply: (s, _l) => { s.timeSlow = true; s.timeSlowCooldown = 500; },
  },
  {
    id: "xp_boost", name: "Усилитель опыта", icon: "✨", rarity: "common", category: "утилиты", maxLevel: 5,
    description: "+25% больше опыта со всех поверженных врагов",
    apply: (_s, _l) => {},
  },
  {
    id: "score_boost", name: "Множитель очков", icon: "🏆", rarity: "common", category: "утилиты", maxLevel: 5,
    description: "+0.5x к множителю очков",
    apply: (s, _l) => { s.goldMultiplier += 0.5; },
  },
  {
    id: "heal_on_kill", name: "Полевой медик", icon: "💊", rarity: "rare", category: "защита", maxLevel: 3,
    description: "Восстанавливает +2 HP за каждое уничтожение",
    apply: (_s, _l) => {},
  },
  {
    id: "megaton", name: "Мегатонные снаряды", icon: "🎇", rarity: "epic", category: "атака", maxLevel: 2,
    description: "50% шанс нанести пятикратный урон",
    apply: (s, _l) => { s.critChance += 0.5; s.critMultiplier += 4; },
  },
  {
    id: "stellar_core", name: "Звёздное ядро", icon: "🌟", rarity: "legendary", category: "атака", maxLevel: 1,
    description: "Абсолютная мощь: +100% ко всему наносимому урону",
    apply: (s, _l) => { s.bulletDamage *= 2; s.auraDamage *= 2; },
  },
];

export function getUpgradeLevel(state: PlayerState, id: string): number {
  const u = state.upgrades.find(u => u.id === id);
  return u ? u.level : 0;
}

export function canUpgrade(state: PlayerState, def: UpgradeDef): boolean {
  const lvl = getUpgradeLevel(state, def.id);
  return lvl < def.maxLevel;
}

export function rollUpgrades(state: PlayerState, count = 3): UpgradeDef[] {
  const available = ALL_UPGRADES.filter(u => canUpgrade(state, u));
  if (available.length === 0) return [];

  const weighted: UpgradeDef[] = [];
  for (const u of available) {
    const w = u.rarity === "common" ? 40 : u.rarity === "rare" ? 15 : u.rarity === "epic" ? 7 : 3;
    for (let i = 0; i < w; i++) weighted.push(u);
  }

  const picked: UpgradeDef[] = [];
  const usedIds = new Set<string>();
  let tries = 0;
  while (picked.length < Math.min(count, available.length) && tries < 1000) {
    tries++;
    const candidate = weighted[Math.floor(Math.random() * weighted.length)];
    if (!usedIds.has(candidate.id)) {
      usedIds.add(candidate.id);
      picked.push(candidate);
    }
  }
  return picked;
}

export function applyUpgrade(state: PlayerState, def: UpgradeDef): PlayerState {
  const existing = state.upgrades.find(u => u.id === def.id);
  const newLevel = existing ? existing.level + 1 : 1;
  def.apply(state, newLevel);
  if (existing) existing.level = newLevel;
  else state.upgrades.push({ id: def.id, level: newLevel });
  return state;
}
