// A static server for the tests: the repo's files (dist/, tests/fixtures/) or a built site directory.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".xml": "application/xml", ".txt": "text/plain" };
/** Serve `dir` on a free port (under `prefix`, e.g. the site's base path); `pages` maps a path to
 *  inline HTML. Resolves to { url, close }. */
export function serve(dir = ".", pages = {}, prefix = "") {
  const base = resolve(dir);
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (prefix && path.startsWith(prefix)) path = path.slice(prefix.length) || "/";
    if (pages[path]) return res.writeHead(200, { "content-type": "text/html" }), res.end(pages[path]);
    let file = normalize(join(base, path));
    if (!file.startsWith(base)) return res.writeHead(403), res.end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404), res.end("not found");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}
/** Chromium: CHROMIUM_PATH, else Playwright's own. */
export const launchOptions = () => (process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
