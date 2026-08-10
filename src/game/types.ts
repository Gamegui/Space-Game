export interface Vec2 { x: number; y: number; }

export interface Bullet {
  id: number;
  pos: Vec2;
  vel: Vec2;
  fromPlayer: boolean;
  damage: number;
  size: number;
  color: string;
  pierce: number; // how many enemies it can pass through
  homing: boolean;
  homingTarget?: number; // enemy id
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
  phase: number; // boss phase
  angle: number; // for circular movement
  radius: number; // for circular movement
  centerX: number;
  movePattern: MovePattern;
  patternTimer: number;
  shieldHp: number;
  maxShieldHp: number;
  frozen: number; // frames frozen
  burning: number; // frames burning
  poisoned: number;
  drops: boolean;
  xp: number;
}

export type EnemyType =
  | "scout" | "fighter" | "bomber" | "sniper" | "splitter" | "tank"
  | "stealth" | "healer" | "charger" | "spinner" | "kamikaze" | "artillery"
  | "boss_destroyer" | "boss_mothership" | "boss_dreadnought"
  | "boss_eclipse" | "boss_titan" | "boss_omega";

export type MovePattern =
  | "straight" | "sine" | "circle" | "zigzag" | "dive" | "hover";

export interface Particle {
  id: number;
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  glow: boolean;
  shape: "circle" | "square" | "star";
}

export interface Star { x: number; y: number; z: number; speed: number; }

export interface Satellite {
  angle: number;
  radius: number;
  speed: number;
  level: number; // damage level
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
  pos: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  fireRate: number; // lower = faster
  bulletDamage: number;
  bulletSpeed: number;
  bulletSize: number;
  piercing: number;
  multishot: number; // extra bullets per shot
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
  aura: boolean; // damage aura
  auraDamage: number;
  auraTimer: number;
  lasers: number; // side laser count
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
  mirrorShots: boolean;
  spiralShot: boolean;
  spiralAngle: number;
  waveShot: boolean;
  waveShotTimer: number;
  snipeMode: boolean;
  rapidMode: boolean;
  score: number;
  kills: number;
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

export type GamePhase = "menu" | "playing" | "upgrade" | "boss_intro" | "paused" | "dead" | "victory";
