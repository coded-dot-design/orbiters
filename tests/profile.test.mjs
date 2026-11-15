// The profile (src/profile.ts): fresh → save → load; a v1 save migrates (booleans to lists, the reach
// to worlds); a partial or out-of-range save is repaired; garbage loads fresh; a newer game's save is
// never written over; the export code round-trips and a typo is caught; a mission done pays, fits its
// part and opens the next world; parts and premium looks cost credits.
import test from "node:test";
import assert from "node:assert/strict";

const P = await import("../src/profile.ts");
const mem = () => { const m = new Map(); return { m, get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; };

test("fresh → save → load", () => {
  const s = mem(), p = { ...P.fresh(), credits: 120, look: { ...P.fresh().look, paint: 2 } };
  assert.equal(P.save(p, s), true);
  assert.deepEqual(P.load(s).profile, p);
});
test("migrate v1", () => {
  const s = mem();
  s.set(P.KEY, JSON.stringify({ v: 1, name: "kip", credits: 50, parts: { tyres: true, claw: false }, reach: 2 }));
  const p = P.load(s).profile;
  assert.equal(p.v, P.VERSION);
  assert.deepEqual([p.name, p.parts, p.fit, p.unlocked, p.cleared], ["KIP", ["tyres"], ["tyres"], ["pebble", "rime", "dunemar"], ["pebble", "rime"]]);
});
test("normalize repairs; garbage loads fresh; newer is kept, never written over", () => {
  const p = P.normalize({ credits: -5, look: { paint: 99, body: 1 }, unlocked: ["nowhere"], parts: ["claw", "laser"], fit: ["tank"], at: "halo" });
  assert.deepEqual([p.credits, p.look.paint, p.look.body, p.unlocked, p.parts, p.fit, p.at], [0, 0, 1, ["pebble"], ["claw"], [], "pebble"]);
  const s = mem();
  s.set(P.KEY, "{oops");
  assert.deepEqual(P.load(s).profile, P.fresh());
  s.set(P.KEY, JSON.stringify({ v: 99, credits: 7 }));
  const l = P.load(s);
  assert.equal(l.newer, true);
  assert.equal(P.save(l.profile, s, l.newer), false);
  assert.match(s.get(P.KEY), /"v":99/);
});
test("export code round-trips; a typo is caught", () => {
  const p = P.complete(P.fresh(), "pebble"), code = P.exportCode(p);
  assert.deepEqual(P.importCode(code), p);
  assert.equal(P.importCode(code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11)), null);
  assert.equal(P.importCode("hello"), null);
});
test("the story: a mission pays, fits its part and opens the next world", () => {
  let p = P.complete(P.fresh(), "pebble");
  assert.deepEqual([p.credits, p.cleared, p.unlocked], [300, ["pebble"], ["pebble", "rime"]]);
  assert.equal(P.complete(p, "pebble"), p, "only once");
  p = P.complete(p, "rime");
  assert.deepEqual([p.parts, p.fit, p.unlocked.length], [["tyres"], ["tyres"], 3]);
});
test("the garage: parts and premium looks cost credits", () => {
  let p = P.fresh();
  assert.equal(P.buyPart(p, "claw"), p, "short of credits");
  p = { ...p, credits: 700 };
  p = P.buyPart(p, "claw");
  assert.deepEqual([p.credits, p.parts, p.fit], [200, ["claw"], ["claw"]]);
  p = P.fitPart(p, "claw", false);
  assert.deepEqual(p.fit, []);
  p = P.setLook(p, "paint", 5);
  assert.deepEqual([p.look.paint, p.credits, p.owned], [5, 50, ["paint:5"]]);
  p = P.setLook(p, "trim", 5);
  assert.equal(p.credits, 50, "owned paint is free for the trim too");
  assert.equal(P.setLook(p, "decal", 3), p, "short of credits");
  assert.equal(P.setLook(p, "paint", 1).look.paint, 1, "free colours are free");
});
