import { useEffect, useRef, useState, useCallback } from "react";
import type { PlayerState, UpgradeDef, GamePhase } from "./game/types";
import type { GameObjects } from "./game/gameLoop";
import { stepGame, makeStars, makeInitialPlayer, W, H, uid } from "./game/gameLoop";
import { rollUpgrades, applyUpgrade } from "./game/upgrades";
import { getWaveComposition, isBossWave, spawnBoss, getBossName } from "./game/enemies";
import {
  drawBackground, drawStars, drawPlayer, drawEnemy, drawBullet,
  drawParticle, drawXpOrb, drawMine, drawLightning, drawBlackHole, drawExplosion
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
    blackHolePos: null,
    blackHoleTimer: 0,
    explosions: [],
    waveEnemyQueue: composition.map(c => ({ ...c })),
    waveSpawnTimer: 60,
    bossActive: false,
    boss: null,
    waveTimer: 0,
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
  const [phase, setPhase]     = useState<GamePhase>("menu");
  const [wave, setWave]       = useState(1);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeDef[]>([]);
  const [bossActive, setBossActive] = useState(false);
  const [bossName, setBossName] = useState("");
  const [bossHpPct, setBossHpPct] = useState(1);
  const [timeSlow, setTimeSlow] = useState(false);
  const [enemiesLeft, setEnemiesLeft] = useState(0);
  const [hiscore, setHiscore]  = useState(() => { try { return parseInt(localStorage.getItem("hs") || "0"); } catch { return 0; } });

  const syncUI = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setPlayerLevel(g.player.level);
    setEnemiesLeft(g.enemies.length + g.waveEnemyQueue.reduce((a, c) => a + c.count, 0));
    if (g.bossActive && g.boss) {
      setBossHpPct(Math.max(0, g.boss.hp / g.boss.maxHp));
    }
  }, []);

  // ─── Start game ─────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const player = makeInitialPlayer();
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
    syncUI();
  }, [syncUI]);

  // ─── Wave advance ────────────────────────────────────────────────────────────
  const advanceWave = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    const newWave = waveRef.current + 1;
    waveRef.current = newWave;
    setWave(newWave);
    g.bossActive = false;
    g.boss = null;

    if (isBossWave(newWave)) {
      // Boss wave
      const boss = spawnBoss(newWave);
      g.enemies = [boss];
      g.boss = boss;
      g.bossActive = true;
      g.waveEnemyQueue = [];
      const bName = getBossName(boss.type);
      setBossName(bName);
      setBossActive(true);
      setBossHpPct(1);
      // Boss intro
      phaseRef.current = "boss_intro";
      setPhase("boss_intro");
      bossIntroTimerRef.current = 180;
    } else {
      const composition = getWaveComposition(newWave);
      g.waveEnemyQueue = composition.map(c => ({ ...c }));
      g.waveSpawnTimer = 80;
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
    applyUpgrade(g.player, u);
    pendingLevelUpsRef.current--;
    if (pendingLevelUpsRef.current > 0) {
      // More pending level-ups
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
    g.player.timeSlowTimer = 300;
    g.player.timeSlowCooldown = g.player.timeSlowCooldown || 500;
    timeSlowRef.current = true;
    setTimeSlow(true);
  }, []);

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === "Escape") {
        if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
        else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
      }
      if (e.key === "x" || e.key === "X") handleNuke();
      if (e.key === "c" || e.key === "C") handleTimeSlow();
      if ((e.key === " " || e.key === "Enter") && (phaseRef.current === "menu" || phaseRef.current === "dead")) startGame();
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [startGame, handleNuke, handleTimeSlow]);

  // ─── Game loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let uiSyncCounter = 0;

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const g = gameRef.current;
      const frame = ++frameRef.current;

      // Always draw background and stars
      drawBackground(ctx, frame);
      if (g) drawStars(ctx, g.stars);

      if (!g || phaseRef.current === "menu" || phaseRef.current === "dead") return;

      // Boss intro countdown
      if (phaseRef.current === "boss_intro") {
        bossIntroTimerRef.current--;
        if (bossIntroTimerRef.current <= 0) {
          phaseRef.current = "playing";
          setPhase("playing");
        }
        // Draw boss intro overlay on canvas
        ctx.save();
        const alpha = Math.min(1, bossIntroTimerRef.current / 60);
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 36px monospace";
        ctx.textAlign = "center";
        ctx.shadowBlur = 30; ctx.shadowColor = "#ef4444";
        ctx.fillText("⚠ BOSS APPROACHING ⚠", W / 2, H / 2 - 20);
        ctx.font = "20px monospace";
        ctx.fillStyle = "#fca5a5";
        ctx.shadowBlur = 0;
        ctx.fillText(bossName, W / 2, H / 2 + 20);
        ctx.restore();
        // Still draw everything else
        for (const e of g.enemies) drawEnemy(ctx, e, frame);
        drawPlayer(ctx, g.player, frame);
        return;
      }

      if (phaseRef.current === "paused") {
        // Draw static game
        for (const p of g.particles) drawParticle(ctx, p);
        for (const b of g.bullets) drawBullet(ctx, b);
        for (const e of g.enemies) drawEnemy(ctx, e, frame);
        for (const orb of g.xpOrbs) drawXpOrb(ctx, orb, frame);
        drawPlayer(ctx, g.player, frame);
        return;
      }

      if (phaseRef.current !== "playing" && phaseRef.current !== "upgrade") return;

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

      // Update boss ref
      if (g.bossActive && g.enemies.length > 0) {
        g.boss = g.enemies.find(e => e.isBoss) || null;
        if (!g.boss) { g.bossActive = false; setBossActive(false); }
      }

      // ─── Draw ─────────────────────────────────────────────────────────────
      // Explosions
      for (const ex of g.explosions) drawExplosion(ctx, ex.pos, ex.radius, ex.progress);

      // Particles
      for (const p2 of g.particles) drawParticle(ctx, p2);

      // Black hole
      if (g.blackHolePos) drawBlackHole(ctx, g.blackHolePos, frame);

      // Lightnings
      for (const l of g.lightnings) drawLightning(ctx, l);

      // Mines
      for (const m of g.mines) drawMine(ctx, m, frame);

      // XP orbs
      for (const orb of g.xpOrbs) drawXpOrb(ctx, orb, frame);

      // Bullets
      for (const b of g.bullets) drawBullet(ctx, b);

      // Enemies
      for (const e of g.enemies) drawEnemy(ctx, e, frame);

      // Player (on top)
      drawPlayer(ctx, g.player, frame);

      // Sync UI every 6 frames
      uiSyncCounter++;
      if (uiSyncCounter >= 6) { uiSyncCounter = 0; syncUI(); }
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [advanceWave, handleLevelUp, hiscore, syncUI]);

  // ─── Touch controls ───────────────────────────────────────────────────────
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
    // Fire on touch
    keysRef.current.add(" ");
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current || !gameRef.current) return;
    const t = e.touches[0];
    const dx = (t.clientX - touchRef.current.x) * 0.7;
    const dy = (t.clientY - touchRef.current.y) * 0.7;
    const player = gameRef.current.player;
    player.pos.x = Math.max(22, Math.min(W - 22, player.pos.x + dx));
    player.pos.y = Math.max(55, Math.min(H - 28, player.pos.y + dy));
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = () => {
    touchRef.current = null;
    keysRef.current.delete(" ");
  };

  const finalScore = gameRef.current?.player.score || 0;
  const finalWave  = waveRef.current;
  const finalKills = gameRef.current?.player.kills || 0;
  const finalLevel = gameRef.current?.player.level || 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div
        className="relative select-none overflow-hidden rounded-xl shadow-2xl shadow-black"
        style={{ width: W, height: H }}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block"
          style={{ touchAction: "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-30">
            <div className="text-5xl font-black text-white mb-2">⏸</div>
            <h2 className="text-3xl font-black text-white mb-6">PAUSED</h2>
            <div className="text-slate-400 font-mono text-sm mb-6 space-y-1 text-center">
              <p>Move: <span className="text-sky-400">WASD / Arrows</span></p>
              <p>Fire: <span className="text-sky-400">Space / Z / W</span></p>
              <p>Nuke: <span className="text-red-400">X</span> | Time Slow: <span className="text-cyan-400">C</span></p>
            </div>
            <button
              onClick={() => { phaseRef.current = "playing"; setPhase("playing"); }}
              className="px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-lg rounded-full transition-all active:scale-95"
            >
              RESUME
            </button>
          </div>
        )}

        {/* Menu */}
        {phase === "menu" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-30">
            <div className="text-center max-w-lg px-6">
              <div className="text-7xl mb-3">🚀</div>
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-sky-300 via-blue-400 to-violet-500 tracking-tight mb-1">
                SPACE SHOOTER
              </h1>
              <p className="text-blue-300/60 font-mono text-xs tracking-widest mb-6">ROGUELITE ARCADE · WAVE SURVIVAL</p>

              <div className="grid grid-cols-2 gap-3 text-sm mb-6 font-mono">
                <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
                  <div className="text-slate-400 text-xs mb-1">MOVEMENT</div>
                  <div className="text-sky-400">WASD / Arrows</div>
                </div>
                <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
                  <div className="text-slate-400 text-xs mb-1">FIRE</div>
                  <div className="text-sky-400">Space / Z / W↑</div>
                </div>
                <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
                  <div className="text-slate-400 text-xs mb-1">NUKE</div>
                  <div className="text-red-400">X</div>
                </div>
                <div className="bg-slate-900/70 rounded-xl p-3 border border-slate-700">
                  <div className="text-slate-400 text-xs mb-1">TIME SLOW</div>
                  <div className="text-cyan-400">C</div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700 mb-4 text-xs font-mono text-slate-400">
                🎮 Level up → choose from <span className="text-yellow-400">3 random upgrades</span> · 
                100+ upgrades · 6 Bosses · Infinite waves
              </div>

              {hiscore > 0 && (
                <div className="text-yellow-400 font-mono text-sm mb-4">🏆 Best Score: {hiscore.toLocaleString()}</div>
              )}

              <button
                onClick={startGame}
                className="px-12 py-4 bg-gradient-to-r from-sky-600 to-violet-600 hover:from-sky-500 hover:to-violet-500 text-white font-black text-2xl rounded-full shadow-xl shadow-blue-900/50 transition-all active:scale-95"
              >
                PLAY
              </button>
              <div className="text-slate-600 font-mono text-xs mt-3">or press SPACE / ENTER</div>
            </div>
          </div>
        )}

        {/* Death screen */}
        {phase === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-30">
            <div className="text-center max-w-sm px-6">
              <div className="text-6xl mb-3">💀</div>
              <h2 className="text-4xl font-black text-red-400 mb-1">DESTROYED</h2>
              <p className="text-slate-500 font-mono text-xs mb-6">Your ship was annihilated</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 mb-6 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Score</span>
                  <span className="text-white font-black text-xl">{finalScore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Best</span>
                  <span className="text-yellow-400 font-bold">{hiscore.toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 mt-2 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-slate-500 text-xs">WAVE</div><div className="text-white font-bold">{finalWave}</div></div>
                  <div><div className="text-slate-500 text-xs">KILLS</div><div className="text-red-400 font-bold">{finalKills}</div></div>
                  <div><div className="text-slate-500 text-xs">LEVEL</div><div className="text-purple-400 font-bold">{finalLevel}</div></div>
                </div>
                {finalScore >= hiscore && finalScore > 0 && (
                  <div className="text-yellow-400 text-center text-sm font-black animate-pulse">🏆 NEW HIGH SCORE!</div>
                )}
              </div>

              <button
                onClick={startGame}
                className="w-full py-4 bg-gradient-to-r from-red-700 to-orange-700 hover:from-red-600 hover:to-orange-600 text-white font-black text-xl rounded-full shadow-xl transition-all active:scale-95 mb-3"
              >
                RETRY
              </button>
              <button
                onClick={() => { phaseRef.current = "menu"; setPhase("menu"); gameRef.current = null; }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-full transition-all active:scale-95"
              >
                MENU
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
