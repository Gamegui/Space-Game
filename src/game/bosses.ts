import type {
  ArenaHazard, Bullet, Enemy, EnemyType, FloatingText, Particle, PlayerState, Vec2, XpOrb,
} from "./types";
import { spawnEnemy } from "./enemies";
import { audio } from "./audio";
import { W, H } from "./enemies";

/** Предупреждение тяжёлой атаки: 0.8 с (в диапазоне 0.6–1.0 с из бэклога). */
export const BOSS_TELEGRAPH_FRAMES = 48;
/** Окно уязвимости после большой атаки / смены фазы. */
export const BOSS_VULN_FRAMES = 90;
export const BOSS_VULN_DAMAGE_MULT = 1.4;
const HAZARD_CAP = 12;

/** Базовый урон пули босса. Ранние боссы кусаются, поздние не ваншотят стартовый корпус. */
export function bossBulletBaseDamage(wave: number): number {
  return 2.2 + Math.min(wave, 20) * 0.1 + Math.max(0, wave - 20) * 0.035;
}

/** Контакт с боссом: не убивает с одного касания на волне 50. */
export function bossContactBase(wave: number): number {
  return 16 + Math.min(wave, 25) * 0.32 + Math.max(0, wave - 25) * 0.12;
}

export interface BossRuntime {
  enemies: Enemy[];
  bullets: Bullet[];
  particles: Particle[];
  xpOrbs: XpOrb[];
  floatingTexts: FloatingText[];
  explosions: { id: number; pos: Vec2; radius: number; progress: number }[];
  hazards: ArenaHazard[];
  screenShake: number;
  adaptiveDifficulty: number;
}

export interface BossTools {
  uid: () => number;
  spawnBullet: (pos: Vec2, vel: Vec2, damage: number, size: number, color: string, pierce?: number, homing?: boolean) => Bullet;
  burst: (pos: Vec2, color: string, count: number, big?: boolean) => void;
  makeOrb: (pos: Vec2, value: number) => XpOrb;
  makeText: (pos: Vec2, text: string, color: string, isCrit?: boolean) => FloatingText;
}

export function getBossPhaseLabel(type: EnemyType, phase: number): string {
  const table: Record<string, string[]> = {
    boss_destroyer:  ["ОРУДИЯ", "БОРТОВОЙ ЗАЛП", "ЭСКОРТ", "ПЕРЕКРЁСТНЫЙ ОГОНЬ"],
    boss_mothership: ["РОЙ", "АНГАР ОТКРЫТ", "ДРОНЫ", "РОЕНИЕ"],
    boss_dreadnought:["ЦИТАДЕЛЬ", "ТАРАН", "СТЕНЫ ОГНЯ", "ШТУРМ"],
    boss_eclipse:    ["ЗАТМЕНИЕ", "КОЛОДЕЦ", "ДВОЙНАЯ ТЯГА", "КОЛЛАПС"],
    boss_titan:      ["ДРЕВНИЙ", "СЕЙСМИКА", "МАГМА", "ЯРОСТЬ"],
    boss_omega:      ["ПРОБУЖДЕНИЕ", "АДАПТАЦИЯ", "РАЗРЫВ ФОРМЫ", "ФИНАЛЬНАЯ ФОРМА"],
  };
  const labels = table[type];
  if (!labels) return "";
  return labels[Math.max(0, Math.min(labels.length - 1, phase))] ?? "";
}

export function getBossMechanicHint(type: EnemyType): string {
  switch (type) {
    case "boss_destroyer":   return "ЧИТАЙ ЛИНИИ ЗАЛПА — УКЛОНЯЙСЯ";
    case "boss_mothership":  return "БЕЙ, КОГДА АНГАР ОТКРЫТ";
    case "boss_dreadnought": return "СТЕНЫ ОГНЯ И ТАРАН";
    case "boss_eclipse":     return "КОЛОДЦЫ ТЯНУТ — ДЕРЖИ ДИСТАНЦИЮ";
    case "boss_titan":       return "УХОДИ ИЗ КРУГОВ УДАРА";
    case "boss_omega":       return "ЧИТАЙ ТЕЛЕГРАФ — ПРОРЕЗИ В КОЛЬЦАХ";
    default: return "";
  }
}

