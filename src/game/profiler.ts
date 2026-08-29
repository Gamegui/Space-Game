/**
 * P1.5 profiling hot path update/collision/render, entity budgets, spatial grid, culling, batch rendering
 * Lightweight profiler to measure update/collision/render times with <0.2ms overhead target.
 */

export interface ProfileSample {
  update: number;
  collision: number;
  render: number;
  total: number;
  entities: { enemies: number; bullets: number; particles: number };
  timestamp: number;
}

export class GameProfiler {
  private samples: ProfileSample[] = [];
  private maxSamples = 120;
  private enabled = false;

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.samples = [];
  }

  begin(): number {
    if (!this.enabled) return 0;
    return performance.now();
  }

  end(start: number, label: keyof ProfileSample, sample: Partial<ProfileSample>): void {
    if (!this.enabled) return;
    const dur = performance.now() - start;
    // store in temp? We'll accumulate per frame via addFrame
    (sample as any)[label] = dur;
  }

  addFrame(sample: ProfileSample): void {
    if (!this.enabled) return;
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }

  getStats(): { avgUpdate: number; avgCollision: number; avgRender: number; avgTotal: number; p95Total: number } | null {
    if (this.samples.length === 0) return null;
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const updates = this.samples.map(s => s.update);
    const collisions = this.samples.map(s => s.collision);
    const renders = this.samples.map(s => s.render);
    const totals = this.samples.map(s => s.total).sort((a, b) => a - b);
    const p95Index = Math.floor(totals.length * 0.95);
    return {
      avgUpdate: avg(updates),
      avgCollision: avg(collisions),
      avgRender: avg(renders),
      avgTotal: avg(totals),
      p95Total: totals[Math.min(p95Index, totals.length - 1)],
    };
  }

  getSamples(): ProfileSample[] {
    return [...this.samples];
  }
}

export const ENTITY_BUDGETS = {
  enemies: 80,
  playerBullets: 450,
  enemyBullets: 260,
  particles: 1000,
  xpOrbs: 220,
  floatingTexts: 100,
} as const;
