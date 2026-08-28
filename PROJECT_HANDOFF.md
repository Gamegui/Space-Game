# Космический Штурм: Ультра — handoff

## Обязанность КАЖДОЙ следующей сессии (ОБЯЗАТЕЛЬНО / mandatory rule)

> Владелец (2026-08-26): **каждое изменение в проекте ОБЯЗАН быть записанным
> в этот документ.** Никаких «немолчуемых» правок.

Every agent/session that changes anything in this repository MUST, before
finishing the work, append a **dated entry to this handoff** describing:

1. **Что изменено** — systems, files, new identifiers (upgrade ids, product
   ids, constants).
2. **Почему** — the owner request or the bug it fixes.
3. **Как проверено** — typecheck / build / smoke-simulation checks / manual
   playtest results.
4. **Новые внешние проверки** — if anything needs manual acceptance in the
   Yandex Games draft, extend the checklist below.

Also: keep the exact title (`Космический Штурм: Ультра`), the Yandex console
identifiers (`highscore` leaderboard, `void_wraith` product) and the
`space-shooter-yandex.zip` release archive in sync — any gameplay change
requires `npm run package:yandex`, committing the refreshed ZIP, and a note
here. If the owner reports a gameplay problem, fix, verify, document.

## Release state

The project is a release-ready Yandex Games HTML5 roguelite. Version shown in-game: `v1.0.0 · RELEASE`.

- Release archive: `space-shooter-yandex.zip`
- Archive root contains exactly one `index.html`
- Production builds never include the development admin panel
- Main language: Russian only
- Native playfield: 960×720 with uniform responsive scaling

## Commands

```bash
npm ci
npm run typecheck
npm run build
npm run package:yandex
```

Local release preview:

```bash
npm run dev -- --port 5173
```

QA preview with admin panel:

```bash
VITE_ADMIN=true npm run dev -- --port 5174
```

## Yandex Games configuration

The official SDK is loaded from `https://yandex.ru/games/sdk/v2`.

Required console entries:

- Leaderboard technical name: `highscore`
- Permanent, non-consumable in-app product ID: `void_wraith`
- Supported language in the console: Russian
- Orientation: landscape
- Platforms: desktop and mobile

Integrated APIs:

- LoadingAPI
- GameplayAPI
- Player Data / cloud high score
- Leaderboards
- Rewarded ads
- Fullscreen ads
- Permanent purchases and purchase restoration (`getPurchases()` on every launch — the documented permanent-product flow)
- Store catalog (`getCatalog()`): the purchase CTA shows the numeric price and the portal currency name/icon straight from the SDK (Game Requirements §1.13.2 and §1.13.4), and the purchase is hidden whenever the product is absent or inactive in the console (§1.13, catalog parity)

Real advertisements, purchases and leaderboard writes must be tested in a Yandex Games draft; local development safely falls back when the SDK is unavailable.

## Important gameplay systems

- Five ships, including premium `void_wraith`
- 90 upgrades plus repeatable `limit_break`
- Three free rerolls, rewarded rerolls, rewarded fourth epic/legendary choice
- One banish per run
- Four build synergies with card hints and progress UI
- Route selection: Asteroids, Warzone, Anomaly
- Adaptive difficulty based on effective player build power after wave 25
- Boss every five waves; Omega is the final wave-50 mission boss with four forms
- Optional endless continuation after victory
- Boss and Black Cortege diminishing control resistance
- Dynamic Black Cortege event after fast clears, never before wave 16
- Automatic low-end quality scaling and manual Auto/Low/Medium/High setting
- Separate music and SFX volume controls

## Black Cortege

The adaptive Guard was intentionally transformed into a four-unit mystical event:

- Herald — protects linked members and is marked `ЦЕЛЬ №1` for 10 seconds
- Reaper — phase hunter
- Eye — artillery/control
- Anchor — gravity pressure

A large Void Eye appears in the background. Damage is capped per simulation frame so a level-300 max build cannot one-shot the event. Early encounters are deliberately softer, and the event is blocked before wave 16, player level 12, or build power 90.

## Performance and QA safeguards

- Fixed 60 Hz simulation independent of monitor refresh rate
- Spatial grid for bullet/enemy collision checks
- Throttled homing recalculation
- Dynamic object budgets for three quality tiers
- Reduced particles, gradients and shadows on weak hardware
- Reused WebAudio noise buffer for explosions
- Cached/localized save parsing with corrupted-value fallback
- Automatic pause on blur/visibility loss
- No boss types in regular wave queues
- Wave density caps and dynamic spawn acceleration
- Repeatable max-build fallback prevents empty upgrade softlocks

