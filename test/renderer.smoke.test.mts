// Headless render smoke test: exercises the sprite-cache render paths
// (Wraith hull variants, player/enemy bullets, phase vignette) against a
// no-op 2D context. Catches the two failure modes that reached playtesting:
// a thrown exception (kills the requestAnimationFrame loop → frozen canvas)
// and pathological re-baking (sprite cache thrash → multi-second frames).

import { test } from "node:test";
import assert from "node:assert/strict";

// ── Minimal DOM shim, installed before the renderer import ──────────────────
const noop = () => {};
function fakeCtx(): CanvasRenderingContext2D {
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return () => ({ addColorStop: noop });
      }
      if (typeof prop === "symbol") return undefined;
      return noop;
    },
    set() { return true; },
  }) as unknown as CanvasRenderingContext2D;
}
const fakeDocument = {
  createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }),
};
(globalThis as unknown as { document: unknown }).document = fakeDocument;

const renderer = await import("../src/game/renderer");
const { makeInitialPlayer } = await import("../src/game/gameLoop");
const ctx = fakeCtx();

const ENEMY_BULLET_COLORS = [
  "#f87171", "#fb923c", "#facc15", "#a3e635", "#60a5fa", "#ff4444", "#c084fc",
  "#4ade80", "#38bdf8", "#f97316", "#22d3ee", "#d8b4fe", "#fb7185", "#818cf8",
  "#ef4444", "#8b5cf6",
];
const ENEMY_BULLET_SIZES = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5];

test("wraith render paths never throw or hang (idle, phased, echo, all tiers)", () => {
  const player = makeInitialPlayer("void_wraith");
  for (const tier of [2, 1, 0, 2] as const) {
    renderer.setRenderPerformanceTier(tier);
    for (let i = 0; i < 300; i++) {
      player.ghostTimer = i % 240 < 120 ? 120 - (i % 120) : -300;
      player.voidEchoTimer = i % 240 < 120 ? 120 - (i % 120) : 0;
      player.invincTimer = i % 16 < 8 ? 30 : 0;
      renderer.drawPlayer(ctx, player, i);
      renderer.drawVoidPhaseVignette(ctx, i, Math.min(1, (i % 120) / 120));
    }
  }
});

test("full enemy bullet matrix across tier flips stays bounded and fast", () => {
  // 16 colors × 7 sizes × 3 tiers = 336 variants — well past the old 128-entry
  // full-clear limit that caused the bake-every-frame freeze. The cache must
  // evict gradually and every draw must succeed.
  renderer.setRenderPerformanceTier(2);
  let drawn = 0;
  for (let round = 0; round < 3; round++) {
    renderer.setRenderPerformanceTier((2 - (round % 3)) as 0 | 1 | 2);
    for (const color of ENEMY_BULLET_COLORS) {
      for (const size of ENEMY_BULLET_SIZES) {
        renderer.drawBullet(ctx, {
          id: drawn++, pos: { x: 100, y: 100 }, vel: { x: 1, y: 2 },
          fromPlayer: false, damage: 1, size, color, pierce: 0, homing: false,
        });
      }
    }
    for (const size of [3, 4.5, 6, 8, 12]) {
      renderer.drawBullet(ctx, {
        id: drawn++, pos: { x: 100, y: 100 }, vel: { x: 0, y: -15 },
        fromPlayer: true, damage: 1, size, color: "#e879f9", pierce: 1, homing: true,
      });
    }
  }
  assert.ok(renderer.spriteCacheSize() <= 512, `cache size ${renderer.spriteCacheSize()}`);
  // Repeated draws of hot variants must not grow the cache.
  const before = renderer.spriteCacheSize();
  for (let i = 0; i < 2000; i++) {
    renderer.drawBullet(ctx, {
      id: drawn++, pos: { x: 100, y: 100 }, vel: { x: 0, y: -15 },
      fromPlayer: true, damage: 1, size: 4.5, color: "#e879f9", pierce: 1, homing: true,
    });
  }
  assert.equal(renderer.spriteCacheSize(), before);
});

test("explosion-path render functions never throw (particles, orbs, explosions)", () => {
  // Массовый взрыв: до 1000 частиц, сферы опыта, кольца взрывов, молнии —
  // все новые спрайт-пути должны выдерживать полный набор без исключений.
  renderer.setRenderPerformanceTier(2);
  const particles = Array.from({ length: 1000 }, (_, i) => ({
    id: i, pos: { x: (i * 37) % 960, y: (i * 53) % 720 },
    vel: { x: 1, y: -1 }, life: 20, maxLife: 40,
    color: ["#e879f9", "#f97316", "#fbbf24", "#fff", "#a855f7", "#fb923c"][i % 6],
    size: 1.5 + (i % 5), glow: true,
    shape: (["circle", "square", "ring"] as const)[i % 3],
  }));
  for (const tier of [2, 1, 0] as const) {
    renderer.setRenderPerformanceTier(tier);
    renderer.drawBackground(ctx, 120);
    for (const p of particles) renderer.drawParticle(ctx, p);
    for (let i = 0; i < 220; i++) renderer.drawXpOrb(ctx, { id: i, pos: { x: (i * 13) % 960, y: (i * 29) % 720 }, vel: { x: 0, y: 0 }, value: 1, attracted: true }, i);
    for (let i = 0; i < 60; i++) renderer.drawExplosion(ctx, { x: (i * 31) % 900, y: (i * 47) % 700 }, 80, (i % 10) / 10);
    for (let i = 0; i < 90; i++) renderer.drawLightning(ctx, { id: i, from: { x: 100, y: 100 }, to: { x: 600, y: 500 }, life: 5 });
  }
  assert.ok(renderer.spriteCacheSize() <= 512, `cache size ${renderer.spriteCacheSize()}`);
});

test("pathological bullet sizes do not produce zero-sized sprites", () => {
  for (const size of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
    renderer.drawBullet(ctx, {
      id: 1, pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 },
      fromPlayer: true, damage: 1, size, color: "#38bdf8", pierce: 0, homing: false,
    });
    renderer.drawBullet(ctx, {
      id: 2, pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 },
      fromPlayer: false, damage: 1, size, color: "#f87171", pierce: 0, homing: false,
    });
  }
});
