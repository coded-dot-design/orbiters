// Moon Rover, the shell: the system map (six worlds, the route the beacons open), the garage (pilot
// and rover: looks, parts, the export code), the drive (a world, ./scene.ts) and the flight between
// worlds. It owns the profile (./profile.ts): the mission rewards, trades and garage buys land in it
// and it is saved at once. Board UI stickers in a shadow root, so the page and the game never touch
// each other's styles; every page write goes through the kernel's ledger, so Recall gives the page
// back.
import { createEngine } from "@fzlt/core/kernel";
import { mount as buiMount } from "@fzlt/core/ui";
import { diorama } from "@fzlt/core/diorama";
import { lockTouch } from "@fzlt/core/touch";
import { PLANETS, PART_NAME, PART_WHAT, planet, type PartId } from "./planets.ts";
import { mountWorld, type World } from "./scene.ts";
import { buildRover, BODIES, WHEELS, HELMETS, DECALS, PAINTS, type Look } from "./rover.ts";
import { load, save, local, fresh, complete, trade, buyPart, fitPart, setLook, lookPrice, exportCode, importCode, PARTS, PART_PRICE, type Profile, type Store } from "./profile.ts";

export interface MoonRoverOptions {
  host?: HTMLElement | null;
  /** The landing hero: Pebble on the autopilot, no menus, no saving. */
  attract?: boolean;
  seed?: number;
  store?: Store;
  sound?: boolean;
  theme?: "dark" | "light";
}
type Screen = "map" | "garage" | "drive" | "flight";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const num = (n: number) => n.toLocaleString("en-US");
const ROWS: [keyof Look, string, readonly { name: string }[] | null][] = [
  ["body", "BODY", BODIES], ["wheels", "WHEELS", WHEELS], ["paint", "PAINT", null], ["trim", "TRIM", null], ["decal", "DECAL", DECALS],
  ["suit", "SUIT", null], ["helmet", "HELMET", HELMETS], ["visor", "VISOR", null],
];

