import { memo } from "react";

interface Props {
  u: any;
  currentLevel: number;
  relatedSynergies: any[];
  relatedEvolutions: any[];
  onChoose: (u: any) => void;
}

export default memo(function ChoiceCard({ u, currentLevel, relatedSynergies, relatedEvolutions, onChoose }: Props) {
  const visiblePips = Math.min(u.maxLevel, 8);
  const stars = Array.from({ length: visiblePips }, (_, i) => i < Math.min(currentLevel, visiblePips));
  return (
    <button
      onClick={() => onChoose(u)}
      className={
        `flex-1 min-w-0 max-w-[250px] p-4 rounded-2xl border-2 border-slate-500 bg-gradient-to-b from-slate-800 to-slate-900 text-slate-200 transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95 text-left relative overflow-hidden group cursor-pointer`
      }
    >
      <div className={`text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block mb-3 tracking-widest`}>
        {u.rarity?.toUpperCase()}
      </div>

      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="text-3xl">{u.icon}</span>
        <div>
          <div className="font-black text-base leading-tight">{u.name}</div>
          <div className="text-xs opacity-60 font-mono">{u.category}</div>
        </div>
      </div>

      {relatedSynergies.length > 0 && (
        <div className="mb-2 space-y-1 text-[10px]">
          {relatedSynergies.map(s => (
            <div key={s.id} className="rounded-md border px-2 py-1 text-[9px] font-black leading-tight bg-fuchsia-950/70 text-fuchsia-200">
              {s.icon} {s.name}
            </div>
          ))}
        </div>
      )}

      <div className="text-xs opacity-85 leading-relaxed mb-4 min-h-[38px]">{u.description}</div>

      <div className="flex items-center gap-1.5 border-t border-white/10 pt-2.5">
        <span className="text-[11px] opacity-60 font-mono">УРОВЕНЬ</span>
        {stars.map((filled, i) => (
          <div key={i} className={`w-4 h-1.5 rounded-full transition-all ${filled ? "bg-current opacity-100" : "bg-white opacity-20"}`} />
        ))}
        <span className="text-xs opacity-70 font-mono ml-auto">{currentLevel}/{u.maxLevel}</span>
      </div>

      <div className="absolute top-2 right-2 opacity-10 text-4xl font-black">{currentLevel > 0 ? `+${currentLevel}` : ""}</div>
    </button>
  );
});
