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
  if (wave === 9) return ["stealth", "charger", "bomber", "splitter"];
  if (wave === 10) return ["boss_mothership"];
  if (wave === 11) return ["tank", "healer", "charger", "spinner"];
  if (wave === 12) return ["artillery", "stealth", "splitter", "kamikaze"];
  if (wave === 13) return ["tank", "artillery", "healer", "charger"];
  if (wave === 14) return ["scout", "fighter", "bomber", "sniper", "tank", "splitter", "kamikaze", "spinner", "charger", "artillery"];
  if (wave % 5 === 0) return [getBossType(wave)];

  // After wave 15 regular waves must contain regular enemies only. Previously
  // every wave >= 15 returned boss_dreadnought, so wave 16 queued 15 bosses.
  const lateWavePools: EnemyType[][] = [
    ["tank", "artillery", "charger", "fighter", "spinner"],
    ["stealth", "healer", "sniper", "kamikaze", "splitter"],
    ["artillery", "tank", "bomber", "charger", "healer"],
  ];
  return lateWavePools[Math.floor((wave - 16) / 2) % lateWavePools.length];
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
  const scale = 1 + (wave - 1) * 0.08;

  switch (type) {
    case "scout":
      return { type, hp: 3.5 * scale, speed: 1.2, shootInterval: 130, movePattern: "sine", xp: 6, isBoss: false, shieldHp: 0, drops: false };
    case "fighter":
      return { type, hp: 7.0 * scale, speed: 1.25, shootInterval: 95, movePattern: "sine", xp: 11, isBoss: false, shieldHp: 0, drops: false };
    case "bomber":
      return { type, hp: 13.0 * scale, speed: 0.75, shootInterval: 75, movePattern: "hover", xp: 18, isBoss: false, shieldHp: 0, drops: false };
    case "sniper":
      return { type, hp: 5.5 * scale, speed: 0.8, shootInterval: 100, movePattern: "hover", xp: 15, isBoss: false, shieldHp: 0, drops: false };
    case "tank":
      return { type, hp: 26.0 * scale, speed: 0.5, shootInterval: 90, movePattern: "patrol", xp: 28, isBoss: false, shieldHp: 6, drops: true };
    case "splitter":
      return { type, hp: 8.0 * scale, speed: 1.0, shootInterval: 110, movePattern: "zigzag", xp: 16, isBoss: false, shieldHp: 0, drops: true };
    case "kamikaze":
      return { type, hp: 4.5 * scale, speed: 2.5, shootInterval: 999, movePattern: "dive", xp: 10, isBoss: false, shieldHp: 0, drops: false };
    case "spinner":
      return { type, hp: 12.0 * scale, speed: 1.0, shootInterval: 50, movePattern: "circle", xp: 24, isBoss: false, shieldHp: 0, drops: true };
    case "stealth":
      return { type, hp: 7.0 * scale, speed: 1.5, shootInterval: 90, movePattern: "sine", xp: 22, isBoss: false, shieldHp: 0, drops: true };
    case "charger":
      return { type, hp: 14.0 * scale, speed: 2.1, shootInterval: 130, movePattern: "dive", xp: 26, isBoss: false, shieldHp: 0, drops: true };
    case "healer":
      return { type, hp: 9.0 * scale, speed: 0.85, shootInterval: 100, movePattern: "hover", xp: 28, isBoss: false, shieldHp: 0, drops: true };
    case "artillery":
      return { type, hp: 14.0 * scale, speed: 0.45, shootInterval: 80, movePattern: "hover", xp: 32, isBoss: false, shieldHp: 0, drops: true };

    case "boss_destroyer":
      return { type, hp: 240 * scale, speed: 0.7, shootInterval: 42, movePattern: "hover", xp: 250, isBoss: true, shieldHp: 40, drops: true };
    case "boss_mothership":
      return { type, hp: 460 * scale, speed: 0.55, shootInterval: 35, movePattern: "hover", xp: 450, isBoss: true, shieldHp: 70, drops: true };
    case "boss_dreadnought":
      return { type, hp: 780 * scale, speed: 0.6, shootInterval: 28, movePattern: "hover", xp: 750, isBoss: true, shieldHp: 100, drops: true };
    case "boss_eclipse":
      return { type, hp: 1200 * scale, speed: 0.75, shootInterval: 24, movePattern: "hover", xp: 1100, isBoss: true, shieldHp: 130, drops: true };
    case "boss_titan":
      return { type, hp: 1800 * scale, speed: 0.65, shootInterval: 20, movePattern: "hover", xp: 1600, isBoss: true, shieldHp: 160, drops: true };
    case "boss_omega":
      return { type, hp: 3000 * scale, speed: 0.85, shootInterval: 16, movePattern: "hover", xp: 2500, isBoss: true, shieldHp: 220, drops: true };
    default:
      return { type, hp: 5, speed: 1, shootInterval: 120, movePattern: "sine", xp: 8, isBoss: false, shieldHp: 0, drops: false };
  }
}

