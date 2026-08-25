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
4. Price/currency shown on the purchase button flip to the debug currency mock (TST/¥) — §1.13.2
5. Cloud high score and `highscore` leaderboard
6. Android browser and iPhone Safari touch controls
7. One clean run through wave 50 and Omega

Do not add more large systems before release. Future changes should be limited to reproducible bug fixes and measured balance adjustments.

## Final release handoff — 2026-08-24

The release title is exactly `Космический Штурм: Ультра` everywhere: in the game UI, page title, metadata, README, handoff notes, and the Yandex Games draft. The latest archive is `space-shooter-yandex.zip` in the repository root.

The focus-loss handling was hardened: browser `blur` now suspends audio, pauses active combat, and clears pressed keys. This addresses the Yandex Games requirement that sound stop when the game loses focus.

The Yandex Games archive is ready for upload. Do not add RСЯ/RTB advertising code or custom banners: the game monetizes only through Yandex Games SDK advertising. The RСЯ partner notification about creating an RTB block is for an external website and is not needed for this game.

Before future changes, preserve the exact title and the Yandex console identifiers:
- Russian title: `Космический Штурм: Ультра`
- Leaderboard: `highscore`
- Permanent purchase: `void_wraith`

Next-chat note: treat this as the final release state unless the user reports a concrete moderation or gameplay issue. If asked to provide the build, use the latest `space-shooter-yandex.zip`; if asked about Yandex ads, explain the distinction between Yandex Games SDK ads and external RСЯ/RTB website blocks.
