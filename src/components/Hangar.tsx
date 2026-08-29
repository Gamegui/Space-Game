import { useEffect, useMemo, useRef, useState } from "react";
import {
  META_UPGRADES, MISSIONS, metaUpgradeCost, getMetaLevel, canBuyMetaUpgrade,
  isMissionComplete, metaBonusSummary,
  type MetaState,
} from "../game/meta";
import { PRODUCTS } from "../game/products";
import type { StoreOffer } from "../platform/yandex";
import { audio } from "../game/audio";
import UpgradeCard from "./UpgradeCard";

export interface ProductStatus { state: "owned" | "available" | "unavailable" | "absent" }

/** Последняя операция с осколками (v1.8.0): показывается в «Ангаре». */
export interface ShardEvent {
  key: number;
  label: string;
  amount: number; // >0 — начисление, <0 — трата
}

interface Props {
  meta: MetaState;
  shardLog: ShardEvent[];
  productStatuses: Record<string, ProductStatus>;
  offers: Record<string, StoreOffer | null>;
  purchasePendingId: string | null;
  onBuyUpgrade: (id: string) => void;
  onBuyAll: () => void;
  onClaimMission: (id: string) => void;
  onBuyProduct: (id: string) => void;
  onBack: () => void;
}

type Tab = "upgrades" | "missions" | "shop";
type Filter = "all" | "available" | "maxed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "ВСЕ" },
  { id: "available", label: "ДОСТУПНЫЕ" },
  { id: "maxed", label: "МАКС." },
];