export function makeHazard(partial: Omit<ArenaHazard, "id"> & { id?: number }, uid: () => number): ArenaHazard {
  return {
    id: partial.id ?? uid(),
    kind: partial.kind,
    x: partial.x,
    y: partial.y,
    x2: partial.x2,
    y2: partial.y2,
    r: partial.r,
    w: partial.w,
    h: partial.h,
    angle: partial.angle,
    warn: partial.warn,
    active: partial.active,
    color: partial.color,
    damage: partial.damage,
    pull: partial.pull ?? 0,
    vx: partial.vx ?? 0,
    vy: partial.vy ?? 0,
    shrink: partial.shrink ?? 0,
  };
}

function pushHazard(world: BossRuntime, h: ArenaHazard): void {
  if (world.hazards.length >= HAZARD_CAP) world.hazards.shift();
  world.hazards.push(h);
}

function enterPhase(
  world: BossRuntime,
  e: Enemy,
  phase: number,
  label: string,
  tools: BossTools,
): void {
  e.phase = phase;
  e.frozen = 0;
  e.controlImmunity = 120;
  e.vulnerableTimer = BOSS_VULN_FRAMES;
  e.telegraphTimer = 0;
  e.specialTimer = 40;
  world.screenShake = Math.max(world.screenShake, 10 + phase * 2);
  world.floatingTexts.push(tools.makeText(e.pos, label, phase >= 3 ? "#ffffff" : "#f43f5e", true));
  audio.playBossPhase();
  tools.burst(e.pos, "#f43f5e", 16, true);
  const xp = Math.max(10, Math.floor(e.xp * 0.12));
  world.xpOrbs.push(tools.makeOrb({ x: e.pos.x - 18, y: e.pos.y }, xp));
  world.xpOrbs.push(tools.makeOrb({ x: e.pos.x + 18, y: e.pos.y }, Math.floor(xp * 0.6)));
}

function spawnAdd(world: BossRuntime, type: EnemyType, wave: number, near: Vec2): void {
  if (world.enemies.length >= 18) return;
  const add = spawnEnemy(type, wave, world.adaptiveDifficulty);
  add.pos = {
    x: Math.max(40, Math.min(W - 40, near.x + (Math.random() - 0.5) * 160)),
    y: Math.max(70, Math.min(280, near.y + 40 + Math.random() * 50)),
  };
  add.centerX = add.pos.x;
  add.centerY = add.pos.y;
  add.targetY = add.pos.y;
  world.enemies.push(add);
}

function aimed(player: PlayerState, from: Vec2): { dx: number; dy: number; dist: number; ang: number } {
  const dx = player.pos.x - from.x, dy = player.pos.y - from.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  return { dx, dy, dist, ang: Math.atan2(dy, dx) };
}

function ringBullets(
  world: BossRuntime,
  tools: BossTools,
  pos: Vec2,
  count: number,
  speed: number,
  dmg: number,
  size: number,
  color: string,
  spin = 0,
): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + spin;
    world.bullets.push(tools.spawnBullet(pos, { x: Math.cos(a) * speed, y: Math.sin(a) * speed }, dmg, size, color, 0, false));
  }
}

