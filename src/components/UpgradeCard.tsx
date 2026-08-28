import { memo } from "react";
import type { MetaUpgradeDef } from "../game/meta";

interface Props {
  def: MetaUpgradeDef;
  lvl: number;
  maxed: boolean;
  cost: number;
  affordable: boolean;
  flashing: boolean;
  onBuy: (id: string, cost: number) => void;
}

/**
 * Карточка постоянного улучшения Ангара (v1.8.0). memo: перерисовывается
 * только при изменении своих значений. «flashing» — короткая вспышка после
 * покупки (зелёная рамка + галочка), переплата исключена: родитель проверяет
 * canBuyMetaUpgrade до вызова.
 */
export default memo(function UpgradeCard({ def, lvl, maxed, cost, affordable, flashing, onBuy }: Props) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors duration-300 ${
      flashing ? "border-emerald-400 bg-emerald-950/60"
        : maxed ? "border-emerald-700 bg-emerald-950/40"
        : "border-slate-700 bg-slate-900/70"
    }`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{def.icon}</span>
          <span className="font-black text-white text-sm">{def.name}</span>
        </div>
        <span className="font-mono text-[10px] text-cyan-400">{lvl}/{def.maxLevel}</span>
      </div>
      <p className="text-xs text-slate-400 mb-3 min-h-8">{def.description}</p>
      {maxed ? (
        <div className="text-center text-emerald-400 font-black text-sm py-2">МАКС. УРОВЕНЬ</div>
      ) : (
        <button
          onClick={() => onBuy(def.id, cost)}
          disabled={!affordable}
          className={`w-full py-2 rounded-full text-sm font-black cursor-pointer transition active:scale-95 ${
            affordable
              ? flashing
                ? "bg-emerald-600 text-white"
                : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}
        >
          {flashing ? "✓ УСТАНОВЛЕНО" : <>✨ {cost} осколков{def.maxLevel > 1 && <span className="ml-1 opacity-70">· ур. {lvl + 1}/{def.maxLevel}</span>}</>}
        </button>
      )}
    </div>
  );
});
