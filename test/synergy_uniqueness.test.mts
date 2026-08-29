import { test } from "node:test";
import assert from "node:assert/strict";
import { SYNERGIES } from "../src/game/synergies.ts";
import { EVOLUTIONS } from "../src/game/evolutions.ts";

test("P0.3 duplicate requirements uniqueness", () => {
  const all = [
    ...SYNERGIES.map(s => ({ id: s.id, requires: [...s.requires].sort().join("+") })),
    ...EVOLUTIONS.map(e => ({ id: e.id, requires: [...e.requires].sort().join("+") })),
  ];
  const seen = new Map<string, string>();
  for (const item of all) {
    if (seen.has(item.requires)) {
      throw new Error(`Duplicate requires ${item.requires} between ${seen.get(item.requires)} and ${item.id}`);
    }
    seen.set(item.requires, item.id);
  }
  assert.equal(seen.size, all.length);
});

test("autonomous_fleet and drone_swarm evolution are distinct", () => {
  const fleetSyn = SYNERGIES.find(s => s.id === "autonomous_fleet");
  const droneEvo = EVOLUTIONS.find(e => e.id === "drone_swarm");
  assert.ok(fleetSyn);
  assert.ok(droneEvo);
  const synReq = [...fleetSyn!.requires].sort().join("+");
  const evoReq = [...droneEvo!.requires].sort().join("+");
  assert.notEqual(synReq, evoReq);
});

test("void_engine and phase_reaper are distinct and have 4 requirements", () => {
  const voidSyn = SYNERGIES.find(s => s.id === "void_engine");
  const reaperEvo = EVOLUTIONS.find(e => e.id === "phase_reaper");
  assert.ok(voidSyn);
  assert.ok(reaperEvo);
  assert.ok(voidSyn!.requires.length >= 4);
  assert.ok(reaperEvo!.requires.length >= 4);
  const synReq = [...voidSyn!.requires].sort().join("+");
  const evoReq = [...reaperEvo!.requires].sort().join("+");
  assert.notEqual(synReq, evoReq);
});
