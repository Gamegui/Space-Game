// Общие стили карточек по редкости (v1.8.0): единый источник для панели
// выбора улучшений и любых будущих карточек, чтобы редкости не расходились.
import type { CardStyle } from "./ChoiceCard";

export const rarityCardStyles: Record<string, CardStyle> = {
  mythic:    { bg: "from-amber-950 to-slate-900",  border: "border-amber-300", text: "text-amber-100", badge: "bg-gradient-to-r from-amber-400 to-yellow-200 text-black" },
  common:    { bg: "from-slate-800 to-slate-900", border: "border-slate-500", text: "text-slate-200", badge: "bg-slate-600 text-slate-200" },
  rare:      { bg: "from-blue-900 to-slate-900",  border: "border-blue-500",  text: "text-blue-100",  badge: "bg-blue-600 text-blue-100"  },
  epic:      { bg: "from-purple-900 to-slate-900",border: "border-purple-500",text: "text-purple-100",badge: "bg-purple-600 text-purple-100"},
  legendary: { bg: "from-amber-900 to-slate-900", border: "border-amber-500", text: "text-amber-100", badge: "bg-amber-500 text-amber-900" },
};
