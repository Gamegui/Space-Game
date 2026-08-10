import type { UpgradeDef, PlayerState } from "./types";

export const ALL_UPGRADES: UpgradeDef[] = [
  // ═══ DAMAGE ═══
  {
    id: "double_shot", name: "Double Shot", icon: "⚡", rarity: "common", category: "offense", maxLevel: 3,
    description: "Fire an additional bullet per shot",
    apply: (s, _l) => { s.multishot += 1; },
  },
  {
    id: "triple_shot", name: "Triple Shot", icon: "🔱", rarity: "rare", category: "offense", maxLevel: 2,
    description: "Fire 2 extra bullets in spread pattern",
    apply: (s, _l) => { s.multishot += 2; s.spreadAngle += 8; },
  },
  {
    id: "spread_shot", name: "Spread Shot", icon: "🌊", rarity: "common", category: "offense", maxLevel: 4,
    description: "Increases bullet spread angle",
    apply: (s, _l) => { s.spreadAngle += 10; s.multishot = Math.max(s.multishot, 1); },
  },
  {
    id: "rapid_fire", name: "Rapid Fire", icon: "🔥", rarity: "common", category: "offense", maxLevel: 5,
    description: "Reduces fire cooldown by 15%",
    apply: (s, _l) => { s.fireRate = Math.max(3, s.fireRate * 0.85); },
  },
  {
    id: "damage_up", name: "Power Core", icon: "💠", rarity: "common", category: "offense", maxLevel: 8,
    description: "Bullet damage +20%",
    apply: (s, _l) => { s.bulletDamage *= 1.2; },
  },
  {
    id: "big_bullets", name: "Heavy Rounds", icon: "🔵", rarity: "common", category: "offense", maxLevel: 4,
    description: "Bullet size +25%, damage +10%",
    apply: (s, _l) => { s.bulletSize *= 1.25; s.bulletDamage *= 1.1; },
  },
  {
    id: "bullet_speed", name: "Velocity Amp", icon: "💨", rarity: "common", category: "offense", maxLevel: 4,
    description: "Bullet speed +20%",
    apply: (s, _l) => { s.bulletSpeed *= 1.2; },
  },
  {
    id: "piercing", name: "Piercing Rounds", icon: "🗡️", rarity: "rare", category: "offense", maxLevel: 4,
    description: "Bullets pierce through +1 enemy",
    apply: (s, _l) => { s.piercing += 1; },
  },
  {
    id: "homing", name: "Seeking Missiles", icon: "🎯", rarity: "rare", category: "offense", maxLevel: 3,
    description: "Bullets home in on nearest enemies",
    apply: (s, l) => { s.homing = true; s.homingStrength = 0.06 + l * 0.03; },
  },
  {
    id: "explosive", name: "Explosive Rounds", icon: "💥", rarity: "rare", category: "offense", maxLevel: 3,
    description: "Bullets explode on impact",
    apply: (s, l) => { s.explosiveBullets = true; s.explosionRadius = 40 + l * 20; },
  },
  {
    id: "ricochet", name: "Ricochet", icon: "↩️", rarity: "rare", category: "offense", maxLevel: 3,
    description: "Bullets bounce between enemies",
    apply: (s, _l) => { s.ricochet = true; s.ricochetCount += 1; },
  },
  {
    id: "rear_shot", name: "Rear Cannon", icon: "🔙", rarity: "rare", category: "offense", maxLevel: 2,
    description: "Fires backwards simultaneously",
    apply: (s, _l) => { s.rearShot = true; },
  },
  {
    id: "spiral_shot", name: "Spiral Barrage", icon: "🌀", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Bullets fire in a rotating spiral pattern",
    apply: (s, _l) => { s.spiralShot = true; },
  },
  {
    id: "wave_shot", name: "Wave Cannon", icon: "〰️", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Periodic massive wave blast",
    apply: (s, _l) => { s.waveShot = true; },
  },
  {
    id: "snipe_mode", name: "Sniper Protocol", icon: "🔭", rarity: "rare", category: "offense", maxLevel: 1,
    description: "Massive damage, very high bullet speed, less spread",
    apply: (s, _l) => { s.snipeMode = true; s.bulletDamage *= 3; s.bulletSpeed *= 2; s.spreadAngle = 0; },
  },
  {
    id: "mirror_shots", name: "Mirror Array", icon: "🪞", rarity: "epic", category: "offense", maxLevel: 2,
    description: "All bullets are mirrored from the opposite side",
    apply: (s, _l) => { s.mirrorShots = true; },
  },
  {
    id: "burn", name: "Incendiary Rounds", icon: "🔥", rarity: "common", category: "elemental", maxLevel: 3,
    description: "Bullets have a 25% chance to burn enemies",
    apply: (s, _l) => { s.burnChance += 0.25; },
  },
  {
    id: "freeze", name: "Cryo Rounds", icon: "❄️", rarity: "common", category: "elemental", maxLevel: 3,
    description: "Bullets have a 20% chance to freeze enemies",
    apply: (s, _l) => { s.freezeChance += 0.2; },
  },
  {
    id: "poison", name: "Toxic Rounds", icon: "☠️", rarity: "common", category: "elemental", maxLevel: 3,
    description: "Bullets have a 30% chance to poison enemies",
    apply: (s, _l) => { s.poisonChance += 0.3; },
  },
  {
    id: "lightning", name: "Tesla Rounds", icon: "⚡", rarity: "rare", category: "elemental", maxLevel: 3,
    description: "25% chance to chain lightning to nearby enemies",
    apply: (s, l) => { s.lightningChance += 0.25; s.lightningChain = Math.max(s.lightningChain, l + 1); },
  },
  {
    id: "crit", name: "Critical Matrix", icon: "🎲", rarity: "rare", category: "offense", maxLevel: 4,
    description: "Critical hit chance +15%, crit damage +50%",
    apply: (s, _l) => { s.critChance += 0.15; s.critMultiplier += 0.5; },
  },
  // ═══ SATELLITES & DRONES ═══
  {
    id: "satellite_1", name: "Orbital Satellite", icon: "🛰️", rarity: "rare", category: "companion", maxLevel: 4,
    description: "Deploy an orbiting satellite that shoots enemies",
    apply: (s, l) => {
      if (s.satellites.length < 8) {
        const angle = (s.satellites.length / 8) * Math.PI * 2;
        s.satellites.push({ angle, radius: 80 + s.satellites.length * 10, speed: 0.03, level: l, shootTimer: 0 });
      } else {
        s.satellites.forEach(sat => { sat.level = l; });
      }
    },
  },
  {
    id: "satellite_speed", name: "Orbital Boost", icon: "🌐", rarity: "common", category: "companion", maxLevel: 3,
    description: "Satellites orbit faster and shoot more often",
    apply: (s, _l) => { s.satellites.forEach(sat => { sat.speed *= 1.4; }); },
  },
  {
    id: "satellite_damage", name: "Satellite Upgrade", icon: "💫", rarity: "common", category: "companion", maxLevel: 4,
    description: "Increase satellite damage level",
    apply: (s, l) => { s.satellites.forEach(sat => { sat.level += l; }); },
  },
  {
    id: "drone_1", name: "Combat Drone", icon: "🤖", rarity: "rare", category: "companion", maxLevel: 3,
    description: "Deploy a combat drone that tracks and shoots enemies",
    apply: (s, l) => {
      if (s.drones.length < 4) {
        s.drones.push({ id: Math.random(), pos: { x: s.pos.x, y: s.pos.y }, angle: 0, orbitAngle: s.drones.length * Math.PI / 2, orbitRadius: 120, speed: 2, shootTimer: 0, level: l });
      } else {
        s.drones.forEach(d => { d.level = Math.max(d.level, l); });
      }
    },
  },
  {
    id: "drone_swarm", name: "Drone Swarm", icon: "🐝", rarity: "epic", category: "companion", maxLevel: 2,
    description: "Deploy 2 additional combat drones",
    apply: (s, l) => {
      for (let i = 0; i < 2 && s.drones.length < 6; i++) {
        s.drones.push({ id: Math.random(), pos: { x: s.pos.x, y: s.pos.y }, angle: 0, orbitAngle: s.drones.length * Math.PI / 3, orbitRadius: 130, speed: 2.5, shootTimer: 0, level: l });
      }
    },
  },
  // ═══ DEFENSE ═══
  {
    id: "shield", name: "Energy Shield", icon: "🛡️", rarity: "rare", category: "defense", maxLevel: 4,
    description: "Generates a rechargeable energy shield",
    apply: (s, l) => {
      if (!s.shield) s.shield = { hp: 50 * l, maxHp: 50 * l, regenTimer: 0, active: true };
      else { s.shield.maxHp += 50; s.shield.hp = Math.min(s.shield.hp + 50, s.shield.maxHp); }
    },
  },
  {
    id: "shield_regen", name: "Shield Capacitor", icon: "⚡🛡️", rarity: "common", category: "defense", maxLevel: 3,
    description: "Shield regenerates 30% faster",
    apply: (_s, _l) => { /* handled in game loop */ },
  },
  {
    id: "max_hp", name: "Hull Plating", icon: "❤️", rarity: "common", category: "defense", maxLevel: 6,
    description: "Max HP +25, restore 25 HP",
    apply: (s, _l) => { s.maxHp += 25; s.hp = Math.min(s.hp + 25, s.maxHp); },
  },
  {
    id: "regen", name: "Nanobots", icon: "🩹", rarity: "rare", category: "defense", maxLevel: 4,
    description: "Regenerate 0.5 HP per second",
    apply: (s, _l) => { s.regenRate += 0.5; },
  },
  {
    id: "life_steal", name: "Vampiric Core", icon: "🧛", rarity: "rare", category: "defense", maxLevel: 3,
    description: "Restore 3% of damage dealt as HP",
    apply: (s, _l) => { s.lifeSteal += 0.03; },
  },
  {
    id: "speed_up", name: "Afterburner", icon: "🚀", rarity: "common", category: "defense", maxLevel: 4,
    description: "Movement speed +15%",
    apply: (s, _l) => { s.speed *= 1.15; },
  },
  {
    id: "magnet", name: "XP Magnet", icon: "🧲", rarity: "common", category: "utility", maxLevel: 4,
    description: "Attract XP orbs from greater distance",
    apply: (s, _l) => { s.magnetRange += 60; },
  },
  {
    id: "ghost", name: "Phase Shift", icon: "👻", rarity: "epic", category: "defense", maxLevel: 2,
    description: "Periodically become invincible for 2 seconds",
    apply: (s, _l) => { s.ghostMode = true; },
  },
  {
    id: "aura", name: "Damage Aura", icon: "🌟", rarity: "rare", category: "offense", maxLevel: 4,
    description: "Emit a damage aura that hurts nearby enemies",
    apply: (s, _l) => { s.aura = true; s.auraDamage += 0.3; },
  },
  // ═══ SPECIAL ═══
  {
    id: "mine_layer", name: "Mine Layer", icon: "💣", rarity: "rare", category: "special", maxLevel: 3,
    description: "Periodically drop proximity mines",
    apply: (s, _l) => { s.mineCount += 1; s.mineTimer = Math.max(60, s.mineTimer - 20); },
  },
  {
    id: "black_hole", name: "Black Hole Projector", icon: "🕳️", rarity: "legendary", category: "special", maxLevel: 2,
    description: "Periodically deploy a black hole that pulls and crushes enemies",
    apply: (s, _l) => { s.blackHole = true; s.blackHoleCooldown = 600; },
  },
  {
    id: "nuke", name: "Tactical Nuke", icon: "☢️", rarity: "legendary", category: "special", maxLevel: 3,
    description: "Gain a nuke charge. Destroys all enemies on screen",
    apply: (s, _l) => { s.nukeCharges += 1; },
  },
  {
    id: "time_slow", name: "Chrono Rift", icon: "⏱️", rarity: "legendary", category: "special", maxLevel: 2,
    description: "Periodically slow all enemies and bullets by 50%",
    apply: (s, _l) => { s.timeSlow = true; s.timeSlowCooldown = 500; },
  },
  {
    id: "teleport", name: "Blink Drive", icon: "🌀", rarity: "epic", category: "special", maxLevel: 2,
    description: "Teleport behind the nearest enemy periodically",
    apply: (s, _l) => { s.teleportCooldown = 400; },
  },
  {
    id: "laser_side", name: "Side Lasers", icon: "🔴", rarity: "rare", category: "offense", maxLevel: 3,
    description: "Continuous side laser beams",
    apply: (s, _l) => { s.lasers += 1; },
  },
  // ═══ PASSIVES ═══
  {
    id: "xp_boost", name: "XP Amplifier", icon: "✨", rarity: "common", category: "utility", maxLevel: 5,
    description: "Gain 20% more XP from all sources",
    apply: (_s, _l) => { /* handled */ },
  },
  {
    id: "score_boost", name: "Score Multiplier", icon: "🏆", rarity: "common", category: "utility", maxLevel: 5,
    description: "Score multiplier +0.5x",
    apply: (s, _l) => { s.goldMultiplier += 0.5; },
  },
  {
    id: "heal_on_kill", name: "Battle Medic", icon: "💊", rarity: "rare", category: "defense", maxLevel: 3,
    description: "Restore 2 HP on every kill",
    apply: (_s, _l) => { /* tracked as upgrade */ },
  },
  {
    id: "chain_lightning", name: "Ball Lightning", icon: "🌩️", rarity: "epic", category: "elemental", maxLevel: 3,
    description: "Shoot bouncing lightning orbs",
    apply: (_s, _l) => { /* handled via lightningChain + lightningChance */ },
  },
  {
    id: "megaton", name: "Megaton Shells", icon: "🎇", rarity: "epic", category: "offense", maxLevel: 2,
    description: "50% of shots deal 5x damage",
    apply: (s, _l) => { s.critChance += 0.5; s.critMultiplier += 4; },
  },
  {
    id: "auto_turret", name: "Auto-Turret", icon: "🔫", rarity: "epic", category: "companion", maxLevel: 2,
    description: "Deploy an auto-turret that rotates and shoots (acts as bonus satellite)",
    apply: (s, l) => {
      for (let i = 0; i < 2 && s.satellites.length < 8; i++) {
        s.satellites.push({ angle: Math.random() * Math.PI * 2, radius: 100, speed: 0.015, level: l + 1, shootTimer: 0 });
      }
    },
  },
  {
    id: "reload_speed", name: "Quick Loader", icon: "🔄", rarity: "common", category: "offense", maxLevel: 4,
    description: "Fire rate +12%",
    apply: (s, _l) => { s.fireRate = Math.max(2, s.fireRate * 0.88); },
  },
  {
    id: "bouncy_bullets", name: "Bouncy Rounds", icon: "🔴", rarity: "rare", category: "offense", maxLevel: 3,
    description: "Bullets bounce off walls",
    apply: (s, _l) => { s.ricochet = true; s.ricochetCount += 2; },
  },
  {
    id: "energy_blade", name: "Energy Blade", icon: "⚔️", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Adds close-range energy blade attack (acts as damage aura)",
    apply: (s, _l) => { s.aura = true; s.auraDamage += 0.8; },
  },
  {
    id: "plasma_cannon", name: "Plasma Cannon", icon: "🔮", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Huge slow bullets that explode massively",
    apply: (s, _l) => { s.bulletSize *= 2; s.explosiveBullets = true; s.explosionRadius += 60; s.fireRate *= 1.5; },
  },
  {
    id: "bullet_hail", name: "Bullet Hail", icon: "🌧️", rarity: "rare", category: "offense", maxLevel: 3,
    description: "+4 bullets in random directions per shot",
    apply: (s, _l) => { s.multishot += 4; s.spreadAngle = Math.max(s.spreadAngle, 180); },
  },
  {
    id: "death_nova", name: "Death Nova", icon: "💀", rarity: "epic", category: "special", maxLevel: 2,
    description: "When hit, release an explosion (requires shield)",
    apply: (s, _l) => { if (!s.shield) s.shield = { hp: 30, maxHp: 30, regenTimer: 0, active: true }; s.explosionRadius += 30; },
  },
  {
    id: "swarm_missiles", name: "Swarm Missiles", icon: "🚀", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Fire a swarm of homing micro-missiles periodically",
    apply: (s, _l) => { s.homing = true; s.multishot += 3; s.homingStrength = Math.max(s.homingStrength, 0.08); },
  },
  {
    id: "shield_bash", name: "Shield Bash", icon: "🛡️💥", rarity: "rare", category: "special", maxLevel: 2,
    description: "Shield deals damage to nearby enemies when active",
    apply: (s, _l) => { s.aura = true; s.auraDamage += 0.5; if (!s.shield) s.shield = { hp: 40, maxHp: 40, regenTimer: 0, active: true }; },
  },
  {
    id: "empowered_crit", name: "Lethal Precision", icon: "🎯", rarity: "rare", category: "offense", maxLevel: 3,
    description: "Crit chance +20%, crits cause explosions",
    apply: (s, _l) => { s.critChance += 0.2; s.explosiveBullets = true; },
  },
  {
    id: "multi_explosion", name: "Chain Reaction", icon: "💥💥", rarity: "legendary", category: "offense", maxLevel: 2,
    description: "Explosions trigger secondary explosions",
    apply: (s, _l) => { s.explosiveBullets = true; s.explosionRadius *= 1.5; },
  },
  {
    id: "overcharge", name: "Overcharge", icon: "⚡⚡", rarity: "legendary", category: "offense", maxLevel: 1,
    description: "Every 5th bullet deals 10x damage",
    apply: (s, _l) => { s.critChance += 0.2; s.critMultiplier += 9; },
  },
  {
    id: "berserker", name: "Berserker Mode", icon: "😤", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Fire rate increases as HP decreases",
    apply: (s, _l) => { s.rapidMode = true; },
  },
  {
    id: "fortress", name: "Fortress Protocol", icon: "🏰", rarity: "legendary", category: "defense", maxLevel: 1,
    description: "Massively increase HP and shield, reduce speed slightly",
    apply: (s, _l) => { s.maxHp += 100; s.hp = Math.min(s.hp + 100, s.maxHp); if (!s.shield) s.shield = { hp: 100, maxHp: 100, regenTimer: 0, active: true }; else { s.shield.maxHp += 100; s.shield.hp += 100; } s.speed *= 0.85; },
  },
  {
    id: "glass_cannon", name: "Glass Cannon", icon: "🔱", rarity: "legendary", category: "offense", maxLevel: 1,
    description: "Triple damage, half HP - pure offense build",
    apply: (s, _l) => { s.bulletDamage *= 3; s.maxHp = Math.max(20, Math.floor(s.maxHp / 2)); s.hp = Math.min(s.hp, s.maxHp); },
  },
  {
    id: "neutron_star", name: "Neutron Star", icon: "⭐", rarity: "legendary", category: "special", maxLevel: 1,
    description: "Permanent damage aura with massive radius",
    apply: (s, _l) => { s.aura = true; s.auraDamage += 2; },
  },
  {
    id: "orbital_strike", name: "Orbital Strike", icon: "🌠", rarity: "legendary", category: "special", maxLevel: 2,
    description: "Random orbital strikes hit random enemies every 3s",
    apply: (s, l) => {
      for (let i = 0; i < 2 && s.satellites.length < 8; i++) {
        s.satellites.push({ angle: Math.random() * Math.PI * 2, radius: 60 + i * 20, speed: 0.05, level: l + 2, shootTimer: 0 });
      }
    },
  },
  {
    id: "vortex", name: "Gravity Vortex", icon: "🌪️", rarity: "legendary", category: "special", maxLevel: 1,
    description: "Bullets pull enemies toward them",
    apply: (s, _l) => { s.homing = true; s.homingStrength = 0.15; s.bulletSize *= 1.5; },
  },
  {
    id: "turbo_engine", name: "Turbo Engine", icon: "⚙️", rarity: "rare", category: "defense", maxLevel: 3,
    description: "Movement speed +30%",
    apply: (s, _l) => { s.speed *= 1.3; },
  },
  {
    id: "reactive_armor", name: "Reactive Armor", icon: "🔰", rarity: "rare", category: "defense", maxLevel: 3,
    description: "Taking damage increases your damage by 10% for 3s",
    apply: (s, _l) => { s.bulletDamage *= 1.05; /* simplified */ },
  },
  {
    id: "energy_recycler", name: "Energy Recycler", icon: "♻️", rarity: "common", category: "utility", maxLevel: 4,
    description: "Killing enemies reduces all cooldowns",
    apply: (_s, _l) => { /* tracked */ },
  },
  {
    id: "quantum_tunnel", name: "Quantum Tunnel", icon: "🌌", rarity: "legendary", category: "special", maxLevel: 1,
    description: "Bullets pass through walls and re-enter from the other side",
    apply: (s, _l) => { s.piercing += 10; },
  },
  {
    id: "solar_flare", name: "Solar Flare", icon: "☀️", rarity: "epic", category: "elemental", maxLevel: 2,
    description: "Enemies near your bullets take burn damage in an area",
    apply: (s, _l) => { s.burnChance += 0.5; s.explosionRadius += 20; },
  },
  {
    id: "ice_storm", name: "Ice Storm", icon: "🌨️", rarity: "epic", category: "elemental", maxLevel: 2,
    description: "30% chance to create an ice storm on hit",
    apply: (s, _l) => { s.freezeChance += 0.3; s.multishot += 2; },
  },
  {
    id: "death_ray", name: "Death Ray", icon: "☠️", rarity: "legendary", category: "offense", maxLevel: 1,
    description: "Massive laser beam deals extreme damage (very high pierce)",
    apply: (s, _l) => { s.piercing += 20; s.bulletDamage *= 2; s.bulletSize *= 3; },
  },
  {
    id: "nano_shield", name: "Nano Shield", icon: "🔵🛡️", rarity: "rare", category: "defense", maxLevel: 3,
    description: "Shield that blocks 1 hit completely every 10s",
    apply: (s, _l) => { if (!s.shield) s.shield = { hp: 60, maxHp: 60, regenTimer: 0, active: true }; else s.shield.maxHp += 30; },
  },
  {
    id: "revenge", name: "Martyr's Revenge", icon: "🩸", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Each HP lost permanently increases damage by 1%",
    apply: (s, _l) => { s.bulletDamage *= 1.1; },
  },
  {
    id: "unstoppable", name: "Unstoppable Force", icon: "💪", rarity: "legendary", category: "offense", maxLevel: 1,
    description: "Bullets deal more damage the longer they travel",
    apply: (s, _l) => { s.bulletDamage *= 1.5; s.bulletSpeed *= 1.5; s.piercing += 5; },
  },
  {
    id: "doom_satellite", name: "Doom Satellite", icon: "☄️", rarity: "legendary", category: "companion", maxLevel: 1,
    description: "Deploy one ultra-powerful satellite with massive firepower",
    apply: (s, _l) => {
      s.satellites.push({ angle: 0, radius: 90, speed: 0.025, level: 10, shootTimer: 0 });
    },
  },
  {
    id: "wormhole", name: "Wormhole Generator", icon: "🕳️", rarity: "legendary", category: "special", maxLevel: 1,
    description: "Teleports enemy bullets away randomly",
    apply: (s, _l) => { s.ghostMode = true; },
  },
  {
    id: "atomic_bomb", name: "Atomic Warhead", icon: "💣", rarity: "legendary", category: "special", maxLevel: 2,
    description: "Gain 2 nuke charges",
    apply: (s, _l) => { s.nukeCharges += 2; },
  },
  {
    id: "hyperdrive", name: "Hyperdrive", icon: "💫", rarity: "epic", category: "defense", maxLevel: 2,
    description: "Dash through enemies periodically dealing damage",
    apply: (s, _l) => { s.speed *= 1.2; s.ghostMode = true; },
  },
  {
    id: "omnidirectional", name: "Omnidirectional Array", icon: "🔄", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Fire in all directions simultaneously",
    apply: (s, _l) => { s.multishot += 6; s.spreadAngle = 360; },
  },
  {
    id: "power_surge", name: "Power Surge", icon: "🌩️", rarity: "epic", category: "offense", maxLevel: 2,
    description: "Every 30 kills trigger a power surge: 5s of double fire rate",
    apply: (s, _l) => { s.bulletDamage *= 1.15; s.fireRate *= 0.9; },
  },
  {
    id: "stellar_core", name: "Stellar Core", icon: "🌟", rarity: "legendary", category: "offense", maxLevel: 1,
    description: "Unlock maximum power: +100% all damage",
    apply: (s, _l) => { s.bulletDamage *= 2; s.auraDamage *= 2; },
  },
];

