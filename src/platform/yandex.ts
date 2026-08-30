// Lightweight, dependency-free integration with the Yandex Games SDK.
// Every method safely becomes a no-op outside Yandex, so local development works normally.

type AdCallbacks = {
  onOpen?: () => void;
  onClose?: (wasShown?: boolean) => void;
  onError?: (error: unknown) => void;
  onRewarded?: () => void;
};

// Deprecated in the current docs (kept only as a fallback): player.getMode()
// is going away, and ysdk.getLeaderboards() is superseded by ysdk.leaderboards.
type YandexPlayer = {
  getData?: (keys?: string[]) => Promise<Record<string, unknown>>;
  setData?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
};

type Purchase = { productID: string; purchaseToken?: string };

type CatalogProduct = {
  id: string;
  title?: string;
  description?: string;
  imageURI?: string;
  price?: string;
  priceValue?: string;
  priceCurrencyCode?: string;
  getPriceCurrencyImage?: (size: "small" | "medium" | "svg") => string;
};

type YandexPayments = {
  getPurchases: () => Promise<Purchase[]>;
  getCatalog: () => Promise<CatalogProduct[]>;
  purchase: (options: { id: string }) => Promise<Purchase>;
};

/** Store data for one active console product. `price` already contains the
 *  numeric price plus the portal currency code (e.g. "75 YAN"), and the icon
 *  URL comes from the SDK, so the moderation currency-mock test flips both
 *  automatically (Game Requirements §1.13.2). */
export type StoreOffer = {
  id: string;
  title: string;
  price: string;
  currencyCode: string;
  currencyIconUrl: string | null;
};

type YandexSDK = {
  environment?: { i18n?: { lang?: string; tld?: string } };
  features?: { LoadingAPI?: { ready: () => void }; GameplayAPI?: { start: () => void; stop: () => void } };
  adv?: {
    showFullscreenAdv: (options: { callbacks: AdCallbacks }) => void;
    showRewardedVideo: (options: { callbacks: AdCallbacks }) => void;
  };
  getPlayer?: () => Promise<YandexPlayer>;
  getPayments?: (options?: { signed?: boolean }) => Promise<YandexPayments>;
  /** Current leaderboards namespace (sdk-leaderboard: ysdk.leaderboards.setScore()). */
  leaderboards?: { setScore?: (name: string, score: number) => Promise<void> };
  /** Deprecated: ysdk.getLeaderboards() — kept as a fallback for older SDK builds. */
  getLeaderboards?: () => Promise<{ setLeaderboardScore: (name: string, score: number) => Promise<void> }>;
  /** Platform lifecycle events (sdk-events: game_api_pause / game_api_resume). */
  on?: (event: string, listener: () => void) => void;
  /** Platform event name constants (sdk-events: the EVENTS enum). */
  EVENTS?: { ACCOUNT_SELECTION_DIALOG_OPENED?: string; ACCOUNT_SELECTION_DIALOG_CLOSED?: string };
  /** Documented availability probe (sdk-leaderboard): leaderboard writes are
   *  only available to authorized players; guests resolve to false. */
  isAvailableMethod?: (method: string) => Promise<boolean>;
};

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YandexSDK> };
  }
}

