import { memo } from "react";

interface Props {
  def: any;
  lvl: number;
  maxed: boolean;
  cost: number;
  affordable: boolean;
  onBuy: (id: string) => void;
}

export default memo(function UpgradeCard({ def, lvl, maxed, cost, affordable, onBuy }: Props) {
  return (
    <div className={`rounded-2xl border p-4 ${maxed ? "border-emerald-700 bg-emerald-950/40" : "border-slate-700 bg-slate-900/70"}`}>
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
        <button onClick={() => onBuy(def.id)} disabled={!affordable} className={`w-full py-2 rounded-full text-sm font-black cursor-pointer transition ${affordable ? "bg-fuchsia-600 text-white" : "opacity-50 bg-slate-700 text-slate-400"}`}>
          ✨ {cost} осколков
        </button>
      )}
    </div>
  );
});