Automated checks have covered:

- TypeScript compilation
- Production build
- npm production audit
- Waves 1–100 composition and density
- All five ship initial states
- All 90 upgrade applications
- Maxed build and `limit_break`
- All four synergies
- Omega phase transitions
- Boss control resistance
- Black Cortege eligibility and level-300 damage cap
- ZIP integrity and absence of admin strings/local URLs

## Remaining external acceptance tests

Before clicking Publish in Yandex Games, manually verify in the platform draft:

1. Rewarded ad completed, closed early, and error cases
2. Fullscreen ad after a run
3. Purchase, cancellation, and restoration of `void_wraith`
4. On the purchased Wraith: phase blink with echo clone, soul devouring/shatter FX, and the guaranteed epic+ on the first two level-ups
5. Price/currency shown on the purchase button flip to the debug currency mock (TST/¥) — §1.13.2
6. Cloud high score and `highscore` leaderboard
7. Android browser and iPhone Safari touch controls
8. One clean run through wave 50 and Omega

Do not add more large systems before release. Future changes should be limited to reproducible bug fixes and measured balance adjustments.

## Premium ship rebalance — 2026-08-26

Owner request: the premium «Призрак «Немезида»» (`void_wraith`) had to feel premium, not like a slightly buffed version of a free build. It previously had the lowest hull of all five ships (85 HP) and an identity made entirely of perks that free upgrades already granted. Implemented kit:

- **No longer the weakest hull**: HP 85 → 100, shield 18 → 35 (Void Shield, 1.8× regen), fire rate 11 → 10, damage 1.35 → 1.25 per bolt with **twin homing bolts** (±7 px offset, 0.12 lateral velocity), homing strength 0.065 → 0.07, pierce +1, speed 5.9 kept.
- **Пожирание Бездны (soul devouring)**: enemies finished within **220 px** are devoured — 1 soul (elites 2, bosses 5), cap 20. Each soul: +1.5% damage on every bolt and +0.4% speed; a soul decays after 10 s without a kill. Suck-in particles + purple shatter shards + floating «+N ДУША» feedback; the tactical nuke feeds souls too (`devourSoul` is exported for it).
- **Фаза Бездны (void phase)** — after two playtest rounds the teleport was removed entirely (owner: relocations only disorient and hinder). The phase now opens **in place**: 2 s of invulnerability + glow, while a fading **echo clone behind the ship keeps firing 80%-damage bolts for the whole window**. The first window opens 3 s into the run, not on the spawn frame. Dedicated WebAudio SFX (`playVoidBlink`).
- **Quality-tier-aware FX**: suck/shards/materialize particles use the same tier budget as `makeBurst` (×0.34/×0.65/×1); the echo body degrades to a plain glow on Low, double-exposure ghosting and the phase vignette/gradient drop off on Low/Medium per render tier, side trail wisps are skipped on Low.
- **Render sprite cache (2026-08-28 perf fix)**: playtesting showed the Wraith tanking FPS — `shadowBlur` (the most expensive Canvas2D op) fired up to ~40× per frame for the ship alone (echo clone + phased double-exposure ghosts + main hull) plus a live gradient + shadowBlur(12) for **every** homing bolt, and the Wraith fields ~2× the bullets for ~2× as long. `renderer.ts` now bakes the glow into offscreen sprites once and blits them: wraith hull variants (idle/phased) + pulsing core glow, player and enemy bullet sprites keyed by color/size/tier (supersampled 2×, rotated on blit), and the phase vignette baked at max alpha and blitted with a scaled `globalAlpha` (compositing is linear in source alpha, so the result is pixel-identical). Visuals unchanged; the per-frame shadowBlur/gradient count for the Wraith drops from ~40+bullets to ~4 blits + bullet blits.
- **Sprite-cache freeze fix (2026-08-29, playtest catch)**: the first cache version cleared the whole map when it hit 128 entries — but enemy bullets alone need ~112 keys per quality tier (16 colors × 7 sizes), so mid-run the cache thrashed: clear → re-bake ~100 glow sprites → repeat every frame → the game read as frozen. Now: limit 512 with oldest-quarter eviction (Map insertion order), **no** clear on tier switch (tier is part of the key), bullet sizes clamped to finite values (a NaN size would build a NaN gradient — a throwing op in browsers that kills the rAF loop), and canvas dimensions guarded against non-finite/oversized values. A headless smoke test (`test/renderer.smoke.test.mts`) exercises all wraith render paths, the full enemy bullet matrix across tier flips (asserting the cache stays bounded) and pathological sizes.
- **Premium build path**: the Wraith's first two level-ups (player levels 2–3) always include at least one epic/legendary pick — the rarity level gate is bypassed for this guarantee only (`rollPremiumUpgradeChoices`, used for initial rolls and rerolls). Void-themed upgrades (incl. all «Сердце Бездны» synergy pieces) are weighted ×2 for the Wraith. The run starts with «Фазовый сдвиг» pre-researched and a materialize burst on spawn.
- **Adaptive difficulty** counts the kit (power +8 for the class, +0.4 per soul) so late waves still scale against it.
- **Presentation**: unique wraith silhouette (blade hull, membrane wings, pulsing void core, two side plasma wisps) replacing the shared fighter triangle; idle phase shimmer.

