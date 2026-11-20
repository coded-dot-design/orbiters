// The Orbiters site on Cloudflare Pages: the landing page (/) and the game (/play/).
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  root,
  srcDir: root + "site/src",
  publicDir: root + "site/public",
  outDir: root + "artifacts/pages",
  // Custom domain: SITE_URL=https://orbiters.fzlt.games and SITE_BASE=/ (the defaults; cloudflare.yml sets them per target).
  site: process.env.SITE_URL || "https://orbiters.fzlt.games",
  base: process.env.SITE_BASE || "/",
  trailingSlash: "always",
  output: "static",
  devToolbar: { enabled: false },
  server: { host: "127.0.0.1", port: 4327 },
});
