/**
 * P1.4 Dynamic quality by rolling p1/p50 5s
 * Downgrade order: shadows/blur → particles → floating text → stars
 * Slow upgrade when stable.
 */

export type QualityLevel = 0 | 1 | 2; // 0 low, 1 medium, 2 high
export type QualityFeature = "shadows" | "particles" | "floatingText" | "stars";

export interface QualityState {
  tier: QualityLevel;
  disabled: Set<QualityFeature>;
  reason: string;
}

const ROLLING_WINDOW_MS = 5000;
const TARGET_FPS = 55;
const LOW_FPS_THRESHOLD = 30;
const HIGH_FPS_THRESHOLD = 58;

export class QualityController {
  private frameTimes: number[] = []; // ms
  private timestamps: number[] = [];
  private current: QualityState = {
    tier: 2,
    disabled: new Set(),
    reason: "init high",
  };
  private stableHighFrames = 0;
  private downgradeCooldown = 0;

  constructor(initialTier: QualityLevel = 2) {
    this.current.tier = initialTier;
  }

  addFrameTime(frameTimeMs: number, nowMs: number): void {
    this.frameTimes.push(frameTimeMs);
    this.timestamps.push(nowMs);
    // prune older than 5s
    while (this.timestamps.length > 0 && nowMs - this.timestamps[0] > ROLLING_WINDOW_MS) {
      this.timestamps.shift();
      this.frameTimes.shift();
    }
    // keep max 300 samples
    if (this.frameTimes.length > 300) {
      this.frameTimes.shift();
      this.timestamps.shift();
    }
  }

  getRollingStats(): { p50: number; p1: number; avg: number; fpsP50: number; fpsP1: number; count: number } {
    if (this.frameTimes.length === 0) return { p50: 0, p1: 0, avg: 0, fpsP50: 0, fpsP1: 0, count: 0 };
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p1Index = Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1);
    const p1 = sorted[p1Index];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return {
      p50,
      p1,
      avg,
      fpsP50: p50 > 0 ? 1000 / p50 : 0,
      fpsP1: p1 > 0 ? 1000 / p1 : 0,
      count: sorted.length,
    };
  }

  update(_nowMs: number): QualityState {
    if (this.downgradeCooldown > 0) {
      this.downgradeCooldown--;
      return this.current;
    }
    const stats = this.getRollingStats();
    if (stats.count < 30) return this.current; // not enough data

    const fpsP1 = stats.fpsP1;
    const fpsP50 = stats.fpsP50;

    // Downgrade if p1 < 30 or p50 < 45
    if (fpsP1 < LOW_FPS_THRESHOLD || fpsP50 < 45) {
      this.downgrade();
      this.downgradeCooldown = 180; // 3s cooldown
      this.stableHighFrames = 0;
      return this.current;
    }

    // Upgrade slowly if stable high FPS for 10 seconds (600 frames at 60fps)
    if (fpsP1 > HIGH_FPS_THRESHOLD && fpsP50 > TARGET_FPS) {
      this.stableHighFrames++;
      if (this.stableHighFrames > 600) {
        this.upgrade();
        this.stableHighFrames = 0;
        this.downgradeCooldown = 300;
      }
    } else {
      this.stableHighFrames = Math.max(0, this.stableHighFrames - 1);
    }

    return this.current;
  }

  private downgrade(): void {
    const order: QualityFeature[] = ["shadows", "particles", "floatingText", "stars"];
    for (const feat of order) {
      if (!this.current.disabled.has(feat)) {
        this.current.disabled.add(feat);
        this.current.reason = `downgrade ${feat} due to low fps`;
        // also lower tier when shadows disabled
        if (feat === "shadows" && this.current.tier > 0) {
          this.current.tier = (this.current.tier - 1) as QualityLevel;
        }
        if (feat === "particles" && this.current.tier > 0) {
          this.current.tier = Math.min(this.current.tier, 1) as QualityLevel;
        }
        if (feat === "stars" && this.current.tier > 0) {
          this.current.tier = 0;
        }
        return;
      }
    }
  }

  private upgrade(): void {
    const order: QualityFeature[] = ["stars", "floatingText", "particles", "shadows"];
    for (const feat of order) {
      if (this.current.disabled.has(feat)) {
        this.current.disabled.delete(feat);
        this.current.reason = `upgrade ${feat} stable`;
        // raise tier gradually
        if (feat === "shadows" && this.current.tier < 2) {
          this.current.tier = (this.current.tier + 1) as QualityLevel;
        }
        if (feat === "particles" && this.current.tier < 1) {
          this.current.tier = 1;
        }
        if (this.current.disabled.size === 0) {
          this.current.tier = 2;
        }
        return;
      }
    }
    if (this.current.tier < 2) {
      this.current.tier = (this.current.tier + 1) as QualityLevel;
      this.current.reason = "upgrade tier stable";
    }
  }

  getState(): QualityState {
    return { ...this.current, disabled: new Set(this.current.disabled) };
  }

  setTier(tier: QualityLevel): void {
    this.current.tier = tier;
    if (tier === 2) this.current.disabled.clear();
    else if (tier === 1) {
      this.current.disabled.delete("shadows");
      // keep particles but disable heavy
    } else {
      this.current.disabled.add("shadows");
    }
  }

  isDisabled(feat: QualityFeature): boolean {
    return this.current.disabled.has(feat);
  }
}