/** Смена фаз 75/50/25% + уникальные спецатаки с телеграфами. */
export function tickBossFight(
  world: BossRuntime,
  e: Enemy,
  player: PlayerState,
  wave: number,
  frame: number,
  timeScale: number,
  tools: BossTools,
): void {
  e.specialTimer = (e.specialTimer ?? 0) - timeScale;
  const wasTelegraphing = (e.telegraphTimer ?? 0) > 0;
  e.telegraphTimer = Math.max(0, (e.telegraphTimer ?? 0) - timeScale);
  e.vulnerableTimer = Math.max(0, (e.vulnerableTimer ?? 0) - timeScale);
  e.ramTimer = Math.max(0, (e.ramTimer ?? 0) - timeScale);
  if (wasTelegraphing && (e.telegraphTimer ?? 0) <= 0) {
    resolveBossTelegraph(world, e, player, wave, tools);
  }

  if ((e.ramTimer ?? 0) > 0) {
    const tx = e.aimAngle ?? player.pos.x;
    const dx = tx - e.pos.x;
    e.pos.x += Math.sign(dx) * Math.min(16 * timeScale, Math.abs(dx));
  }

  const hpPct = e.hp / e.maxHp;
  const phaseLabel = getBossPhaseLabel(e.type, Math.min(3, e.phase + 1));

  if (e.type === "boss_omega") {
    if (hpPct < 0.75 && e.phase === 0) {
      enterPhase(world, e, 1, "ОМЕГА: АДАПТАЦИЯ", tools);
      e.maxShieldHp = Math.max(e.maxShieldHp, e.maxHp * 0.05);
      e.shieldHp = e.maxShieldHp;
      e.shootInterval = Math.max(36, e.shootInterval - 2);
    } else if (hpPct < 0.5 && e.phase === 1) {
      enterPhase(world, e, 2, "ОМЕГА: РАЗРЫВ ФОРМЫ", tools);
      spawnAdd(world, "scout", wave, e.pos);
      e.shootInterval = Math.max(34, e.shootInterval - 2);
    } else if (hpPct < 0.25 && e.phase === 2) {
      enterPhase(world, e, 3, "ФИНАЛЬНАЯ ФОРМА ОМЕГИ", tools);
      spawnAdd(world, "fighter", wave, e.pos);
      e.shootInterval = Math.max(32, e.shootInterval - 2);
    }
  } else if (hpPct < 0.75 && e.phase === 0) {
    enterPhase(world, e, 1, phaseLabel, tools);
    onUniquePhase(world, e, 1, wave, player, tools);
  } else if (hpPct < 0.5 && e.phase === 1) {
    enterPhase(world, e, 2, phaseLabel, tools);
    onUniquePhase(world, e, 2, wave, player, tools);
  } else if (hpPct < 0.25 && e.phase === 2) {
    enterPhase(world, e, 3, phaseLabel, tools);
    onUniquePhase(world, e, 3, wave, player, tools);
  }

  // Арена-модификаторы, которые живут всю фазу.
  applyArenaPassive(world, e, player, tools);

  if ((e.specialTimer ?? 0) <= 0 && (e.telegraphTimer ?? 0) <= 0) {
    startSpecial(world, e, player, wave, tools);
  }

  // Омега в финале чуть дрейфует к игроку, но больше не затягивает корабль
  // в центр (это делало уклонение невозможным без мега-сборки).
  if (e.type === "boss_omega" && e.phase >= 3) {
    const rdx = player.pos.x - e.pos.x, rdy = player.pos.y - e.pos.y;
    const rdist = Math.max(1, Math.sqrt(rdx * rdx + rdy * rdy));
    if (rdist > 140) {
      e.pos.x += (rdx / rdist) * 0.18;
      e.pos.y += (rdy / rdist) * 0.08;
    }
  }

  void frame;
}

function onUniquePhase(
  world: BossRuntime,
  e: Enemy,
  phase: number,
  wave: number,
  player: PlayerState,
  tools: BossTools,
): void {
  switch (e.type) {
    case "boss_destroyer":
      if (phase === 2) {
        spawnAdd(world, "fighter", wave, e.pos);
        spawnAdd(world, "fighter", wave, e.pos);
      }
      e.shootInterval = Math.max(28, e.shootInterval - 4);
      break;
    case "boss_mothership":
      if (phase === 1) {
        spawnAdd(world, "scout", wave, e.pos);
        spawnAdd(world, "scout", wave, e.pos);
      }
      if (phase === 3) spawnAdd(world, "kamikaze", wave, e.pos);
      e.shootInterval = Math.max(28, e.shootInterval - 3);
      break;
    case "boss_dreadnought":
      if (phase === 1) {
        e.maxShieldHp = Math.max(e.maxShieldHp, e.maxHp * 0.12);
        e.shieldHp = e.maxShieldHp;
      }
      if (phase === 2) spawnAdd(world, "tank", wave, e.pos);
      e.shootInterval = Math.max(26, e.shootInterval - 3);
      break;
    case "boss_eclipse":
      if (phase === 1) {
        pushHazard(world, makeHazard({
          kind: "well", x: e.pos.x, y: e.pos.y, r: 160,
          warn: 0, active: 9999, color: "#22d3ee", damage: 0, pull: 0.22,
        }, tools.uid));
      }
      if (phase === 2) {
        pushHazard(world, makeHazard({
          kind: "well", x: 180, y: 280, r: 130,
          warn: BOSS_TELEGRAPH_FRAMES, active: 9999, color: "#67e8f9", damage: 0, pull: 0.28,
        }, tools.uid));
        pushHazard(world, makeHazard({
          kind: "well", x: W - 180, y: 280, r: 130,
          warn: BOSS_TELEGRAPH_FRAMES, active: 9999, color: "#67e8f9", damage: 0, pull: 0.28,
        }, tools.uid));
      }
      if (phase === 3) {
        pushHazard(world, makeHazard({
          kind: "ring", x: W / 2, y: H / 2, r: 340,
          warn: BOSS_TELEGRAPH_FRAMES, active: 480, color: "#06b6d4", damage: 16, pull: 0, shrink: 0.55,
        }, tools.uid));
      }
      e.shootInterval = Math.max(26, e.shootInterval - 3);
      break;
    case "boss_titan":
      if (phase === 2) {
        for (let i = 0; i < 3; i++) {
          pushHazard(world, makeHazard({
            kind: "circle",
            x: 180 + i * 280, y: 260 + (i % 2) * 80, r: 70,
            warn: BOSS_TELEGRAPH_FRAMES, active: 9999,
            color: "#fb7185", damage: 14, pull: 0,
            vx: (i % 2 === 0 ? 1.4 : -1.4), vy: 0.6,
          }, tools.uid));
        }
      }
      if (phase === 3) {
        spawnAdd(world, "tank", wave, e.pos);
        spawnAdd(world, "charger", wave, e.pos);
      }
      e.shootInterval = Math.max(28, e.shootInterval - 3);
      break;
    default:
      e.shootInterval = Math.max(28, e.shootInterval - 4);
  }
  void player;
}

