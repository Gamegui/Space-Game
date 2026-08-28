import type { UpgradeDef, PlayerState } from "./types";
import { SYNERGIES } from "./synergies";

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
    description: "+1 снаряд и шире веер (макс. 85°); чётные уровни на 10% сужают разброс крайних снарядов",
    apply: (s, l) => {
      // Кап разброса: крайние снаряды не должны улетать мимо зоны боя.
      s.spreadAngle = Math.min(s.spreadAngle + 10, 85);
      if (l % 2 === 1) s.multishot += 1;
      // Чётные уровни (2 и 4) подтягивают крайние снаряды к центру веера.
      s.spreadTighten = Math.min(0.2, 0.1 * Math.floor(l / 2));
    },
  },
  {
    id: "rapid_fire", name: "Скорострельность", icon: "🔥", rarity: "common", category: "атака", maxLevel: 5,
    description: "Уменьшает задержку между выстрелами на 15%",
    apply: (s, _l) => { s.fireRate = Math.max(3, s.fireRate * 0.85); },
  },
  {
    id: "damage_up", name: "Силовое ядро", icon: "💠", rarity: "common", category: "атака", maxLevel: 8,
    description: "Урон снарядов +18% (уровни 1–4), далее +12%",
    apply: (s, l) => { s.bulletDamage *= l <= 4 ? 1.18 : 1.12; },
  },
  {
    id: "big_bullets", name: "Тяжёлый калибр", icon: "🔵", rarity: "common", category: "атака", maxLevel: 4,
    description: "Размер снарядов +25%, урон +10%",
    apply: (s, _l) => { s.bulletSize *= 1.25; s.bulletDamage *= 1.1; },
  },
  {
    id: "bullet_speed", name: "Ускоритель плазмы", icon: "💨", rarity: "common", category: "атака", maxLevel: 4,
    description: "Скорость снарядов +20%, дальность полёта +10% и +5% к наведению",
    apply: (s, _l) => {
      s.bulletSpeed *= 1.2;
      s.homingStrength = Math.min(0.15, s.homingStrength + 0.005);
      s.bulletRangeBonus += 0.1;
    },
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
    id: "sniper_protocol", name: "Снайперский протокол", icon: "↩️", rarity: "rare", category: "атака", maxLevel: 3,
    description: "+40% урона по одиночным целям (нет врагов рядом = бонус)",
    apply: (s, _l) => { s.sniperProtocol = true; s.sniperBonus += 0.15; },
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
    apply: (s, _l) => { s.snipeMode = true; s.bulletDamage *= 3; s.bulletSpeed *= 2; s.spreadAngle = Math.min(s.spreadAngle, 5); },
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
      if (!s.shield) s.shield = { hp: 50 * l, maxHp: 50 * l, regenTimer: 0 };
      else { s.shield.maxHp += 50; s.shield.hp = Math.min(s.shield.hp + 50, s.shield.maxHp); }
    },
  },
  {
    id: "shield_regen", name: "Конденсатор щита", icon: "⚡🛡️", rarity: "common", category: "защита", maxLevel: 3,
    description: "Мгновенно +25 HP щита и +25% к скорости восстановления щита",
    apply: (s, _l) => {
      // Отдельная характеристика (а не чтение уровня в gameLoop): мгновенный
      // ремонт + постоянное ускорение регена, как в описании предмета.
      s.shieldRegenMultiplier += 0.25;
      if (s.shield) s.shield.hp = Math.min(s.shield.maxHp, s.shield.hp + 25);
    },
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
    description: "+70 к радиусу притяжения опыта и +10% к скорости притяжения",
    apply: (s, _l) => { s.magnetRange += 70; s.magnetPullBonus += 0.1; },
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
    id: "time_slow", name: "Хроно-ускоритель", icon: "⏱️", rarity: "legendary", category: "особое", maxLevel: 2,
    description: "+2 сек. длительности и ускоренная перезарядка [C]",
    apply: (s, _l) => { s.timeSlow = true; s.timeSlowCooldown = 0; },
  },
  {
    id: "xp_boost", name: "Усилитель опыта", icon: "✨", rarity: "common", category: "утилиты", maxLevel: 5,
    description: "+25% больше опыта и мгновенно +50 XP",
    apply: (s, _l) => { s.xp += 50; },
  },
  {
    id: "score_boost", name: "Множитель очков", icon: "🏆", rarity: "common", category: "утилиты", maxLevel: 5,
    description: "+0.5x к множителю очков и +1 XP за убийство",
    apply: (s, _l) => { s.goldMultiplier += 0.5; },
  },
  {
    id: "heal_on_kill", name: "Полевой медик", icon: "💊", rarity: "rare", category: "защита", maxLevel: 3,
    description: "Восстанавливает +4 HP за каждое уничтожение и мгновенно +15 HP",
    apply: (s, _l) => { s.hp = Math.min(s.maxHp, s.hp + 15); },
  },
  {
    id: "megaton", name: "Мегатонные снаряды", icon: "🎇", rarity: "epic", category: "атака", maxLevel: 2,
    description: "50% шанс нанести пятикратный урон",
    apply: (s, _l) => { s.critChance += 0.5; s.critMultiplier += 4; },
  },
  // ═══ РАСШИРЕННЫЙ АРСЕНАЛ (возвращён из полной версии) ═══
  { id: "satellite_damage", name: "Усиление спутников", icon: "💫", rarity: "common", category: "спутники", maxLevel: 4, description: "Повышает мощность всех орбитальных спутников", apply: (s, l) => { s.satellites.forEach(sat => { sat.level += l; }); } },
  { id: "phase_discharge", name: "Фазовый разряд", icon: "🌀", rarity: "epic", category: "атака", maxLevel: 2, description: "Каждый 5-й выстрел разлетается на 4 осколка при попадании", apply: (s, _l) => { s.phaseDischarge = true; s.phaseDischargeCount += 2; } },
  { id: "laser_side", name: "Бортовые лазеры", icon: "🔴", rarity: "rare", category: "атака", maxLevel: 3, description: "Дополнительные боковые залпы и +1 снаряд", apply: (s, _l) => { s.lasers += 1; s.multishot += 1; s.spreadAngle += 8; } },
  { id: "chain_lightning", name: "Шаровая молния", icon: "🌩️", rarity: "epic", category: "стихии", maxLevel: 3, description: "Усиливает шанс и число цепных разрядов", apply: (s, l) => { s.lightningChance += 0.2; s.lightningChain = Math.max(s.lightningChain, l + 2); } },
  { id: "auto_turret", name: "Автоматические турели", icon: "🔫", rarity: "epic", category: "спутники", maxLevel: 2, description: "Развёртывает две мощные орбитальные турели", apply: (s, l) => { for (let i = 0; i < 2 && s.satellites.length < 8; i++) s.satellites.push({ angle: Math.random() * Math.PI * 2, radius: 100, speed: 0.015, level: l + 1, shootTimer: 0 }); } },
  { id: "reload_speed", name: "Ускоренный затвор", icon: "🔄", rarity: "common", category: "атака", maxLevel: 4, description: "+12% к скорострельности", apply: (s, _l) => { s.fireRate = Math.max(2, s.fireRate * 0.88); } },
  { id: "bouncy_bullets", name: "Прыгающие снаряды", icon: "🔴", rarity: "rare", category: "атака", maxLevel: 3, description: "+2 рикошета между целями", apply: (s, _l) => { s.ricochet = true; s.ricochetCount += 2; } },
  { id: "energy_blade", name: "Энергетический клинок", icon: "⚔️", rarity: "epic", category: "атака", maxLevel: 2, description: "Мощная аура ближнего боя вокруг корабля", apply: (s, _l) => { s.aura = true; s.auraDamage += 0.8; } },
  { id: "plasma_cannon", name: "Плазменная пушка", icon: "🔮", rarity: "epic", category: "атака", maxLevel: 2, description: "Огромные разрывные снаряды с большим радиусом", apply: (s, _l) => { s.bulletSize *= 1.7; s.explosiveBullets = true; s.explosionRadius += 50; s.fireRate *= 1.25; } },
  { id: "bullet_hail", name: "Шквал снарядов", icon: "🌧️", rarity: "rare", category: "атака", maxLevel: 3, description: "+4 снаряда в широком секторе", apply: (s, _l) => { s.multishot += 4; s.spreadAngle = Math.max(s.spreadAngle, 120); } },
  { id: "death_nova", name: "Защитная нова", icon: "💀", rarity: "epic", category: "защита", maxLevel: 2, description: "Усиливает щит и радиус взрывов", apply: (s, _l) => { if (!s.shield) s.shield = { hp: 30, maxHp: 30, regenTimer: 0 }; s.explosionRadius += 30; } },
  { id: "swarm_missiles", name: "Рой микроракет", icon: "🚀", rarity: "epic", category: "атака", maxLevel: 2, description: "+3 самонаводящиеся микроракеты", apply: (s, _l) => { s.homing = true; s.multishot += 3; s.homingStrength = Math.max(s.homingStrength, 0.08); } },
  { id: "shield_bash", name: "Импульс щита", icon: "🛡️", rarity: "rare", category: "защита", maxLevel: 2, description: "Щит создаёт повреждающее поле вокруг корабля", apply: (s, _l) => { s.aura = true; s.auraDamage += 0.5; if (!s.shield) s.shield = { hp: 40, maxHp: 40, regenTimer: 0 }; } },
  { id: "empowered_crit", name: "Смертельная точность", icon: "🎯", rarity: "rare", category: "атака", maxLevel: 3, description: "+20% шанса критического и разрывного попадания", apply: (s, _l) => { s.critChance += 0.2; s.explosiveBullets = true; } },
  { id: "multi_explosion", name: "Цепная реакция", icon: "💥", rarity: "legendary", category: "атака", maxLevel: 2, description: "Радиус всех взрывов увеличен на 50%", apply: (s, _l) => { s.explosiveBullets = true; s.explosionRadius *= 1.5; } },
  { id: "overcharge", name: "Сверхзаряд", icon: "⚡", rarity: "legendary", category: "атака", maxLevel: 1, description: "Резко повышает шанс и силу критического урона", apply: (s, _l) => { s.critChance += 0.2; s.critMultiplier += 5; } },
  { id: "berserker", name: "Протокол берсерка", icon: "😤", rarity: "epic", category: "атака", maxLevel: 2, description: "Скорострельность растёт при потере здоровья", apply: (s, _l) => { s.rapidMode = true; } },
  { id: "fortress", name: "Протокол «Крепость»", icon: "🏰", rarity: "legendary", category: "защита", maxLevel: 1, description: "+100 HP и щита ценой 15% скорости", apply: (s, _l) => { s.maxHp += 100; s.hp = Math.min(s.hp + 100, s.maxHp); if (!s.shield) s.shield = { hp: 100, maxHp: 100, regenTimer: 0 }; else { s.shield.maxHp += 100; s.shield.hp += 100; } s.speed *= 0.85; } },
  { id: "glass_cannon", name: "Стеклянная пушка", icon: "🔱", rarity: "legendary", category: "атака", maxLevel: 1, description: "Тройной урон, но вдвое меньше прочности", apply: (s, _l) => { s.bulletDamage *= 3; s.maxHp = Math.max(20, Math.floor(s.maxHp / 2)); s.hp = Math.min(s.hp, s.maxHp); } },
  { id: "neutron_star", name: "Нейтронная звезда", icon: "⭐", rarity: "legendary", category: "особое", maxLevel: 1, description: "Мощнейшая постоянная аура уничтожения", apply: (s, _l) => { s.aura = true; s.auraDamage += 2; } },
  { id: "orbital_strike", name: "Орбитальный удар", icon: "🌠", rarity: "legendary", category: "спутники", maxLevel: 2, description: "Добавляет две ударные орбитальные платформы", apply: (s, l) => { for (let i = 0; i < 2 && s.satellites.length < 8; i++) s.satellites.push({ angle: Math.random() * Math.PI * 2, radius: 60 + i * 20, speed: 0.05, level: l + 2, shootTimer: 0 }); } },
  { id: "vortex", name: "Гравитационный вихрь", icon: "🌪️", rarity: "legendary", category: "особое", maxLevel: 1, description: "Усиленное наведение и увеличенные снаряды", apply: (s, _l) => { s.homing = true; s.homingStrength = 0.15; s.bulletSize *= 1.5; } },
  {
    id: "turbo_engine", name: "Турбодвигатель", icon: "⚙️", rarity: "rare", category: "защита", maxLevel: 3,
    description: "+25% к скорости; при непрерывном движении (1 с) ещё +10%",
    // Роль разведена с «Форсажными двигателями» (+15%, стабильный бонус):
    // Турбодвигатель — редкая версия для тех, кто постоянно в движении.
    apply: (s, _l) => { s.speed *= 1.25; },
  },
  { id: "battle_magnet", name: "Магнит боя", icon: "🔰", rarity: "rare", category: "утилиты", maxLevel: 3, description: "Убитые враги с шансом роняют бонус-дроп", apply: (s, _l) => { s.battleMagnet = true; s.battleMagnetChance += 0.12; } },
  { id: "overload", name: "Перегрузка", icon: "♻️", rarity: "common", category: "особое", maxLevel: 4, description: "Каждые 5 секунд корабль выпускает волну урона вокруг себя", apply: (s, _l) => { s.overload = true; s.overloadDamage += 0.6; } },
  { id: "quantum_tunnel", name: "Квантовый туннель", icon: "🌌", rarity: "legendary", category: "особое", maxLevel: 1, description: "+10 пробитых целей для каждого снаряда", apply: (s, _l) => { s.piercing += 10; } },
  { id: "solar_flare", name: "Солнечная вспышка", icon: "☀️", rarity: "epic", category: "стихии", maxLevel: 2, description: "+50% шанса поджога и увеличенный радиус взрыва", apply: (s, _l) => { s.burnChance += 0.5; s.explosionRadius += 20; } },
  { id: "ice_storm", name: "Ледяная буря", icon: "🌨️", rarity: "epic", category: "стихии", maxLevel: 2, description: "+30% шанса заморозки и два дополнительных снаряда", apply: (s, _l) => { s.freezeChance += 0.3; s.multishot += 2; } },
  { id: "death_ray", name: "Луч аннигиляции", icon: "☠️", rarity: "legendary", category: "атака", maxLevel: 1, description: "Гигантские снаряды с двойным уроном и пробитием", apply: (s, _l) => { s.piercing += 20; s.bulletDamage *= 2; s.bulletSize *= 3; } },
  { id: "nano_shield", name: "Нанощит", icon: "🔵", rarity: "rare", category: "защита", maxLevel: 3, description: "+30 к ёмкости энергетического щита", apply: (s, _l) => { if (!s.shield) s.shield = { hp: 60, maxHp: 60, regenTimer: 0 }; else { s.shield.maxHp += 30; s.shield.hp += 30; } } },
  { id: "revenge", name: "Система возмездия", icon: "🩸", rarity: "epic", category: "атака", maxLevel: 2, description: "+15% к урону и +10% к критическому шансу", apply: (s, _l) => { s.bulletDamage *= 1.15; s.critChance += 0.1; } },
  { id: "unstoppable", name: "Неудержимая сила", icon: "💪", rarity: "legendary", category: "атака", maxLevel: 1, description: "+50% урона и скорости, +5 пробитий", apply: (s, _l) => { s.bulletDamage *= 1.5; s.bulletSpeed *= 1.5; s.piercing += 5; } },
  { id: "doom_satellite", name: "Спутник Судного дня", icon: "☄️", rarity: "legendary", category: "спутники", maxLevel: 1, description: "Сверхмощный спутник десятого уровня", apply: (s, _l) => { s.satellites.push({ angle: 0, radius: 90, speed: 0.025, level: 10, shootTimer: 0 }); } },
  { id: "chain_detonation", name: "Цепная детонация", icon: "💣", rarity: "legendary", category: "атака", maxLevel: 1, description: "Убитые враги взрываются, нанося урон всем поблизости", apply: (s, _l) => { s.chainDetonation = true; s.chainDetonationRadius = 100; } },
  { id: "atomic_bomb", name: "Атомная боеголовка", icon: "💣", rarity: "legendary", category: "особое", maxLevel: 2, description: "+2 заряда ядерного удара", apply: (s, _l) => { s.nukeCharges += 2; } },
  { id: "living_shield", name: "Живой щит", icon: "💫", rarity: "epic", category: "защита", maxLevel: 2, description: "Убитые враги временно восстанавливают щит", apply: (s, _l) => { s.livingShield = true; s.livingShieldAmount += 4; } },
  { id: "omnidirectional", name: "Круговая батарея", icon: "🔄", rarity: "epic", category: "атака", maxLevel: 2, description: "+6 снарядов с круговым разбросом", apply: (s, _l) => { s.multishot += 6; s.spreadAngle = 360; } },
  { id: "power_surge", name: "Энергетический всплеск", icon: "🌩️", rarity: "epic", category: "атака", maxLevel: 2, description: "+25% урона и +5% скорострельности", apply: (s, _l) => { s.bulletDamage *= 1.25; s.fireRate *= 0.95; } },
  // ═══ СИНЕРГИИ ПОЗДНЕЙ ИГРЫ ═══
  { id: "adaptive_armor", name: "Адаптивная броня", icon: "🧬", rarity: "rare", category: "защита", maxLevel: 3, description: "+35 HP и +25 к ёмкости щита", apply: (s, _l) => { s.maxHp += 35; s.hp += 35; if (s.shield) { s.shield.maxHp += 25; s.shield.hp += 25; } } },
  { id: "drone_link", name: "Нейросвязь дронов", icon: "🔗", rarity: "rare", category: "спутники", maxLevel: 3, description: "Повышает уровень всех дронов и спутников", apply: (s, _l) => { s.drones.forEach(d => d.level++); s.satellites.forEach(sat => sat.level++); } },
  { id: "singularity_rounds", name: "Сингулярные снаряды", icon: "🌌", rarity: "epic", category: "особое", maxLevel: 2, description: "Самонаведение, взрывы и увеличенный радиус поражения", apply: (s, _l) => { s.homing = true; s.explosiveBullets = true; s.explosionRadius += 25; } },
  { id: "phase_ammo", name: "Фазовые боеприпасы", icon: "👁️", rarity: "epic", category: "стихии", maxLevel: 2, description: "+2 пробития и +20% шанс заморозки", apply: (s, _l) => { s.piercing += 2; s.freezeChance += 0.2; } },
  { id: "overdrive_reactor", name: "Реактор перегрузки", icon: "🔋", rarity: "rare", category: "атака", maxLevel: 3, description: "+8% урона и +15% скорострельности", apply: (s, _l) => { s.bulletDamage *= 1.08; s.fireRate *= 0.85; } },
  { id: "collector_core", name: "Ядро сборщика", icon: "🧲", rarity: "common", category: "утилиты", maxLevel: 4, description: "Быстрее притягивает опыт и повышает множитель очков", apply: (s, _l) => { s.magnetRange += 45; s.goldMultiplier += 0.15; } },
  { id: "guardian_protocol", name: "Протокол хранителя", icon: "💎", rarity: "epic", category: "защита", maxLevel: 2, description: "Усиливает регенерацию корпуса и щита", apply: (s, _l) => { s.regenRate += 0.5; if (s.shield) { s.shield.maxHp += 35; s.shield.hp += 35; } } },
  { id: "hunter_protocol", name: "Протокол охотника", icon: "🦅", rarity: "rare", category: "атака", maxLevel: 3, description: "Самонаведение и +12% критического шанса", apply: (s, _l) => { s.homing = true; s.homingStrength += 0.025; s.critChance += 0.12; } },
  { id: "void_arsenal", name: "Арсенал Бездны", icon: "🌑", rarity: "legendary", category: "особое", maxLevel: 1, description: "Мощная комбинация пробития, молний и фазовой защиты", apply: (s, _l) => { s.piercing += 3; s.lightningChance += 0.2; s.lightningChain += 2; s.ghostMode = true; } },
  {
    id: "stellar_core", name: "Звёздное ядро", icon: "🌟", rarity: "legendary", category: "атака", maxLevel: 1,
    description: "Абсолютная мощь: +100% ко всему наносимому урону",
    apply: (s, _l) => { s.bulletDamage *= 2; s.auraDamage *= 2; },
  },
  // ═══ МИФИЧЕСКИЙ ТИР (rarity: mythic) ═══
  // Выпадают только через rollMythicDrop (шанс ~0.5% после 8-го уровня,
  // максимум 2 за забег) и никогда не входят в обычный пул выбора.
  {
    id: "mythic_nova", name: "Звёздный Пожиратель «Сердце Сверхновой»", icon: "☀️", rarity: "mythic", category: "миф", maxLevel: 1,
    description: "Убийства заряжают Звёздное Ядро (0/100). На полном заряде — СВЕРХНОВАЯ: волна стирает слабых, элиты и мини-боссы получают огромный урон, боссы — до 6% макс. HP.",
    apply: (s, _l) => { s.novaCore = 0; s.novaFuseTimer = 0; },
  },
  {
    id: "mythic_singularity", name: "Сингулярность «Пожиратель Звёзд»", icon: "🌌", rarity: "mythic", category: "миф", maxLevel: 1,
    description: "Убийства копят Коллапс (0/50). На полном заряде рождается сингулярность: стягивает врагов, поглощает ваши снаряды — и схлопывается чудовищным взрывом.",
    apply: (s, _l) => { s.collapseCharge = 0; },
  },
  {
    id: "mythic_judgement", name: "Бог Грома «Судный Разряд»", icon: "⚡", rarity: "mythic", category: "миф", maxLevel: 1,
    description: "Криты заряжают Гнев Бури (0/10). Десятый крит высвобождает СУДНЫЙ РАЗРЯД: усиляющуюся молнию, ищущую до 16 целей и растущую на 5% за каждое уничтожение.",
    apply: (s, _l) => { s.wrath = 0; },
  },
  {
    id: "mythic_overdrive", name: "Абсолютный Реактор «Перегрузка»", icon: "🔥", rarity: "mythic", category: "миф", maxLevel: 1,
    description: "Непрерывная стрельба копит Перегрузку (0–100%). На 100% — 5 секунд ABSOLUTE OVERDRIVE: шквал огня; убийства продлевают режим (до 10 с), затем реактор остывает.",
    apply: (s, _l) => { s.overdriveCharge = 0; s.overdriveTimer = 0; s.overdriveCooldown = 0; s.lastShotFrame = -9999; },
  },
  {
    id: "mythic_fleet", name: "Армада «Последний Флот»", icon: "🛰️", rarity: "mythic", category: "миф", maxLevel: 1,
    description: "FLEET LINK: спутники и дроны бьют по общей приоритетной цели, их атаки копят командный канал (0/100). Залп FINAL FLEET SALVO — синхронный удар всей армады.",
    apply: (s, _l) => { s.fleetCharge = 0; s.fleetSalvoTimer = 0; s.fleetStacks = 0; },
  },
  {
    id: "mythic_void", name: "Абсолютная Пустота «Конец Материи»", icon: "👁️", rarity: "mythic", category: "миф", maxLevel: 1,
    description: "Бой копит Энтропию (0/100). На полном заряде — 4 c КОНЦА МАТЕРИИ: враги замедлены и уязвимы, снаряды пробивают и наводятся, а убитые оставляют разрывы-порталы для ваших снарядов.",
    apply: (s, _l) => { s.entropy = 0; s.voidTimer = 0; },
  },
];

