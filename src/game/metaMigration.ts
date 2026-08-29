/**
 * P1.6 versioned migrations for meta_v1, backup, export/import, validation
 */

export type MetaVersion = 1 | 2 | 3;
export const CURRENT_META_VERSION: MetaVersion = 3;

export interface MetaV1 {
  version?: number;
  xp: number;
  level: number;
  unlockedShips: string[];
  upgrades: Record<string, number>;
  missions: any;
}

export interface MetaV2 extends Omit<MetaV1, "version"> {
  version: 2;
  cosmetics?: string[];
  stats?: { totalKills: number; totalDeaths: number };
}

export interface MetaV3 extends Omit<MetaV2, "version"> {
  version: 3;
  buildArchetypePrefs?: Record<string, number>;
  telemetryOptIn?: boolean;
}

export type AnyMeta = MetaV1 | MetaV2 | MetaV3;

const META_KEY = "meta_v1";
const BACKUP_KEY = "meta_v1_backup";
const BACKUP_TIMESTAMP_KEY = "meta_v1_backup_ts";

export function validateMeta(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    errors.push("not an object");
    return { valid: false, errors };
  }
  if (typeof data.xp !== "number" || data.xp < 0) errors.push("invalid xp");
  if (typeof data.level !== "number" || data.level < 1) errors.push("invalid level");
  if (!Array.isArray(data.unlockedShips)) errors.push("unlockedShips not array");
  if (!data.upgrades || typeof data.upgrades !== "object") errors.push("upgrades invalid");
  return { valid: errors.length === 0, errors };
}

export function migrateMeta(raw: any): MetaV3 {
  let data = raw;
  if (!data) {
    return { version: 3, xp: 0, level: 1, unlockedShips: ["interceptor"], upgrades: {}, missions: {} };
  }
  // ensure version
  if (!data.version) {
    data.version = 1;
  }
  // v1 -> v2
  if (data.version === 1) {
    data = {
      ...data,
      version: 2,
      cosmetics: [],
      stats: { totalKills: 0, totalDeaths: 0 },
    };
  }
  // v2 -> v3
  if (data.version === 2) {
    data = {
      ...data,
      version: 3,
      buildArchetypePrefs: {},
      telemetryOptIn: true,
    };
  }
  // ensure fields for v3
  if (!data.buildArchetypePrefs) data.buildArchetypePrefs = {};
  if (data.telemetryOptIn === undefined) data.telemetryOptIn = true;
  if (!data.cosmetics) data.cosmetics = [];
  if (!data.stats) data.stats = { totalKills: 0, totalDeaths: 0 };
  return data as MetaV3;
}

export function loadMeta(): MetaV3 {
  if (typeof localStorage === "undefined") return migrateMeta(null);
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return migrateMeta(null);
    const parsed = JSON.parse(raw);
    const validation = validateMeta(parsed);
    if (!validation.valid) {
      // try backup
      const backupRaw = localStorage.getItem(BACKUP_KEY);
      if (backupRaw) {
        const backupParsed = JSON.parse(backupRaw);
        const backupValid = validateMeta(backupParsed);
        if (backupValid.valid) {
          return migrateMeta(backupParsed);
        }
      }
      // invalid and no backup -> reset with backup of invalid
      localStorage.setItem(BACKUP_KEY, raw);
      localStorage.setItem(BACKUP_TIMESTAMP_KEY, Date.now().toString());
      return migrateMeta(null);
    }
    return migrateMeta(parsed);
  } catch {
    return migrateMeta(null);
  }
}

export function saveMeta(meta: AnyMeta): void {
  if (typeof localStorage === "undefined") return;
  try {
    // backup previous
    const prev = localStorage.getItem(META_KEY);
    if (prev) {
      localStorage.setItem(BACKUP_KEY, prev);
      localStorage.setItem(BACKUP_TIMESTAMP_KEY, Date.now().toString());
    }
    const toSave = { ...meta, version: CURRENT_META_VERSION };
    localStorage.setItem(META_KEY, JSON.stringify(toSave));
  } catch {}
}

export function exportMeta(): string {
  if (typeof localStorage === "undefined") return "{}";
  return localStorage.getItem(META_KEY) ?? "{}";
}

export function importMeta(json: string): { success: boolean; error?: string; meta?: MetaV3 } {
  try {
    const parsed = JSON.parse(json);
    const validation = validateMeta(parsed);
    if (!validation.valid) return { success: false, error: validation.errors.join(", ") };
    const migrated = migrateMeta(parsed);
    saveMeta(migrated);
    return { success: true, meta: migrated };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "parse error" };
  }
}

export function getBackupInfo(): { exists: boolean; timestamp?: number } {
  if (typeof localStorage === "undefined") return { exists: false };
  const b = localStorage.getItem(BACKUP_KEY);
  if (!b) return { exists: false };
  const tsRaw = localStorage.getItem(BACKUP_TIMESTAMP_KEY);
  return { exists: true, timestamp: tsRaw ? parseInt(tsRaw, 10) : undefined };
}

export function restoreBackup(): MetaV3 | null {
  if (typeof localStorage === "undefined") return null;
  const backup = localStorage.getItem(BACKUP_KEY);
  if (!backup) return null;
  try {
    const parsed = JSON.parse(backup);
    const migrated = migrateMeta(parsed);
    saveMeta(migrated);
    return migrated;
  } catch {
    return null;
  }
}
