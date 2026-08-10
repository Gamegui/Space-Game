import type { ShipClassDef, ShipClassId, PlayerState } from "./types";

export const SHIP_CLASSES: ShipClassDef[] = [
  {
    id: "interceptor",
    name: "Apex Interceptor",
    subtitle: "Tactical Strike Fighter",
    icon: "🚀",
    description: "Agile, high-rate-of-fire starfighter equipped with tactical energy shielding.",
    perks: ["+15% Movement Speed", "+10% Rapid Fire", "Starts with 20 Energy Shield", "Balanced Maneuvering"],
    color: "#38bdf8",
  },
  {
    id: "dreadnought",
    name: "Titan Dreadnought",
    subtitle: "Heavy Armored Battleship",
    icon: "🛡️",
    description: "Impenetrable hull with high-caliber heavy rounds that punch through enemy armor.",
    perks: ["+60% Bullet Damage", "+50 Max HP (150 Total)", "Inherent +1 Bullet Pierce", "Heavy Shells"],
    color: "#f59e0b",
  },
  {
    id: "tempest",
    name: "Vortex Tempest",
    subtitle: "High-Energy Stormcraft",
    icon: "⚡",
    description: "Harnesses raw electromagnetic fury, delivering devastating critical chain strikes.",
    perks: ["+25% Critical Hit Chance", "+75% Critical Damage", "Inherent 25% Chain Lightning", "+25% Bullet Velocity"],
    color: "#a855f7",
  },
  {
    id: "commander",
    name: "Orbital Command",
    subtitle: "Fleet Support Carrier",
    icon: "🛸",
    description: "Command ship surrounded by autonomous combat drones and orbital gun platforms.",
    perks: ["Starts with 2 Orbital Satellites", "Starts with 1 Combat Drone", "Extended +50% Magnet Range", "+20% Companion Rate"],
    color: "#10b981",
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
  }
}
