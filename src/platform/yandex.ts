// Lightweight, dependency-free integration with the Yandex Games SDK.
// Every method safely becomes a no-op outside Yandex, so local development works normally.

type AdCallbacks = {
  onOpen?: () => void;
  onClose?: (wasShown?: boolean) => void;
  onError?: (error: unknown) => void;
  onRewarded?: () => void;
};

type YandexPlayer = {
  getMode?: () => string;
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
  getPlayer?: (options?: { scopes?: boolean }) => Promise<YandexPlayer>;
  getPayments?: (options?: { signed?: boolean }) => Promise<YandexPayments>;
  getLeaderboards?: () => Promise<{ setLeaderboardScore: (name: string, score: number) => Promise<void> }>;
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
  // The React canvas/game-loop calls markReady() before this.sdk is necessarily
  // initialised (init() is async). Queue the call and flush it once the SDK is
  // ready, so LoadingAPI.ready() fires as soon as the game can be played and
  // Yandex hides its loading splash (Game Requirements §1.23.2). readySent
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
        try { this.player = await this.sdk.getPlayer?.({ scopes: false }) ?? null; } catch { /* guest mode */ }
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
   *  flushed as soon as init() resolves (Game Requirements §1.23.2). */
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
    try { await this.player?.setData?.({ highScore: Math.max(0, Math.floor(score)) }, true); } catch { /* local score remains available */ }
    try {
      const leaderboards = await this.sdk?.getLeaderboards?.();
      await leaderboards?.setLeaderboardScore("highscore", Math.max(0, Math.floor(score)));
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

  async hasPermanentPurchase(productId: string): Promise<boolean> {
    await this.init();
    try {
      const payments = await this.ensurePayments();
      const purchases = await payments?.getPurchases();
      return Array.isArray(purchases) && purchases.some(purchase => purchase.productID === productId);
    } catch { return false; }
  }

  /** Returns the active console catalog entry for a product, or null when the
   *  product is missing/inactive — in that case the game must not display the
   *  purchase at all (Game Requirements §1.13, list must match the console). */
  async getCatalogOffer(productId: string): Promise<StoreOffer | null> {
    await this.init();
    try {
      const payments = await this.ensurePayments();
      const catalog = await payments?.getCatalog?.();
      if (!Array.isArray(catalog)) return null;
      const product = catalog.find(entry => entry?.id === productId);
      if (!product) return null;
      let currencyIconUrl: string | null = null;
      try { currencyIconUrl = product.getPriceCurrencyImage?.("medium") ?? null; } catch { /* text-only fallback */ }
      return {
        id: product.id,
        title: product.title ?? "",
        price: product.price ?? "",
        currencyCode: product.priceCurrencyCode ?? "",
        currencyIconUrl,
      };
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
    this.lastInterstitial = now;
    this.setGameplay(false);
    onPause();
    try {
      this.sdk.adv.showFullscreenAdv({ callbacks: {
        onOpen: onPause,
        onClose: () => { onResume(); },
        onError: () => { onResume(); },
      }});
    } catch { onResume(); }
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
}

export const yandex = new YandexPlatform();