export function getUpgradeLevel(state: PlayerState, id: string): number {
  const u = state.upgrades.find(u => u.id === id);
  return u ? u.level : 0;
}

export function canUpgrade(state: PlayerState, def: UpgradeDef): boolean {
  const lvl = getUpgradeLevel(state, def.id);
  return lvl < def.maxLevel;
}

export function rollUpgrades(state: PlayerState, count = 3): UpgradeDef[] {
  const available = ALL_UPGRADES.filter(u => canUpgrade(state, u));
  if (available.length === 0) return [];

  // Weighted random by rarity
  const weighted: UpgradeDef[] = [];
  for (const u of available) {
    const w = u.rarity === "common" ? 40 : u.rarity === "rare" ? 15 : u.rarity === "epic" ? 7 : 3;
    for (let i = 0; i < w; i++) weighted.push(u);
  }

  const picked: UpgradeDef[] = [];
  const usedIds = new Set<string>();
  let tries = 0;
  while (picked.length < Math.min(count, available.length) && tries < 1000) {
    tries++;
    const candidate = weighted[Math.floor(Math.random() * weighted.length)];
    if (!usedIds.has(candidate.id)) {
      usedIds.add(candidate.id);
      picked.push(candidate);
    }
  }
  return picked;
}

export function applyUpgrade(state: PlayerState, def: UpgradeDef): PlayerState {
  const existing = state.upgrades.find(u => u.id === def.id);
  const newLevel = existing ? existing.level + 1 : 1;
  def.apply(state, newLevel);
  if (existing) existing.level = newLevel;
  else state.upgrades.push({ id: def.id, level: newLevel });
  return state;
}
