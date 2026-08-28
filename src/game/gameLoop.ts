import type {
  PlayerState, Bullet, Enemy, Particle, Mine, Lightning,
  Vec2, Star, XpOrb, FloatingText, PowerupItem, PowerupType, ShipClassId
} from "./types";

import { spawnEnemy, getEnemySize } from "./enemies";
import type { EnemyType } from "./types";
import { getUpgradeLevel } from "./upgrades";
import { audio } from "./audio";
import { applyShipClassStats } from "./shipClasses";

export const W = 960;
export const H = 720;
let _id = 100000;
let runtimePerformanceTier: 0 | 1 | 2 = 2;
export const uid = () => ++_id;

export function randRange(a: number, b: number) { return a + Math.random() * (b - a); }
export function randInt(a: number, b: number)   { return Math.floor(randRange(a, b)); }

export function makeStars(): Star[] {
  return Array.from({ length: 180 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    z: Math.random() * 3.5 + 0.5,
    speed: Math.random() * 0.5 + 0.3,
  }));
}

export function getNextLevelXp(level: number): number {
  if (level === 1) return 30;
  if (level === 2) return 65;
  if (level === 3) return 110;
  if (level === 4) return 170;
  if (level === 5) return 240;
  if (level <= 10) return Math.floor(240 * Math.pow(1.18, level - 5));

  // The old permanent ×1.25 curve required ~6,800 XP at level 20 and grew to
  // tens of thousands shortly afterwards. A quadratic late curve keeps roughly
  // one meaningful upgrade per wave without making endless levels free.
  const lateLevel = level - 10;
  return Math.floor(550 + lateLevel * 105 + lateLevel * lateLevel * 7);
}

export function makeInitialPlayer(shipClass: ShipClassId = "interceptor"): PlayerState {
  const p: PlayerState = {
    shipClass,
    pos: { x: W / 2, y: H - 100 },
    hp: 100, maxHp: 100,
    speed: 5.4,
    fireRate: 11,
    bulletDamage: 1.3,
    bulletSpeed: 14,
    bulletSize: 3.5,
    piercing: 0,
    multishot: 0,
    spreadAngle: 0,
    homing: false,
    homingStrength: 0.06,
    satellites: [],
    drones: [],
    shield: { hp: 20, maxHp: 20, regenTimer: 0 },
    xp: 0, level: 1, xpToNext: 30,
    upgrades: [],
    synergies: [],
    invincTimer: 0,
    magnetRange: 120,
    aura: false, auraDamage: 0.25, auraTimer: 0,
    lasers: 0, laserTimer: 0,
    rearShot: false,
    explosiveBullets: false, explosionRadius: 60,
    ricochet: false, ricochetCount: 0,
    mineCount: 0, mineTimer: 0,
    // Chrono-slow is a core ability advertised in the controls, not a hidden upgrade.
    timeSlow: true, timeSlowTimer: 0, timeSlowCooldown: 0,
    critChance: 0.05, critMultiplier: 2,
    lifeSteal: 0,
    burnChance: 0, freezeChance: 0, poisonChance: 0,
    lightningChance: 0, lightningChain: 1,
    goldMultiplier: 1,
    regenRate: 0,
    regenTimer: 0,
    ghostMode: false, ghostTimer: 0,
    voidSouls: 0, voidSoulIdleTimer: 0,
    voidEchoTimer: 0, voidEchoPos: { x: W / 2, y: H - 100 },
    blackHole: false, blackHoleTimer: 0, blackHoleCooldown: 0,
    nukeCharges: 1,
    nukeCooldown: 0,
    dashCooldown: 0,
    dashTimer: 0,
    mirrorShots: false,
    spiralShot: false, spiralAngle: 0,
    waveShot: false, waveShotTimer: 0,
    snipeMode: false, rapidMode: false,
    rapidBoostTimer: 0,
    chainDetonation: false, chainDetonationRadius: 80,
    phaseDischarge: false, phaseDischargeCount: 0,
    livingShield: false, livingShieldAmount: 0,
    sniperProtocol: false, sniperBonus: 0,
    battleMagnet: false, battleMagnetChance: 0,
    overload: false, overloadDamage: 0, overloadTimer: 0,
    score: 0, kills: 0,
    combo: 0, comboTimer: 0,
    stats: {
      damageDealt: 0,
      shotsFired: 0,
      shotsHit: 0,
      elitesKilled: 0,
      bossesKilled: 0,
      powerupsCollected: 0,
    },
  };

  applyShipClassStats(p, shipClass);
  return p;
}

export function makeXpOrb(pos: Vec2, value: number): XpOrb {
  return {
    id: uid(),
    pos: { x: pos.x + randRange(-10, 10), y: pos.y + randRange(-10, 10) },
    vel: { x: randRange(-1.5, 1.5), y: randRange(-2, 0.5) },
    value,
    attracted: true,
  };
}

export function makeFloatingText(pos: Vec2, text: string, color: string, isCrit = false): FloatingText {
  return {
    id: uid(),
    pos: { x: pos.x + randRange(-8, 8), y: pos.y + randRange(-6, 6) },
    vel: { x: randRange(-0.8, 0.8), y: -1.8 },
    text,
    color,
    size: isCrit ? 18 : 13,
    life: isCrit ? 45 : 35,
    maxLife: isCrit ? 45 : 35,
    isCrit,
  };
}

export function makePowerup(pos: Vec2, type: PowerupType): PowerupItem {
  return {
    id: uid(),
    pos: { x: pos.x, y: pos.y },
    vel: { x: randRange(-1, 1), y: randRange(-1, 0.5) },
    type,
    life: 600,
  };
}

function makeBurst(pos: Vec2, color: string, count: number, big = false): Particle[] {
  const qualityMultiplier = runtimePerformanceTier === 0 ? 0.34 : runtimePerformanceTier === 1 ? 0.65 : 1;
  const adjustedCount = Math.max(big ? 4 : 1, Math.ceil(count * qualityMultiplier));
  return Array.from({ length: adjustedCount }, () => ({
    id: uid(),
    pos: { x: pos.x, y: pos.y },
    vel: { x: randRange(-5, 5) * (big ? 1.5 : 1), y: randRange(-5, 5) * (big ? 1.5 : 1) },
    life: randRange(20, big ? 60 : 40),
    maxLife: big ? 60 : 40,
    color,
    size: randRange(big ? 4 : 2, big ? 10 : 6),
    glow: true,
    shape: "circle" as const,
  }));
}

// Quality-tier particle budget, same curve as makeBurst so the premium FX
// never overflow low-end hardware.
function voidParticleBudget(count: number): number {
  const qualityMultiplier = runtimePerformanceTier === 0 ? 0.34 : runtimePerformanceTier === 1 ? 0.65 : 1;
  return Math.max(2, Math.ceil(count * qualityMultiplier));
}

// Particles flying from a slain enemy towards the Wraith (soul devouring).
export function makeSuckParticles(from: Vec2, to: Vec2, count = 6): Particle[] {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const baseAngle = Math.atan2(dy, dx);
  const speed = 6.5 + (150 / (dist + 40)) * 4;
  const n = voidParticleBudget(count);
  return Array.from({ length: n }, () => {
    const a = baseAngle + randRange(-0.55, 0.55);
    const v = speed * randRange(0.7, 1.25);
    return {
      id: uid(),
      pos: { x: from.x + randRange(-6, 6), y: from.y + randRange(-6, 6) },
      vel: { x: Math.cos(a) * v, y: Math.sin(a) * v },
      life: 26, maxLife: 26,
      color: Math.random() < 0.5 ? "#e879f9" : "#c026d3",
      size: randRange(2.2, 4.2),
      glow: true,
      shape: "circle" as const,
    };
  });
}

// Purple shards when the Wraith's victim shatters.
export function makeShards(pos: Vec2, count = 7): Particle[] {
  const n = voidParticleBudget(count);
  return Array.from({ length: n }, () => {
    const a = randRange(0, Math.PI * 2);
    const v = randRange(2, 6);
    return {
      id: uid(),
      pos: { x: pos.x, y: pos.y },
      vel: { x: Math.cos(a) * v, y: Math.sin(a) * v },
      life: randRange(18, 34), maxLife: 34,
      color: Math.random() < 0.6 ? "#e879f9" : "#a855f7",
      size: randRange(1.8, 3.8),
      glow: true,
      shape: "square" as const,
    };
  });
}

// One-shot ring used when the Wraith first materializes into the arena.
export function makeMaterializeBurst(pos: Vec2): Particle[] {
  const total = voidParticleBudget(26);
  const out: Particle[] = [];
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2;
    const v = randRange(3, 7);
    out.push({
      id: uid(),
      pos: { x: pos.x, y: pos.y },
      vel: { x: Math.cos(a) * v, y: Math.sin(a) * v },
      life: randRange(30, 55), maxLife: 55,
      color: i % 2 === 0 ? "#e879f9" : "#7c3aed",
      size: randRange(2, 5),
      glow: true,
      shape: i % 3 === 0 ? "ring" : "circle",
    });
  }
  return out;
}

// ─── Void Wraith premium kit ─────────────────────────────────────────────────
export const VOID_SOUL_MAX = 20;
export const VOID_SOUL_DECAY_FRAMES = 600; // lose a soul after 10 s without a kill
export const VOID_SOUL_RADIUS = 220;

// Exported so screen-clearing abilities (the tactical nuke) can feed the
// Wraith as well. `gained` reports how many souls were actually added.
export function devourSoul(
  player: PlayerState,
  e: { pos: Vec2; isBoss: boolean; isElite?: boolean },
  particles: Particle[],
  floatingTexts: FloatingText[],
): number {
  if (player.shipClass !== "void_wraith") return 0;
  const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
  if (dx * dx + dy * dy > VOID_SOUL_RADIUS * VOID_SOUL_RADIUS) return 0;
  if (player.voidSouls >= VOID_SOUL_MAX) return 0;
  const value = e.isBoss ? 5 : (e.isElite ? 2 : 1);
  player.voidSouls = Math.min(VOID_SOUL_MAX, player.voidSouls + value);
  player.voidSoulIdleTimer = 0;
  particles.push(...makeSuckParticles(e.pos, player.pos, e.isBoss ? 14 : 10));
  const soulWord = value === 1 ? "ДУША" : (value === 5 ? "ДУШ" : "ДУШИ");
  floatingTexts.push({
    id: uid(),
    pos: { x: e.pos.x, y: e.pos.y - 14 },
    vel: { x: 0, y: -0.9 },
    text: `+${value} ${soulWord}`,
    color: "#e879f9",
    size: e.isBoss ? 18 : 13,
    life: 50, maxLife: 50,
  });
  return value;
}

