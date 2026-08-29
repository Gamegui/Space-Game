import type { PlayerState, ShipClassId } from "./types";

export interface SynergyDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  requires: string[];
  /** Необязательный гейт класса корабля (синергии «Немезиды»). */
  shipClass?: ShipClassId;
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
    description: "Дроны и спутники синхронизируются: +2 уровня и дополнительный дрон. Требует полный рой.",
    requires: ["satellite_1", "drone_1", "drone_link", "drone_swarm"],
    apply: player => {
      player.satellites.forEach(satellite => satellite.level += 2);
      player.drones.forEach(drone => drone.level += 2);
      if (player.drones.length < 5) player.drones.push({ id: Math.random(), pos: { ...player.pos }, angle: 0, orbitAngle: 0, orbitRadius: 135, speed: 2.5, shootTimer: 0, level: 3 });
    },
  },
  {
    id: "void_engine", name: "СЕРДЦЕ БЕЗДНЫ", icon: "🌑",
    description: "Фаза + квантовый тоннель + фазовые боеприпасы + разряд: пробитие, самонаведение и фазовая защита.",
    requires: ["ghost", "quantum_tunnel", "phase_ammo", "phase_discharge"],
    apply: player => { player.ghostMode = true; player.piercing += 3; player.homing = true; player.homingStrength += 0.04; player.phaseDischarge = true; player.phaseDischargeCount += 1; },
  },
  // ─── Эксклюзивные синергии премиального «Призрака «Немезида»» ──────────────
  // Только 2 штуки — отдельного дерева эксклюзивных предметов не создаём.
  {
    id: "void_hunger", name: "ГОЛОД БЕЗДНЫ", icon: "🩸",
    description: "Убийства: шанс восстановить HP и шанс дополнительной души.",
    requires: ["life_steal", "aura"],
    shipClass: "void_wraith",
    apply: player => { player.voidHunger = true; },
  },
  {
    id: "ghost_arsenal", name: "ПРИЗРАЧНЫЙ АРСЕНАЛ", icon: "👁️",
    description: "В Фазе Бездны снаряды ускоряются и вспыхивают призрачным светом.",
    requires: ["phase_discharge", "homing", "singularity_rounds"],
    shipClass: "void_wraith",
    apply: player => { player.ghostArsenal = true; },
  },
];

export function unlockAvailableSynergies(player: PlayerState): SynergyDef[] {
  const owned = new Set(player.upgrades.map(upgrade => upgrade.id));
  const unlocked: SynergyDef[] = [];
  for (const synergy of SYNERGIES) {
    if (player.synergies.includes(synergy.id)) continue;
    if (synergy.shipClass && player.shipClass !== synergy.shipClass) continue;
    if (!synergy.requires.every(id => owned.has(id))) continue;
    synergy.apply(player);
    player.synergies.push(synergy.id);
    unlocked.push(synergy);
  }
  return unlocked;
}
