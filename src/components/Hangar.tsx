import { useState } from "react";
import {
  META_UPGRADES, MISSIONS, metaUpgradeCost, getMetaLevel, canBuyMetaUpgrade,
  isMissionComplete,
  type MetaState,
} from "../game/meta";
import { PRODUCTS } from "../game/products";
import type { StoreOffer } from "../platform/yandex";

interface Props {
  meta: MetaState;
  productStatuses: Record<string, ProductStatus>;
  offers: Record<string, StoreOffer | null>;
  purchasePendingId: string | null;
  onBuyUpgrade: (id: string) => void;
  onClaimMission: (id: string) => void;
  onBuyProduct: (id: string) => void;
  onBack: () => void;
}

export type ProductStatus = { state: "owned" | "available" | "unavailable" | "absent" };

type Tab = "upgrades" | "missions" | "shop";

export default function Hangar({ meta, productStatuses, offers, purchasePendingId, onBuyUpgrade, onClaimMission, onBuyProduct, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("upgrades");

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-black text-white">🛰️ АНГАР</h2>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-fuchsia-950 border border-fuchsia-700 px-4 py-1.5 font-mono text-sm font-black text-fuchsia-200">✨ {meta.shards.toLocaleString()} осколков</span>
            <button onClick={onBack} className="rounded-full bg-slate-800 hover:bg-slate-700 px-5 py-1.5 text-sm font-bold text-slate-300 cursor-pointer">← Назад</button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {([["upgrades","Улучшения"],["missions","Задания"],["shop","Магазин"]] as const).map(([k,label]) => (
            <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-sm font-black cursor-pointer transition ${tab===k?"bg-cyan-600 text-white":"bg-slate-800 text-slate-400 hover:text-white"}`}>{label}</button>
          ))}
        </div>

        {tab === "upgrades" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {META_UPGRADES.map(def => {
              const lvl = getMetaLevel(meta, def.id);
              const maxed = lvl >= def.maxLevel;
              const cost = metaUpgradeCost(def, lvl);
              const affordable = canBuyMetaUpgrade(meta, def);
              return (
                <div key={def.id} className={`rounded-2xl border p-4 ${maxed?"border-emerald-700 bg-emerald-950/40":"border-slate-700 bg-slate-900/70"}`}>
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
                    <button onClick={() => onBuyUpgrade(def.id)} disabled={!affordable} className={`w-full py-2 rounded-full text-sm font-black cursor-pointer transition ${affordable?"bg-fuchsia-600 hover:bg-fuchsia-500 text-white":"bg-slate-800 text-slate-600 cursor-not-allowed"}`}>
                      ✨ {cost} осколков
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "missions" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {MISSIONS.map(def => {
              const prog = Math.min(def.goal, meta.missions[def.id] ?? 0);
              const complete = isMissionComplete(def, meta);
              const claimed = Boolean(meta.claimedMissions[def.id]);
              return (
                <div key={def.id} className={`rounded-2xl border p-4 ${claimed?"border-slate-800 bg-slate-950/50 opacity-60":complete?"border-amber-600 bg-amber-950/40":"border-slate-700 bg-slate-900/70"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{def.icon}</span>
                    <span className="font-black text-white text-sm">{def.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 min-h-8">{def.description}</p>
                  <div className="mb-2 h-2 rounded bg-slate-800 overflow-hidden">
                    <div className={`h-full ${complete?"bg-amber-500":"bg-cyan-600"}`} style={{ width: `${Math.min(100, (prog/def.goal)*100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400">{prog}/{def.goal} · ✨{def.reward}</span>
                    {claimed ? <span className="text-emerald-400 font-black text-xs">ПОЛУЧЕНО</span>
                      : complete ? <button onClick={() => onClaimMission(def.id)} className="rounded-full bg-amber-600 hover:bg-amber-500 px-4 py-1 text-xs font-black text-white cursor-pointer">ЗАБРАТЬ</button>
                      : <span className="text-slate-600 text-xs font-bold">в процессе</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "shop" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {PRODUCTS.map(p => {
              const status = productStatuses[p.id]?.state ?? "absent";
              const offer = offers[p.id] ?? null;
              const owned = status === "owned";
              const available = status === "available" && offer;
              const absent = status === "absent" || status === "unavailable";
              const pending = purchasePendingId === p.id;
              return (
                <div key={p.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{p.icon}</span>
                    <span className="font-black text-white text-sm">{p.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 min-h-12">{p.description}</p>
                  {owned ? (
                    <div className="text-center text-emerald-400 font-black text-sm py-2">✓ КУПЛЕНО</div>
                  ) : available && offer ? (
                    <button onClick={() => onBuyProduct(p.id)} disabled={pending} className="w-full py-2 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-black text-sm cursor-pointer">
                      {pending ? "ОБРАБОТКА…" : `Купить · ${offer.price || offer.currencyCode}`}
                    </button>
                  ) : absent ? (
                    <div className="text-center text-slate-600 font-bold text-xs py-2">Недоступно в каталоге</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
