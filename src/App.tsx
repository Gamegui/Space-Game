import { useEffect, useRef, useState, useCallback } from "react";
import type { PlayerState, UpgradeDef, GamePhase, ShipClassId, Enemy } from "./game/types";
import type { GameObjects } from "./game/gameLoop";
import { stepGame, makeStars, makeInitialPlayer, getNextLevelXp, spawnAdaptiveGuard, W, H, uid } from "./game/gameLoop";
import { ALL_UPGRADES, rollUpgrades, rollHighRarityUpgrade, applyUpgrade, getUpgradeLevel, getAdaptiveDifficulty } from "./game/upgrades";
import { getWaveComposition, isBossWave, spawnBoss, getBossName } from "./game/enemies";
import { SHIP_CLASSES } from "./game/shipClasses";
import { audio } from "./game/audio";
import { SYNERGIES, unlockAvailableSynergies } from "./game/synergies";
import { yandex } from "./platform/yandex";
import {
  drawBackground, drawStars, drawPlayer, drawEnemy, drawBullet,
  drawParticle, drawXpOrb, drawMine, drawLightning, drawBlackHole, drawExplosion,
  drawFloatingText, drawPowerup, drawVoidEye, setRenderPerformanceTier
} from "./game/renderer";
import UpgradePanel from "./components/UpgradePanel";
import HUD from "./components/HUD";

// ─── Initial game objects ──────────────────────────────────────────────────────
function makeInitialObjects(player: PlayerState): GameObjects {
  const wave = 1;
  const composition = getWaveComposition(wave);
  return {
    player,
    bullets: [],
    enemies: [],
    particles: [],
    xpOrbs: [],
    mines: [],
    lightnings: [],
    stars: makeStars(),
    floatingTexts: [],
    powerups: [],
    blackHolePos: null,
    blackHoleTimer: 0,
    explosions: [],
    waveEnemyQueue: composition.map(c => ({ ...c })),
    waveSpawnTimer: 45,
    bossActive: false,
    boss: null,
    waveTimer: 0,
    screenShake: 0,
    powerRating: 0,
    adaptiveDifficulty: 1,
    routeXpMultiplier: 1,
    routeScoreMultiplier: 1,
    activeRoute: "none",
    routeEffect: "none",
    performanceTier: detectPerformanceTier(),
    performanceAuto: true,
    waveStartedFrame: 0,
    guardSpawnedThisWave: false,
    fastClearStreak: 0,
    guardEventActive: false,
  };
}

type RouteId = "asteroids" | "warzone" | "anomaly";
type QualityMode = "auto" | "low" | "medium" | "high";
type RouteChoice = { id: RouteId; icon: string; name: string; description: string; risk: string; reward: string };

function detectPerformanceTier(): 0 | 1 | 2 {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || memory <= 3) return 0;
  if (cores <= 8 || memory <= 6) return 1;
  return 2;
}

