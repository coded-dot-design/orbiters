// After `astro build`: check every local link in the built site resolves (artifacts/pages is exactly
// what GitHub Pages serves: / the landing page, /play/ the game).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
const out = resolve("artifacts/pages");
if (!existsSync(join(out, "index.html"))) throw Error("Run astro build first (npm run site:build).");
const BASE = `${(process.env.SITE_BASE || "/").replace(/\/$/, "")}/`;
const pages = [];
const walk = (dir) => readdirSync(dir).forEach((n) => { const f = join(dir, n); statSync(f).isDirectory() ? walk(f) : f.endsWith(".html") && pages.push(f); });
walk(out);
const missing = [];
for (const page of pages)
  for (const [, url] of readFileSync(page, "utf8").matchAll(/(?:href|src)="([^"#?]+)/g)) {
    if (/^(https?:|mailto:|data:)/.test(url)) continue;
    const path = url.startsWith(BASE) ? url.slice(BASE.length) : url.startsWith("/") ? null : join(dirname(page).slice(out.length + 1), url);
    if (path === null) { missing.push(`${page}: ${url} (outside ${BASE})`); continue; }
    let file = join(out, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) missing.push(`${page.slice(out.length)}: ${url}`);
  }
if (missing.length) throw Error(`Broken links:\n${missing.join("\n")}`);
console.log(`Pages ready: ${pages.length} pages (/ and /play/), Orbiters ${JSON.parse(readFileSync("package.json", "utf8")).version}.`);