class YandexPlatform {
  private sdk: YandexSDK | null = null;
  private player: YandexPlayer | null = null;
  private payments: YandexPayments | null = null;
  private paymentsPromise: Promise<YandexPayments | null> | null = null;
  private initPromise: Promise<void> | null = null;
  private playing = false;
  private lastInterstitial = 0;
  private language = "ru";
  // Handlers for platform-initiated pause/resume (sdk-events docs): the
  // platform shows a fullscreen ad automatically at game start and fires these
  // events around ads, the purchase window and tab switches. Games that
  // support them can additionally be distributed to external platforms.
  private platformPauseHandlers = new Set<() => void>();
  private platformResumeHandlers = new Set<() => void>();
  // Account-selection dialog (sdk-events): while it is open, cloud writes are
  // held; when it closes, the Player object is re-fetched (the user may have
  // switched to another account's progress) and the app reloads cloud state.
  private accountSwitchHandlers = new Set<() => void>();
  private accountDialogOpen = false;
  // Player Data write budget (sdk-player limits): setData must stay under
  // 100 requests per 5 minutes and 200 KB total per player. Writes are
  // coalesced per key into one request and flushed at most once per interval,
  // keeping the sustained rate at ~1 per 5s — far below the request limit.
  private pendingSaves = new Map<string, unknown>();
  private lastSaveFlushAt = 0;
  private saveFlushTimer: ReturnType<typeof setTimeout> | null = null;
  // Leaderboard writes are limited to 1 request per second (sdk-leaderboard).
  private lastScoreSentAt = 0;
  private scoreFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingScore: number | null = null;
  private static readonly SAVE_MIN_INTERVAL_MS = 5_000;
  /** Headroom under the documented 200 KB per-player budget. */
  private static readonly SAVE_MAX_BYTES = 180_000;
  // Bumped on every account switch: an in-flight write that belonged to the
  // previous player must never be re-queued (and posted) for the new one.
  private saveGeneration = 0;
  // The React canvas/game-loop calls markReady() before this.sdk is necessarily
  // initialised (init() is async). Queue the call and flush it once the SDK is
  // ready, so LoadingAPI.ready() fires as soon as the game can be played and
  // Yandex hides its loading splash (Game Requirements §1.19.2). readySent
  // guards against duplicate calls when the game-loop effect re-runs.
  private readyRequested = false;
  private readySent = false;

  private flushReady() {
    if (!this.readyRequested || this.readySent || !this.sdk) return;
    try {
      this.sdk.features?.LoadingAPI?.ready();
      this.readySent = true;
    } catch { /* older SDK */ }
  }

  /** Register a handler for the platform pause signal (game_api_pause): the
   *  automatic startup fullscreen ad, ad frames, the purchase window and
   *  tab/window switches. Sound and gameplay must pause (requirements §1.3,
   *  §4.7). Returns an unsubscribe function. */
  onPlatformPause(handler: () => void): () => void {
    this.platformPauseHandlers.add(handler);
    return () => { this.platformPauseHandlers.delete(handler); };
  }

  /** Register a handler for the platform resume signal (game_api_resume).
   *  Keep handlers conservative: gameplay resumes through the game's own UI,
   *  this only needs to restore what a pause handler suspended. */
  onPlatformResume(handler: () => void): () => void {
    this.platformResumeHandlers.add(handler);
    return () => { this.platformResumeHandlers.delete(handler); };
  }

  /** Register a handler fired after the platform account-selection dialog
   *  closed and the Player object was re-fetched — the game should reload
   * its cloud state (sdk-events). Returns an unsubscribe function. */
  onAccountSwitch(handler: () => void): () => void {
    this.accountSwitchHandlers.add(handler);
    return () => { this.accountSwitchHandlers.delete(handler); };
  }

  private subscribePlatformEvents() {
    if (!this.sdk?.on) return; // older SDK builds have no event API
    try {
      this.sdk.on("game_api_pause", () => {
        for (const handler of [...this.platformPauseHandlers]) {
          try { handler(); } catch { /* one handler must not break the rest */ }
        }
      });
      this.sdk.on("game_api_resume", () => {
        for (const handler of [...this.platformResumeHandlers]) {
          try { handler(); } catch { /* one handler must not break the rest */ }
        }
      });
      // Account-selection dialog (sdk-events): the platform offers the player
      // to keep the authorized or the guest progress. Hold cloud sync while
      // the dialog is open; on close re-fetch the Player object — the game
      // must not write the previous account's pending data into the new one.
      const events = this.sdk.EVENTS ?? {};
      const dialogOpened = events.ACCOUNT_SELECTION_DIALOG_OPENED ?? "ACCOUNT_SELECTION_DIALOG_OPENED";
      const dialogClosed = events.ACCOUNT_SELECTION_DIALOG_CLOSED ?? "ACCOUNT_SELECTION_DIALOG_CLOSED";
      this.sdk.on(dialogOpened, () => { this.accountDialogOpen = true; });
      this.sdk.on(dialogClosed, () => {
        this.accountDialogOpen = false;
        void this.handleAccountSwitch();
      });
    } catch { /* older SDK */ }
  }

