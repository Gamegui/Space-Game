// ─── Weapon/upgrade evolutions (v1.5.0) ──────────────────────────────────────
// "Super-synergies": when a build satisfies a set of owned upgrades, a dramatic
// evolution fires once per run, transforming the build. Built on top of the
// existing synergy layer — does NOT rewrite the engine.

import type { PlayerState } from "./types";

export interface EvolutionDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Upgrade ids that must all be owned (level >= 1) to trigger. */
  requires: string[];
  apply: (player: PlayerState) => void;
}

export const EVOLUTIONS: EvolutionDef[] = [
  {
    id: "annihilator",
    name: "АННИГИЛЯТОР",
    icon: "💥",
    description: "Двойной залп + пробитие + взрыв → огромный залп пробивающих взрывных снарядов.",
    requires: ["double_shot", "piercing", "explosive"],
    apply: p => {
      p.multishot += 4;
      p.piercing += 2;
      p.explosiveBullets = true;
      p.explosionRadius = Math.max(p.explosionRadius, 90);
      p.bulletDamage *= 1.25;
    },
  },
  {
    id: "eternal_storm",
    name: "ВЕЧНЫЙ ШТОРМ",
    icon: "🌩️",
    description: "Молния + крит + кассетный разрыв → цепные молнии бьют чаще и дальше.",
    requires: ["lightning", "crit", "explosive"],
    apply: p => {
      p.lightningChance = Math.min(0.6, p.lightningChance + 0.25);
      p.lightningChain += 4;
      p.critChance = Math.min(0.65, p.critChance + 0.1);
    },
  },
  {
    id: "frost_legion",
    name: "МОРОЗНЫЙ ЛЕГИОН",
    icon: "❄️",
    description: "Заморозка + токсин + большая пуля → враги кристаллизуются и лопаются.",
    requires: ["freeze", "poison", "big_bullets"],
    apply: p => {
      p.freezeChance = Math.min(0.6, p.freezeChance + 0.2);
      p.poisonChance = Math.min(0.65, p.poisonChance + 0.2);
      p.bulletSize *= 1.2;
      p.bulletDamage *= 1.15;
    },
  },
  {
    id: "drone_swarm",
    name: "АРМАДА",
    icon: "🛸",
    description: "Турель + спутник + урон спутников + дрон → тяжёлый автономный флот: турели и спутники 4 уровня, дополнительный дрон-носитель.",
    requires: ["satellite_1", "drone_1", "auto_turret", "satellite_damage"],
    apply: p => {
      p.satellites.forEach(sat => { sat.level += 3; });
      p.drones.forEach(drone => { drone.level += 3; });
      if (p.drones.length < 6) {
        p.drones.push({ id: Math.random(), pos: { ...p.pos }, angle: 0, orbitAngle: 0, orbitRadius: 150, speed: 3, shootTimer: 0, level: 4 });
        p.drones.push({ id: Math.random(), pos: { ...p.pos }, angle: Math.PI, orbitAngle: Math.PI, orbitRadius: 170, speed: 2.8, shootTimer: 0, level: 4 });
      }
    },
  },
  {
    id: "phase_reaper",
    name: "ЖНЕЦ БЕЗДНЫ",
    icon: "🌑",
    description: "Призрак + квантовый тоннель + сингулярность + арсенал Бездны → фазовый жнец: неуязвимость, пробитие, самонаведение и +20% урона.",
    requires: ["ghost", "quantum_tunnel", "singularity_rounds", "void_arsenal"],
    apply: p => {
      p.ghostMode = true;
      p.piercing += 4;
      p.homing = true;
      p.homingStrength += 0.05;
      p.bulletDamage *= 1.25;
      p.voidSouls = Math.min(p.voidSouls + 2, 20);
    },
  },
  {
    id: "overdrive",
    name: "ПЕРЕГРУЗКА",
    icon: "🔥",
    description: "Скорострельность + двойной залп + калибр → шквал крупных быстрых снарядов.",
    requires: ["rapid_fire", "double_shot", "big_bullets"],
    apply: p => {
      p.fireRate = Math.max(3, p.fireRate * 0.75);
      p.multishot += 2;
      p.bulletSize *= 1.15;
      p.bulletDamage *= 1.15;
    },
  },
  {
    id: "railgun_protocol",
    name: "ПРОТОКОЛ РЕЛЬСОТРОНА",
    icon: "🎯",
    description: "Снайперский протокол + бронебойные + скорость снарядов → бронебойные сверхскоростные залпы.",
    requires: ["sniper_protocol", "piercing", "bullet_speed"],
    apply: p => {
      p.sniperProtocol = true;
      p.piercing += 2;
      p.bulletSpeed *= 1.3;
      p.bulletDamage *= 1.2;
    },
  },
];

/**
 * Trigger any evolutions whose requirements are now met. Called after every
 * upgrade application. Each evolution fires at most once per run (tracked in
 * player.evolved set). Returns the list of newly-triggered evolutions so the
 * caller can announce them in the upgrade panel.
 */
export function checkEvolutions(player: PlayerState): EvolutionDef[] {
  const triggered: EvolutionDef[] = [];
  const owned = new Set(player.upgrades.map(u => u.id));
  for (const evo of EVOLUTIONS) {
    if (player.evolved.includes(evo.id)) continue;
    if (!evo.requires.every(id => owned.has(id))) continue;
    evo.apply(player);
    player.evolved.push(evo.id);
    triggered.push(evo);
  }
  return triggered;
}
