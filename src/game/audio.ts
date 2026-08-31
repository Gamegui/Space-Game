// ─── Web Audio API Procedural Sound Engine ─────────────────────────────────────
// Rich atmospheric space drone synth with soft, balanced, satisfying laser SFX.

// ─── Procedural soundtrack (v2.9.4) ──────────────────────────────────────────
// Меню и бой — ля-минор (A). Боссы: тот же корень, но ГРОМКИЙ свой хук
// с первых тактов интро, толстый лид (детюн) и своя ударная ДНК.

export type MusicTheme =
  | "menu"
  | "combat"
  | "boss_destroyer"
  | "boss_mothership"
  | "boss_dreadnought"
  | "boss_eclipse"
  | "boss_titan"
  | "boss_omega"
  | null;

export const BOSS_MUSIC_THEMES = [
  "boss_destroyer",
  "boss_mothership",
  "boss_dreadnought",
  "boss_eclipse",
  "boss_titan",
  "boss_omega",
] as const;

export function musicThemeForBoss(type?: string | null): Exclude<MusicTheme, null> {
  switch (type) {
    case "boss_destroyer":
    case "boss_mothership":
    case "boss_dreadnought":
    case "boss_eclipse":
    case "boss_titan":
    case "boss_omega":
      return type;
    default:
      return "boss_omega";
  }
}

const _ = null;
const F2 = 87.31, G2 = 98.00, A2 = 110.00, Bb2 = 116.54, B2 = 123.47, C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00;
const E2 = 82.41, A3 = 220.00, B3 = 246.94, C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00;
const Gs4 = 415.30, A4 = 440.00, Bb4 = 466.16, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99;
const Gs5 = 830.61, A5 = 880.00, Bb5 = 932.33;

type ThemeBar = {
  /** Pad chord that glides in over the bar (3 voices). */
  chord: [number, number, number];
  bass: (number | null)[];
  lead: (number | null)[];
  /** Optional harmony — stacked with the lead so the hook reads in the first bars. */
  lead2?: (number | null)[];
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
};

export type ThemeDef = {
  bpm: number;
  bassWave: OscillatorType;
  leadWave: OscillatorType;
  bassVol: number;
  leadVol: number;
  leadLowpass: number;
  bassLowpass: number;
  padVol: number;
  padWave?: OscillatorType;
  /** Lead duration in stepDur units (combat default 1.35). */
  leadHold?: number;
  /** Cents of unison detune on the lead (thickens the hook). */
  leadDetune?: number;
  kickVol?: number;
  snareVol?: number;
  hatVol?: number;
  kickHz?: number;
  bars: ThemeBar[];
};

const OFF16 = new Array<boolean>(16).fill(false);
const hatOffbeats = [false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true];
const kickFour = [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false];
const snareBack = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false];
const kickHalf = [true, false, false, false, false, false, false, true, true, false, false, false, true, false, false, false];
const snareHalf = [false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false];
const hatBoss = [true, false, true, false, true, false, true, true, true, false, true, false, true, false, true, false];
const kickMarch = [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, true];
const snareMarch = [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false];
const hatMarch = [true, false, true, true, true, false, true, false, true, false, true, true, true, false, true, false];
const kickSwarm = [true, false, true, false, false, true, false, false, true, false, true, false, false, false, true, false];
const snareSwarm = [false, false, false, true, false, false, false, false, false, false, false, true, false, true, false, false];
const hatSwarm = [false, true, true, false, false, true, true, false, false, true, true, false, false, true, true, false];
const kickDread = [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false];
const snareDread = [false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false];
const hatDread = [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, false];
const kickEclipse = [true, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false];
const hatEclipse = [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false];
const kickTitan = [true, false, false, false, true, false, false, true, true, false, false, false, true, false, false, false];
const snareTitan = [false, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false];
const hatTitan = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, true];

