import type { ShipClassDef, ShipClassId, PlayerState } from "./types";

export const SHIP_CLASSES: ShipClassDef[] = [
  {
    id: "interceptor",
    name: "Перехватчик «Апекс»",
    subtitle: "Тактический штурмовик",
    icon: "🚀",
    description: "Манёвренный и скорострельный корабль, оснащённый стартовым тактическим энергощитом.",
    perks: ["+15% скорость полёта", "+10% скорострельность", "Стартовый щит 20 HP", "Сбалансированная динамика"],
    color: "#38bdf8",
  },
  {
    id: "dreadnought",
    name: "Дредноут «Титан»",
    subtitle: "Тяжёлый броненосный линкор",
    icon: "🛡️",
    description: "Непробиваемый корпус и крупнокалиберные плазменные снаряды, прошивающие строй врагов.",
    perks: ["+60% урон снарядов", "+50 макс. HP (всего 150)", "Снаряды пробивают +1 цель", "Тяжёлая плазма"],
    color: "#f59e0b",
  },
  {
    id: "tempest",
    name: "Корвет «Вортекс»",
    subtitle: "Штормовой энергоистребитель",
    icon: "⚡",
    description: "Концентрирует электромагнитную ярость, нанося сокрушительные критические цепные удары.",
    perks: ["+25% шанс крит. урона", "+75% критический урон", "Врождённые цепные молнии", "+25% скорость снарядов"],
    color: "#a855f7",
  },
  {
    id: "commander",
    name: "Флагман «Орбитал»",
    subtitle: "Командный авианосец флота",
    icon: "🛸",
    description: "Командный корабль в сопровождении боевых дронов и автономных орбитальных сателлитов.",
    perks: ["Старт с 2 сателлитами", "Старт с 1 боевым дроном", "+50% радиус магнита опыта", "+20% частота огня дронов"],
    color: "#10b981",
  },
  {
    id: "void_wraith",
    name: "Призрак «Немезида»",
    subtitle: "Премиальный фазовый охотник",
    icon: "👻",
    description: "Экспериментальный корабль Бездны с фазовой защитой и самонаводящимися орудиями.",
    perks: ["Периодическая неуязвимость", "Мягкое самонаведение", "+1 пробитие", "Высокая скорость полёта"],
    color: "#e879f9",
    premium: true,
  },
];

export function applyShipClassStats(player: PlayerState, classId: ShipClassId) {
  player.shipClass = classId;

  switch (classId) {
    case "interceptor":
      player.speed = 5.6;
      player.fireRate = 10;
      player.bulletDamage = 1.3;
      player.shield = { hp: 20, maxHp: 20, regenTimer: 0, active: true };
      break;

    case "dreadnought":
      player.maxHp = 150;
      player.hp = 150;
      player.speed = 4.7;
      player.fireRate = 13;
      player.bulletDamage = 2.1;
      player.bulletSize = 4.5;
      player.piercing = 1;
      player.shield = { hp: 25, maxHp: 25, regenTimer: 0, active: true };
      break;

    case "tempest":
      player.speed = 5.4;
      player.fireRate = 11;
      player.bulletDamage = 1.2;
      player.bulletSpeed = 15.5;
      player.critChance = 0.25;
      player.critMultiplier = 2.75;
      player.lightningChance = 0.25;
      player.lightningChain = 2;
      player.shield = { hp: 15, maxHp: 15, regenTimer: 0, active: true };
      break;

    case "commander":
      player.speed = 5.2;
      player.fireRate = 12;
      player.bulletDamage = 1.2;
      player.magnetRange = 160;
      player.satellites = [
        { angle: 0, radius: 75, speed: 0.035, level: 1, shootTimer: 0 },
        { angle: Math.PI, radius: 75, speed: 0.035, level: 1, shootTimer: 20 },
      ];
      player.drones = [
        { id: 999, pos: { x: player.pos.x, y: player.pos.y }, angle: 0, orbitAngle: 0, orbitRadius: 110, speed: 2.2, shootTimer: 0, level: 1 },
      ];
      player.shield = { hp: 15, maxHp: 15, regenTimer: 0, active: true };
      break;

    case "void_wraith":
      player.maxHp = 85;
      player.hp = 85;
      player.speed = 5.9;
      player.fireRate = 11;
      player.bulletDamage = 1.35;
      player.bulletSpeed = 14.5;
      player.piercing = 1;
      player.homing = true;
      player.homingStrength = 0.065;
      player.ghostMode = true;
      player.shield = { hp: 18, maxHp: 18, regenTimer: 0, active: true };
      break;
  }
}
