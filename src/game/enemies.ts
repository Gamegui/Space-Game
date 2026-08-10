import type { Enemy, EnemyType, MovePattern } from "./types";

let _eid = 10000;
const uid = () => ++_eid;

function randRange(a: number, b: number) { return a + Math.random() * (b - a); }
function randInt(a: number, b: number) { return Math.floor(randRange(a, b)); }

export const W = 960;
export const H = 720;

export interface EnemyDef {
  type: EnemyType;
  hp: number;
  speed: number;
  shootInterval: number;
  movePattern: MovePattern;
  xp: number;
  isBoss: boolean;
  shieldHp: number;
  drops: boolean;
}

export function getWaveEnemyTypes(wave: number): EnemyType[] {
  if (wave === 1) return ["scout"];
  if (wave === 2) return ["scout", "fighter"];
  if (wave === 3) return ["scout", "fighter", "splitter"];
  if (wave === 4) return ["fighter", "splitter", "bomber"];
  if (wave === 5) return ["boss_destroyer"];
  if (wave === 6) return ["fighter", "bomber", "sniper"];
  if (wave === 7) return ["fighter", "sniper", "kamikaze"];
  if (wave === 8) return ["tank", "spinner", "fighter"];
  if (wave === 9) return ["stealth", "charger", "bomber"];
  if (wave === 10) return ["boss_mothership"];
  if (wave === 11) return ["tank", "healer", "charger", "spinner"];
  if (wave === 12) return ["artillery", "stealth", "splitter", "kamikaze"];
  if (wave === 13) return ["tank", "artillery", "healer", "charger"];
  if (wave === 14) return ["scout", "fighter", "bomber", "sniper", "tank", "splitter", "kamikaze", "spinner", "charger", "artillery"];
  return ["boss_dreadnought"];
}

export function isBossWave(wave: number): boolean {
  return wave % 5 === 0;
}

export function getBossType(wave: number): EnemyType {
  const bossWaveIndex = Math.floor(wave / 5);
  const bosses: EnemyType[] = [
    "boss_destroyer",
    "boss_mothership",
    "boss_dreadnought",
    "boss_eclipse",
    "boss_titan",
    "boss_omega",
  ];
  return bosses[Math.min(bossWaveIndex - 1, bosses.length - 1)];
}

