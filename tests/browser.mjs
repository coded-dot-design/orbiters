// Moon Rover in Chromium (dist/moon-rover.mjs on a plain page): the map mounts and settles with no
// audio; DRIVE mounts Pebble, the world draws, ↑ drives, Space fires; drive up to the elder and E
// talks (a speech bubble) and takes the mission; the cells count, the hand-in pays and opens Rime
// (saved); the pad launches the warp and Rime mounts; a garage change is saved and survives a reload;
// at 390 (touch) the pad shows, keys are 44 px or more, the play surface has touch-action none, the
// stick drives and ACT talks; Recall gives the page back byte for byte. Waits on state, never time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const fixture = readFileSync("tests/fixtures/page.html", "utf8");
const withGame = fixture.replace("</body>", `<script>const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.audio = (window.audio || 0) + 1; } };</script><script type="module">import { createMoonRover } from "/dist/moon-rover.mjs"; window.before = document.body.innerHTML; window.game = createMoonRover({ host: document.getElementById("board"), seed: 3 });</script></body>`);
const server = await serve(".", { "/": withGame });
const browser = await chromium.launch(launchOptions());
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const ws = (p) => p.evaluate(() => game.world?.state);
const sr = "document.querySelector('[data-fizlet-host]').shadowRoot";

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(server.url + "/");
  await until(p, () => window.game && game.engine.paused.includes("settled"), null, "the map settles");
  assert.equal(await p.evaluate(() => game.getSnapshot().screen), "map");
  assert.equal(await p.evaluate(() => window.audio || 0), 0, "no audio before a gesture");
  await p.evaluate(`${sr}.querySelector('[data-drive=pebble]').click()`);
  await until(p, () => game.world?.state.drawn, null, "Pebble draws");
  const px = await p.evaluate(`(() => { const c = ${sr}.querySelector('canvas.mr-canvas'); return [...c.getContext('2d').getImageData(c.width >> 1, (c.height * 0.7) | 0, 1, 1).data]; })()`);
  assert.equal(px[3], 255, "the world is drawn");
  await p.focus("[data-fizlet-host]").catch(() => {});
  await p.evaluate(`${sr}.querySelector('.mr-play').focus()`);
  await p.keyboard.down("ArrowUp");
  await until(p, () => game.world.state.phase === 1 && game.world.state.speed > 2, null, "↑ drives");
  await p.keyboard.up("ArrowUp");
  await p.keyboard.down("Space");
  await until(p, () => { let n = 0; for (let b = 0; b < 10; b++) n += game.world.run.BO[b * 7] > 0 ? 1 : 0; return n > 0; }, null, "Space fires");
  await p.keyboard.up("Space");
  // The elder: drive up, E talks and takes the mission.
  await p.evaluate(() => game.world.near(game.world.run.friend.subarray(0, 3), 2.5));
  await until(p, () => game.world.state.near === 0, null, "the elder is near");
  await p.keyboard.press("e");
  await until(p, () => game.world.state.mission === 1 && game.world.state.talking, null, "E takes the mission");
  assert.match((await ws(p)).says, /power cells/, "the elder speaks");
  // The cells, then back to the elder.
  for (let k = 0; k < 6; k++) {
    await p.evaluate((k) => game.world.near(game.world.run.target.subarray(k * 3, k * 3 + 3), 0.6), k);
    await until(p, (k) => game.world.state.progress >= k + 1, k, `cell ${k + 1}`);
  }
  assert.equal((await ws(p)).mission, 2, "all found: back to the elder");
  await p.evaluate(() => game.world.near(game.world.run.friend.subarray(0, 3), 2.5));
  await until(p, () => game.world.state.near === 0, null, "back at the elder");
  await p.keyboard.press("Enter");
  await until(p, () => game.getSnapshot().cleared.includes("pebble"), null, "the mission is done");
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("moon-rover:profile")));
  assert.deepEqual([saved.cleared, saved.unlocked, saved.credits >= 300], [["pebble"], ["pebble", "rime"], true], "saved: Rime open, paid");
  // The pad: launch, the warp, Rime.
  await p.evaluate(() => game.world.near(game.world.run.pad, 0.5));
  await p.keyboard.press("ArrowUp");
  await until(p, () => game.getSnapshot().screen === "flight", null, "the pad launches");
  await until(p, () => game.getSnapshot().screen === "drive" && game.world?.state.planet === "rime" && game.world.state.drawn, null, "Rime mounts");
  // The garage: a change is saved and survives a reload.
  await p.evaluate(() => game.show("garage"));
  await until(p, () => game.getSnapshot().screen === "garage", null, "the garage");
  await p.evaluate(`${sr}.querySelector('[data-look=body][aria-label^=Next]').click()`);
  await p.evaluate(`${sr}.querySelector('[data-look=suit][aria-label^=Next]').click()`);
  const look = await p.evaluate(() => game.profile.look);
  assert.deepEqual([look.body, look.suit], [1, 7], "body and suit changed");
  await p.reload();
  await until(p, () => window.game, null, "reloads");
  assert.deepEqual(await p.evaluate(() => [game.profile.look.body, game.profile.look.suit, game.profile.at]), [1, 7, "rime"], "the garage change persists");
  // Recall.
  await p.evaluate(() => game.destroy());
  assert.equal(await p.evaluate(() => document.body.innerHTML === window.before), true, "Recall gives the page back");
  assert.deepEqual(errs, [], "no page errors");
  await ctx.close();

  // Phone: the pad, 44 px keys, touch-action none, the stick drives, ACT talks.
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const q = await ph.newPage();
  await q.goto(server.url + "/");
  await until(q, () => window.game, null, "phone: mounts");
  await q.evaluate(() => game.drive("pebble"));
  await until(q, () => game.world?.state.drawn, null, "phone: draws");
  const m = await q.evaluate(`(() => { const r = ${sr}; const keys = [...r.querySelectorAll('.mr-key, .mr-pad button')].filter((b) => b.offsetParent).map((b) => { const k = b.getBoundingClientRect(); return Math.min(k.width, k.height); }); return { pad: !!r.querySelector('.mr-pad').offsetParent, keys, touch: getComputedStyle(r.querySelector('.mr-play')).touchAction }; })()`);
  assert.ok(m.pad, "phone: the pad shows");
  assert.ok(m.keys.length >= 5 && m.keys.every((k) => k >= 44), `phone: keys ≥ 44 px (${m.keys.join(", ")})`);
  assert.equal(m.touch, "none", "phone: touch-action none");
  const stick = await q.evaluate(`(() => { const s = ${sr}.querySelector('.mr-pad .bui-stick, .mr-pad [class*=stick]'); const b = s.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  await q.mouse.move(stick[0], stick[1]);
  await q.mouse.down();
  await q.mouse.move(stick[0], stick[1] - 40, { steps: 4 });
  await until(q, () => game.world.state.phase === 1 && game.world.state.speed > 2, null, "phone: the stick drives");
  await q.mouse.up();
  await q.evaluate(() => game.world.near(game.world.run.friend.subarray(0, 3), 2.5));
  await until(q, () => game.world.state.near === 0, null, "phone: at the elder");
  const act = await q.evaluate(`(() => { const b = [...${sr}.querySelectorAll('.mr-pad button')].find((x) => /ACT|Talk/.test(x.textContent + x.getAttribute('aria-label'))).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  await q.touchscreen.tap(act[0], act[1]);
  await until(q, () => game.world.state.mission === 1, null, "phone: ACT talks and takes the mission");
  await ph.close();
  console.log("Moon Rover: browser green (map settles, drive, fire, talk, mission, hand-in, saved, pad → warp → Rime, garage persists, Recall, phone pad + stick + ACT).");
} finally {
  await browser.close();
  await server.close();
}