export function calculatePlayerPower(state: PlayerState): number {
  const rarityPoints = { common: 1, rare: 2.5, epic: 5, legendary: 9, mythic: 18 } as const;
  let upgradePoints = 0;
  for (const owned of state.upgrades) {
    const definition = ALL_UPGRADES.find(upgrade => upgrade.id === owned.id);
    if (definition) upgradePoints += owned.level * rarityPoints[definition.rarity];
  }

  // Effective stats account for powerful combinations, not just card count.
  const offense = state.bulletDamage * 3.5
    + state.multishot * 2.2
    + Math.max(0, 12 - state.fireRate) * 1.8
    + state.piercing * 1.4
    + state.critChance * state.critMultiplier * 10
    + state.satellites.length * 3
    + state.drones.length * 3.5
    // The Wraith's twin bolts, phase blink and devoured souls are real power.
    + (state.shipClass === "void_wraith" ? 8 : 0)
    + (state.voidSouls ?? 0) * 0.4;
  const defense = state.maxHp / 25
    + (state.shield?.maxHp ?? 0) / 20
    + state.regenRate * 5
    + state.lifeSteal * 60;
  return Math.max(1, Math.round(upgradePoints + offense + defense));
}

export function getAdaptiveDifficulty(state: PlayerState, wave: number): { power: number; scale: number } {
  const power = calculatePlayerPower(state);
  if (wave <= 25) return { power, scale: 1 };
  const expectedPower = 58 + (wave - 25) * 2.2;
  const powerRatio = Math.max(1, power / expectedPower);
  // Near-expected builds keep the power fantasy. Extreme completed builds no
  // longer hit the old ×2.6 ceiling and now face proportionally tougher waves.
  return { power, scale: Math.min(12, Math.pow(powerRatio, 0.85)) };
}

