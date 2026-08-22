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
  return Math.floor(240 * Math.pow(1.25, level - 5));
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
    shield: { hp: 20, maxHp: 20, regenTimer: 0, active: true },
    xp: 0, level: 1, xpToNext: 30,
    upgrades: [],
    invincTimer: 0,
    magnetRange: 120,
    aura: false, auraDamage: 0.25, auraTimer: 0,
    lasers: 0, laserTimer: 0,
    rearShot: false, rearShotTimer: 0,
    explosiveBullets: false, explosionRadius: 60,
    ricochet: false, ricochetCount: 1,
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
    teleportCooldown: 0, teleportTimer: 0,
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
  return Array.from({ length: count }, () => ({
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
    player.dashCooldown = 150; // 2.5s cooldown
    player.dashTimer = 16;
    player.invincTimer = Math.max(player.invincTimer, 20);
    audio.playDash();
    particles.push(...makeBurst(player.pos, "#38bdf8", 12));
  }

  // ─── Player movement ───────────────────────────────────────────────────────
  // Physical KeyW/A/S/D codes make movement independent from keyboard layout.
  // The chrono ability slows the world, not the player's own ship.
  const spd = player.speed * dashSpeedMult;
  if ((keys.has("ArrowLeft")  || keys.has("KeyA")) && player.pos.x > 25) player.pos.x -= spd;
  if ((keys.has("ArrowRight") || keys.has("KeyD")) && player.pos.x < W - 25) player.pos.x += spd;
  if ((keys.has("ArrowUp")    || keys.has("KeyW")) && player.pos.y > 60) player.pos.y -= spd;
  if ((keys.has("ArrowDown")  || keys.has("KeyS")) && player.pos.y < H - 32) player.pos.y += spd;

  player.pos.x = Math.max(25, Math.min(W - 25, player.pos.x));
  player.pos.y = Math.max(60, Math.min(H - 32, player.pos.y));

  // ─── Ghost mode ─────────────────────────────────────────────────────────────
  if (player.ghostMode) {
    player.ghostTimer--;
    if (player.ghostTimer <= 0) {
      player.ghostTimer = player.ghostTimer < -400 ? 120 : -500;
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
    const regenRate = 1 + shieldRegenBonus;
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

  const effectiveFireRate = Math.max(2, Math.floor(baseRate));

  // Auto-fire continuous shooting with soft sound
  if (frame % effectiveFireRate === 0) {
    firePlayerBullets(bullets, player, enemies, frame);
    audio.playShoot(player.snipeMode);
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
        const dist = Math.sqrt(dx * dx + dy * dy);
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
        const dist = Math.sqrt(dx * dx + dy * dy);
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
          e.hp -= player.auraDamage * timeScale;
          player.stats.damageDealt += player.auraDamage * timeScale;
          particles.push(...makeBurst({ x: e.pos.x, y: e.pos.y }, "#fde047", 1));
        }
      }
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
        e.hp -= 6 * player.bulletDamage;
        player.stats.damageDealt += 6 * player.bulletDamage;
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
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          e.pos.x += (dx / dist) * 3 * timeScale;
          e.pos.y += (dy / dist) * 3 * timeScale;
          if (dist < 25) {
            e.hp -= 3 * timeScale;
            player.stats.damageDealt += 3 * timeScale;
          }
        }
      }
    }
    if (obj.blackHoleTimer <= 0) obj.blackHolePos = null;
  }

  // ─── Time slow cooldown ────────────────────────────────────────────────────
  player.timeSlowCooldown = Math.max(0, player.timeSlowCooldown - 1);
  player.timeSlowTimer = Math.max(0, player.timeSlowTimer - 1);

  // ─── Spawn enemies ─────────────────────────────────────────────────────────
  obj.waveSpawnTimer = Math.max(0, obj.waveSpawnTimer - 1);
  if (obj.waveEnemyQueue.length > 0 && obj.waveSpawnTimer <= 0) {
    const next = obj.waveEnemyQueue[0];
    enemies.push(spawnEnemy(next.type, wave));
    next.count--;
    if (next.count <= 0) obj.waveEnemyQueue.shift();
    obj.waveSpawnTimer = Math.max(20, 50 - wave * 2);
  }

  // ─── Move & Heal enemies (STRICTLY STAY ON MAP) ───────────────────────────
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ets = e.frozen > 0 ? 0.15 : timeScale;
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

    // Status effects
    if (e.frozen > 0) e.frozen -= 1;
    if (e.burning > 0) { e.hp -= 0.18 * ets; e.burning -= ets; }
    if (e.poisoned > 0) { e.hp -= 0.10 * ets; e.poisoned -= ets; }

    // Boss phase changes
    if (e.isBoss) {
      const bossHpPct = e.hp / e.maxHp;
      if (bossHpPct < 0.5 && e.phase === 0) {
        e.phase = 1;
        e.shootInterval = Math.max(10, e.shootInterval - 8);
        obj.screenShake = Math.max(obj.screenShake, 8);
        audio.playBossWarning();
      }
      if (bossHpPct < 0.25 && e.phase === 1) {
        e.phase = 2;
        e.shootInterval = Math.max(6, e.shootInterval - 6);
        obj.screenShake = Math.max(obj.screenShake, 10);
      }
    }

    // Enemy shooting
    e.shootTimer -= ets;
    if (e.shootTimer <= 0) {
      e.shootTimer = e.shootInterval * (e.frozen > 0 ? 3 : 1);
      shootEnemy(e, player, bullets, wave);
    }
  }

  // ─── Move bullets ──────────────────────────────────────────────────────────
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const bts = timeScale;

    // Aim assist / homing for player bullets
    if (b.fromPlayer && enemies.length > 0) {
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
  const enemiesToRemove = new Set<number>();
  const spawnedFromSplit: Enemy[] = [];

  for (const b of bullets) {
    if (!b.fromPlayer || bulletsToRemove.has(b.id)) continue;
    for (const e of enemies) {
      if (enemiesToRemove.has(e.id)) continue;
      const size = getEnemySize(e.type);
      const dx = b.pos.x - e.pos.x, dy = b.pos.y - e.pos.y;
      if (dx * dx + dy * dy < (size + b.size) * (size + b.size)) {
        player.stats.shotsHit++;
        audio.playHit();

        // Hit shield first
        if (e.shieldHp > 0) {
          e.shieldHp -= b.damage * 0.6;
          floatingTexts.push(makeFloatingText(b.pos, `${Math.ceil(b.damage)}`, "#93c5fd"));
          particles.push(...makeBurst(b.pos, "#93c5fd", 4));
          if (b.pierce <= 0) bulletsToRemove.add(b.id);
          continue;
        }

        // Crit calculation
        let dmg = b.damage;
        const isCrit = Math.random() < player.critChance;
        if (isCrit) {
          dmg *= player.critMultiplier;
          particles.push(...makeBurst(b.pos, "#fff", 6));
          floatingTexts.push(makeFloatingText(b.pos, `${Math.ceil(dmg)}!`, "#fbbf24", true));
        } else {
          floatingTexts.push(makeFloatingText(b.pos, `${Math.ceil(dmg)}`, "#fff"));
        }

        e.hp -= dmg;
        player.stats.damageDealt += dmg;

        // Status effects
        if (Math.random() < player.burnChance)   { e.burning  = Math.max(e.burning,  180); particles.push(...makeBurst(b.pos, "#f97316", 3)); }
        if (Math.random() < player.freezeChance) { e.frozen   = Math.max(e.frozen,   120); particles.push(...makeBurst(b.pos, "#bfdbfe", 3)); }
        if (Math.random() < player.poisonChance) { e.poisoned = Math.max(e.poisoned, 240); particles.push(...makeBurst(b.pos, "#4ade80", 3)); }

        // Lightning chain
        if (Math.random() < player.lightningChance) {
          chainLightning(e, enemies, lightnings, player.lightningChain, dmg * 0.6);
        }

        // Life steal
        if (player.lifeSteal > 0) {
          player.hp = Math.min(player.hp + dmg * player.lifeSteal, player.maxHp);
        }

        // Heal on kill check & enemy defeat
        if (e.hp <= 0) {
          audio.playExplosion(e.isBoss);
          obj.screenShake = Math.max(obj.screenShake, e.isBoss ? 15 : (e.isElite ? 7 : 3));

          // Combo tracking
          player.combo++;
          player.comboTimer = 180;

          if (getUpgradeLevel(player, "heal_on_kill") > 0) {
            player.hp = Math.min(player.hp + 2 * getUpgradeLevel(player, "heal_on_kill"), player.maxHp);
          }
          const xpBoostLevel = getUpgradeLevel(player, "xp_boost");
          const xpGained = Math.floor(e.xp * (1 + xpBoostLevel * 0.2));
          enemiesToRemove.add(e.id);
          input.onKill(xpGained, e.pos, e.isBoss);

          const comboBonus = 1 + (player.combo > 1 ? player.combo * 0.05 : 0);
          player.score += Math.floor(e.xp * 10 * player.goldMultiplier * comboBonus);
          player.kills++;
          if (e.isElite) player.stats.elitesKilled++;
          if (e.isBoss) player.stats.bossesKilled++;

          // Explosion
          if (player.explosiveBullets) {
            explodeArea(e.pos, player.explosionRadius, enemies, enemiesToRemove, particles, obj.explosions, player);
          }

          // Splitter mechanic: spawns 2 mini scouts on defeat
          if (e.type === "splitter") {
            for (let s = -1; s <= 1; s += 2) {
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
                burning: 0,
                poisoned: 0,
                drops: false,
                xp: 4,
              });
            }
          }

          // Random Combat Powerup drop
          const dropChance = e.isBoss ? 1.0 : (e.isElite ? 0.65 : 0.08);
          if (Math.random() < dropChance) {
            const types: PowerupType[] = ["heal", "rapid", "shield", "magnet", "nuke"];
            const pType = types[Math.floor(Math.random() * types.length)];
            powerups.push(makePowerup(e.pos, pType));
          }

          const col = e.isBoss ? "#f43f5e" : (e.isElite ? "#fbbf24" : "#fb923c");
          particles.push(...makeBurst(e.pos, col, e.isBoss ? 45 : (e.isElite ? 25 : 14), e.isBoss));
          xpOrbs.push(makeXpOrb(e.pos, xpGained));
        }

        hit_particle: { particles.push(...makeBurst(b.pos, "#fbbf24", 3)); break hit_particle; }

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
      }
    }
    // Enemy contact
    for (const e of enemies) {
      if (enemiesToRemove.has(e.id)) continue;
      const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
      const size = getEnemySize(e.type);
      if (dx * dx + dy * dy < (size + 16) * (size + 16)) {
        takeDamage(player, e.isBoss ? 22 : 11, particles, obj, input.onDeath);
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
          if (!player.shield) player.shield = { hp: 30, maxHp: 30, regenTimer: 0, active: true };
          else player.shield.hp = player.shield.maxHp;
          player.invincTimer = 180;
          break;
        case "magnet":
          xpOrbs.forEach(o => { o.attracted = true; });
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

  // ─── Wave completion ───────────────────────────────────────────────────────
  if (obj.waveEnemyQueue.length === 0 && enemies.length === 0 && !obj.bossActive) {
    input.onWaveComplete();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  let playerBulletTotal = 0;
  for (const bullet of bullets) if (bullet.fromPlayer) playerBulletTotal++;
  const enemyBulletTotal = bullets.length - playerBulletTotal;
  if (playerBulletTotal > OBJECT_BUDGETS.playerBullets || enemyBulletTotal > OBJECT_BUDGETS.enemyBullets) {
    const playerBullets: Bullet[] = [];
    const enemyBullets: Bullet[] = [];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      const target = bullet.fromPlayer ? playerBullets : enemyBullets;
      const max = bullet.fromPlayer ? OBJECT_BUDGETS.playerBullets : OBJECT_BUDGETS.enemyBullets;
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
  trimOldest(obj.particles, OBJECT_BUDGETS.particles);
  trimOldest(obj.xpOrbs, OBJECT_BUDGETS.xpOrbs);
  trimOldest(obj.floatingTexts, OBJECT_BUDGETS.floatingTexts);
  trimOldest(obj.lightnings, OBJECT_BUDGETS.lightnings);
  trimOldest(obj.mines, OBJECT_BUDGETS.mines);
  trimOldest(obj.explosions, OBJECT_BUDGETS.explosions);
  trimOldest(obj.powerups, OBJECT_BUDGETS.powerups);
}

function makePlayerBullet(player: PlayerState, pos: Vec2, vel: Vec2): Bullet {
  player.stats.shotsFired++;
  return {
    id: uid(), pos: { ...pos }, vel,
    fromPlayer: true,
    damage: player.bulletDamage,
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

function shootEnemy(e: Enemy, player: PlayerState, bullets: Bullet[], wave: number) {
  const dx = player.pos.x - e.pos.x, dy = player.pos.y - e.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const spd = 3.6 + wave * 0.08;
  const color = getEnemyBulletColorLocal(e.type);
  const dmg = e.isBoss ? 2.2 + wave * 0.18 : 1;
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
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + e.angle * 0.03;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * 1.15, y: Math.sin(a) * spd * 1.15 }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    default: {
      bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd, y: (dy / dist) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
    }
  }
}

function chainLightning(source: Enemy, enemies: Enemy[], lightnings: Lightning[], chain: number, dmg: number) {
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
    nearest.hp -= dmg * 0.7;
    current = nearest;
  }
}

function explodeArea(pos: Vec2, radius: number, enemies: Enemy[], toRemove: Set<number>, particles: Particle[], explosions: { id: number; pos: Vec2; radius: number; progress: number }[], player: PlayerState) {
  explosions.push({ id: uid(), pos: { ...pos }, radius, progress: 0 });
  for (const e of enemies) {
    const dx = e.pos.x - pos.x, dy = e.pos.y - pos.y;
    if (dx * dx + dy * dy < radius * radius) {
      e.hp -= player.bulletDamage * 3;
      player.stats.damageDealt += player.bulletDamage * 3;
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
    case "boss_destroyer": return "#ef4444";
    case "boss_mothership": return "#8b5cf6";
    case "boss_dreadnought": return "#f59e0b";
    case "boss_eclipse": return "#06b6d4";
    case "boss_titan": return "#ec4899";
    case "boss_omega": return "#ff0000";
    default: return "#fbbf24";
  }
}