function soulDamageMult(player: PlayerState): number {
  return 1 + player.voidSouls * 0.015;
}

// Phase window: opens in place (no teleport — owner playtest: relocations
// only disorient). The Wraith glows and is untouchable for the whole window
// while a fading echo clone behind it keeps firing 80%-damage bolts.
function startVoidPhase(player: PlayerState, particles: Particle[]) {
  const origin = { x: player.pos.x, y: player.pos.y };
  player.voidEchoPos = { x: origin.x, y: Math.min(H - 40, origin.y + 34) };
  particles.push(...makeBurst(origin, "#e879f9", 14));
  player.voidEchoTimer = 120;
  audio.playVoidBlink();
}

// ─── Main step function ───────────────────────────────────────────────────────
export interface GameObjects {
  player: PlayerState;
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  xpOrbs: XpOrb[];
  mines: Mine[];
  lightnings: Lightning[];
  stars: Star[];
  floatingTexts: FloatingText[];
  powerups: PowerupItem[];
  blackHolePos: Vec2 | null;
  blackHoleTimer: number;
  explosions: { id: number; pos: Vec2; radius: number; progress: number }[];
  waveEnemyQueue: { type: EnemyType; count: number }[];
  waveSpawnTimer: number;
  bossActive: boolean;
  boss: Enemy | null;
  waveTimer: number;
  screenShake: number;
  powerRating: number;
  adaptiveDifficulty: number;
  routeXpMultiplier: number;
  routeScoreMultiplier: number;
  activeRoute: string;
  routeEffect: string;
  performanceTier: 0 | 1 | 2;
  performanceAuto: boolean;
  waveStartedFrame: number;
  guardSpawnedThisWave: boolean;
  fastClearStreak: number;
  guardEventActive: boolean;
}

export interface StepInput {
  keys: Set<string>;
  wave: number;
  frame: number;
  timeSlow: boolean;
  onLevelUp: (player: PlayerState) => void;
  onDeath: () => void;
  onBossKill: () => void;
  onWaveComplete: () => void;
  onKill: (xp: number, pos: Vec2, bossKill: boolean) => void;
}

