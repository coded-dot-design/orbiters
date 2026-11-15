// The visit, headless (src/run.ts): six worlds build; every world's mission can be finished by the
// autopilot (the giver offers it on ACT, the steps count, the reward point is reached, the pad opens);
// the race fails when the clock runs out; Cinder's rescue needs the tow claw; a cleared world starts
// with the pad open; the same inputs give the same visit bit for bit; zero allocation per step.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";

const R = await import("../src/run.ts");
const { PLANETS, planet } = await import("../src/planets.ts");
const drive = (r, steps, I = new Float64Array(7)) => {
  const seen = new Set();
  for (let t = 0; t < steps; t++) {
    r.autopilot(I);
    r.step(1 / 60, I);
    for (let k = 0; k < r.n; k++) seen.add(r.ev[k * 5]);
    r.clear();
    if (r.S[R.PH] === R.DOWN) r.respawn();
    if (r.S[R.PH] === R.GONE) break;
  }
  return seen;
};

test("six original worlds, each with its own mission kind, friends and foes", () => {
  assert.equal(PLANETS.length, 6);
  assert.deepEqual(PLANETS.map((p) => p.mission.kind), ["collect", "race", "deliver", "rescue", "defend", "beacon"]);
  assert.equal(new Set(PLANETS.map((p) => p.friend.name)).size, 6);
});

for (const pl of PLANETS)
  test(`${pl.id}: the autopilot takes the mission, finishes it and launches from the pad`, () => {
    const r = R.roverRun(pl, { claw: true });
    const seen = drive(r, 60 * 600);
    assert.ok(seen.has(R.E_MSTART), "the elder offers the mission on ACT");
    assert.ok(seen.has(R.E_MSTEP), "steps count");
    assert.ok(seen.has(R.E_MDONE), "the mission is done");
    assert.equal(r.S[R.MP], R.M_DONE);
    assert.equal(r.S[R.PH], R.GONE, "launched from the pad");
  });

test("rime: the race fails when the clock runs out, and can be taken again", () => {
  const r = R.roverRun(planet("rime"));
  const I = new Float64Array(7);
  r.talk(R.GIVER);
  assert.equal(r.S[R.MP], R.M_RUN);
  I[R.IN_ACT] = 1;
  let failed = false;
  for (let t = 0; t < 60 * 75 && !failed; t++) { r.step(1 / 60, I); I.fill(0); for (let k = 0; k < r.n; k++) failed ||= r.ev[k * 5] === R.E_MFAIL; r.clear(); }
  assert.ok(failed, "too slow");
  assert.equal(r.S[R.MP], R.M_OFFER);
});

test("cinder: the stranded need a tow claw", () => {
  const r = R.roverRun(planet("cinder"));
  const seen = drive(r, 60 * 120);
  assert.ok(seen.has(R.E_NEED), "told to fit the claw");
  assert.equal(r.S[R.MK], 0, "none towed without it");
});

test("a cleared world starts free roam with the pad open", () => {
  const r = R.roverRun(planet("pebble"), { cleared: true });
  assert.equal(r.S[R.MP], R.M_DONE);
  assert.equal(r.goal(), 2, "the goal is the pad");
});

test("parts: armour adds a shield", () => {
  assert.equal(R.roverRun(planet("pebble"), { armour: true }).S[R.SHD], 4);
});

test("determinism: the same inputs give the same visit", () => {
  const go = () => {
    const r = R.roverRun(planet("halo"), { claw: true }, 99), I = new Float64Array(7), out = [];
    for (let t = 0; t < 60 * 40; t++) {
      r.autopilot(I);
      if (t % 90 < 20) I[R.IN_BOOST] = 1;
      if (t % 200 === 0) I[R.IN_JUMP] = 1;
      r.step(1 / 60, I);
      r.clear();
      if (r.S[R.PH] === R.DOWN) r.respawn();
    }
    return [...r.S, ...r.P, ...r.SH];
  };
  assert.deepEqual(go(), go());
});

test("alloc: a visit on Pebble, 6,000 steps, no young-generation GCs", async () => {
  const r = R.roverRun(planet("pebble"), { claw: true }), I = new Float64Array(7);
  const work = () => { r.reset(); for (let t = 0; t < 6000; t++) { r.autopilot(I); r.step(1 / 60, I); r.clear(); if (r.S[R.PH] === R.DOWN) r.respawn(); } };
  work(); work();
  const n = await minorGCs(work, 5);
  assert.ok(n <= 1, `${n} young-generation GCs`);
});