export const THEMES: Record<Exclude<MusicTheme, null>, ThemeDef> = {
  // «Звёздная гавань» — меню/ангар/выбор корабля. Am–F–C–G, редкая мелодия.
  menu: {
    bpm: 66,
    bassWave: "sine",
    leadWave: "sine",
    bassVol: 0.046,
    leadVol: 0.038,
    leadLowpass: 2200,
    bassLowpass: 420,
    padVol: 0.026,
    bars: [
      {
        chord: [A2, E3, B3],
        bass: [A2, _, _, _, _, _, E3, _, A2, _, _, _, _, _, G2, _],
        lead: [E5, _, _, _, C5, _, _, A4, _, _, _, _, G4, _, A4, _],
        kick: OFF16, snare: OFF16, hat: OFF16,
      },
      {
        chord: [F3, C4, A3],
        bass: [F3, _, _, _, _, _, C3, _, F3, _, _, _, _, _, A2, _],
        lead: [C5, _, _, E5, _, _, _, D5, _, _, C5, _, _, _, A4, _],
        kick: OFF16, snare: OFF16, hat: OFF16,
      },
      {
        chord: [C3, G3, E4],
        bass: [C3, _, _, _, _, _, G3, _, C3, _, _, _, _, _, E3, _],
        lead: [G4, _, A4, _, _, C5, _, _, _, E4, _, _, A4, _, _, _],
        kick: OFF16, snare: OFF16, hat: OFF16,
      },
      {
        chord: [G2, D3, B3],
        bass: [G2, _, _, _, _, _, D3, _, G2, _, _, _, _, _, E3, _],
        lead: [D5, _, _, C5, _, A4, _, _, G4, _, _, _, E4, _, _, _],
        kick: OFF16, snare: OFF16, hat: OFF16,
      },
    ],
  },
  // «Погоня в пустоте» — волны. Тот же Am–F–C–G, но с пульсом и фразой.
  combat: {
    bpm: 114,
    bassWave: "sawtooth",
    leadWave: "triangle",
    bassVol: 0.048,
    leadVol: 0.036,
    leadLowpass: 2100,
    bassLowpass: 560,
    padVol: 0.016,
    bars: [
      {
        chord: [A2, E3, A3],
        bass: [A2, A2, _, A2, A2, _, A2, G2, A2, A2, _, C3, A2, _, G2, A2],
        lead: [A4, _, C5, E5, _, D5, C5, _, A4, _, G4, A4, _, C5, _, _],
        kick: kickFour, snare: snareBack, hat: hatOffbeats,
      },
      {
        chord: [F3, C4, A3],
        bass: [F3, F3, _, F3, F3, _, F3, G3, F3, F3, _, A3, F3, _, E3, F3],
        lead: [F5, _, E5, D5, _, C5, _, _, A4, _, _, G4, A4, _, C5, _],
        kick: kickFour, snare: snareBack, hat: hatOffbeats,
      },
      {
        chord: [C3, G3, E4],
        bass: [C3, C3, _, C3, C3, _, C3, D3, C3, C3, _, E3, C3, _, B2, C3],
        lead: [E5, _, _, G5, _, E5, D5, _, C5, _, E5, _, D5, C5, A4, _],
        kick: kickFour, snare: snareBack, hat: hatOffbeats,
      },
      {
        chord: [G2, D3, B3],
        bass: [G2, G2, _, G2, G2, _, G2, A2, G2, G2, _, B2, G2, _, D3, G2],
        lead: [B4, _, D5, _, G4, _, A4, _, B4, C5, D5, _, C5, _, A4, _],
        kick: [true, false, false, false, true, false, false, false, true, false, true, false, true, false, false, true],
        snare: snareBack, hat: hatOffbeats,
      },
    ],
  },
  // «Бортовой залп» — эсминец. Фанфара вверх по Am, марш, громкий малый барабан.
  boss_destroyer: {
    bpm: 108,
    bassWave: "triangle",
    leadWave: "triangle",
    bassVol: 0.058,
    leadVol: 0.058,
    leadLowpass: 3200,
    bassLowpass: 520,
    padVol: 0.018,
    leadHold: 1.9,
    leadDetune: 8,
    kickVol: 0.13,
    snareVol: 0.06,
    hatVol: 0.028,
    bars: [
      {
        chord: [A2, E3, A3],
        bass: [A2, _, A2, _, E3, _, A2, _, A2, _, C3, _, E3, _, A2, _],
        lead:  [A4, _, C5, _, E5, _, A5, _, G5, _, E5, _, C5, _, A4, _],
        lead2: [E4, _, G4, _, C5, _, E5, _, D5, _, C5, _, A4, _, E4, _],
        kick: kickMarch, snare: snareMarch, hat: hatMarch,
      },
      {
        chord: [C3, G3, E4],
        bass: [C3, _, C3, _, G3, _, C3, _, C3, _, E3, _, G3, _, C3, _],
        lead:  [C5, _, E5, _, G5, _, C5, _, E5, _, G5, _, E5, _, C5, _],
        lead2: [G4, _, C5, _, E5, _, G4, _, C5, _, E5, _, C5, _, G4, _],
        kick: kickMarch, snare: snareMarch, hat: hatMarch,
      },
      {
        chord: [G2, D3, B3],
        bass: [G2, _, G2, _, D3, _, G2, _, G2, _, B2, _, D3, _, G2, _],
        lead:  [B4, _, D5, _, G5, _, D5, _, B4, _, G4, _, D5, _, B4, _],
        lead2: [G4, _, B4, _, D5, _, B4, _, G4, _, D4, _, B4, _, G4, _],
        kick: kickMarch, snare: snareMarch, hat: hatMarch,
      },
      {
        chord: [E3, B3, G3],
        bass: [E3, _, E3, _, B2, _, E3, _, E3, _, G3, _, B3, _, E3, A2],
        lead:  [E5, _, G5, _, B4, _, E5, _, D5, _, B4, _, A4, _, E4, _],
        lead2: [B4, _, E5, _, Gs4, _, B4, _, A4, _, G4, _, E4, _, B3, _],
        kick: kickMarch, snare: snareMarch, hat: hatMarch,
      },
    ],
  },
  // «Рой Левиафана» — матка. Колокольчики-арпеджио, роящийся хэт.
  boss_mothership: {
    bpm: 100,
    bassWave: "triangle",
    leadWave: "sine",
    bassVol: 0.052,
    leadVol: 0.054,
    leadLowpass: 3800,
    bassLowpass: 480,
    padVol: 0.022,
    leadHold: 1.55,
    leadDetune: 12,
    kickVol: 0.10,
    snareVol: 0.04,
    hatVol: 0.032,
    bars: [
      {
        chord: [A2, E3, C4],
        bass: [A2, _, E3, A2, _, C3, _, E3, A2, _, E3, _, C3, _, A2, _],
        lead:  [A5, C5, E5, _, A5, _, E5, _, C5, E5, _, A5, _, E5, _, _],
        lead2: [E5, A4, C5, _, E5, _, C5, _, A4, C5, _, E5, _, C5, _, _],
        kick: kickSwarm, snare: snareSwarm, hat: hatSwarm,
      },
      {
        chord: [F3, C4, A3],
        bass: [F3, _, C3, F3, _, A3, _, C4, F3, _, C3, _, A3, _, F3, _],
        lead:  [F5, A4, C5, _, F5, _, C5, _, A4, C5, _, F5, _, A5, _, _],
        lead2: [C5, F4, A4, _, C5, _, A4, _, F4, A4, _, C5, _, F5, _, _],
        kick: kickSwarm, snare: snareSwarm, hat: hatSwarm,
      },
      {
        chord: [D3, A3, F4],
        bass: [D3, _, A2, D3, _, F3, _, A3, D3, _, A2, _, F3, _, D3, _],
        lead:  [D5, F5, A5, _, D5, _, A5, _, F5, A5, _, D5, _, A4, _, _],
        lead2: [A4, D5, F5, _, A4, _, F5, _, D5, F5, _, A4, _, F4, _, _],
        kick: kickSwarm, snare: snareSwarm, hat: hatSwarm,
      },
      {
        chord: [E3, B3, G3],
        bass: [E3, _, B2, E3, _, G3, _, B3, E3, _, G3, _, B3, _, E3, A2],
        lead:  [E5, G5, B4, _, E5, _, B4, _, G5, E5, _, A5, _, E5, _, _],
        lead2: [B4, E5, G4, _, B4, _, G4, _, E5, B4, _, E5, _, B4, _, _],
        kick: kickSwarm, snare: snareSwarm, hat: hatSwarm,
      },
    ],
  },
  // «Владыка Пустоты» — дредноут. Doom: длинные ноты, огромный кик, пил.
  boss_dreadnought: {
    bpm: 72,
    bassWave: "sawtooth",
    leadWave: "sawtooth",
    bassVol: 0.068,
    leadVol: 0.050,
    leadLowpass: 1200,
    bassLowpass: 260,
    padVol: 0.034,
    padWave: "sawtooth",
    leadHold: 3.2,
    leadDetune: 6,
    kickVol: 0.18,
    snareVol: 0.028,
    hatVol: 0.012,
    kickHz: 88,
    bars: [
      {
        chord: [A2, E3, C4],
        bass: [A2, A2, A2, A2, A2, _, _, _, A2, A2, _, E2, A2, _, E3, _],
        lead:  [A3, _, _, _, C4, _, _, _, E4, _, _, _, A3, _, _, _],
        lead2: [E3, _, _, _, A3, _, _, _, C4, _, _, _, E3, _, _, _],
        kick: kickDread, snare: snareDread, hat: hatDread,
      },
      {
        chord: [G2, D3, B3],
        bass: [G2, G2, G2, G2, G2, _, _, _, G2, G2, _, F2, G2, _, D3, _],
        lead:  [G3, _, _, _, B3, _, _, _, D4, _, _, _, G3, _, _, _],
        lead2: [D3, _, _, _, G3, _, _, _, B3, _, _, _, D3, _, _, _],
        kick: kickDread, snare: snareDread, hat: hatDread,
      },
      {
        chord: [F3, C4, A3],
        bass: [F2, F2, F2, F2, F3, _, _, _, F3, F3, _, C3, F3, _, A2, _],
        lead:  [F3, _, _, _, A3, _, _, _, C4, _, _, _, F4, _, _, _],
        lead2: [C3, _, _, _, F3, _, _, _, A3, _, _, _, C4, _, _, _],
        kick: kickDread, snare: snareDread, hat: hatDread,
      },
      {
        chord: [E3, B3, G3],
        bass: [E2, E2, E2, E3, E3, _, _, _, E3, E3, _, D3, E3, _, B2, A2],
        lead:  [E3, _, _, G3, _, _, B3, _, _, E4, _, _, A3, _, _, _],
        lead2: [B2, _, _, E3, _, _, G3, _, _, B3, _, _, E3, _, _, _],
        kick: [true, false, false, false, false, false, false, true, true, false, false, false, true, false, false, true],
        snare: snareDread, hat: hatDread,
      },
    ],
  },
  // «Колодец затмения» — высокое стеклянное фригийское пение над бездной.
  boss_eclipse: {
    bpm: 84,
    bassWave: "sine",
    leadWave: "sine",
    bassVol: 0.056,
    leadVol: 0.056,
    leadLowpass: 4200,
    bassLowpass: 340,
    padVol: 0.040,
    leadHold: 2.6,
    leadDetune: 14,
    kickVol: 0.09,
    snareVol: 0.0,
    hatVol: 0.016,
    kickHz: 70,
    bars: [
      {
        chord: [A2, E3, C4],
        bass: [A2, _, _, _, E3, _, _, _, A2, _, _, C3, _, _, E3, _],
        lead:  [A5, _, _, Bb5, _, _, A5, _, G5, _, _, E5, _, _, _, _],
        lead2: [E5, _, _, F5, _, _, E5, _, D5, _, _, C5, _, _, _, _],
        kick: kickEclipse, snare: OFF16, hat: hatEclipse,
      },
      {
        chord: [Bb2, F3, D4],
        bass: [Bb2, _, _, _, F3, _, _, _, Bb2, _, _, D3, _, _, F3, _],
        lead:  [Bb5, _, _, F5, _, _, G5, _, Bb5, _, _, A5, _, _, _, _],
        lead2: [F5, _, _, D5, _, _, E5, _, F5, _, _, E5, _, _, _, _],
        kick: kickEclipse, snare: OFF16, hat: hatEclipse,
      },
      {
        chord: [F3, C4, A3],
        bass: [F3, _, _, _, C3, _, _, _, F3, _, _, A3, _, _, C4, _],
        lead:  [F5, _, A5, _, _, C5, _, _, _, Bb4, _, _, F5, _, _, _],
        lead2: [C5, _, F5, _, _, A4, _, _, _, F4, _, _, C5, _, _, _],
        kick: kickEclipse, snare: OFF16, hat: hatEclipse,
      },
      {
        chord: [E3, B3, G3],
        bass: [E3, _, _, _, B2, _, _, _, E3, _, _, G3, _, _, A2, _],
        lead:  [E5, _, _, G5, _, _, A5, _, _, E5, _, _, C5, _, _, _],
        lead2: [B4, _, _, E5, _, _, G5, _, _, B4, _, _, A4, _, _, _],
        kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
        snare: OFF16, hat: hatEclipse,
      },
    ],
  },
  // «Сейсмика» — титан. Чант A–A–C–E, топот, как ритуал.
  boss_titan: {
    bpm: 80,
    bassWave: "sawtooth",
    leadWave: "triangle",
    bassVol: 0.062,
    leadVol: 0.056,
    leadLowpass: 2400,
    bassLowpass: 280,
    padVol: 0.026,
    padWave: "triangle",
    leadHold: 2.1,
    leadDetune: 5,
    kickVol: 0.16,
    snareVol: 0.045,
    hatVol: 0.02,
    kickHz: 100,
    bars: [
      {
        chord: [A2, E3, C4],
        bass: [A2, _, _, A2, A2, _, _, G2, A2, _, _, C3, A2, _, G2, _],
        lead:  [A4, A4, _, C5, _, E5, _, _, A4, _, G4, _, A4, _, _, _],
        lead2: [E4, E4, _, A4, _, C5, _, _, E4, _, D4, _, E4, _, _, _],
        kick: kickTitan, snare: snareTitan, hat: hatTitan,
      },
      {
        chord: [C3, G3, E4],
        bass: [C3, _, _, C3, C3, _, _, G2, C3, _, _, E3, C3, _, G2, _],
        lead:  [C5, C5, _, E5, _, G5, _, _, E5, _, C5, _, A4, _, _, _],
        lead2: [G4, G4, _, C5, _, E5, _, _, C5, _, G4, _, E4, _, _, _],
        kick: kickTitan, snare: snareTitan, hat: hatTitan,
      },
      {
        chord: [F3, C4, A3],
        bass: [F2, _, _, F3, F3, _, _, C3, F3, _, _, A3, F3, _, C3, _],
        lead:  [F4, A4, _, C5, _, D5, _, _, C5, _, A4, _, F4, _, _, _],
        lead2: [C4, F4, _, A4, _, A4, _, _, A4, _, F4, _, C4, _, _, _],
        kick: kickTitan, snare: snareTitan, hat: hatTitan,
      },
      {
        chord: [G2, D3, B3],
        bass: [G2, _, _, G2, G2, _, _, D3, G2, _, _, B2, G2, _, A2, _],
        lead:  [G4, _, B4, _, D5, _, _, A4, _, _, E5, _, _, A4, _, _],
        lead2: [D4, _, G4, _, B4, _, _, E4, _, _, C5, _, _, E4, _, _],
        kick: [true, false, false, false, true, false, false, true, true, false, true, false, true, false, false, true],
        snare: snareTitan, hat: hatTitan,
      },
    ],
  },
  // «Абсолютный финал» — Омега. Гармонический минор (G#), подъём к A5.
  boss_omega: {
    bpm: 96,
    bassWave: "sawtooth",
    leadWave: "sawtooth",
    bassVol: 0.060,
    leadVol: 0.056,
    leadLowpass: 2200,
    bassLowpass: 360,
    padVol: 0.028,
    leadHold: 2.0,
    leadDetune: 9,
    kickVol: 0.14,
    snareVol: 0.048,
    hatVol: 0.024,
    kickHz: 120,
    bars: [
      {
        chord: [A2, E3, C4],
        bass: [A2, A2, A2, _, A2, A2, _, G2, A2, A2, A2, _, A2, _, E3, G2],
        lead:  [A4, _, C5, E5, _, Gs5, _, A5, _, E5, _, C5, _, A4, _, _],
        lead2: [E4, _, A4, C5, _, E5, _, E5, _, C5, _, A4, _, E4, _, _],
        kick: kickHalf, snare: snareHalf, hat: hatBoss,
      },
      {
        chord: [A2, E3, A3],
        bass: [A2, A2, A2, _, A2, A2, _, C3, A2, A2, A2, _, A2, _, G2, A2],
        lead:  [A5, _, Gs5, E5, _, C5, _, A4, _, C5, E5, _, Gs5, _, A5, _],
        lead2: [E5, _, E5, C5, _, A4, _, E4, _, A4, C5, _, E5, _, E5, _],
        kick: kickHalf, snare: snareHalf, hat: hatBoss,
      },
      {
        chord: [F3, C4, A3],
        bass: [F3, F3, F3, _, F3, F3, _, C3, F3, F3, A3, _, F3, _, C3, F3],
        lead:  [F5, _, A5, _, C5, _, A5, _, G5, _, F5, _, E5, _, C5, _],
        lead2: [C5, _, F5, _, A4, _, F5, _, E5, _, C5, _, C5, _, A4, _],
        kick: kickHalf, snare: snareHalf, hat: hatBoss,
      },
      {
        chord: [E3, B3, Gs4],
        bass: [E3, E3, E3, _, E3, E3, _, G3, E3, E3, B3, _, E3, _, D3, E3],
        lead:  [Gs5, _, E5, _, B4, _, A5, _, Gs5, _, E5, _, A4, _, E5, _],
        lead2: [E5, _, B4, _, Gs4, _, E5, _, E5, _, B4, _, E4, _, B4, _],
        kick: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, true, true],
        snare: [false, false, false, false, false, false, false, false, true, false, false, false, true, false, false, false],
        hat: hatBoss,
      },
    ],
  },
};

