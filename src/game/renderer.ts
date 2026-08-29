import type {
  Bullet, Enemy, Particle, Star, PlayerState, XpOrb, Mine,
  Lightning, FloatingText, PowerupItem
} from "./types";
import { getEnemyColors, getEnemySize } from "./enemies";

export const W = 960;
export const H = 720;

let renderPerformanceTier: 0 | 1 | 2 = 2;
export function setRenderPerformanceTier(tier: 0 | 1 | 2) {
  // No cache invalidation here: the tier is part of every sprite key, so a
  // tier switch simply bakes the new tier's sprites once. Clearing the cache
  // on every switch re-baked ~100+ glow sprites in a single frame and read
  // as a hard freeze while the auto quality controller oscillated.
  renderPerformanceTier = tier;
}

// P1.4 dynamic quality disabled features
let disabledFeatures: Set<string> = new Set();
export function setDisabledFeatures(features: Set<string>): void {
  disabledFeatures = new Set(features);
}
export function isFeatureDisabled(feat: string): boolean {
  return disabledFeatures.has(feat);
}
export function getDisabledFeatures(): Set<string> {
  return new Set(disabledFeatures);
}

// ─── Sprite cache (render hot-path optimization) ─────────────────────────────
// shadowBlur is by far the most expensive Canvas2D operation. The premium
// Wraith used to pay for it up to ~40× per frame (echo clone + double-exposure
// ghosts + main body, each with several glowing fills/strokes) and then again
// for every homing bolt (per-bullet gradient + shadowBlur, and the Wraith
// fields roughly twice the bullets for twice as long). These helpers bake the
// glow into an offscreen canvas once and blit it — same visuals, a fraction of
// the per-frame cost. Sprites are supersampled 2× so rotated blits stay crisp.

const SPRITE_SCALE = 2;
const SPRITE_CACHE_LIMIT = 512;

function makeSprite(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  // Guard against pathological dimensions: a 0-sized canvas makes drawImage
  // throw InvalidStateError and kill the whole requestAnimationFrame loop.
  const safe = (v: number) => (Number.isFinite(v) ? Math.min(2048, Math.max(1, Math.ceil(v * SPRITE_SCALE))) : 16);
  const canvas = document.createElement("canvas");
  canvas.width = safe(w);
  canvas.height = safe(h);
  const sctx = canvas.getContext("2d")!;
  sctx.scale(SPRITE_SCALE, SPRITE_SCALE);
  return [canvas, sctx];
}

function blitSprite(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, w: number, h: number) {
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
}

