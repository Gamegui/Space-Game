import type { PlayerState } from "./types";

export type ArchetypeId = "barrage" | "elements" | "fleet" | "survival" | "void";

export interface ArchetypeDef {
  id: ArchetypeId;
  name: string;
  shortName: string;
  icon: string;
  description: string;
  /** Upgrade ids that belong to this archetype (for highlighting and weighting) */
  upgrades: string[];
  /** Synergy ids that belong to this archetype */
  synergies: string[];
  /** Color for UI */
  color: string;
}

export const ARCHETYPES: ArchetypeDef[] = [
  {
    id: "barrage",
    name: "ЗАЛПЫ",
    shortName: "Залпы",
    icon: "⚡",
    description: "Максимум снарядов, скорострельность и урон. Прорыв через количество.",
    upgrades: [
      "double_shot","triple_shot","spread_shot","rapid_fire","damage_up","big_bullets",
      "bullet_speed","piercing","rear_shot","spiral_shot","wave_shot","mirror_shots",
      "laser_side","bouncy_bullets","bullet_hail","plasma_cannon","omnidirectional",
      "power_surge","overdrive_reactor","reload_speed","sniper_protocol","empowered_crit",
      "megaton","overcharge","phase_discharge"
    ],
    synergies: ["chain_reaction","overdrive","railgun_protocol"],
    color: "#fbbf24",
  },
  {
    id: "elements",
    name: "СТИХИИ",
    shortName: "Стихии",
    icon: "🌊",
    description: "Огонь, лёд, яд и молнии. Контроль поля и цепные реакции.",
    upgrades: [
      "burn","freeze","poison","lightning","chain_lightning","solar_flare","ice_storm",
      "phase_ammo","singularity_rounds","crit","empowered_crit","megaton"
    ],
    synergies: ["storm_circuit","chain_reaction"],
    color: "#38bdf8",
  },
  {
    id: "fleet",
    name: "ФЛОТ",
    shortName: "Флот",
    icon: "🛰️",
    description: "Спутники и дроны делают работу за вас. Автономный флот.",
    upgrades: [
      "satellite_1","satellite_speed","satellite_damage","drone_1","drone_swarm",
      "drone_link","auto_turret","orbital_strike","doom_satellite","swarm_missiles",
      "collector_core"
    ],
    synergies: ["autonomous_fleet"],
    color: "#a78bfa",
  },
  {
    id: "survival",
    name: "ВЫЖИВАНИЕ",
    shortName: "Выживание",
    icon: "🛡️",
    description: "Щит, регенерация и мобильность. Живите дольше, бейте стабильнее.",
    upgrades: [
      "shield","shield_regen","max_hp","regen","life_steal","speed_up","turbo_engine",
      "ghost","aura","adaptive_armor","guardian_protocol","fortress","nano_shield",
      "living_shield","shield_bash","death_nova","magnet","collector_core"
    ],
    synergies: [],
    color: "#4ade80",
  },
  {
    id: "void",
    name: "БЕЗДНА",
    shortName: "Бездна",
    icon: "🌑",
    description: "Фаза, пробитие и сингулярности. Контроль реальности.",
    upgrades: [
      "ghost","quantum_tunnel","singularity_rounds","void_arsenal","phase_discharge",
      "phase_ammo","black_hole","vortex","chain_detonation","living_shield"
    ],
    synergies: ["void_engine","void_hunger","ghost_arsenal","phase_reaper"],
    color: "#e879f9",
  },
];

export function getArchetype(id: ArchetypeId): ArchetypeDef | undefined {
  return ARCHETYPES.find(a => a.id === id);
}

export function archetypeForUpgrade(upgradeId: string): ArchetypeId[] {
  return ARCHETYPES.filter(a => a.upgrades.includes(upgradeId)).map(a => a.id);
}

/** Returns progress to closest synergy for a given archetype and player state */
export function synergyProgressForArchetype(_player: PlayerState, archetypeId: ArchetypeId): { synergyId: string; name: string; owned: number; total: number; missingId?: string } | null {
  const arch = getArchetype(archetypeId);
  if (!arch) return null;
  // Check all synergies, but prioritize those listed in archetype
  // const allSynergies = arch.synergies.length > 0 ? arch.synergies : ARCHETYPES.flatMap(a => a.synergies);
  // We'll check actual SYNERGIES list via dynamic import to avoid circular? We'll import lazily in caller, but here we need to access via param.
  // This function will be used with SYNERGIES passed separately; for simplicity we just compute based on owned upgrades vs arch.upgrades
  // The real implementation is in App.tsx using SYNERGIES constant.
  return null;
}

export function rollArchetypeChoices(count = 3, rng = Math.random): ArchetypeDef[] {
  const shuffled = [...ARCHETYPES].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