/** Structural snapshot for tests (no AudioContext required). */
export function soundtrackMeta() {
  return (Object.keys(THEMES) as Array<Exclude<MusicTheme, null>>).map((id) => {
    const theme = THEMES[id];
    const leads = theme.bars.flatMap((bar) => bar.lead);
    const rests = leads.filter((n) => n === null).length;
    return {
      id,
      bpm: theme.bpm,
      bars: theme.bars.length,
      steps: theme.bars.length * 16,
      leadRestRatio: rests / leads.length,
      tonic: A2,
    };
  });
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private themeGain: GainNode | null = null;
  private delayInput: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted: boolean = false;
  // ─── Procedural soundtrack engine (v2.8.1) ────────────────────────────────
  // Themes share tonic A so scene changes intensify rather than clash.
  // themeGain crossfades; musicGain is the volume slider + mythic duck.
  private theme: MusicTheme = null;
  private pendingTheme: MusicTheme | undefined = undefined;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private padOscillators: OscillatorNode[] = [];
  private padGains: GainNode[] = [];
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

      this.themeGain = this.ctx.createGain();
      this.themeGain.gain.setValueAtTime(1, this.ctx.currentTime);
      this.themeGain.connect(this.musicGain);

      // Short echo on pads/leads only — space atmosphere without muddy bass.
      this.delayInput = this.ctx.createGain();
      this.delayInput.gain.setValueAtTime(0.32, this.ctx.currentTime);
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.setValueAtTime(0.28, this.ctx.currentTime);
      const delayFb = this.ctx.createGain();
      delayFb.gain.setValueAtTime(0.18, this.ctx.currentTime);
      const delayLp = this.ctx.createBiquadFilter();
      delayLp.type = "lowpass";
      delayLp.frequency.setValueAtTime(1500, this.ctx.currentTime);
      this.delayInput.connect(delay);
      delay.connect(delayLp);
      delayLp.connect(delayFb);
      delayFb.connect(delay);
      delayLp.connect(this.musicGain);
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

  private lastBossWarningAt = -10;

  // ─── SFX: Boss Warning Siren ────────────────────────────────────────────────
  public playBossWarning() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    // Не стакать три пилы на каждую смену фазы — с темой босса это клиппинг.
    if (t - this.lastBossWarningAt < 1.6) return;
    this.lastBossWarningAt = t;

    for (let i = 0; i < 3; i++) {
      const st = t + i * 0.38;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(330, st);
      osc.frequency.linearRampToValueAtTime(440, st + 0.18);
      osc.frequency.linearRampToValueAtTime(330, st + 0.35);

      gain.gain.setValueAtTime(0.09, st);
      gain.gain.exponentialRampToValueAtTime(0.01, st + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(st);
      osc.stop(st + 0.35);
    }
  }

  private lastBossPhaseAt = -10;

  /** Короткий акцент смены фазы — не сирена, чтобы не рвать тему босса. */
  public playBossPhase() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    if (t - this.lastBossPhaseAt < 0.35) return;
    this.lastBossPhaseAt = t;
    const osc = this.ctx.createOscillator();
    const fifth = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    fifth.type = "sine";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.18);
    fifth.frequency.setValueAtTime(330, t);
    fifth.frequency.exponentialRampToValueAtTime(440, t + 0.18);
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    fifth.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.3);
    fifth.start(t); fifth.stop(t + 0.3);
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

  // ─── Procedural soundtrack engine (v2.8.1) ──────────────────────────────────
  /** Switch the looping theme with a short crossfade. Idempotent; `null`
   *  fades the music out. Safe before the first user gesture: the scheduler
   *  waits for a running AudioContext and picks the theme up on resume(). */
  public setMusicTheme(theme: MusicTheme) {
    this.init();
    const already = this.theme === theme && this.pendingTheme === undefined;
    if (already) return;
    if (this.pendingTheme === theme && this.theme !== theme) return;
    this.crossfadeTo(theme);
  }

  public getMusicTheme(): MusicTheme {
    return this.pendingTheme !== undefined ? this.pendingTheme : this.theme;
  }

  private crossfadeTo(theme: MusicTheme) {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.pendingTheme = theme;
    const hasBus = this.ctx && this.themeGain;
    // First start (or no bus yet): snap without a fade so the menu theme
    // actually begins on the first click instead of waiting on an empty fade.
    if (!hasBus || this.theme === null) {
      this.applyPendingTheme(true);
      return;
    }
    const t = this.ctx!.currentTime;
    this.themeGain!.gain.cancelScheduledValues(t);
    this.themeGain!.gain.setTargetAtTime(0.0001, t, 0.12);
    this.fadeTimer = setTimeout(() => this.applyPendingTheme(false), 420);
  }

  private applyPendingTheme(immediate: boolean) {
    this.fadeTimer = null;
    const next = this.pendingTheme !== undefined ? this.pendingTheme : this.theme;
    this.pendingTheme = undefined;
    this.theme = next;
    this.stepIndex = 0;
    this.nextStepTime = 0;
    this.stopPad();
    if (this.theme === null) {
      this.stopMusicScheduler();
      if (this.themeGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.themeGain.gain.cancelScheduledValues(t);
        this.themeGain.gain.setValueAtTime(0.0001, t);
      }
      return;
    }
    this.ensurePad(this.theme);
    this.ensureMusicScheduler();
    if (this.themeGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.themeGain.gain.cancelScheduledValues(t);
      if (immediate) this.themeGain.gain.setValueAtTime(1, t);
      else {
        this.themeGain.gain.setValueAtTime(0.0001, t);
        this.themeGain.gain.setTargetAtTime(1, t, 0.22);
      }
    }
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
    const totalSteps = def.bars.length * 16;
    while (this.nextStepTime < now + 0.3) {
      const bar = def.bars[Math.floor(this.stepIndex / 16) % def.bars.length];
      const step = this.stepIndex % 16;
      if (step === 0) this.glidePad(bar.chord, def.padVol);
      this.scheduleMusicStep(def, bar, step, this.nextStepTime, stepDur);
      this.stepIndex = (this.stepIndex + 1) % totalSteps;
      this.nextStepTime += stepDur;
    }
  }

  private scheduleMusicStep(def: ThemeDef, bar: ThemeBar, step: number, at: number, stepDur: number) {
    if (!this.ctx || !this.themeGain) return;
    const bassFreq = bar.bass[step];
    if (bassFreq !== null && bassFreq !== undefined) {
      this.playMusicNote(bassFreq, at, stepDur * 0.9, def.bassVol, def.bassWave, def.bassLowpass, { pluck: true });
    }
    const hold = def.leadHold ?? 1.35;
    const leadFreq = bar.lead[step];
    if (leadFreq !== null && leadFreq !== undefined) {
      this.playMusicNote(leadFreq, at, stepDur * hold, def.leadVol, def.leadWave, def.leadLowpass, {
        delay: true,
        detune: def.leadDetune,
      });
    }
    const lead2Freq = bar.lead2?.[step];
    if (lead2Freq !== null && lead2Freq !== undefined) {
      this.playMusicNote(lead2Freq, at, stepDur * hold, def.leadVol * 0.72, def.leadWave, def.leadLowpass, {
        delay: true,
        detune: def.leadDetune ? -def.leadDetune : undefined,
      });
    }
    const kickVol = def.kickVol ?? (step === 0 ? 0.09 : 0.07);
    if (bar.kick[step]) this.playMusicKick(at, step === 0 ? kickVol : kickVol * 0.78, def.kickHz);
    const snareVol = def.snareVol ?? 0.034;
    if (bar.snare[step] && snareVol > 0) this.playMusicSnare(at, snareVol);
    const hatVol = def.hatVol ?? (step % 4 === 0 ? 0.018 : 0.011);
    if (bar.hat[step] && hatVol > 0) this.playMusicHat(at, step % 4 === 0 ? hatVol : hatVol * 0.62);
  }

  /** One synth note. Jingles pass `dest: musicGain` so they survive theme fades. */
  private playMusicNote(
    freq: number,
    at: number,
    dur: number,
    vol: number,
    wave: OscillatorType,
    lowpass: number,
    opts: { dest?: GainNode | null; delay?: boolean; pluck?: boolean; detune?: number } = {},
  ) {
    const dest = opts.dest ?? this.themeGain;
    if (!this.ctx || !dest) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, at);
    if (opts.detune) osc.detune.setValueAtTime(opts.detune * 0.35, at);
    filter.type = "lowpass";
    if (opts.pluck) {
      filter.frequency.setValueAtTime(Math.max(80, lowpass * 0.45), at);
      filter.frequency.exponentialRampToValueAtTime(lowpass, at + 0.03);
      filter.frequency.setTargetAtTime(lowpass * 0.55, at + 0.06, 0.08);
    } else {
      filter.frequency.setValueAtTime(lowpass, at);
    }
    const attack = Math.min(0.04, dur * 0.2);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    if (opts.delay && this.delayInput) gain.connect(this.delayInput);
    osc.start(at);
    osc.stop(at + dur + 0.03);
    if (opts.detune) {
      const osc2 = this.ctx.createOscillator();
      osc2.type = wave;
      osc2.frequency.setValueAtTime(freq, at);
      osc2.detune.setValueAtTime(opts.detune, at);
      osc2.connect(filter);
      osc2.start(at);
      osc2.stop(at + dur + 0.03);
    }
  }

  private playMusicKick(at: number, vol: number, hz?: number) {
    if (!this.ctx || !this.themeGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    const start = hz ?? 150;
    osc.frequency.setValueAtTime(start, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(28, start * 0.28), at + 0.11);
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.14);
    osc.connect(gain);
    gain.connect(this.themeGain);
    osc.start(at);
    osc.stop(at + 0.15);
  }

  private playMusicSnare(at: number, vol: number) {
    if (!this.ctx || !this.themeGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, at);
    filter.Q.setValueAtTime(0.8, at);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.09);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.themeGain);
    src.start(at, 0, 0.1);
    src.stop(at + 0.1);
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(190, at);
    body.frequency.exponentialRampToValueAtTime(90, at + 0.07);
    bodyGain.gain.setValueAtTime(vol * 0.45, at);
    bodyGain.gain.exponentialRampToValueAtTime(0.0008, at + 0.08);
    body.connect(bodyGain);
    bodyGain.connect(this.themeGain);
    body.start(at);
    body.stop(at + 0.09);
  }

  /** Quiet noise tick for rhythmic drive (reuses the shared noise buffer). */
  private playMusicHat(at: number, vol: number) {
    if (!this.ctx || !this.themeGain || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7000, at);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.035);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.themeGain);
    src.start(at, 0, 0.04);
    src.stop(at + 0.04);
  }

  private ensurePad(theme: Exclude<MusicTheme, null>) {
    if (!this.ctx || !this.themeGain) return;
    const chord = THEMES[theme].bars[0].chord;
    const vol = THEMES[theme].padVol;
    if (this.padOscillators.length === 0) this.startPad(chord, vol);
    else this.glidePad(chord, vol);
  }

  private startPad(chord: [number, number, number], vol: number) {
    if (!this.ctx || !this.themeGain) return;
    const t = this.ctx.currentTime;
    this.padOscillators = [];
    this.padGains = [];
    chord.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();
      const padWave = this.theme ? THEMES[this.theme].padWave : undefined;
      osc.type = padWave ?? (i === 1 ? "triangle" : "sine");
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((i - 1) * 6, t);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(280 + i * 90, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.setTargetAtTime(vol, t, 0.7);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.themeGain!);
      if (this.delayInput) gain.connect(this.delayInput);
      osc.start(t);
      this.padOscillators.push(osc);
      this.padGains.push(gain);
    });
  }

  private glidePad(chord: [number, number, number], vol: number) {
    if (!this.ctx || this.padOscillators.length === 0) {
      this.startPad(chord, vol);
      return;
    }
    const t = this.ctx.currentTime;
    this.padOscillators.forEach((osc, i) => {
      try {
        osc.frequency.cancelScheduledValues(t);
        osc.frequency.setTargetAtTime(chord[i] ?? chord[0], t, 0.28);
      } catch { /* oscillator already stopped */ }
    });
    this.padGains.forEach((gain) => {
      try { gain.gain.setTargetAtTime(vol, t, 0.3); } catch { /* gone */ }
    });
  }

  private stopPad() {
    const t = this.ctx?.currentTime ?? 0;
    for (const gain of this.padGains) {
      try { gain.gain.setTargetAtTime(0.0001, t, 0.08); } catch {}
    }
    const oscs = this.padOscillators;
    this.padOscillators = [];
    this.padGains = [];
    if (oscs.length === 0) return;
    window.setTimeout(() => {
      for (const osc of oscs) {
        try { osc.stop(); osc.disconnect(); } catch {}
      }
    }, 250);
  }

  // ─── One-shot jingles (victory / defeat) ────────────────────────────────────
  /** Победа (~3 с): восходящий мажорный забег-фанфар + аккорд. */
  public playVictoryJingle() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const dest = this.musicGain;
    // Быстрый забег вверх.
    [523.25, 587.33, 659.25, 783.99].forEach((freq, i) => {
      this.playMusicNote(freq, t + i * 0.11, 0.22, 0.07, "triangle", 3200, { dest, delay: true });
    });
    // Торжественное трезвучие с сустейном.
    for (const [freq, delay] of [[523.25, 0.5], [659.25, 0.5], [783.99, 0.5], [1046.5, 0.62]] as const) {
      this.playMusicNote(freq, t + delay, 2.2, 0.05, "triangle", 3200, { dest, delay: true });
    }
    // Низкий удар-финал.
    this.playMusicNote(130.81, t + 0.5, 1.6, 0.07, "sine", 400, { dest });
  }

  /** Поражение (~2.5 с): нисходящая фраза в ля-миноре + тяжёлый обрыв. */
  public playGameOverSting() {
    if (this.isMuted) return;
    this.resume();
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const dest = this.musicGain;
    const descend: [number, number][] = [[440, 0], [392, 0.3], [329.63, 0.6], [349.23, 0.9]];
    for (const [freq, delay] of descend) {
      this.playMusicNote(freq, t + delay, 0.55, 0.055, "sine", 1800, { dest, delay: true });
    }
    // Спад в низ.
    this.playMusicNote(220, t + 1.25, 0.5, 0.05, "triangle", 900, { dest });
    this.playMusicNote(110, t + 1.55, 1.4, 0.08, "sine", 400, { dest });
  }
}

export const audio = new SoundEngine();