function applyArenaPassive(world: BossRuntime, e: Enemy, player: PlayerState, tools: BossTools): void {
  if (e.type === "boss_eclipse") {
    // Колодец на корпусе следует за боссом.
    for (const h of world.hazards) {
      if (h.kind === "well" && h.pull > 0 && h.r >= 150) {
        h.x = e.pos.x;
        h.y = e.pos.y;
      }
    }
  }
  void tools; void player;
}

function startSpecial(
  world: BossRuntime,
  e: Enemy,
  player: PlayerState,
  wave: number,
  tools: BossTools,
): void {
  void wave;
  const color = bulletColor(e.type);
  switch (e.type) {
    case "boss_destroyer": {
      // Бортовой залп: вертикальные (и с фазы 1 — горизонтальные) линии.
      const beams = e.phase >= 3 ? 3 : e.phase >= 1 ? 2 : 1;
      pushHazard(world, makeHazard({
        kind: "beam", x: player.pos.x, y: 40, x2: player.pos.x, y2: H - 40,
        r: 16, warn: BOSS_TELEGRAPH_FRAMES, active: 18, color: "#f87171", damage: 18, pull: 0,
      }, tools.uid));
      if (beams >= 2) {
        pushHazard(world, makeHazard({
          kind: "beam", x: 40, y: player.pos.y, x2: W - 40, y2: player.pos.y,
          r: 14, warn: BOSS_TELEGRAPH_FRAMES, active: 18, color: "#fb7185", damage: 16, pull: 0,
        }, tools.uid));
      }
      if (beams >= 3) {
        pushHazard(world, makeHazard({
          kind: "beam", x: player.pos.x + 90, y: 40, x2: player.pos.x + 90, y2: H - 40,
          r: 12, warn: BOSS_TELEGRAPH_FRAMES, active: 16, color: "#fca5a5", damage: 14, pull: 0,
        }, tools.uid));
      }
      e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
      e.specialTimer = e.phase >= 2 ? 160 : 200;
      e.vulnerableTimer = Math.max(e.vulnerableTimer ?? 0, 50);
      break;
    }
    case "boss_mothership": {
      // Телеграф люков → адды. После выпуска — окно урона.
      for (let i = 0; i < (e.phase >= 2 ? 3 : 2); i++) {
        const hx = 160 + i * 220 + (Math.random() - 0.5) * 40;
        pushHazard(world, makeHazard({
          kind: "circle", x: hx, y: e.pos.y + 70, r: 36,
          warn: BOSS_TELEGRAPH_FRAMES, active: 12, color: "#c4b5fd", damage: 10, pull: 0,
        }, tools.uid));
      }
      e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
      e.specialTimer = 220;
      // Фактический спавн произойдёт, когда телеграф кончится — помечаем aimAngle как «hatch».
      e.aimAngle = 1;
      break;
    }
    case "boss_dreadnought": {
      if (e.phase === 0) {
        pushHazard(world, makeHazard({
          kind: "band", x: W / 2, y: H * 0.55, r: 0, w: W, h: 70,
          warn: BOSS_TELEGRAPH_FRAMES, active: 36, color: "#fbbf24", damage: 16, pull: 0,
        }, tools.uid));
        e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
        e.specialTimer = 210;
      } else if (e.phase === 1 || e.phase >= 3) {
        const tx = player.pos.x;
        e.aimAngle = tx;
        pushHazard(world, makeHazard({
          kind: "beam", x: tx, y: 20, x2: tx, y2: H - 30,
          r: 28, warn: BOSS_TELEGRAPH_FRAMES, active: 22, color: "#f59e0b", damage: 20, pull: 0,
        }, tools.uid));
        e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
        e.ramTimer = BOSS_TELEGRAPH_FRAMES + 28;
        e.specialTimer = 240;
        e.vulnerableTimer = Math.max(e.vulnerableTimer ?? 0, 80);
      } else {
        // Фаза 2: сжатие арены двумя полосами.
        pushHazard(world, makeHazard({
          kind: "band", x: W / 2, y: 110, r: 0, w: W, h: 80,
          warn: BOSS_TELEGRAPH_FRAMES, active: 90, color: "#f59e0b", damage: 15, pull: 0, vy: 0.55,
        }, tools.uid));
        pushHazard(world, makeHazard({
          kind: "band", x: W / 2, y: H - 80, r: 0, w: W, h: 80,
          warn: BOSS_TELEGRAPH_FRAMES, active: 90, color: "#f59e0b", damage: 15, pull: 0, vy: -0.55,
        }, tools.uid));
        e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
        e.specialTimer = 260;
      }
      break;
    }
    case "boss_eclipse": {
      // Схлопывающееся кольцо вокруг игрока.
      pushHazard(world, makeHazard({
        kind: "ring", x: player.pos.x, y: player.pos.y, r: 160,
        warn: BOSS_TELEGRAPH_FRAMES, active: 50, color: "#22d3ee", damage: 14, pull: 0, shrink: 1.6,
      }, tools.uid));
      e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
      e.specialTimer = e.phase >= 2 ? 170 : 210;
      break;
    }
    case "boss_titan": {
      pushHazard(world, makeHazard({
        kind: "circle", x: player.pos.x, y: player.pos.y, r: 95,
        warn: BOSS_TELEGRAPH_FRAMES, active: 20, color: "#f472b6", damage: 20, pull: 0,
      }, tools.uid));
      e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
      e.aimAngle = 2; // slam → кольцо пуль, когда телеграф кончится
      e.specialTimer = e.phase >= 2 ? 170 : 220;
      e.vulnerableTimer = Math.max(e.vulnerableTimer ?? 0, 70);
      break;
    }
    case "boss_omega": {
      // Одна тяжёлая атака за раз: либо луч, либо кольцо с прорезями — не оба.
      const useBeam = e.phase >= 2 && Math.random() < 0.5;
      if (useBeam) {
        const aim = aimed(player, e.pos);
        pushHazard(world, makeHazard({
          kind: "beam",
          x: e.pos.x, y: e.pos.y,
          x2: e.pos.x + Math.cos(aim.ang) * 900,
          y2: e.pos.y + Math.sin(aim.ang) * 900,
          r: 16, warn: BOSS_TELEGRAPH_FRAMES, active: 16, color: "#ffffff", damage: 18, pull: 0,
        }, tools.uid));
        e.aimAngle = 4;
      } else {
        pushHazard(world, makeHazard({
          kind: "ring", x: e.pos.x, y: e.pos.y, r: 90,
          warn: BOSS_TELEGRAPH_FRAMES, active: 16, color: "#ff4444", damage: 16, pull: 0, shrink: -2.4,
        }, tools.uid));
        e.aimAngle = 3;
      }
      e.telegraphTimer = BOSS_TELEGRAPH_FRAMES;
      e.specialTimer = e.phase >= 3 ? 200 : 240;
      e.vulnerableTimer = Math.max(e.vulnerableTimer ?? 0, 90);
      break;
    }
    default:
      e.specialTimer = 240;
  }
  void color;
}

