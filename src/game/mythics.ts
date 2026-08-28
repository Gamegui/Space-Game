// ─── МИФИЧЕСКИЙ ТИР (Mythic Tier) ────────────────────────────────────────────
// Высшая редкость выше Legendary. Выпадение — отдельное игровое событие:
// остановка момента, вспышка, торжественная музыка, уникальная карточка.
// Мифик меняет правила игры, а не даёт «+500% урона».

import type { PlayerState } from "./types";

export const MYTHIC_MIN_LEVEL = 8;
export const MAX_MYTHIC_PER_RUN = 2;
// ~0.5% на каждый левел-ап после MIN_LEVEL: при ~50 уровнях за забег шанс
// увидеть мифик ≈ 22% — большинство забегов без него, как задано ТЗ.
export const MYTHIC_DROP_CHANCE = 0.005;

/** Идентификаторы мификов (UpgradeDef с rarity "mythic" живут в upgrades.ts). */
export const MYTHIC_IDS = [
  "mythic_nova",
  "mythic_singularity",
  "mythic_judgement",
  "mythic_overdrive",
  "mythic_fleet",
  "mythic_void",
] as const;

export function hasMythic(player: PlayerState, id: string): boolean {
  return player.upgrades.some(u => u.id === id && u.level > 0);
}

export function ownedMythicCount(player: PlayerState): number {
  let count = 0;
  for (const owned of player.upgrades) {
    if ((MYTHIC_IDS as readonly string[]).includes(owned.id)) count++;
  }
  return count;
}

/** Требования мификов по билду (id улучшений, которые должны быть собраны). */
export const MYTHIC_REQUIREMENTS: Record<string, string[]> = {
  // ☀️ Звёздный Пожиратель — без требований: кульминация любого боевого билда.
  mythic_nova: [],
  // 🌌 Сингулярность — контроль/наведение.
  mythic_singularity: ["homing", "singularity_rounds"],
  // ⚡ Бог Грома — электрический билд.
  mythic_judgement: ["lightning", "chain_lightning", "crit"],
  // 🔥 Абсолютный Реактор — скорострельность.
  mythic_overdrive: ["rapid_fire", "overdrive_reactor"],
  // 🛰️ Армада — флот помощников.
  mythic_fleet: ["satellite_1", "drone_1", "drone_link"],
  // 👁️ Абсолютная Пустота — фазовый билд.
  mythic_void: ["ghost", "quantum_tunnel"],
};

/**
 * Решает, выпадает ли мифик на этом повышении уровня.
 * Гейты: минимальный уровень, лимит за забег, требования билда, шанс.
 */
export function rollMythicDrop(player: PlayerState, random: () => number = Math.random): string | null {
  if (player.level < MYTHIC_MIN_LEVEL) return null;
  if (ownedMythicCount(player) >= MAX_MYTHIC_PER_RUN) return null;
  if (random() >= MYTHIC_DROP_CHANCE) return null;
  const owned = new Set(player.upgrades.map(u => u.id));
  const available = MYTHIC_IDS.filter(id =>
    !owned.has(id) && (MYTHIC_REQUIREMENTS[id] ?? []).every(req => owned.has(req))
  );
  if (available.length === 0) return null;
  return available[Math.floor(random() * available.length)];
}
