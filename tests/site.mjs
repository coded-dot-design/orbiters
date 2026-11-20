// The built site (artifacts/pages, `npm run site:build` first) in Chromium, at 1440 and 390, dark and
// light: the landing hero is the game's attract drive (drawn, driving, its HUD hidden) with the title,
// the hook and a PLAY link to /play/; the sections (how to play, the six worlds, the aliens, the
// garage, built on Fizlet with the measured size, by Chris Cooley); no sideways scroll. Reduced
// motion: the still poster, no game. /play/ mounts the game on the system map. SHOTS=<dir> saves
// a screenshot of each.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { serve, launchOptions } from "./serve.mjs";

const BASE = (process.env.SITE_BASE || "/").replace(/\/$/, "");
const server = await serve("artifacts/pages", {}, BASE);
const browser = await chromium.launch(launchOptions());
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const until = (p, fn, arg, what, timeout = 20000) => p.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => assert.fail(`${what}: timed out`));
const gz = JSON.parse(readFileSync("dist/build.json", "utf8")).gzip["orbiters.mjs"];

try {
  for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]])
    for (const theme of ["dark", "light"]) {
      const at = `${w} ${theme}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      await ctx.addInitScript((t) => localStorage.setItem("dom-virus:theme", t), theme);
      const p = await ctx.newPage(), errs = [];
      p.on("pageerror", (e) => errs.push(e.message));
      await p.goto(`${server.url}${BASE}/`);
      await until(p, () => window.hero?.world && hero.world.state.speed > 2, null, `${at}: the hero drives`);
      const m = await p.evaluate(() => {
        const root = document.querySelector("#dt-hero [data-fizlet-host]").shadowRoot, cv = root.querySelector("canvas.mr-canvas"), px = cv.getContext("2d").getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
        const play = document.querySelector(".start-key");
        return {
          theme: document.documentElement.dataset.theme,
          drawn: px[3] === 255,
          hud: root.querySelector(".mr-hud").hidden && root.querySelector(".mr-pad").hidden,
          h1: document.querySelector("h1").textContent.trim(),
          play: play.getAttribute("href"),
          playSize: Math.min(play.getBoundingClientRect().width, play.getBoundingClientRect().height) >= 44,
          sections: ["how", "worlds", "aliens", "garage", "fizlet"].every((id) => document.getElementById(id)),
          worlds: document.querySelectorAll("#worlds li").length,
          size: document.getElementById("fizlet").textContent.replace(/\s+/g, " "),
          by: /by Chris Cooley/i.test(document.body.textContent),
          sideways: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.equal(m.theme, theme, `${at}: the theme`);
      assert.ok(m.drawn && m.hud, `${at}: the hero draws the drive, no HUD over the copy`);
      assert.equal(m.h1, "Orbiters.Six small worlds. One rover.", `${at}: the title and hook`);
      assert.match(m.play, /\/play\/$/, `${at}: PLAY links to /play/`);
      assert.ok(m.playSize && m.sections && m.worlds === 6 && m.by, `${at}: PLAY ≥ 44 px, five sections, six worlds, by Chris Cooley`);
      assert.ok(m.size.includes(`${gz.toLocaleString("en-US")} bytes gzip`), `${at}: the measured size (${gz} B)`);
      assert.equal(m.sideways, false, `${at}: no sideways scroll`);
      if (SHOTS) {
        await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}.png` });
        if (!touch) await p.screenshot({ path: `${SHOTS}/landing-${w}-${theme}-full.png`, fullPage: true });
      }
      await p.goto(`${server.url}${BASE}/play/`);
      await until(p, () => window.game && game.getSnapshot().screen === "map", null, `${at}: /play/ mounts on the map`);
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/play-${w}-${theme}.png` });
      assert.deepEqual(errs, [], `${at}: no page errors`);
      await ctx.close();
    }
  const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const r = await rm.newPage();
  await r.goto(`${server.url}${BASE}/`);
  await until(r, () => !document.querySelector(".dt-poster").hidden, null, "reduced motion: the poster");
  assert.equal(await r.evaluate(() => !!window.hero), false, "reduced motion: no game");
  await rm.close();
  console.log("Orbiters site: green at 1440 and 390, dark and light; reduced motion shows the poster.");
} finally {
  await browser.close();
  await server.close();
}
