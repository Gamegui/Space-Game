// ─── Web Audio API Procedural Sound Engine ─────────────────────────────────────
// Rich atmospheric space drone synth with soft, balanced, satisfying laser SFX.

// ─── Procedural soundtrack themes (v2.8.0) ───────────────────────────────────
// «Несколько подходящих саундтреков»: каждая тема — 16-шаговый паттерн
// (восьмые) с басом, мелодией и хэтами, сыгранный look-ahead-планировщиком
// поверх WebAudio. Всё через musicGain: ползунок громкости и дакинг работают.

export type MusicTheme = "menu" | "combat" | "boss" | null;

type ThemeDef = {
  bpm: number;
  bass: (number | null)[];
  lead: (number | null)[];
  hats: boolean[];
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  bassVol: number;
  leadVol: number;
  leadLowpass: number;
  /** Static chord pad (menu only). */
  pad?: number[];
};

const THEMES: Record<Exclude<MusicTheme, null>, ThemeDef> = {
  // «Звёздная гавань» — меню/ангар: спокойное арпеджио над дрон-аккордом.
  menu: {
    bpm: 72,
    bass: [110, null, null, null, null, null, null, null, 87.31, null, null, null, null, null, null, null],
    lead: [220, 261.63, 329.63, 440, 392, 329.63, 261.63, 329.63, 220, 261.63, 329.63, 440, 523.25, 440, 329.63, 261.63],
    hats: new Array<boolean>(16).fill(false),
    bassWave: "sine",
    leadWave: "triangle",
    bassVol: 0.05,
    leadVol: 0.045,
    leadLowpass: 2400,
    pad: [110, 164.81, 246.94],
  },
  // «Погоня в пустоте» — волны: двигательный бас + арпеджио, ля-минор.
  combat: {
    bpm: 132,
    bass: [110, 110, 110, 98, 110, 110, 130.81, 98, 110, 110, 110, 98, 110, 110, 130.81, 98],
    lead: [440, 523.25, 659.25, 523.25, 587.33, 523.25, 659.25, 523.25, 440, 523.25, 659.25, 523.25, 587.33, 659.25, 783.99, 659.25],
    hats: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true],
    bassWave: "sawtooth",
    leadWave: "triangle",
    bassVol: 0.05,
    leadVol: 0.042,
    leadLowpass: 2600,
  },
  // «Пробуждение титана» — босс: мрачный ре-минор с тритоном, плотный драйв.
  boss: {
    bpm: 148,
    bass: [73.42, 73.42, 73.42, 77.78, 73.42, 73.42, 65.41, 77.78, 73.42, 73.42, 73.42, 77.78, 73.42, 73.42, 65.41, 77.78],
    lead: [293.66, 349.23, 440, 349.23, 293.66, 415.3, 440, 415.3, 293.66, 349.23, 440, 349.23, 587.33, 415.3, 440, 415.3],
    hats: new Array<boolean>(16).fill(true),
    bassWave: "sawtooth",
    leadWave: "sawtooth",
    bassVol: 0.055,
    leadVol: 0.038,
    leadLowpass: 1500,
  },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted: boolean = false;
  // ─── Procedural soundtrack engine (v2.8.0) ────────────────────────────────
  // Several composed themes (menu / combat / boss) driven by a lookahead
  // step sequencer, plus one-shot victory / defeat jingles. Everything goes
  // through musicGain, so the music volume slider and ducking keep working.
  private theme: MusicTheme = null;
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private padOscillators: OscillatorNode[] = [];
  /** Base music gain from the volume slider — ducking must return to THIS
   *  value, not to 1.0 (pre-v2.8.0 bug: mythic sting left music at full). */
  private musicBaseGain = 0.084;
  private musicDucked = false;
  private noiseBuffer: AudioBuffer | null = null;
  private xpPitchCounter: number = 0;
  private lastXpTime: number = 0;
  private lastShootAt: number = -1;
  private lastHitAt: number = -1;
  private lastExplosionAt: number = -1;
  // v1.8.3: бюджет одновременно звучащих SFX. При макс-билде (кортеж, толпы)
  // троттлинги по времени всё равно дают непрерывную стену звука; лимит
  // голосов страхует кодек/динамики от каши и заодно снижает нагрузку.
  private activeVoices: number = 0;
  private beginVoice(): boolean {
    if (this.activeVoices >= 22) return false;
    this.activeVoices++;
    return true;
  }
  private readonly endVoice = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); };

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
    this.musicBaseGain = 0.24 * Math.max(0, Math.min(1, percent / 100));
    if (this.musicGain && this.ctx && !this.musicDucked) {
      this.musicGain.gain.setTargetAtTime(this.musicBaseGain, this.ctx.currentTime, 0.05);
    }
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
    // Под нагрузкой (много голосов) окно троттлинга расширяется: звук остаётся
    // плотным, но не превращается в сплошной гул.
    if (t - this.lastShootAt < (this.activeVoices > 12 ? 0.08 : 0.035)) return;
    this.lastShootAt = t;
    if (!this.beginVoice()) return;
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

    osc.onended = this.endVoice;
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
    if (t - this.lastHitAt < (this.activeVoices > 12 ? 0.1 : 0.045)) return;
    this.lastHitAt = t;
    if (!this.beginVoice()) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(220 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.035);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.onended = this.endVoice;
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
    if (!this.beginVoice()) return;
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

    whiteNoise.onended = this.endVoice; // noise и sub — один голос (всегда живут вместе)
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
    if (!this.beginVoice()) return;

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

    osc.onended = this.endVoice;
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

    // Приглушить тему, вернуть через 3.2 c к пользовательской громкости.
    try {
      if (this.musicGain) {
        this.musicDucked = true;
        this.musicGain.gain.cancelScheduledValues(t);
        this.musicGain.gain.setTargetAtTime(Math.min(0.08, this.musicBaseGain), t, 0.12);
        this.musicGain.gain.setTargetAtTime(this.musicBaseGain, t + 3.2, 0.8);
        window.setTimeout(() => { this.musicDucked = false; }, 4200);
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

  // ─── Procedural soundtrack engine (v2.8.0) ──────────────────────────────────
  /** Switch the looping theme. Idempotent; `null` stops the music entirely.
   *  Safe before the first user gesture: the scheduler waits for a running
   *  AudioContext and picks the theme up on the next resume(). */
  public setMusicTheme(theme: MusicTheme) {
    this.init();
    if (this.theme === theme) return;
    const restarting = this.theme === null;
    this.theme = theme;
    if (theme === null) {
      this.stopMusicScheduler();
      this.stopPad();
      return;
    }
    if (restarting) this.stepIndex = 0; // fresh start — begin at the bar
    this.syncPad(theme);
    this.ensureMusicScheduler();
  }

  public getMusicTheme(): MusicTheme {
    return this.theme;
  }

  private ensureMusicScheduler() {
    if (this.schedulerId !== null) return;
    this.schedulerId = setInterval(() => this.musicTick(), 90);
  }

  private stopMusicScheduler() {
    if (this.schedulerId !== null) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private musicTick() {
    if (!this.ctx || this.theme === null || this.ctx.state !== "running") return;
    const def = THEMES[this.theme];
    const stepDur = 60 / def.bpm / 2; // eighth notes
    const now = this.ctx.currentTime;
    // After a suspend (tab hidden / ad / pause) the clock froze — re-anchor
    // instead of dumping a pile of missed notes at once.
    if (this.nextStepTime < now - 0.25) this.nextStepTime = now + 0.06;
    while (this.nextStepTime < now + 0.3) {
      this.scheduleMusicStep(def, this.stepIndex, this.nextStepTime, stepDur);
      this.stepIndex = (this.stepIndex + 1) % 16;
      this.nextStepTime += stepDur;
    }
  }

  private scheduleMusicStep(def: ThemeDef, step: number, at: number, stepDur: number) {
    if (!this.ctx || !this.musicGain) return;
    const bassFreq = def.bass[step % def.bass.length];
    if (bassFreq !== null && bassFreq !== undefined) {
      this.playMusicNote(bassFreq, at, stepDur * 0.92, def.bassVol, def.bassWave, 700);
    }
    const leadFreq = def.lead[step % def.lead.length];
    if (leadFreq !== null && leadFreq !== undefined) {
      this.playMusicNote(leadFreq, at, stepDur * 0.85, def.leadVol, def.leadWave, def.leadLowpass);
    }
    if (def.hats[step % def.hats.length]) {
      this.playMusicHat(at, step === 0 ? 0.028 : 0.016);
    }
  }

  /** One short synth note into the music bus (osc → lowpass → envelope). */
  private playMusicNote(freq: number, at: number, dur: number, vol: number, wave: OscillatorType, lowpass: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, at);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpass, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** Quiet noise tick for rhythmic drive (reuses the shared noise buffer). */
  private playMusicHat(at: number, vol: number) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(6500, at);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.04);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(at, 0, 0.05);
    src.stop(at + 0.05);
  }

  /** Menu pad — the classic airy drone chord under the arpeggio. */
  private syncPad(theme: Exclude<MusicTheme, null>) {
    const def = THEMES[theme];
    if (!def.pad || !this.ctx || !this.musicGain) {
      this.stopPad();
      return;
    }
    if (this.padOscillators.length > 0) return; // pad already running
    const t = this.ctx.currentTime;
    this.padOscillators = def.pad.map((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();
      osc.type = i === 1 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((i - 1) * 5, t);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(190 + i * 80, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.setTargetAtTime(0.028, t, 0.8);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);
      osc.start(t);
      return osc;
    });
  }

  private stopPad() {
    for (const osc of this.padOscillators) {
      try { osc.stop(); osc.disconnect(); } catch {}
    }
    this.padOscillators = [];
  }

  // ─── One-shot jingles (victory / defeat) ────────────────────────────────────
  /** Победа (~3 с): восходящий мажорный забег-фанфар + аккорд. */
  public playVictoryJingle() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    // Быстрый забег вверх.
    [523.25, 587.33, 659.25, 783.99].forEach((freq, i) => {
      this.playMusicNote(freq, t + i * 0.11, 0.22, 0.07, "triangle", 3200);
    });
    // Торжественное трезвучие с сустейном.
    for (const [freq, delay] of [[523.25, 0.5], [659.25, 0.5], [783.99, 0.5], [1046.5, 0.62]] as const) {
      this.playMusicNote(freq, t + delay, 2.2, 0.05, "triangle", 3200);
    }
    // Низкий удар-финал.
    this.playMusicNote(130.81, t + 0.5, 1.6, 0.07, "sine", 400);
  }

  /** Поражение (~2.5 с): нисходящая фраза в ля-миноре + тяжёлый обрыв. */
  public playGameOverSting() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const descend: [number, number][] = [[440, 0], [392, 0.3], [329.63, 0.6], [349.23, 0.9]];
    for (const [freq, delay] of descend) {
      this.playMusicNote(freq, t + delay, 0.55, 0.055, "sine", 1800);
    }
    // Спад в низ.
    this.playMusicNote(220, t + 1.25, 0.5, 0.05, "triangle", 900);
    this.playMusicNote(110, t + 1.55, 1.4, 0.08, "sine", 400);
  }
}

export const audio = new SoundEngine();
