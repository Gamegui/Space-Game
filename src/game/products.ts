// ─── Product registry (v1.5.0) ────────────────────────────────────────────────
// Central registry of permanent in-app purchases. The Yandex SDK purchase flow
// (yandex.ts: purchasePermanent / getOwnedProducts / getCatalogOffers) is
// product-agnostic — this registry only describes them for the UI and
// catalog-parity checks. New products must also be created in the Yandex Games
// console with the EXACT id below.

export interface ProductDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const PRODUCTS: ProductDef[] = [
  {
    id: "void_wraith",
    name: "Призрак «Немезида»",
    description: "Премиум-корабль: сдвоенные болты, фазовый скачок, пожирание душ.",
    icon: "🛸",
  },
  {
    id: "premium_pass",
    name: "Ускоритель прогресса",
    description: "Навсегда: x2 осколков ядра за каждый забег + 1 доп. бесплатный реролл.",
    icon: "⚡",
  },
  {
    id: "starter_pack",
    name: "Стартовый набор",
    description: "Навсегда: +1 бан улучшения и +25 щита на старте каждого забега.",
    icon: "🎁",
  },
];

export function isKnownProduct(id: string): boolean {
  return PRODUCTS.some(p => p.id === id);
}