export function createMoonRover(o: MoonRoverOptions = {}) {
  const dropIn = !o.host, store = o.store ?? local;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = document.createElement("div");
  wrap.setAttribute("data-fizlet-host", "moon-rover");
  wrap.style.cssText = dropIn ? "position:fixed;inset:0;z-index:2147483000" : "position:absolute;inset:0";
  const engine = createEngine({ root: wrap, settle: 0.5, seed: o.seed ?? 1 });
  const L = engine.ledger, sig = { signal: engine.signal };
  L.add(wrap);
  (o.host ?? document.body).append(wrap);
  const release = lockTouch(document);
  const pageTheme = () => o.theme ?? (document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const root = buiMount(wrap, __KIT_CSS__ + __GAME_CSS__, { theme: pageTheme() });
  const stage = document.createElement("div");
  stage.className = "mr";
  root.append(stage);
  const paintTheme = () => (root.dataset.theme = pageTheme());
  paintTheme();
  const mo = new MutationObserver(() => (paintTheme(), world?.retheme(), (pvKey = ""), preview()));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  engine.signal.addEventListener("abort", () => (mo.disconnect(), world?.destroy(), release()), { once: true });

  const loaded = o.attract ? { profile: fresh(), newer: false } : load(store);
  let profile: Profile = loaded.profile;
  const newer = loaded.newer;
  const keep = () => !o.attract && save(profile, store, newer);

  const worldEl = document.createElement("div");
  worldEl.className = "mr-world-host";
  const cards = document.createElement("div");
  cards.className = "mr-cards";
  const live = document.createElement("p");
  live.className = "mr-live";
  live.setAttribute("aria-live", "polite");
  stage.append(worldEl, cards, live);
  const say = (s: string) => (live.textContent = s === live.textContent ? s + " " : s);
  let screen: Screen = "map", world: World | null = null, at = profile.at, flightTo = "", note = "", gpart = 0;

  // ---- the garage preview: the rover on a turntable, drawn on change (no loop) ----
  const pv = document.createElement("canvas");
  pv.className = "mr-preview";
  pv.setAttribute("aria-hidden", "true");
  const pdio = diorama(pv, { light: [-0.4, 1, 0.6], ambient: 0.55, background: () => (pageTheme() === "dark" ? "#161236" : "#efe8ff") });
  let pvKey = "";
  function preview() {
    if (!pv.isConnected) return;
    const r = pv.getBoundingClientRect(), w = Math.round(r.width), h = Math.round(r.height);
    if (w < 10 || h < 10) return;
    const key = JSON.stringify([w, h, profile.look, profile.fit, pageTheme()]);
    if (key === pvKey) return;
    pvKey = key;
    pdio.resize(w, h, Math.min(2, devicePixelRatio || 1));
    pdio.clear();
    const night = pageTheme() === "dark";
    pdio.add({ shape: "cyl", sides: 6, size: [3.4, 0.14, 3.4], pos: [0, -0.62, 0], color: night ? "#2a2552" : "#d8ccf4", pick: false });
    pdio.add({ shape: "cyl", sides: 6, size: [3.5, 0.05, 3.5], pos: [0, -0.66, 0], color: night ? "#22e6ff" : "#ff7a59", emissive: night, pick: false });
    pdio.add({ id: "pv", shape: "group", size: [2, 0, 2], pos: [0, -0.2, 0], pick: false });
    const shade = night
      ? { chassis: "#26253a", tyre: "#121219", hub: "#9aa0c0", lamp: "#fff7d6", tail: "#ff2e88", flame: "#ffb35c", visor: "#0a0c16", panel: "#2b3c8f", panel2: "#5a7bff", ink: "#0b0a14" }
      : { chassis: "#2a2a36", tyre: "#1a1a22", hub: "#d9dbe6", lamp: "#fff7d6", tail: "#ff3b30", flame: "#ff8a3d", visor: "#11131c", panel: "#2f4aa8", panel2: "#6d8bff", ink: "#1b1420" };
    const fit = { tyres: profile.fit.includes("tyres"), tank: profile.fit.includes("tank"), armour: profile.fit.includes("armour"), claw: profile.fit.includes("claw") };
    const WX = [0.72, -0.56, 0.72, 0.56, -0.72, -0.56, -0.72, 0.56], g = buildRover(pdio, "pv", "pvr", profile.look, fit, shade, WX);
    g.flame.alpha = 0;
    for (let i = 0; i < 4; i++) g.hubs[i]!.pos.set([WX[i * 2]!, -0.22, WX[i * 2 + 1]!]);
    Object.assign(pdio.cam, { yaw: -0.75, pitch: 0.36, dist: 5.2, tx: 0, ty: 0.15, tz: 0, ox: 0, oy: 0, fov: 0.55 });
    pdio.draw();
  }
  const pro = new ResizeObserver(() => ((pvKey = ""), preview()));
  pro.observe(pv);
  engine.signal.addEventListener("abort", () => pro.disconnect(), { once: true });

  // ---- the cards ----
  const head = () => `<header class="mr-bar"><b class="mr-logo">MOON ROVER</b><span class="mr-chip mr-cr" title="Credits">◈ ${num(profile.credits)}</span><span class="mr-chip">${esc(profile.name)}</span><span class="mr-chip">BEACONS ${profile.cleared.length}/${PLANETS.length}</span></header>`;
  function mapCard() {
    const items = PLANETS.map((w, i) => {
      const open = profile.unlocked.includes(w.id), done = profile.cleared.includes(w.id), here = w.id === at;
      const g = pageTheme() === "light" ? w.light : w.dark;
      return `<li class="mr-world${open ? "" : " mr-locked"}${here ? " mr-here" : ""}"><span class="mr-orb" style="--a:${g[1]};--b:${g[4]};--c:${g[7]};--r:${w.ring ? w.ally[0] : "transparent"}" aria-hidden="true"></span><div><p class="mr-n">${i + 1} · ${esc(w.surface.toUpperCase())}${done ? " · <b>LIT ★</b>" : ""}</p><h3>${esc(w.name)}</h3><p>${open ? esc(w.blurb) : "Locked: light the beacon before it to open the route."}</p>${open ? `<p class="mr-m">${done ? "Free roam" : `Mission: ${esc(w.mission.title)}`} · ${esc(w.friend.name)} vs ${esc(w.foe.name)}</p>` : ""}</div>${open ? `<button type="button" class="bui-key mr-go" data-drive="${w.id}">${flightTo || screen === "flight" ? "FLY" : here ? "DRIVE" : "FLY HERE"}</button>` : `<span class="mr-lock" aria-label="Locked">🔒</span>`}</li>`;
    }).join("");
    return `<section class="mr-card-screen mr-map" aria-label="The system">${head()}<div class="mr-mapbody"><div class="mr-story"><h2>Relight the Beacon Network.</h2><p>The beacons that guided rovers between the six worlds went dark. On each world, find the friends, take their mission, light their beacon, then launch from the pad to the next.</p><div class="mr-actions"><button type="button" class="bui-key bui-go mr-big" data-drive="${at}">▶ DRIVE ${esc(planet(at).name.toUpperCase())}</button><button type="button" class="bui-key" data-go="garage">GARAGE</button></div>${note ? `<p class="mr-note">${esc(note)}</p>` : ""}</div><ol class="mr-worlds">${items}</ol></div></section>`;
  }
  function garageCard() {
    const lk = profile.look;
    const rows = ROWS.map(([k, label, opts]) => {
      const i = lk[k], n = opts ? opts.length : PAINTS.length, name = opts ? opts[i]!.name : PAINTS[i]![0], swatch = opts ? "" : `<i class="mr-sw" style="background:${PAINTS[i]![1]}"></i>`;
      const nx = (i + 1) % n, price = lookPrice(profile, k, nx);
      return `<li><span class="mr-k">${label}</span><button type="button" class="bui-key mr-step" data-look="${k}" data-to="${(i + n - 1) % n}" aria-label="Previous ${label.toLowerCase()}">‹</button><b class="mr-v">${swatch}${esc(name)}</b><button type="button" class="bui-key mr-step" data-look="${k}" data-to="${nx}" aria-label="Next ${label.toLowerCase()}${price ? `, ${price} credits` : ""}">›</button>${price ? `<small class="mr-price">next ◈${price}</small>` : ""}</li>`;
    }).join("");
    const parts = PARTS.map((k) => {
      const own = profile.parts.includes(k), on = profile.fit.includes(k);
      return `<li><span class="mr-k">${esc(PART_NAME[k].toUpperCase())}</span><small>${esc(PART_WHAT[k])}</small>${own ? `<button type="button" class="bui-key mr-fit" data-fit="${k}" aria-pressed="${on}">${on ? "FITTED" : "FIT"}</button>` : `<button type="button" class="bui-key mr-buy" data-buy="${k}"${profile.credits < PART_PRICE[k] ? " data-short" : ""}>◈ ${num(PART_PRICE[k])}</button>`}</li>`;
    }).join("");
    return `<section class="mr-card-screen mr-garage" aria-label="Garage">${head()}<div class="mr-gbody"><div class="mr-gview"><div class="mr-pvwrap"></div><p class="mr-gtabs"><button type="button" class="bui-key" data-gtab="0" aria-pressed="${gpart === 0}">LOOK</button><button type="button" class="bui-key" data-gtab="1" aria-pressed="${gpart === 1}">PARTS</button><button type="button" class="bui-key" data-gtab="2" aria-pressed="${gpart === 2}">SAVE CODE</button></p></div><div class="mr-gside">${gpart === 0 ? `<ul class="mr-rows">${rows}</ul>` : gpart === 1 ? `<ul class="mr-rows mr-parts">${parts}</ul><p class="mr-note">Missions give parts too: Rime's tyres, Dunemar's claw, Cinder's armour, Prism's tank.</p>` : `<div class="mr-code"><label for="mr-code">Your save code: copy it to move this profile to another device.</label><textarea id="mr-code" rows="4" readonly>${exportCode(profile)}</textarea><label for="mr-in">Paste a code to load it:</label><textarea id="mr-in" rows="3"></textarea><button type="button" class="bui-key" data-import>LOAD CODE</button></div>`}${note ? `<p class="mr-note">${esc(note)}</p>` : ""}<p class="mr-actions"><button type="button" class="bui-key" data-go="map">◂ MAP</button><button type="button" class="bui-key bui-go" data-drive="${at}">▶ DRIVE</button></p></div></div></section>`;
  }
  function flightCard() {
    const w = planet(flightTo), g = pageTheme() === "light" ? w.light : w.dark;
    return `<section class="mr-card-screen mr-flight" aria-label="Flight to ${esc(w.name)}"><div class="mr-warp" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="mr-orb mr-big-orb" style="--a:${g[1]};--b:${g[4]};--c:${g[7]};--r:${w.ring ? w.ally[0] : "transparent"}" aria-hidden="true"></span><p class="mr-n">WARPING TO</p><h2>${esc(w.name)}</h2><p>${esc(w.blurb)}</p></section>`;
  }
  function paint() {
    cards.hidden = screen === "drive";
    worldEl.hidden = screen !== "drive";
    if (screen === "drive") return void (cards.innerHTML = "");
    cards.innerHTML = screen === "map" ? mapCard() : screen === "garage" ? garageCard() : flightCard();
    if (screen === "garage") {
      cards.querySelector(".mr-pvwrap")!.append(pv);
      pvKey = "";
      requestAnimationFrame(preview);
    }
    engine.wake();
  }
  L.add(cards);

  // ---- the drive ----
  const kitOf = (id: string) => ({ tyres: profile.fit.includes("tyres"), tank: profile.fit.includes("tank"), armour: profile.fit.includes("armour"), claw: profile.fit.includes("claw"), cleared: profile.cleared.includes(id) });
  function drive(id: string) {
    if (!profile.unlocked.includes(id)) return false;
    world?.destroy();
    worldEl.textContent = "";
    at = id;
    if (profile.at !== id) (profile = { ...profile, at: id }), keep();
    screen = "drive";
    note = "";
    paint();
    const i = PLANETS.findIndex((w) => w.id === id);
    world = mountWorld(worldEl, {
      planet: planet(id), next: PLANETS[(i + 1) % PLANETS.length]!, kit: kitOf(id), look: profile.look, seed: (o.seed ?? 1) * 7919 + profile.stats.trips, theme: pageTheme, sound: o.sound, attract: o.attract,
      on(what, val) {
        if (o.attract) return;
        if (what === "trade") (profile = trade(profile, val)), keep(), say(`Traded ${val} crystals for ${val * 5} credits`);
        else if (what === "done") {
          const w = planet(id), next = PLANETS[i + 1];
          profile = complete(profile, id);
          keep();
          say(`${w.mission.title} done. ${next ? `${next.name} is open: launch from the pad.` : "Every beacon is lit."}`);
        } else if (what === "pad") {
          const c = world?.run.S[3] ?? 0;
          if (c) profile = trade(profile, c);
          profile = { ...profile, stats: { ...profile.stats, trips: profile.stats.trips + 1, kills: profile.stats.kills + (world?.run.S[14] ?? 0) } };
          keep();
          const next = PLANETS[i + 1];
          flight(next && profile.unlocked.includes(next.id) ? next.id : "");
        } else if (what === "menu") show("map");
      },
    });
    if (o.attract) world.auto = true;
    return true;
  }
  /** Launch: the warp to world `id` (or, with none, the map to pick one). Reduced motion: no warp. */
  function flight(id: string) {
    world?.destroy();
    world = null;
    worldEl.textContent = "";
    if (!id) return void ((note = "Pick a world to fly to."), (screen = "map"), paint());
    flightTo = id;
    screen = "flight";
    paint();
    say(`Warping to ${planet(id).name}`);
    if (reduced) return void (flightTo = "", drive(id));
    engine.busy(1.8);
    flyAt = engine.time + 1.6;
  }
  let flyAt = -1;
  engine.add({
    step(e) {
      if (flyAt > 0) {
        e.busy();
        if (e.time >= flyAt) { const id = flightTo; flyAt = -1; flightTo = ""; drive(id); }
      }
    },
  });
  function show(s: "map" | "garage") {
    world?.destroy();
    world = null;
    worldEl.textContent = "";
    screen = s;
    paint();
  }

  // ---- clicks on the cards ----
  cards.addEventListener("click", (e) => {
    const b = (e.target as Element).closest?.("button") as HTMLButtonElement | null;
    if (!b) return;
    const d = b.dataset;
    note = "";
    if (d.drive) return void (d.drive === at || screen !== "map" ? drive(d.drive) : flight(d.drive));
    if (d.go) return void show(d.go as "map" | "garage");
    if (d.gtab) return (gpart = +d.gtab), paint();
    if (d.look) {
      const k = d.look as keyof Look, to = +d.to!, next = setLook(profile, k, to);
      if (next === profile) note = `That one costs ◈${lookPrice(profile, k, to)}: earn credits on missions or trade crystals.`;
      profile = next;
      keep();
      paint();
      return void (cards.querySelector(`[data-look="${k}"][data-to="${b.dataset.to === String(to) ? b.dataset.to : to}"]`) as HTMLElement | null)?.focus();
    }
    if (d.buy) {
      const k = d.buy as PartId, next = buyPart(profile, k);
      note = next === profile ? `Not enough credits for the ${PART_NAME[k]}.` : `${PART_NAME[k]} bought and fitted.`;
      profile = next;
      keep();
      return paint();
    }
    if (d.fit) return (profile = fitPart(profile, d.fit as PartId, !profile.fit.includes(d.fit as PartId))), keep(), paint();
    if ("import" in d) {
      const p = importCode((cards.querySelector("#mr-in") as HTMLTextAreaElement).value);
      note = p ? "Profile loaded." : "That code does not read: check it was copied whole.";
      if (p) (profile = p), (at = p.at), keep();
      paint();
    }
  }, sig);

  engine.start();
  if (o.attract) drive(PLANETS[0]!.id);
  else paint();
  return {
    engine,
    get world() { return world; },
    get profile() { return profile; },
    getSnapshot: () => ({ screen, planet: at, flightTo, credits: profile.credits, cleared: profile.cleared.slice(), unlocked: profile.unlocked.slice(), world: world ? world.state : null }),
    drive,
    show,
    flight,
    exportCode: () => exportCode(profile),
    destroy: () => engine.destroy(),
  };
}
export type MoonRover = ReturnType<typeof createMoonRover>;
