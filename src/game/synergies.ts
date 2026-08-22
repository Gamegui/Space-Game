import type { PlayerState } from "./types";

export interface SynergyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  requires: string[];
  apply: (player: PlayerState) => void;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: "storm_circuit", name: "ГРОЗОВОЙ КОНТУР", icon: "⚡",
    description: "Молнии чаще срабатывают и перескакивают на 3 дополнительные цели.",
    requires: ["lightning", "chain_lightning", "crit"],
    apply: player => { player.lightningChance += 0.18; player.lightningChain += 3; },
  },
  {
    id: "chain_reaction", name: "ЦЕПНАЯ ДЕТОНАЦИЯ", icon: "💥",
    description: "Взрывы становятся крупнее, а критические попадания — разрушительнее.",
    requires: ["explosive", "multi_explosion", "big_bullets"],
    apply: player => { player.explosiveBullets = true; player.explosionRadius *= 1.45; player.critMultiplier += 0.75; },
  },
  {
    id: "autonomous_fleet", name: "АВТОНОМНЫЙ ФЛОТ", icon: "🛰️",
    description: "Дроны и спутники получают боевой уровень и дополнительного помощника.",
    requires: ["satellite_1", "drone_1", "drone_link"],
    apply: player => {
      player.satellites.forEach(satellite => satellite.level += 2);
      player.drones.forEach(drone => drone.level += 2);
      if (player.drones.length < 5) player.drones.push({ id: Math.random(), pos: { ...player.pos }, angle: 0, orbitAngle: 0, orbitRadius: 135, speed: 2.5, shootTimer: 0, level: 3 });
    },
  },
  {
    id: "void_engine", name: "СЕРДЦЕ БЕЗДНЫ", icon: "🌑",
    description: "Фазовая защита, усиленное пробитие и самонаведение объединяются.",
    requires: ["ghost", "quantum_tunnel", "singularity_rounds"],
    apply: player => { player.ghostMode = true; player.piercing += 3; player.homing = true; player.homingStrength += 0.04; },
  },
];

export function unlockAvailableSynergies(player: PlayerState): SynergyDef[] {
  const owned = new Set(player.upgrades.map(upgrade => upgrade.id));
  const unlocked: SynergyDef[] = [];
  for (const synergy of SYNERGIES) {
    if (player.synergies.includes(synergy.id) || !synergy.requires.every(id => owned.has(id))) continue;
    synergy.apply(player);
    player.synergies.push(synergy.id);
    unlocked.push(synergy);
  }
  return unlocked;
}
