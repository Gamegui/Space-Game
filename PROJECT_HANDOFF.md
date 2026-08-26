# Космический Штурм: Ультра — handoff

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
- **Пожирание Бездны (soul devouring)**: enemies finished within 150 px are devoured — 1 soul (elites 2, bosses 5), cap 20. Each soul: +1.5% damage on every bolt and +0.4% speed; a soul decays after 10 s without a kill. Suck-in particles + purple shatter shards on kills.
- **Фазовый блинк (phase blink)**: when the phase window opens the Wraith teleports 200 px (input direction, else nearest enemy, else up) and leaves a fading **echo clone at the origin that keeps firing 80%-damage bolts for the whole 2 s window**. Dedicated WebAudio SFX (`playVoidBlink`). Phase window: full glow, double-exposure ghosting, expanding ring, arena-wide void vignette, HUD «ФАЗА» status.
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

## Final release handoff — 2026-08-24

The release title is exactly `Космический Штурм: Ультра` everywhere: in the game UI, page title, metadata, README, handoff notes, and the Yandex Games draft. The latest archive is `space-shooter-yandex.zip` in the repository root.

The focus-loss handling was hardened: browser `blur` now suspends audio, pauses active combat, and clears pressed keys. This addresses the Yandex Games requirement that sound stop when the game loses focus.

The Yandex Games archive is ready for upload. Do not add RСЯ/RTB advertising code or custom banners: the game monetizes only through Yandex Games SDK advertising. The RСЯ partner notification about creating an RTB block is for an external website and is not needed for this game.

Before future changes, preserve the exact title and the Yandex console identifiers:
- Russian title: `Космический Штурм: Ультра`
- Leaderboard: `highscore`
- Permanent purchase: `void_wraith`

Next-chat note: treat this as the final release state unless the user reports a concrete moderation or gameplay issue. If asked to provide the build, use the latest `space-shooter-yandex.zip`; if asked about Yandex ads, explain the distinction between Yandex Games SDK ads and external RСЯ/RTB website blocks.
