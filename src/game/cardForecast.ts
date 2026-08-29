import type { PlayerState } from "./types";
import type { UpgradeDef } from "./types";

import { SYNERGIES } from "./synergies";

export interface Forecast {
  singleTarget: number; // 0-5
  clear: number; // 0-5
  survivability: number; // 0-5
  control: number; // 0-5
  downsides: string[];
  conflicts: string[];
  activation: string;
}

/**
 * Heuristic forecast for each upgrade based on player state.
 * Provides single-target, clear, survivability, control ratings.
 */
export function forecastUpgrade(upg: UpgradeDef, player: PlayerState): Forecast {
  const id = upg.id;
  let single = 2, clear = 2, surv = 0, ctrl = 0;
  const downsides: string[] = [];
  const conflicts: string[] = [];
  let activation = "Постоянно";

  // categorize by id patterns
  if (["damage_up","crit","empowered_crit","sniper_protocol","piercing","bullet_speed","sniper","phase_ammo","megaton","overcharge"].includes(id)) {
    single = 5; clear = 2;
  }
  if (["double_shot","triple_shot","spread_shot","rapid_fire","spiral_shot","wave_shot","bullet_hail","plasma_cannon","omnidirectional","mirror_shots","rear_shot","laser_side","bouncy_bullets","reload_speed","power_surge","overdrive_reactor","bullet_speed"].includes(id)) {
    single = 4; clear = 4;
  }
  if (["explosive","multi_explosion","chain_detonation","solar_flare","ice_storm","chain_lightning","burn","poison","lightning","black_hole","vortex","orbital_strike","swarm_missiles","doom_satellite","death_nova","shield_bash"].includes(id)) {
    clear = 5; single = 3;
  }
  if (["shield","shield_regen","max_hp","regen","life_steal","adaptive_armor","guardian_protocol","fortress","nano_shield","living_shield","ghost","aura","speed_up","turbo_engine"].includes(id)) {
    surv = 5; single = 1; clear = 1;
  }
  if (["freeze","burn","poison","lightning","chain_lightning","ghost","time_slow","black_hole","vortex","phase_discharge","quantum_tunnel","singularity_rounds","void_arsenal"].includes(id)) {
    ctrl = 4; if (id === "freeze" || id === "black_hole" || id === "vortex") ctrl = 5;
  }
  if (["satellite_1","satellite_speed","satellite_damage","drone_1","drone_swarm","drone_link","auto_turret","collector_core"].includes(id)) {
    single = 3; clear = 4; surv = 1;
  }

  // mythics are high in everything
  if (upg.rarity === "mythic") {
    single = Math.max(single, 5);
    clear = Math.max(clear, 5);
    surv = Math.max(surv, 3);
    ctrl = Math.max(ctrl, 4);
  }

  // downsides / conflicts
  if (id === "berserker") downsides.push("Урон растёт только при низком HP — рискованно");
  if (id === "sniper_protocol") downsides.push("Бонус только когда цель изолирована");
  if (id === "ghost") downsides.push("Периодическая неуязвимость, не постоянная");
  if (id === "explosive" || id === "multi_explosion") downsides.push("Может задеть вас визуально, но урона по себе нет");
  if (id === "quantum_tunnel") downsides.push("Сильно увеличивает пробитие, но требует контроля поля");
  if (id === "black_hole") downsides.push("Притягивает и врагов, и может сместить вас");
  if (player.upgrades.some(u => u.id === id && u.level >= upg.maxLevel)) conflicts.push("Достигнут макс. уровень");

  // check synergy progress
  const owned = new Set(player.upgrades.map(u => u.id));
  owned.add(id); // simulate taking this card
  for (const syn of SYNERGIES) {
    if (player.synergies.includes(syn.id)) continue;
    if (syn.requires.includes(id)) {
      const have = syn.requires.filter(r => owned.has(r)).length;
      if (have === syn.requires.length) {
        activation = `Откроет синергию ${syn.name}`;
      } else if (have >= syn.requires.length - 1) {
        activation = `Близко к синергии ${syn.name} (${have}/${syn.requires.length})`;
      }
    }
  }

  // specific activation
  if (id === "shield_regen" && !player.shield) downsides.push("Требует щит для эффекта");
  if (id === "satellite_damage" && player.satellites.length === 0) downsides.push("Нет спутников — эффекта пока нет");
  if (id === "drone_link" && player.drones.length === 0) downsides.push("Нет дронов — эффекта пока нет");

  // clamp
  single = Math.min(5, Math.max(0, single));
  clear = Math.min(5, Math.max(0, clear));
  surv = Math.min(5, Math.max(0, surv));
  ctrl = Math.min(5, Math.max(0, ctrl));

  return { singleTarget: single, clear, survivability: surv, control: ctrl, downsides, conflicts, activation };
}

export function forecastLabel(v: number): string {
  if (v >= 5) return "★★★★★";
  if (v >= 4) return "★★★★☆";
  if (v >= 3) return "★★★☆☆";
  if (v >= 2) return "★★☆☆☆";
  if (v >= 1) return "★☆☆☆☆";
  return "☆☆☆☆☆";
}