export default function Hangar({ meta, shardLog, productStatuses, offers, purchasePendingId, onBuyUpgrade, onBuyAll, onClaimMission, onBuyProduct, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("upgrades");
  const [filter, setFilter] = useState<Filter>("all");
  // Фидбек покупки (v1.8.0): карточка вспыхивает, у осколков появляется «−N ✨».
  const [boughtFlash, setBoughtFlash] = useState<{ id: string; cost: number; key: number } | null>(null);
  const [claimToast, setClaimToast] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
  }, []);

  // Представление улучшений под текущий фильтр — пересчитывается только при
  // смене состояния меты или фильтра, а не на каждый рендер Ангара.
  const upgradesView = useMemo(() => {
    const all = META_UPGRADES.map(def => {
      const lvl = getMetaLevel(meta, def.id);
      return {
        def,
        lvl,
        maxed: lvl >= def.maxLevel,
        cost: metaUpgradeCost(def, lvl),
        affordable: canBuyMetaUpgrade(meta, def),
      };
    });
    if (filter === "available") return all.filter(u => !u.maxed);
    if (filter === "maxed") return all.filter(u => u.maxed);
    return all;
  }, [meta, filter]);

  // Сводка постоянных бонусов + сколько уровней можно купить прямо сейчас
  // (сухой прогон той же логики, что у buyAllAffordableMeta).
  const summary = useMemo(() => metaBonusSummary(meta), [meta]);
  const buyAllCount = useMemo(() => {
    let rest = meta.shards;
    let count = 0;
    let progress = true;
    const levels: Record<string, number> = {};
    for (const def of META_UPGRADES) levels[def.id] = getMetaLevel(meta, def.id);
    while (progress) {
      progress = false;
      for (const def of META_UPGRADES) {
        const lvl = levels[def.id];
        if (lvl >= def.maxLevel) continue;
        const cost = metaUpgradeCost(def, lvl);
        if (rest >= cost) { rest -= cost; levels[def.id] = lvl + 1; count++; progress = true; }
      }
    }
    return count;
  }, [meta]);

  const counts = useMemo(() => {
    let maxed = 0, available = 0;
    for (const def of META_UPGRADES) {
      const lvl = getMetaLevel(meta, def.id);
      if (lvl >= def.maxLevel) maxed++;
      else if (canBuyMetaUpgrade(meta, def)) available++;
    }
    return { maxed, available, total: META_UPGRADES.length };
  }, [meta]);

  // Задания: готовые к получению — первыми, затем в процессе, полученные — в конец.
  const missionsView = useMemo(() => {
    const rows = MISSIONS.map(def => {
      const prog = Math.min(def.goal, meta.missions[def.id] ?? 0);
      return { def, prog, complete: isMissionComplete(def, meta), claimed: Boolean(meta.claimedMissions[def.id]) };
    });
    const rank = (r: { complete: boolean; claimed: boolean }) => (r.complete && !r.claimed ? 0 : !r.claimed ? 1 : 2);
    return rows.sort((a, b) => rank(a) - rank(b));
  }, [meta]);

  const claimableCount = useMemo(
    () => MISSIONS.filter(def => isMissionComplete(def, meta) && !meta.claimedMissions[def.id]).length,
    [meta],
  );

  const handleBuy = (id: string, cost: number) => {
    const def = META_UPGRADES.find(d => d.id === id);
    if (!def || !canBuyMetaUpgrade(meta, def)) return; // переплата невозможна по построению
    audio.playPowerup();
    setBoughtFlash({ id, cost, key: Date.now() });
    if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setBoughtFlash(null), 1300);
    onBuyUpgrade(id);
  };

  const handleClaim = (id: string, name: string, reward: number) => {
    audio.playXp();
    setClaimToast(`«${name}» · +${reward} ✨`);
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setClaimToast(null), 2200);
    onClaimMission(id);
  };

  const metaCompletion = useMemo(() => {
    let owned = 0, max = 0;
    for (const def of META_UPGRADES) {
      const lvl = getMetaLevel(meta, def.id);
      owned += lvl;
      max += def.maxLevel;
    }
    return Math.round((owned / max) * 100);
  }, [meta]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-3xl">
        {/* ─── Шапка: осколки, прогресс ангара, статистика ─── */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-3xl font-black text-white">🛰️ АНГАР</h2>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-4 py-1.5 font-mono text-sm font-black transition-colors ${boughtFlash ? "border-fuchsia-400 bg-fuchsia-900/60 text-fuchsia-100" : "border-fuchsia-700 bg-fuchsia-950 text-fuchsia-200"}`}>
              ✨ {meta.shards.toLocaleString()}
              {boughtFlash && <span className="ml-1.5 text-emerald-300">−{boughtFlash.cost}</span>}
            </span>
            <button onClick={onBack} className="rounded-full bg-slate-800 hover:bg-slate-700 px-5 py-1.5 text-sm font-bold text-slate-300 cursor-pointer">← Назад</button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 font-mono text-[11px] text-slate-400">
          <span>РАЗВИТИЕ АНГАРА: <b className="text-cyan-300">{metaCompletion}%</b></span>
          <span>ЗАБЕГОВ: <b className="text-slate-200">{meta.totals.runs}</b></span>
          <span>УБИЙСТВ: <b className="text-slate-200">{meta.totals.kills.toLocaleString()}</b></span>
          <span>БОССОВ: <b className="text-slate-200">{meta.totals.bossesKilled}</b></span>
          <span>ОСКОЛКОВ ВСЕГО: <b className="text-fuchsia-300">✨{meta.totals.shardsEarned.toLocaleString()}</b></span>
        </div>

        {/* ─── История осколков (последние операции) ─── */}
        {shardLog.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2">
            <div className="mb-1 text-[10px] font-black tracking-widest text-slate-500">ПОСЛЕДНИЕ ОПЕРАЦИИ</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px]">
              {shardLog.slice(0, 4).map(e => (
                <span key={e.key} className={e.amount >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {e.amount >= 0 ? `+${e.amount}` : e.amount} ✨ · {e.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── Вкладки ─── */}
        <div className="flex gap-2 mb-4">
          {([[ "upgrades", "Улучшения" ], [ "missions", `Задания${claimableCount > 0 ? ` · ${claimableCount}` : ""}` ], [ "shop", "Магазин" ]] as const).map(([k, label]) => (
            <button key={k} onClick={() => { audio.playHit(); setTab(k); }} className={`px-4 py-2 rounded-full text-sm font-black cursor-pointer transition ${tab === k ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "upgrades" && (
          <>
            {/* Сводка постоянных бонусов Ангара */}
            <div className="mb-3 rounded-xl border border-emerald-900/70 bg-emerald-950/30 px-4 py-2">
              <div className="mb-1 text-[10px] font-black tracking-widest text-emerald-400">ТЕКУЩИЕ БОНУСЫ АНГАРА</div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-slate-300">
                <span>❤️ +{summary.hp} HP</span>
                <span>🔵 +{summary.shield} щит</span>
                <span>💠 +{summary.damagePct}% урона</span>
                <span>🎯 +{summary.homing.toFixed(2)} наведение</span>
                <span>🧲 +{summary.magnet} радиус</span>
                <span>♻️ +{summary.rerolls} реролл</span>
                <span>💣 +{summary.nukes} заряд</span>
                <span className="text-fuchsia-300">✨ +{summary.shardsPct}% осколков</span>
              </div>
            </div>

            {/* Взять всё доступное */}
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={onBuyAll}
                disabled={buyAllCount === 0}
                className={`rounded-full px-4 py-1.5 text-xs font-black cursor-pointer transition active:scale-95 ${
                  buyAllCount > 0 ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-slate-800 text-slate-600 cursor-not-allowed"
                }`}
              >
                ⬆ ВЗЯТЬ ВСЁ ДОСТУПНОЕ{buyAllCount > 0 ? ` · ${buyAllCount} УР.` : ""}
              </button>
            </div>

            {/* Фильтры: Все / Доступные / Макс. */}
            <div className="mb-3 flex items-center gap-2">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3.5 py-1 font-mono text-[11px] font-black cursor-pointer transition ${
                    filter === f.id ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f.label}
                  {f.id === "available" && counts.available > 0 && <span className="ml-1 text-emerald-300">{counts.available}</span>}
                  {f.id === "maxed" && counts.maxed > 0 && <span className="ml-1 text-slate-500">{counts.maxed}</span>}
                </button>
              ))}
              {filter !== "all" && (
                <span className="font-mono text-[11px] text-slate-500">{upgradesView.length}/{counts.total}</span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {upgradesView.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm font-bold text-slate-500">
                  {filter === "available" ? "Нет улучшений, доступных по осколкам — они появятся после следующих забегов" : "В этой категории пусто"}
                </div>
              ) : upgradesView.map(({ def, lvl, maxed, cost, affordable }) => (
                <UpgradeCard
                  key={def.id}
                  def={def}
                  lvl={lvl}
                  maxed={maxed}
                  cost={cost}
                  affordable={affordable}
                  missing={affordable ? 0 : Math.max(0, cost - meta.shards)}
                  flashing={boughtFlash?.id === def.id}
                  onBuy={handleBuy}
                />
              ))}
            </div>
          </>
        )}

        {tab === "missions" && (
          <>
            {claimToast && (
              <div className="mb-3 rounded-xl border border-amber-500 bg-amber-950/60 px-4 py-2 text-center font-black text-amber-200">
                🎖 НАГРАДА ПОЛУЧЕНА: {claimToast}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {missionsView.map(({ def, prog, complete, claimed }) => (
                <div key={def.id} className={`rounded-2xl border p-4 ${claimed ? "border-slate-800 bg-slate-950/50 opacity-60" : complete ? "border-amber-600 bg-amber-950/40" : "border-slate-700 bg-slate-900/70"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{def.icon}</span>
                    <span className="font-black text-white text-sm">{def.name}</span>
                    {complete && !claimed && <span className="ml-auto animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-black">ГОТОВО</span>}
                  </div>
                  <p className="text-xs text-slate-400 mb-2 min-h-8">{def.description}</p>
                  <div className="mb-2 h-2 rounded bg-slate-800 overflow-hidden">
                    <div className={`h-full ${complete ? "bg-amber-500" : "bg-cyan-600"}`} style={{ width: `${Math.min(100, (prog / def.goal) * 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400">{prog}/{def.goal} · ✨{def.reward}</span>
                    {claimed ? <span className="text-emerald-400 font-black text-xs">ПОЛУЧЕНО</span>
                      : complete ? <button onClick={() => handleClaim(def.id, def.name, def.reward)} className="rounded-full bg-amber-600 hover:bg-amber-500 px-4 py-1 text-xs font-black text-white cursor-pointer transition active:scale-95">ЗАБРАТЬ</button>
                      : <span className="text-slate-600 text-xs font-bold">в процессе</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
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
                    <button onClick={() => onBuyProduct(p.id)} disabled={pending} className="w-full py-2 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-black text-sm cursor-pointer transition">
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
