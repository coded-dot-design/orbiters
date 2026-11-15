// The site's stills, from the game itself (dist/orbiters.mjs) in Chromium: the hero's reduced-motion
// poster (shots/hero.jpg, 1600×900) and the share image (shots/og.jpg, 1200×630), both a moment of the
// attract drive on Pebble. Run after `npm run build`: node scripts/shots.mjs (CHROMIUM_PATH optional).
import { chromium } from "playwright";
import { serve, launchOptions } from "../tests/serve.mjs";
const page = `<!doctype html><html data-theme="dark"><body style="margin:0;background:#03041a"><div id=h style="position:fixed;inset:0"></div><script type=module>import { createOrbiters } from "/dist/orbiters.mjs"; window.g = createOrbiters({ host: document.getElementById("h"), attract: true, sound: false });</script>`;
const s = await serve(".", { "/": page });
const b = await chromium.launch(launchOptions());
try {
  for (const [file, width, height, at] of [["hero.jpg", 1600, 900, 7], ["og.jpg", 1200, 630, 7]]) {
    const p = await b.newPage({ viewport: { width, height } });
    await p.goto(s.url + "/");
    await p.waitForFunction((at) => window.g?.world && g.world.run.S[16] >= at, at, { timeout: 60000, polling: 16 });
    await p.evaluate(() => g.world.engine.stop());
    await p.screenshot({ path: `site/public/shots/${file}`, type: "jpeg", quality: 84 });
    await p.close();
    console.log(`site/public/shots/${file}`);
  }
} finally {
  await b.close();
  await s.close();
}