/**
 * Когда телеграф босса только что истёк — выпускаем удар (пули / адды).
 * Вызывается из gameLoop, если telegraphTimer перешёл через 0.
 */
export function resolveBossTelegraph(
  world: BossRuntime,
  e: Enemy,
  player: PlayerState,
  wave: number,
  tools: BossTools,
): void {
  const color = bulletColor(e.type);
  const spd = 3.6 + wave * 0.08;
  const dmg = bossBulletBaseDamage(wave);
  if (e.type === "boss_mothership" && (e.aimAngle ?? 0) === 1) {
    spawnAdd(world, e.phase >= 2 ? "kamikaze" : "scout", wave, { x: e.pos.x, y: e.pos.y + 40 });
    spawnAdd(world, "scout", wave, { x: e.pos.x + 80, y: e.pos.y + 30 });
    e.vulnerableTimer = Math.max(e.vulnerableTimer ?? 0, BOSS_VULN_FRAMES);
    e.aimAngle = 0;
    tools.burst(e.pos, "#c4b5fd", 12, true);
  }
  if (e.type === "boss_titan" && (e.aimAngle ?? 0) === 2) {
    ringBullets(world, tools, { x: player.pos.x, y: player.pos.y }, 8, spd * 0.9, dmg, 6, color);
    world.screenShake = Math.max(world.screenShake, 8);
    e.aimAngle = 0;
  }
  if (e.type === "boss_omega" && (e.aimAngle ?? 0) === 3) {
    // 7 пуль = широкие прорези; это удар, не ковёр.
    ringBullets(world, tools, e.pos, 7, 2.7, dmg, 6, "#ff4444");
    world.screenShake = Math.max(world.screenShake, 6);
    e.aimAngle = 0;
  }
  if (e.type === "boss_omega" && (e.aimAngle ?? 0) === 4) {
    const aim = aimed(player, e.pos);
    world.bullets.push(tools.spawnBullet(
      e.pos, { x: Math.cos(aim.ang) * spd * 2.0, y: Math.sin(aim.ang) * spd * 2.0 },
      dmg * 1.35, 9, "#ffffff", 1, false,
    ));
    world.screenShake = Math.max(world.screenShake, 5);
    e.aimAngle = 0;
  }
  if (e.type === "boss_destroyer") {
    // Пули вдоль телеграфных линий — добивают того, кто не ушёл.
    world.bullets.push(tools.spawnBullet(
      { x: player.pos.x, y: e.pos.y }, { x: 0, y: spd * 1.6 }, dmg * 1.4, 8, color, 1, false,
    ));
  }
}