const ROUTES: RouteChoice[] = [
  { id: "asteroids", icon: "☄️", name: "ПОЯС АСТЕРОИДОВ", description: "Каменный дождь пересекает арену и заставляет постоянно маневрировать.", risk: "Метеоры · −15% врагов", reward: "+30% опыта" },
  { id: "warzone", icon: "⚔️", name: "ВОЕННЫЙ СЕКТОР", description: "Ударный корпус присылает усиленные элитные эскадрильи.", risk: "+25% врагов · элиты", reward: "+60% опыта и очков" },
  { id: "anomaly", icon: "🌀", name: "АНОМАЛИЯ", description: "Гравитация, ускоренные пули или помехи оружия меняют правила волны.", risk: "Случайное правило", reward: "Рискованная награда" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef(0);
  const frameRef   = useRef(0);
  const keysRef    = useRef<Set<string>>(new Set());
  const [gameScale, setGameScale] = useState(1);

  // Scale the complete 960×640 playfield uniformly. Canvas coordinates, touch input
  // and every overlay stay aligned on phones, tablets and catalogue iframes.
  useEffect(() => {
    const resize = () => {
      const horizontalPadding = window.innerWidth >= 640 ? 24 : 4;
      const verticalPadding = window.innerHeight >= 640 ? 24 : 4;
      setGameScale(Math.min(1, (window.innerWidth - horizontalPadding) / W, (window.innerHeight - verticalPadding) / H));
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("orientationchange", resize, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, []);

  // Game state refs (mutable, not causing re-renders)
  const gameRef    = useRef<GameObjects | null>(null);
  const phaseRef   = useRef<GamePhase>("menu");
  const waveRef    = useRef(1);
  const timeSlowRef = useRef(false);
  const upgradeChoicesRef = useRef<UpgradeDef[]>([]);
  const pendingLevelUpsRef = useRef(0);
  const bossIntroTimerRef = useRef(0);
  const waveTransitioningRef = useRef(false);
  const adminGodRef = useRef(false);
  const banishedUpgradeIdsRef = useRef<Set<string>>(new Set());

  // UI state (causes re-renders)
  const [phase, setPhase]         = useState<GamePhase>("menu");
  const [selectedClass, setSelectedClass] = useState<ShipClassId>("interceptor");
  const [wave, setWave]           = useState(1);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeDef[]>([]);
  const [bossActive, setBossActive] = useState(false);
  const [bossName, setBossName]   = useState("");
  const [bossHpPct, setBossHpPct] = useState(1);
  const [timeSlow, setTimeSlow]   = useState(false);
  const [enemiesLeft, setEnemiesLeft] = useState(0);
  const [waveNotice, setWaveNotice] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [qualityMode, setQualityMode] = useState<QualityMode>(() => {
    try {
      const saved = localStorage.getItem("quality_mode") as QualityMode | null;
      return saved && ["auto", "low", "medium", "high"].includes(saved) ? saved : "auto";
    } catch { return "auto"; }
  });
  const [musicVolume, setMusicVolume] = useState(() => { try { return Math.max(0, Math.min(100, Number(localStorage.getItem("music_volume") ?? 35))); } catch { return 35; } });
  const [sfxVolume, setSfxVolume] = useState(() => { try { return Math.max(0, Math.min(100, Number(localStorage.getItem("sfx_volume") ?? 55))); } catch { return 55; } });
  const [confirmExit, setConfirmExit] = useState(false);
  const [hiscore, setHiscore] = useState(() => {
    try {
      const stored = Number.parseInt(localStorage.getItem("hs") || "0", 10);
      return Number.isFinite(stored) && stored >= 0 ? stored : 0;
    } catch { return 0; }
  });
  const [reviveUsed, setReviveUsed] = useState(false);
  const [adPending, setAdPending] = useState(false);
  const [adsAvailable, setAdsAvailable] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [purchasePending, setPurchasePending] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [adminGod, setAdminGod] = useState(false);
  const [, setAdminRefresh] = useState(0);
  const [synergyNotice, setSynergyNotice] = useState<string | null>(null);
  const [rerollsLeft, setRerollsLeft] = useState(3);
  const [banishesLeft, setBanishesLeft] = useState(1);
  const [upgradeAdPending, setUpgradeAdPending] = useState(false);
  const [bonusChoiceUsed, setBonusChoiceUsed] = useState(false);
  const adminEnabled = import.meta.env.DEV && import.meta.env.VITE_ADMIN === "true";

  // Yandex Games lifecycle, cloud record and automatic pause when the tab is hidden.
  useEffect(() => {
    void yandex.init().then(async () => {
      setAdsAvailable(yandex.isAvailable());
      const [cloudScore, ownsPremiumShip] = await Promise.all([
        yandex.loadHighScore(),
        yandex.hasPermanentPurchase("void_wraith"),
      ]);
      if (cloudScore !== null) setHiscore(current => Math.max(current, cloudScore));
      // Outside the Yandex catalogue the ship is unlocked for development and QA.
      setPremiumUnlocked(ownsPremiumShip || !yandex.isPlatformAvailable());
    });
    const pauseForFocusLoss = () => {
      // Yandex checks focus loss independently of document.visibilityState. Some
      // browsers fire blur while the document is still visible, so always stop
      // audio and freeze combat here instead of relying only on document.hidden.
      audio.suspend();
      if (phaseRef.current === "playing") {
        phaseRef.current = "paused";
        setPhase("paused");
      }
      keysRef.current.clear();
    };
    const onVisibility = () => {
      if (document.hidden) pauseForFocusLoss();
      else keysRef.current.clear();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pauseForFocusLoss);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pauseForFocusLoss);
      yandex.setGameplay(false);
    };
  }, []);

  useEffect(() => {
    yandex.setGameplay(phase === "playing");
    if (phase !== "playing") keysRef.current.clear();
  }, [phase]);

  useEffect(() => {
    audio.setMusicVolume(musicVolume);
    audio.setSfxVolume(sfxVolume);
    try {
      localStorage.setItem("music_volume", String(musicVolume));
      localStorage.setItem("sfx_volume", String(sfxVolume));
    } catch { /* optional preferences */ }
  }, [musicVolume, sfxVolume]);

  useEffect(() => {
    const tierMap: Record<Exclude<QualityMode, "auto">, 0 | 1 | 2> = { low: 0, medium: 1, high: 2 };
    const g = gameRef.current;
    if (g) {
      g.performanceAuto = qualityMode === "auto";
      g.performanceTier = qualityMode === "auto" ? detectPerformanceTier() : tierMap[qualityMode];
    }
    try { localStorage.setItem("quality_mode", qualityMode); } catch { /* optional preference */ }
  }, [qualityMode]);

  const syncUI = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setPlayerLevel(g.player.level);
    setEnemiesLeft(g.enemies.length + g.waveEnemyQueue.reduce((a, c) => a + c.count, 0));
    if (g.bossActive && g.boss) {
      setBossHpPct(Math.max(0, g.boss.hp / g.boss.maxHp));
    }
  }, []);

  // ─── Sound Toggle ───────────────────────────────────────────────────────────
  const handleToggleSound = useCallback(() => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
  }, []);

  // ─── Start game with Ship Class ─────────────────────────────────────────────
  const startGame = useCallback((shipClass: ShipClassId = selectedClass) => {
    if (shipClass === "void_wraith" && !premiumUnlocked) return;
    audio.resume();
    audio.startAmbientBGM();

    const player = makeInitialPlayer(shipClass);
    const objects = makeInitialObjects(player);
    const qualityTiers: Record<Exclude<QualityMode, "auto">, 0 | 1 | 2> = { low: 0, medium: 1, high: 2 };
    objects.performanceAuto = qualityMode === "auto";
    objects.performanceTier = qualityMode === "auto" ? detectPerformanceTier() : qualityTiers[qualityMode];
    const initialDifficulty = getAdaptiveDifficulty(player, 1);
    objects.powerRating = initialDifficulty.power;
    objects.adaptiveDifficulty = initialDifficulty.scale;
    gameRef.current = objects;
    waveRef.current = 1;
    timeSlowRef.current = false;
    pendingLevelUpsRef.current = 0;
    bossIntroTimerRef.current = 0;
    waveTransitioningRef.current = false;
    frameRef.current = 0;
    let needsTutorial = false;
    try { needsTutorial = !adminEnabled && localStorage.getItem("tutorial_complete") !== "1"; } catch { needsTutorial = !adminEnabled; }
    phaseRef.current = needsTutorial ? "tutorial" : "playing";
    setPhase(needsTutorial ? "tutorial" : "playing");
    setWave(1);
    setBossActive(false);
    setTimeSlow(false);
    setReviveUsed(false);
    setAdPending(false);
    setRerollsLeft(3);
    setBanishesLeft(1);
    banishedUpgradeIdsRef.current.clear();
    setUpgradeAdPending(false);
    setBonusChoiceUsed(false);
    setWaveNotice(null);
    syncUI();
  }, [adminEnabled, premiumUnlocked, qualityMode, selectedClass, syncUI]);

  // ─── Wave advance ────────────────────────────────────────────────────────────
  const advanceWave = useCallback((route: RouteId = "asteroids") => {
    const g = gameRef.current;
    if (!g || waveTransitioningRef.current) return;
    // Damage from several projectiles can report the same final kill in one
    // simulation frame. Lock the transition until that frame has completed.
    waveTransitioningRef.current = true;
    queueMicrotask(() => { waveTransitioningRef.current = false; });
    const newWave = waveRef.current + 1;
    waveRef.current = newWave;
    setWave(newWave);
    g.bossActive = false;
    g.boss = null;
    g.waveStartedFrame = frameRef.current;
    g.guardSpawnedThisWave = false;
    g.guardEventActive = false;
    const adaptive = getAdaptiveDifficulty(g.player, newWave);
    g.powerRating = adaptive.power;
    let routeDifficulty = 1;
    let routeCount = 1;
    g.routeXpMultiplier = 1;
    g.routeScoreMultiplier = 1;
    g.activeRoute = route;
    g.routeEffect = "none";
    if (route === "asteroids") {
      routeDifficulty = 0.94; routeCount = 0.85; g.routeXpMultiplier = 1.3;
    } else if (route === "warzone") {
      routeDifficulty = 1.25; routeCount = 1.25; g.routeXpMultiplier = 1.6; g.routeScoreMultiplier = 1.6;
    } else {
      const dangerous = Math.random() < 0.55;
      routeDifficulty = dangerous ? 1.38 : 1.15;
      routeCount = dangerous ? 1.15 : 1.05;
      g.routeXpMultiplier = dangerous ? 1.75 : 0.85;
      g.routeScoreMultiplier = dangerous ? 1.5 : 0.85;
      const anomalyEffects = dangerous ? ["gravity", "bullet_storm"] : ["interference", "gravity"];
      g.routeEffect = anomalyEffects[Math.floor(Math.random() * anomalyEffects.length)];
    }
    const routeLabels: Record<RouteId, string> = { asteroids: "☄️ ПОЯС АСТЕРОИДОВ", warzone: "⚔️ ВОЕННЫЙ СЕКТОР", anomaly: "🌀 АНОМАЛИЯ" };
    setWaveNotice(`МАРШРУТ: ${routeLabels[route]}`);
    g.adaptiveDifficulty = adaptive.scale * routeDifficulty;

    // A modest recovery keeps attrition meaningful in long runs.
    const recovery = newWave <= 10 ? 15 : 8;
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + recovery);
    if (g.player.shield) {
      g.player.shield.hp = Math.min(g.player.shield.maxHp, g.player.shield.hp + recovery);
    }

    setWaveNotice(`ВОЛНА ${newWave - 1} ПРОЙДЕНА! +${recovery} HP`);
    setTimeout(() => setWaveNotice(null), 2400);

    if (isBossWave(newWave)) {
      audio.playBossWarning();
      const boss = spawnBoss(newWave, g.adaptiveDifficulty);
      g.enemies = [boss];
      g.boss = boss;
      g.bossActive = true;
      g.waveEnemyQueue = [];
      const bName = getBossName(boss.type);
      setBossName(bName);
      setBossActive(true);
      setBossHpPct(1);
      phaseRef.current = "boss_intro";
      setPhase("boss_intro");
      bossIntroTimerRef.current = 180;
    } else {
      const composition = getWaveComposition(newWave, g.powerRating);
      g.waveEnemyQueue = composition.map(c => ({ ...c, count: Math.max(1, Math.round(c.count * routeCount)) }));
      g.waveSpawnTimer = 50;
      setBossActive(false);
      phaseRef.current = "playing";
      setPhase("playing");
      const newThreats: Record<number, string> = {
        26: "НОВАЯ УГРОЗА: СТРАЖИ ЗАЩИЩАЮТ СОЮЗНИКОВ",
        31: "НОВАЯ УГРОЗА: ФАНТОМЫ УХОДЯТ В ФАЗУ",
        36: "НОВАЯ УГРОЗА: ПОЖИРАТЕЛИ КРАДУТ ЭНЕРГИЮ",
        41: "НОВАЯ УГРОЗА: НОСИТЕЛИ ВЫПУСКАЮТ ЭСКОРТ",
        46: "НОВАЯ УГРОЗА: СИНГУЛЯРНОСТИ ИСКАЖАЮТ ПОЛЕ",
      };
      if (newThreats[newWave]) setWaveNotice(newThreats[newWave]);
    }
  }, []);

  const handleChooseRoute = useCallback((route: RouteId) => {
    advanceWave(route);
  }, [advanceWave]);

  // ─── Level up handler ─────────────────────────────────────────────────────
  const handleLevelUp = useCallback((player: PlayerState) => {
    pendingLevelUpsRef.current++;
    if (phaseRef.current === "playing" && pendingLevelUpsRef.current === 1) {
      const choices = rollUpgrades(player, 3, [...banishedUpgradeIdsRef.current]);
      upgradeChoicesRef.current = choices;
      setUpgradeChoices(choices);
      setBonusChoiceUsed(false);
      phaseRef.current = "upgrade";
      setPhase("upgrade");
    }
  }, []);

  // ─── Choose upgrade ──────────────────────────────────────────────────────
  const handleChooseUpgrade = useCallback((u: UpgradeDef) => {
    const g = gameRef.current;
    if (!g) return;
    audio.playPowerup();
    applyUpgrade(g.player, u);
    const unlockedSynergies = unlockAvailableSynergies(g.player);
    if (unlockedSynergies.length > 0) {
      setSynergyNotice(`${unlockedSynergies[0].icon} СИНЕРГИЯ: ${unlockedSynergies[0].name}`);
      setTimeout(() => setSynergyNotice(null), 3200);
    }
    pendingLevelUpsRef.current--;
    if (pendingLevelUpsRef.current > 0) {
      const choices = rollUpgrades(g.player, 3, [...banishedUpgradeIdsRef.current]);
      upgradeChoicesRef.current = choices;
      setUpgradeChoices(choices);
      setBonusChoiceUsed(false);
    } else {
      phaseRef.current = "playing";
      setPhase("playing");
    }
  }, []);

  const rerollUpgradeChoices = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const previousIds = upgradeChoicesRef.current.map(choice => choice.id);
    const choices = rollUpgrades(g.player, 3, [...banishedUpgradeIdsRef.current, ...previousIds]);
    if (choices.length === 0) return;
    upgradeChoicesRef.current = choices;
    setUpgradeChoices(choices);
    audio.playPowerup();
  }, []);

  const handleFreeReroll = useCallback(() => {
    if (rerollsLeft <= 0 || upgradeAdPending) return;
    setRerollsLeft(value => value - 1);
    rerollUpgradeChoices();
  }, [rerollUpgradeChoices, rerollsLeft, upgradeAdPending]);

  const handleAdReroll = useCallback(async () => {
    if (upgradeAdPending) return;
    if (adminEnabled) { rerollUpgradeChoices(); return; }
    setUpgradeAdPending(true);
    const rewarded = await yandex.showRewarded(() => audio.suspend(), () => audio.resume());
    setUpgradeAdPending(false);
    if (rewarded) rerollUpgradeChoices();
  }, [adminEnabled, rerollUpgradeChoices, upgradeAdPending]);

  const handleAdBonusChoice = useCallback(async () => {
    const g = gameRef.current;
    if (!g || bonusChoiceUsed || upgradeAdPending || g.player.level < 7) return;
    let rewarded = adminEnabled;
    if (!adminEnabled) {
      setUpgradeAdPending(true);
      rewarded = await yandex.showRewarded(() => audio.suspend(), () => audio.resume());
      setUpgradeAdPending(false);
    }
    if (!rewarded || !gameRef.current) return;
    const bonus = rollHighRarityUpgrade(gameRef.current.player, [
      ...banishedUpgradeIdsRef.current,
      ...upgradeChoicesRef.current.map(choice => choice.id),
    ]);
    if (!bonus) return;
    const choices = [...upgradeChoicesRef.current, bonus];
    upgradeChoicesRef.current = choices;
    setUpgradeChoices(choices);
    setBonusChoiceUsed(true);
    audio.playPowerup();
  }, [adminEnabled, bonusChoiceUsed, upgradeAdPending]);

  const handleBanishUpgrade = useCallback((upgrade: UpgradeDef) => {
    const g = gameRef.current;
    if (!g || banishesLeft <= 0 || upgrade.id === "limit_break") return;
    banishedUpgradeIdsRef.current.add(upgrade.id);
    setBanishesLeft(value => value - 1);
    const targetLength = upgradeChoicesRef.current.length;
    const remaining = upgradeChoicesRef.current.filter(choice => choice.id !== upgrade.id);
    const replacement = rollUpgrades(g.player, 1, [
      ...banishedUpgradeIdsRef.current,
      ...remaining.map(choice => choice.id),
    ]);
    const choices = [...remaining, ...replacement].slice(0, targetLength);
    upgradeChoicesRef.current = choices;
    setUpgradeChoices(choices);
    setSynergyNotice(`❌ ИЗГНАНО: ${upgrade.name}`);
    setTimeout(() => setSynergyNotice(null), 2200);
    audio.playHit();
  }, [banishesLeft]);

  // ─── Nuke ────────────────────────────────────────────────────────────────
  const handleNuke = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.player.nukeCharges <= 0 || g.player.nukeCooldown > 0 || phaseRef.current !== "playing") return;
    audio.playNuke();
    g.screenShake = 20;
    const survivors: Enemy[] = [];
    for (const e of g.enemies) {
      if (e.guardRole) {
        // The Black Cortege cannot be screen-wiped; the nuke still deals a visible chunk.
        e.hp = Math.max(1, e.hp - e.maxHp * 0.12);
        survivors.push(e);
      } else if (e.isBoss) {
        // A tactical nuke heavily damages a boss but cannot skip the boss encounter.
        e.hp = Math.max(1, e.hp - e.maxHp * 0.35);
        survivors.push(e);
      } else {
        g.xpOrbs.push({ id: uid(), pos: { ...e.pos }, vel: { x: 0, y: -1 }, value: e.xp, attracted: true });
        g.player.score += Math.floor(e.xp * 10 * g.player.goldMultiplier);
        g.player.kills++;
      }
    }
    g.enemies = survivors;
    g.bullets = g.bullets.filter(b => b.fromPlayer);
    g.player.nukeCharges--;
    g.player.nukeCooldown = 180;
  }, []);

  // ─── Time slow ───────────────────────────────────────────────────────────
  const handleTimeSlow = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.player.timeSlow) return;
    if (g.player.timeSlowCooldown > 0 || g.player.timeSlowTimer > 0) return;
    audio.playTimeSlow();
    const chronoLevel = getUpgradeLevel(g.player, "time_slow");
    g.player.timeSlowTimer = 300 + chronoLevel * 120;
    g.player.timeSlowCooldown = Math.max(300, 600 - chronoLevel * 90);
    timeSlowRef.current = true;
    setTimeSlow(true);
  }, []);

  const handlePremiumPurchase = useCallback(async () => {
    if (purchasePending || premiumUnlocked) return;
    setPurchasePending(true);
    yandex.setGameplay(false);
    audio.suspend();
    const purchased = await yandex.purchasePermanent("void_wraith");
    audio.resume();
    setPurchasePending(false);
    if (purchased) setPremiumUnlocked(true);
  }, [premiumUnlocked, purchasePending]);

  const handleReturnToMenu = useCallback(() => {
    const finish = () => {
      phaseRef.current = "menu";
      setPhase("menu");
      gameRef.current = null;
    };
    yandex.showInterstitial(() => audio.suspend(), finish);
  }, []);

  const handleRevive = useCallback(async () => {
    const g = gameRef.current;
    if (!g || reviveUsed || adPending) return;
    setAdPending(true);
    const rewarded = await yandex.showRewarded(
      () => audio.suspend(),
      () => audio.resume(),
    );
    setAdPending(false);
    if (!rewarded || !gameRef.current) return;
    const current = gameRef.current;
    current.player.hp = Math.max(1, current.player.maxHp * 0.5);
    current.player.invincTimer = 240;
    current.bullets = current.bullets.filter(b => b.fromPlayer);
    current.screenShake = 0;
    setReviveUsed(true);
    phaseRef.current = "playing";
    setPhase("playing");
    audio.startAmbientBGM();
  }, [adPending, reviveUsed]);

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      audio.resume();
      // `code` identifies the physical key and therefore works with English,
      // Russian and every other keyboard layout. Keep `key` for arrows/legacy.
      keysRef.current.add(e.code);
      keysRef.current.add(e.key);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();

      if (!e.repeat && e.code === "Escape") {
        if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
        else if (phaseRef.current === "paused") { setConfirmExit(false); phaseRef.current = "playing"; setPhase("playing"); }
      }
      if (!e.repeat && e.code === "KeyM") handleToggleSound();
      if (!e.repeat && e.code === "KeyX") handleNuke();
      if (!e.repeat && e.code === "KeyC") handleTimeSlow();
      if (!e.repeat && (e.code === "Space" || e.code === "Enter") && phaseRef.current === "menu") {
        phaseRef.current = "ship_select";
        setPhase("ship_select");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      keysRef.current.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [startGame, handleNuke, handleTimeSlow, handleToggleSound]);

  // ─── Game loop (fixed 60 Hz simulation, independent from monitor refresh rate) ──
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const fixedStep = 1000 / 60;
    const hardwareTier = detectPerformanceTier();
    let lastTimestamp = performance.now();
    let accumulator = 0;
    let uiSyncCounter = 0;
    let fpsFrames = 0;
    let fpsWindowStart = performance.now();
    let healthyWindows = 0;

    function drawWorld(g: GameObjects, frame: number) {
      setRenderPerformanceTier(g.performanceTier);
      const stride = g.performanceTier === 0 ? 3 : g.performanceTier === 1 ? 2 : 1;
      for (let i = frame % stride; i < g.explosions.length; i += stride) {
        const ex = g.explosions[i];
        drawExplosion(ctx, ex.pos, ex.radius, ex.progress);
      }
      for (let i = frame % stride; i < g.particles.length; i += stride) drawParticle(ctx, g.particles[i]);
      if (g.blackHolePos) drawBlackHole(ctx, g.blackHolePos, frame);
      for (const lightning of g.lightnings) drawLightning(ctx, lightning);
      for (const mine of g.mines) drawMine(ctx, mine, frame);
      for (const orb of g.xpOrbs) drawXpOrb(ctx, orb, frame);
      for (const powerup of g.powerups) drawPowerup(ctx, powerup, frame);
      for (const bullet of g.bullets) drawBullet(ctx, bullet);
      for (const enemy of g.enemies) drawEnemy(ctx, enemy, frame);
      drawPlayer(ctx, g.player, frame);
      for (let i = frame % stride; i < g.floatingTexts.length; i += stride) drawFloatingText(ctx, g.floatingTexts[i]);
    }

    function updateGame(g: GameObjects) {
      const slowNow = g.player.timeSlowTimer > 0;
      if (slowNow !== timeSlowRef.current) {
        timeSlowRef.current = slowNow;
        setTimeSlow(slowNow);
      }

      const simulationFrame = ++frameRef.current;
      stepGame(g, {
        keys: keysRef.current,
        wave: waveRef.current,
        frame: simulationFrame,
        timeSlow: timeSlowRef.current,
        onLevelUp: handleLevelUp,
        onDeath: () => {
          if (adminEnabled && adminGodRef.current) {
            g.player.hp = g.player.maxHp;
            g.player.shield && (g.player.shield.hp = g.player.shield.maxHp);
            g.player.invincTimer = 120;
            return;
          }
          audio.stopAmbientBGM();
          const hs = Math.max(g.player.score, hiscore);
          try { localStorage.setItem("hs", String(hs)); } catch { /* storage may be blocked */ }
          setHiscore(hs);
          void yandex.saveHighScore(hs);
          phaseRef.current = "dead";
          setPhase("dead");
        },
        onBossKill: () => {
          g.bossActive = false;
          g.boss = null;
          setBossActive(false);
        },
        onWaveComplete: () => {
          if (phaseRef.current === "playing") {
            phaseRef.current = "route";
            setPhase("route");
          }
        },
        onKill: (_xp, _pos, isBoss) => {
          if (isBoss) {
            g.bossActive = false;
            g.boss = null;
            setBossActive(false);
            if (waveRef.current >= 50) {
              audio.stopAmbientBGM();
              const hs = Math.max(g.player.score, hiscore);
              try { localStorage.setItem("hs", String(hs)); } catch { /* optional */ }
              setHiscore(hs);
              void yandex.saveHighScore(hs);
              phaseRef.current = "victory";
              setPhase("victory");
            } else {
              phaseRef.current = "route";
              setPhase("route");
            }
          }
        },
      });

      if (g.bossActive && g.enemies.length > 0) {
        g.boss = g.enemies.find(enemy => enemy.isBoss) || null;
        if (!g.boss) { g.bossActive = false; setBossActive(false); }
      }
      // HUD at 6 Hz is responsive enough and avoids React work every few frames.
      if (++uiSyncCounter >= 10) { uiSyncCounter = 0; syncUI(); }
    }

    function loop(timestamp: number) {
      rafRef.current = requestAnimationFrame(loop);
      const elapsed = Math.min(100, Math.max(0, timestamp - lastTimestamp));
      lastTimestamp = timestamp;
      accumulator += elapsed;
      let steps = Math.min(5, Math.floor(accumulator / fixedStep));
      if (steps > 0) accumulator -= steps * fixedStep;

      const g = gameRef.current;
      const frame = Math.floor(timestamp / fixedStep);
      const currentPhase = phaseRef.current;

      // Automatic quality controller: downgrade quickly under load, upgrade only
      // after several healthy windows. It changes effects, never game speed.
      fpsFrames++;
      if (timestamp - fpsWindowStart >= 2000) {
        const fps = fpsFrames * 1000 / (timestamp - fpsWindowStart);
        if (g && g.performanceAuto && currentPhase === "playing") {
          if (fps < 43 && g.performanceTier > 0) {
            g.performanceTier = (g.performanceTier - 1) as 0 | 1 | 2;
            healthyWindows = 0;
          } else if (fps > 57) {
            healthyWindows++;
            if (healthyWindows >= 4 && g.performanceTier < hardwareTier) {
              g.performanceTier = (g.performanceTier + 1) as 0 | 1 | 2;
              healthyWindows = 0;
            }
          } else healthyWindows = 0;
        }
        fpsFrames = 0;
        fpsWindowStart = timestamp;
      }

      // Only active gameplay advances. Upgrade selection and pause now freeze combat.
      if (g && currentPhase === "playing") {
        while (steps-- > 0 && phaseRef.current === "playing") updateGame(g);
      } else if (currentPhase === "boss_intro") {
        if (steps > 0) bossIntroTimerRef.current -= steps;
        if (bossIntroTimerRef.current <= 0) {
          phaseRef.current = "playing";
          setPhase("playing");
        }
      } else {
        accumulator = 0;
      }

      ctx.save();
      if (g && g.screenShake > 0 && currentPhase === "playing") {
        ctx.translate((Math.random() - 0.5) * g.screenShake, (Math.random() - 0.5) * g.screenShake);
      }
      drawBackground(ctx, frame);
      if (g?.guardEventActive) drawVoidEye(ctx, frame, g.player.pos);
      if (g) drawStars(ctx, g.stars);

      if (!g || currentPhase === "menu" || currentPhase === "ship_select" || currentPhase === "dead") {
        ctx.restore();
        return;
      }

      drawWorld(g, frame);
      if (currentPhase === "boss_intro") {
        const alpha = Math.min(1, bossIntroTimerRef.current / 60);
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.65})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 40px monospace";
        ctx.textAlign = "center";
        ctx.shadowBlur = 30;
        ctx.shadowColor = "#ef4444";
        ctx.fillText("⚠ ПРИБЛИЖАЕТСЯ БОСС ⚠", W / 2, H / 2 - 25);
        ctx.font = "24px monospace";
        ctx.fillStyle = "#fca5a5";
        ctx.shadowBlur = 0;
        ctx.fillText(bossName, W / 2, H / 2 + 25);
      }
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [advanceWave, handleLevelUp, hiscore, syncUI, bossName]);

  // ─── Mouse / Touch controls ───────────────────────────────────────────────
  const isMouseDownRef = useRef(false);
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    audio.resume();
    // Right click = Dash
    if (e.button === 2) {
      if (gameRef.current && gameRef.current.player.dashCooldown <= 0) {
        keysRef.current.add("Shift");
        setTimeout(() => keysRef.current.delete("Shift"), 100);
      }
      return;
    }
    isMouseDownRef.current = true;
  };
  const handleMouseUp = () => { isMouseDownRef.current = false; };
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameRef.current || phaseRef.current !== "playing") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    const mouseY = ((e.clientY - rect.top) / rect.height) * H;
    const p = gameRef.current.player;
    if (isMouseDownRef.current) {
      p.pos.x += (mouseX - p.pos.x) * 0.22;
      p.pos.y += (mouseY - p.pos.y) * 0.22;
      p.pos.x = Math.max(25, Math.min(W - 25, p.pos.x));
      p.pos.y = Math.max(60, Math.min(H - 32, p.pos.y));
    }
  };

  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    audio.resume();
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current || !gameRef.current) return;
    const t = e.touches[0];
    const dx = (t.clientX - touchRef.current.x) / gameScale;
    const dy = (t.clientY - touchRef.current.y) / gameScale;
    const player = gameRef.current.player;
    player.pos.x = Math.max(25, Math.min(W - 25, player.pos.x + dx));
    player.pos.y = Math.max(60, Math.min(H - 32, player.pos.y + dy));
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = () => {
    touchRef.current = null;
  };

  // ─── Development admin tools (excluded from the Yandex production build) ──
  const adminSetWave = useCallback((targetWave: number) => {
    const g = gameRef.current;
    if (!g) return;
    waveRef.current = targetWave;
    setWave(targetWave);
    g.enemies.length = 0;
    g.bullets.length = 0;
    g.particles.length = 0;
    g.xpOrbs.length = 0;
    g.waveEnemyQueue = [];
    g.boss = null;
    g.bossActive = false;
    g.waveStartedFrame = frameRef.current;
    g.guardSpawnedThisWave = false;
    g.guardEventActive = false;
    waveTransitioningRef.current = false;
    const adaptive = getAdaptiveDifficulty(g.player, targetWave);
    g.powerRating = adaptive.power;
    g.adaptiveDifficulty = adaptive.scale;

    if (isBossWave(targetWave)) {
      const boss = spawnBoss(targetWave, g.adaptiveDifficulty);
      g.enemies.push(boss);
      g.boss = boss;
      g.bossActive = true;
      setBossName(getBossName(boss.type));
      setBossActive(true);
      setBossHpPct(1);
    } else {
      g.waveEnemyQueue = getWaveComposition(targetWave, g.powerRating).map(item => ({ ...item }));
      g.waveSpawnTimer = 1;
      setBossActive(false);
    }
    phaseRef.current = "playing";
    setPhase("playing");
    syncUI();
  }, [syncUI]);

  const adminLevelUp = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    g.player.level++;
    g.player.xp = 0;
    g.player.xpToNext = getNextLevelXp(g.player.level);
    handleLevelUp(g.player);
    syncUI();
  }, [handleLevelUp, syncUI]);

  const adminGiveLegendary = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const available = ALL_UPGRADES.filter(upgrade => upgrade.rarity === "legendary" && getUpgradeLevel(g.player, upgrade.id) < upgrade.maxLevel);
    if (available.length === 0) return;
    applyUpgrade(g.player, available[Math.floor(Math.random() * available.length)]);
    syncUI();
  }, [syncUI]);

  const adminSpawnCortege = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const testWave = Math.max(16, waveRef.current);
    waveRef.current = testWave;
    setWave(testWave);
    g.enemies.length = 0;
    g.bullets.length = 0;
    g.waveEnemyQueue = [];
    g.boss = null;
    g.bossActive = false;
    const adaptive = getAdaptiveDifficulty(g.player, testWave);
    g.powerRating = adaptive.power;
    g.adaptiveDifficulty = adaptive.scale;
    g.guardSpawnedThisWave = true;
    spawnAdaptiveGuard(g, testWave);
    phaseRef.current = "playing";
    setPhase("playing");
    setBossActive(false);
    setAdminRefresh(value => value + 1);
    syncUI();
  }, [syncUI]);

  const adminMaxBuild = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    for (const upgrade of ALL_UPGRADES) {
      while (getUpgradeLevel(g.player, upgrade.id) < upgrade.maxLevel) applyUpgrade(g.player, upgrade);
    }
    unlockAvailableSynergies(g.player);
    g.player.level = 300;
    g.player.xp = 0;
    g.player.xpToNext = getNextLevelXp(300);
    g.player.hp = g.player.maxHp;
    if (g.player.shield) g.player.shield.hp = g.player.shield.maxHp;
    const adaptive = getAdaptiveDifficulty(g.player, Math.max(26, waveRef.current));
    g.powerRating = adaptive.power;
    g.adaptiveDifficulty = adaptive.scale;
    setPlayerLevel(300);
    setAdminRefresh(value => value + 1);
    syncUI();
  }, [syncUI]);

  const adminCompleteSynergies = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    for (const synergy of SYNERGIES) {
      for (const id of synergy.requires) {
        const upgrade = ALL_UPGRADES.find(item => item.id === id);
        if (upgrade && getUpgradeLevel(g.player, id) === 0) applyUpgrade(g.player, upgrade);
      }
    }
    unlockAvailableSynergies(g.player);
    const adaptive = getAdaptiveDifficulty(g.player, Math.max(26, waveRef.current));
    g.powerRating = adaptive.power;
    g.adaptiveDifficulty = adaptive.scale;
    setAdminRefresh(value => value + 1);
    syncUI();
  }, [syncUI]);

  const adminBossHp = useCallback((ratio: number) => {
    const boss = gameRef.current?.enemies.find(enemy => enemy.isBoss);
    if (!boss) return;
    boss.hp = Math.max(1, boss.maxHp * ratio);
    boss.shieldHp = 0;
    setAdminRefresh(value => value + 1);
    syncUI();
  }, [syncUI]);

  const adminSetQuality = useCallback((tier: 0 | 1 | 2) => {
    if (!gameRef.current) return;
    gameRef.current.performanceTier = tier;
    gameRef.current.performanceAuto = false;
    setAdminRefresh(value => value + 1);
  }, []);

  const adminToggleGod = useCallback(() => {
    setAdminGod(current => {
      adminGodRef.current = !current;
      return !current;
    });
  }, []);

  const playerStats = gameRef.current?.player.stats || {
    damageDealt: 0, shotsFired: 0, shotsHit: 0, elitesKilled: 0, bossesKilled: 0, powerupsCollected: 0
  };
  const finalScore = gameRef.current?.player.score || 0;
  const finalWave  = waveRef.current;
  const finalKills = gameRef.current?.player.kills || 0;
  const finalLevel = gameRef.current?.player.level || 1;
  const accuracy = playerStats.shotsFired > 0 ? Math.round((playerStats.shotsHit / playerStats.shotsFired) * 100) : 0;
  const qualityLabels: Record<QualityMode, string> = { auto: "АВТО", low: "НИЗКОЕ", medium: "СРЕДНЕЕ", high: "ВЫСОКОЕ" };
  const cycleQuality = () => {
    const modes: QualityMode[] = ["auto", "low", "medium", "high"];
    setQualityMode(modes[(modes.indexOf(qualityMode) + 1) % modes.length]);
  };

  return (
    <div className="flex min-h-[100dvh] w-screen items-center justify-center overflow-hidden bg-slate-950 font-sans">
      <div className="relative shrink-0" style={{ width: W * gameScale, height: H * gameScale }}>
        <div
          className="absolute left-0 top-0 select-none overflow-hidden rounded-2xl shadow-2xl shadow-cyan-950/40 border border-slate-800"
          style={{ width: W, height: H, transform: `scale(${gameScale})`, transformOrigin: "top left" }}
        >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block cursor-crosshair"
          style={{ touchAction: "none" }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Development-only admin panel */}
        {adminEnabled && (
          <div className="absolute left-3 top-3 z-50 font-mono text-[11px]">
            <button
              onClick={() => setAdminOpen(open => !open)}
              className="rounded-lg border border-fuchsia-400 bg-fuchsia-950/95 px-3 py-2 font-black text-fuchsia-100 shadow-lg cursor-pointer"
            >
              🛠 ADMIN {adminOpen ? "−" : "+"}
            </button>
            {adminOpen && (
              <div className="mt-2 max-h-[650px] w-60 overflow-y-auto rounded-xl border border-fuchsia-700 bg-slate-950/95 p-3 text-slate-200 shadow-2xl backdrop-blur-md">
                <div className="mb-2 text-[10px] text-fuchsia-300">ТЕСТОВАЯ СБОРКА · НЕ ДЛЯ РЕЛИЗА</div>
                {!gameRef.current ? (
                  <button onClick={() => startGame(selectedClass)} className="admin-button bg-emerald-700">БЫСТРЫЙ СТАРТ</button>
                ) : (
                  <>
                    <div className="mb-2 rounded bg-slate-900 p-2 text-[10px] text-cyan-300">
                      СИЛА: {gameRef.current.powerRating} · ×{gameRef.current.adaptiveDifficulty.toFixed(2)}<br/>
                      УРОВЕНЬ: {gameRef.current.player.level} · КАЧЕСТВО: {gameRef.current.performanceTier}<br/>
                      ВРАГИ: {gameRef.current.enemies.length} · ПУЛИ: {gameRef.current.bullets.length}
                    </div>

                    <div className="mt-2 text-[9px] font-black tracking-widest text-fuchsia-300">ИГРОК И БИЛД</div>
                    <button onClick={adminToggleGod} className={`admin-button ${adminGod ? "bg-emerald-700" : "bg-slate-700"}`}>БЕССМЕРТИЕ: {adminGod ? "ВКЛ" : "ВЫКЛ"}</button>
                    <button onClick={adminLevelUp} className="admin-button bg-indigo-700">+1 УРОВЕНЬ / ВЫБОР</button>
                    <button onClick={() => { for (let i = 0; i < 5; i++) adminLevelUp(); }} className="admin-button bg-indigo-800">+5 УРОВНЕЙ</button>
                    <button onClick={adminGiveLegendary} className="admin-button bg-amber-700">+ СЛУЧАЙНОЕ ЛЕГЕНД.</button>
                    <button onClick={adminCompleteSynergies} className="admin-button bg-fuchsia-800">ВСЕ 4 СИНЕРГИИ</button>
                    <button onClick={adminMaxBuild} className="admin-button bg-red-800">МАКС. БИЛД · LVL 300</button>
                    <button onClick={() => { const g = gameRef.current; if (g) { g.player.hp = 1; if (g.player.shield) g.player.shield.hp = 0; setAdminRefresh(v => v + 1); } }} className="admin-button bg-rose-950">HP = 1</button>
                    <button onClick={() => { const g = gameRef.current; if (g) { g.player.hp = g.player.maxHp; if (g.player.shield) g.player.shield.hp = g.player.shield.maxHp; setAdminRefresh(v => v + 1); } }} className="admin-button bg-emerald-800">ПОЛНОЕ ЛЕЧЕНИЕ</button>

                    <div className="mt-2 text-[9px] font-black tracking-widest text-fuchsia-300">СОБЫТИЯ И БОССЫ</div>
                    <button onClick={adminSpawnCortege} className="admin-button bg-purple-900">👁 ПРИЗВАТЬ ЧЁРНЫЙ КОРТЕЖ</button>
                    <button onClick={() => adminSetWave(50)} className="admin-button bg-red-950">Ω ПРИЗВАТЬ ОМЕГУ</button>
                    <div className="mt-1 grid grid-cols-3 gap-1">
                      {[0.74, 0.49, 0.24].map((ratio, index) => <button key={ratio} onClick={() => adminBossHp(ratio)} className="rounded bg-orange-900 px-1 py-1.5 font-bold hover:bg-orange-700 cursor-pointer">Ф{index + 2}</button>)}
                    </div>
                    <button onClick={() => { const g = gameRef.current; if (g) g.enemies.forEach(enemy => { enemy.shieldHp = 0; enemy.hp = 0; }); }} className="admin-button bg-rose-800">УНИЧТОЖИТЬ ВСЕХ</button>
                    <button onClick={() => { const g = gameRef.current; if (g) g.bullets = g.bullets.filter(b => b.fromPlayer); }} className="admin-button bg-cyan-800">ОЧИСТИТЬ ВРАЖ. ПУЛИ</button>

                    <div className="mt-2 text-[9px] font-black tracking-widest text-fuchsia-300">КАЧЕСТВО РЕНДЕРА</div>
                    <div className="grid grid-cols-3 gap-1">
                      {([0, 1, 2] as const).map(tier => <button key={tier} onClick={() => adminSetQuality(tier)} className="rounded bg-slate-700 px-1 py-1.5 font-bold hover:bg-slate-600 cursor-pointer">Q{tier}</button>)}
                    </div>

                    <div className="mt-2 text-[9px] font-black tracking-widest text-fuchsia-300">ПЕРЕХОД К ВОЛНЕ</div>
                    <div className="mt-1 grid grid-cols-4 gap-1">
                      {[5, 10, 15, 16, 20, 25, 30, 31, 40, 41, 46, 50, 60].map(target => (
                        <button key={target} onClick={() => adminSetWave(target)} className="rounded bg-rose-900 px-1 py-1.5 font-bold hover:bg-rose-700 cursor-pointer">В{target}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Audio Mute Button */}
        <button
          onClick={handleToggleSound}
          className="absolute top-3 right-3 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-mono font-bold z-30 transition-all cursor-pointer backdrop-blur-sm"
          title="Включить / Выключить звук [M]"
        >
          {isMuted ? "🔇 ЗВУК: ВЫКЛ" : "🔊 ЗВУК: ВКЛ"}
        </button>

        {/* Wave Banner Notification */}
        {waveNotice && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 px-6 py-2 bg-emerald-900/90 border border-emerald-400 text-emerald-100 font-mono text-sm font-black rounded-full shadow-xl shadow-emerald-950/60 backdrop-blur-sm z-20 animate-bounce">
            ✨ {waveNotice} ✨
          </div>
        )}

        {/* HUD */}
        {(phase === "playing" || phase === "upgrade" || phase === "boss_intro") && gameRef.current && (
          <HUD
            player={gameRef.current.player}
            wave={wave}
            enemiesLeft={enemiesLeft}
            bossActive={bossActive}
            bossName={bossName}
            bossHpPct={bossHpPct}
            timeSlow={timeSlow}
            onNuke={handleNuke}
            onTimeSlow={handleTimeSlow}
          />
        )}

        {/* Upgrade panel */}
        {phase === "upgrade" && gameRef.current && (
          <UpgradePanel
            choices={upgradeChoices}
            player={gameRef.current.player}
            onChoose={handleChooseUpgrade}
            level={playerLevel}
            rerollsLeft={rerollsLeft}
            banishesLeft={banishesLeft}
            banishedCount={banishedUpgradeIdsRef.current.size}
            adAvailable={adsAvailable || adminEnabled}
            adPending={upgradeAdPending}
            bonusChoiceUsed={bonusChoiceUsed}
            onReroll={handleFreeReroll}
            onAdReroll={handleAdReroll}
            onAdBonusChoice={handleAdBonusChoice}
            onBanish={handleBanishUpgrade}
          />
        )}

        {/* Route choice between waves */}
        {phase === "route" && gameRef.current && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/88 p-6 backdrop-blur-md">
            <div className="mb-1 text-xs font-black tracking-[0.3em] text-cyan-400">МАРШРУТ СЛЕДУЮЩЕЙ ВОЛНЫ</div>
            <h2 className="mb-2 text-4xl font-black text-white">КУДА ДАЛЬШЕ?</h2>
            <p className="mb-6 text-sm text-slate-400">Выберите риск. Решение действует одну волну.</p>
            <div className="grid w-full max-w-4xl grid-cols-3 gap-4">
              {ROUTES.map(route => (
                <button key={route.id} onClick={() => handleChooseRoute(route.id)} className="group rounded-2xl border-2 border-slate-700 bg-gradient-to-b from-slate-800 to-slate-950 p-5 text-left transition-all hover:scale-105 hover:border-cyan-400 cursor-pointer">
                  <div className="mb-3 text-4xl">{route.icon}</div>
                  <div className="mb-2 text-lg font-black text-white">{route.name}</div>
                  <div className="mb-4 min-h-10 text-xs text-slate-400">{route.description}</div>
                  <div className="mb-1 rounded bg-red-950/70 px-3 py-2 text-xs font-bold text-red-300">⚠ {route.risk}</div>
                  <div className="rounded bg-emerald-950/70 px-3 py-2 text-xs font-bold text-emerald-300">✦ {route.reward}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {synergyNotice && (
          <div className="absolute left-1/2 top-40 z-40 -translate-x-1/2 rounded-full border border-fuchsia-400 bg-fuchsia-950/95 px-7 py-3 font-mono text-lg font-black text-fuchsia-100 shadow-2xl shadow-fuchsia-900">
            {synergyNotice}
          </div>
        )}

        {/* First-run tutorial: simulation is paused until confirmation. */}
        {phase === "tutorial" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/92 p-6 backdrop-blur-md">
            <div className="w-full max-w-2xl rounded-3xl border border-cyan-700 bg-slate-950/95 p-7 text-center shadow-2xl shadow-cyan-950">
              <div className="mb-2 text-5xl">🚀</div>
              <h2 className="mb-2 text-3xl font-black text-white">ПЕРЕД ВЫЛЕТОМ</h2>
              <p className="mb-5 text-sm text-slate-400">Орудия стреляют автоматически. Ваша задача — двигаться, уклоняться и собирать опыт.</p>
              <div className="mb-6 grid grid-cols-2 gap-3 text-left font-mono text-sm">
                <div className="rounded-xl bg-slate-900 p-3"><b className="text-cyan-300">WASD / СВАЙП</b><br/><span className="text-slate-400">Движение корабля</span></div>
                <div className="rounded-xl bg-slate-900 p-3"><b className="text-indigo-300">SHIFT</b><br/><span className="text-slate-400">Рывок и очистка пуль</span></div>
                <div className="rounded-xl bg-slate-900 p-3"><b className="text-red-300">X</b><br/><span className="text-slate-400">Ядерный заряд</span></div>
                <div className="rounded-xl bg-slate-900 p-3"><b className="text-cyan-300">C</b><br/><span className="text-slate-400">Замедление времени</span></div>
              </div>
              <button onClick={() => { try { localStorage.setItem("tutorial_complete", "1"); } catch { /* optional */ } audio.resume(); phaseRef.current = "playing"; setPhase("playing"); }} className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 px-12 py-3.5 text-lg font-black text-white hover:brightness-110 cursor-pointer">
                ПОНЯТНО — В БОЙ
              </button>
            </div>
          </div>
        )}

        {/* Paused overlay */}
        {phase === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-30">
            <div className="text-6xl font-black text-white mb-2">⏸</div>
            <h2 className="text-4xl font-black text-white mb-6">ПАУЗА</h2>
            <div className="text-slate-300 font-mono text-sm mb-6 space-y-1.5 text-center bg-slate-900/80 p-5 rounded-2xl border border-slate-700">
              <p>Управление: <span className="text-sky-400 font-bold">WASD / Стрелки / Зажатие Мыши</span></p>
              <p>Тактический рывок: <span className="text-indigo-400 font-bold">Shift / Правый клик мыши</span></p>
              <p>Оружие: <span className="text-emerald-400 font-bold">Авто-огонь с доводкой до цели</span></p>
              <p>Ядерный заряд: <span className="text-red-400 font-bold">X</span> | Замедление времени: <span className="text-cyan-400 font-bold">C</span> | Звук: <span className="text-yellow-400 font-bold">M</span></p>
            </div>
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/85 p-2 font-mono text-[10px]">
              <button onClick={cycleQuality} className="rounded border border-cyan-800 bg-cyan-950 px-3 py-2 font-black text-cyan-200 cursor-pointer">⚙ {qualityLabels[qualityMode]}</button>
              <label className="text-slate-400">🎵 {musicVolume}% <input aria-label="Громкость музыки" type="range" min="0" max="100" step="5" value={musicVolume} onChange={event => setMusicVolume(Number(event.target.value))} className="w-20 align-middle accent-fuchsia-500" /></label>
              <label className="text-slate-400">💥 {sfxVolume}% <input aria-label="Громкость эффектов" type="range" min="0" max="100" step="5" value={sfxVolume} onChange={event => setSfxVolume(Number(event.target.value))} className="w-20 align-middle accent-cyan-500" /></label>
            </div>
            <button
              onClick={() => { setConfirmExit(false); audio.resume(); phaseRef.current = "playing"; setPhase("playing"); }}
              className="px-10 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-lg rounded-full transition-all active:scale-95 shadow-lg shadow-sky-900/50 cursor-pointer mb-3"
            >
              ПРОДОЛЖИТЬ ИГРУ
            </button>
            {!confirmExit ? (
              <button onClick={() => setConfirmExit(true)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-full transition-all cursor-pointer">ВЫЙТИ В ГЛАВНОЕ МЕНЮ</button>
            ) : (
              <div className="rounded-xl border border-red-800 bg-red-950/90 p-3 text-center">
                <div className="mb-2 text-sm font-black text-red-200">Завершить забег? Прогресс будет потерян.</div>
                <div className="flex justify-center gap-2">
                  <button onClick={() => { setConfirmExit(false); audio.stopAmbientBGM(); phaseRef.current = "menu"; setPhase("menu"); gameRef.current = null; }} className="rounded-lg bg-red-700 px-5 py-2 text-xs font-black text-white cursor-pointer">ДА, ВЫЙТИ</button>
                  <button onClick={() => setConfirmExit(false)} className="rounded-lg bg-slate-700 px-5 py-2 text-xs font-black text-white cursor-pointer">ОТМЕНА</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Menu */}
        {phase === "menu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-30">
            <div className="text-center max-w-xl px-6">
              <div className="text-8xl mb-2 animate-pulse">🚀</div>
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400 tracking-tight mb-1">
                SPACE SHOOTER ULTRA
              </h1>
              <p className="text-blue-300/80 font-mono text-xs tracking-widest mb-6">КОСМИЧЕСКИЙ РОГАЛИК · СИНТЕЗАТОР ЗВУКА · 90 УЛУЧШЕНИЙ</p>

              <div className="grid grid-cols-2 gap-3 text-xs mb-5 font-mono">
                <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700 text-left">
                  <div className="text-slate-400 text-[10px] mb-1 font-bold">ПОЛЁТ И РЫВОК</div>
                  <div className="text-sky-400 font-bold">WASD / Стрелки + [SHIFT]</div>
                </div>
                <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700 text-left">
                  <div className="text-slate-400 text-[10px] mb-1 font-bold">ОРУДИЯ</div>
                  <div className="text-emerald-400 font-bold">Авто-огонь с доводкой пуль</div>
                </div>
                <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700 text-left">
                  <div className="text-slate-400 text-[10px] mb-1 font-bold">ЯДЕРНЫЙ УДАР</div>
                  <div className="text-red-400 font-bold">Клавиша [X] (Зачистка экрана)</div>
                </div>
                <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700 text-left">
                  <div className="text-slate-400 text-[10px] mb-1 font-bold">ХРОНО-ЗАМЕДЛЕНИЕ</div>
                  <div className="text-cyan-400 font-bold">Клавиша [C] (Замедление пуль)</div>
                </div>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700 mb-6 text-xs font-mono text-slate-300">
                ⭐ <span className="text-purple-400 font-bold">Опыт притягивается автоматически</span> · Собирайте бонусы (💊⚡🛡️🧲💣) · 6 грандиозных боссов
              </div>

              {hiscore > 0 && (
                <div className="text-yellow-400 font-mono text-sm mb-3 font-bold">🏆 Рекорд очков: {hiscore.toLocaleString()}</div>
              )}

              <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/75 p-2 font-mono text-[10px]">
                <button onClick={cycleQuality} className="rounded-lg border border-cyan-800 bg-cyan-950 px-3 py-2 font-black text-cyan-200 cursor-pointer">⚙ КАЧЕСТВО: {qualityLabels[qualityMode]}</button>
                <label className="text-slate-400">🎵 {musicVolume}%<input aria-label="Громкость музыки" type="range" min="0" max="100" step="5" value={musicVolume} onChange={event => setMusicVolume(Number(event.target.value))} className="ml-2 w-20 align-middle accent-fuchsia-500" /></label>
                <label className="text-slate-400">💥 {sfxVolume}%<input aria-label="Громкость эффектов" type="range" min="0" max="100" step="5" value={sfxVolume} onChange={event => setSfxVolume(Number(event.target.value))} className="ml-2 w-20 align-middle accent-cyan-500" /></label>
              </div>

              <button
                onClick={() => { audio.resume(); phaseRef.current = "ship_select"; setPhase("ship_select"); }}
                className="px-14 py-4 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-2xl rounded-full shadow-2xl shadow-blue-900/60 transition-all active:scale-95 cursor-pointer"
              >
                ВЫБРАТЬ КОРАБЛЬ И В БОЙ
              </button>
              <div className="text-slate-500 font-mono text-xs mt-3">или нажмите ПРОБЕЛ / ENTER</div>
            </div>
            <div className="absolute bottom-3 right-4 font-mono text-[10px] text-slate-600">v1.0.0 · RELEASE</div>
          </div>
        )}

        {/* Ship Select Screen */}
        {phase === "ship_select" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-30 p-6">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-300 mb-1">
              ВЫБОР БОЕВОГО КОРАБЛЯ
            </h2>
            <p className="text-slate-400 font-mono text-xs mb-6">Выберите класс судна и специализацию вооружения</p>

            <div className="grid grid-cols-5 gap-2.5 max-w-[930px] w-full mb-5">
              {SHIP_CLASSES.map((sc) => {
                const isSelected = selectedClass === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => { audio.playHit(); setSelectedClass(sc.id); }}
                    className={`
                      p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between
                      ${isSelected ? `bg-slate-900/90 shadow-xl scale-105 ring-2 ring-sky-400` : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:scale-102"}
                    `}
                    style={{ borderColor: isSelected ? sc.color : undefined }}
                  >
                    {sc.premium && (
                      <div className="absolute right-2 top-2 rounded-full bg-fuchsia-600 px-2 py-0.5 text-[9px] font-black text-white">
                        {premiumUnlocked ? "КУПЛЕН" : "ПРЕМИУМ"}
                      </div>
                    )}
                    <div>
                      <div className="text-4xl mb-2">{sc.icon}</div>
                      <div className="font-black text-white text-base leading-tight">{sc.name}</div>
                      <div className="text-[11px] font-mono text-sky-400 mb-2">{sc.subtitle}</div>
                      <div className="text-xs text-slate-400 mb-3 leading-snug">{sc.description}</div>
                    </div>
                    <div className="space-y-1 border-t border-slate-800/80 pt-2 font-mono text-[10px]">
                      {sc.perks.map((p, idx) => (
                        <div key={idx} className="text-slate-300 flex items-center gap-1">
                          <span className="text-emerald-400">✔</span> {p}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { phaseRef.current = "menu"; setPhase("menu"); }}
                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-full transition-all cursor-pointer"
              >
                НАЗАД
              </button>
              <button
                onClick={() => selectedClass === "void_wraith" && !premiumUnlocked
                  ? void handlePremiumPurchase()
                  : startGame(selectedClass)}
                disabled={purchasePending}
                className="px-12 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-lg rounded-full shadow-xl shadow-blue-900/50 transition-all active:scale-95 cursor-pointer"
              >
                {selectedClass === "void_wraith" && !premiumUnlocked
                  ? (purchasePending ? "ОТКРЫВАЕМ МАГАЗИН…" : "ОТКРЫТЬ «НЕМЕЗИДУ» ✦")
                  : "НАЧАТЬ МИССИЮ 🚀"}
              </button>
            </div>
          </div>
        )}

        {/* Victory after the wave-50 Omega; endless mode remains optional. */}
        {phase === "victory" && gameRef.current && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/92 p-6 backdrop-blur-md">
            <div className="w-full max-w-xl text-center">
              <div className="mb-2 text-6xl">🏆</div>
              <h2 className="text-4xl font-black text-amber-300">СИСТЕМА ОМЕГА УНИЧТОЖЕНА</h2>
              <p className="mb-5 font-mono text-sm text-cyan-300">ОСНОВНАЯ МИССИЯ ЗАВЕРШЕНА</p>
              <div className="mb-5 grid grid-cols-4 gap-2 rounded-2xl border border-amber-700/60 bg-slate-950/90 p-4 font-mono">
                <div><div className="text-[10px] text-slate-500">СЧЁТ</div><b className="text-white">{finalScore.toLocaleString()}</b></div>
                <div><div className="text-[10px] text-slate-500">ВОЛНА</div><b className="text-white">{finalWave}</b></div>
                <div><div className="text-[10px] text-slate-500">УБИЙСТВА</div><b className="text-red-300">{finalKills}</b></div>
                <div><div className="text-[10px] text-slate-500">СИНЕРГИИ</div><b className="text-fuchsia-300">{gameRef.current.player.synergies.length}</b></div>
              </div>
              <div className="flex justify-center gap-3">
                <button onClick={() => { audio.resume(); audio.startAmbientBGM(); phaseRef.current = "route"; setPhase("route"); }} className="rounded-full bg-fuchsia-700 px-8 py-3 font-black text-white hover:bg-fuchsia-600 cursor-pointer">♾️ ПРОДОЛЖИТЬ БЕСКОНЕЧНО</button>
                <button onClick={() => { phaseRef.current = "ship_select"; setPhase("ship_select"); gameRef.current = null; }} className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 font-black text-white cursor-pointer">НОВЫЙ ЗАБЕГ</button>
              </div>
            </div>
          </div>
        )}

        {/* Death screen with comprehensive stats */}
        {phase === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-30 p-6">
            <div className="text-center max-w-lg w-full">
              <div className="text-6xl mb-2 animate-bounce">💀</div>
              <h2 className="text-4xl font-black text-red-400 mb-1">КОРАБЛЬ УНИЧТОЖЕН</h2>
              <p className="text-slate-400 font-mono text-xs mb-5">Ваше судно было сбито в глубоком космосе</p>

              <div className="bg-slate-900/90 rounded-2xl border border-slate-700 p-5 mb-5 space-y-2.5 font-mono text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Итоговый счёт</span>
                  <span className="text-white font-black text-2xl">{finalScore.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center py-2 border-b border-slate-800">
                  <div className="bg-slate-950/70 p-2 rounded-lg">
                    <div className="text-slate-500 text-[10px]">ДОСТИГНУТА ВОЛНА</div>
                    <div className="text-white font-bold text-lg">{finalWave}</div>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded-lg">
                    <div className="text-slate-500 text-[10px]">УБИТО ВРАГОВ</div>
                    <div className="text-red-400 font-bold text-lg">{finalKills}</div>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded-lg">
                    <div className="text-slate-500 text-[10px]">МАКС. УРОВЕНЬ</div>
                    <div className="text-purple-400 font-bold text-lg">{finalLevel}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs">
                  <div>
                    <div className="text-slate-500 text-[10px]">МЕТКОСТЬ</div>
                    <div className="text-emerald-400 font-bold">{accuracy}%</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">ЭЛИТНЫЕ ВРАГИ</div>
                    <div className="text-yellow-400 font-bold">{playerStats.elitesKilled}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">БОССЫ</div>
                    <div className="text-sky-400 font-bold">{playerStats.bossesKilled}</div>
                  </div>
                </div>
              </div>

              {!reviveUsed && adsAvailable && (
                <button
                  onClick={handleRevive}
                  disabled={adPending}
                  className="w-full mb-3 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white font-black text-base rounded-full shadow-xl transition-all active:scale-95 cursor-pointer"
                >
                  {adPending ? "ЗАГРУЗКА ВИДЕО…" : "🎬 ЭКСТРЕННЫЙ РЕМОНТ · +50% HP"}
                </button>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { phaseRef.current = "ship_select"; setPhase("ship_select"); }}
                  className="flex-1 py-3.5 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-base rounded-full shadow-xl transition-all active:scale-95 cursor-pointer"
                >
                  ПОВТОРИТЬ МИССИЮ
                </button>
                <button
                  onClick={handleReturnToMenu}
                  className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-full transition-all cursor-pointer"
                >
                  ГЛАВНОЕ МЕНЮ
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