export function spawnEnemy(type: EnemyType, wave: number): Enemy {
  const def = getEnemyDef(type, wave);
  const size = getEnemySize(type);
  const minX = size + 40;
  const maxX = W - size - 40;
  const centerX = randRange(minX + 50, maxX - 50);
  const targetY = def.isBoss ? 130 : randRange(85, Math.min(H * 0.45, 330));

  const isElite = !def.isBoss && wave >= 3 && Math.random() < 0.15;
  const hpMult = isElite ? 2.5 : 1;
  const xpMult = isElite ? 3 : 1;
  const eliteNames = ["⚡ СВЕРХСКОРОСТНОЙ", "🛡️ БРОНИРОВАННЫЙ", "🔥 ИНФЕРНО", "☣️ ТОКСИЧНЫЙ"];
  const eliteName = isElite ? eliteNames[Math.floor(Math.random() * eliteNames.length)] : undefined;

  return {
    id: uid(),
    pos: { x: centerX, y: -60 },
    vel: { x: (Math.random() > 0.5 ? 1 : -1) * def.speed, y: def.speed * 0.9 },
    hp: def.hp * hpMult,
    maxHp: def.hp * hpMult,
    type: def.type,
    shootTimer: randInt(25, def.shootInterval),
    shootInterval: isElite ? Math.floor(def.shootInterval * 0.75) : def.shootInterval,
    isBoss: def.isBoss,
    isElite,
    eliteName,
    phase: 0,
    angle: 0,
    radius: Math.min(80, (maxX - minX) / 4),
    centerX,
    centerY: targetY,
    targetY,
    movePattern: def.movePattern,
    patternTimer: randRange(0, 100),
    shieldHp: (def.shieldHp + (isElite ? 10 : 0)),
    maxShieldHp: (def.shieldHp + (isElite ? 10 : 0)),
    frozen: 0,
    burning: 0,
    poisoned: 0,
    drops: def.drops || isElite,
    xp: def.xp * xpMult,
  };
}

export function spawnBoss(wave: number): Enemy {
  const type = getBossType(wave);
  const e = spawnEnemy(type, wave);
  e.pos = { x: W / 2, y: -120 };
  e.targetY = 140;
  e.centerX = W / 2;
  e.centerY = 140;
  return e;
}

export function getWaveComposition(wave: number): { type: EnemyType; count: number }[] {
  if (isBossWave(wave)) return [];

  if (wave === 1) return [{ type: "scout", count: 10 }];
  if (wave === 2) return [{ type: "scout", count: 8 }, { type: "fighter", count: 5 }];
  if (wave === 3) return [{ type: "scout", count: 7 }, { type: "fighter", count: 6 }, { type: "splitter", count: 4 }];
  if (wave === 4) return [{ type: "fighter", count: 8 }, { type: "splitter", count: 5 }, { type: "bomber", count: 4 }];
  if (wave === 6) return [{ type: "fighter", count: 9 }, { type: "sniper", count: 4 }, { type: "bomber", count: 4 }];
  if (wave === 7) return [{ type: "fighter", count: 8 }, { type: "kamikaze", count: 6 }, { type: "sniper", count: 4 }];
  if (wave === 8) return [{ type: "tank", count: 6 }, { type: "spinner", count: 6 }, { type: "fighter", count: 8 }];
  if (wave === 9) return [{ type: "stealth", count: 7 }, { type: "charger", count: 6 }, { type: "bomber", count: 5 }, { type: "splitter", count: 5 }];

  // Defensive filter: a malformed late-wave pool can never mass-spawn bosses.
  const types = getWaveEnemyTypes(wave).filter(type => !type.startsWith("boss_"));
  const baseCount = Math.min(48, 10 + Math.floor(wave * 2.2));
  const result: { type: EnemyType; count: number }[] = [];

  const leadType = types[0] || "scout";
  const leadCount = Math.max(4, Math.floor(baseCount * 0.35));
  result.push({ type: leadType, count: leadCount });

  const extras = types.slice(1);
  if (extras.length > 0) {
    const remaining = baseCount - leadCount;
    const perType = Math.max(2, Math.floor(remaining / Math.min(extras.length, 4)));
    for (let i = 0; i < extras.length && i < 4; i++) {
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
    case "boss_destroyer": return 52;
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
    case "boss_destroyer":  return "ЭСМИНЕЦ «РАЗРУШИТЕЛЬ»";
    case "boss_mothership": return "КОРАБЛЬ-МАТКА «ЛЕВИАФАН»";
    case "boss_dreadnought":return "ДРЕДНОУТ «ВЛАДЫКА ПУСТОТЫ»";
    case "boss_eclipse":    return "ТЕМНОЕ ЯДРО «ЗАТМЕНИЕ»";
    case "boss_titan":      return "ДРЕВНИЙ «ТИТАН»";
    case "boss_omega":      return "ОМЕГА — АБСОЛЮТНЫЙ ФИНАЛ";
    default: return "ФЛАГМАН ВРАГА";
  }
}