Verified with a 27-check simulation smoke test (all five ship stats, twin-bolt + echo fire, devouring on both kill paths, phase cycle/echo expiry, soul decay, 300-roll premium guarantee, 3000-frame no-NaN sim).

## Store-compliance fixes — 2026-08-25

- The purchase CTA now renders the numeric price and the portal currency (name + icon) from `payments.getCatalog()` instead of hardcoded text (Game Requirements §1.13.2, §1.13.4 — passes the debug currency-mock test).
- The purchase is hidden entirely when the console product is absent or inactive, so the in-game list always matches the developer console (§1.13, catalog parity).
- Payments initialize once lazily (`ensurePayments`), so concurrent startup calls share a single `getPayments()` request.

Downloading the release archive: the latest production ZIP is tracked in the repository root. Direct raw link on `main`:
`https://raw.githubusercontent.com/Gamegui/Space-Game/main/space-shooter-yandex.zip`
Rebuild before publishing with `npm run package:yandex`, commit the refreshed ZIP, and the same link always serves the newest archive.

## Release-readiness audit + LoadingAPI.ready() fix — 2026-08-28

Owner request: full pre-release audit against the Yandex Games Game Requirements,
plus a mechanics correctness check, then a pull request.

**Что изменено** — `src/platform/yandex.ts`:
- `markReady()` is invoked from the React game-loop `useEffect` (Effect B), which
  runs before `yandex.init()` (Effect A, async, not awaited) has resolved. The
  previous implementation called `this.sdk?.features?.LoadingAPI?.ready()`
  synchronously, so on first mount `this.sdk` was still `null` and the call was a
  no-op. `LoadingAPI.ready()` was therefore not fired until the game-loop effect
  re-ran (deps `bossName`/`hiscore` change — i.e. wave 5 boss or death), so the
  Yandex loading splash stayed visible through the menu and early gameplay.
  This violates Game Requirements §1.23.2 ("в момент, когда пользователь уже может
  приступить к игре, вызывается LoadingAPI.ready()").
- Fix: added `readyRequested` + `readySent` flags and a `flushReady()` helper.
  `markReady()` now sets `readyRequested = true` and flushes if the SDK is already
  ready; `init()` calls `flushReady()` once `this.sdk` is assigned and the player
  is fetched. Result: `LoadingAPI.ready()` fires exactly once, as soon as both the
  canvas/loop and the SDK are ready, regardless of effect ordering. Duplicate
  calls on later game-loop effect re-runs are suppressed by `readySent`.
- Refreshed `space-shooter-yandex.zip` via `npm run package:yandex` (single
  `index.html` at the archive root, fix present in the inlined bundle).

**Почему** — release blocker: without the call the platform never hides its
splash and moderation fails §1.23.2.

**Как проверено** — `npm run typecheck` (clean), `npm run build` (clean), a
Node logic test (`test_ready.mjs`, not committed) that mocks `window.YaGames`
  with a deferred `init()` and asserts: `markReady()` before resolve → no-op
  immediately, then `ready()` fires once after `init()` resolves, and a second
  `markReady()` does not double-fire. Test result: PASS. A local-browser smoke
  test of the deployed build confirmed the full gameplay loop
  (menu → ship select → tutorial → gameplay → level-up/upgrade → death screen)
  with zero console errors and no visual/text defects.

**Yandex compliance checklist re-verified** (docs yandex.ru/dev/games/doc/ru):
- SDK loaded via relative `<script src="/sdk.js">` in `index.html` head
  (recommended path for archive upload; the legacy `https://yandex.ru/games/sdk/v2`
  is not used). SDK script is synchronous and precedes the module bundle, so
  `window.YaGames` exists before `YaGames.init()`.
- `LoadingAPI.ready()` — fixed (see above).
- `GameplayAPI.start/stop` — driven by phase changes (`setGameplay(phase === "playing")`)
  plus `stop()` on blur/visibility loss, death, and before ads; `start()` resumes
  when phase returns to `playing` (incl. after revive). §1.23.3.
- Rewarded ads: reward applied only when `onRewarded` fired (the `rewarded` flag);
  closing early yields no reward. §реклама п.5.
- Interstitial only on return-to-menu (a logical pause) with a 180 s cooldown. §п.4.
- Sound + gameplay paused before fullscreen/rewarded ads (`audio.suspend()` +
  `setGameplay(false)`). §п.9.
- Focus loss: `blur`/`visibilitychange` suspend audio, stop gameplay, clear keys. §звук/фокус.
- Payments via SDK only (`getCatalog`/`getPurchases`/`purchase`); purchase CTA
  hidden when the console product is absent/inactive (catalog parity). §1.5/§1.13.
- No third-party ad code, no custom RTB banners; monetization is SDK-only.

**Remaining external acceptance** — unchanged: the items in the
"Remaining external acceptance tests" section must still be verified in the
Yandex Games draft (real ads, real purchase, leaderboard, cloud score, mobile
touch).

## Final release handoff — 2026-08-24

The release title is exactly `Космический Штурм: Ультра` everywhere: in the game UI, page title, metadata, README, handoff notes, and the Yandex Games draft. The latest archive is `space-shooter-yandex.zip` in the repository root.

The focus-loss handling was hardened: browser `blur` now suspends audio, pauses active combat, and clears pressed keys. This addresses the Yandex Games requirement that sound stop when the game loses focus.

The Yandex Games archive is ready for upload. Do not add RСЯ/RTB advertising code or custom banners: the game monetizes only through Yandex Games SDK advertising. The RСЯ partner notification about creating an RTB block is for an external website and is not needed for this game.

Before future changes, preserve the exact title and the Yandex console identifiers:
- Russian title: `Космический Штурм: Ультра`
- Leaderboard: `highscore`
- Permanent purchase: `void_wraith`

Next-chat note: treat this as the final release state unless the user reports a concrete moderation or gameplay issue. If asked to provide the build, use the latest `space-shooter-yandex.zip`; if asked about Yandex ads, explain the distinction between Yandex Games SDK ads and external RСЯ/RTB website blocks.

## v1.5.0 — Engagement overhaul — 2026-08-28

Merged PR #7 (`fix/loading-api-ready-timing`) into `main` first, then branched
`feature/v1.5.0-engagement-overhaul`. Version bumped to `1.5.0`.

### New systems (all cloud-saved via Yandex Player Data, key `meta_v1`)

1. **Meta-progression — «Осколки ядра» + Ангар.** Every run earns permanent
   shards (formula: `min(500, floor(score/1000 + wave*3 + kills*0.1 +
   victory?60:0))`, doubled by the `premium_pass` product, +10%/level from the
   `shard_magnet` meta upgrade). Balance targets: early death ≈ 7–15 shards,
   wave 10–15 run ≈ 50–90, wave 30 run ≈ 150–250, wave-50 victory ≈ 350–450 —
   the full Hangar max-out costs ~4.6k shards, so the whole curve takes many
   runs (regression-tested in `test/meta.test.mts`). Spent in the Hangar
   (`src/game/meta.ts`) on 9 permanent
   upgrades (HP, shield, magnet, free rerolls, damage, homing, starting
   upgrade, shard bonus, nuke charges). State is cloud-saved + localStorage
   fallback; corrupted saves normalize to defaults.
2. **Weapon/upgrade evolutions** (`src/game/evolutions.ts`): 7 super-synergies
   that fire once per run when a build owns all required upgrades (e.g.
   «АННИГИЛЯТОР» = double_shot + piercing + explosive). Announced in the
   upgrade panel like synergies.
3. **Missions/achievements**: 24 missions tracking cumulative + per-run goals,
   with shard rewards claimed in the Hangar.
4. **New in-app purchases** (`src/game/products.ts`): `premium_pass` (x2 shards
   +1 free reroll) and `starter_pack` (+1 banish, +25 starting shield).
   Catalog-parity preserved: products hidden from purchase UI when
   absent from the console. The existing `void_wraith` ship purchase is
   unchanged.
5. **«Торговец осколков»** event on the route screen (~50% chance, needs 30+
   shards): a meta-currency sink trading permanent shards for a temporary
   in-run buff (risk: currency spent even on a failed run).
6. **Combo escalation juice**: banner at combo milestones 10/25/50
   («РАЗГОН!» / «ЯРОСТНЫЙ ШКВАЛ!» / «АПОКАЛИПСИС!»).
7. **Cloud save**: `yandex.loadData`/`saveData` added for arbitrary Player Data
   (flushed immediately — run results must survive an instant quit).

### Run finalization semantics (review fixes on top of PR #8)
- `applyRunResult(state, run)` in `src/game/meta.ts` folds a finished run into
  the meta state (totals, shards, missions) **purely** — it never mutates its
  input, which is what makes the revive rollback safe.
- **Death screen** finalizes immediately for instant shard feedback, keeping a
  pre-finalize snapshot. If the player then uses the rewarded-video revive
  («ЭКСТРЕННЫЙ РЕМОНТ»), the death finalization is rolled back to the snapshot
  and the run is re-opened — it is awarded once, in full, when it truly ends.
  This also fixes the «Без передышки» mission, which previously completed on
  runs that were later revived.
- **Victory finalization is never rolled back**: endless mode continues on top
  of the already-awarded victory, and dying in endless does not re-award.
- **Quitting to the main menu from the pause screen** finalizes the run
  (shards/totals/missions are kept — the time invested always pays out).

### Verification
- `npm test` — 14 Node logic tests (`test/meta.test.mts` via the `tsx`
  devDependency): economy scaling, meta apply-to-player, shard multiplier,
  mission tracking + claim, save normalization, evolution single-trigger, run
  finalization purity + revive-rollback equivalence.
- `tsc --noEmit` clean (covers `src` **and** `test`). `npm run build` +
  `npm run package:yandex` clean; ZIP is a single root `index.html`.

### Yandex console products to create (ids must match exactly)
- `void_wraith` (existing), `premium_pass` (new), `starter_pack` (new).
All are **permanent** (non-consumable). If a product is not created/active in
the console, the game hides its purchase CTA automatically (catalog parity,
Game Requirements §1.13).

### Remaining external acceptance (unchanged + new)
- Verify real rewarded/interstitial ads, real purchases (incl. the two new
  products), leaderboard `highscore`, cloud score + cloud meta state, mobile
  touch — all in the Yandex Games draft before publishing.

## v1.6.0 — Точечная переработка улучшений и премиум-корабля — 2026-08-29

По ТЗ «Оптимизация и улучшение системы предметов»: без смены геймплея, только
точечные исправления слабых мест. Все 7 обязательных и 6 рекомендуемых пунктов.

### Исправление несоответствий описаний (§3.5, §3.1–3.2)
- **Конденсатор щита**: отдельная характеристика `shieldRegenMultiplier`
  (+25%/уровень) + мгновенный ремонт 25 HP — реализация теперь равна описанию;
  предмет не предлагается в пуле без щита.
- **Форсажные двигатели vs Турбодвигатель**: Форсаж — стабильные +15% (Common),
  Турбодвигатель (Rare, +25%/уровень) получил роль «разгонной» версии: после
  1 с непрерывного движения ещё +10%, полная остановка сбрасывает. Глобальный
  кап скорости поднят 8.5 → 10.5, чтобы полный стек мобильности работал.

### Баланс (§3.3–3.9)
- **Широкий сектор**: кап собственного разброса 85°; чётные уровни сужают
  разброс крайних снарядов на 10% (`spreadTighten`, полная окружность
  круговых билдов не тронута).
- **Силовое ядро**: ступенчатая шкала — уровни 1–4 ×1.18, 5–8 ×1.12
  (полный стек ×3.05 вместо ×4.3). Полный атакующий стек (~×49) остаётся
  ограничен капом 75 — порядок модификаторов не менялся, только кривая.
- **Ускоритель плазмы**: +10% дальности полёта за уровень (снаряды получили
  `life`; базовой дальности хватает на несколько экранов — выгоду получают
  наводящиеся снаряды).
- **Магнитный гравизахват**: +70 радиуса и +10% скорости притяжения за уровень.
- Легендарки и overload-волна не тронуты (волна и так масштабируется от
  `bulletDamage`).

### Оптимизация (§3.9–3.10, §11)
- **Пробитие**: снаряд хранит `WeakSet` поражённых целей — одна цель не
  получает урон дважды (раньше перекрытие на несколько кадров сжигало заряды
  pierce и раз за разом било по щиту).
- **Самонаведение**: снаряд удерживает цель и доводится плавно каждый кадр;
  полный поиск выполняется только при смерти/выходе цели из радиуса плюс
  редкий refresh (36 кадров). Кап силы наведения 0.15 закреплён в applyUpgrade.

### Немезида (§7–10): усиление без ослабления
- Всё сохранено: души, фаза, эхо, двойные болты, Щит Бездны, Epic+ гейт.
- **Фаза кормит**: в Фазе Бездны радиус пожирания ×1.5 и 40% шанс
  дополнительной души (взаимодействие существующих механик).
- **Обратная связь**: «УРОН УВЕЛИЧЕН» на порогах 25/50/75%, «БЕЗДНА НАСЫЩЕНА»
  на максимуме; свечение ядра и длина следа растут с насыщением душ; при
  входе в фазу корпус кратко «исчезает» и проявляется; эхо перерисовано
  бледно-циановым силуэтом (визуально отличается от корабля); след в фазе
  длиннее и ярче.
- **2 эксклюзивные синергии** (`shipClass`-гейт в SynergyDef):
  «ГОЛОД БЕЗДНЫ» (Вампирический контур + Аура аннигиляции: 15% лечение 2 HP,
  25% дополнительная душа за убийство) и «ПРИЗРАЧНЫЙ АРСЕНАЛ» (Фазовый разряд
  + Самонаведение + Сингулярные снаряды: в фазе снаряды +15% скорости и
  вспыхивают призрачным светом).
- Индикаторы прогресса эволюций в панели выбора («ЭВОЛЮЦИЯ 2/3» /
  «ЗАПУСКАЕТ ЭВОЛЮЦИЮ») — к существующим индикаторам синергий.

### Тесты
29 тестов (было 18): новая спецификация переработанных предметов, синергий
Немезиды, капов; прямая проверка «пробитие не бьёт одну цель повторно»;
headless-симуляция поздних волн (билд Немезиды: 60 врагов, максимум эффектов,
600 шагов ≈ 0.7 мс/шаг, бюджеты объектов соблюдены).

## v1.6.1 — Критическая оптимизация частиц (анти-фриз) — 2026-08-29

### Найденный источник зависания (ТЗ §3)
Взрывные снаряды: **каждая смерть** вызывала `explodeArea`, который создавал
**по 5 частиц на каждого врага в радиусе** → при массовой гибели 30 врагов
с радиусом 220 px это до 6000 частиц (≈18k аллокаций) в одном кадре →
GC-фриз. Бюджет 550 обрезался только ПОСЛЕ создания.

### Система частиц: пул + жёсткие лимиты (gameLoop.ts)
- **Глобальные лимиты** `PARTICLE_LIMITS`: Low 300 / Medium 600 / High 1000.
  При достижении лимита новые декоративные частицы НЕ создаются — игровая
  логика (смерть, опыт, души, урон взрывов) работает как обычно.
- **Лимит создания за кадр**: 80 (`MAX_PARTICLE_SPAWN_PER_FRAME`).
- **Лимит на одного врага** (§5): обычный ≤8, элитный ≤16, босс ≤40 частиц
  смерти (+ осколки Бездны ≤5/12, души ≤8/12) — зрелищность размером и
  яркостью, а не количеством.
- **Particle Pool**: смерть частицы = возврат в пул (кап 1000), а не мусор;
  страховочная обрезка тоже возвращает объекты в пул.
- **Адаптивная доля** (§9): нагрузка <30% лимита → 100% частиц, 30–60% → 75%,
  60–85% → 50%, 85–100% → 25%, на лимите → 0; у смерти врага гарантированный
  минимум (2 частицы), пока есть свободный лимит — враги не исчезают бесследно.
- **explodeArea** (§10/§11): урон по-прежнему всем врагам в радиусе, но
  визуал — ОДИН эффект (кольцо + искры, visualScale 0.5 для смертельных
  взрывов) вместо 5 частиц на каждого задетого. Квадратичный каскад устранён.
- **FPS-контроллер** (§13, существующий): шаг за шагом меняет quality tier
  (окно 2 с, fps < 43 — минус один тир; апгрейд после 4 здоровых окон) —
  теперь он автоматически управляет и бюджетом частиц (bindParticleFrame
  каждый кадр), плюс межтировая адаптивная доля.
- **Отладочные счётчики** (§15.12): `particleDebugStats()` — активные/пул/
  создано за кадр/лимит; выведены в админ-панель (ЧАСТИЦЫ: N/лимит · ПУЛ · +N/кадр).

### Немезида (§12)
Все механики сохранены: души (визуал с гарантированным минимумом), фаза,
эхо, двойные болты. Постоянное свечение (ядро, след, виньетка) рисуется
спрайтами без создания сущностей (v1.6.0).

### Стресс-тесты (§14) — test/perf.smoke.test.mts
- Каскадный сценарий (взрывы + цепная детонация + плотная толпа 60 врагов):
  макс. 296/1000 частиц, 80/80 за кадр, пул 435, 0.71 мс/шаг, убийства и
  опыт идут при исчерпанных лимитах.
- Максимальный multishot + пробитие (омни + death_ray + молнии): 1.66 мс/шаг.
- Поздние волны с максимумом эффектов: 0.63 мс/шаг.
- Жёсткие ассерты в каждом кадре: active ≤ лимита, spawnedThisFrame ≤ 80,
  пул пополняется, снаряды ограничены дальностью.

## v1.6.2 — Рендер-путь массовых взрывов: конец фризам — 2026-08-29

Плейтест v1.6.1 показал: лимиты **создания** частиц работали, но фриз оставался —
он жил в **отрисовке**: живой `shadowBlur` (стоимость растёт квадратично от
радиуса) выполнялся для каждой сущности каждый кадр. При массовом взрыве:
до 1000 частиц × blur 8 + 220 сфер опыта × (градиент + blur 8) + 80 врагов ×
blur 12–25 (без гейта по тирам!) + 60 взрывов × blur 30 + молнии/мины/бонусы
+ 3 полноэкранных градиента фона = сотни мс на кадр.

Исправления (renderer.ts):
- **Частицы**: свечение запечено в спрайты по цвету (`particleSprites`),
  отрисовка — один `drawImage` с масштабом/альфой вместо blur-заливки.
- **Сферы опыта**: одна запечённая сфера + масштаб пульса вместо живого
  градиента + blur на каждую из 220.
- **Враги**: blur 25/18/12 → тиры: High 14/10/6, Medium 5/4/2, Low 0
  (раньше даже Low платил полный blur).
- **Взрывы**: убран blur 30 (градиент сам — свечение), **молнии**: 12 → 6/0,
  **мины**: 10 → 5/0, **бонусы**: 12 → 6/0, **тексты урона**: без тени
  (криты — 6 на High).
- **Фон**: туманность запечена один раз (было — 3 полноэкранных градиента
  и заливки каждый кадр), дрейф — смещением блита.

Smoke-тест рендера расширен: 1000 частиц всех форм/цветов + 220 сфер +
60 взрывов + 90 молний на трёх тирах без исключений, кэш ограничен.
32/32 теста, tsc чисто, ZIP пересобран.

## v1.6.3 — Анти-GC: пулы игровых объектов — 2026-08-29

Перф-лог локальной диагностической сборки (спасибо владельцу!) наконец показал
истину: **колбэк игры стоит 0.8–2.4 мс** (сим ≤0.9, отрисовка ≤1.5, все слои —
доли миллисекунды), лимиты частиц работают (893/1000, +0/кадр), а фриз — это
**LONGTASK 3620 мс ВНЕ игрового колбэка** сразу после массового боя + регулярные
~90 мс паузы между кадрами. Почерк major GC после аллокационной бури.

### Что сделано
- **Пул пуль** (главный churn: 400+ живых объектов, десятки создаётся/умирает
  каждый кадр): acquire/release, поля копируются в переиспользуемый объект
  вместе с его pos/vel — ноль аллокаций после прогрева. Все 21 однострочных
  литерала вражеских пуль трансформированы в `spawnEnemyBullet`, спутники/
  дроны/осколки — в `spawnPlayerSideBullet`, `makePlayerBullet` — через пул.
- **hitList вместо WeakSet**: массив поражённых целей (pierce ≤ 12, линейная
  проверка) — без GC-тяжёлых WeakSet на каждую пробивающую пулю.
- **Пулы плавающих текстов, сфер опыта и молний** — создание через пул,
  освобождение во всех точках смерти (жизнь, сбор, трим бюджета).
- Ссылки на врагов (target/hitList) обнуляются при возврате в пул — пул не
  удерживает мёртвых врагов.
- Перф-лог теперь показывает и размеры пулов (`пулы(пули/тексты/сферы/молнии)`).

Диагностическая сборка пересобрана (VITE_ADMIN + VITE_PERF), релизный ZIP —
без диагностического кода. 32/32 теста, tsc чисто.

## v1.7.0 — МИФИЧЕСКИЙ ТИР (Mythic Tier) — 2026-08-29

Новая высшая редкость выше Legendary. Выпадение — отдельное игровое событие:
остановка момента → вспышка → заголовок → карточка → выбор, с торжественной
музыкой и приглушением фоновой. Мифик меняет правила игры, а не даёт «+500%».

### Правила выпадения
- `rollMythicDrop` (src/game/mythics.ts): ~0.5% на левел-ап после 8-го уровня,
  максимум 2 за забег, часть мификов требует собранного билда
  (MYTHIC_REQUIREMENTS). При ~50 уровнях за забег шанс увидеть мифик ≈ 22%.
- Мифики НИКОГДА не входят в обычный пул выбора (фильтр по rarity).
- При выпадении панель улучшений заменяется компонентом MythicReveal;
  отказ показывает обычные карточки этого уровня.

### Событие (MythicReveal.tsx + audio.ts)
- Этапы: затемнение (0.35 c) → белая вспышка → заголовок «✦ МИФИЧЕСКОЕ
  УЛУЧШЕНИЕ ✦» → карточка с анимированной золотой рамкой и CSS-частицами.
  Вся анимация — чистый CSS (ноль canvas-частиц, лимиты не затрагиваются).
- Звуки: playMythicSting (~2.6 c: удар → подъём → аккорд → финал, музыка
  приглушается и плавно возвращается), playMythicCard (арпеджио),
  playMythicSelect (мощный удар + аккорд).
- Баннер «✦ MYTHIC ACQUIRED ✦» с названием и описанием силы (4 c).
- «Немезида»: фиолетовый оттенок лучей/свечения (только визуал, ТЗ §12).

### Шесть мификов (gameLoop.ts)
1. ☀️ **Звёздный Пожиратель** — убийства копят Звёздное Ядро (0/100:
   обычный +1, элита +5, гвардия +10, босс +25); на полном заряде фитиль 0.75 c
   → СВЕРХНОВАЯ: обычные гибнут, элиты/гвардия ×25 урона, боссы 6% макс. HP.
   Заряд — счётчик, свечение на корпусе растёт по 25/50/75/100%.
2. 🌌 **Пожиратель Звёзд** — убийства копят Коллапс (0/50) → сингулярность
   (одна активная, 4 c): нарастающее притяжение (боссы 0.25×, элиты 0.5×),
   поглощение снарядов игрока → COLLAPSE с накопленным уроном (боссам ≤ 8%).
3. ⚡ **Судный Разряд** — криты копят Гнев Бури (0/10); десятый крит → цепь
   до 16 целей, радиус 320, без повторов, +5% за уничтожение (до +50%).
4. 🔥 **Абсолютный Реактор** — непрерывная стрельба копит Перегрузку (0–100%);
   100% → 5 c OVERDRIVE (×0.55 интервал, ×1.25 скорость снарядов), убийства
   продлевают (+0.15 c, потолок 10 c), затем 5 c остывания. Мин. интервал 2.
5. 🛰️ **Последний Флот** — FLEET LINK: помощники бьют по общей приоритетной
   цели (босс > гвардия > элита > ближайший); их атаки копят канал (0/100) →
   FINAL FLEET SALVO: вся армада стреляет в 6.5× темпе, +50% урона,
   накопления эффективности (до 10). Новых сущностей не создаётся.
6. 👁️ **Конец Материи** — бой копит Энтропию (0/100) → 4 c Пустоты: враги
   замедлены (обычные 0.45×, элиты 0.7×, боссы 0.9×) и уязвимы (+25%),
   снаряды +2 пробития; убитые оставляют разрывы-порталы (макс. 8, 3 c),
   снаряд телепортируется между разрывами (макс. 2 прыжка).

### UI
- HUD: компактные шкалы мифических сил (заряд/максимум, пороговое свечение).
- Панель билда: отдельный блок «МИФИЧЕСКИЕ СИЛЫ · N» с золотой рамкой.
- Карточка в панели (если попала туда): rarity mythic — золотой градиент.
- Админка: кнопка «✦ ДАТЬ МИФИК» для тестов.

### Оптимизация (§17)
Все эффекты — счётчики + один крупный визуал (кольцо + бюджетный залп через
makeBurst с minKeep). Сингулярность и разрывы — векторная отрисовка без
частиц. CSS-анимации события не касаются canvas. Стресс-тест: все 6 мификов +
максимальный билд + 60 врагов = 0.69 мс/шаг, лимиты частиц соблюдены.

Тесты: 42/42 (гейты, статистика шанса, отсутствие в пуле, механика каждого
мифика, стресс). tsc чисто.
