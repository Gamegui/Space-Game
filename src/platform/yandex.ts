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

type YandexSDK = {
  features?: { LoadingAPI?: { ready: () => void }; GameplayAPI?: { start: () => void; stop: () => void } };
  adv?: {
    showFullscreenAdv: (options: { callbacks: AdCallbacks }) => void;
    showRewardedVideo: (options: { callbacks: AdCallbacks }) => void;
  };
  getPlayer?: (options?: { scopes?: boolean }) => Promise<YandexPlayer>;
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
  private initPromise: Promise<void> | null = null;
  private playing = false;
  private lastInterstitial = 0;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        if (!window.YaGames) return;
        this.sdk = await window.YaGames.init();
        try { this.player = await this.sdk.getPlayer?.({ scopes: false }) ?? null; } catch { /* guest mode */ }
        if (this.playing) {
          try { this.sdk.features?.GameplayAPI?.start(); } catch { /* older SDK */ }
        }
      } catch (error) {
        console.warn("Yandex Games SDK is unavailable:", error);
      } finally {
        // Tell the catalogue that the game is visually ready only after React has mounted.
        try { this.sdk?.features?.LoadingAPI?.ready(); } catch { /* older SDK */ }
      }
    })();
    return this.initPromise;
  }

  isAvailable() {
    return Boolean(this.sdk?.adv);
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