function cacheSprite(cache: Map<string, HTMLCanvasElement>, key: string, w: number, h: number, paint: (sctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  if (cache.size >= SPRITE_CACHE_LIMIT) {
    // Evict the oldest quarter only (Map iterates in insertion order). A full
    // clear() here re-baked every sprite in the next frame — with ~120 enemy
    // bullet variants (16 colors × 7 sizes, per quality tier) that turned
    // into a permanent bake-every-frame storm that froze the game.
    let toDrop = SPRITE_CACHE_LIMIT >> 2;
    for (const stale of cache.keys()) {
      if (toDrop-- <= 0) break;
      cache.delete(stale);
    }
  }
  const [canvas, sctx] = makeSprite(w, h);
  paint(sctx);
  cache.set(key, canvas);
  return canvas;
}

/** Test hook: total baked sprite count (bounded by SPRITE_CACHE_LIMIT). */
export function spriteCacheSize(): number {
  return bulletSprites.size + wraithBodySprites.size + wraithCoreSprites.size;
}

// ─── Void Guard omen ──────────────────────────────────────────────────────────
export function drawVoidEye(ctx: CanvasRenderingContext2D, frame: number, target: { x: number; y: number }) {
  const cx = W / 2, cy = H * 0.3;
  const pulse = 1 + Math.sin(frame * 0.035) * 0.04;
  const lookX = Math.max(-24, Math.min(24, (target.x - cx) * 0.045));
  const lookY = Math.max(-10, Math.min(10, (target.y - cy) * 0.025));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = renderPerformanceTier === 0 ? 0.2 : 0.28;
  if (renderPerformanceTier > 0) {
    const aura = ctx.createRadialGradient(0, 0, 15, 0, 0, 240);
    aura.addColorStop(0, "rgba(244,63,94,0.5)");
    aura.addColorStop(0.45, "rgba(88,28,135,0.2)");
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(-260, -180, 520, 360);
  }
  ctx.strokeStyle = "#a21caf";
  ctx.lineWidth = renderPerformanceTier === 0 ? 3 : 6;
  ctx.beginPath();
  ctx.moveTo(-190, 0);
  ctx.quadraticCurveTo(0, -115, 190, 0);
  ctx.quadraticCurveTo(0, 115, -190, 0);
  ctx.stroke();
  ctx.fillStyle = "rgba(15,3,25,0.9)";
  ctx.beginPath(); ctx.ellipse(0, 0, 105, 58, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(lookX, lookY);
  ctx.fillStyle = "#e11d48";
  ctx.beginPath(); ctx.ellipse(0, 0, 28, 50, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#020617";
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ─── Stars ────────────────────────────────────────────────────────────────────
export function drawStars(ctx: CanvasRenderingContext2D, stars: Star[]) {
  if (disabledFeatures.has("stars")) return;
  const limit = disabledFeatures.has("particles") ? Math.floor(stars.length * 0.3) : stars.length;
  for (let i=0;i<limit;i++) {
    const s = stars[i];
    const brightness = Math.min(s.z / 4, 1);
    ctx.globalAlpha = brightness * 0.8;
    ctx.fillStyle = s.z > 2.5 ? "#ffe8b2" : "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.z * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Background ───────────────────────────────────────────────────────────────
// Туманность запекается один раз в offscreen-канвас: раньше каждый кадр
// создавал 3 полноэкранных градиента и делал 3 полноэкранные заливки —
// постоянные ~1-3 мс даже на пустом экране. Лёгкое покачивание имитируем
// смещением блита (визуально неотличимо от прежнего sin-дрейфа).
let nebulaSprite: HTMLCanvasElement | null = null;

export function drawBackground(ctx: CanvasRenderingContext2D, frame: number) {
  if (!nebulaSprite) {
    const [canvas, sctx] = makeSprite(W + 80, H);
    const colors = [
      ["rgba(60,20,100,0.14)", W * 0.3, H * 0.4, 360],
      ["rgba(10,40,120,0.12)",  W * 0.7, H * 0.6, 300],
      ["rgba(100,10,60,0.10)", W * 0.5, H * 0.2, 260],
    ] as const;
    for (const [color, cx, cy, r] of colors) {
      const grd = sctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, color);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      sctx.fillStyle = grd;
      sctx.fillRect(0, 0, W + 80, H);
    }
    nebulaSprite = canvas;
  }
  ctx.fillStyle = "#03050d";
  ctx.fillRect(0, 0, W, H);
  const drift = Math.sin(frame * 0.002) * 20 - 20;
  ctx.drawImage(nebulaSprite, drift, 0, W + 80, H);
}

// ─── Player ───────────────────────────────────────────────────────────────────
// The Wraith's signature silhouette: a slim void dagger with membrane wings
// and a pulsing core. Distinct from the shared fighter hull of the other ships.
// The static glowing geometry (wings/hull/cockpit) is baked into offscreen
// sprites per variant — the ship renders up to 4 body copies per frame (echo
// clone + phased double-exposure ghosts + main hull), which with live
// shadowBlur was the Wraith's single biggest frame cost.
type WraithBodyVariant = "idle" | "phased" | "echo";

const WRAITH_SPRITE_SIZE = 120; // body spans +/-34 px plus shadowBlur bleed
const wraithBodySprites = new Map<string, HTMLCanvasElement>();
const wraithCoreSprites = new Map<string, HTMLCanvasElement>();

function getWraithBodySprite(variant: WraithBodyVariant): HTMLCanvasElement {
  const cached = wraithBodySprites.get(variant);
  if (cached) return cached;
  return cacheSprite(wraithBodySprites, variant, WRAITH_SPRITE_SIZE, WRAITH_SPRITE_SIZE, sctx => {
    sctx.translate(WRAITH_SPRITE_SIZE / 2, WRAITH_SPRITE_SIZE / 2);
    drawWraithBodyShapes(sctx, variant);
  });
}

function getWraithCoreSprite(variant: WraithBodyVariant): HTMLCanvasElement {
  const cached = wraithCoreSprites.get(variant);
  if (cached) return cached;
  const size = 24;
  return cacheSprite(wraithCoreSprites, variant, size, size, sctx => {
    sctx.translate(size / 2, size / 2);
    const coreColor = variant === "echo" ? "#a5f3fc" : variant === "phased" ? "#ffffff" : "#f0abfc";
    const g = sctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, coreColor);
    g.addColorStop(1, variant === "echo" ? "rgba(165,243,252,0)" : "rgba(240,171,252,0)");
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    sctx.fill();
  });
}

function drawWraithBodyShapes(ctx: CanvasRenderingContext2D, variant: WraithBodyVariant) {
  const main = variant === "phased" ? "#f0abfc" : variant === "echo" ? "#67e8f9" : "#e879f9";

  // Membrane wings
  ctx.shadowBlur = variant === "idle" ? 10 : 16;
  ctx.shadowColor = main;
  ctx.fillStyle = "rgba(232,121,249,0.22)";
  ctx.strokeStyle = main;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(9, 2);
  ctx.lineTo(30, 13);
  ctx.lineTo(12, 11);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.lineTo(-30, 13);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Blade hull
  ctx.shadowBlur = variant === "idle" ? 12 : 18;
  ctx.shadowColor = main;
  ctx.fillStyle = "#150a1e";
  ctx.strokeStyle = main;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(6.5, -20);
  ctx.lineTo(9, 2);
  ctx.lineTo(21, 20);
  ctx.lineTo(9, 15);
  ctx.lineTo(4.5, 26);
  ctx.lineTo(0, 17);
  ctx.lineTo(-4.5, 26);
  ctx.lineTo(-9, 15);
  ctx.lineTo(-21, 20);
  ctx.lineTo(-9, 2);
  ctx.lineTo(-6.5, -20);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Cockpit
  ctx.shadowBlur = 8;
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.ellipse(0, -11, 4, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawWraithBody(ctx: CanvasRenderingContext2D, frame: number, variant: WraithBodyVariant) {
  blitSprite(ctx, getWraithBodySprite(variant), WRAITH_SPRITE_SIZE, WRAITH_SPRITE_SIZE);
  // Pulsing void core — a cached glow sprite scaled by the pulse instead of a
  // live shadowBlur'd circle. Насыщенность Бездны усиливает свечение ядра.
  const soulsFrac = ctxSoulsFraction;
  const coreR = (3 + Math.sin(frame * 0.3) * 1.3) * (1 + soulsFrac * 0.5);
  const glow = (8 + Math.max(1.5, coreR) * 3) * (1 + soulsFrac * 0.6);
  ctx.drawImage(getWraithCoreSprite(variant), -glow / 2, 6 - glow / 2, glow, glow);
}

// Доля насыщения души (0..1) для визуальной эскалации корпуса «Немезиды».
// Устанавливается drawPlayer перед отрисовкой (25/50/75/100% → рост свечения,
// длины следа и яркости крыльев).
let ctxSoulsFraction = 0;

// Arena-wide void tint while the Wraith's phase window is open. The gradient
// is baked once at the maximum possible alpha and blitted with a scaled
// globalAlpha — compositing is linear in source alpha, so the result is
// identical to the old per-frame full-screen gradient at a fraction of the cost.
const VOID_VIGNETTE_MAX_ALPHA = 0.12; // max of (0.07 + 0.05·sin) × min(1, intensity+0.45)
let vignetteSprite: HTMLCanvasElement | null = null;

export function drawVoidPhaseVignette(ctx: CanvasRenderingContext2D, frame: number, intensity: number) {
  if (renderPerformanceTier === 0) return; // full-screen tint: too dear for low-end
  if (!vignetteSprite) {
    vignetteSprite = document.createElement("canvas");
    vignetteSprite.width = W;
    vignetteSprite.height = H;
    const sctx = vignetteSprite.getContext("2d")!;
    const g = sctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, "rgba(168,85,247,0)");
    g.addColorStop(1, `rgba(192,38,211,${VOID_VIGNETTE_MAX_ALPHA})`);
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, W, H);
  }
  const a = (0.07 + 0.05 * Math.sin(frame * 0.35)) * Math.min(1, intensity + 0.45);
  ctx.globalAlpha = a / VOID_VIGNETTE_MAX_ALPHA;
  ctx.drawImage(vignetteSprite, 0, 0);
  ctx.globalAlpha = 1;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, state: PlayerState, frame: number) {
  const { pos, invincTimer, shield, satellites, drones, aura, shipClass, rapidBoostTimer } = state;
  // Насыщенность Бездны (0..1) — визуальная эскалация премиальной механики:
  // свечение ядра, длина следа и яркость крыльев растут на 25/50/75/100%.
  ctxSoulsFraction = shipClass === "void_wraith" ? Math.min(1, state.voidSouls / 20) : 0;

  // Phase echo: the Wraith's fading clone left behind by the blink. Drawn
  // before the damage-blink early return so it survives the ship's flash.
  // Low-end tiers draw a cheap glow instead of a full second ship body.
  if (shipClass === "void_wraith" && state.voidEchoTimer > 0) {
    const echoAlpha = 0.1 + 0.42 * (state.voidEchoTimer / 120);
    ctx.save();
    ctx.globalAlpha = echoAlpha;
    ctx.translate(state.voidEchoPos.x, state.voidEchoPos.y);
    if (renderPerformanceTier === 0) {
      const eg = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
      eg.addColorStop(0, "rgba(103,232,249,0.5)");
      eg.addColorStop(1, "rgba(103,232,249,0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Эхо визуально отличается от самого корабля: бледно-циановый силуэт
      // призрачного двойника (корабль остаётся фиолетовым).
      drawWraithBody(ctx, frame, "echo");
    }
    ctx.restore();
  }

  if (invincTimer > 0 && frame % 8 < 4) return;

  ctx.save();
  ctx.translate(pos.x, pos.y);

  // Rapid Overdrive glow
  if (rapidBoostTimer > 0) {
    const og = ctx.createRadialGradient(0, 0, 10, 0, 0, 50);
    og.addColorStop(0, "rgba(56,189,248,0.35)");
    og.addColorStop(1, "rgba(56,189,248,0)");
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aura glow
  if (aura) {
    const ag = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
    ag.addColorStop(0, "rgba(255,200,50,0.18)");
    ag.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shield bubble
  if (shield && shield.hp > 0) {
    const alpha = 0.35 + 0.2 * Math.sin(frame * 0.1);
    const pct = shield.hp / shield.maxHp;
    ctx.strokeStyle = `rgba(100,180,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 40 + Math.sin(frame * 0.08) * 2, 0, Math.PI * 2);
    ctx.stroke();
    const sg = ctx.createRadialGradient(0, 0, 28, 0, 0, 44);
    sg.addColorStop(0, `rgba(100,180,255,${0.05 * pct})`);
    sg.addColorStop(1, `rgba(100,180,255,${0.18 * pct})`);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
  }

  // Engine trail
  const eg = ctx.createLinearGradient(0, 0, 0, 40);
  const trailColor = shipClass === "tempest" ? "rgba(168,85,247,0.9)" :
                     shipClass === "dreadnought" ? "rgba(245,158,11,0.9)" :
                     shipClass === "commander" ? "rgba(16,185,129,0.9)" :
                     shipClass === "void_wraith" ? "rgba(232,121,249,0.9)" : "rgba(56,189,248,0.9)";
  eg.addColorStop(0, trailColor);
  eg.addColorStop(0.5, "rgba(99,102,241,0.5)");
  eg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = eg;
  // След растёт в Фазе Бездны и от накопленных душ — сила «читается» глазами.
  const phasedNow = shipClass === "void_wraith" && state.ghostTimer > 0;
  const trailBoost = (phasedNow ? 1.6 : 1) * (1 + ctxSoulsFraction * 0.5);
  const trailH = (22 + Math.sin(frame * 0.3) * 8) * trailBoost;
  ctx.globalAlpha = phasedNow ? 0.95 : 1;
  ctx.beginPath();
  ctx.moveTo(-8, 14);
  ctx.lineTo(0, 14 + trailH);
  ctx.lineTo(8, 14);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // The Wraith drags two side plasma wisps behind its blade hull.
  if (shipClass === "void_wraith" && renderPerformanceTier >= 1) {
    const wg = ctx.createLinearGradient(0, 14, 0, 14 + trailH * 0.9);
    wg.addColorStop(0, "rgba(168,85,247,0.65)");
    wg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wg;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 7, 12);
      ctx.lineTo(side * 3, 14 + trailH * 0.8);
      ctx.lineTo(side * 10, 17);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Ship body based on class
  const mainColor = shipClass === "tempest" ? "#a855f7" :
                    shipClass === "dreadnought" ? "#f59e0b" :
                    shipClass === "commander" ? "#10b981" :
                    shipClass === "void_wraith" ? "#e879f9" : "#38bdf8";

  if (shipClass === "void_wraith") {
    const phased = state.ghostTimer > 0;
    // Phase window: full glow plus an expanding shock ring; idle: subtle
    // shimmer that sells the "phased" identity even without a blink.
    // Gradient glow and double-exposure cost real canvas time, so they are
    // tier-gated (Auto/Low drop them first, High keeps everything).
    const phaseAlpha = phased ? state.ghostTimer / 120 : 0;
    if (phased) {
      if (renderPerformanceTier >= 1) {
        const ringRadius = 30 + (120 - state.ghostTimer) * 0.7;
        ctx.strokeStyle = `rgba(232,121,249,${(0.5 * phaseAlpha).toFixed(3)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (renderPerformanceTier === 2) {
        const pg = ctx.createRadialGradient(0, 0, 8, 0, 0, 58);
        pg.addColorStop(0, `rgba(232,121,249,${(0.3 * phaseAlpha).toFixed(3)})`);
        pg.addColorStop(1, "rgba(232,121,249,0)");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(0, 0, 58, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Переход в фазу: на первые ~12 кадров корпус почти исчезает и быстро
    // «проявляется» обратно — ощущение смены состояния, а не просто свечения.
    const phaseFade = phased && state.ghostTimer > 108
      ? 0.15 + (120 - state.ghostTimer) / 12 * 0.85
      : 1;
    // globalAlpha > 1 молча игнорируется canvas API — обязательно клампим.
    ctx.globalAlpha = Math.min(1, (phased ? phaseFade : 0.82 + 0.18 * Math.sin(frame * 0.22)) * (1 + ctxSoulsFraction * 0.18));
    if (phased && renderPerformanceTier === 2) {
      // Double-exposure ghosting while phased (high tier only).
      for (const gx of [3, -3]) {
        ctx.save();
        ctx.globalAlpha = 0.28 * phaseFade;
        ctx.translate(gx, -2);
        drawWraithBody(ctx, frame, "phased");
        ctx.restore();
      }
    }
    if (phased && renderPerformanceTier === 1) {
      ctx.save();
      ctx.globalAlpha = 0.28 * phaseFade;
      ctx.translate(3, -2);
      drawWraithBody(ctx, frame, "phased");
      ctx.restore();
    }
    drawWraithBody(ctx, frame, phased ? "phased" : "idle");
    ctx.globalAlpha = 1;
  } else {
    ctx.shadowBlur = 15;
    ctx.shadowColor = mainColor;
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.6;

    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(24, 18);
    ctx.lineTo(11, 11);
    ctx.lineTo(0, 16);
    ctx.lineTo(-11, 11);
    ctx.lineTo(-24, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wings
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-11, 6);
    ctx.lineTo(-28, 18);
    ctx.lineTo(-15, 14);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(11, 6);
    ctx.lineTo(28, 18);
    ctx.lineTo(15, 14);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Cockpit
    ctx.shadowBlur = 8;
    ctx.shadowColor = mainColor;
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.ellipse(0, -9, 5.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Satellites
  for (const sat of satellites) {
    const sx = pos.x + Math.cos(sat.angle) * sat.radius;
    const sy = pos.y + Math.sin(sat.angle) * sat.radius;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(sat.angle + Math.PI / 2);
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#f59e0b";
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-8, -4, 16, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath();
    ctx.rect(-3, -3, 6, 6);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.strokeStyle = "rgba(251,191,36,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, sat.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Drones
  for (const drone of drones) {
    ctx.save();
    ctx.translate(drone.pos.x, drone.pos.y);
    ctx.rotate(drone.angle);
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#a78bfa";
    ctx.fillStyle = "#7c3aed";
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

// ─── Enemy ────────────────────────────────────────────────────────────────────
export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, frame: number) {
  const [fill, stroke, light] = getEnemyColors(e.type);
  const size = getEnemySize(e.type);

  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);

  // Elite Aura
  if (e.isElite) {
    const pulse = Math.sin(frame * 0.15) * 4;
    ctx.strokeStyle = "rgba(251,191,36,0.7)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, size + 12 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (e.guardRole === "herald" && (e.guardMarkedTimer ?? 0) > 0) {
    const markerY = -size - 42 - Math.sin(frame * 0.12) * 5;
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, markerY + 14);
    ctx.lineTo(-10, markerY);
    ctx.lineTo(10, markerY);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("ЦЕЛЬ №1", 0, markerY - 7);
  }

  if (e.guardRole) {
    const roleColor = e.guardRole === "herald" ? "#f0abfc" : e.guardRole === "reaper" ? "#fb7185" : e.guardRole === "eye" ? "#c084fc" : "#818cf8";
    ctx.strokeStyle = roleColor;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size + 18 + Math.sin(frame * 0.08 + e.id) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (renderPerformanceTier > 0) { ctx.shadowBlur = 12; ctx.shadowColor = roleColor; }
  }

  // Freeze tint
  if (e.frozen > 0) {
    ctx.fillStyle = "rgba(147,197,253,0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, size + 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Burn
  if (e.burning > 0 && frame % 4 < 2) {
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Poison
  if (e.poisoned > 0) {
    ctx.fillStyle = "rgba(74,222,128,0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, size + 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Стоимость shadowBlur растёт квадратично от радиуса: 25/18/12 на каждом
  // из 60-80 врагов валили кадр. Понижено и огейчено по тирам качества.
  ctx.shadowBlur = renderPerformanceTier === 0 ? 0
    : renderPerformanceTier === 1 ? (e.isBoss ? 5 : e.isElite ? 4 : 2)
    : (e.isBoss ? 14 : e.isElite ? 10 : 6);
  ctx.shadowColor = e.isElite ? "#fbbf24" : stroke;

  const speedFactor = e.frozen > 0 ? 0 : 1;
  const rot = e.angle * speedFactor;

  switch (e.type) {
    case "scout": drawScout(ctx, fill, stroke, size); break;
    case "fighter": drawFighter(ctx, fill, stroke, size); break;
    case "bomber": drawBomber(ctx, fill, stroke, size); break;
    case "sniper": drawSniper(ctx, fill, stroke, size); break;
    case "tank": drawTank(ctx, fill, stroke, light, size); break;
    case "splitter": drawSplitter(ctx, fill, stroke, size); break;
    case "kamikaze": drawKamikaze(ctx, fill, stroke, size, frame); break;
    case "spinner": ctx.rotate(rot); drawSpinner(ctx, fill, stroke, size); break;
    case "stealth": ctx.globalAlpha = 0.5; drawScout(ctx, fill, stroke, size); ctx.globalAlpha = 1; break;
    case "charger": drawCharger(ctx, fill, stroke, size); break;
    case "healer": drawHealer(ctx, fill, stroke, size, frame); break;
    case "artillery": drawArtillery(ctx, fill, stroke, size); break;
    case "warden": drawTank(ctx, fill, stroke, light, size); break;
    case "phantom":
      ctx.globalAlpha = Math.floor(e.patternTimer / 90) % 3 === 0 ? 0.22 : 0.85;
      drawScout(ctx, fill, stroke, size);
      ctx.globalAlpha = 1;
      break;
    case "leecher": drawCharger(ctx, fill, stroke, size); break;
    case "carrier": drawBomber(ctx, fill, stroke, size); break;
    case "singularity": ctx.rotate(rot); drawSpinner(ctx, fill, stroke, size); break;
    case "boss_destroyer":  drawBossDestroyer(ctx, fill, stroke, light, size, frame); break;
    case "boss_mothership": drawBossMothership(ctx, fill, stroke, light, size, frame); break;
    case "boss_dreadnought":drawBossDreadnought(ctx, fill, stroke, light, size, frame); break;
    case "boss_eclipse":    drawBossEclipse(ctx, fill, stroke, light, size, frame); break;
    case "boss_titan":      drawBossTitan(ctx, fill, stroke, light, size, frame); break;
    case "boss_omega":
      ctx.save();
      ctx.scale(1 + e.phase * 0.055, 1 + e.phase * 0.055);
      ctx.rotate(Math.sin(frame * 0.025) * e.phase * 0.025);
      drawBossOmega(ctx, e.phase >= 3 ? "#ffffff" : fill, stroke, e.phase >= 2 ? "#f0abfc" : light, size, frame * (1 + e.phase * 0.18));
      ctx.restore();
      break;
  }

  // Shield
  if (e.shieldHp > 0) {
    const pct = e.shieldHp / e.maxShieldHp;
    ctx.strokeStyle = `rgba(147,197,253,${0.5 + 0.3 * Math.sin(frame * 0.15)})`;
    ctx.lineWidth = 2 + pct * 2;
    ctx.beginPath();
    ctx.arc(0, 0, size + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Temporary boss control immunity after repeated freezes.
  if (e.isBoss && e.controlImmunity > 0) {
    ctx.strokeStyle = "rgba(165,243,252,0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, size + 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // HP bar
  const bw = Math.max(size * 2, 50);
  const by = size + 12;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(-bw / 2, by, bw, 5);
  // Damage-over-time and area effects may cross zero between simulation ticks.
  // Clamp the visual ratio so a negative width can never stretch across canvas.
  const pct = Math.max(0, Math.min(1, e.maxHp > 0 ? e.hp / e.maxHp : 0));
  ctx.fillStyle = pct > 0.6 ? "#4ade80" : pct > 0.3 ? "#fbbf24" : "#f87171";
  ctx.fillRect(-bw / 2, by, bw * pct, 5);

  // Elite tag
  if (e.isElite && e.eliteName) {
    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.fillText(e.eliteName, 0, -size - 8);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawScout(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, s); ctx.lineTo(s * 0.8, -s * 0.6);
  ctx.lineTo(0, -s * 0.2); ctx.lineTo(-s * 0.8, -s * 0.6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawFighter(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, s); ctx.lineTo(s, -s * 0.3); ctx.lineTo(s * 0.4, -s);
  ctx.lineTo(0, -s * 0.5); ctx.lineTo(-s * 0.4, -s); ctx.lineTo(-s, -s * 0.3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawBomber(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = stroke;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.fill();
}
function drawSniper(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, s * 1.2); ctx.lineTo(s * 0.3, 0); ctx.lineTo(s * 0.5, -s * 0.5);
  ctx.lineTo(0, -s * 1.2); ctx.lineTo(-s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.3, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawTank(ctx: CanvasRenderingContext2D, fill: string, stroke: string, light: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.rect(-s, -s, s * 2, s * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = light; ctx.beginPath(); ctx.rect(-s * 0.5, -s * 0.5, s, s); ctx.fill();
  ctx.fillStyle = stroke; ctx.fillRect(-4, -s - 10, 8, 14);
}
function drawSplitter(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.rotate((i / 3) * Math.PI * 2);
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, s * 0.5); ctx.lineTo(-s * 0.6, s * 0.5); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
}
function drawKamikaze(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number, frame: number) {
  const flicker = Math.sin(frame * 0.3) * 0.3 + 0.7;
  ctx.globalAlpha = flicker;
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, s); ctx.lineTo(s * 0.5, -s * 0.5); ctx.lineTo(0, 0); ctx.lineTo(-s * 0.5, -s * 0.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawSpinner(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate((i / 4) * Math.PI * 2);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.7, s * 0.3, s * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); ctx.fill();
}
function drawCharger(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 1.1); ctx.lineTo(s * 0.9, -s * 0.3); ctx.lineTo(s * 0.3, -s * 0.3);
  ctx.lineTo(s * 0.6, -s * 1.1); ctx.lineTo(-s * 0.6, -s * 1.1); ctx.lineTo(-s * 0.3, -s * 0.3);
  ctx.lineTo(-s * 0.9, -s * 0.3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawHealer(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number, frame: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
  const pulse = Math.sin(frame * 0.1) * 4;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.5 - pulse); ctx.lineTo(0, s * 0.5 + pulse); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s * 0.5 - pulse, 0); ctx.lineTo(s * 0.5 + pulse, 0); ctx.stroke();
}
function drawArtillery(ctx: CanvasRenderingContext2D, fill: string, stroke: string, s: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = stroke;
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate((i / 6) * Math.PI * 2);
    ctx.fillRect(-3, -s - 8, 6, 12); ctx.restore();
  }
}

function drawBossDestroyer(ctx: CanvasRenderingContext2D, fill: string, stroke: string, light: string, s: number, frame: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, s * 1.4); ctx.lineTo(s * 1.2, s * 0.3);
  ctx.lineTo(s * 1.5, -s * 0.5); ctx.lineTo(s * 0.8, -s);
  ctx.lineTo(0, -s * 0.5); ctx.lineTo(-s * 0.8, -s);
  ctx.lineTo(-s * 1.5, -s * 0.5); ctx.lineTo(-s * 1.2, s * 0.3);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = stroke;
  ctx.fillRect(-s - 6, -s * 0.2, 10, s * 0.6);
  ctx.fillRect(s - 4, -s * 0.2, 10, s * 0.6);
  const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawBossMothership(ctx: CanvasRenderingContext2D, fill: string, stroke: string, light: string, s: number, frame: number) {
  ctx.strokeStyle = stroke; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, s * 1.3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.1, s * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 0.45, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i / 6) * Math.PI * 2 + frame * 0.005);
    ctx.fillStyle = stroke;
    ctx.beginPath(); ctx.arc(s * 1.1, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const pulse = Math.sin(frame * 0.08) * 0.4 + 0.6;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawBossDreadnought(ctx: CanvasRenderingContext2D, fill: string, stroke: string, light: string, s: number, frame: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, s * 1.6); ctx.lineTo(s * 0.5, s * 0.8);
  ctx.lineTo(s * 1.8, s * 0.2); ctx.lineTo(s * 1.4, -s * 0.5);
  ctx.lineTo(s * 0.7, -s); ctx.lineTo(0, -s * 0.8);
  ctx.lineTo(-s * 0.7, -s); ctx.lineTo(-s * 1.4, -s * 0.5);
  ctx.lineTo(-s * 1.8, s * 0.2); ctx.lineTo(-s * 0.5, s * 0.8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = light;
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.rotate((i / 3) * Math.PI * 2 + frame * 0.01);
    ctx.beginPath(); ctx.ellipse(s * 0.5, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const pulse = (Math.sin(frame * 0.12) + 1) * 0.5;
  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.fillStyle = "#fde68a"; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawBossEclipse(ctx: CanvasRenderingContext2D, fill: string, stroke: string, light: string, s: number, frame: number) {
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.1 / i;
    ctx.strokeStyle = light;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, s * (1.2 + i * 0.2) + Math.sin(frame * 0.05 + i) * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#030712";
  ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2 + frame * 0.015);
    ctx.translate(s * 1.05, 0);
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 0); ctx.lineTo(0, 7); ctx.lineTo(-5, 0);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
}
function drawBossTitan(ctx: CanvasRenderingContext2D, fill: string, stroke: string, light: string, s: number, frame: number) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.8); ctx.lineTo(s * 1.6, -s * 0.6);
  ctx.lineTo(s * 2, s * 0.2); ctx.lineTo(s * 1.4, s * 1.2);
  ctx.lineTo(s * 0.4, s * 1.8); ctx.lineTo(-s * 0.4, s * 1.8);
  ctx.lineTo(-s * 1.4, s * 1.2); ctx.lineTo(-s * 2, s * 0.2);
  ctx.lineTo(-s * 1.6, -s * 0.6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = light; ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate((i / 4) * Math.PI * 2);
    ctx.beginPath(); ctx.rect(-15, -s * 0.5, 30, s * 0.8); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  const pulse = Math.sin(frame * 0.07) * 0.4 + 0.6;
  ctx.globalAlpha = pulse;
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
  cg.addColorStop(0, "#fff");
  cg.addColorStop(1, light);
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawBossOmega(ctx: CanvasRenderingContext2D, fill: string, stroke: string, light: string, s: number, frame: number) {
  for (let i = 4; i >= 1; i--) {
    ctx.save();
    ctx.rotate(frame * 0.003 * i);
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = i % 2 === 0 ? fill : light;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, s * (1.1 + i * 0.25), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  const phase = frame * 0.02;
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const r = s * (1.5 + Math.sin(a * 7 + phase) * 0.15 + Math.cos(a * 3 - phase) * 0.1);
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = "#0f0f0f";
  ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.rotate(frame * 0.02);
  for (let i = 0; i < 12; i++) {
    ctx.save(); ctx.rotate((i / 12) * Math.PI * 2);
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1); ctx.lineTo(s * 0.05, -s * 0.5);
    ctx.lineTo(-s * 0.05, -s * 0.5);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = "#ff0000";
  ctx.shadowBlur = 30; ctx.shadowColor = "#ff0000";
  ctx.beginPath(); ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

// ─── Bullets ──────────────────────────────────────────────────────────────────
// Player bullets used to pay a live createLinearGradient + shadowBlur(12) each,
// every frame. The Wraith's twin homing stream fields roughly twice the bullets
// for twice as long, so each bullet is now a cached glow sprite (keyed by
// color/size/tier, supersampled 2× and rotated on blit).
const bulletSprites = new Map<string, HTMLCanvasElement>();

function getPlayerBulletSprite(color: string, size: number): HTMLCanvasElement {
  // Clamp: a non-finite size would create a NaN gradient (a throwing op in
  // real browsers) — fall back to a normal bullet instead of killing rAF.
  const s = Number.isFinite(size) ? Math.min(64, Math.max(0.5, size)) : 3;
  const key = `p|${renderPerformanceTier}|${color}|${s.toFixed(1)}`;
  const cached = bulletSprites.get(key);
  if (cached) return cached;
  const len = s * (renderPerformanceTier === 0 ? 2.2 : 3.5);
  const pad = renderPerformanceTier === 2 ? 16 : renderPerformanceTier === 1 ? 8 : 2;
  const w = s * 2 + pad * 2;
  const h = len * 2 + pad * 2;
  return cacheSprite(bulletSprites, key, w, h, sctx => {
    sctx.translate(w / 2, h / 2);
    if (renderPerformanceTier === 0) {
      sctx.fillStyle = color;
    } else {
      sctx.shadowBlur = renderPerformanceTier === 1 ? 4 : 12;
      sctx.shadowColor = color;
      const g = sctx.createLinearGradient(0, -len, 0, len * 0.5);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.3, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      sctx.fillStyle = g;
    }
    sctx.beginPath();
    sctx.ellipse(0, 0, s, len, 0, 0, Math.PI * 2);
    sctx.fill();
  });
}

function getEnemyBulletSprite(color: string, size: number): HTMLCanvasElement {
  const s = Number.isFinite(size) ? Math.min(64, Math.max(0.5, size)) : 3;
  const key = `e|${renderPerformanceTier}|${color}|${s.toFixed(1)}`;
  const cached = bulletSprites.get(key);
  if (cached) return cached;
  const pad = renderPerformanceTier === 2 ? 12 : renderPerformanceTier === 1 ? 6 : 2;
  const w = s * 2 + pad * 2;
  return cacheSprite(bulletSprites, key, w, w, sctx => {
    sctx.translate(w / 2, w / 2);
    if (renderPerformanceTier > 0) {
      sctx.shadowBlur = renderPerformanceTier === 1 ? 4 : 8;
      sctx.shadowColor = color;
    }
    sctx.fillStyle = color;
    sctx.beginPath();
    sctx.arc(0, 0, s, 0, Math.PI * 2);
    sctx.fill();
    sctx.fillStyle = "#fff";
    sctx.globalAlpha = 0.6;
    sctx.beginPath();
    sctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
    sctx.fill();
  });
}

export function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  ctx.save();
  ctx.translate(b.pos.x, b.pos.y);
  if (b.fromPlayer) {
    const angle = Math.atan2(b.vel.y, b.vel.x);
    ctx.rotate(angle + Math.PI / 2);
    const sprite = getPlayerBulletSprite(b.color, b.size);
    blitSprite(ctx, sprite, sprite.width / SPRITE_SCALE, sprite.height / SPRITE_SCALE);
  } else {
    const sprite = getEnemyBulletSprite(b.color, b.size);
    blitSprite(ctx, sprite, sprite.width / SPRITE_SCALE, sprite.height / SPRITE_SCALE);
  }
  ctx.restore();
}

// ─── Мифические сущности (векторная отрисовка, без частиц) ───────────────────
/** 🌌 Сингулярность «Пожиратель Звёзд»: тёмное ядро с вращающимися дугами. */
export function drawSingularity(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, frame: number, progress: number) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  const r = 26 + progress * 14;
  // Гравитационная воронка.
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 90);
  g.addColorStop(0, "rgba(0,0,0,0.9)");
  g.addColorStop(0.5, "rgba(88,28,135,0.35)");
  g.addColorStop(1, "rgba(88,28,135,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
  // Вращающиеся дуги захвата.
  ctx.strokeStyle = `rgba(196,132,252,${0.5 + progress * 0.4})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, r + i * 10, frame * 0.04 + i * 2.1, frame * 0.04 + i * 2.1 + 1.9);
    ctx.stroke();
  }
  // Ядро.
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** 👁 Разрывы Пустоты: пульсирующие кольца-порталы. */
export function drawVoidFractures(ctx: CanvasRenderingContext2D, fractures: { pos: { x: number; y: number }; life: number }[], frame: number) {
  for (const f of fractures) {
    const alpha = Math.min(1, f.life / 60);
    const pulse = 1 + Math.sin(frame * 0.2 + f.pos.x) * 0.15;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#e879f9";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(f.pos.x, f.pos.y, 16 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(232,121,249,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(f.pos.x, f.pos.y, 24 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/** ☀️/🔥 Свечение мификов на корпусе: ядро сверхновой и режим перегрузки. */
export function drawMythicAuras(ctx: CanvasRenderingContext2D, state: PlayerState, frame: number) {
  // Ядро сверхновой: эскалация свечения по заряду (25/50/75/100%).
  if (state.novaCore > 0) {
    const frac = state.novaCore / 100;
    const flicker = state.novaCore >= 100 ? 1 + Math.sin(frame * 0.5) * 0.25 : 1;
    const r = (20 + frac * 46) * flicker;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
    g.addColorStop(0, `rgba(253,224,71,${0.16 + frac * 0.34})`);
    g.addColorStop(1, "rgba(253,224,71,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  }
  // ABSOLUTE OVERDRIVE: оранжевое пламя реактора.
  if (state.overdriveTimer > 0) {
    const r = 60 + Math.sin(frame * 0.6) * 8;
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, r);
    g.addColorStop(0, "rgba(251,146,60,0.4)");
    g.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  }
}

// ─── Particles ────────────────────────────────────────────────────────────────
// Живой shadowBlur на каждую частицу (до 1000 за кадр) и был вторым источником
// фриза после массовых взрывов: свечение теперь запечено в спрайт по цвету и
// блитится одним drawImage с масштабом и альфой. Визуально — то же свечение.
const particleSprites = new Map<string, HTMLCanvasElement>();
const PARTICLE_SPRITE_SIZE = 32;

function getParticleSprite(color: string): HTMLCanvasElement {
  const cached = particleSprites.get(color);
  if (cached) return cached;
  return cacheSprite(particleSprites, color, PARTICLE_SPRITE_SIZE, PARTICLE_SPRITE_SIZE, sctx => {
    sctx.translate(PARTICLE_SPRITE_SIZE / 2, PARTICLE_SPRITE_SIZE / 2);
    const g = sctx.createRadialGradient(0, 0, 0, 0, 0, PARTICLE_SPRITE_SIZE / 2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = g;
    sctx.beginPath();
    sctx.arc(0, 0, PARTICLE_SPRITE_SIZE / 2, 0, Math.PI * 2);
    sctx.fill();
  });
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  if (disabledFeatures.has("particles")) return;
  const alpha = (p.life / p.maxLife);
  const r = p.size * alpha;
  ctx.globalAlpha = alpha;
  if (renderPerformanceTier > 0 && p.glow && !disabledFeatures.has("shadows")) {
    // Спрайт свечения: диаметр ≈ 4× радиуса частицы (эффект blur 8).
    const glow = r * 4;
    ctx.drawImage(getParticleSprite(p.color), p.pos.x - glow / 2, p.pos.y - glow / 2, glow, glow);
  }
  ctx.fillStyle = p.color;
  if (p.shape === "square") {
    ctx.fillRect(p.pos.x - r, p.pos.y - r, r * 2, r * 2);
  } else {
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── XP Orbs ──────────────────────────────────────────────────────────────────
// До 220 сфер рисовали живой градиент + shadowBlur КАЖДЫЙ кадр — на массовых
// убийствах это второй по тяжести рендер-путь. Одна запечённая сфера +
// масштабирование пульса: визуально то же самое, стоимость — один drawImage.
const xpOrbSprite: HTMLCanvasElement = (() => {
  const size = 28;
  const [canvas, sctx] = makeSprite(size, size);
  sctx.translate(size / 2, size / 2);
  const g = sctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.25, "#a78bfa");
  g.addColorStop(0.6, "#7c3aed");
  g.addColorStop(1, "rgba(124,58,237,0)");
  sctx.fillStyle = g;
  sctx.beginPath();
  sctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  sctx.fill();
  return canvas;
})();

export function drawXpOrb(ctx: CanvasRenderingContext2D, orb: XpOrb, frame: number) {
  const pulse = Math.sin(frame * 0.1 + orb.id * 0.5) * 2;
  const d = (10 + pulse * 2) * 1.6; // видимая сфера + запечённое свечение
  ctx.drawImage(xpOrbSprite, orb.pos.x - d / 2, orb.pos.y - d / 2, d, d);
}

// ─── Floating Text ────────────────────────────────────────────────────────────
export function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  if (disabledFeatures.has("floatingText")) return;
  const alpha = ft.life / ft.maxLife;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = ft.isCrit ? `bold ${ft.size}px monospace` : `bold ${ft.size}px monospace`;
  ctx.fillStyle = ft.color;
  // Обычные числа урона — без тени (их сотни за кадр), криты — с лёгкой.
  ctx.shadowBlur = !disabledFeatures.has("shadows") && renderPerformanceTier === 2 && ft.isCrit ? 6 : 0;
  ctx.shadowColor = ft.color;
  ctx.textAlign = "center";
  ctx.fillText(ft.text, ft.pos.x, ft.pos.y);
  ctx.restore();
}

// ─── Combat Powerups ──────────────────────────────────────────────────────────
export function drawPowerup(ctx: CanvasRenderingContext2D, p: PowerupItem, frame: number) {
  const pulse = Math.sin(frame * 0.15 + p.id) * 3;
  ctx.save();
  ctx.translate(p.pos.x, p.pos.y);

  // Outer glowing ring
  ctx.shadowBlur = renderPerformanceTier === 2 ? 6 : 0;
  ctx.shadowColor = "#38bdf8";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 16 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  // Background
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();

  // Icon
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const icon = p.type === "heal" ? "💊" :
               p.type === "rapid" ? "⚡" :
               p.type === "shield" ? "🛡️" :
               p.type === "magnet" ? "🧲" : "💣";
  ctx.fillText(icon, 0, 0);

  ctx.restore();
}

// ─── Mines ────────────────────────────────────────────────────────────────────
export function drawMine(ctx: CanvasRenderingContext2D, mine: Mine, frame: number) {
  const flicker = Math.sin(frame * 0.3) * 0.3 + 0.7;
  ctx.save();
  ctx.translate(mine.pos.x, mine.pos.y);
  ctx.strokeStyle = `rgba(251,191,36,${flicker})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(0, 0, mine.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = renderPerformanceTier === 2 ? 5 : 0;
  ctx.shadowColor = "#f59e0b";
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Lightning ────────────────────────────────────────────────────────────────
export function drawLightning(ctx: CanvasRenderingContext2D, l: Lightning) {
  const alpha = l.life / 8;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#fde047";
  ctx.shadowBlur = renderPerformanceTier === 2 ? 6 : 0;
  ctx.shadowColor = "#fde047";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const dx = l.to.x - l.from.x, dy = l.to.y - l.from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.floor(dist / 20);
  ctx.moveTo(l.from.x, l.from.y);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const nx = l.from.x + dx * t + (Math.random() - 0.5) * 20;
    const ny = l.from.y + dy * t + (Math.random() - 0.5) * 20;
    ctx.lineTo(nx, ny);
  }
  ctx.lineTo(l.to.x, l.to.y);
  ctx.stroke();
  ctx.restore();
}

// ─── Black Hole ───────────────────────────────────────────────────────────────
export function drawBlackHole(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, frame: number) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(frame * 0.05);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(168,85,247,${0.4 - i * 0.1})`;
    ctx.lineWidth = 4 - i;
    ctx.beginPath();
    ctx.ellipse(0, 0, 40 + i * 12, 12 + i * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#000";
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#7c3aed";
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Explosions ───────────────────────────────────────────────────────────────
export function drawExplosion(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, radius: number, progress: number) {
  const alpha = 1 - progress;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * progress);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.3, "#fbbf24");
  g.addColorStop(0.7, "#f97316");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius * progress, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
