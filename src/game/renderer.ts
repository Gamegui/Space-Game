import type {
  Bullet, Enemy, Particle, Star, PlayerState, XpOrb, Mine,
  Lightning, FloatingText, PowerupItem
} from "./types";
import { getEnemyColors, getEnemySize } from "./enemies";

export const W = 960;
export const H = 720;

let renderPerformanceTier: 0 | 1 | 2 = 2;
export function setRenderPerformanceTier(tier: 0 | 1 | 2) {
  renderPerformanceTier = tier;
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
  for (const s of stars) {
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
export function drawBackground(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.fillStyle = "#03050d";
  ctx.fillRect(0, 0, W, H);

  // Deep Space Nebula Glow
  const t = frame * 0.002;
  const colors = [
    ["rgba(60,20,100,0.14)", W * 0.3, H * 0.4, 360],
    ["rgba(10,40,120,0.12)",  W * 0.7, H * 0.6, 300],
    ["rgba(100,10,60,0.10)", W * 0.5, H * 0.2, 260],
  ] as const;
  for (const [color, cx, cy, r] of colors) {
    const grd = ctx.createRadialGradient(cx + Math.sin(t) * 20, cy, 0, cx, cy, r);
    grd.addColorStop(0, color);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────
// The Wraith's signature silhouette: a slim void dagger with membrane wings
// and a pulsing core. Distinct from the shared fighter hull of the other ships.
function drawWraithBody(ctx: CanvasRenderingContext2D, frame: number, phased: boolean) {
  const main = phased ? "#f0abfc" : "#e879f9";

  // Membrane wings
  ctx.shadowBlur = phased ? 16 : 10;
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
  ctx.shadowBlur = phased ? 18 : 12;
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
  ctx.fill();
  ctx.stroke();

  // Cockpit
  ctx.shadowBlur = 8;
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.ellipse(0, -11, 4, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing void core
  const coreR = 3 + Math.sin(frame * 0.3) * 1.3;
  ctx.shadowBlur = 12;
  ctx.fillStyle = phased ? "#ffffff" : "#f0abfc";
  ctx.beginPath();
  ctx.arc(0, 6, Math.max(1.5, coreR), 0, Math.PI * 2);
  ctx.fill();
}

// Arena-wide void tint while the Wraith's phase window is open.
export function drawVoidPhaseVignette(ctx: CanvasRenderingContext2D, frame: number, intensity: number) {
  if (renderPerformanceTier === 0) return; // per-frame gradient: too dear for low-end
  const a = (0.07 + 0.05 * Math.sin(frame * 0.35)) * Math.min(1, intensity + 0.45);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
  g.addColorStop(0, "rgba(168,85,247,0)");
  g.addColorStop(1, `rgba(192,38,211,${a.toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function drawPlayer(ctx: CanvasRenderingContext2D, state: PlayerState, frame: number) {
  const { pos, invincTimer, shield, satellites, drones, aura, shipClass, rapidBoostTimer } = state;

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
      eg.addColorStop(0, "rgba(232,121,249,0.5)");
      eg.addColorStop(1, "rgba(232,121,249,0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowBlur = renderPerformanceTier === 1 ? 10 : 14;
      ctx.shadowColor = "#e879f9";
      drawWraithBody(ctx, frame, false);
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
  if (shield && shield.active && shield.hp > 0) {
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
  const trailH = 22 + Math.sin(frame * 0.3) * 8;
  ctx.beginPath();
  ctx.moveTo(-8, 14);
  ctx.lineTo(0, 14 + trailH);
  ctx.lineTo(8, 14);
  ctx.closePath();
  ctx.fill();

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
    ctx.globalAlpha = phased ? 1 : 0.82 + 0.18 * Math.sin(frame * 0.22);
    if (phased && renderPerformanceTier === 2) {
      // Double-exposure ghosting while phased (high tier only).
      for (const gx of [3, -3]) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.translate(gx, -2);
        drawWraithBody(ctx, frame, true);
        ctx.restore();
      }
    }
    if (phased && renderPerformanceTier === 1) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.translate(3, -2);
      drawWraithBody(ctx, frame, true);
      ctx.restore();
    }
    drawWraithBody(ctx, frame, phased);
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

  ctx.shadowBlur = e.isBoss ? 25 : (e.isElite ? 18 : 12);
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
export function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
  ctx.save();
  ctx.translate(b.pos.x, b.pos.y);
  ctx.shadowBlur = renderPerformanceTier === 0 ? 0 : renderPerformanceTier === 1 ? 4 : (b.fromPlayer ? 12 : 8);
  ctx.shadowColor = b.color;

  if (b.fromPlayer) {
    const len = b.size * (renderPerformanceTier === 0 ? 2.2 : 3.5);
    const angle = Math.atan2(b.vel.y, b.vel.x);
    ctx.rotate(angle + Math.PI / 2);
    if (renderPerformanceTier === 0) {
      ctx.fillStyle = b.color;
    } else {
      const g = ctx.createLinearGradient(0, -len, 0, len * 0.5);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.3, b.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, b.size, len, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(0, 0, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, b.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ─── Particles ────────────────────────────────────────────────────────────────
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = (p.life / p.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (p.glow && renderPerformanceTier > 0) { ctx.shadowBlur = renderPerformanceTier === 1 ? 3 : 8; ctx.shadowColor = p.color; }
  ctx.fillStyle = p.color;
  ctx.beginPath();
  if (p.shape === "square") {
    const s = p.size * alpha;
    ctx.fillRect(p.pos.x - s / 2, p.pos.y - s / 2, s, s);
  } else {
    ctx.arc(p.pos.x, p.pos.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── XP Orbs ──────────────────────────────────────────────────────────────────
export function drawXpOrb(ctx: CanvasRenderingContext2D, orb: XpOrb, frame: number) {
  const pulse = Math.sin(frame * 0.1 + orb.id * 0.5) * 2;
  ctx.save();
  ctx.translate(orb.pos.x, orb.pos.y);
  ctx.shadowBlur = renderPerformanceTier === 0 ? 0 : renderPerformanceTier === 1 ? 3 : 8;
  ctx.shadowColor = "#a78bfa";
  if (renderPerformanceTier === 0) {
    ctx.fillStyle = "#a78bfa";
  } else {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 6 + pulse);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.4, "#a78bfa");
    g.addColorStop(1, "#7c3aed");
    ctx.fillStyle = g;
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Floating Text ────────────────────────────────────────────────────────────
export function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const alpha = ft.life / ft.maxLife;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = ft.isCrit ? `bold ${ft.size}px monospace` : `bold ${ft.size}px monospace`;
  ctx.fillStyle = ft.color;
  ctx.shadowBlur = renderPerformanceTier === 0 ? 0 : ft.isCrit ? 10 : 4;
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
  ctx.shadowBlur = 12;
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
  ctx.shadowBlur = 10;
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
  ctx.shadowBlur = 12;
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
  ctx.shadowBlur = 30;
  ctx.shadowColor = "#f97316";
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