  /** Re-read the player after the account-selection dialog closed: queued
   *  writes from the previous account are dropped, then the app reloads its
   *  cloud state (meta, hi-score, purchases) for the newly selected player. */
  private async handleAccountSwitch() {
    try { this.player = (await this.sdk?.getPlayer?.()) ?? null; } catch { this.player = null; }
    this.saveGeneration += 1;
    this.pendingSaves.clear();
    if (this.saveFlushTimer !== null) {
      clearTimeout(this.saveFlushTimer);
      this.saveFlushTimer = null;
    }
    this.lastSaveFlushAt = 0;
    // A queued leaderboard score belonged to the previous player too.
    this.pendingScore = null;
    if (this.scoreFlushTimer !== null) {
      clearTimeout(this.scoreFlushTimer);
      this.scoreFlushTimer = null;
    }
    for (const handler of [...this.accountSwitchHandlers]) {
      try { handler(); } catch { /* one handler must not break the rest */ }
    }
  }

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        if (!window.YaGames) return;
        this.sdk = await window.YaGames.init();
        // The current release has one moderated locale: Russian. We still take the
        // requested locale from the SDK and apply a documented Russian fallback.
        const supportedLanguages = ["ru"];
        const requestedLanguage = this.sdk.environment?.i18n?.lang?.toLowerCase().split("-")[0];
        this.language = supportedLanguages.find(language => language === requestedLanguage) ?? supportedLanguages[0];
        document.documentElement.lang = this.language;
        try { this.player = await this.sdk.getPlayer?.() ?? null; } catch { /* guest mode */ }
        // Platform lifecycle events (automatic startup ad, purchase window).
        this.subscribePlatformEvents();
        if (this.playing) {
          try { this.sdk.features?.GameplayAPI?.start(); } catch { /* older SDK */ }
        }
        // The game canvas/loop may have signalled readiness before the SDK
        // finished initialising — fire it now, in order.
        this.flushReady();
      } catch (error) {
        console.warn("Yandex Games SDK is unavailable:", error);
      }
    })();
    return this.initPromise;
  }

  /** Call once the game canvas and loop are fully initialised. Safe to call
   *  before the SDK has finished initialising — the call is queued and
   *  flushed as soon as init() resolves (Game Requirements §1.19.2). */
  markReady() {
    this.readyRequested = true;
    this.flushReady();
  }

  isAvailable() {
    return Boolean(this.sdk?.adv);
  }

  isPlatformAvailable() {
    return Boolean(this.sdk);
  }

  getLanguage() {
    return this.language;
  }

  setGameplay(active: boolean) {
    if (active === this.playing) return;
    this.playing = active;
    try {
      if (active) this.sdk?.features?.GameplayAPI?.start();
      else this.sdk?.features?.GameplayAPI?.stop();
    } catch { /* API is absent in older SDK versions */ }
  }

  async loadHighScore(): Promise<number | null> {
    await this.init();
    try {
      const data = await this.player?.getData?.(["highScore"]);
      const value = Number(data?.highScore);
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch { return null; }
  }

  async saveHighScore(score: number) {
    await this.init();
    const value = Math.max(0, Math.floor(score));
    // Run results are critical (the player may quit right after the death
    // screen): the player-data write flushes immediately.
    await this.saveData("highScore", value, true);
    this.queueScore(value);
  }

  /** Leaderboard write honouring the documented 1 req/sec limit: a second,
   *  higher score arriving within the window is delayed, not dropped. */
  private queueScore(value: number) {
    const waitMs = this.lastScoreSentAt + 1_100 - Date.now();
    if (waitMs <= 0) {
      this.lastScoreSentAt = Date.now();
      void this.submitScore(value);
      return;
    }
    this.pendingScore = Math.max(this.pendingScore ?? 0, value);
    if (this.scoreFlushTimer === null) {
      this.scoreFlushTimer = setTimeout(() => {
        this.scoreFlushTimer = null;
        const pending = this.pendingScore;
        this.pendingScore = null;
        if (pending !== null) this.queueScore(pending);
      }, waitMs);
    }
  }

  private async submitScore(value: number) {
    try {
      // Documented availability probe: leaderboard writes are allowed for
      // authorized players only; guests resolve false and skip silently.
      if (typeof this.sdk?.isAvailableMethod === "function") {
        if (!(await this.sdk.isAvailableMethod("leaderboards.setScore"))) return;
      }
      // Current API: ysdk.leaderboards.setScore(). The deprecated
      // getLeaderboards() path stays as a fallback for older SDK builds.
      const leaderboards = this.sdk?.leaderboards;
      if (typeof leaderboards?.setScore === "function") {
        await leaderboards.setScore("highscore", value);
      } else {
        const legacy = await this.sdk?.getLeaderboards?.();
        await legacy?.setLeaderboardScore("highscore", value);
      }
    } catch { /* leaderboard may not be configured in the console yet */ }
  }

  /** Lazily preloads the payments module once; concurrent callers share one init. */
  private ensurePayments(): Promise<YandexPayments | null> {
    if (this.payments) return Promise.resolve(this.payments);
    this.paymentsPromise ??= (async () => {
      try {
        this.payments = (await this.sdk?.getPayments?.({ signed: false })) ?? null;
      } catch {
        this.paymentsPromise = null; // allow a retry after a transient failure
      }
      return this.payments;
    })();
    return this.paymentsPromise;
  }

  /** ONE getPurchases() call for every product, retried once after a short
   *  delay: sdk-purchases docs require checking purchases on every launch,
   *  and a transient network failure must not lock a paying player out of a
   *  purchased ship until a full reload. Returns the owned productIDs, or
   *  null when the list could not be fetched (unknown state). */
  async getOwnedProducts(): Promise<string[] | null> {
    await this.init();
    const payments = await this.ensurePayments();
    if (!payments) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const purchases = await payments.getPurchases();
        if (Array.isArray(purchases)) return purchases.map(purchase => purchase.productID);
        return null;
      } catch (err) {
        if (attempt > 0) {
          console.warn("[yandex] getPurchases failed", err);
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1_500));
      }
    }
    return null;
  }

  /** ONE getCatalog() call for every product (Game Requirements §1.13.6,
   *  catalog parity): maps productId → active console offer. Products that
   *  are missing from the map are absent/inactive in the console and must
   *  not be offered in-game. Returns null when the catalog could not be
   *  fetched — callers then hide the purchase UI (the safe direction). */
  async getCatalogOffers(): Promise<Map<string, StoreOffer> | null> {
    await this.init();
    try {
      const payments = await this.ensurePayments();
      const catalog = await payments?.getCatalog?.();
      if (!Array.isArray(catalog)) return null;
      const offers = new Map<string, StoreOffer>();
      for (const product of catalog) {
        if (!product?.id) continue;
        let currencyIconUrl: string | null = null;
        try { currencyIconUrl = product.getPriceCurrencyImage?.("medium") ?? null; } catch { /* text-only fallback */ }
        offers.set(product.id, {
          id: product.id,
          title: product.title ?? "",
          price: product.price ?? "",
          currencyCode: product.priceCurrencyCode ?? "",
          currencyIconUrl,
        });
      }
      return offers;
    } catch { return null; }
  }

  async purchasePermanent(productId: string): Promise<boolean> {
    await this.init();
    try {
      const payments = await this.ensurePayments();
      if (!payments) return false;
      const purchase = await payments.purchase({ id: productId });
      return purchase.productID === productId;
    } catch { return false; }
  }

  showInterstitial(onPause: () => void, onResume: () => void) {
    const now = Date.now();
    if (!this.sdk?.adv || now - this.lastInterstitial < 180_000) {
      onResume();
      return;
    }
    // Docs (sdk-adv): onClose fires when the ad closes, AFTER onError, and
    // when the ad was not shown at all because of the platform frequency cap.
    // The one-shot guard keeps onResume from running twice on those paths.
    let resumed = false;
    const resume = () => {
      if (resumed) return;
      resumed = true;
      onResume();
    };
    this.setGameplay(false);
    onPause();
    try {
      this.sdk.adv.showFullscreenAdv({ callbacks: {
        onOpen: () => {
          // The ad really opened: only now does our 3-minute cooldown apply,
          // so a refused/failed call does not burn the monetisation window.
          this.lastInterstitial = Date.now();
          onPause();
        },
        onClose: resume,
        onError: resume,
      }});
    } catch { resume(); }
  }

  showRewarded(onPause: () => void, onResume: () => void): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.sdk?.adv) { resolve(false); return; }
      let rewarded = false;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        onResume();
        resolve(rewarded);
      };
      this.setGameplay(false);
      onPause();
      try {
        this.sdk.adv.showRewardedVideo({ callbacks: {
          onOpen: onPause,
          onRewarded: () => { rewarded = true; },
          onClose: finish,
          onError: finish,
        }});
      } catch { finish(); }
    });
  }

  // ── Player Data (meta-progression cloud save) ──────────────────────────────
  /** Load arbitrary JSON saved under a key. Returns null on guests/errors. */
  async loadData<T>(key: string): Promise<T | null> {
    await this.init();
    try {
      if (!this.player?.getData) return null;
      const data = await this.player.getData([key]);
      return (data?.[key] as T | undefined) ?? null;
    } catch (err) {
      console.warn("[yandex] loadData failed", err);
      return null;
    }
  }

  /** Save arbitrary JSON under a key (best-effort, non-blocking UI). Writes
   *  are coalesced per key and sent as one setData(flush=true) request at
   *  most once per SAVE_MIN_INTERVAL_MS, honouring the documented Player
   *  Data limits (100 requests / 5 min, 200 KB per player). `critical`
   *  writes (run results, purchases, score) flush immediately — the player
   *  may quit right after the death screen. */
  async saveData(key: string, value: unknown, critical = false): Promise<boolean> {
    await this.init();
    if (!this.player?.setData) return false;
    this.pendingSaves.set(key, value);
    if (critical) return this.flushSaves();
    const sinceLastFlush = Date.now() - this.lastSaveFlushAt;
    if (sinceLastFlush >= YandexPlatform.SAVE_MIN_INTERVAL_MS && !this.accountDialogOpen) {
      return this.flushSaves();
    }
    // Throttled (or the platform account dialog is choosing a save): send the
    // queued batch later. getData() already returns the latest setData payload,
    // so the queue is invisible to readers.
    this.scheduleSaveFlush(Math.max(1_000, YandexPlatform.SAVE_MIN_INTERVAL_MS - sinceLastFlush));
    return true;
  }

  /** Send every queued key in one setData(flush=true) request. A failed batch
   *  is re-queued and retried on the next flush. */
  private async flushSaves(): Promise<boolean> {
    if (this.saveFlushTimer !== null) {
      clearTimeout(this.saveFlushTimer);
      this.saveFlushTimer = null;
    }
    if (this.pendingSaves.size === 0) return true;
    if (this.accountDialogOpen) {
      // Never write while the platform account dialog is choosing a save.
      this.scheduleSaveFlush(YandexPlatform.SAVE_MIN_INTERVAL_MS);
      return false;
    }
    const generation = this.saveGeneration;
    const batch = Object.fromEntries(this.pendingSaves);
    const bytes = new Blob([JSON.stringify(batch)]).size;
    if (bytes > YandexPlatform.SAVE_MAX_BYTES) {
      // 200 KB is the per-player budget (sdk-player) — the platform rejects
      // oversized payloads whole, so warn loudly instead of failing silently.
      console.warn(`[yandex] save payload ${bytes} B exceeds the player-data budget`);
    }
    this.pendingSaves.clear();
    this.lastSaveFlushAt = Date.now();
    try {
      await this.player?.setData?.(batch, true);
      return true;
    } catch (err) {
      console.warn("[yandex] saveData failed", err);
      // Keep the data queued (unless a newer value arrived meanwhile) so a
      // later flush retries it — but never carry a previous account's batch
      // over an account switch.
      if (generation === this.saveGeneration) {
        for (const [k, v] of Object.entries(batch)) {
          if (!this.pendingSaves.has(k)) this.pendingSaves.set(k, v);
        }
        this.scheduleSaveFlush(YandexPlatform.SAVE_MIN_INTERVAL_MS);
      }
      return false;
    }
  }

  private scheduleSaveFlush(delayMs: number) {
    if (this.saveFlushTimer !== null) return;
    this.saveFlushTimer = setTimeout(() => {
      this.saveFlushTimer = null;
      void this.flushSaves();
    }, delayMs);
  }
}

export const yandex = new YandexPlatform();
