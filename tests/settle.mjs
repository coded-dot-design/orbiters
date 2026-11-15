// Moon Rover's settle guard (Chromium, dist/moon-rover.mjs): the map and the garage sleep (no frames,
// no audio before a gesture); a world waiting for the first press sleeps; driving it never does, the
// clock keeping pace with the wall clock with nobody touching anything; scrolled off screen it pauses;
// the ROVER DOWN card settles; after Recall no frame runs. Waits on state.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8").replace("<p>After it.</p>", '<p>After it.</p><div style="height:3000px"></div>');
const page = fixture.replace("</body>", `<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script><script type="module">import { createMoonRover } from "/dist/moon-rover.mjs"; window.game = createMoonRover({ host: document.getElementById("board"), seed: 4, store: { get: () => null, set() {} } });</script></body>`);
const server = await serve(".", { "/": page });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 30000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const frames = (p, n = 12) => p.evaluate(async (n) => { const f = () => game.engine.stats().frames + (game.world ? game.world.engine.stats().frames : 0), a = f(); for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r)); return f() - a; }, n);

try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(server.url + "/");
  await until(p, () => window.game && game.engine.paused.includes("settled"), null, "the map settles");
  assert.equal(await frames(p), 0, "map: no frames");
  assert.equal(await p.evaluate(() => window.audio || 0), 0, "no audio before a gesture");
  await p.evaluate(() => game.show("garage"));
  await until(p, () => game.engine.paused.includes("settled"), null, "the garage settles");
  assert.equal(await frames(p), 0, "garage: no frames");
  await p.evaluate(() => game.drive("pebble"));
  await until(p, () => game.world?.state.phase === 0 && game.world.engine.paused.includes("settled") && game.engine.paused.includes("settled"), null, "waiting for the first press it settles");
  assert.equal(await frames(p), 0, "ready: no frames");
  await p.evaluate(() => (game.world.auto = true));
  await until(p, () => game.world.state.phase === 1, null, "drives");
  const a = await p.evaluate(() => ({ t: game.world.run.S[16], w: performance.now() }));
  await until(p, (a) => performance.now() - a.w > 2000, a, "two seconds pass");
  const b = await p.evaluate(() => ({ t: game.world.run.S[16], w: performance.now(), paused: game.world.engine.paused.slice() }));
  const rate = (b.t - a.t) / ((b.w - a.w) / 1000);
  assert.ok(rate > 0.3, `driving keeps pace: ${rate.toFixed(2)}×`);
  assert.deepEqual(b.paused, [], "never asleep while driving");
  await p.evaluate(() => scrollTo(0, 3000));
  await until(p, () => game.world.engine.paused.includes("offscreen"), null, "off screen it pauses");
  assert.equal(await frames(p), 0, "off screen: no frames");
  await p.evaluate(() => scrollTo(0, 0));
  await p.evaluate(() => { game.world.auto = false; game.world.run.S[6] = 0; });
  await until(p, () => game.world.state.down, null, "rover down");
  await until(p, () => game.world.engine.paused.includes("settled"), null, "the down card settles");
  assert.equal(await frames(p), 0, "down card: no frames");
  await p.evaluate(() => game.destroy());
  assert.equal(await frames(p), 0, "after Recall: no frames");
  console.log("Moon Rover: settle guard green (map, garage, a waiting world and the down card sleep; driving never does; off screen pauses; quiet after Recall).");
} finally {
  await browser.close();
  await server.close();
}
