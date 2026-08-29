import type { ShipClassId } from "./types";

export interface TelemetryRun {
  version: string;
  timestamp: number;
  shipClass: ShipClassId;
  route: string;
  routeEffect: string;
  wave: number;
  victory: boolean;
  durationSec: number;
  score: number;
  kills: number;
  level: number;
  chosenCards: { id: string; level: number; rarity: string }[];
  synergies: string[];
  evolutions: string[];
  damageDealt: number;
  damageBySource: Record<string, number>;
  incomingDamage: number;
  incomingByType: Record<string, number>;
  fps: { p50: number; p1: number; samples: number };
  maxEntities: { enemies: number; bullets: number; particles: number; xpOrbs: number };
  purchases: string[];
  revived: boolean;
  reason: "death" | "victory" | "quit";
  adaptiveScale: number;
  powerRating: number;
  buildArchetype?: string;
  deathCause?: string;
}

const STORAGE_KEY = "telemetry_runs_v1";
const MAX_STORED = 100;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadTelemetryRuns(): TelemetryRun[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  const arr = safeParse<TelemetryRun[]>(raw, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveTelemetryRun(run: TelemetryRun): void {
  if (typeof localStorage === "undefined") return;
  try {
    const runs = loadTelemetryRuns();
    runs.unshift(run);
    if (runs.length > MAX_STORED) runs.length = MAX_STORED;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    // storage may be blocked
  }
}

export function exportTelemetryJson(): string {
  const runs = loadTelemetryRuns().slice(0, 20);
  return JSON.stringify(runs, null, 2);
}

export function clearTelemetry(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// --- Balance analytics ---
export interface BalanceStats {
  totalRuns: number;
  winRate: number;
  winRateByShip: Record<string, { wins: number; total: number; rate: number }>;
  winRateByRoute: Record<string, { wins: number; total: number; rate: number }>;
  pickRateByUpgrade: Record<string, { picks: number; totalRuns: number; rate: number; avgDeathWave: number; totalWaves: number }>;
  avgWave: number;
  avgDuration: number;
}

export function computeBalanceStats(runs: TelemetryRun[]): BalanceStats {
  const totalRuns = runs.length;
  const wins = runs.filter(r => r.victory).length;
  const winRate = totalRuns > 0 ? wins / totalRuns : 0;
  const winRateByShip: Record<string, { wins: number; total: number; rate: number }> = {};
  const winRateByRoute: Record<string, { wins: number; total: number; rate: number }> = {};
  const pickRateByUpgrade: Record<string, { picks: number; totalRuns: number; rate: number; avgDeathWave: number; totalWaves: number }> = {};
  let totalWaves = 0;
  let totalDuration = 0;

  for (const run of runs) {
    totalWaves += run.wave;
    totalDuration += run.durationSec;
    // ship
    if (!winRateByShip[run.shipClass]) winRateByShip[run.shipClass] = { wins: 0, total: 0, rate: 0 };
    winRateByShip[run.shipClass].total++;
    if (run.victory) winRateByShip[run.shipClass].wins++;
    // route
    const routeKey = run.route || "none";
    if (!winRateByRoute[routeKey]) winRateByRoute[routeKey] = { wins: 0, total: 0, rate: 0 };
    winRateByRoute[routeKey].total++;
    if (run.victory) winRateByRoute[routeKey].wins++;
    // upgrades
    const seen = new Set<string>();
    for (const card of run.chosenCards) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      if (!pickRateByUpgrade[card.id]) pickRateByUpgrade[card.id] = { picks: 0, totalRuns: 0, rate: 0, avgDeathWave: 0, totalWaves: 0 };
      pickRateByUpgrade[card.id].picks++;
      pickRateByUpgrade[card.id].totalWaves += run.wave;
    }
  }

  for (const k of Object.keys(winRateByShip)) {
    const s = winRateByShip[k];
    s.rate = s.total > 0 ? s.wins / s.total : 0;
  }
  for (const k of Object.keys(winRateByRoute)) {
    const s = winRateByRoute[k];
    s.rate = s.total > 0 ? s.wins / s.total : 0;
  }
  for (const k of Object.keys(pickRateByUpgrade)) {
    const s = pickRateByUpgrade[k];
    s.totalRuns = totalRuns;
    s.rate = totalRuns > 0 ? s.picks / totalRuns : 0;
    s.avgDeathWave = s.picks > 0 ? s.totalWaves / s.picks : 0;
  }

  return {
    totalRuns,
    winRate,
    winRateByShip,
    winRateByRoute,
    pickRateByUpgrade,
    avgWave: totalRuns > 0 ? totalWaves / totalRuns : 0,
    avgDuration: totalRuns > 0 ? totalDuration / totalRuns : 0,
  };
}

// --- FPS tracker ---
export class FpsTracker {
  private samples: number[] = [];
  private maxSamples = 300;
  addFrameTime(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }
  getStats(): { p50: number; p1: number; samples: number } {
    if (this.samples.length === 0) return { p50: 0, p1: 0, samples: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p1Index = Math.floor(sorted.length * 0.99);
    const p1 = sorted[Math.min(p1Index, sorted.length - 1)];
    const fpsP50 = p50 > 0 ? 1000 / p50 : 0;
    const fpsP1 = p1 > 0 ? 1000 / p1 : 0;
    return { p50: Math.round(fpsP50), p1: Math.round(fpsP1), samples: this.samples.length };
  }
  reset(): void {
    this.samples = [];
  }
}