export function stepGame(obj: GameObjects, input: StepInput): void {
  runtimePerformanceTier = obj.performanceTier;
  const { player, bullets, enemies, particles, xpOrbs, mines, lightnings, stars, floatingTexts, powerups } = obj;
  const { keys, wave, frame, timeSlow } = input;
  const timeScale = timeSlow ? 0.5 : 1;

  // Screen shake decay
  obj.screenShake = Math.max(0, obj.screenShake * 0.88 - 0.2);

  // Combo timer decay
  if (player.comboTimer > 0) {
    player.comboTimer--;
    if (player.comboTimer <= 0) {
      player.combo = 0;
    }
  }

  // Powerup rapid boost decay
  if (player.rapidBoostTimer > 0) {
    player.rapidBoostTimer--;
  }

  // ─── Stars ─────────────────────────────────────────────────────────────────
  for (const s of stars) {
    s.y += s.speed * s.z * 0.6 * timeScale;
    if (s.y > H) { s.y = -5; s.x = Math.random() * W; }
  }

  // ─── Tactical Dash Mechanic ────────────────────────────────────────────────
  player.dashCooldown = Math.max(0, player.dashCooldown - 1);
  if (player.dashTimer > 0) {
    player.dashTimer--;
  }

  const isDashing = player.dashTimer > 0;
  const dashSpeedMult = isDashing ? 2.4 : 1.0;

  if ((keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("Shift")) && player.dashCooldown <= 0) {
    player.dashCooldown = 120; // 2s cooldown
    player.dashTimer = 24;
    player.invincTimer = Math.max(player.invincTimer, 30);
    audio.playDash();
    particles.push(...makeBurst(player.pos, "#38bdf8", 18));

    // Dash now has a tactical purpose: clear nearby hostile projectiles and
    // damage enemies crossed at close range.
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      const dx = bullet.pos.x - player.pos.x, dy = bullet.pos.y - player.pos.y;
      if (!bullet.fromPlayer && dx * dx + dy * dy < 120 * 120) bullets.splice(i, 1);
    }
    for (const enemy of enemies) {
      const dx = enemy.pos.x - player.pos.x, dy = enemy.pos.y - player.pos.y;
      if (dx * dx + dy * dy < 95 * 95) damageEnemy(enemy, player.bulletDamage * 5, frame, enemies);
    }
  }

  // ─── Player movement ───────────────────────────────────────────────────────
  // Physical KeyW/A/S/D codes make movement independent from keyboard layout.
  // The chrono ability slows the world, not the player's own ship.
  // Devoured souls give the Wraith a small but visible edge in mobility.
  const spd = player.speed * dashSpeedMult * (1 + player.voidSouls * 0.004);
  if ((keys.has("ArrowLeft")  || keys.has("KeyA")) && player.pos.x > 25) player.pos.x -= spd;
  if ((keys.has("ArrowRight") || keys.has("KeyD")) && player.pos.x < W - 25) player.pos.x += spd;
  if ((keys.has("ArrowUp")    || keys.has("KeyW")) && player.pos.y > 60) player.pos.y -= spd;
  if ((keys.has("ArrowDown")  || keys.has("KeyS")) && player.pos.y < H - 32) player.pos.y += spd;

  player.pos.x = Math.max(25, Math.min(W - 25, player.pos.x));
  player.pos.y = Math.max(60, Math.min(H - 32, player.pos.y));

  // ─── Ghost mode ─────────────────────────────────────────────────────────────
  if (player.ghostMode) {
    // Positive = active phase, negative = cooldown. The previous code always
    // decremented negatives and reactivated every second frame, making the
    // player effectively immortal after obtaining Phase Shift.
    if (player.ghostTimer > 0) {
      player.ghostTimer--;
      if (player.ghostTimer === 0) player.ghostTimer = -500;
    } else if (player.ghostTimer < 0) {
      player.ghostTimer++;
    } else {
      player.ghostTimer = 120;
      // The premium Wraith's phase is an active blink with an echo clone,
      // not a silent invulnerability window.
      if (player.shipClass === "void_wraith") startVoidPhase(player, particles);
    }
  }

  // Void souls decay only while the Wraith stops feeding.
  if (player.shipClass === "void_wraith" && player.voidSouls > 0) {
    player.voidSoulIdleTimer++;
    if (player.voidSoulIdleTimer >= VOID_SOUL_DECAY_FRAMES) {
      player.voidSouls--;
      player.voidSoulIdleTimer = 0;
    }
  }

  // ─── Regeneration ──────────────────────────────────────────────────────────
  if (player.regenRate > 0) {
    player.regenTimer++;
    if (player.regenTimer >= 60) {
      player.hp = Math.min(player.hp + player.regenRate, player.maxHp);
      player.regenTimer = 0;
    }
  }

  // ─── Shield regen ──────────────────────────────────────────────────────────
  if (player.shield) {
    const shieldRegenBonus = getUpgradeLevel(player, "shield_regen") * 0.35;
    let regenRate = 1 + shieldRegenBonus;
    // The Wraith's Void Shield recharges noticeably faster than standard ones.
    if (player.shipClass === "void_wraith") regenRate *= 1.8;
    if (player.shield.hp < player.shield.maxHp) {
      player.shield.regenTimer += regenRate;
      if (player.shield.regenTimer >= 90) {
        player.shield.hp = Math.min(player.shield.hp + 4, player.shield.maxHp);
        player.shield.regenTimer = 0;
      }
    }
  }

  // ─── Invincibility ─────────────────────────────────────────────────────────
  if (player.invincTimer > 0) player.invincTimer--;

  // ─── Firing ────────────────────────────────────────────────────────────────
  player.nukeCooldown = Math.max(0, player.nukeCooldown - 1);

  player.laserTimer = Math.max(0, player.laserTimer - 1);
  player.waveShotTimer = Math.max(0, player.waveShotTimer - 1);

  // Berserker & rapid boost
  const berserker = getUpgradeLevel(player, "berserker") > 0;
  const hpPct = player.hp / player.maxHp;
  let baseRate = berserker ? player.fireRate * (0.5 + hpPct * 0.5) : player.fireRate;
  if (player.rapidBoostTimer > 0) baseRate *= 0.45;
  if (obj.routeEffect === "interference") baseRate *= 1.22;

  const effectiveFireRate = Math.max(2, Math.floor(baseRate));

  // Auto-fire continuous shooting with soft sound
  if (frame % effectiveFireRate === 0) {
    firePlayerBullets(bullets, player, enemies, frame);
    audio.playShoot(player.snipeMode);
  }

  // Phase echo: the fading clone left behind by the Wraith's blink keeps
  // firing from its original spot for the whole phase window.
  if (player.voidEchoTimer > 0) {
    player.voidEchoTimer--;
    player.voidEchoPos.x += (player.pos.x - player.voidEchoPos.x) * 0.02;
    player.voidEchoPos.y += (player.pos.y - player.voidEchoPos.y) * 0.02;
    if (frame % effectiveFireRate === 0) {
      const echoBullet = makePlayerBullet(player,
        { x: player.voidEchoPos.x, y: player.voidEchoPos.y - 20 },
        { x: 0, y: -player.bulletSpeed }
      );
      echoBullet.damage *= 0.8;
      echoBullet.color = "#d946ef";
      bullets.push(echoBullet);
    }
    if (player.voidEchoTimer === 0) particles.push(...makeBurst(player.voidEchoPos, "#a855f7", 10));
  }

  // Side lasers are a real weapon system, not a dead stat upgrade.
  if (player.lasers > 0 && player.laserTimer <= 0) {
    player.laserTimer = Math.max(12, 34 - player.lasers * 6);
    for (const side of [-1, 1]) {
      const laser = makePlayerBullet(player, { x: player.pos.x + side * 22, y: player.pos.y - 8 }, { x: side * 0.35, y: -player.bulletSpeed * 1.45 });
      laser.damage = player.bulletDamage * (0.55 + player.lasers * 0.15);
      laser.pierce = Math.max(laser.pierce, 2);
      laser.size = 2.5 + player.lasers;
      laser.color = "#fb7185";
      bullets.push(laser);
    }
  }

  // Spiral shot auto-fires
  if (player.spiralShot) {
    player.spiralAngle += 0.08;
    if (frame % 8 === 0) {
      bullets.push(makePlayerBullet(player,
        { x: player.pos.x, y: player.pos.y },
        { x: Math.cos(player.spiralAngle) * player.bulletSpeed, y: Math.sin(player.spiralAngle) * player.bulletSpeed }
      ));
    }
  }

  // Wave shot
  if (player.waveShot && player.waveShotTimer <= 0) {
    player.waveShotTimer = 180;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      bullets.push(makePlayerBullet(player,
        { ...player.pos },
        { x: Math.cos(a) * player.bulletSpeed * 0.8, y: Math.sin(a) * player.bulletSpeed * 0.8 }
      ));
    }
  }

  // ─── Satellites ────────────────────────────────────────────────────────────
  for (const sat of player.satellites) {
    sat.angle += sat.speed * timeScale;
    sat.shootTimer--;
    const satFireRate = Math.max(20, 55 - sat.level * 5);
    if (sat.shootTimer <= 0) {
      sat.shootTimer = satFireRate;
      const sx = player.pos.x + Math.cos(sat.angle) * sat.radius;
      const sy = player.pos.y + Math.sin(sat.angle) * sat.radius;
      let nearest: Enemy | null = null;
      let nearDist = 9999;
      for (const e of enemies) {
        const dx = e.pos.x - sx, dy = e.pos.y - sy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearDist) { nearDist = d; nearest = e; }
      }
      if (nearest) {
        const dx = nearest.pos.x - sx, dy = nearest.pos.y - sy;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const dmg = player.bulletDamage * (0.55 + sat.level * 0.35);
        bullets.push({
          id: uid(), pos: { x: sx, y: sy },
          vel: { x: (dx / dist) * 11, y: (dy / dist) * 11 },
          fromPlayer: true, damage: dmg, size: 3.5, color: "#fbbf24",
          pierce: 0, homing: false,
        });
      }
    }
  }

  // ─── Drones ────────────────────────────────────────────────────────────────
  for (const drone of player.drones) {
    drone.orbitAngle += 0.015 * timeScale;
    const targetX = player.pos.x + Math.cos(drone.orbitAngle) * drone.orbitRadius;
    const targetY = player.pos.y + Math.sin(drone.orbitAngle) * drone.orbitRadius;
    drone.pos.x += (targetX - drone.pos.x) * 0.08;
    drone.pos.y += (targetY - drone.pos.y) * 0.08;
    drone.angle = drone.orbitAngle;
    drone.shootTimer--;
    if (drone.shootTimer <= 0) {
      drone.shootTimer = Math.max(16, 45 - drone.level * 4);
      let nearest: Enemy | null = null;
      let nearDist = 9999;
      for (const e of enemies) {
        const dx = e.pos.x - drone.pos.x, dy = e.pos.y - drone.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearDist) { nearDist = d; nearest = e; }
      }
      if (nearest) {
        const dx = nearest.pos.x - drone.pos.x, dy = nearest.pos.y - drone.pos.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const dmg = player.bulletDamage * (0.45 + drone.level * 0.3);
        bullets.push({
          id: uid(), pos: { ...drone.pos },
          vel: { x: (dx / dist) * 10.5, y: (dy / dist) * 10.5 },
          fromPlayer: true, damage: dmg, size: 3.5, color: "#a78bfa",
          pierce: 0, homing: false,
        });
      }
    }
  }

  // ─── Aura damage ───────────────────────────────────────────────────────────
  if (player.aura) {
    player.auraTimer++;
    if (player.auraTimer % 5 === 0) {
      const auraR = 75;
      for (const e of enemies) {
        const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
        if (dx * dx + dy * dy < auraR * auraR) {
          const auraDamage = damageEnemy(e, player.auraDamage * timeScale, frame, enemies);
          player.stats.damageDealt += auraDamage;
          particles.push(...makeBurst({ x: e.pos.x, y: e.pos.y }, "#fde047", 1));
        }
      }
    }
  }

  // ─── Overload nova ───────────────────────────────────────────────────────
  if (player.overload) {
    player.overloadTimer += timeScale;
    if (player.overloadTimer >= 300) { // every 5 seconds
      player.overloadTimer = 0;
      const novaR = 110;
      for (const e of enemies) {
        const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
        if (dx * dx + dy * dy < novaR * novaR) {
          const novaDmg = damageEnemy(e, player.overloadDamage * player.bulletDamage, frame, enemies);
          player.stats.damageDealt += novaDmg;
        }
      }
      particles.push(...makeBurst(player.pos, "#f97316", 20, true));
      obj.screenShake = Math.max(obj.screenShake, 4);
    }
  }

  // ─── Mines ─────────────────────────────────────────────────────────────────
  if (player.mineCount > 0) {
    player.mineTimer--;
    if (player.mineTimer <= 0) {
      player.mineTimer = 120;
      mines.push({ id: uid(), pos: { x: player.pos.x, y: player.pos.y }, timer: 300, radius: 55 });
    }
  }
  for (let i = mines.length - 1; i >= 0; i--) {
    const mine = mines[i];
    mine.timer--;
    for (const e of enemies) {
      const dx = e.pos.x - mine.pos.x, dy = e.pos.y - mine.pos.y;
      if (dx * dx + dy * dy < mine.radius * mine.radius) {
        const mineDamage = damageEnemy(e, 6 * player.bulletDamage, frame, enemies);
        player.stats.damageDealt += mineDamage;
        particles.push(...makeBurst(mine.pos, "#f59e0b", 20, true));
        obj.explosions.push({ id: uid(), pos: { ...mine.pos }, radius: mine.radius * 1.5, progress: 0 });
        obj.screenShake = Math.max(obj.screenShake, 5);
        audio.playExplosion(false);
        mines.splice(i, 1);
        break;
      }
    }
    if (mine.timer <= 0) mines.splice(i, 1);
  }

  // ─── Black hole ────────────────────────────────────────────────────────────
  if (player.blackHole) {
    player.blackHoleCooldown = Math.max(0, player.blackHoleCooldown - 1);
    if (player.blackHoleCooldown <= 0 && enemies.length > 0) {
      obj.blackHolePos = { x: randRange(120, W - 120), y: randRange(100, H / 2) };
      obj.blackHoleTimer = 180;
      player.blackHoleCooldown = 600;
    }
  }
  if (obj.blackHoleTimer > 0) {
    obj.blackHoleTimer--;
    if (obj.blackHolePos) {
      for (const e of enemies) {
        const dx = obj.blackHolePos.x - e.pos.x, dy = obj.blackHolePos.y - e.pos.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        if (dist < 200) {
          e.pos.x += (dx / dist) * 3 * timeScale;
          e.pos.y += (dy / dist) * 3 * timeScale;
          if (dist < 25) {
            const gravityDamage = damageEnemy(e, 3 * timeScale, frame, enemies);
            player.stats.damageDealt += gravityDamage;
          }
        }
      }
    }
    if (obj.blackHoleTimer <= 0) obj.blackHolePos = null;
  }

  // Pre-declare collision sets so the early enemy-resolution loop can check them.
  const enemiesToRemove = new Set<number>();

  // Resolve enemies finished by aura, mines, status effects, black holes or a
  // dash. Previously they could remain alive at zero/negative HP until a bullet
  // touched them, which also produced broken health bars.
  // Skip enemies already handled by the bullet-collision path to avoid
  // double-counting kills (especially bosses).
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.hp > 0) continue;
    enemy.hp = 0;
    if (enemiesToRemove.has(enemy.id)) continue;
    const xpBoostLevel = getUpgradeLevel(player, "xp_boost");
    const scoreBoostXp = getUpgradeLevel(player, "score_boost");
    const xpGained = Math.floor((enemy.xp + scoreBoostXp) * (1 + xpBoostLevel * 0.25) * obj.routeXpMultiplier);
    audio.playExplosion(enemy.isBoss);
    particles.push(...makeBurst(enemy.pos, enemy.isBoss ? "#f43f5e" : "#fb923c", enemy.isBoss ? 45 : 14, enemy.isBoss));
    xpOrbs.push(makeXpOrb(enemy.pos, xpGained));
    player.score += Math.floor(enemy.xp * 10 * player.goldMultiplier * obj.routeScoreMultiplier);
    player.kills++;
    if (enemy.isElite) player.stats.elitesKilled++;
    if (enemy.isBoss) player.stats.bossesKilled++;
    // Chain Detonation for non-bullet kills (no cascade)
    if (player.chainDetonation && !enemy.isBoss) {
      const detRadius = player.chainDetonationRadius + (enemy.isElite ? 40 : 0);
      for (const other of enemies) {
        if (other.id === enemy.id) continue;
        const ddx = other.pos.x - enemy.pos.x, ddy = other.pos.y - enemy.pos.y;
        if (ddx * ddx + ddy * ddy < detRadius * detRadius) {
          const detDmg = damageEnemy(other, player.bulletDamage * 2.5, frame, enemies);
          player.stats.damageDealt += detDmg;
        }
      }
      obj.explosions.push({ id: uid(), pos: { ...enemy.pos }, radius: detRadius, progress: 0 });
      obj.screenShake = Math.max(obj.screenShake, 4);
    }
    // Living Shield for non-bullet kills
    if (player.livingShield && player.shield) {
      player.shield.hp = Math.min(player.shield.maxHp, player.shield.hp + player.livingShieldAmount);
    }
    devourSoul(player, enemy, particles, floatingTexts);
    if (player.shipClass === "void_wraith") particles.push(...makeShards(enemy.pos));
    enemies.splice(i, 1);
    input.onKill(xpGained, enemy.pos, enemy.isBoss);
  }

  // ─── Time slow cooldown ────────────────────────────────────────────────────
  player.timeSlowCooldown = Math.max(0, player.timeSlowCooldown - 1);
  player.timeSlowTimer = Math.max(0, player.timeSlowTimer - 1);

  // ─── Route-specific battlefield rules ──────────────────────────────────────
  if (obj.activeRoute === "asteroids" && frame % 105 === 0) {
    const rockCount = 2 + Math.min(2, Math.floor(wave / 20));
    for (let i = 0; i < rockCount; i++) {
      bullets.push({ id: uid(), pos: { x: randRange(35, W - 35), y: -25 }, vel: { x: randRange(-0.7, 0.7), y: randRange(3.2, 5.2) }, fromPlayer: false, damage: 1.2 + wave * 0.025, size: randRange(8, 13), color: "#a8a29e", pierce: 0, homing: false });
    }
  }
  if (obj.routeEffect === "gravity") {
    const dx = W / 2 - player.pos.x, dy = H / 2 - player.pos.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    player.pos.x += (dx / distance) * 0.16;
    player.pos.y += (dy / distance) * 0.12;
  }

  // ─── Spawn enemies ─────────────────────────────────────────────────────────
  // If a strong build clears the active squad instantly, stream the next squad
  // in instead of leaving an empty arena.
  const spawnAcceleration = enemies.length === 0 ? 6 : enemies.length <= 2 ? 3 : 1;
  obj.waveSpawnTimer = Math.max(0, obj.waveSpawnTimer - spawnAcceleration);
  if (obj.waveEnemyQueue.length > 0 && obj.waveSpawnTimer <= 0) {
    const next = obj.waveEnemyQueue[0];
    const spawned = spawnEnemy(next.type, wave, obj.adaptiveDifficulty);
    if (obj.activeRoute === "warzone" && !spawned.isBoss && Math.random() < 0.22) {
      spawned.isElite = true;
      spawned.eliteName = "⚔️ УДАРНЫЙ КОРПУС";
      spawned.hp *= 1.65;
      spawned.maxHp = spawned.hp;
      spawned.maxShieldHp += 12;
      spawned.shieldHp = spawned.maxShieldHp;
      spawned.xp *= 1.6;
    }
    enemies.push(spawned);
    next.count--;
    if (next.count <= 0) obj.waveEnemyQueue.shift();
    obj.waveSpawnTimer = Math.max(20, 50 - wave * 2);
  }

  // ─── Move & Heal enemies (STRICTLY STAY ON MAP) ───────────────────────────
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // Bosses are slowed, never fully disabled. Ordinary enemies keep the strong freeze.
    const controlResistant = e.isBoss || Boolean(e.guardRole);
    const ets = e.frozen > 0 ? (controlResistant ? Math.max(0.58, timeScale * 0.58) : 0.15) : timeScale;
    const size = getEnemySize(e.type);
    const minX = size + 25;
    const maxX = W - size - 25;
    const targetY = e.targetY || 130;

    // Healer synergy: heals nearest damaged ally
    if (e.type === "healer" && frame % 60 === 0) {
      let hurtAlly: Enemy | null = null;
      let lowestHpPct = 0.99;
      for (const other of enemies) {
        if (other.id !== e.id) {
          const hpPct = other.hp / other.maxHp;
          if (hpPct < lowestHpPct) {
            lowestHpPct = hpPct;
            hurtAlly = other;
          }
        }
      }
      if (hurtAlly) {
        hurtAlly.hp = Math.min(hurtAlly.maxHp, hurtAlly.hp + 4);
        particles.push(...makeBurst(hurtAlly.pos, "#4ade80", 4));
        lightnings.push({ id: uid(), from: { ...e.pos }, to: { ...hurtAlly.pos }, life: 10 });
      }
    }

    // The Herald visibly binds the Cortege; linked members take heavily reduced damage.
    if (e.guardRole === "herald" && frame % 12 === 0) {
      for (const linked of enemies) {
        if (linked.guardRole && linked.guardRole !== "herald" && linked.hp > 0) {
          lightnings.push({ id: uid(), from: { ...e.pos }, to: { ...linked.pos }, life: 14 });
        }
      }
    }

    // Warden periodically reinforces nearby allies with temporary shielding.
    if (e.type === "warden" && frame % 150 === 0) {
      for (const ally of enemies) {
        const dx = ally.pos.x - e.pos.x, dy = ally.pos.y - e.pos.y;
        if (ally.id !== e.id && dx * dx + dy * dy < 190 * 190) {
          ally.maxShieldHp = Math.max(ally.maxShieldHp, 18);
          ally.shieldHp = Math.min(ally.maxShieldHp, ally.shieldHp + 12);
          lightnings.push({ id: uid(), from: { ...e.pos }, to: { ...ally.pos }, life: 12 });
        }
      }
    }

    // Singularity units gently pull the player out of safe positions.
    if (e.type === "singularity" && e.pos.y >= targetY) {
      const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < 320 * 320 && distanceSq > 25 * 25) {
        const distance = Math.sqrt(distanceSq);
        player.pos.x += (dx / distance) * 0.32 * ets;
        player.pos.y += (dy / distance) * 0.32 * ets;
      }
    }

    // Entrance Glide Phase
    if (e.pos.y < targetY) {
      e.pos.y += Math.max(2.0, e.vel.y * 1.5) * ets;
      e.patternTimer += ets;
    } else {
      // Maneuver Phase inside Screen
      e.patternTimer += ets;
      const centerY = e.centerY || targetY;

      switch (e.movePattern) {
        case "sine":
          e.pos.x += Math.sin(e.patternTimer * 0.04) * 2.5 * ets;
          e.pos.y = centerY + Math.sin(e.patternTimer * 0.02) * 35;
          break;

        case "zigzag":
          e.pos.x += e.vel.x * (Math.sin(e.patternTimer * 0.05) > 0 ? 1.3 : -1.3) * ets;
          e.pos.y = centerY + Math.cos(e.patternTimer * 0.03) * 30;
          break;

        case "circle":
          e.angle += 0.025 * ets;
          e.pos.x = e.centerX + Math.cos(e.angle) * e.radius;
          e.pos.y = centerY + Math.sin(e.angle) * (e.radius * 0.5);
          break;

        case "hover":
          e.pos.x += Math.sin(e.patternTimer * 0.03) * 2.0 * ets;
          e.pos.y = centerY + Math.sin(e.patternTimer * 0.04) * 20;
          break;

        case "patrol":
          e.pos.x += e.vel.x * ets;
          e.pos.y = centerY + Math.sin(e.patternTimer * 0.02) * 25;
          break;

        case "dive":
          e.pos.x += e.vel.x * ets;
          e.pos.y += e.vel.y * 1.6 * ets;
          if (e.pos.y > H - 120) {
            e.vel.y = -Math.abs(e.vel.y) * 0.9;
          } else if (e.pos.y < targetY && e.vel.y < 0) {
            e.vel.y = Math.abs(e.vel.y);
          }
          break;

        default:
          e.pos.x += e.vel.x * ets;
          e.pos.y = centerY + Math.sin(e.patternTimer * 0.03) * 20;
      }

      if (e.pos.x <= minX) { e.pos.x = minX; e.vel.x = Math.abs(e.vel.x); e.centerX = minX + e.radius; }
      if (e.pos.x >= maxX) { e.pos.x = maxX; e.vel.x = -Math.abs(e.vel.x); e.centerX = maxX - e.radius; }
    }

    // Strict boundary safety clamping — enemies NEVER leave the screen
    e.pos.x = Math.max(minX, Math.min(maxX, e.pos.x));
    e.pos.y = Math.max(50, Math.min(H - 90, e.pos.y));

    // Status effects and gradual boss control-resistance recovery.
    if (e.frozen > 0) e.frozen -= 1;
    if (e.controlImmunity > 0) e.controlImmunity--;
    if ((e.guardMarkedTimer ?? 0) > 0) e.guardMarkedTimer = Math.max(0, (e.guardMarkedTimer ?? 0) - 1);
    if (e.controlDecayTimer > 0) e.controlDecayTimer--;
    else if (e.controlResistance > 0 && e.controlImmunity <= 0) {
      e.controlResistance--;
      e.controlDecayTimer = e.controlResistance > 0 ? 180 : 0;
    }
    if (e.burning > 0) { damageEnemy(e, 0.18 * ets, frame, enemies); e.burning -= ets; }
    if (e.poisoned > 0) { damageEnemy(e, 0.10 * ets, frame, enemies); e.poisoned -= ets; }

    // Boss phase changes. Omega has four real transformations; other bosses
    // retain their focused two-stage patterns.
    if (e.isBoss) {
      const bossHpPct = e.hp / e.maxHp;
      if (e.type === "boss_omega") {
        const transform = (phase: number, label: string, intervalDrop: number) => {
          e.phase = phase;
          e.shootInterval = Math.max(6, e.shootInterval - intervalDrop);
          e.frozen = 0;
          e.controlImmunity = 150;
          obj.screenShake = Math.max(obj.screenShake, 12 + phase * 2);
          floatingTexts.push(makeFloatingText(e.pos, label, phase === 3 ? "#ffffff" : "#f43f5e", true));
          audio.playBossWarning();
        };
        if (bossHpPct < 0.75 && e.phase === 0) {
          transform(1, "ОМЕГА: АДАПТАЦИЯ", 3);
          e.maxShieldHp = Math.max(e.maxShieldHp, e.maxHp * 0.06);
          e.shieldHp = e.maxShieldHp;
        } else if (bossHpPct < 0.5 && e.phase === 1) {
          transform(2, "ОМЕГА: РАЗРЫВ ФОРМЫ", 3);
          enemies.push(spawnEnemy("carrier", wave, obj.adaptiveDifficulty), spawnEnemy("phantom", wave, obj.adaptiveDifficulty));
        } else if (bossHpPct < 0.25 && e.phase === 2) {
          transform(3, "ФИНАЛЬНАЯ ФОРМА ОМЕГИ", 5);
          enemies.push(spawnEnemy("phantom", wave, obj.adaptiveDifficulty), spawnEnemy("singularity", wave, obj.adaptiveDifficulty));
          bullets.splice(0, Math.floor(bullets.length * 0.25));
        }
        if (e.phase >= 3) {
          const dx = W / 2 - player.pos.x, dy = H / 2 - player.pos.y;
          const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          player.pos.x += (dx / distance) * 0.24;
          player.pos.y += (dy / distance) * 0.18;
        }
        // ── Omega unique mechanics ──
        // Shockwave ring: every 4 seconds in phase 1+, expanding ring of bullets
        if (e.phase >= 1 && frame % 240 === 0) {
          const ringCount = 16 + e.phase * 6;
          for (let i = 0; i < ringCount; i++) {
            const a = (i / ringCount) * Math.PI * 2;
            const ringSpd = 2.8 + e.phase * 0.4;
            bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * ringSpd, y: Math.sin(a) * ringSpd }, fromPlayer: false, damage: 2.5 + wave * 0.1, size: 5, color: "#ff4444", pierce: 0, homing: false });
          }
          obj.screenShake = Math.max(obj.screenShake, 6);
        }
        // Laser beam: aimed burst every 2.5s in phase 2+
        if (e.phase >= 2 && frame % 150 === 0) {
          const ldx = player.pos.x - e.pos.x, ldy = player.pos.y - e.pos.y;
          const aim = Math.atan2(ldy, ldx);
          const beamSpd = 3.6 + wave * 0.08;
          const beamDmg = (2.5 + wave * 0.22) * 1.5;
          const beamCount = e.phase >= 3 ? 7 : 5;
          for (let i = 0; i < beamCount; i++) {
            const spread = (i - (beamCount - 1) / 2) * 0.06;
            const angle = aim + spread;
            bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(angle) * beamSpd * 2.2, y: Math.sin(angle) * beamSpd * 2.2 }, fromPlayer: false, damage: beamDmg, size: 8, color: "#ffffff", pierce: 2, homing: false });
          }
        }
        // Vortex pull: in phase 3, pull player bullets toward Omega every 3s
        if (e.phase >= 3 && frame % 180 === 0) {
          for (const b of bullets) {
            if (!b.fromPlayer) continue;
            const bdx = e.pos.x - b.pos.x, bdy = e.pos.y - b.pos.y;
            const bdist = Math.max(1, Math.sqrt(bdx * bdx + bdy * bdy));
            if (bdist < 300) {
              b.vel.x += (bdx / bdist) * 1.2;
              b.vel.y += (bdy / bdist) * 1.2;
            }
          }
          obj.screenShake = Math.max(obj.screenShake, 5);
          particles.push(...makeBurst(e.pos, "#e11d48", 12));
        }
        // Rage mode: phase 3 Omega slowly drifts toward the player
        if (e.phase >= 3) {
          const rdx = player.pos.x - e.pos.x, rdy = player.pos.y - e.pos.y;
          const rdist = Math.max(1, Math.sqrt(rdx * rdx + rdy * rdy));
          if (rdist > 100) {
            e.pos.x += (rdx / rdist) * 0.35;
            e.pos.y += (rdy / rdist) * 0.2;
          }
        }
      } else {
        if (bossHpPct < 0.5 && e.phase === 0) {
          e.phase = 1;
          e.shootInterval = Math.max(10, e.shootInterval - 8);
          obj.screenShake = Math.max(obj.screenShake, 8);
          audio.playBossWarning();
          if (e.type === "boss_mothership") {
            for (let escort = 0; escort < 4; escort++) enemies.push(spawnEnemy(escort % 2 ? "fighter" : "spinner", wave, obj.adaptiveDifficulty));
          }
          if (e.type === "boss_dreadnought") {
            e.maxShieldHp = Math.max(e.maxShieldHp, e.maxHp * 0.12);
            e.shieldHp = e.maxShieldHp;
          }
        }
        if (bossHpPct < 0.25 && e.phase === 1) {
          e.phase = 2;
          e.shootInterval = Math.max(6, e.shootInterval - 6);
          obj.screenShake = Math.max(obj.screenShake, 10);
        }
      }
      if (e.type === "boss_eclipse" && e.phase >= 1 && frame % 3 === 0) {
        const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        player.pos.x += (dx / distance) * 0.22;
        player.pos.y += (dy / distance) * 0.22;
      }
    }

    // Enemy shooting
    e.shootTimer -= ets;
    if (e.shootTimer <= 0) {
      e.shootTimer = e.shootInterval * (e.frozen > 0 ? (controlResistant ? 1.35 : 3) : 1);
      shootEnemy(e, player, bullets, wave, obj.adaptiveDifficulty);
    }
  }

  // ─── Move bullets ──────────────────────────────────────────────────────────
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const bts = timeScale * (!b.fromPlayer && obj.routeEffect === "bullet_storm" ? 1.22 : 1);

    // Aim assist is the hottest O(bullets × enemies) path. Recalculate steering
    // periodically; velocity persists between recalculations with no visual loss.
    const homingInterval = obj.performanceTier === 0 ? 5 : obj.performanceTier === 1 ? 3 : 2;
    if (b.fromPlayer && enemies.length > 0 && (b.id + frame) % homingInterval === 0) {
      const isFullHoming = b.homing || player.homing;
      const strength = isFullHoming ? Math.max(player.homingStrength, 0.07) : 0.032;
      const maxDistance = isFullHoming ? 650 : 450;

      let bestTarget: Enemy | null = null;
      let bestScore = -Infinity;

      for (const e of enemies) {
        const dx = e.pos.x - b.pos.x;
        const dy = e.pos.y - b.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > maxDistance * maxDistance) continue;

        const dist = Math.sqrt(distSq);
        const bSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
        const dot = bSpeed > 0 ? (b.vel.x * dx + b.vel.y * dy) / (bSpeed * Math.max(dist, 1)) : 0;

        if (!isFullHoming && dot < 0.15) continue;

        const score = (dot * 3) - (dist / 220);
        if (score > bestScore) {
          bestScore = score;
          bestTarget = e;
        }
      }

      if (bestTarget) {
        const dx = bestTarget.pos.x - b.pos.x;
        const dy = bestTarget.pos.y - b.pos.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

        b.vel.x += (dx / dist) * strength * player.bulletSpeed;
        b.vel.y += (dy / dist) * strength * player.bulletSpeed;

        const curSpeed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
        if (curSpeed > 0) {
          const targetSpeed = player.bulletSpeed * (isFullHoming ? 1.15 : 1.0);
          b.vel.x = (b.vel.x / curSpeed) * targetSpeed;
          b.vel.y = (b.vel.y / curSpeed) * targetSpeed;
        }
      }
    }

    b.pos.x += b.vel.x * bts;
    b.pos.y += b.vel.y * bts;

    // Ricochet off walls
    if (b.fromPlayer && player.ricochet) {
      if (b.pos.x < 0 || b.pos.x > W) { b.vel.x *= -1; }
      if (b.pos.y < 0) { b.vel.y *= -1; }
    }

    if (b.pos.x < -40 || b.pos.x > W + 40 || b.pos.y < -60 || b.pos.y > H + 40) {
      bullets.splice(i, 1);
    }
  }

  // ─── Bullet collision with enemies ─────────────────────────────────────────
  const bulletsToRemove = new Set<number>();
  const spawnedFromSplit: Enemy[] = [];

  // Spatial grid avoids testing every player bullet against every enemy.
  // 128px cells plus adjacent cells cover the largest boss collision radius.
  const collisionCellSize = 128;
  const collisionColumns = Math.ceil(W / collisionCellSize);
  const enemyGrid = new Map<number, Enemy[]>();
  for (const enemy of enemies) {
    const cellX = Math.floor(enemy.pos.x / collisionCellSize);
    const cellY = Math.floor(enemy.pos.y / collisionCellSize);
    const key = cellX + cellY * collisionColumns;
    const cell = enemyGrid.get(key);
    if (cell) cell.push(enemy); else enemyGrid.set(key, [enemy]);
  }
  const collisionCandidates: Enemy[] = [];

  for (const b of bullets) {
    if (!b.fromPlayer || bulletsToRemove.has(b.id)) continue;
    collisionCandidates.length = 0;
    const bulletCellX = Math.floor(b.pos.x / collisionCellSize);
    const bulletCellY = Math.floor(b.pos.y / collisionCellSize);
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const candidateX = bulletCellX + offsetX;
        const candidateY = bulletCellY + offsetY;
        if (candidateX < 0 || candidateX >= collisionColumns || candidateY < 0) continue;
        const cell = enemyGrid.get(candidateX + candidateY * collisionColumns);
        if (cell) collisionCandidates.push(...cell);
      }
    }
    for (const e of collisionCandidates) {
      if (enemiesToRemove.has(e.id)) continue;
      // Phantoms are intangible during the dim phase of their cycle.
      if (e.type === "phantom" && Math.floor(e.patternTimer / 90) % 3 === 0) continue;
      const size = getEnemySize(e.type);
      const dx = b.pos.x - e.pos.x, dy = b.pos.y - e.pos.y;
      if (dx * dx + dy * dy < (size + b.size) * (size + b.size)) {
        player.stats.shotsHit++;
        audio.playHit();

        // Hit shield first
        if (e.shieldHp > 0) {
          const shieldDamage = limitEnemyDamage(e, b.damage * 0.6, frame, enemies);
          e.shieldHp = Math.max(0, e.shieldHp - shieldDamage);
          floatingTexts.push(makeFloatingText(b.pos, `${Math.ceil(shieldDamage)}`, "#93c5fd"));
          particles.push(...makeBurst(b.pos, "#93c5fd", 4));
          if (b.pierce <= 0) bulletsToRemove.add(b.id);
          continue;
        }

        // Crit calculation
        let dmg = b.damage;
        // Sniper Protocol: +damage when target has no nearby allies
        if (player.sniperProtocol) {
          let allyCount = 0;
          for (const other of enemies) {
            if (other.id === e.id) continue;
            const adx = other.pos.x - e.pos.x, ady = other.pos.y - e.pos.y;
            if (adx * adx + ady * ady < 120 * 120) { allyCount++; if (allyCount >= 2) break; }
          }
          if (allyCount < 2) dmg *= (1 + player.sniperBonus);
        }
        const isCrit = Math.random() < player.critChance;
        if (isCrit) {
          dmg *= player.critMultiplier;
          particles.push(...makeBurst(b.pos, "#fff", 6));
          floatingTexts.push(makeFloatingText(b.pos, `${Math.ceil(dmg)}!`, "#fbbf24", true));
        } else {
          floatingTexts.push(makeFloatingText(b.pos, `${Math.ceil(dmg)}`, "#fff"));
        }

        const appliedDamage = damageEnemy(e, dmg, frame, enemies);
        player.stats.damageDealt += appliedDamage;

        // Status effects
        if (Math.random() < player.burnChance)   { e.burning  = Math.max(e.burning,  180); particles.push(...makeBurst(b.pos, "#f97316", 3)); }
        if (Math.random() < player.freezeChance) {
          if (!e.isBoss && !e.guardRole) {
            e.frozen = Math.max(e.frozen, 120);
          } else if (e.controlImmunity <= 0) {
            // Diminishing control: 120 → 72 → 43 frames, then 3s immunity.
            const duration = Math.max(24, Math.round(120 * Math.pow(0.6, e.controlResistance)));
            e.frozen = Math.max(e.frozen, duration);
            e.controlResistance++;
            e.controlDecayTimer = 360;
            if (e.controlResistance >= 3) {
              e.controlImmunity = 180;
              e.controlResistance = 3;
            }
          }
          particles.push(...makeBurst(b.pos, "#bfdbfe", e.isBoss ? 5 : 3));
        }
        if (Math.random() < player.poisonChance) { e.poisoned = Math.max(e.poisoned, 240); particles.push(...makeBurst(b.pos, "#4ade80", 3)); }

        // Lightning chain
        if (Math.random() < player.lightningChance) {
          chainLightning(e, enemies, lightnings, player.lightningChain, dmg * 0.6, frame);
        }

        // Life steal
        if (player.lifeSteal > 0) {
          player.hp = Math.min(player.hp + appliedDamage * player.lifeSteal, player.maxHp);
        }

        // Heal on kill check & enemy defeat
        if (e.hp <= 0) {
          audio.playExplosion(e.isBoss);
          obj.screenShake = Math.max(obj.screenShake, e.isBoss ? 15 : (e.isElite ? 7 : 3));

          // Combo tracking
          player.combo++;
          player.comboTimer = 180;

          if (getUpgradeLevel(player, "heal_on_kill") > 0) {
            player.hp = Math.min(player.hp + 4 * getUpgradeLevel(player, "heal_on_kill"), player.maxHp);
          }
          if (player.livingShield && player.shield) {
            player.shield.hp = Math.min(player.shield.maxHp, player.shield.hp + player.livingShieldAmount);
          }
          const xpBoostLevel = getUpgradeLevel(player, "xp_boost");
          const scoreBoostXp = getUpgradeLevel(player, "score_boost");
          const xpGained = Math.floor((e.xp + scoreBoostXp) * (1 + xpBoostLevel * 0.25) * obj.routeXpMultiplier);
          enemiesToRemove.add(e.id);
          input.onKill(xpGained, e.pos, e.isBoss);

          const comboBonus = 1 + (player.combo > 1 ? player.combo * 0.05 : 0);
          player.score += Math.floor(e.xp * 10 * player.goldMultiplier * comboBonus * obj.routeScoreMultiplier);
          player.kills++;
          if (e.isElite) player.stats.elitesKilled++;
          if (e.isBoss) player.stats.bossesKilled++;
          devourSoul(player, e, particles, floatingTexts);

          // Explosion
          if (player.explosiveBullets) {
            explodeArea(e.pos, player.explosionRadius, enemies, enemiesToRemove, particles, obj.explosions, player, frame);
          }

          // Splitters release 2 scouts; late-game carriers release 4 escorts.
          if (e.type === "splitter" || e.type === "carrier") {
            const offsets = e.type === "carrier" ? [-2, -1, 1, 2] : [-1, 1];
            for (const s of offsets) {
              spawnedFromSplit.push({
                id: uid(),
                pos: { x: e.pos.x + s * 16, y: e.pos.y },
                vel: { x: s * 1.5, y: 1.1 },
                hp: 2.8,
                maxHp: 2.8,
                type: "scout",
                shootTimer: randInt(60, 150),
                shootInterval: 150,
                isBoss: false,
                phase: 0,
                angle: 0,
                radius: 80,
                centerX: e.pos.x,
                centerY: e.pos.y,
                targetY: e.pos.y,
                movePattern: "sine",
                patternTimer: 0,
                shieldHp: 0,
                maxShieldHp: 0,
                frozen: 0,
                controlResistance: 0,
                controlImmunity: 0,
                controlDecayTimer: 0,
                burning: 0,
                poisoned: 0,
                drops: false,
                xp: 4,
              });
            }
          }

          // Random Combat Powerup drop
          const battleMagnetBonus = player.battleMagnet ? player.battleMagnetChance : 0;
          const dropChance = Math.min(1.0, (e.isBoss ? 1.0 : (e.isElite ? 0.65 : 0.08)) + battleMagnetBonus);
          if (Math.random() < dropChance) {
            const types: PowerupType[] = ["heal", "rapid", "shield", "magnet", "nuke"];
            const pType = types[Math.floor(Math.random() * types.length)];
            powerups.push(makePowerup(e.pos, pType));
          }

          // Chain Detonation: killed enemies explode, damaging nearby enemies
          // (no cascade: explosion damage cannot trigger further chain detonations)
          if (player.chainDetonation && !e.isBoss) {
            const detRadius = player.chainDetonationRadius + (e.isElite ? 40 : 0);
            for (const other of enemies) {
              if (other.id === e.id || enemiesToRemove.has(other.id)) continue;
              const ddx = other.pos.x - e.pos.x, ddy = other.pos.y - e.pos.y;
              if (ddx * ddx + ddy * ddy < detRadius * detRadius) {
                const detDmg = damageEnemy(other, player.bulletDamage * 2.5, frame, enemies);
                player.stats.damageDealt += detDmg;
                // Don't add to enemiesToRemove — prevents cascade chain reactions
              }
            }
            obj.explosions.push({ id: uid(), pos: { ...e.pos }, radius: detRadius, progress: 0 });
            obj.screenShake = Math.max(obj.screenShake, 4);
          }

          const col = e.isBoss ? "#f43f5e" : (e.isElite ? "#fbbf24" : "#fb923c");
          particles.push(...makeBurst(e.pos, col, e.isBoss ? 45 : (e.isElite ? 25 : 14), e.isBoss));
          if (player.shipClass === "void_wraith") particles.push(...makeShards(e.pos, e.isBoss ? 16 : 7));
          xpOrbs.push(makeXpOrb(e.pos, xpGained));
        }

        particles.push(...makeBurst(b.pos, "#fbbf24", 3));

        // Phase Discharge: every Nth hit spawns shard bullets
        if (player.phaseDischarge && player.phaseDischargeCount > 0) {
          const shardInterval = Math.max(3, 8 - player.phaseDischargeCount);
          if (frame % shardInterval === 0) {
            for (let si = 0; si < 4; si++) {
              const sa = (si / 4) * Math.PI * 2 + Math.random() * 0.5;
              bullets.push({
                id: uid(), pos: { x: b.pos.x, y: b.pos.y },
                vel: { x: Math.cos(sa) * player.bulletSpeed * 0.7, y: Math.sin(sa) * player.bulletSpeed * 0.7 },
                fromPlayer: true, damage: b.damage * 0.5, size: 2, color: "#c084fc",
                pierce: 0, homing: false,
              });
            }
          }
        }

        if (b.pierce <= 0) { bulletsToRemove.add(b.id); break; }
        else (b as { pierce: number }).pierce--;
      }
    }
  }

  // Remove bullets/enemies and add splitters
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bulletsToRemove.has(bullets[i].id)) bullets.splice(i, 1);
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemiesToRemove.has(enemies[i].id)) enemies.splice(i, 1);
  }
  if (spawnedFromSplit.length > 0) {
    enemies.push(...spawnedFromSplit);
  }

  // ─── Enemy bullets hit player ──────────────────────────────────────────────
  const isGhost = player.ghostMode && player.ghostTimer > 0;
  if (player.invincTimer <= 0 && !isGhost && player.dashTimer <= 0) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.fromPlayer) continue;
      const dx = b.pos.x - player.pos.x, dy = b.pos.y - player.pos.y;
      if (dx * dx + dy * dy < (18 + b.size) * (18 + b.size)) {
        bullets.splice(i, 1);
        takeDamage(player, b.damage * 8.5, particles, obj, input.onDeath);
        break; // invulnerability starts immediately; do not stack hits in one tick
      }
    }
    // Enemy contact
    if (player.invincTimer <= 0) {
      for (const e of enemies) {
        if (enemiesToRemove.has(e.id)) continue;
        const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
        const size = getEnemySize(e.type);
        if (dx * dx + dy * dy < (size + 16) * (size + 16)) {
          const baseContactDamage = e.isBoss ? 28 + wave * 0.8 : 11 + wave * 0.18;
          const contactDamage = baseContactDamage * (e.guardRole ? 0.65 : 1);
          takeDamage(player, contactDamage, particles, obj, input.onDeath);
          if (e.type === "leecher") e.hp = Math.min(e.maxHp, e.hp + contactDamage * 2);
          break;
        }
      }
    }
  }

  // ─── Powerup collection ────────────────────────────────────────────────────
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.life--;
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    p.vel.x *= 0.96;
    p.vel.y *= 0.96;

    const dx = player.pos.x - p.pos.x;
    const dy = player.pos.y - p.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 32) {
      audio.playPowerup();
      player.stats.powerupsCollected++;
      const powerupLabels: Record<PowerupType, string> = {
        heal: "+ЛЕЧЕНИЕ!",
        rapid: "+ОВЕРДРАЙВ!",
        shield: "+ФАЗОВЫЙ ЩИТ!",
        magnet: "+СУПЕР-МАГНИТ!",
        nuke: "+ТАКТИЧЕСКИЙ ЗАРЯД!"
      };
      floatingTexts.push(makeFloatingText(player.pos, powerupLabels[p.type] || "+БОНУС!", "#38bdf8", true));

      switch (p.type) {
        case "heal":
          player.hp = Math.min(player.maxHp, player.hp + 30);
          if (player.shield) player.shield.hp = Math.min(player.shield.maxHp, player.shield.hp + 20);
          break;
        case "rapid":
          player.rapidBoostTimer = 360;
          break;
        case "shield":
          if (!player.shield) player.shield = { hp: 30, maxHp: 30, regenTimer: 0 };
          else player.shield.hp = player.shield.maxHp;
          player.invincTimer = 180;
          break;
        case "magnet":
          // XP is already auto-attracted, so merely toggling `attracted` had no
          // effect. Instantly pull every orb in and permanently improve pickup.
          xpOrbs.forEach(o => {
            o.attracted = true;
            o.pos.x = player.pos.x;
            o.pos.y = player.pos.y;
          });
          player.magnetRange += 20;
          break;
        case "nuke":
          player.nukeCharges = Math.min(3, player.nukeCharges + 1);
          break;
      }

      particles.push(...makeBurst(p.pos, "#38bdf8", 16));
      powerups.splice(i, 1);
      continue;
    }
    if (p.life <= 0) powerups.splice(i, 1);
  }

  // ─── XP collection (automatically attracted to player) ─────────────────────
  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const orb = xpOrbs[i];
    const dx = player.pos.x - orb.pos.x;
    const dy = player.pos.y - orb.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    orb.attracted = true;

    const magnetBonus = Math.max(0, (player.magnetRange - 80) * 0.05);
    const pullSpeed = Math.min(18, 8.5 + (dist > 250 ? 3.5 : 0) + magnetBonus);

    orb.pos.x += (dx / Math.max(dist, 1)) * pullSpeed;
    orb.pos.y += (dy / Math.max(dist, 1)) * pullSpeed;

    if (dist < 24) {
      audio.playXp();
      player.xp += orb.value;
      xpOrbs.splice(i, 1);
      while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = getNextLevelXp(player.level);
        audio.playLevelUp();
        input.onLevelUp(player);
      }
      continue;
    }
  }

  // ─── Floating Texts ────────────────────────────────────────────────────────
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.pos.x += ft.vel.x;
    ft.pos.y += ft.vel.y;
    ft.vel.y *= 0.95;
    ft.life--;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  // ─── Lightnings ────────────────────────────────────────────────────────────
  for (let i = lightnings.length - 1; i >= 0; i--) {
    lightnings[i].life--;
    if (lightnings[i].life <= 0) lightnings.splice(i, 1);
  }

  // ─── Particles ─────────────────────────────────────────────────────────────
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    p.vel.x *= 0.93;
    p.vel.y *= 0.93;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // ─── Explosions ────────────────────────────────────────────────────
  for (let i = obj.explosions.length - 1; i >= 0; i--) {
    const ex = obj.explosions[i];
    ex.progress += 0.04;
    if (ex.progress >= 1) obj.explosions.splice(i, 1);
  }

  // Keep rendering and collision costs bounded even for extreme end-game builds.
  enforceObjectBudgets(obj);

  // ─── Wave completion / adaptive guard response ─────────────────────────────
  if (obj.waveEnemyQueue.length === 0 && enemies.length === 0 && !obj.bossActive) {
    if (obj.guardEventActive) {
      obj.guardEventActive = false;
      player.score += wave * 1000;
      player.hp = Math.min(player.maxHp, player.hp + 10);
      if (player.shield) player.shield.hp = Math.min(player.shield.maxHp, player.shield.hp + 25);
      obj.floatingTexts.push(makeFloatingText({ x: W / 2, y: H / 2 }, "ПЕЧАТЬ ГВАРДИИ ПОЛУЧЕНА", "#e879f9", true));
      input.onWaveComplete();
      return;
    }
    // Never append a guard after boss defeat; that transition belongs to loot/route UI.
    // Deterministic schedule: guards appear at wave 20, then every 6 waves (26, 32, 38...).
    // Player must meet level/power gates to trigger the encounter.
    const cortegeEligible = wave >= 20 && wave % 5 !== 0 && player.level >= 12 && obj.powerRating >= 80;
    const guardWave = cortegeEligible && (wave === 20 || (wave > 20 && (wave - 20) % 6 === 0));
    if (guardWave && !obj.guardSpawnedThisWave) {
      spawnAdaptiveGuard(obj, wave);
      obj.guardSpawnedThisWave = true;
      const omens = ["ТВОЯ МОЩЬ БЫЛА ЗАМЕЧЕНА", "ПУСТОТА ПРОИЗНЕСЛА ТВОЁ ИМЯ", "ЧЁРНЫЙ КОРТЕЖ УЖЕ ЗДЕСЬ"];
      obj.floatingTexts.push(makeFloatingText({ x: W / 2, y: H / 2 }, omens[Math.floor(Math.random() * omens.length)], "#e879f9", true));
      obj.floatingTexts.push(makeFloatingText({ x: W / 2, y: H / 2 + 42 }, "УНИЧТОЖЬ ПРОВОЗВЕСТНИКА ПЕРВЫМ", "#fbbf24", true));
      obj.screenShake = Math.max(obj.screenShake, 10);
      audio.playBossWarning();
    } else {
      input.onWaveComplete();
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function limitEnemyDamage(enemy: Enemy, amount: number, frame: number, enemies: Enemy[]): number {
  if (!enemy.guardRole) return amount;
  const heraldAlive = enemy.guardRole !== "herald" && enemies.some(other => other.guardRole === "herald" && other.hp > 0);
  let adjusted = amount * (heraldAlive ? (enemy.guardLinkMultiplier ?? 0.4) : 1);
  if (enemy.guardDamageFrame !== frame) {
    enemy.guardDamageFrame = frame;
    enemy.guardDamageThisFrame = 0;
  }
  // Even a level-300 completed build needs several seconds per Cortege stage.
  const frameCap = enemy.maxHp * (enemy.guardFrameDamageCap ?? (enemy.guardRole === "herald" ? 0.004 : 0.006));
  const remaining = Math.max(0, frameCap - (enemy.guardDamageThisFrame ?? 0));
  adjusted = Math.min(adjusted, remaining);
  enemy.guardDamageThisFrame = (enemy.guardDamageThisFrame ?? 0) + adjusted;
  return adjusted;
}

function damageEnemy(enemy: Enemy, amount: number, frame: number, enemies: Enemy[]): number {
  const applied = limitEnemyDamage(enemy, amount, frame, enemies);
  enemy.hp = Math.max(0, enemy.hp - applied);
  return applied;
}

export function spawnAdaptiveGuard(obj: GameObjects, wave: number) {
  // The Black Cortege is always four readable roles, not another crowded wave.
  const cortege: Array<{ role: NonNullable<Enemy["guardRole"]>; type: EnemyType; name: string; hp: number }> = [
    { role: "herald", type: "warden", name: "☿ ПРОВОЗВЕСТНИК", hp: 1.15 },
    { role: "reaper", type: "phantom", name: "† ЖНЕЦ", hp: 0.82 },
    { role: "eye", type: "artillery", name: "◉ ОКО", hp: 0.9 },
    { role: "anchor", type: "singularity", name: "⚓ ЯКОРЬ БЕЗДНЫ", hp: 1.05 },
  ];
  const powerPressure = Math.min(2.0, 1 + Math.sqrt(Math.max(1, obj.powerRating)) / 34);
  const guardScale = obj.adaptiveDifficulty * powerPressure;
  const powerRatio = Math.min(1, Math.max(0, (obj.powerRating - 80) / 1120));
  const linkMultiplier = 0.55 - powerRatio * 0.3;
  obj.guardEventActive = true;

  for (const definition of cortege) {
    const enemy = spawnEnemy(definition.type, wave, guardScale);
    enemy.guardRole = definition.role;
    enemy.guardDamageFrame = -1;
    enemy.guardDamageThisFrame = 0;
    enemy.guardLinkMultiplier = linkMultiplier;
    enemy.guardFrameDamageCap = definition.role === "herald"
      ? 0.007 - powerRatio * 0.004
      : 0.009 - powerRatio * 0.0045;
    enemy.guardMarkedTimer = definition.role === "herald" ? 600 : 0;
    enemy.isElite = true;
    enemy.eliteName = definition.name;
    enemy.hp *= definition.hp;
    enemy.maxHp = enemy.hp;
    enemy.maxShieldHp += 20 + wave * 0.65;
    enemy.shieldHp = enemy.maxShieldHp;
    // Early Corteges leave larger reaction windows; late adaptive scaling closes them.
    const attackTempo = 1.12 - powerRatio * 0.24;
    enemy.shootInterval = Math.max(24, Math.floor(enemy.shootInterval * attackTempo));
    enemy.controlResistance = 2;
    enemy.controlDecayTimer = 420;
    enemy.xp *= 2;
    obj.enemies.push(enemy);
  }
}

const OBJECT_BUDGETS = {
  playerBullets: 450,
  enemyBullets: 260,
  particles: 550,
  xpOrbs: 220,
  floatingTexts: 100,
  lightnings: 90,
  mines: 60,
  explosions: 60,
  powerups: 30,
  enemies: 80,
} as const;

function trimOldest<T>(items: T[], max: number) {
  if (items.length > max) items.splice(0, items.length - max);
}

function enforceObjectBudgets(obj: GameObjects) {
  const { bullets } = obj;
  const qualityFactor = obj.performanceTier === 0 ? 0.48 : obj.performanceTier === 1 ? 0.72 : 1;
  const playerBulletCap = obj.performanceTier === 0 ? 360 : obj.performanceTier === 1 ? 420 : OBJECT_BUDGETS.playerBullets;
  const enemyBulletCap = obj.performanceTier === 0 ? 210 : obj.performanceTier === 1 ? 240 : OBJECT_BUDGETS.enemyBullets;
  let playerBulletTotal = 0;
  for (const bullet of bullets) if (bullet.fromPlayer) playerBulletTotal++;
  const enemyBulletTotal = bullets.length - playerBulletTotal;
  if (playerBulletTotal > playerBulletCap || enemyBulletTotal > enemyBulletCap) {
    const playerBullets: Bullet[] = [];
    const enemyBullets: Bullet[] = [];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      const target = bullet.fromPlayer ? playerBullets : enemyBullets;
      const max = bullet.fromPlayer ? playerBulletCap : enemyBulletCap;
      if (target.length < max) target.push(bullet);
    }
    bullets.length = 0;
    bullets.push(...playerBullets.reverse(), ...enemyBullets.reverse());
  }

  if (obj.enemies.length > OBJECT_BUDGETS.enemies) {
    const bosses = obj.enemies.filter(enemy => enemy.isBoss);
    const regular = obj.enemies.filter(enemy => !enemy.isBoss).slice(-(OBJECT_BUDGETS.enemies - bosses.length));
    obj.enemies.length = 0;
    obj.enemies.push(...bosses, ...regular);
  }
  trimOldest(obj.particles, Math.ceil(OBJECT_BUDGETS.particles * qualityFactor));
  trimOldest(obj.xpOrbs, Math.ceil(OBJECT_BUDGETS.xpOrbs * Math.max(0.75, qualityFactor)));
  trimOldest(obj.floatingTexts, Math.ceil(OBJECT_BUDGETS.floatingTexts * qualityFactor));
  trimOldest(obj.lightnings, Math.ceil(OBJECT_BUDGETS.lightnings * Math.max(0.6, qualityFactor)));
  trimOldest(obj.mines, OBJECT_BUDGETS.mines);
  trimOldest(obj.explosions, Math.ceil(OBJECT_BUDGETS.explosions * qualityFactor));
  trimOldest(obj.powerups, OBJECT_BUDGETS.powerups);
}

function makePlayerBullet(player: PlayerState, pos: Vec2, vel: Vec2): Bullet {
  player.stats.shotsFired++;
  return {
    id: uid(), pos: { ...pos }, vel,
    fromPlayer: true,
    // Devoured souls permanently boost every bolt the Wraith fires this run.
    damage: player.bulletDamage * soulDamageMult(player),
    size: player.bulletSize,
    color: player.snipeMode ? "#ffffff" : (player.shipClass === "tempest" ? "#c084fc" : (player.shipClass === "dreadnought" ? "#f59e0b" : (player.shipClass === "void_wraith" ? "#e879f9" : "#38bdf8"))),
    pierce: player.piercing,
    homing: player.homing,
  };
}

function firePlayerBullets(bullets: Bullet[], player: PlayerState, _enemies: Enemy[], _frame: number) {
  const shots = 1 + player.multishot;
  const totalSpread = player.spreadAngle;

  for (let i = 0; i < shots; i++) {
    let angle: number;
    if (shots === 1) {
      // The Wraith's signature weapon: a twin stream of homing void bolts.
      if (player.shipClass === "void_wraith" && !player.mirrorShots) {
        for (const side of [-1, 1]) {
          bullets.push(makePlayerBullet(player,
            { x: player.pos.x + side * 7, y: player.pos.y - 16 },
            { x: side * 0.12 * player.bulletSpeed, y: -player.bulletSpeed }
          ));
        }
        continue;
      }
      angle = -Math.PI / 2;
    } else if (totalSpread >= 350) {
      angle = (i / shots) * Math.PI * 2;
    } else {
      angle = -Math.PI / 2 + ((i / (shots - 1)) - 0.5) * (totalSpread * Math.PI / 180);
    }
    const vx = Math.cos(angle) * player.bulletSpeed;
    const vy = Math.sin(angle) * player.bulletSpeed;
    bullets.push(makePlayerBullet(player, { x: player.pos.x, y: player.pos.y - 20 }, { x: vx, y: vy }));
  }

  // Mirror shots
  if (player.mirrorShots) {
    for (let i = 0; i < shots; i++) {
      let angle: number;
      if (shots === 1) angle = Math.PI / 2;
      else if (totalSpread >= 350) angle = (i / shots) * Math.PI * 2 + Math.PI;
      else angle = Math.PI / 2 + ((i / (shots - 1)) - 0.5) * (totalSpread * Math.PI / 180);
      const vx = Math.cos(angle) * player.bulletSpeed;
      const vy = Math.sin(angle) * player.bulletSpeed;
      bullets.push(makePlayerBullet(player, { x: player.pos.x, y: player.pos.y + 20 }, { x: vx, y: vy }));
    }
  }

  // Rear shot
  if (player.rearShot) {
    bullets.push(makePlayerBullet(player, { x: player.pos.x, y: player.pos.y + 10 }, { x: 0, y: player.bulletSpeed }));
  }
}

function shootEnemy(e: Enemy, player: PlayerState, bullets: Bullet[], wave: number, adaptiveScale = 1) {
  const dx = player.pos.x - e.pos.x, dy = player.pos.y - e.pos.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const spd = 3.6 + wave * 0.08;
  const color = getEnemyBulletColorLocal(e.type);
  const baseDamage = e.isBoss ? 2.5 + wave * 0.22 : 1 + wave * 0.035;
  const adaptiveDamage = baseDamage * (1 + Math.max(0, adaptiveScale - 1) * 0.35);
  // The Cortege tests positioning over time instead of deleting an early player in one volley.
  const guardDamageFactor = e.guardRole ? 0.6 + Math.min(0.22, adaptiveScale * 0.02) : 1;
  const dmg = adaptiveDamage * guardDamageFactor;
  const size = e.isBoss ? 6.5 : 4.5;

  switch (e.type) {
    case "bomber": {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "sniper": {
      bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd * 1.7, y: (dy / dist) * spd * 1.7 }, fromPlayer: false, damage: dmg * 1.8, size: size + 2, color, pierce: 0, homing: false });
      break;
    }
    case "artillery": {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * 0.85, y: Math.sin(a) * spd * 0.85 }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "spinner": {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + e.angle;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "warden": {
      const baseAngle = Math.atan2(dy, dx);
      for (const offset of [-0.22, 0, 0.22]) {
        const angle = baseAngle + offset;
        bullets.push({ id: uid(), pos: { ...e.pos }, vel: { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd }, fromPlayer: false, damage: dmg, size: size + 1, color, pierce: 0, homing: false });
      }
      break;
    }
    case "phantom": {
      if (Math.floor(e.patternTimer / 90) % 3 !== 0) {
        bullets.push({ id: uid(), pos: { ...e.pos }, vel: { x: (dx / dist) * spd * 1.65, y: (dy / dist) * spd * 1.65 }, fromPlayer: false, damage: dmg * 1.25, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "leecher": {
      bullets.push({ id: uid(), pos: { ...e.pos }, vel: { x: (dx / dist) * spd * 1.25, y: (dy / dist) * spd * 1.25 }, fromPlayer: false, damage: dmg * 1.6, size: size + 3, color, pierce: 1, homing: false });
      break;
    }
    case "carrier": {
      const baseAngle = Math.atan2(dy, dx);
      for (let i = -2; i <= 2; i++) {
        const angle = baseAngle + i * 0.18;
        bullets.push({ id: uid(), pos: { ...e.pos }, vel: { x: Math.cos(angle) * spd * 0.9, y: Math.sin(angle) * spd * 0.9 }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "singularity": {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + e.angle;
        bullets.push({ id: uid(), pos: { ...e.pos }, vel: { x: Math.cos(angle) * spd * 0.72, y: Math.sin(angle) * spd * 0.72 }, fromPlayer: false, damage: dmg * 1.15, size: size + 1, color, pierce: 0, homing: false });
      }
      break;
    }
    case "boss_destroyer": {
      bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd * 1.2, y: (dy / dist) * spd * 1.2 }, fromPlayer: false, damage: dmg, size: size + 2, color, pierce: 0, homing: false });
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        bullets.push({ id: uid(), pos: { x: e.pos.x + s2 * 45, y: e.pos.y }, vel: { x: s2 * spd * 0.45, y: spd * 0.95 }, fromPlayer: false, damage: dmg * 0.7, size, color, pierce: 0, homing: false });
      }
      if (e.phase >= 1) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * 0.8, y: Math.sin(a) * spd * 0.8 }, fromPlayer: false, damage: dmg * 0.6, size: size - 1, color, pierce: 0, homing: false });
        }
      }
      break;
    }
    case "boss_mothership": {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + e.angle * 0.02;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      if (e.phase >= 1) {
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd * 1.4, y: (dy / dist) * spd * 1.4 }, fromPlayer: false, damage: dmg * 1.3, size: size + 3, color, pierce: 1, homing: false });
      }
      break;
    }
    case "boss_dreadnought": {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + e.angle * 0.015;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * 0.9, y: Math.sin(a) * spd * 0.9 }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      if (e.phase >= 1) {
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd * 1.7, y: (dy / dist) * spd * 1.7 }, fromPlayer: false, damage: dmg * 2, size: 11, color, pierce: 3, homing: false });
      }
      break;
    }
    case "boss_eclipse": {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + e.angle * 0.02;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      if (e.phase >= 1) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * 1.35, y: Math.sin(a) * spd * 1.35 }, fromPlayer: false, damage: dmg * 1.3, size: size + 2, color, pierce: 0, homing: true });
        }
      }
      break;
    }
    case "boss_titan": {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * (0.5 + e.phase * 0.4), y: Math.sin(a) * spd * (0.5 + e.phase * 0.4) }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "boss_omega": {
      const count = 12 + e.phase * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + e.angle * (0.025 + e.phase * 0.008);
        const speedBand = e.phase >= 2 && i % 2 === 0 ? 0.72 : 1.08 + e.phase * 0.08;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * speedBand, y: Math.sin(a) * spd * speedBand }, fromPlayer: false, damage: dmg * (e.phase >= 3 ? 1.15 : 1), size: size + e.phase, color, pierce: 0, homing: false });
      }
      if (e.phase >= 1) {
        const aim = Math.atan2(dy, dx);
        for (const offset of e.phase >= 3 ? [-0.3, -0.1, 0.1, 0.3] : [-0.14, 0.14]) {
          const angle = aim + offset;
          bullets.push({ id: uid(), pos: { ...e.pos }, vel: { x: Math.cos(angle) * spd * 1.65, y: Math.sin(angle) * spd * 1.65 }, fromPlayer: false, damage: dmg * 1.25, size: size + 2, color: "#ffffff", pierce: 1, homing: false });
        }
      }
      break;
    }
    default: {
      bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd, y: (dy / dist) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
    }
  }
}