export function getEnemyDef(type: EnemyType, wave: number): EnemyDef {
  // Smooth, fair scaling per wave
  const scale = 1 + (wave - 1) * 0.05;

  switch (type) {
    case "scout":
      return { type, hp: 2.5 * scale, speed: 1.0, shootInterval: 160, movePattern: "straight", xp: 8, isBoss: false, shieldHp: 0, drops: false };
    case "fighter":
      return { type, hp: 5.0 * scale, speed: 1.1, shootInterval: 120, movePattern: "sine", xp: 14, isBoss: false, shieldHp: 0, drops: false };
    case "bomber":
      return { type, hp: 8.0 * scale, speed: 0.7, shootInterval: 90, movePattern: "straight", xp: 22, isBoss: false, shieldHp: 0, drops: false };
    case "sniper":
      return { type, hp: 4.0 * scale, speed: 0.7, shootInterval: 130, movePattern: "hover", xp: 18, isBoss: false, shieldHp: 0, drops: false };
    case "tank":
      return { type, hp: 16.0 * scale, speed: 0.45, shootInterval: 110, movePattern: "straight", xp: 30, isBoss: false, shieldHp: 3, drops: true };
    case "splitter":
      return { type, hp: 6.0 * scale, speed: 0.9, shootInterval: 130, movePattern: "zigzag", xp: 20, isBoss: false, shieldHp: 0, drops: true };
    case "kamikaze":
      return { type, hp: 3.0 * scale, speed: 2.0, shootInterval: 999, movePattern: "dive", xp: 12, isBoss: false, shieldHp: 0, drops: false };
    case "spinner":
      return { type, hp: 9.0 * scale, speed: 0.9, shootInterval: 60, movePattern: "circle", xp: 28, isBoss: false, shieldHp: 0, drops: true };
    case "stealth":
      return { type, hp: 5.5 * scale, speed: 1.3, shootInterval: 110, movePattern: "sine", xp: 25, isBoss: false, shieldHp: 0, drops: true };
    case "charger":
      return { type, hp: 10.0 * scale, speed: 1.8, shootInterval: 160, movePattern: "dive", xp: 30, isBoss: false, shieldHp: 0, drops: true };
    case "healer":
      return { type, hp: 6.0 * scale, speed: 0.8, shootInterval: 120, movePattern: "hover", xp: 32, isBoss: false, shieldHp: 0, drops: true };
    case "artillery":
      return { type, hp: 10.0 * scale, speed: 0.4, shootInterval: 90, movePattern: "hover", xp: 35, isBoss: false, shieldHp: 0, drops: true };

    case "boss_destroyer":
      return { type, hp: 120 * scale, speed: 0.6, shootInterval: 50, movePattern: "sine", xp: 300, isBoss: true, shieldHp: 25, drops: true };
    case "boss_mothership":
      return { type, hp: 220 * scale, speed: 0.5, shootInterval: 40, movePattern: "hover", xp: 500, isBoss: true, shieldHp: 40, drops: true };
    case "boss_dreadnought":
      return { type, hp: 380 * scale, speed: 0.55, shootInterval: 35, movePattern: "zigzag", xp: 800, isBoss: true, shieldHp: 60, drops: true };
    case "boss_eclipse":
      return { type, hp: 600 * scale, speed: 0.7, shootInterval: 30, movePattern: "circle", xp: 1200, isBoss: true, shieldHp: 80, drops: true };
    case "boss_titan":
      return { type, hp: 900 * scale, speed: 0.6, shootInterval: 25, movePattern: "sine", xp: 1800, isBoss: true, shieldHp: 100, drops: true };
    case "boss_omega":
      return { type, hp: 1500 * scale, speed: 0.8, shootInterval: 20, movePattern: "circle", xp: 3000, isBoss: true, shieldHp: 150, drops: true };
    default:
      return { type, hp: 4, speed: 1, shootInterval: 120, movePattern: "straight", xp: 8, isBoss: false, shieldHp: 0, drops: false };
  }
}

export function spawnEnemy(type: EnemyType, wave: number): Enemy {
  const def = getEnemyDef(type, wave);
  const centerX = randRange(80, W - 80);
  return {
    id: uid(),
    pos: { x: centerX, y: def.isBoss ? -90 : randRange(-120, -40) },
    vel: { x: randRange(-0.8, 0.8) * def.speed, y: def.speed * 0.55 },
    hp: def.hp,
    maxHp: def.hp,
    type: def.type,
    shootTimer: randInt(40, def.shootInterval),
    shootInterval: def.shootInterval,
    isBoss: def.isBoss,
    phase: 0,
    angle: 0,
    radius: 120,
    centerX,
    movePattern: def.movePattern,
    patternTimer: 0,
    shieldHp: def.shieldHp,
    maxShieldHp: def.shieldHp,
    frozen: 0,
    burning: 0,
    poisoned: 0,
    drops: def.drops,
    xp: def.xp,
  };
}

export function spawnBoss(wave: number): Enemy {
  const type = getBossType(wave);
  const e = spawnEnemy(type, wave);
  e.pos = { x: W / 2, y: -100 };
  return e;
}