const LIMIT_BREAK: UpgradeDef = {
  id: "limit_break",
  name: "Прорыв предела",
  icon: "♾️",
  rarity: "legendary",
  category: "особое",
  maxLevel: 9999,
  description: "+5% урона и ремонт 10 HP. Повторяется после завершения основного пула.",
  apply: (state, _level) => {
    state.bulletDamage *= 1.05;
    state.hp = Math.min(state.maxHp, state.hp + 10);
  },
};

export function getUpgradeLevel(state: PlayerState, id: string): number {
  const u = state.upgrades.find(u => u.id === id);
  return u ? u.level : 0;
}

export function canUpgrade(state: PlayerState, def: UpgradeDef): boolean {
  const lvl = getUpgradeLevel(state, def.id);
  const rarityLevelGate = { common: 1, rare: 3, epic: 7, legendary: 12, mythic: 9999 } as const;
  return lvl < def.maxLevel && state.level >= rarityLevelGate[def.rarity];
}

// Upgrade family that completes the Wraith's «Сердце Бездны» synergy and
// extends its phase kit.
const VOID_UPGRADES = new Set([
  "ghost", "quantum_tunnel", "singularity_rounds",
  "chain_detonation", "living_shield", "phase_discharge", "void_arsenal",
]);

export function rollUpgrades(state: PlayerState, count = 3, excludeIds: string[] = []): UpgradeDef[] {
  const excluded = new Set(excludeIds);
  const available = ALL_UPGRADES.filter(u =>
    u.rarity !== "mythic" // мифики выпадают только через rollMythicDrop
    && canUpgrade(state, u)
    && !excluded.has(u.id)
    // «Конденсатор щита» не имеет смысла без щита (сам «Энергетический щит»
    // и создающие щит предметы остаются в пуле).
    && !(u.id === "shield_regen" && !state.shield)
  );
  // A maxed-out build must still resolve queued level-ups. Without a fallback,
  // two simultaneous levels could leave the player trapped in an empty panel.
  if (available.length === 0) return [LIMIT_BREAK];

  const ownedIds = new Set(state.upgrades.map(upgrade => upgrade.id));
  const synergyFinishers = new Set<string>();
  for (const synergy of SYNERGIES) {
    if (state.synergies.includes(synergy.id)) continue;
    const missing = synergy.requires.filter(id => !ownedIds.has(id));
    if (missing.length === 1) synergyFinishers.add(missing[0]);
  }

  const weighted: UpgradeDef[] = [];
  for (const u of available) {
    // Strong upgrades are intentionally scarce. If a build has 2/3 synergy
    // pieces, its final component receives a visible but non-guaranteed boost.
    const baseWeight = u.rarity === "common" ? 100
      : u.rarity === "rare" ? (state.level >= 8 ? 24 : 15)
      : u.rarity === "epic" ? (state.level >= 15 ? 8 : 3)
      : (state.level >= 20 ? 3 : 1);
    // The premium Wraith's kit is void-themed: its natural upgrade family
    // (and the «Сердце Бездны» synergy pieces) appears twice as often.
    const voidThemed = state.shipClass === "void_wraith" && VOID_UPGRADES.has(u.id) ? 2 : 1;
    const weight = baseWeight * (synergyFinishers.has(u.id) ? 3 : 1) * voidThemed;
    for (let i = 0; i < weight; i++) weighted.push(u);
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

export function rollHighRarityUpgrade(state: PlayerState, excludeIds: string[] = []): UpgradeDef | null {
  const excluded = new Set(excludeIds);
  const available = ALL_UPGRADES.filter(upgrade =>
    (upgrade.rarity === "epic" || upgrade.rarity === "legendary")
    && canUpgrade(state, upgrade)
    && !excluded.has(upgrade.id)
  );
  if (available.length === 0) return null;
  const weighted = available.flatMap(upgrade => Array(upgrade.rarity === "epic" ? 4 : 1).fill(upgrade) as UpgradeDef[]);
  return weighted[Math.floor(Math.random() * weighted.length)];
}

// Premium promise: the Wraith's first two level-ups always offer at least one
// epic/legendary card. Unlike the rewarded fourth choice, this guarantee works
// from level 2 and ignores the rarity level gates (which would otherwise make
// epics unavailable until level 7).
export function rollPremiumUpgradeChoices(state: PlayerState, count = 3, excludeIds: string[] = []): UpgradeDef[] {
  const picked = rollUpgrades(state, count, excludeIds);
  const isPremiumRun = state.shipClass === "void_wraith" && state.level <= 3;
  if (!isPremiumRun) return picked;
  const hasHigh = picked.some(u => u.rarity === "epic" || u.rarity === "legendary");
  if (hasHigh) return picked;
  const excluded = [...excludeIds, ...picked.map(u => u.id)];
  let bonus = rollHighRarityUpgrade(state, excluded);
  if (!bonus) {
    bonus = pickPremiumHighRarity(state, excluded);
  }
  if (!bonus) return picked;
  const order = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 } as const;
  let worst = 0;
  for (let i = 1; i < picked.length; i++) {
    if (order[picked[i].rarity] < order[picked[worst].rarity]) worst = i;
  }
  picked[worst] = bonus;
  return picked;
}

function pickPremiumHighRarity(state: PlayerState, excludeIds: string[]): UpgradeDef | null {
  const excluded = new Set(excludeIds);
  const pool = ALL_UPGRADES.filter(u =>
    (u.rarity === "epic" || u.rarity === "legendary")
    && !excluded.has(u.id)
    && getUpgradeLevel(state, u.id) < u.maxLevel
  );
  if (pool.length === 0) return null;
  const weighted = pool.flatMap(u => Array(u.rarity === "epic" ? 5 : 1).fill(u) as UpgradeDef[]);
  return weighted[Math.floor(Math.random() * weighted.length)];
}

export function applyUpgrade(state: PlayerState, def: UpgradeDef): PlayerState {
  const existing = state.upgrades.find(u => u.id === def.id);
  const newLevel = existing ? existing.level + 1 : 1;
  def.apply(state, newLevel);
  if (existing) existing.level = newLevel;
  else state.upgrades.push({ id: def.id, level: newLevel });

  // Global safety caps preserve build variety without allowing one combination
  // to trivialize every boss or create thousands of projectiles per second.
  state.multishot = Math.min(state.multishot, 18);
  state.fireRate = Math.max(state.fireRate, 3);
  state.bulletDamage = Math.min(state.bulletDamage, 75);
  state.bulletSpeed = Math.min(state.bulletSpeed, 24);
  state.bulletSize = Math.min(state.bulletSize, 12);
  state.piercing = Math.min(state.piercing, 12);
  state.auraDamage = Math.min(state.auraDamage, 12);
  state.explosionRadius = Math.min(state.explosionRadius, 220);
  state.goldMultiplier = Math.min(state.goldMultiplier, 8);
  // 10.5: полный стек мобильности (Форсаж ×4 + Турбо ×3) должен работать,
  // а не упираться в старый потолок 8.5.
  state.speed = Math.min(state.speed, 10.5);
  state.homingStrength = Math.min(state.homingStrength, 0.15);
  state.critChance = Math.min(state.critChance, 0.65);
  state.critMultiplier = Math.min(state.critMultiplier, 6);
  state.burnChance = Math.min(state.burnChance, 0.65);
  state.freezeChance = Math.min(state.freezeChance, 0.6);
  state.poisonChance = Math.min(state.poisonChance, 0.65);
  state.lightningChance = Math.min(state.lightningChance, 0.5);
  state.lifeSteal = Math.min(state.lifeSteal, 0.06);
  state.regenRate = Math.min(state.regenRate, 1.5);
  state.maxHp = Math.min(state.maxHp, 300);
  state.hp = Math.min(state.hp, state.maxHp);
  if (state.shield) {
    state.shield.maxHp = Math.min(state.shield.maxHp, 220);
    state.shield.hp = Math.min(state.shield.hp, state.shield.maxHp);
  }
  if (state.satellites.length > 8) state.satellites.length = 8;
  if (state.drones.length > 5) state.drones.length = 5;
  return state;
}