function chainLightning(source: Enemy, enemies: Enemy[], lightnings: Lightning[], chain: number, dmg: number, frame: number) {
  let current = source;
  for (let c = 0; c < chain; c++) {
    let nearest: Enemy | null = null;
    let nearDist = 9999;
    for (const e of enemies) {
      if (e.id === current.id) continue;
      const dx = e.pos.x - current.pos.x, dy = e.pos.y - current.pos.y;
      const d = dx * dx + dy * dy;
      if (d < nearDist && d < 220 * 220) { nearDist = d; nearest = e; }
    }
    if (!nearest) break;
    lightnings.push({ id: uid(), from: { ...current.pos }, to: { ...nearest.pos }, life: 8 });
    damageEnemy(nearest, dmg * 0.7, frame, enemies);
    current = nearest;
  }
}

function explodeArea(pos: Vec2, radius: number, enemies: Enemy[], toRemove: Set<number>, particles: Particle[], explosions: { id: number; pos: Vec2; radius: number; progress: number }[], player: PlayerState, frame: number) {
  explosions.push({ id: uid(), pos: { ...pos }, radius, progress: 0 });
  for (const e of enemies) {
    const dx = e.pos.x - pos.x, dy = e.pos.y - pos.y;
    if (dx * dx + dy * dy < radius * radius) {
      const blastDamage = damageEnemy(e, player.bulletDamage * 3, frame, enemies);
      player.stats.damageDealt += blastDamage;
      if (e.hp <= 0) toRemove.add(e.id);
      particles.push(...makeBurst(e.pos, "#f97316", 5));
    }
  }
}

