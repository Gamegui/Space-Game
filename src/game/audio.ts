// ─── Web Audio API Procedural Sound Engine ─────────────────────────────────────
// Rich atmospheric space drone synth with soft, balanced, satisfying laser SFX.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isMusicPlaying: boolean = false;
  private musicOscillators: OscillatorNode[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private xpPitchCounter: number = 0;
  private lastXpTime: number = 0;
  private lastShootAt: number = -1;
  private lastHitAt: number = -1;
  private lastExplosionAt: number = -1;

  constructor() {}

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      // Reuse one noise sample for every explosion instead of allocating and
      // filling a new AudioBuffer during combat.
      const noiseLength = Math.floor(this.ctx.sampleRate * 1.25);
      this.noiseBuffer = this.ctx.createBuffer(1, noiseLength, this.ctx.sampleRate);
      const noise = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.26, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      // The old constant five-oscillator drone caused listening fatigue.
      this.musicGain.gain.setValueAtTime(0.085, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    } catch {}
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  public suspend() {
    if (this.ctx && this.ctx.state === "running") {
      void this.ctx.suspend();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMusicVolume(percent: number) {
    this.init();
    if (this.musicGain && this.ctx) this.musicGain.gain.setValueAtTime(0.24 * Math.max(0, Math.min(1, percent / 100)), this.ctx.currentTime);
  }

  public setSfxVolume(percent: number) {
    this.init();
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setValueAtTime(0.48 * Math.max(0, Math.min(1, percent / 100)), this.ctx.currentTime);
  }

  // ─── SFX: Soft, Pleasant Laser Shot (Quiet & non-intrusive) ───────────────────
  public playShoot(sniper = false) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (t - this.lastShootAt < 0.035) return;
    this.lastShootAt = t;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    const pitchVariation = 0.94 + Math.random() * 0.12;
    const startFreq = (sniper ? 880 : 540) * pitchVariation;
    const endFreq = (sniper ? 140 : 180) * pitchVariation;
    const duration = sniper ? 0.12 : 0.06;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, t);

    // Softer, gentle volume
    gain.gain.setValueAtTime(sniper ? 0.08 : 0.045, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  // ─── SFX: Dash / Tactical Thruster Burst ─────────────────────────────────────
  public playDash() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.22);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  // ─── SFX: Void Phase Blink (Wraith dissolves and reappears) ─────────────────
  public playVoidBlink() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.28);
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1470, t);
    osc2.frequency.exponentialRampToValueAtTime(190, t + 0.28);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.3);
    osc2.start(t);
    osc2.stop(t + 0.3);
  }

  // ─── SFX: Enemy Hit ─────────────────────────────────────────────────────────
  public playHit() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (t - this.lastHitAt < 0.045) return;
    this.lastHitAt = t;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(220 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.035);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  // ─── SFX: Explosion ─────────────────────────────────────────────────────────
  public playExplosion(big = false) {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    if (!big && t - this.lastExplosionAt < 0.07) return;
    this.lastExplosionAt = t;
    const dur = big ? 0.55 : 0.22;

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(big ? 550 : 700, t);
    filter.frequency.exponentialRampToValueAtTime(35, t + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.35 : 0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(big ? 110 : 80, t);
    sub.frequency.exponentialRampToValueAtTime(25, t + dur * 0.7);
    subGain.gain.setValueAtTime(big ? 0.35 : 0.15, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);

    whiteNoise.start(t, Math.random() * Math.max(0, 1.2 - dur), dur);
    whiteNoise.stop(t + dur);
    sub.start(t);
    sub.stop(t + dur);
  }

  // ─── SFX: XP Collect ────────────────────────────────────────────────────────
  public playXp() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const now = Date.now();
    if (now - this.lastXpTime < 500) {
      this.xpPitchCounter = (this.xpPitchCounter + 1) % 8;
    } else {
      this.xpPitchCounter = 0;
    }
    this.lastXpTime = now;

    const freqs = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];
    const freq = freqs[this.xpPitchCounter];

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.04, t + 0.07);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  // ─── SFX: Level Up Fanfare ──────────────────────────────────────────────────
  public playLevelUp() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    const t = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const startT = t + i * 0.07;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startT);

      gain.gain.setValueAtTime(0.16, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startT);
      osc.stop(startT + 0.3);
    });
  }

  // ─── SFX: Tactical Nuke ─────────────────────────────────────────────────────
  // ─── МИФИЧЕСКИЙ ТИР: торжественные звуки события ──────────────────────────
  /** Mythic Sting (~2.6 c): мощный удар → подъём → торжественный аккорд →
   *  высокий финал. Фоновая музыка временно приглушается и плавно возвращается. */
  public playMythicSting() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Приглушить обычную музыку, вернуть через 3.2 c.
    try {
      if (this.musicGain) {
        this.musicGain.gain.cancelScheduledValues(t);
        this.musicGain.gain.setTargetAtTime(0.08, t, 0.12);
        this.musicGain.gain.setTargetAtTime(1, t + 3.2, 0.8);
      }
    } catch { /* музыка не играет — не критично */ }

    const master = this.ctx.createGain();
    master.gain.value = 1.6; // заметнее обычных SFX
    master.connect(this.sfxGain);

    // 1) Мощный удар (низкий синус + шумовой транзиент).
    const hit = this.ctx.createOscillator();
    const hitGain = this.ctx.createGain();
    hit.type = "sine";
    hit.frequency.setValueAtTime(160, t);
    hit.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    hitGain.gain.setValueAtTime(0.9, t);
    hitGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    hit.connect(hitGain).connect(master);
    hit.start(t); hit.stop(t + 1);

    // 2) Короткий подъём (свип вверх).
    const rise = this.ctx.createOscillator();
    const riseGain = this.ctx.createGain();
    rise.type = "sawtooth";
    rise.frequency.setValueAtTime(180, t + 0.25);
    rise.frequency.exponentialRampToValueAtTime(720, t + 1.0);
    riseGain.gain.setValueAtTime(0.0001, t + 0.25);
    riseGain.gain.exponentialRampToValueAtTime(0.22, t + 0.55);
    riseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
    rise.connect(riseGain).connect(master);
    rise.start(t + 0.25); rise.stop(t + 1.2);

    // 3) Торжественный аккорд (мажорное трезвучие + квинта).
    for (const [freq, delay, vol] of [[196, 1.0, 0.28], [246.9, 1.05, 0.22], [293.7, 1.1, 0.22], [392, 1.15, 0.18]] as const) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.4);
      osc.connect(g).connect(master);
      osc.start(t + delay); osc.stop(t + delay + 1.5);
    }

    // 4) Высокий завершающий звук.
    const shine = this.ctx.createOscillator();
    const shineGain = this.ctx.createGain();
    shine.type = "sine";
    shine.frequency.setValueAtTime(1046, t + 1.9);
    shine.frequency.exponentialRampToValueAtTime(2093, t + 2.5);
    shineGain.gain.setValueAtTime(0.0001, t + 1.9);
    shineGain.gain.exponentialRampToValueAtTime(0.3, t + 2.1);
    shineGain.gain.exponentialRampToValueAtTime(0.001, t + 2.7);
    shine.connect(shineGain).connect(master);
    shine.start(t + 1.9); shine.stop(t + 2.8);
  }

  /** Появление карточки мифика: короткое искрящееся арпеджио вверх. */
  public playMythicCard() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const master = this.ctx.createGain();
    master.gain.value = 0.9;
    master.connect(this.sfxGain);
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(g).connect(master);
      osc.start(start); osc.stop(start + 0.55);
    });
  }

  /** Выбор мифика: мощный низкий удар + энергетическая волна + аккорд. */
  public playMythicSelect() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const master = this.ctx.createGain();
    master.gain.value = 1.4;
    master.connect(this.sfxGain);
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(110, t);
    boom.frequency.exponentialRampToValueAtTime(30, t + 0.7);
    boomGain.gain.setValueAtTime(1.0, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    boom.connect(boomGain).connect(master);
    boom.start(t); boom.stop(t + 1.1);
    for (const [freq, delay] of [[392, 0.15], [493.9, 0.15], [587.3, 0.15], [784, 0.22]] as const) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(0.26, t + delay + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.2);
      osc.connect(g).connect(master);
      osc.start(t + delay); osc.stop(t + delay + 1.3);
    }
  }

  public playNuke() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 1.2);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 1.2);
  }

  // ─── SFX: Time Slow ─────────────────────────────────────────────────────────
  public playTimeSlow() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.45);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  // ─── SFX: Boss Warning Siren ────────────────────────────────────────────────
  public playBossWarning() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const st = t + i * 0.38;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, st);
      osc.frequency.linearRampToValueAtTime(587, st + 0.18);
      osc.frequency.linearRampToValueAtTime(440, st + 0.35);

      gain.gain.setValueAtTime(0.15, st);
      gain.gain.exponentialRampToValueAtTime(0.01, st + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(st);
      osc.stop(st + 0.35);
    }
  }

  // ─── SFX: Powerup Picked Up ─────────────────────────────────────────────────
  public playPowerup() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      const st = t + i * 0.045;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, st);

      gain.gain.setValueAtTime(0.12, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.18);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(st);
      osc.stop(st + 0.18);
    });
  }

  // ─── SFX: Shield Break / Player Damage ──────────────────────────────────────
  public playShieldBreak() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.22);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  // ─── Rich Cosmic Drone Ambient BGM ──────────────────────────────────────────
  public startAmbientBGM() {
    if (this.isMusicPlaying || !this.ctx || !this.musicGain) return;
    this.isMusicPlaying = true;

    // Quiet, airy three-note pad. Sine/triangle voices avoid the tiring buzz of
    // the previous five sawtooth oscillators, while slight detune adds movement.
    const chord = [110, 164.81, 246.94];
    const t = this.ctx.currentTime;

    this.musicOscillators = chord.map((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = i === 1 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((i - 1) * 5, t);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(190 + i * 80, t);

      gain.gain.setValueAtTime(0.028, t);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);

      osc.start(t);
      return osc;
    });
  }

  public stopAmbientBGM() {
    this.musicOscillators.forEach(osc => {
      try { osc.stop(); osc.disconnect(); } catch {}
    });
    this.musicOscillators = [];
    this.isMusicPlaying = false;
  }
}

export const audio = new SoundEngine();
