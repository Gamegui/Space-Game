import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  THEMES, soundtrackMeta, musicThemeForBoss, BOSS_MUSIC_THEMES,
  type MusicTheme,
} from "../src/game/audio";

const CORE_IDS: Array<Exclude<MusicTheme, null>> = ["menu", "combat"];
const TONIC_A2 = 110;

function almost(freq: number, target: number, cents = 60) {
  const ratio = freq / target;
  const diff = Math.abs(1200 * Math.log2(ratio));
  return diff <= cents;
}

describe("soundtrack v2.9.4", () => {
  it("exposes menu, combat and six unique boss themes", () => {
    const keys = Object.keys(THEMES).sort();
    assert.deepEqual(keys, [...CORE_IDS, ...BOSS_MUSIC_THEMES].sort());
  });

  it("maps each boss type to its own theme", () => {
    for (const id of BOSS_MUSIC_THEMES) {
      assert.equal(musicThemeForBoss(id), id);
    }
    assert.equal(musicThemeForBoss("scout"), "boss_omega");
    assert.equal(musicThemeForBoss(undefined), "boss_omega");
  });

  it("keeps every theme in A so scene changes do not clash in key", () => {
    for (const id of Object.keys(THEMES) as Array<Exclude<MusicTheme, null>>) {
      const roots = THEMES[id].bars.map((bar) => bar.chord[0]);
      assert.ok(
        almost(roots[0], TONIC_A2) || almost(roots[0], TONIC_A2 * 2),
        `${id} does not open on A (got ${roots[0]})`,
      );
    }
  });

  it("gives each theme a 4-bar form with 16-step layers", () => {
    for (const id of Object.keys(THEMES) as Array<Exclude<MusicTheme, null>>) {
      const theme = THEMES[id];
      assert.equal(theme.bars.length, 4, `${id} should be 4 bars`);
      for (const [i, bar] of theme.bars.entries()) {
        assert.equal(bar.bass.length, 16, `${id} bar ${i} bass`);
        assert.equal(bar.lead.length, 16, `${id} bar ${i} lead`);
        if (bar.lead2) assert.equal(bar.lead2.length, 16, `${id} bar ${i} lead2`);
        assert.equal(bar.kick.length, 16, `${id} bar ${i} kick`);
        assert.equal(bar.snare.length, 16, `${id} bar ${i} snare`);
        assert.equal(bar.hat.length, 16, `${id} bar ${i} hat`);
        assert.equal(bar.chord.length, 3, `${id} bar ${i} chord`);
      }
    }
  });

  it("uses musical frequencies and leaves space in the lead", () => {
    const meta = soundtrackMeta();
    for (const row of meta) {
      assert.ok(row.bpm >= 50 && row.bpm <= 130, `${row.id} bpm ${row.bpm}`);
      assert.ok(row.leadRestRatio >= 0.35, `${row.id} lead is too busy (${row.leadRestRatio})`);
    }
    for (const id of Object.keys(THEMES) as Array<Exclude<MusicTheme, null>>) {
      for (const bar of THEMES[id].bars) {
        for (const freq of [...bar.bass, ...bar.lead, ...(bar.lead2 ?? []), ...bar.chord]) {
          if (freq === null) continue;
          assert.ok(Number.isFinite(freq), `${id} non-finite freq`);
          assert.ok(freq >= 40 && freq <= 2000, `${id} freq ${freq} out of range`);
        }
      }
    }
  });

  it("makes the menu slower than combat, and bosses heavier not frantic", () => {
    assert.ok(THEMES.menu.bpm < THEMES.combat.bpm);
    assert.ok(THEMES.combat.bpm < 125, "combat bpm was 132 and felt cheap/rushed");
    for (const id of BOSS_MUSIC_THEMES) {
      assert.ok(THEMES[id].bpm <= THEMES.combat.bpm, `${id} bpm ${THEMES[id].bpm} faster than combat`);
    }
  });

  it("keeps drums out of the menu and present on combat and every boss", () => {
    const any = (bars: typeof THEMES.menu.bars, key: "kick" | "snare" | "hat") =>
      bars.some((bar) => bar[key].some(Boolean));
    assert.equal(any(THEMES.menu.bars, "kick"), false);
    assert.equal(any(THEMES.menu.bars, "snare"), false);
    assert.equal(any(THEMES.combat.bars, "kick"), true);
    assert.equal(any(THEMES.combat.bars, "snare"), true);
    for (const id of BOSS_MUSIC_THEMES) {
      assert.equal(any(THEMES[id].bars, "kick"), true, `${id} needs a kick`);
    }
  });

  it("gives each boss a unique tempo, timbre and lead phrase", () => {
    const bpms = new Set(BOSS_MUSIC_THEMES.map((id) => THEMES[id].bpm));
    assert.equal(bpms.size, 6, "boss BPM values must all differ");
    const prints = BOSS_MUSIC_THEMES.map((id) => JSON.stringify({
      bpm: THEMES[id].bpm,
      bassWave: THEMES[id].bassWave,
      leadWave: THEMES[id].leadWave,
      lead: THEMES[id].bars.map((bar) => bar.lead),
      bass: THEMES[id].bars.map((bar) => bar.bass),
      kick: THEMES[id].bars.map((bar) => bar.kick),
    }));
    assert.equal(new Set(prints).size, 6, "boss themes must not share the same phrase");
  });

  it("makes every boss hook louder and thicker than combat so it is actually heard", () => {
    for (const id of BOSS_MUSIC_THEMES) {
      const theme = THEMES[id];
      assert.ok(theme.leadVol > THEMES.combat.leadVol, `${id} leadVol ${theme.leadVol} is not louder than combat`);
      assert.ok((theme.leadHold ?? 1.35) >= 1.5, `${id} leadHold too short to sing`);
      assert.ok((theme.leadDetune ?? 0) >= 5, `${id} needs detune so the lead reads as a thick hook`);
      assert.ok((theme.kickVol ?? 0) >= 0.09, `${id} kick is too quiet`);
      for (const [i, bar] of theme.bars.entries()) {
        assert.ok(bar.lead2, `${id} bar ${i} missing harmony line`);
        const sounded = bar.lead2!.some((n) => n !== null);
        assert.ok(sounded, `${id} bar ${i} lead2 is silent`);
      }
    }
  });
});
