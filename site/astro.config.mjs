// The Moon Rover site on GitHub Pages: the landing page (/) and the game (/play/).
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  root,
  srcDir: root + "site/src",
  publicDir: root + "site/public",
  outDir: root + "artifacts/pages",
  // Custom domain: SITE_URL=https://moonrover.domvirus.com and SITE_BASE=/ (pages.yml defaults).
  site: process.env.SITE_URL || "https://coded-dot-design.github.io",
  base: process.env.SITE_BASE || "/moon-rover",
  trailingSlash: "always",
  output: "static",
  devToolbar: { enabled: false },
  server: { host: "127.0.0.1", port: 4327 },
});
