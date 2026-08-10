import type {
  PlayerState, Bullet, Enemy, Particle, Mine, Lightning,
  Vec2, Star, XpOrb,
} from "./types";

import { spawnEnemy, getEnemySize } from "./enemies";
import type { EnemyType } from "./types";
import { getUpgradeLevel } from "./upgrades";

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

export function makeInitialPlayer(): PlayerState {
  return {
    pos: { x: W / 2, y: H - 90 },
    hp: 100, maxHp: 100,
    speed: 5.2,
    fireRate: 11, // ~5.5 shots per second
    bulletDamage: 1.3,
    bulletSpeed: 13.5,
    bulletSize: 3.5,
    piercing: 0,
    multishot: 0,
    spreadAngle: 0,
    homing: false,
    homingStrength: 0.06,
    satellites: [],
    drones: [],
    shield: { hp: 15, maxHp: 15, regenTimer: 0, active: true }, // Starter 15 HP light shield
    xp: 0, level: 1, xpToNext: 30, // Level up midway through wave 1
    upgrades: [],
    invincTimer: 0,
    magnetRange: 100,
    aura: false, auraDamage: 0.2, auraTimer: 0,
    lasers: 0, laserTimer: 0,
    rearShot: false, rearShotTimer: 0,
    explosiveBullets: false, explosionRadius: 60,
    ricochet: false, ricochetCount: 1,
    mineCount: 0, mineTimer: 0,
    timeSlow: false, timeSlowTimer: 0, timeSlowCooldown: 0,
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
    nukeCharges: 0,
    nukeCooldown: 0,
    mirrorShots: false,
    spiralShot: false, spiralAngle: 0,
    waveShot: false, waveShotTimer: 0,
    snipeMode: false, rapidMode: false,
    score: 0, kills: 0,
  };
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
  blackHolePos: Vec2 | null;
  blackHoleTimer: number;
  explosions: { id: number; pos: Vec2; radius: number; progress: number }[];
  waveEnemyQueue: { type: EnemyType; count: number }[];
  waveSpawnTimer: number;
  bossActive: boolean;
  boss: Enemy | null;
  waveTimer: number;
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
  const { player, bullets, enemies, particles, xpOrbs, mines, lightnings, stars } = obj;
  const { keys, wave, frame, timeSlow } = input;
  const timeScale = timeSlow ? 0.5 : 1;

  // ─── Stars ─────────────────────────────────────────────────────────────────
  for (const s of stars) {
    s.y += s.speed * s.z * 0.6 * timeScale;
    if (s.y > H) { s.y = -5; s.x = Math.random() * W; }
  }

  // ─── Player movement ───────────────────────────────────────────────────────
  const spd = player.speed * timeScale;
  if ((keys.has("ArrowLeft")  || keys.has("a") || keys.has("A")) && player.pos.x > 24) player.pos.x -= spd;
  if ((keys.has("ArrowRight") || keys.has("d") || keys.has("D")) && player.pos.x < W - 24) player.pos.x += spd;
  if ((keys.has("ArrowUp")    || keys.has("w") || keys.has("W")) && player.pos.y > 60)   player.pos.y -= spd;
  if ((keys.has("ArrowDown")  || keys.has("s") || keys.has("S")) && player.pos.y < H - 32) player.pos.y += spd;

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
  if ((keys.has("x") || keys.has("X")) && player.nukeCharges > 0 && player.nukeCooldown === 0) {
    triggerNuke(obj, player, particles);
    player.nukeCharges--;
    player.nukeCooldown = 180;
  }

  player.laserTimer = Math.max(0, player.laserTimer - 1);
  player.waveShotTimer = Math.max(0, player.waveShotTimer - 1);

  // Berserker: fire rate scales with missing HP
  const berserker = getUpgradeLevel(player, "berserker") > 0;
  const hpPct = player.hp / player.maxHp;
  const effectiveFireRate = berserker ? player.fireRate * (0.5 + hpPct * 0.5) : player.fireRate;

  // Auto-fire continuous shooting
  if (frame % Math.max(2, Math.floor(effectiveFireRate)) === 0) {
    firePlayerBullets(bullets, player, enemies, frame);
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
        const dmg = player.bulletDamage * (0.5 + sat.level * 0.35);
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
      const auraR = 70;
      for (const e of enemies) {
        const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
        if (dx * dx + dy * dy < auraR * auraR) {
          e.hp -= player.auraDamage * timeScale;
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
        e.hp -= 5 * player.bulletDamage;
        particles.push(...makeBurst(mine.pos, "#f59e0b", 20, true));
        obj.explosions.push({ id: uid(), pos: { ...mine.pos }, radius: mine.radius * 1.5, progress: 0 });
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

  // ─── Move enemies ──────────────────────────────────────────────────────────
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const ets = e.frozen > 0 ? 0.15 : timeScale;

    // Pattern movement
    e.patternTimer += ets;
    switch (e.movePattern) {
      case "sine":
        e.pos.x += Math.sin(e.patternTimer * 0.04) * 2.4 * ets;
        e.pos.y += e.vel.y * ets;
        break;
      case "zigzag":
        e.pos.x += e.vel.x * (Math.sin(e.patternTimer * 0.06) > 0 ? 1 : -1) * ets;
        e.pos.y += e.vel.y * ets;
        break;
      case "circle":
        e.angle += 0.025 * ets;
        e.pos.x = e.centerX + Math.cos(e.angle) * e.radius;
        e.pos.y = Math.max(e.pos.y + e.vel.y * 0.3 * ets, 90);
        break;
      case "hover":
        e.pos.y = Math.min(e.pos.y + e.vel.y * ets * 0.5, 130 + (e.id % 90));
        e.pos.x += Math.sin(e.patternTimer * 0.03) * 1.5 * ets;
        break;
      case "dive":
        e.pos.x += e.vel.x * ets;
        e.pos.y += e.vel.y * 1.35 * ets;
        break;
      default:
        e.pos.x += e.vel.x * ets;
        e.pos.y += e.vel.y * ets;
    }

    // Wall bounce for x
    if (e.pos.x < 30)     { e.pos.x = 30;     e.vel.x = Math.abs(e.vel.x); }
    if (e.pos.x > W - 30) { e.pos.x = W - 30; e.vel.x = -Math.abs(e.vel.x); }

    // Status effects
    if (e.frozen > 0) e.frozen -= 1;
    if (e.burning > 0) { e.hp -= 0.18 * ets; e.burning -= ets; }
    if (e.poisoned > 0) { e.hp -= 0.10 * ets; e.poisoned -= ets; }

    // Boss phase changes
    if (e.isBoss) {
      const bossHpPct = e.hp / e.maxHp;
      if (bossHpPct < 0.5 && e.phase === 0) { e.phase = 1; e.vel.y *= 1.25; e.shootInterval = Math.max(10, e.shootInterval - 8); }
      if (bossHpPct < 0.25 && e.phase === 1) { e.phase = 2; e.vel.y *= 1.2; e.shootInterval = Math.max(6, e.shootInterval - 6); }
    }

    // Enemy shooting
    e.shootTimer -= ets;
    if (e.shootTimer <= 0) {
      e.shootTimer = e.shootInterval * (e.frozen > 0 ? 3 : 1);
      shootEnemy(e, player, bullets, wave);
    }

    // Off-screen (went past player) - loop back for bosses
    if (!e.isBoss && e.pos.y > H + 40) {
      enemies.splice(i, 1);
      continue;
    }
    if (e.isBoss && e.pos.y > H + 200) e.pos.y = -100;
  }

  // ─── Move bullets ──────────────────────────────────────────────────────────
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const bts = timeScale;

    // Aim assist / homing for player bullets
    if (b.fromPlayer && enemies.length > 0) {
      const isFullHoming = b.homing || player.homing;
      const strength = isFullHoming ? Math.max(player.homingStrength, 0.07) : 0.030;
      const maxDistance = isFullHoming ? 650 : 450;

      let bestTarget: Enemy | null = null;
      let bestScore = -Infinity;

      for (const e of enemies) {
        if (e.pos.y < -40 || e.pos.y > H + 40) continue;

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
        // Hit shield first
        if (e.shieldHp > 0) {
          e.shieldHp -= b.damage * 0.6;
          particles.push(...makeBurst(b.pos, "#93c5fd", 4));
          if (b.pierce <= 0) bulletsToRemove.add(b.id);
          continue;
        }

        // Crit
        let dmg = b.damage;
        const isCrit = Math.random() < player.critChance;
        if (isCrit) { dmg *= player.critMultiplier; particles.push(...makeBurst(b.pos, "#fff", 6)); }

        e.hp -= dmg;

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

        // Heal on kill check
        if (e.hp <= 0) {
          if (getUpgradeLevel(player, "heal_on_kill") > 0) {
            player.hp = Math.min(player.hp + 2 * getUpgradeLevel(player, "heal_on_kill"), player.maxHp);
          }
          const xpBoostLevel = getUpgradeLevel(player, "xp_boost");
          const xpGained = Math.floor(e.xp * (1 + xpBoostLevel * 0.2));
          enemiesToRemove.add(e.id);
          input.onKill(xpGained, e.pos, e.isBoss);
          // Score
          player.score += Math.floor(e.xp * 10 * player.goldMultiplier);
          player.kills++;
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
                movePattern: "straight",
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

          const col = e.isBoss ? "#f43f5e" : "#fb923c";
          particles.push(...makeBurst(e.pos, col, e.isBoss ? 40 : 14, e.isBoss));
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
  if (player.invincTimer <= 0 && !isGhost) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.fromPlayer) continue;
      const dx = b.pos.x - player.pos.x, dy = b.pos.y - player.pos.y;
      if (dx * dx + dy * dy < (18 + b.size) * (18 + b.size)) {
        bullets.splice(i, 1);
        takeDamage(player, b.damage * 7.5, particles, input.onDeath);
      }
    }
    // Enemy contact
    for (const e of enemies) {
      if (enemiesToRemove.has(e.id)) continue;
      const dx = e.pos.x - player.pos.x, dy = e.pos.y - player.pos.y;
      const size = getEnemySize(e.type);
      if (dx * dx + dy * dy < (size + 16) * (size + 16)) {
        takeDamage(player, e.isBoss ? 20 : 10, particles, input.onDeath);
      }
    }
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
      player.xp += orb.value;
      xpOrbs.splice(i, 1);
      // Level up check
      while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level++;
        player.xpToNext = getNextLevelXp(player.level);
        input.onLevelUp(player);
      }
      continue;
    }
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

  // ─── Wave completion ───────────────────────────────────────────────────────
  if (obj.waveEnemyQueue.length === 0 && enemies.length === 0 && !obj.bossActive) {
    input.onWaveComplete();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePlayerBullet(player: PlayerState, pos: Vec2, vel: Vec2): Bullet {
  return {
    id: uid(), pos: { ...pos }, vel,
    fromPlayer: true,
    damage: player.bulletDamage,
    size: player.bulletSize,
    color: player.snipeMode ? "#ffffff" : "#38bdf8",
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
      angle = -Math.PI / 2; // straight up
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
  const spd = 3.4 + wave * 0.07;
  const color = getEnemyBulletColorLocal(e.type);
  const dmg = e.isBoss ? 2.2 + wave * 0.18 : 1;
  const size = e.isBoss ? 6.5 : 4.5;

  switch (e.type) {
    case "bomber": {
      // 6-directional hexagonal ring of bullets
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "sniper": {
      // Precision aimed shot
      bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd * 1.6, y: (dy / dist) * spd * 1.6 }, fromPlayer: false, damage: dmg * 1.6, size: size + 2, color, pierce: 0, homing: false });
      break;
    }
    case "artillery": {
      // 5-directional burst
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * 0.85, y: Math.sin(a) * spd * 0.85 }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "spinner": {
      // Rotating burst of 4
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + e.angle;
        bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd }, fromPlayer: false, damage: dmg, size, color, pierce: 0, homing: false });
      }
      break;
    }
    case "boss_destroyer": {
      // Aimed + side guns
      bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: (dx / dist) * spd * 1.15, y: (dy / dist) * spd * 1.15 }, fromPlayer: false, damage: dmg, size: size + 2, color, pierce: 0, homing: false });
      for (let s2 = -1; s2 <= 1; s2 += 2) {
        bullets.push({ id: uid(), pos: { x: e.pos.x + s2 * 45, y: e.pos.y }, vel: { x: s2 * spd * 0.45, y: spd * 0.95 }, fromPlayer: false, damage: dmg * 0.7, size, color, pierce: 0, homing: false });
      }
      if (e.phase >= 1) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          bullets.push({ id: uid(), pos: { x: e.pos.x, y: e.pos.y }, vel: { x: Math.cos(a) * spd * 0.75, y: Math.sin(a) * spd * 0.75 }, fromPlayer: false, damage: dmg * 0.6, size: size - 1, color, pierce: 0, homing: false });
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
      if (e.hp <= 0) toRemove.add(e.id);
      particles.push(...makeBurst(e.pos, "#f97316", 5));
    }
  }
}

function takeDamage(player: PlayerState, amount: number, particles: Particle[], onDeath: () => void) {
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

function triggerNuke(obj: GameObjects, player: PlayerState, particles: Particle[]) {
  for (const e of obj.enemies) {
    particles.push(...makeBurst(e.pos, "#f43f5e", 20, true));
    obj.xpOrbs.push(makeXpOrb(e.pos, e.xp));
    player.score += Math.floor(e.xp * 10 * player.goldMultiplier);
    player.kills++;
  }
  obj.enemies = [];
  obj.bullets = obj.bullets.filter(b => b.fromPlayer);
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
