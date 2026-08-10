import { useEffect, useRef, useState, useCallback } from "react";
import type { PlayerState, UpgradeDef, GamePhase, ShipClassId } from "./game/types";
import type { GameObjects } from "./game/gameLoop";
import { stepGame, makeStars, makeInitialPlayer, W, H, uid } from "./game/gameLoop";
import { rollUpgrades, applyUpgrade } from "./game/upgrades";
import { getWaveComposition, isBossWave, spawnBoss, getBossName } from "./game/enemies";
import { SHIP_CLASSES } from "./game/shipClasses";
import { audio } from "./game/audio";
import {
  drawBackground, drawStars, drawPlayer, drawEnemy, drawBullet,
  drawParticle, drawXpOrb, drawMine, drawLightning, drawBlackHole, drawExplosion,
  drawFloatingText, drawPowerup
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
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef(0);
  const frameRef   = useRef(0);
  const keysRef    = useRef<Set<string>>(new Set());

  // Game state refs (mutable, not causing re-renders)
  const gameRef    = useRef<GameObjects | null>(null);
  const phaseRef   = useRef<GamePhase>("menu");
  const waveRef    = useRef(1);
  const timeSlowRef = useRef(false);
  const upgradeChoicesRef = useRef<UpgradeDef[]>([]);
  const pendingLevelUpsRef = useRef(0);
  const bossIntroTimerRef = useRef(0);

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
  const [isMuted, setIsMuted]     = useState(false);
  const [hiscore, setHiscore]     = useState(() => { try { return parseInt(localStorage.getItem("hs") || "0"); } catch { return 0; } });

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
    audio.resume();
    audio.startAmbientBGM();

    const player = makeInitialPlayer(shipClass);
    const objects = makeInitialObjects(player);
    gameRef.current = objects;
    waveRef.current = 1;
    timeSlowRef.current = false;
    pendingLevelUpsRef.current = 0;
    bossIntroTimerRef.current = 0;
    frameRef.current = 0;
    phaseRef.current = "playing";
    setPhase("playing");
    setWave(1);
    setBossActive(false);
    setTimeSlow(false);
    setWaveNotice(null);
    syncUI();
  }, [selectedClass, syncUI]);

  // ─── Wave advance ────────────────────────────────────────────────────────────
  const advanceWave = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const newWave = waveRef.current + 1;
    waveRef.current = newWave;
    setWave(newWave);
    g.bossActive = false;
    g.boss = null;

    // Wave clear bonus: restore 20 HP
    g.player.hp = Math.min(g.player.maxHp, g.player.hp + 20);
    if (g.player.shield) {
      g.player.shield.hp = Math.min(g.player.shield.maxHp, g.player.shield.hp + 20);
    }

    setWaveNotice(`ВОЛНА ${newWave - 1} ПРОЙДЕНА! +20 HP ВОССТАНОВЛЕНО`);
    setTimeout(() => setWaveNotice(null), 2400);

    if (isBossWave(newWave)) {
      audio.playBossWarning();
      const boss = spawnBoss(newWave);
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
      const composition = getWaveComposition(newWave);
      g.waveEnemyQueue = composition.map(c => ({ ...c }));
      g.waveSpawnTimer = 50;
      setBossActive(false);
    }
  }, []);

  // ─── Level up handler ─────────────────────────────────────────────────────
  const handleLevelUp = useCallback((player: PlayerState) => {
    pendingLevelUpsRef.current++;
    if (phaseRef.current === "playing" && pendingLevelUpsRef.current === 1) {
      const choices = rollUpgrades(player, 3);
      upgradeChoicesRef.current = choices;
      setUpgradeChoices(choices);
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
    pendingLevelUpsRef.current--;
    if (pendingLevelUpsRef.current > 0) {
      const choices = rollUpgrades(g.player, 3);
      upgradeChoicesRef.current = choices;
      setUpgradeChoices(choices);
    } else {
      phaseRef.current = "playing";
      setPhase("playing");
    }
  }, []);

  // ─── Nuke ────────────────────────────────────────────────────────────────
  const handleNuke = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.player.nukeCharges <= 0) return;
    audio.playNuke();
    g.screenShake = 20;
    for (const e of g.enemies) {
      g.xpOrbs.push({ id: uid(), pos: { ...e.pos }, vel: { x: 0, y: -1 }, value: e.xp, attracted: true });
      g.player.score += Math.floor(e.xp * 10);
      g.player.kills++;
    }
    g.enemies = [];
    g.bullets = g.bullets.filter(b => b.fromPlayer);
    g.player.nukeCharges--;
  }, []);

  // ─── Time slow ───────────────────────────────────────────────────────────
  const handleTimeSlow = useCallback(() => {
    const g = gameRef.current;
    if (!g || !g.player.timeSlow) return;
    if (g.player.timeSlowCooldown > 0 || g.player.timeSlowTimer > 0) return;
    audio.playTimeSlow();
    g.player.timeSlowTimer = 300;
    g.player.timeSlowCooldown = g.player.timeSlowCooldown || 500;
    timeSlowRef.current = true;
    setTimeSlow(true);
  }, []);

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      audio.resume();
      keysRef.current.add(e.key);
      if (e.key === "Escape") {
        if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
        else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
      }
      if (e.key === "m" || e.key === "M" || e.key === "ь" || e.key === "Ь") handleToggleSound();
      if (e.key === "x" || e.key === "X" || e.key === "ч" || e.key === "Ч") handleNuke();
      if (e.key === "c" || e.key === "C" || e.key === "с" || e.key === "С") handleTimeSlow();
      if ((e.key === " " || e.key === "Enter") && phaseRef.current === "menu") setPhase("ship_select");
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [startGame, handleNuke, handleTimeSlow, handleToggleSound]);

  // ─── Game loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let uiSyncCounter = 0;

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const g = gameRef.current;
      const frame = ++frameRef.current;

      ctx.save();
      // Apply screen shake
      if (g && g.screenShake > 0) {
        const sx = (Math.random() - 0.5) * g.screenShake;
        const sy = (Math.random() - 0.5) * g.screenShake;
        ctx.translate(sx, sy);
      }

      drawBackground(ctx, frame);
      if (g) drawStars(ctx, g.stars);

      if (!g || phaseRef.current === "menu" || phaseRef.current === "ship_select" || phaseRef.current === "dead") {
        ctx.restore();
        return;
      }

      // Boss intro countdown
      if (phaseRef.current === "boss_intro") {
        bossIntroTimerRef.current--;
        if (bossIntroTimerRef.current <= 0) {
          phaseRef.current = "playing";
          setPhase("playing");
        }
        ctx.save();
        const alpha = Math.min(1, bossIntroTimerRef.current / 60);
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.65})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 40px monospace";
        ctx.textAlign = "center";
        ctx.shadowBlur = 30; ctx.shadowColor = "#ef4444";
        ctx.fillText("⚠ ПРИБЛИЖАЕТСЯ БОСС ⚠", W / 2, H / 2 - 25);
        ctx.font = "24px monospace";
        ctx.fillStyle = "#fca5a5";
        ctx.shadowBlur = 0;
        ctx.fillText(bossName, W / 2, H / 2 + 25);
        ctx.restore();
        for (const e of g.enemies) drawEnemy(ctx, e, frame);
        drawPlayer(ctx, g.player, frame);
        ctx.restore();
        return;
      }

      if (phaseRef.current === "paused") {
        for (const p of g.particles) drawParticle(ctx, p);
        for (const b of g.bullets) drawBullet(ctx, b);
        for (const e of g.enemies) drawEnemy(ctx, e, frame);
        for (const orb of g.xpOrbs) drawXpOrb(ctx, orb, frame);
        drawPlayer(ctx, g.player, frame);
        ctx.restore();
        return;
      }

      if (phaseRef.current !== "playing" && phaseRef.current !== "upgrade") {
        ctx.restore();
        return;
      }

      // Time slow management
      const p = g.player;
      if (p.timeSlowTimer > 0) {
        timeSlowRef.current = true;
        setTimeSlow(true);
      } else {
        timeSlowRef.current = false;
        setTimeSlow(false);
      }

      // Step game
      stepGame(g, {
        keys: keysRef.current,
        wave: waveRef.current,
        frame,
        timeSlow: timeSlowRef.current,
        onLevelUp: handleLevelUp,
        onDeath: () => {
          audio.stopAmbientBGM();
          const hs = Math.max(g.player.score, hiscore);
          localStorage.setItem("hs", String(hs));
          setHiscore(hs);
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
            advanceWave();
          }
        },
        onKill: (_xp, _pos, isBoss) => {
          if (isBoss) {
            g.bossActive = false;
            g.boss = null;
            setBossActive(false);
            advanceWave();
          }
        },
      });

      if (g.bossActive && g.enemies.length > 0) {
        g.boss = g.enemies.find(e => e.isBoss) || null;
        if (!g.boss) { g.bossActive = false; setBossActive(false); }
      }

      // ─── Draw ─────────────────────────────────────────────────────────────
      for (const ex of g.explosions) drawExplosion(ctx, ex.pos, ex.radius, ex.progress);
      for (const p2 of g.particles) drawParticle(ctx, p2);
      if (g.blackHolePos) drawBlackHole(ctx, g.blackHolePos, frame);
      for (const l of g.lightnings) drawLightning(ctx, l);
      for (const m of g.mines) drawMine(ctx, m, frame);
      for (const orb of g.xpOrbs) drawXpOrb(ctx, orb, frame);
      for (const pu of g.powerups) drawPowerup(ctx, pu, frame);
      for (const b of g.bullets) drawBullet(ctx, b);
      for (const e of g.enemies) drawEnemy(ctx, e, frame);
      drawPlayer(ctx, g.player, frame);
      for (const ft of g.floatingTexts) drawFloatingText(ctx, ft);

      ctx.restore();

      uiSyncCounter++;
      if (uiSyncCounter >= 6) { uiSyncCounter = 0; syncUI(); }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [advanceWave, handleLevelUp, hiscore, syncUI]);

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
    const dx = (t.clientX - touchRef.current.x) * 1.0;
    const dy = (t.clientY - touchRef.current.y) * 1.0;
    const player = gameRef.current.player;
    player.pos.x = Math.max(25, Math.min(W - 25, player.pos.x + dx));
    player.pos.y = Math.max(60, Math.min(H - 32, player.pos.y + dy));
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = () => {
    touchRef.current = null;
  };

  const playerStats = gameRef.current?.player.stats || {
    damageDealt: 0, shotsFired: 0, shotsHit: 0, elitesKilled: 0, bossesKilled: 0, powerupsCollected: 0
  };
  const finalScore = gameRef.current?.player.score || 0;
  const finalWave  = waveRef.current;
  const finalKills = gameRef.current?.player.kills || 0;
  const finalLevel = gameRef.current?.player.level || 1;
  const accuracy = playerStats.shotsFired > 0 ? Math.round((playerStats.shotsHit / playerStats.shotsFired) * 100) : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-2 sm:p-4 font-sans">
      <div
        className="relative select-none overflow-hidden rounded-2xl shadow-2xl shadow-cyan-950/40 border border-slate-800"
        style={{ width: W, height: H }}
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
          />
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
            <button
              onClick={() => { phaseRef.current = "playing"; setPhase("playing"); }}
              className="px-10 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-lg rounded-full transition-all active:scale-95 shadow-lg shadow-sky-900/50 cursor-pointer mb-3"
            >
              ПРОДОЛЖИТЬ ИГРУ
            </button>
            <button
              onClick={() => { audio.stopAmbientBGM(); phaseRef.current = "menu"; setPhase("menu"); gameRef.current = null; }}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-full transition-all cursor-pointer"
            >
              ВЫЙТИ В ГЛАВНОЕ МЕНЮ
            </button>
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
              <p className="text-blue-300/80 font-mono text-xs tracking-widest mb-6">КОСМИЧЕСКИЙ РОГАЛИК · СИНТЕЗАТОР ЗВУКА · 100+ УЛУЧШЕНИЙ</p>

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
                <div className="text-yellow-400 font-mono text-sm mb-4 font-bold">🏆 Рекорд очков: {hiscore.toLocaleString()}</div>
              )}

              <button
                onClick={() => { audio.resume(); setPhase("ship_select"); }}
                className="px-14 py-4 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-2xl rounded-full shadow-2xl shadow-blue-900/60 transition-all active:scale-95 cursor-pointer"
              >
                ВЫБРАТЬ КОРАБЛЬ И В БОЙ
              </button>
              <div className="text-slate-500 font-mono text-xs mt-3">или нажмите ПРОБЕЛ / ENTER</div>
            </div>
          </div>
        )}

        {/* Ship Select Screen */}
        {phase === "ship_select" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-30 p-6">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-300 mb-1">
              ВЫБОР БОЕВОГО КОРАБЛЯ
            </h2>
            <p className="text-slate-400 font-mono text-xs mb-6">Выберите класс судна и специализацию вооружения</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl w-full mb-6">
              {SHIP_CLASSES.map((sc) => {
                const isSelected = selectedClass === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => { audio.playHit(); setSelectedClass(sc.id); }}
                    className={`
                      p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between
                      ${isSelected ? `bg-slate-900/90 shadow-xl scale-105 ring-2 ring-sky-400` : "border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:scale-102"}
                    `}
                    style={{ borderColor: isSelected ? sc.color : undefined }}
                  >
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
                onClick={() => setPhase("menu")}
                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-full transition-all cursor-pointer"
              >
                НАЗАД
              </button>
              <button
                onClick={() => startGame(selectedClass)}
                className="px-12 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-lg rounded-full shadow-xl shadow-blue-900/50 transition-all active:scale-95 cursor-pointer"
              >
                НАЧАТЬ МИССИЮ 🚀
              </button>
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

              <div className="flex gap-3">
                <button
                  onClick={() => setPhase("ship_select")}
                  className="flex-1 py-3.5 bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-base rounded-full shadow-xl transition-all active:scale-95 cursor-pointer"
                >
                  ПОВТОРИТЬ МИССИЮ
                </button>
                <button
                  onClick={() => { phaseRef.current = "menu"; setPhase("menu"); gameRef.current = null; }}
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
  );
}
