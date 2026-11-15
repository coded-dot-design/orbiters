// The size of every build, gzip, against the budget. Board games have no fixed cap (the size ledger
// tracks them); this budget is the first measured build plus room, raised only with a measured reason.
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
// 0.1.0: the first measured build (see dist/build.json) plus about 10% room.
const BUDGET = 70_000;
let failed = false;
for (const file of readdirSync("dist").filter((f) => /\.m?js$/.test(f)).sort().map((f) => `dist/${f}`)) {
  const gz = gzipSync(readFileSync(file)).length, ok = gz <= BUDGET;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${file} ${gz.toLocaleString("en-US")} / ${BUDGET.toLocaleString("en-US")} bytes gzip`);
}
if (failed) process.exit(1);