export function getWaveComposition(wave: number): { type: EnemyType; count: number }[] {
  if (isBossWave(wave)) return [];

  // Wave 1: Gentle warmup with scouts, gives player 2-3 instant upgrades
  if (wave === 1) {
    return [{ type: "scout", count: 8 }];
  }
  // Wave 2: Scouts + Fighters
  if (wave === 2) {
    return [
      { type: "scout", count: 6 },
      { type: "fighter", count: 4 },
    ];
  }
  // Wave 3: Scouts + Fighters + Splitters
  if (wave === 3) {
    return [
      { type: "scout", count: 6 },
      { type: "fighter", count: 5 },
      { type: "splitter", count: 3 },
    ];
  }
  // Wave 4: Fighters + Splitters + Bombers
  if (wave === 4) {
    return [
      { type: "fighter", count: 6 },
      { type: "splitter", count: 4 },
      { type: "bomber", count: 3 },
    ];
  }

  const types = getWaveEnemyTypes(wave);
  const baseCount = 7 + Math.floor(wave * 1.5);
  const result: { type: EnemyType; count: number }[] = [];

  // Always have a frontline group
  const leadType = types[0] || "scout";
  const leadCount = Math.max(3, Math.floor(baseCount * 0.35));
  result.push({ type: leadType, count: leadCount });

  const extras = types.slice(1);
  if (extras.length > 0) {
    const remaining = baseCount - leadCount;
    const perType = Math.max(1, Math.floor(remaining / Math.min(extras.length, 3)));
    for (let i = 0; i < extras.length && i < 3; i++) {
      result.push({ type: extras[i], count: perType });
    }
  }

  return result;
}

export function getEnemyColors(type: EnemyType): [string, string, string] {
  switch (type) {
    case "scout":      return ["#f87171", "#ef4444", "#fca5a5"];
    case "fighter":    return ["#fb923c", "#f97316", "#fdba74"];
    case "bomber":     return ["#facc15", "#eab308", "#fde047"];
    case "sniper":     return ["#a3e635", "#84cc16", "#d9f99d"];
    case "tank":       return ["#60a5fa", "#3b82f6", "#93c5fd"];
    case "splitter":   return ["#f472b6", "#ec4899", "#f9a8d4"];
    case "kamikaze":   return ["#ff6b6b", "#ff0000", "#ff9999"];
    case "spinner":    return ["#c084fc", "#a855f7", "#d8b4fe"];
    case "stealth":    return ["#64748b", "#475569", "#94a3b8"];
    case "charger":    return ["#f97316", "#ea580c", "#fb923c"];
    case "healer":     return ["#4ade80", "#22c55e", "#86efac"];
    case "artillery":  return ["#38bdf8", "#0ea5e9", "#7dd3fc"];
    case "boss_destroyer":  return ["#ef4444", "#b91c1c", "#fca5a5"];
    case "boss_mothership": return ["#8b5cf6", "#7c3aed", "#c4b5fd"];
    case "boss_dreadnought":return ["#f59e0b", "#d97706", "#fde68a"];
    case "boss_eclipse":    return ["#06b6d4", "#0891b2", "#a5f3fc"];
    case "boss_titan":      return ["#ec4899", "#db2777", "#f9a8d4"];
    case "boss_omega":      return ["#f43f5e", "#e11d48", "#fda4af"];
    default: return ["#fff", "#ccc", "#eee"];
  }
}

export function getEnemySize(type: EnemyType): number {
  switch (type) {
    case "tank": return 32;
    case "bomber": return 28;
    case "charger": return 26;
    case "healer": return 22;
    case "artillery": return 24;
    case "boss_destroyer": return 50;
    case "boss_mothership": return 65;
    case "boss_dreadnought": return 70;
    case "boss_eclipse": return 75;
    case "boss_titan": return 80;
    case "boss_omega": return 90;
    default: return 20;
  }
}

export function getBossName(type: EnemyType): string {
  switch (type) {
    case "boss_destroyer":  return "DESTROYER CLASS";
    case "boss_mothership": return "MOTHERSHIP";
    case "boss_dreadnought":return "DREADNOUGHT";
    case "boss_eclipse":    return "ECLIPSE";
    case "boss_titan":      return "TITAN";
    case "boss_omega":      return "OMEGA — THE END";
    default: return "BOSS";
  }
}
