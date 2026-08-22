export interface Vec2 { x: number; y: number; }

export type ShipClassId = "interceptor" | "dreadnought" | "tempest" | "commander" | "void_wraith";

export interface ShipClassDef {
  id: ShipClassId;
  name: string;
  subtitle: string;
  icon: string;
  description: string;
  perks: string[];
  color: string;
  premium?: boolean;
}

export interface FloatingText {
  id: number;
  pos: Vec2;
  vel: Vec2;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  isCrit?: boolean;
}

export type PowerupType = "heal" | "rapid" | "shield" | "magnet" | "nuke";

export interface PowerupItem {
  id: number;
  pos: Vec2;
  vel: Vec2;
  type: PowerupType;
  life: number;
}

export interface Bullet {
  id: number;
  pos: Vec2;
  vel: Vec2;
  fromPlayer: boolean;
  damage: number;
  size: number;
  color: string;
  pierce: number;
  homing: boolean;
  homingTarget?: number;
}

export interface Enemy {
  id: number;
  pos: Vec2;
  vel: Vec2;
  hp: number;
  maxHp: number;
  type: EnemyType;
  shootTimer: number;
  shootInterval: number;
  isBoss: boolean;
  isElite?: boolean;
  eliteName?: string;
  phase: number;
  angle: number;
  radius: number;
  centerX: number;
  centerY?: number;
  targetY?: number;
  movePattern: MovePattern;
  patternTimer: number;
  shieldHp: number;
  maxShieldHp: number;
  frozen: number;
  burning: number;
  poisoned: number;
  drops: boolean;
  xp: number;
}

export type EnemyType =
  | "scout" | "fighter" | "bomber" | "sniper" | "splitter" | "tank"
  | "stealth" | "healer" | "charger" | "spinner" | "kamikaze" | "artillery"
  | "warden" | "phantom" | "leecher" | "carrier" | "singularity"
  | "boss_destroyer" | "boss_mothership" | "boss_dreadnought"
  | "boss_eclipse" | "boss_titan" | "boss_omega";

export type MovePattern =
  | "straight" | "sine" | "circle" | "zigzag" | "dive" | "hover" | "patrol";

export interface Particle {
  id: number;
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  glow: boolean;
  shape: "circle" | "square" | "star" | "ring";
}

export interface Star { x: number; y: number; z: number; speed: number; }

export interface Satellite {
  angle: number;
  radius: number;
  speed: number;
  level: number;
  shootTimer: number;
}

export interface Drone {
  id: number;
  pos: Vec2;
  angle: number;
  orbitAngle: number;
  orbitRadius: number;
  speed: number;
  shootTimer: number;
  level: number;
}

export interface Shield {
  hp: number;
  maxHp: number;
  regenTimer: number;
  active: boolean;
}

export interface Lightning {
  id: number;
  from: Vec2;
  to: Vec2;
  life: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  category: string;
  maxLevel: number;
  apply: (state: PlayerState, level: number) => void;
}

export interface PlayerUpgrade {
  id: string;
  level: number;
}

export interface PlayerState {
  shipClass: ShipClassId;
  pos: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  fireRate: number;
  bulletDamage: number;
  bulletSpeed: number;
  bulletSize: number;
  piercing: number;
  multishot: number;
  spreadAngle: number;
  homing: boolean;
  homingStrength: number;
  satellites: Satellite[];
  drones: Drone[];
  shield: Shield | null;
  xp: number;
  level: number;
  xpToNext: number;
  upgrades: PlayerUpgrade[];
  invincTimer: number;
  magnetRange: number;
  aura: boolean;
  auraDamage: number;
  auraTimer: number;
  lasers: number;
  laserTimer: number;
  rearShot: boolean;
  rearShotTimer: number;
  explosiveBullets: boolean;
  explosionRadius: number;
  ricochet: boolean;
  ricochetCount: number;
  mineCount: number;
  mineTimer: number;
  timeSlow: boolean;
  timeSlowTimer: number;
  timeSlowCooldown: number;
  critChance: number;
  critMultiplier: number;
  lifeSteal: number;
  burnChance: number;
  freezeChance: number;
  poisonChance: number;
  lightningChance: number;
  lightningChain: number;
  goldMultiplier: number;
  regenRate: number;
  regenTimer: number;
  ghostMode: boolean;
  ghostTimer: number;
  teleportCooldown: number;
  teleportTimer: number;
  blackHole: boolean;
  blackHoleTimer: number;
  blackHoleCooldown: number;
  nukeCharges: number;
  nukeCooldown: number;
  dashCooldown: number;
  dashTimer: number;
  mirrorShots: boolean;
  spiralShot: boolean;
  spiralAngle: number;
  waveShot: boolean;
  waveShotTimer: number;
  snipeMode: boolean;
  rapidMode: boolean;
  rapidBoostTimer: number; // powerup boost
  score: number;
  kills: number;
  combo: number;
  comboTimer: number;
  stats: {
    damageDealt: number;
    shotsFired: number;
    shotsHit: number;
    elitesKilled: number;
    bossesKilled: number;
    powerupsCollected: number;
  };
}

export interface XpOrb {
  id: number;
  pos: Vec2;
  vel: Vec2;
  value: number;
  attracted: boolean;
}

export interface Mine {
  id: number;
  pos: Vec2;
  timer: number;
  radius: number;
}

export type GamePhase = "menu" | "ship_select" | "playing" | "upgrade" | "boss_intro" | "paused" | "dead" | "victory";