export function playerHitsHazard(player: PlayerState, h: ArenaHazard): boolean {
  const px = player.pos.x, py = player.pos.y;
  switch (h.kind) {
    case "circle":
    case "well": {
      const dx = px - h.x, dy = py - h.y;
      return dx * dx + dy * dy < h.r * h.r;
    }
    case "ring": {
      const dx = px - h.x, dy = py - h.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      return Math.abs(d - h.r) < 16;
    }
    case "beam": {
      return distToSeg(px, py, h.x, h.y, h.x2 ?? h.x, h.y2 ?? h.y) < (h.r + 10);
    }
    case "band": {
      const hw = (h.w ?? 80) / 2, hh = (h.h ?? 40) / 2;
      return px > h.x - hw && px < h.x + hw && py > h.y - hh && py < h.y + hh;
    }
    default:
      return false;
  }
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function tickHazards(
  hazards: ArenaHazard[],
  player: PlayerState,
  timeScale: number,
  onPull: (dx: number, dy: number) => void,
  onHit: (damage: number) => void,
): void {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (h.warn > 0) h.warn -= timeScale;
    else h.active -= timeScale;

    if (h.vx || h.vy) {
      h.x += (h.vx ?? 0) * timeScale;
      h.y += (h.vy ?? 0) * timeScale;
      if (h.x < 60 || h.x > W - 60) h.vx = -(h.vx ?? 0);
      if (h.y < 80 || h.y > H - 80) h.vy = -(h.vy ?? 0);
    }
    if (h.shrink) {
      h.r = Math.max(40, h.r - h.shrink * timeScale);
    }

    const live = h.warn <= 0 && h.active > 0;
    if (live && h.pull) {
      const dx = h.x - player.pos.x, dy = h.y - player.pos.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      if (dist < h.r + 80) onPull((dx / dist) * h.pull, (dy / dist) * h.pull);
    }
    if (live && h.damage > 0 && playerHitsHazard(player, h)) onHit(h.damage);

    if (h.warn <= 0 && h.active <= 0) hazards.splice(i, 1);
  }
}

function bulletColor(type: EnemyType): string {
  switch (type) {
    case "boss_destroyer": return "#ef4444";
    case "boss_mothership": return "#8b5cf6";
    case "boss_dreadnought": return "#f59e0b";
    case "boss_eclipse": return "#06b6d4";
    case "boss_titan": return "#ec4899";
    case "boss_omega": return "#ff0000";
    default: return "#fbbf24";
  }
}
