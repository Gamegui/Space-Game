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
  /** Удержанная цель самонаведения (до смерти/выхода за дистанцию). */
  target?: Enemy;
  /** Уже поражённые этим снарядом цели (не даёт пробитию бить одну цель повторно). */
  hitList?: Enemy[];
  /** Оставшиеся кадры полёта (undefined = без ограничения). */
  life?: number;
  /** Разрывы Пустоты: сколько раз снаряд телепортировался (макс. 2). */
  voidJumps?: number;
  /** «Фазовый разряд»: снаряд сам является осколком — осколки не порождают
   *  осколки (иначе неубиваемые цели кортежа дают экспоненциальный цепной
   *  взрыв массива пуль прямо во время for...of — OOM/фриз, v1.8.1). */
  shardBorn?: boolean;
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
  controlResistance: number;
  controlImmunity: number;
  controlDecayTimer: number;
  guardRole?: "herald" | "reaper" | "eye" | "anchor";
  guardDamageFrame?: number;
  guardDamageThisFrame?: number;
  guardLinkMultiplier?: number;
  guardFrameDamageCap?: number;
  guardMarkedTimer?: number;
  burning: number;
  poisoned: number;
  drops: boolean;
  xp: number;
  /** Кадры до следующей спецатаки босса. */
  specialTimer?: number;
  /** Кадры текущего телеграфа (стрельба-филлер молчит). */
  telegraphTimer?: number;
  /** Окно уязвимости: входящий урон ×1.4. */
  vulnerableTimer?: number;
  /** Цель тарана (X) или флаг спецатаки. */
  aimAngle?: number;
  /** Кадры рывка-тарана. */
  ramTimer?: number;
}

/** Арена-телеграф / зона опасности босса. warn>0 — предупреждение, active — удар. */
export interface ArenaHazard {
  id: number;
  kind: "circle" | "beam" | "band" | "well" | "ring";
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r: number;
  w?: number;
  h?: number;
  angle?: number;
  warn: number;
  active: number;
  color: string;
  damage: number;
  pull: number;
  vx?: number;
  vy?: number;
  shrink?: number;
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
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
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
  /** «Широкий сектор»: доля сужения разброса крайних снарядов (0..0.2). */
  spreadTighten: number;
  homing: boolean;
  homingStrength: number;
  satellites: Satellite[];
  drones: Drone[];
  shield: Shield | null;
  /** «Конденсатор щита»: множитель скорости восстановления щита. */
  shieldRegenMultiplier: number;
  xp: number;
  level: number;
  xpToNext: number;
  upgrades: PlayerUpgrade[];
  synergies: string[];
  /** Evolutions triggered this run (ids from evolutions.ts). */
  evolved: string[];
  invincTimer: number;
  magnetRange: number;
  /** «Магнитный гравизахват»: бонус к скорости притяжения опыта. */
  magnetPullBonus: number;
  /** «Ускоритель плазмы»: бонус к дальности полёта снарядов. */
  bulletRangeBonus: number;
  /** «Турбодвигатель»: кадры непрерывного движения (для бонуса разгона). */
  turboStreak: number;
  aura: boolean;
  auraDamage: number;
  auraTimer: number;
  lasers: number;
  laserTimer: number;
  rearShot: boolean;
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
  // Premium «Призрак «Немезида»» kit: soul devouring + phase blink with echo.
  voidSouls: number;
  voidSoulIdleTimer: number;
  voidEchoTimer: number;
  voidEchoPos: Vec2;
  /** «ГОЛОД БЕЗДНЫ» (синергия Немезиды): убийства лечат и кормят души. */
  voidHunger: boolean;
  /** «ПРИЗРАЧНЫЙ АРСЕНАЛ» (синергия Немезиды): усиление снарядов в фазе. */
  ghostArsenal: boolean;
  // ─── МИФИЧЕСКИЕ УЛУЧШЕНИЯ (mythic tier) ────────────────────────────────────
  /** ☀️ Сердце Сверхновой: заряд звёздного ядра 0..100 (счётчик, без частиц). */
  novaCore: number;
  /** Задержка перед взрывом сверхновой (кадры). */
  novaFuseTimer: number;
  /** 🌌 Пожиратель Звёзд: заряд гравитационного коллапса 0..50. */
  collapseCharge: number;
  /** ⚡ Судный Разряд: гнев бури 0..10 (крит-заряды). */
  wrath: number;
  /** 🔥 Абсолютный Реактор: перегрузка 0..100 (%). */
  overdriveCharge: number;
  /** Кадры активного режима ABSOLUTE OVERDRIVE. */
  overdriveTimer: number;
  /** Кадры восстановления реактора (заряд не копится). */
  overdriveCooldown: number;
  /** Кадр последнего выстрела — для непрерывности стрельбы. */
  lastShotFrame: number;
  /** 🛰️ Последний Флот: заряд армадного канала 0..100. */
  fleetCharge: number;
  /** Кадры синхронного залпа FINAL FLEET SALVO. */
  fleetSalvoTimer: number;
  /** Накопления эффективности залпа (0..10). */
  fleetStacks: number;
  /** 👁️ Конец Материи: энтропия пустоты 0..100. */
  entropy: number;
  /** Кадры действия КОНЦА МАТЕРИИ. */
  voidTimer: number;
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
  // New unique mechanics replacing duplicate upgrades
  chainDetonation: boolean;
  chainDetonationRadius: number;
  phaseDischarge: boolean;
  phaseDischargeCount: number;
  livingShield: boolean;
  livingShieldAmount: number;
  sniperProtocol: boolean;
  sniperBonus: number;
  battleMagnet: boolean;
  battleMagnetChance: number;
  overload: boolean;
  overloadDamage: number;
  overloadTimer: number;
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

export type GamePhase = "menu" | "ship_select" | "tutorial" | "playing" | "upgrade" | "route" | "boss_intro" | "paused" | "dead" | "victory" | "hangar";