function takeDamage(player: PlayerState, amount: number, particles: Particle[], obj: GameObjects, onDeath: () => void) {
  audio.playShieldBreak();
  obj.screenShake = Math.max(obj.screenShake, 8);

  if (player.shield && player.shield.hp > 0) {
    player.shield.hp -= amount;
    if (player.shield.hp < 0) {
      player.hp += player.shield.hp;
      player.shield.hp = 0;
    }
  } else {
    player.hp -= amount;
  }
  player.invincTimer = 75;
  particles.push(...makeBurst(player.pos, "#f87171", 10));
  if (player.hp <= 0) {
    player.hp = 0;
    onDeath();
  }
}

function getEnemyBulletColorLocal(type: EnemyType): string {
  switch (type) {
    case "scout": return "#f87171";
    case "fighter": return "#fb923c";
    case "bomber": return "#facc15";
    case "sniper": return "#a3e635";
    case "tank": return "#60a5fa";
    case "kamikaze": return "#ff4444";
    case "spinner": return "#c084fc";
    case "healer": return "#4ade80";
    case "artillery": return "#38bdf8";
    case "charger": return "#f97316";
    case "warden": return "#22d3ee";
    case "phantom": return "#d8b4fe";
    case "leecher": return "#fb7185";
    case "carrier": return "#fb923c";
    case "singularity": return "#818cf8";
    case "boss_destroyer": return "#ef4444";
    case "boss_mothership": return "#8b5cf6";
    case "boss_dreadnought": return "#f59e0b";
    case "boss_eclipse": return "#06b6d4";
    case "boss_titan": return "#ec4899";
    case "boss_omega": return "#ff0000";
    default: return "#fbbf24";
  }
}
