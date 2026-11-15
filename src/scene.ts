// A world on screen: the gallery daily Moon Rover's scene (#123), kept as it was for the feel (the
// world turns under the rover; steady framing set once per stage shape; resize only changes FOV and
// framing, never a speed zoom), carrying one planet: its tiles in its own colours (lava glowing on
// Cinder), crystal spires on Prism, the village and the outpost with their friends, the mission's
// targets, the planet's beacon, the launch pad, the hostiles; a speech bubble over a friend you talk
// to; Board UI stickers for the mission, crystals, shields and boost. Keys: ↑ ↓ ← → or WASD, Space
// fires, Shift boosts, J jumps, E or Enter acts (talk), M mutes. A phone has the stick and FIRE,
// BOOST, ACT and JUMP. The run (./run.ts) is headless; this file only draws it and feeds it input.
import { createEngine } from "@fzlt/core/kernel";
import { diorama, type DioramaObject, type DioramaPoints } from "@fzlt/core/diorama";
import { controls } from "@fzlt/core/input";
import { pad } from "@fzlt/core/pad";
import { effects } from "@fzlt/core/fx";
import { sound } from "@fzlt/core/sound";
import { euler, mul3, columns } from "./orb.ts";
import { buildRover, type Look, type Fit } from "./rover.ts";
import type { Planet } from "./planets.ts";
import {
  roverRun, READY, RUN, DOWN, GONE, SHIPS, BOLTS, BASES, FRIENDS, GIVER, TRADER, M_OFFER, M_RUN, M_BACK, M_DONE,
  E_START, E_CRYSTAL, E_FRIEND, E_SHOT, E_KILL, E_HIT, E_CRATE, E_DARK, E_JUMP, E_CRASH, E_RIGHT, E_DOWN, E_BUMP, E_BURN, E_LAND,
  E_TALK, E_MSTART, E_MSTEP, E_MDONE, E_MFAIL, E_PAD, E_LOCKED, E_LAVA, E_STEAL, E_NEED, E_TRADE, E_DROP, E_RETURN,
  G_BOOST, G_CRYSTALS, PH, CLK, CRY, SHD, BOOST, HURT, DARK as DK, KILLS, MET, MP, MK, NEAR, CARRY, MAXS,
  IN_GAS, IN_BRAKE, IN_STEER, IN_FIRE, IN_BOOST, IN_JUMP, IN_ACT, type Kit,
} from "./run.ts";

const TAU = 6.283185307179586, DUST = 90, DEBRIS = 90;
const WORDS = ["ZAP!", "KA-BLAM", "+1", "GATE!", "GOT IT", "BEEP!", "BOOST!", "SHIELD!", "+3", "CRUNCH", "OUCH", "+2", "LIT!"];
// The rover's own shades and the sky's, by theme; the ground comes from the planet.
const BASE_D = {
  night: true, amb: 0.36, star: "#d8e2ff", sun0: "#fff6d6", sun1: "#ff9a3c",
  chassis: "#26253a", panel: "#2b3c8f", panel2: "#5a7bff", tyre: "#121219", hub: "#9aa0c0", lamp: "#fff7d6", tail: "#ff2e88", flame: "#ffb35c", visor: "#0a0c16",
  bIdle: "#4a3f86", bNext: "#ff4fa8", bLit: "#22e6ff", bPost: "#2a2548", lock: "#ff4f5e", open: "#39ffb0",
  crys: ["#ff4fd8", "#22e6ff", "#b18cff"], crate: "#f2a03d", strap: "#2a2445",
  dome: "#e8ecff", domeWin: "#22e6ff", padC: "#3a3668", eye: "#ffffff", ink: "#0b0a14", bolt: "#7ff6ff", spark: "#ffd166", shadow: "#000000", cell: "#39ffb0",
};
const BASE_L: typeof BASE_D = {
  ...BASE_D, night: false, amb: 0.5, star: "#ffffff", sun0: "#fffbe8", sun1: "#ffc36b",
  chassis: "#2a2a36", panel: "#2f4aa8", panel2: "#6d8bff", tyre: "#1a1a22", hub: "#d9dbe6", tail: "#ff3b30", flame: "#ff8a3d", visor: "#11131c",
  bIdle: "#b4a6d8", bNext: "#ff3d7f", bLit: "#13a9bb", bPost: "#5e5486", lock: "#e8344a", open: "#1fae6e",
  crys: ["#ff4fb0", "#13a9bb", "#8f6bff"], crate: "#ff8a3d", strap: "#3b3358",
  dome: "#fffaf0", domeWin: "#13a9bb", padC: "#cdbfa6", ink: "#1b1420", bolt: "#13c9e0", spark: "#ffb347", shadow: "#4a3a5a", cell: "#1fae6e",
};
function palette(pl: Planet, next: Planet, light: boolean) {
  const g = light ? pl.light : pl.dark, b = light ? BASE_L : BASE_D, s = pl.sky;
  return {
    ...b,
    day: [g[0], g[1], g[2]], floor: g[3], rim: g[4], dusk: [g[5], g[6]], nite: [g[7], g[8], g[9]], nfloor: g[10], nrim: g[11], rock: g[12], nrock: g[13], dust: g[14], hot: g[15],
    sky0: light ? s[3] : s[0], sky1: light ? s[4] : s[1], sky2: light ? s[5] : s[2], glow: light ? s[7] : s[6],
    planet: (light ? next.light : next.dark)[1], band: (light ? next.light : next.dark)[4], band2: next.sky[6], ring: next.ring ? next.ally[0] : "#ff4fa8",
    friend: pl.ally[0], friend2: pl.ally[1], tip: pl.ally[2], hull: pl.enemy[0], hull2: pl.enemy[1], sglow: pl.enemy[2],
  };
}
type Pal = ReturnType<typeof palette>;

export interface WorldOptions {
  planet: Planet;
  /** The next world (it hangs in the sky). */
  next: Planet;
  kit: Kit & Fit;
  look: Look;
  seed?: number;
  theme: () => "dark" | "light";
  /** Sound on (silent until a gesture anyway). */
  sound?: boolean;
  /** Hero mode: drives itself, no HUD. */
  attract?: boolean;
  /** Shell hooks: crystals traded, the mission done, the pad, the menu key. */
  on: (what: "trade" | "done" | "pad" | "menu" | "down", value: number) => void;
}
export type World = ReturnType<typeof mountWorld>;

export function mountWorld(stage: HTMLElement, wo: WorldOptions) {
  const pl = wo.planet, M = pl.mission;
  const engine = createEngine({ root: stage, settle: 0.5, seed: wo.seed ?? 20261123 });
  const sig = { signal: engine.signal }, L = engine.ledger;
  let P: Pal = palette(pl, wo.next, wo.theme() === "light");

  // ---- the stage: canvas, the play surface, the stickers, the pad ----
  const canvas = L.add(document.createElement("canvas"));
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "mr-canvas";
  const play = L.add(document.createElement("button"));
  play.type = "button";
  play.className = "mr-play";
  play.setAttribute("aria-label", `${pl.name}: up or W for gas, down or S to brake, left and right to steer, Space fires, Shift boosts, J jumps, E talks. ${M.title}. M mutes`);
  const hud = L.add(document.createElement("div"));
  hud.className = "mr-hud";
  hud.hidden = !!wo.attract;
  hud.innerHTML = `<div class="mr-head"><p class="mr-top"><b class="mr-chip mr-wchip"><span>${pl.name.toUpperCase()}</span></b><b class="mr-chip mr-job"><span></span></b><b class="mr-chip mr-time" hidden><span></span></b><b class="mr-chip mr-cry"><i>✦</i><span>0</span></b></p><p class="mr-sub"><b class="mr-chip mr-shd" aria-label="Shields"></b><b class="mr-chip mr-boost" aria-label="Boost"><em>BOOST</em><u><s></s></u></b></p><p class="mr-hint"></p></div><p class="mr-say" hidden><b></b><span></span></p><p class="mr-toast" hidden></p><p class="mr-live" aria-live="polite"></p><p class="mr-keys"><button type="button" class="mr-key mr-menu" aria-label="Map and garage (Escape)">☰</button><button type="button" class="mr-key mr-mute" aria-label="Mute (M)" aria-pressed="true">♪</button></p><div class="mr-card" role="dialog" aria-label="Rover down" hidden><b>ROVER DOWN</b><p class="mr-t"></p><button type="button" class="bui-key mr-again">RESPAWN AT THE VILLAGE</button></div>`;
  const q = <T extends HTMLElement>(s: string) => hud.querySelector(s) as T;
  const jobEl = q(".mr-job span"), timeChip = q(".mr-time"), timeEl = q(".mr-time span"), cryEl = q(".mr-cry span"), shdChip = q(".mr-shd"), boostEl = q(".mr-boost s"), boostChip = q(".mr-boost"), hintEl = q(".mr-hint");
  const sayEl = q(".mr-say"), sayWho = sayEl.firstChild as HTMLElement, sayText = sayEl.lastChild as HTMLElement, toastEl = q(".mr-toast"), live = q(".mr-live"), card = q(".mr-card"), cardT = q(".mr-t"), again = q<HTMLButtonElement>(".mr-again");
  const muteK = q<HTMLButtonElement>(".mr-mute"), menuK = q<HTMLButtonElement>(".mr-menu");
  stage.append(canvas, play, hud);
  const snd = sound(engine, {
    cues: { start: "ready", crystal: "click", beacon: "power", done: "win", friend: "beep", shot: "fire", kill: "boom", hit: "hurt", crate: "hit", jump: "click", over: "end", right: "ready", dark: "dark", talk: "beep" },
    notes: { beep: [[880, 1320, 0.06, 0, "square", 0.07], [1320, 990, 0.07, 0.08, "square", 0.07], [990, 1480, 0.06, 0.17, "square", 0.06]], dark: [[300, 150, 0.4, 0, "triangle", 0.12]] },
    volume: 0.1,
  });
  if (wo.sound === false || wo.attract) snd.on = false;
  const c = controls(engine, { keys: { left: [], right: [], gas: [], brake: [], fire: [], boost: [], jump: [], act: [] }, target: play });
  const GAS = c.id("gas"), BRAKE = c.id("brake"), LEFT = c.id("left"), RIGHT = c.id("right"), FIRE = c.id("fire"), BOOSTK = c.id("boost"), JUMP = c.id("jump"), ACT = c.id("act");
  const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l2.3 5.2 5.7.5-4.3 3.8 1.3 5.6L10 14.2 5 17.1l1.3-5.6L2 7.7l5.7-.5z"/></svg>';
  const TALK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 4h14v9H9l-4 3v-3H3z"/></svg>';
  const thePad = pad(engine, c, {
    scheme: "stick",
    actions: [
      { intent: "fire", label: "FIRE", name: "Fire (Space)", key: "SPACE", role: "fire", hold: true, icon: STAR },
      { intent: "boost", label: "BOOST", name: "Boost (Shift)", key: "SHIFT", role: "go", hold: true },
      { intent: "act", label: "ACT", name: "Talk (E)", key: "E", role: "cmd", icon: TALK },
      { intent: "jump", label: "JUMP", name: "Jump (J)", key: "J", role: "sys" },
    ],
    host: stage,
  });
  thePad.el.classList.add("mr-pad");
  if (wo.attract) thePad.el.hidden = true;
  const toggle = () => {
    snd.on = !snd.on;
    muteK.textContent = snd.on ? "♪" : "×";
    muteK.setAttribute("aria-pressed", "" + snd.on);
  };

  // ---- the run, the view, the diorama ----
  const run = roverRun(pl, wo.kit, wo.seed ?? 20261123), R = run.radius, o = run.orb, v = run.car, view = o.view(), T = o.tiles(R > 33 ? 14 : 13);
  const CRYSTALS = run.counts.crystals, ROCKS = run.counts.rocks, CRATES = run.counts.crates, RAMPS = run.counts.ramps, NT = run.nt;
  const fx = effects({ cap: 260, scorch: 0, words: WORDS, colors: ["#fff4ff", "#ffc21a", "#ff8a1f", "#ff2e88", "#19f0ff", "#39ffb0", "#9a63ff", "#07060f"] });
  const dio = diorama(canvas, { light: [0, 1, 0], ambient: P.amb, background: () => P.sky0, overlay: drawOverlay, maxVerts: 70000, maxFaces: 11000, maxShadows: 64, get shadowColor() { return P.shadow; } });
  const NP = 1 + 1 + NT + CRYSTALS + ROCKS + CRATES + BASES + FRIENDS + RAMPS + 1;
  const PU = new Float64Array(NP * 3), PR = new Float64Array(NP), PN = new Float64Array(NP), AN = new Float64Array((NP + SHIPS + 1) * 3);
  const props: DioramaObject[] = [], tiles: DioramaObject[] = [];
  const crystals: DioramaObject[] = [], crates: DioramaObject[] = [], friends: DioramaObject[][] = [], ships: DioramaObject[] = [], targets: DioramaObject[] = [], tmark: DioramaObject[][] = [];
  let hubs: DioramaObject[] = [], flame: DioramaObject, bcn: DioramaObject[] = [], padMark: DioramaObject[] = [], cargo: DioramaObject;
  let moon: DioramaObject, padO: DioramaObject, body: DioramaObject, dust: DioramaPoints, debris: DioramaPoints, bolts: DioramaPoints;
  const DO = new Float64Array(DUST * 8), BR = new Float64Array(DEBRIS * 8);
  const rnd = engine.random;
  const STARS = new Float64Array(180 * 4);
  for (let i = 0; i < 180; i++) {
    let x = 0, y = 0, z = 0, d = 2;
    while (d > 1 || d < 0.01) (x = rnd() * 2 - 1), (y = rnd() * 2 - 1), (z = rnd() * 2 - 1), (d = x * x + y * y + z * z);
    d = Math.sqrt(d);
    STARS.set([x / d, y / d, z / d, rnd()], i * 4);
  }
  const PLANET = [-0.45, 0.62, 0.64], SUNV = run.sun;
  { const l = Math.hypot(...PLANET); for (let k = 0; k < 3; k++) PLANET[k] = PLANET[k]! / l; }
  const SV3 = new Float64Array(3), FF = new Float64Array(FRIENDS * 9), M9 = new Float64Array(9), M9b = new Float64Array(9), E3 = new Float64Array(3), F9 = new Float64Array(9), tmp = new Float64Array(3);
  const lavaH = pl.lava ?? -99;

  function rotOf(F: ArrayLike<number>, root: boolean, out: Float64Array) {
    columns(F, M9);
    if (root) mul3(view.Q, M9, M9b), euler(M9b, out);
    else euler(M9, out);
  }
  function tileColor(i: number) {
    const cx = T.centre[i * 3]!, cy = T.centre[i * 3 + 1]!, cz = T.centre[i * 3 + 2]!, l = Math.hypot(cx, cy, cz), d = run.day(cx / l, cy / l, cz / l), h = T.height[i]!;
    const k = (i * 7 + ((i / 3) | 0)) % 3;
    if (h < lavaH) return P.hot;
    if (d > 0.1) return h < -0.35 ? P.floor : h > 0.32 ? P.rim : P.day[k]!;
    if (d > -0.05) return P.dusk[k & 1]!;
    return h < -0.35 ? P.nfloor : h > 0.32 ? P.nrim : P.nite[k]!;
  }
  function buildScene() {
    dio.clear();
    props.length = tiles.length = crystals.length = crates.length = friends.length = ships.length = targets.length = tmark.length = 0;
    bcn = []; padMark = [];
    dio.cluster("sky", { fixed: -10 });
    dio.decal("sky", 0, paintSky);
    moon = dio.add({ id: "moon", shape: "group", size: [0, 0, 0], pos: [0, -R, 0], pick: false });
    const C = T.corners, Mc = T.centre, N = T.normal, th = 0.06;
    for (let i = 0; i < T.n; i++) {
      const mx = Mc[i * 3]!, my = Mc[i * 3 + 1]!, mz = Mc[i * 3 + 2]!, nx = N[i * 3]!, ny = N[i * 3 + 1]!, nz = N[i * 3 + 2]!;
      let ax = C[i * 9]! - mx, ay = C[i * 9 + 1]! - my, az = C[i * 9 + 2]! - mz;
      const d = ax * nx + ay * ny + az * nz;
      ax -= d * nx; ay -= d * ny; az -= d * nz;
      const al = Math.hypot(ax, ay, az);
      ax /= al; ay /= al; az /= al;
      const zx = ay * nz - az * ny, zy = az * nx - ax * nz, zz = ax * ny - ay * nx;
      F9.set([ax, ay, az, nx, ny, nz, zx, zy, zz]);
      const outline: number[][] = [];
      for (let k = 0; k < 3; k++) {
        const px = C[i * 9 + k * 3]! - mx, py = C[i * 9 + k * 3 + 1]! - my, pz = C[i * 9 + k * 3 + 2]! - mz;
        outline.push([px * ax + py * ay + pz * az, px * zx + py * zy + pz * zz]);
      }
      rotOf(F9, false, E3);
      tiles.push(dio.add({ shape: "prism", outline, taper: 0, size: [1, th, 1], pos: [mx - nx * th, my - ny * th, mz - nz * th], rot: E3, on: "moon", cluster: "t" + i, color: tileColor(i), emissive: T.height[i]! < lavaH, pick: false, layer: 2 }));
    }
    let np = 0;
    const prop = (u: ArrayLike<number>, f: ArrayLike<number>, r: number, nudge: number, lift = 0) => {
      const k = np++, g = R + o.height(u[0]!, u[1]!, u[2]!) + lift, id = "p" + k;
      PU[k * 3] = u[0]! * g; PU[k * 3 + 1] = u[1]! * g; PU[k * 3 + 2] = u[2]! * g; PR[k] = r; PN[k] = nudge;
      dio.cluster(id, { at: AN.subarray(k * 3, k * 3 + 3) });
      o.frame(u[0]!, u[1]!, u[2]!, f[0]!, f[1]!, f[2]!, F9);
      rotOf(F9, false, E3);
      props.push(dio.add({ id, shape: "group", size: [r, 0, r], pos: [PU[k * 3]!, PU[k * 3 + 1]!, PU[k * 3 + 2]!], rot: E3, on: "moon", cluster: id, pick: false }));
      return id;
    };
    const part = (on: string, shape: "box" | "cyl" | "wedge" | "prism", size: number[], pos: number[], color: string, x: { rot?: number[]; emissive?: boolean; sides?: number; top?: number; shadow?: number; id?: string } = {}) =>
      dio.add({ id: x.id, shape, size, pos, rot: x.rot, on, color, emissive: x.emissive, sides: x.sides, top: x.top, shadow: x.shadow, pick: false });
    const nightAt = (u: ArrayLike<number>) => run.day(u[0]!, u[1]!, u[2]!) < -0.05;
    const any = [0.3, 1, 0.2];
    // The planet's beacon: dark until the mission is done.
    {
      const id = prop(run.beacon, any, 3.2, 1.6);
      part(id, "cyl", [1.5, 0.3, 1.5], [0, -0.05, 0], P.bPost, { sides: 8, top: 0.8 });
      part(id, "cyl", [0.24, 3.6, 0.24], [0, 0, 0], P.bPost, { sides: 6 });
      bcn.push(part(id, "cyl", [0.9, 0.3, 0.9], [0, 3.6, 0], P.bIdle, { sides: 10, emissive: true }), part(id, "cyl", [0.5, 0.5, 0.5], [0, 3.9, 0], P.bIdle, { sides: 8, top: 0, emissive: true }), part(id, "cyl", [1.0, 0.08, 1.0], [0, 0.26, 0], P.bIdle, { sides: 10, emissive: true }));
    }
    // The launch pad: a hex deck, chevrons, a ring that turns green once the route is open.
    {
      const id = prop(run.pad, run.Fw, 3.0, 2.2);
      part(id, "cyl", [4.4, 0.18, 4.4], [0, -0.05, 0], P.padC, { sides: 6 });
      padMark.push(part(id, "cyl", [4.5, 0.08, 4.5], [0, 0.06, 0], P.lock, { sides: 6, emissive: true }));
      part(id, "cyl", [3.6, 0.1, 3.6], [0, 0.1, 0], P.bPost, { sides: 6 });
      for (const zz of [-0.7, 0.7]) padMark.push(part(id, "wedge", [1.0, 0.06, 0.4], [0, 0.17, zz], P.lock, { emissive: true }));
    }
    // Mission targets.
    for (let k = 0; k < NT; k++) {
      const u = run.target.subarray(k * 3, k * 3 + 3), kind = M.kind;
      if (kind === "race") {
        const a = run.target.subarray(((k + 1) % NT) * 3, ((k + 1) % NT) * 3 + 3), f = [a[0]! - u[0]!, a[1]! - u[1]!, a[2]! - u[2]!];
        const id = prop(u, f, 4.2, 2);
        const m = [part(id, "box", [0.35, 3.2, 0.35], [0, 1.6, -2.6], P.bPost), part(id, "box", [0.35, 3.2, 0.35], [0, 1.6, 2.6], P.bPost), part(id, "box", [0.3, 0.4, 5.6], [0, 3.2, 0], P.bIdle, { emissive: true }), part(id, "box", [0.1, 0.1, 5.2], [0, 0.05, 0], P.bIdle, { emissive: true })];
        tmark.push(m.slice(2));
        targets.push(props[props.length - 1]!);
      } else if (kind === "deliver") {
        const id = prop(u, any, 2.4, 1.6);
        if (k === 0) {
          part(id, "cyl", [3.0, 0.14, 3.0], [0, -0.04, 0], P.padC, { sides: 8 });
          part(id, "box", [0.8, 0.6, 0.8], [0.9, 0.26, 0.6], P.crate); part(id, "box", [0.7, 0.5, 0.7], [-0.9, 0.22, -0.7], P.crate);
          tmark.push([part(id, "box", [0.7, 0.7, 0.7], [0, 0.4, 0], P.cell, { emissive: true })]);
        } else {
          part(id, "cyl", [3.4, 0.12, 3.4], [0, -0.04, 0], P.padC, { sides: 12 });
          tmark.push([part(id, "cyl", [3.6, 0.1, 3.6], [0, 0.04, 0], P.bIdle, { sides: 12, emissive: true }), part(id, "cyl", [0.4, 1.6, 0.4], [0, 0, 0], P.bIdle, { sides: 6, emissive: true })]);
        }
        targets.push(props[props.length - 1]!);
      } else if (kind === "defend") {
        const id = prop(u, any, 8, 3);
        part(id, "cyl", [1.8, 0.4, 1.8], [0, -0.05, 0], P.bPost, { sides: 8, top: 0.8 });
        part(id, "cyl", [0.4, 5.2, 0.4], [0, 0, 0], P.bPost, { sides: 6 });
        const m = [part(id, "cyl", [1.4, 0.5, 1.4], [0, 5.2, 0], P.bIdle, { sides: 4, top: 0, emissive: true, rot: [Math.PI, 0, 0] }), part(id, "cyl", [1.4, 0.9, 1.4], [0, 5.2, 0], P.bIdle, { sides: 4, top: 0, emissive: true })];
        for (let a = 0; a < 12; a++) m.push(part(id, "box", [0.3, 0.5, 0.3], [Math.cos((a / 12) * TAU) * 7.6, 0.15, Math.sin((a / 12) * TAU) * 7.6], P.bIdle, { emissive: true }));
        tmark.push(m);
        targets.push(props[props.length - 1]!);
      } else if (kind === "beacon" && k === M.count) {
        const id = prop(u, any, 4, 2.5);
        part(id, "cyl", [2.6, 0.5, 2.6], [0, -0.05, 0], P.bPost, { sides: 10, top: 0.7 });
        part(id, "cyl", [0.5, 6.4, 0.5], [0, 0, 0], P.bPost, { sides: 8 });
        tmark.push([part(id, "cyl", [1.8, 0.5, 1.8], [0, 6.4, 0], P.bIdle, { sides: 12, emissive: true }), part(id, "cyl", [1.0, 1.0, 1.0], [0, 6.8, 0], P.bIdle, { sides: 10, top: 0, emissive: true }), part(id, "cyl", [2.8, 0.1, 2.8], [0, 0.5, 0], P.bIdle, { sides: 12, emissive: true })]);
        targets.push(props[props.length - 1]!);
      } else if (kind === "rescue") {
        const id = prop(u, any, 1.4, 1);
        part(id, "cyl", [1.6, 0.3, 1.6], [0, -0.05, 0], P.nrock, { sides: 6, top: 0.8 });
        const g = dio.add({ id: id + "s", shape: "group", size: [0.5, 0, 0.5], pos: [0, 0.25, 0], on: id, pick: false });
        alien(id + "s", P.friend, 0.85);
        part(id, "cyl", [0.14, 1.4, 0.14], [0.5, 0, 0.5], P.hub, { sides: 4 });
        tmark.push([part(id, "box", [0.04, 0.4, 0.5], [0.5, 1.2, 0.75], P.lock, { emissive: true })]);
        targets.push(g);
      } else {
        // A power cell (collect) or a beacon shard: glowing, on a little plinth.
        const id = prop(u, any, 1.2, 1);
        part(id, "cyl", [0.9, 0.16, 0.9], [0, -0.04, 0], P.bPost, { sides: 6 });
        const g = dio.add({ id: id + "c", shape: "group", size: [0.6, 0, 0.6], pos: [0, 0.5, 0], on: id, pick: false });
        if (kind === "beacon") part(id + "c", "cyl", [0.7, 1.3, 0.7], [0, -0.3, 0], P.sun1, { sides: 4, top: 0, emissive: true }), part(id + "c", "cyl", [0.7, 0.5, 0.7], [0, -0.28, 0], P.sun1, { sides: 4, top: 0, emissive: true, rot: [Math.PI, 0, 0] });
        else part(id + "c", "cyl", [0.5, 0.9, 0.5], [0, -0.3, 0], P.cell, { sides: 8, emissive: true }), part(id + "c", "cyl", [0.56, 0.12, 0.56], [0, 0.55, 0], P.hub, { sides: 8 }), part(id + "c", "cyl", [0.56, 0.12, 0.56], [0, -0.32, 0], P.hub, { sides: 8 });
        tmark.push([]);
        targets.push(g);
      }
    }
    for (let i = 0; i < CRYSTALS; i++) {
      const u = run.crystal.subarray(i * 3, i * 3 + 3), id = prop(u, any, 1.2, 0.9), col = P.crys[i % 3]!;
      const g = dio.add({ id: id + "c", shape: "group", size: [0.6, 0, 0.6], pos: [0, 0.25, 0], on: id, pick: false });
      part(id + "c", "cyl", [0.62, 0.62, 0.62], [0, 0.0, 0], col, { sides: 5, top: 0, emissive: P.night });
      part(id + "c", "cyl", [0.62, 0.42, 0.62], [0, 0.02, 0], col, { sides: 5, top: 0, rot: [Math.PI, 0, 0], emissive: P.night });
      part(id, "cyl", [0.5, 0.06, 0.5], [0, 0, 0], nightAt(u) ? P.nrock : P.floor, { sides: 6 });
      crystals.push(g);
    }
    for (let i = 0; i < ROCKS; i++) {
      const u = run.rock.subarray(i * 4, i * 4 + 3), r = run.rock[i * 4 + 3]!, id = prop(u, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], r * (pl.spires ? 1 : 1.3), r * 0.9);
      const colr = nightAt(u) ? P.nrock : P.rock;
      if (pl.spires) {
        part(id, "cyl", [r * 1.2, r * 3.4, r * 1.2], [0, -0.1, 0], colr, { sides: 4 + (i % 3), top: 0, rot: [(rnd() - 0.5) * 0.3, rnd() * TAU, (rnd() - 0.5) * 0.3], emissive: P.night && i % 4 === 0 });
        if (i % 2 === 0) part(id, "cyl", [r * 0.7, r * 2, r * 0.7], [r * 0.7, -0.1, r * 0.2], colr, { sides: 4, top: 0, rot: [0.3, rnd() * TAU, 0.2] });
      } else {
        part(id, "cyl", [r * 1.9, r * 1.05, r * 1.6], [0, -0.12, 0], colr, { sides: 5 + (i % 3), top: 0.42 + (i % 4) * 0.08, rot: [0, rnd() * TAU, (rnd() - 0.5) * 0.3] });
        if (i % 3 === 0) part(id, "cyl", [r * 0.9, r * 0.55, r * 0.8], [r * 0.95, -0.1, r * 0.3], colr, { sides: 5, top: 0.4, rot: [0, rnd() * TAU, 0] });
      }
    }
    for (let i = 0; i < CRATES; i++) {
      const u = run.crate.subarray(i * 3, i * 3 + 3), id = prop(u, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], 1.0, 0.9);
      part(id, "box", [0.95, 0.85, 0.95], [0, 0, 0], P.crate, { shadow: 0 });
      part(id, "box", [0.97, 0.16, 0.97], [0, 0.34, 0], P.strap);
      part(id, "box", [0.2, 0.87, 0.97], [0, 0, 0], P.strap);
      crates.push(props[props.length - 1]!);
    }
    for (let b = 0; b < BASES; b++) {
      const u = run.base.subarray(b * 3, b * 3 + 3), id = prop(u, any, 2.6, 2.0);
      part(id, "cyl", [4.0, 0.12, 4.0], [0, -0.04, 0], P.padC, { sides: 12 });
      part(id, "cyl", [3.0, 1.0, 3.0], [0, 0.05, 0], P.dome, { sides: 12, top: 0.78 });
      part(id, "cyl", [2.34, 0.7, 2.34], [0, 1.05, 0], P.dome, { sides: 12, top: 0.45 });
      part(id, "cyl", [3.04, 0.14, 3.04], [0, 0.5, 0], b ? P.domeWin : P.friend, { sides: 12, top: 0.98, emissive: true });
      part(id, "cyl", [0.1, 1.3, 0.1], [0.3, 1.6, 0], P.hub, { sides: 5 });
      part(id, "cyl", [0.5, 0.18, 0.5], [0.3, 2.85, 0], P.hub, { sides: 8, top: 1.4, rot: [0.5, 0, 0] });
      part(id, "box", [0.9, 0.55, 0.12], [0, 0.05, 1.42], P.chassis);
    }
    for (let i = 0; i < FRIENDS; i++) {
      const u = run.friend.subarray(i * 3, i * 3 + 3), id = prop(u, any, 1.0, 0.8), colr = i & 1 ? P.friend2 : P.friend;
      FF.set(F9, i * 9);
      const g = dio.add({ id: id + "b", shape: "group", size: [0.5, 0, 0.5], on: id, pick: false });
      const [al, ar] = alien(id + "b", colr, i === GIVER ? 1.2 : 1);
      if (i === GIVER) part(id + "b", "box", [0.04, 0.5, 0.36], [0, 1.25, 0], P.sun1, { emissive: true });
      friends.push([g, al!, ar!, props[props.length - 1]!]);
    }
    for (let k = 0; k < RAMPS; k++) {
      const u = run.ramp.subarray(k * 6, k * 6 + 3), f = run.ramp.subarray(k * 6 + 3, k * 6 + 6);
      if (!f[0] && !f[1] && !f[2]) continue;
      const id = prop(u, [-f[0]!, -f[1]!, -f[2]!], 2.4, 2.2, -o.height(u[0]!, u[1]!, u[2]!) + o.terrain(u[0]!, u[1]!, u[2]!));
      part(id, "wedge", [3.6, 0.95, 2.4], [0, 0, 0], P.night ? P.nrim : P.floor);
      part(id, "box", [0.14, 0.97, 2.44], [-1.8, 0, 0], P.glow, { emissive: true });
    }
    // The rover.
    dio.cluster("rover", { at: AN.subarray(NP * 3, NP * 3 + 3) });
    padO = dio.add({ id: "pad", shape: "group", size: [2.2, 0, 1.6], cluster: "rover", pick: false });
    const rv = buildRover(dio, "pad", "rv", wo.look, wo.kit, P, v.wheels);
    body = rv.body; hubs = rv.hubs; flame = rv.flame;
    cargo = dio.add({ shape: "box", size: [0.5, 0.4, 0.5], pos: [-0.35, 0.42, 0], on: "rv", color: P.cell, emissive: true, pick: false });
    for (let s = 0; s < SHIPS; s++) {
      const id = "s" + s, k = NP + 1 + s;
      dio.cluster(id, { at: AN.subarray(k * 3, k * 3 + 3) });
      const g = dio.add({ id, shape: "group", size: [1.6, 0, 1.2], cluster: id, pick: false, alpha: 0 });
      const sid = id + "x";
      dio.add({ id: sid, shape: "group", size: [1.6, 0, 1.2], on: id, pick: false });
      const sp = (size: number[], pos: number[], color: string, x: { shape?: "box" | "prism" | "cyl" | "wedge"; emissive?: boolean; outline?: number[][]; rot?: number[]; sides?: number; top?: number; taper?: number } = {}) =>
        dio.add({ shape: x.shape || "box", size: size.map((n) => n * 1.4), pos: pos.map((n) => n * 1.4), rot: x.rot, on: sid, color, emissive: x.emissive, outline: x.outline?.map((q2) => q2.map((n) => n * 1.4)), sides: x.sides, top: x.top, taper: x.taper, pick: false });
      if (pl.foe.shape === "crystal") {
        sp([0.9, 0.9, 0.9], [0, -0.2, 0], P.hull2, { shape: "cyl", sides: 4, top: 0 });
        sp([0.9, 0.5, 0.9], [0, -0.18, 0], P.hull, { shape: "cyl", sides: 4, top: 0, rot: [Math.PI, 0, 0] });
        sp([0.3, 0.2, 0.3], [0.2, 0.15, 0], P.sglow, { shape: "cyl", sides: 6, emissive: true });
        for (const zz of [-0.4, 0.4]) sp([0.5, 0.05, 0.05], [0, -0.3, zz], P.hull2, { rot: [0, 0.6, zz > 0 ? 0.5 : -0.5] });
      } else {
        sp([1, 0.22, 1], [0, 0, 0], P.hull, { shape: "prism", outline: [[0.95, 0], [-0.55, 0.62], [-0.32, 0], [-0.55, -0.62]], taper: 0.7 });
        sp([1, 0.12, 1], [0, 0.22, 0], P.hull2, { shape: "prism", outline: [[0.7, 0], [-0.4, 0.34], [-0.25, 0], [-0.4, -0.34]], taper: 1 });
        sp([0.42, 0.2, 0.26], [0.1, 0.3, 0], P.sglow, { shape: "cyl", sides: 6, top: 0.4, emissive: true });
        for (const zz of [-0.42, 0.42]) sp([0.36, 0.3, 0.05], [-0.38, 0.2, zz], P.hull2, { rot: [zz > 0 ? 0.4 : -0.4, 0, 0] });
        sp([0.12, 0.1, 0.62], [-0.5, 0.08, 0], P.sglow, { emissive: true });
      }
      sp([0.9, 0.04, 0.9], [-0.05, -0.04, 0], P.sglow, { shape: "cyl", sides: 6, emissive: true });
      ships.push(g);
    }
    dust = dio.points({ cap: DUST, color: P.dust, layer: 4 });
    debris = dio.points({ cap: DEBRIS, color: P.spark, layer: 6 });
    bolts = dio.points({ cap: BOLTS, color: P.bolt, layer: 7, paint: paintBolt });
    dio.decal("rover", 3, paintBeam);
    sky = null;
    paintMarks();
  }
  /** A friend (or a stranded one): this world's species, two arms. Returns the arm groups. */
  function alien(on: string, colr: string, s: number) {
    const part = (shape: "box" | "cyl", size: number[], pos: number[], color: string, x: { sides?: number; top?: number; emissive?: boolean; shadow?: number; rot?: number[] } = {}) =>
      dio.add({ shape, size: size.map((n) => n * s), pos: pos.map((n) => n * s), on, color, sides: x.sides, top: x.top, emissive: x.emissive, shadow: x.shadow, rot: x.rot, pick: false });
    const sh = pl.friend.shape, hy = sh === "tall" ? 1.55 : sh === "squat" ? 0.7 : 1, w = sh === "squat" ? 1.3 : sh === "tall" ? 0.85 : 1;
    if (sh === "crystal") {
      part("cyl", [0.5, 0.8, 0.5], [0, 0, 0], colr, { sides: 4, top: 0, shadow: 0.5 });
      part("cyl", [0.5, 0.3, 0.5], [0, 0.02, 0], colr, { sides: 4, top: 0, rot: [Math.PI, 0, 0] });
    } else {
      part("cyl", [0.5 * w, 0.42 * hy, 0.44 * w], [0, 0, 0], colr, { sides: 8, top: 0.72, shadow: 0.5 });
      part("cyl", [0.46 * w, 0.22 * hy, 0.42 * w], [0, 0.42 * hy, 0], colr, { sides: 8, top: 0.55 });
    }
    const ey = sh === "crystal" ? 0.42 : 0.4 * hy;
    part("box", [0.1, 0.13, 0.2], [0.21 * w, ey, 0], P.eye, { emissive: true });
    part("box", [0.05, 0.07, 0.08], [0.255 * w, ey + 0.02, 0.03], P.ink);
    if (sh !== "squat") part("cyl", [0.04, 0.3, 0.04], [0, 0.6 * hy, 0], colr, { sides: 4 }), part("cyl", [0.12, 0.12, 0.12], [0, 0.6 * hy + 0.28, 0], P.tip, { sides: 6, emissive: true });
    else for (const z of [-0.14, 0.14]) part("cyl", [0.1, 0.16, 0.1], [0, 0.62, z], P.tip, { sides: 6, emissive: true });
    if (sh === "ringed") part("cyl", [0.9, 0.04, 0.9], [0, 0.32, 0], P.tip, { sides: 12, emissive: true });
    const al = dio.add({ id: on + "l", shape: "group", size: [0.1, 0, 0.1], pos: [0, 0.32 * hy * s, -0.24 * w * s], on, pick: false });
    const ar = dio.add({ id: on + "r", shape: "group", size: [0.1, 0, 0.1], pos: [0, 0.32 * hy * s, 0.24 * w * s], on, pick: false });
    dio.add({ shape: "box", size: [0.08 * s, 0.3 * s, 0.08 * s], pos: [0, -0.04 * s, 0], on: on + "l", color: colr, pick: false });
    dio.add({ shape: "box", size: [0.08 * s, 0.3 * s, 0.08 * s], pos: [0, -0.04 * s, 0], on: on + "r", color: colr, pick: false });
    return [al, ar];
  }

  // ---- state ----
  const I = new Float64Array(7), GP = new Float64Array(7);
  const V = new Float64Array(7);
  V[0] = V[1] = 1;
  let auto = !!wo.attract, dirty = true, hudDirty = true, toastT = 0, sayT = 0, sayAt = -1, pulse = 0, spin = 0, tall = false, said = "", sky: CanvasGradient | null = null, lineK = 0;
  const was = new Float64Array(12).fill(-1);
  const FXA = new Float64Array(5);
  const ro = new ResizeObserver(() => ((V[0] = 1), engine.wake()));
  ro.observe(stage);
  const padHello = () => ((V[4] = 1), engine.wake());
  addEventListener("gamepadconnected", padHello, sig);
  engine.signal.addEventListener("abort", () => ro.disconnect(), { once: true });

  /** The camera: steady. One framing per stage shape (wide or tall), set when the width changes. */
  function frame() {
    const cam = dio.cam, W = dio.width, H = dio.height;
    tall = H / W > 0.9;
    cam.yaw = 0;
    cam.pitch = tall ? 0.62 : 0.54;
    cam.dist = tall ? 22 : 19;
    cam.fov = tall ? 0.74 : 0.6;
    cam.tx = 0; cam.ty = 0.6; cam.tz = tall ? -2.4 : -2;
    cam.ox = 0; cam.oy = tall ? 14 : 20;
    V[6] = W;
  }
  function eye() {
    const cam = dio.cam, cp = Math.cos(cam.pitch);
    view.eye(cam.tx + cam.dist * Math.sin(cam.yaw) * cp, cam.ty + cam.dist * Math.sin(cam.pitch), cam.tz + cam.dist * Math.cos(cam.yaw) * cp);
  }
  const OQ = new Float64Array(7), PQ = new Float64Array(6), CB = new Float64Array(14), HQ = o.HQ, LIGHTV = new Float64Array(3);
  function ow() {
    const Q = view.Q, E = view.E, x = OQ[0]!, y = OQ[1]!, z = OQ[2]!, l = Math.sqrt(x * x + y * y + z * z) || 1;
    OQ[3] = Q[0]! * x + Q[1]! * y + Q[2]! * z;
    OQ[4] = Q[3]! * x + Q[4]! * y + Q[5]! * z - R;
    OQ[5] = Q[6]! * x + Q[7]! * y + Q[8]! * z;
    OQ[6] = (E[0]! * x + E[1]! * y + E[2]! * z) / l - l;
  }
  function camBasis() {
    const cc = dio.cam, cp = Math.cos(cc.pitch), sp = Math.sin(cc.pitch), cy = Math.cos(cc.yaw), sy = Math.sin(cc.yaw);
    CB[0] = cc.tx + cc.dist * sy * cp; CB[1] = cc.ty + cc.dist * sp; CB[2] = cc.tz + cc.dist * cy * cp;
    const fx2 = -sy * cp, fy = -sp, fz = -cy * cp, rx = cy, rz = -sy;
    CB[3] = rx; CB[4] = 0; CB[5] = rz;
    CB[6] = -rz * fy; CB[7] = rz * fx2 - rx * fz; CB[8] = rx * fy;
    CB[9] = fx2; CB[10] = fy; CB[11] = fz;
    CB[12] = dio.height / 2 / Math.tan(cc.fov / 2);
    CB[13] = 0;
  }
  function pq() {
    const cc = dio.cam, dx = PQ[0]! - CB[0]!, dy = PQ[1]! - CB[1]!, dz = PQ[2]! - CB[2]!, zz = dx * CB[9]! + dy * CB[10]! + dz * CB[11]!, k = CB[12]! / Math.max(zz, 0.05);
    PQ[3] = dio.width / 2 + cc.ox + (dx * CB[3]! + dy * CB[4]! + dz * CB[5]!) * k;
    PQ[4] = dio.height / 2 + cc.oy - (dx * CB[6]! + dy * CB[7]! + dz * CB[8]!) * k;
    PQ[5] = zz;
    return zz > 0.05;
  }
  function opq() {
    ow();
    PQ[0] = OQ[3]!; PQ[1] = OQ[4]!; PQ[2] = OQ[5]!;
    return pq();
  }
  function pose() {
    euler(view.Q, moon.rot);
    eye();
    camBasis();
    cullTiles();
    poseProps();
    poseRover();
    poseShips();
    toWorld(dust, DO);
    toWorld(debris, BR);
    poseBolts();
    const Q = view.Q;
    LIGHTV[0] = Q[0]! * SUNV[0]! + Q[1]! * SUNV[1]! + Q[2]! * SUNV[2]!;
    LIGHTV[1] = Q[3]! * SUNV[0]! + Q[4]! * SUNV[1]! + Q[5]! * SUNV[2]!;
    LIGHTV[2] = Q[6]! * SUNV[0]! + Q[7]! * SUNV[1]! + Q[8]! * SUNV[2]!;
    dio.setLight(LIGHTV, P.amb);
  }
  function cullTiles() {
    const W = dio.width, H = dio.height, f = CB[12]!, Cc = T.centre;
    let shown = 0;
    for (let i = 0; i < T.n; i++) {
      OQ[0] = Cc[i * 3]!; OQ[1] = Cc[i * 3 + 1]!; OQ[2] = Cc[i * 3 + 2]!;
      ow();
      let vis = OQ[6]! > -0.9;
      if (vis) {
        PQ[0] = OQ[3]!; PQ[1] = OQ[4]!; PQ[2] = OQ[5]!;
        if (!pq()) vis = false;
        else { const m = (2.6 * f) / Math.max(1, PQ[5]!); vis = PQ[3]! > -m && PQ[3]! < W + m && PQ[4]! > -m && PQ[4]! < H + m; }
      }
      tiles[i]!.hidden = !vis;
      if (vis) shown++;
    }
    V[3] = shown;
  }
  function poseProps() {
    const Q = view.Q, E = view.E;
    for (let k = 0; k < props.length; k++) {
      OQ[0] = PU[k * 3]!; OQ[1] = PU[k * 3 + 1]!; OQ[2] = PU[k * 3 + 2]!;
      ow();
      const vis = OQ[6]! > -PR[k]! - 0.6, p = props[k]!;
      p.alpha = vis ? 1 : 0;
      if (!vis) continue;
      const x = OQ[0]!, y = OQ[1]!, z = OQ[2]!;
      let dx = E[0]! - x, dy = E[1]! - y, dz = E[2]! - z;
      const l = PN[k]! / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
      dx = x + dx * l; dy = y + dy * l; dz = z + dz * l;
      AN[k * 3] = Q[0]! * dx + Q[1]! * dy + Q[2]! * dz;
      AN[k * 3 + 1] = Q[3]! * dx + Q[4]! * dy + Q[5]! * dz - R;
      AN[k * 3 + 2] = Q[6]! * dx + Q[7]! * dy + Q[8]! * dz;
    }
    for (let i = 0; i < CRYSTALS; i++) {
      if (run.got[i]) crystals[i]!.alpha = 0;
      crystals[i]!.rot[1] = spin + i;
    }
    for (let i = 0; i < CRATES; i++) if (run.smashed[i]) crates[i]!.alpha = 0;
    // Targets: picked up ones go (cells, shards, the stranded); the core leaves the depot while carried.
    const kind = M.kind, S = run.S;
    for (let k = 0; k < NT; k++) {
      const g = targets[k]!;
      if ((kind === "collect" || kind === "rescue" || (kind === "beacon" && k < M.count)) && run.tgot[k]) g.alpha = 0;
      if (kind === "collect" || kind === "beacon") if (k < M.count) g.rot[1] = spin * 1.4 + k, (g.pos[1] = 0.5 + Math.sin(pulse * 3 + k) * 0.12);
      if (kind === "deliver" && k === 0) tmark[0]![0]!.alpha = S[CARRY] || S[MP] === M_DONE ? 0 : 1;
    }
    for (let i = 0; i < FRIENDS; i++) {
      const fr = friends[i]!, g = fr[0]!, al = fr[1]!, ar = fr[2]!, r = run.fReact[i]!, k = r > 0 ? Math.abs(Math.sin(r * 9)) : 0;
      g.pos[1] = r > 0 ? Math.abs(Math.sin(r * 7)) * 0.35 : 0;
      al.rot[0] = -0.12 - k * 2.4;
      ar.rot[0] = 0.12 + (r > 0 ? Math.abs(Math.sin(r * 9 + 1.3)) * 2.4 : 0);
      const F = FF.subarray(i * 9, i * 9 + 9), dx = run.P[0]! - run.friend[i * 3]! * R, dy = run.P[1]! - run.friend[i * 3 + 1]! * R, dz = run.P[2]! - run.friend[i * 3 + 2]! * R;
      g.rot[1] = Math.atan2(-(dx * F[6]! + dy * F[7]! + dz * F[8]!), dx * F[0]! + dy * F[1]! + dz * F[2]!);
    }
  }
  function poseRover() {
    const F = run.chart.F, g = R + run.chart.ground();
    OQ[0] = F[3]! * g; OQ[1] = F[4]! * g; OQ[2] = F[5]! * g;
    ow();
    padO.pos[0] = OQ[3]!; padO.pos[1] = OQ[4]!; padO.pos[2] = OQ[5]!;
    rotOf(F, true, padO.rot);
    body.pos[0] = v.pos[0]!; body.pos[1] = v.pos[1]! - (g - R); body.pos[2] = v.pos[2]!;
    body.rot.set(v.rot);
    const crashed = v.crashed, hurt = run.S[HURT]!;
    body.alpha = hurt > 0 && !crashed && ((hurt * 10) | 0) % 2 ? 0.35 : 1;
    for (let i = 0; i < 4; i++) {
      const h = hubs[i]!;
      h.pos[0] = v.wheels[i * 2]!;
      h.pos[1] = crashed ? -0.2 : -(v.rest - v.comp[i]!);
      h.pos[2] = v.wheels[i * 2 + 1]!;
      h.rot[1] = i < 2 && !crashed ? -v.steerAngle : 0;
      h.rot[2] = -v.spin[i]!;
    }
    flame.alpha = I[IN_BOOST]! > 0 && run.S[BOOST]! > 0.02 && v.air === 0 ? 1 : 0;
    cargo.alpha = run.S[CARRY] ? 1 : 0;
    const Q = view.Q, E = view.E, x = run.P[0]!, y = run.P[1]!, z = run.P[2]!;
    let dx = E[0]! - x, dy = E[1]! - y, dz = E[2]! - z;
    const l = 2.2 / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
    dx = x + dx * l; dy = y + dy * l; dz = z + dz * l;
    AN[NP * 3] = Q[0]! * dx + Q[1]! * dy + Q[2]! * dz;
    AN[NP * 3 + 1] = Q[3]! * dx + Q[4]! * dy + Q[5]! * dz - R;
    AN[NP * 3 + 2] = Q[6]! * dx + Q[7]! * dy + Q[8]! * dz;
  }
  function poseShips() {
    const SH = run.SH;
    for (let s = 0; s < SHIPS; s++) {
      const q2 = s * 9, g2 = ships[s]!;
      if (!SH[q2]) { g2.alpha = 0; continue; }
      HQ[0] = SH[q2 + 1]!; HQ[1] = SH[q2 + 2]!; HQ[2] = SH[q2 + 3]!;
      o.hq();
      const h = R + HQ[3]! + 1.5 + Math.sin(engine.time * 3 + s) * 0.18;
      OQ[0] = SH[q2 + 1]! * h; OQ[1] = SH[q2 + 2]! * h; OQ[2] = SH[q2 + 3]! * h;
      ow();
      const fade = SH[q2 + 8]! > 0 ? Math.max(0, 1 - SH[q2 + 8]! / 1.4) : Math.min(1, SH[q2 + 7]! * 3);
      g2.alpha = OQ[6]! > -1.5 ? fade : 0;
      g2.pos[0] = OQ[3]!; g2.pos[1] = OQ[4]!; g2.pos[2] = OQ[5]!;
      const vx = SH[q2 + 4]!, vy = SH[q2 + 5]!, vz = SH[q2 + 6]!;
      if (vx * vx + vy * vy + vz * vz > 0.04) o.frameA(SH, q2 + 1, SH, q2 + 4, F9);
      else (SV3[0] = run.P[0]! - SH[q2 + 1]! * R), (SV3[1] = run.P[1]! - SH[q2 + 2]! * R), (SV3[2] = run.P[2]! - SH[q2 + 3]! * R), o.frameA(SH, q2 + 1, SV3, 0, F9);
      rotOf(F9, true, g2.rot);
      g2.rot[0] = g2.rot[0]! + Math.sin(engine.time * 2 + s) * 0.12;
      const k = (NP + 1 + s) * 3, E = view.E, Q = view.Q, x = OQ[0]!, y = OQ[1]!, z = OQ[2]!;
      let dx = E[0]! - x, dy = E[1]! - y, dz = E[2]! - z;
      const l = 1.2 / (Math.sqrt(dx * dx + dy * dy + dz * dz) || 1);
      dx = x + dx * l; dy = y + dy * l; dz = z + dz * l;
      AN[k] = Q[0]! * dx + Q[1]! * dy + Q[2]! * dz;
      AN[k + 1] = Q[3]! * dx + Q[4]! * dy + Q[5]! * dz - R;
      AN[k + 2] = Q[6]! * dx + Q[7]! * dy + Q[8]! * dz;
      g2.tint = SH[q2 + 8]! > 0 ? P.sun1 : null;
    }
  }
  function poseBolts() {
    const BO = run.BO;
    for (let b = 0; b < BOLTS; b++) {
      const k = b * 7;
      if (BO[k]! <= 0) { bolts.a[b] = 0; continue; }
      HQ[0] = BO[k + 1]!; HQ[1] = BO[k + 2]!; HQ[2] = BO[k + 3]!;
      o.hq();
      const h = R + HQ[3]! + 0.75;
      OQ[0] = BO[k + 1]! * h; OQ[1] = BO[k + 2]! * h; OQ[2] = BO[k + 3]! * h;
      ow();
      bolts.x[b] = OQ[3]!; bolts.y[b] = OQ[4]!; bolts.z[b] = OQ[5]!; bolts.r[b] = 0.1; bolts.a[b] = OQ[6]! > -0.5 ? 1 : 0;
    }
    bolts.n = BOLTS;
  }
  function toWorld(pool: DioramaPoints, A: Float64Array) {
    for (let i = 0; i < pool.n; i++) {
      const k = i * 8;
      if (A[k + 6]! <= 0) { pool.a[i] = 0; continue; }
      OQ[0] = A[k]!; OQ[1] = A[k + 1]!; OQ[2] = A[k + 2]!;
      ow();
      pool.x[i] = OQ[3]!; pool.y[i] = OQ[4]!; pool.z[i] = OQ[5]!;
      if (OQ[6]! < -0.8) pool.a[i] = 0;
    }
  }
  /** The beacon (lit once the mission is done), the pad (red locked, green open), the targets (next one pink). */
  function paintMarks() {
    const S = run.S, doneM = S[MP] === M_DONE;
    for (const p of bcn) p.color = doneM ? P.bLit : P.bIdle;
    for (const p of padMark) p.color = doneM ? P.open : P.lock;
    for (let k = 0; k < tmark.length; k++) {
      const next = S[MP] === M_RUN && ((M.kind === "race" && k === S[MK]) || (M.kind === "deliver" && k === (S[CARRY] ? 1 : 0)) || M.kind === "defend") || (S[MP] === M_BACK && M.kind === "beacon" && k === M.count);
      const colr = doneM ? P.bLit : next ? P.bNext : run.tgot[k] ? P.bLit : P.bIdle;
      for (const p of tmark[k]!) if (!(M.kind === "deliver" && k === 0) && !(M.kind === "rescue")) p.color = colr;
    }
  }

  // ---- FX ----
  function puff(pool: DioramaPoints, A: Float64Array, cap: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number) {
    let j = pool.n < cap ? pool.n++ : -1;
    if (j < 0) { let lo = Infinity; for (let i = 0; i < cap; i++) if (A[i * 8 + 6]! < lo) (lo = A[i * 8 + 6]!), (j = i); }
    const k = j * 8;
    A[k] = x; A[k + 1] = y; A[k + 2] = z; A[k + 3] = vx; A[k + 4] = vy; A[k + 5] = vz; A[k + 6] = life; A[k + 7] = life;
    pool.r[j] = r; pool.a[j] = 1;
  }
  function stepPool(pool: DioramaPoints, A: Float64Array, dt: number, g: number, grow: number, a0: number, drag: number) {
    let liveN = 0;
    for (let i = 0; i < pool.n; i++) {
      const k = i * 8, l = A[k + 6]!;
      if (l <= 0) continue;
      const nl = l - dt, x = A[k]!, y = A[k + 1]!, z = A[k + 2]!, d = Math.sqrt(x * x + y * y + z * z);
      A[k + 6] = nl;
      A[k + 3] = A[k + 3]! * (1 - drag * dt) - (x / d) * g * dt;
      A[k + 4] = A[k + 4]! * (1 - drag * dt) - (y / d) * g * dt;
      A[k + 5] = A[k + 5]! * (1 - drag * dt) - (z / d) * g * dt;
      A[k] = x + A[k + 3]! * dt; A[k + 1] = y + A[k + 4]! * dt; A[k + 2] = z + A[k + 5]! * dt;
      pool.r[i] = pool.r[i]! + grow * dt;
      pool.a[i] = nl > 0 ? a0 * (nl / A[k + 7]!) : 0;
      if (nl > 0) liveN++;
    }
    if (!liveN) pool.n = 0;
    return liveN > 0;
  }
  function spray(pool: DioramaPoints, A: Float64Array, cap: number, x: number, y: number, z: number, n: number, sp: number, up: number, life: number, r: number) {
    const l = Math.sqrt(x * x + y * y + z * z), ux = x / l, uy = y / l, uz = z / l;
    for (let k = 0; k < n; k++) {
      let ax = rnd() * 2 - 1, ay = rnd() * 2 - 1, az = rnd() * 2 - 1;
      const d = ax * ux + ay * uy + az * uz;
      ax -= d * ux; ay -= d * uy; az -= d * uz;
      const s = sp * (0.4 + rnd()), u2 = up * (0.4 + rnd());
      puff(pool, A, cap, x, y, z, ax * s + ux * u2, ay * s + uy * u2, az * s + uz * u2, life * (0.6 + rnd() * 0.6), r);
    }
  }
  function blast(x: number, y: number, z: number, power: number, word: number, colr: number) {
    OQ[0] = x; OQ[1] = y; OQ[2] = z;
    if (!opq() || OQ[6]! < -1) return;
    FXA[0] = x; FXA[1] = y; FXA[2] = z; FXA[3] = PQ[3]!; FXA[4] = PQ[4]!;
    if (power > 0) fx.blast(PQ[3]!, PQ[4]!, power, colr);
    if (word >= 0) fx.word(PQ[3]!, PQ[4]! - 18, word, colr, 18);
  }
  let emitK = 0;
  function stepFx(dt: number) {
    if (run.S[PH] === RUN && !v.crashed) {
      emitK += v.dust * 60 * dt + (Math.abs(v.speed) > 4 && v.air === 0 ? Math.abs(v.speed) * 0.6 * dt : 0);
      while (emitK >= 1) {
        emitK -= 1;
        const w = 2 + (rnd() < 0.5 ? 1 : 0);
        const F = run.chart.F, x = v.wheel[w * 3]!, y = R + v.wheel[w * 3 + 1]! - 0.25, z = v.wheel[w * 3 + 2]!;
        tmp[0] = y * F[3]! + x * F[0]! + z * F[6]!; tmp[1] = y * F[4]! + x * F[1]! + z * F[7]!; tmp[2] = y * F[5]! + x * F[2]! + z * F[8]!;
        const l = Math.sqrt(tmp[0]! * tmp[0]! + tmp[1]! * tmp[1]! + tmp[2]! * tmp[2]!);
        puff(dust, DO, DUST, tmp[0]!, tmp[1]!, tmp[2]!, -run.Fw[0]! * 1.2 + (rnd() - 0.5) + (tmp[0]! / l) * 1.2, -run.Fw[1]! * 1.2 + (rnd() - 0.5) + (tmp[1]! / l) * 1.2, -run.Fw[2]! * 1.2 + (rnd() - 0.5) + (tmp[2]! / l) * 1.2, 0.6 + rnd() * 0.5, 0.12);
      }
    }
    let anyLive = stepPool(dust, DO, dt, 1.2, 0.3, 0.42, 1.2);
    if (stepPool(debris, BR, dt, 9, -0.02, 1, 0.6)) anyLive = true;
    fx.step(dt);
    if (fx.live || fx.shake > 0) anyLive = true;
    return anyLive;
  }

  // ---- talk: a speech bubble over the friend ----
  function talkTo(i: number, text: string) {
    sayAt = i;
    sayWho.textContent = i === GIVER ? `${pl.friend.name.toUpperCase()} ELDER` : i === TRADER ? `${pl.friend.name.toUpperCase()} TRADER` : pl.friend.name.toUpperCase();
    sayText.textContent = text;
    sayEl.hidden = false;
    sayT = 4.2;
    say(`${sayWho.textContent}: ${text}`);
  }
  const lineOf = () => pl.friend.lines[lineK++ % pl.friend.lines.length]!;

  // ---- events: stickers, sound, FX, the shell ----
  function events() {
    const S = run.S;
    for (let k = 0; k < run.n; k++) {
      const e = k * 5, type = run.ev[e]!, val = run.ev[e + 1]!, x = run.ev[e + 2]!, y = run.ev[e + 3]!, z = run.ev[e + 4]!;
      hudDirty = true;
      if (type === E_START) engine.events.emit("start"), toast(S[MP] === M_DONE ? `${pl.name.toUpperCase()} · FREE ROAM` : `FIND THE ${pl.friend.name.toUpperCase()} ELDER`, "go");
      else if (type === E_CRYSTAL) engine.events.emit("crystal"), spray(debris, BR, DEBRIS, x, y, z, 10, 3, 4, 0.6, 0.08), blast(x, y, z, 0, 2, 4);
      else if (type === E_FRIEND) {
        engine.events.emit("friend");
        const g = val & 3;
        toast(g === G_BOOST ? "A FRIEND! BOOST REFILLED" : g === G_CRYSTALS ? "A FRIEND! +3 CRYSTALS" : S[SHD]! >= S[MAXS]! ? "A FRIEND! +2 CRYSTALS" : "A FRIEND! +1 SHIELD", "clean");
        blast(x, y, z, 0, g === G_BOOST ? 6 : g === G_CRYSTALS ? 8 : 7, 5);
        spray(debris, BR, DEBRIS, x * 1.03, y * 1.03, z * 1.03, 12, 2, 5, 0.9, 0.08);
      } else if (type === E_TALK) {
        engine.events.emit("talk");
        talkTo(val, val === GIVER ? (S[MP] === M_RUN || S[MP] === M_BACK ? M.doing : lineOf()) : val === TRADER ? "Bring crystals, I pay credits. Five a piece!" : lineOf());
      } else if (type === E_MSTART) engine.events.emit("talk"), talkTo(GIVER, M.offer), toast(`MISSION · ${M.title.toUpperCase()}`, "go"), paintMarks();
      else if (type === E_MSTEP) {
        engine.events.emit("beacon");
        spray(debris, BR, DEBRIS, x * 1.04, y * 1.04, z * 1.04, 16, 4, 5, 0.8, 0.1);
        blast(x, y, z, 0, M.kind === "race" ? 3 : 4, 4);
        const tx = M.kind === "race" ? `GATE ${val}/${M.count}` : M.kind === "deliver" ? "CORE LOADED · TO THE OUTPOST" : M.kind === "rescue" ? `${pl.friend.name.toUpperCase()} TOWED ${val}/${M.count}` : M.kind === "beacon" ? `SHARD ${val}/${M.count}` : M.kind === "defend" ? "IN THE RING · HOLD IT!" : `CELL ${val}/${M.count}`;
        toast(tx, "clean"); say(tx);
        paintMarks();
      } else if (type === E_RETURN) toast(M.kind === "beacon" ? "ALL SHARDS · TO THE GREAT BEACON" : `ALL FOUND · BACK TO THE ELDER`, "go"), paintMarks();
      else if (type === E_MDONE) {
        engine.events.emit("done");
        spray(debris, BR, DEBRIS, x * 1.12, y * 1.12, z * 1.12, 30, 5, 6, 1, 0.12);
        talkTo(GIVER, M.thanks);
        toast(M.kind === "beacon" ? "THE NETWORK IS LIT!" : "MISSION DONE · BEACON LIT · PAD OPEN", "go");
        paintMarks();
        wo.on("done", 0);
      } else if (type === E_MFAIL) toast("TOO SLOW! TALK TO THE ELDER TO RETRY", "bad"), say("Too slow. Talk to the elder to try again"), paintMarks();
      else if (type === E_PAD) engine.events.emit("done"), toast("LAUNCH!", "go"), wo.on("pad", 0);
      else if (type === E_LOCKED) toast("PAD LOCKED · FINISH THE MISSION", "meh");
      else if (type === E_NEED) toast("YOU NEED A TOW CLAW (GARAGE)", "meh");
      else if (type === E_TRADE) engine.events.emit("talk"), talkTo(TRADER, `Lovely crystals! ◈ ${val * 5} credits for you.`), wo.on("trade", val);
      else if (type === E_DROP) toast("CARGO LOST! BACK TO THE DEPOT", "bad"), paintMarks();
      else if (type === E_STEAL) engine.events.emit("hit"), blast(x, y, z, 1, 10, 3), toast(`${pl.foe.name.toUpperCase()}! −${val} CRYSTALS`, "bad");
      else if (type === E_LAVA) engine.events.emit("hit"), blast(x, y, z, 1.2, 10, 2), toast("LAVA! −1 SHIELD", "bad");
      else if (type === E_SHOT) engine.events.emit("shot");
      else if (type === E_KILL) engine.events.emit("kill"), blast(x, y, z, 1.15, val & 1 ? 0 : 1, 4), spray(debris, BR, DEBRIS, x, y, z, 22, 6, 3, 1.1, 0.1), fx.kick(4);
      else if (type === E_HIT) {
        engine.events.emit("hit");
        blast(x, y, z, 1.3, 10, 3);
        spray(debris, BR, DEBRIS, x, y, z, 20, 5, 4, 1, 0.1);
        toast(val > 0 ? `RAMMED! ${val} SHIELD${val > 1 ? "S" : ""} LEFT` : "RAMMED!", "bad");
        say(`Rammed, ${val} shields left`);
      } else if (type === E_CRATE) engine.events.emit("crate"), spray(debris, BR, DEBRIS, x, y, z, 16, 4, 5, 0.9, 0.12), blast(x, y, z, 0, 11, 1);
      else if (type === E_DARK) {
        engine.events.emit(val ? "dark" : "right");
        toast(val ? `NIGHT SIDE · ${pl.foe.name.toUpperCase()}` : "BACK IN THE SUN", val ? "bad" : "go");
        say(val ? `Night side. ${pl.foe.name}` : "Back in the sun");
      } else if (type === E_JUMP) engine.events.emit("jump"), spray(dust, DO, DUST, x, y, z, 8, 2.5, 0.8, 0.6, 0.16);
      else if (type === E_LAND) spray(dust, DO, DUST, x, y, z, 10, 3, 0.6, 0.7, 0.18);
      else if (type === E_CRASH) engine.events.emit("hit"), toast("FLIPPED IT", "meh"), spray(dust, DO, DUST, x, y, z, 14, 3, 1.2, 0.8, 0.2);
      else if (type === E_RIGHT) engine.events.emit("right"), val && paintMarks();
      else if (type === E_BUMP) engine.events.emit("crate");
      else if (type === E_BURN) spray(debris, BR, DEBRIS, x, y, z, 10, 3, 3, 0.7, 0.08);
      else if (type === E_DOWN) {
        engine.events.emit("over");
        blast(x, y, z, 1.4, -1, 3);
        cardT.textContent = S[CARRY] || M.kind === "race" || M.kind === "defend" ? "Shields gone. The mission step starts over." : "Shields gone. Your finds are safe.";
        card.hidden = false;
        say("Rover down");
        if (!wo.attract) again.focus({ preventScroll: true });
        engine.busy(1.4);
        wo.on("down", 0);
      }
    }
    run.clear();
  }
  function toast(text: string, kind: string) {
    toastEl.textContent = text;
    toastEl.className = "mr-toast mr-" + kind;
    toastEl.hidden = false;
    toastT = 1.9;
  }
  function say(s: string) {
    if (s === said) s += " ";
    live.textContent = said = s;
  }
  function hudWrite() {
    const S = run.S, mp = S[MP]!;
    const job = mp === M_DONE ? (M.kind === "beacon" ? "NETWORK LIT ★" : "PAD OPEN ⇧") : mp === M_OFFER ? `TALK TO THE ELDER` : M.kind === "race" ? `GATE ${S[MK]! + 1}/${M.count}` : M.kind === "deliver" ? (S[CARRY] ? "TO THE OUTPOST" : "TO THE DEPOT") : M.kind === "defend" ? (S[MK] ? "HOLD THE RING" : "TO THE BEACON") : mp === M_BACK ? (M.kind === "beacon" ? "TO THE GREAT BEACON" : "BACK TO THE ELDER") : `${M.kind === "beacon" ? "SHARDS" : M.kind === "rescue" ? "RESCUED" : "CELLS"} ${S[MK]}/${M.count}`;
    if (jobEl.textContent !== job) jobEl.textContent = job;
    const timed = mp === M_RUN && (M.kind === "race" || M.kind === "defend"), sec = Math.ceil(S[CLK]!);
    timeChip.hidden = !timed;
    if (timed && was[0] !== sec) (was[0] = sec), (timeEl.textContent = `${(sec / 60) | 0}:${String(sec % 60).padStart(2, "0")}`), timeChip.classList.toggle("mr-low", M.kind === "race" && sec <= 15);
    if (was[3] !== S[CRY]) (was[3] = S[CRY]!), (cryEl.textContent = "" + S[CRY]);
    if (was[5] !== S[SHD] || was[7] !== S[MAXS]) {
      was[5] = S[SHD]!; was[7] = S[MAXS]!;
      let h = "";
      for (let i = 0; i < S[MAXS]!; i++) h += `<i${i >= S[SHD]! ? ' class="mr-off"' : ""}></i>`;
      shdChip.innerHTML = h;
    }
    const b = Math.round(S[BOOST]! * 20);
    if (was[6] !== b) (was[6] = b), (boostEl.style.width = b * 5 + "%"), boostChip.classList.toggle("mr-full", b >= 20);
    const nf = S[NEAR]!, touch = !!thePad.el.offsetParent;
    const hint = S[PH] === READY ? (touch ? "Stick to drive · ACT to talk · ★ FIRE · BOOST · JUMP" : "↑ W drive · ← → steer · E talk · Space fire · Shift boost · J jump") : nf >= 0 && nf < 2 ? (touch ? "Tap ACT to talk" : "Press E to talk") : "";
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }
  function respawn() {
    run.respawn();
    card.hidden = true;
    dust.n = debris.n = 0;
    fx.clear();
    view.follow(run.U, run.Fw, 1);
    was.fill(-1);
    hudDirty = dirty = true;
    paintMarks();
    engine.busy(1);
    play.focus({ preventScroll: true });
  }

  // ---- drawing extras ----
  function skyAt(D: ArrayLike<number>, i: number) {
    const Q = view.Q, x = D[i]!, y = D[i + 1]!, z = D[i + 2]!;
    PQ[0] = CB[0]! + (Q[0]! * x + Q[1]! * y + Q[2]! * z) * 900;
    PQ[1] = CB[1]! + (Q[3]! * x + Q[4]! * y + Q[5]! * z) * 900;
    PQ[2] = CB[2]! + (Q[6]! * x + Q[7]! * y + Q[8]! * z) * 900;
    const ok = pq();
    tmp[0] = PQ[3]!; tmp[1] = PQ[4]!; tmp[2] = PQ[5]!;
    return ok;
  }
  function paintSky(ctx: CanvasRenderingContext2D) {
    const W = dio.width, H = dio.height, f = dio.focal();
    if (!sky) {
      sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, P.sky0);
      sky.addColorStop(0.6, P.sky1);
      sky.addColorStop(1, P.sky2);
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const ex = CB[0]!, ey = CB[1]!, ez = CB[2]!;
    ctx.fillStyle = P.star;
    for (let i = 0; i < 180; i++) {
      if (!skyAt(STARS, i * 4) || tmp[0]! < -2 || tmp[0]! > W + 2 || tmp[1]! < -2 || tmp[1]! > H + 2) continue;
      const b = STARS[i * 4 + 3]!;
      ctx.globalAlpha = P.night ? 0.3 + b * 0.7 : 0.35 + b * 0.5;
      const s = b > 0.92 ? 2.4 : 1.4;
      ctx.fillRect(tmp[0]! - s / 2, tmp[1]! - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    // The next world in the sky: banded, ringed.
    if (skyAt(PLANET, 0)) {
      const x = tmp[0]!, y = tmp[1]!, r = f * 0.13;
      if (x > -r * 3 && x < W + r * 3 && y > -r * 3 && y < H + r * 3) {
        ctx.lineWidth = Math.max(2, r * 0.09);
        ctx.strokeStyle = P.ring;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 2, r * 0.5, -0.3, Math.PI, TAU);
        ctx.stroke();
        ctx.fillStyle = P.planet;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.translate(x, y);
        ctx.rotate(-0.3);
        ctx.fillStyle = P.band;
        ctx.fillRect(-r, -r * 0.42, r * 2, r * 0.22);
        ctx.fillRect(-r, r * 0.18, r * 2, r * 0.14);
        ctx.fillStyle = P.band2;
        ctx.fillRect(-r, -r * 0.08, r * 2, r * 0.1);
        ctx.fillStyle = P.sky0;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(r * 0.35, -r * 0.3, r * 1.05, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.lineWidth = Math.max(2, r * 0.09);
        ctx.strokeStyle = P.ring;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 2, r * 0.5, -0.3, 0, Math.PI);
        ctx.stroke();
      }
    }
    if (skyAt(SUNV, 0) && tmp[2]! > 0) {
      const x = tmp[0]!, y = tmp[1]!, r = f * 0.06;
      if (x > -r * 4 && x < W + r * 4 && y > -r * 4 && y < H + r * 4) {
        const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3.4);
        g.addColorStop(0, P.sun1);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = P.night ? 0.5 : 0.4;
        ctx.fillStyle = g;
        ctx.fillRect(x - r * 3.4, y - r * 3.4, r * 6.8, r * 6.8);
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.sun0;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
    {
      const cx = 0, cy = -R, cz = 0, dx = ex - cx, dy = ey - cy, dz = ez - cz, dd = dx * dx + dy * dy + dz * dz, k = (R * R) / dd, rr = R * Math.sqrt(1 - k);
      const ox = cx + dx * k, oy = cy + dy * k, oz = cz + dz * k, dl = Math.sqrt(dd), ax = dx / dl, ay = dy / dl, az = dz / dl;
      let bx = -az, by = 0, bz = ax;
      const bl = Math.hypot(bx, bz) || 1;
      bx /= bl; bz /= bl;
      const qx = ay * bz - az * by, qy = az * bx - ax * bz, qz = ax * by - ay * bx;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * TAU, c0 = Math.cos(t) * rr, s0 = Math.sin(t) * rr;
        PQ[0] = ox + bx * c0 + qx * s0; PQ[1] = oy + by * c0 + qy * s0; PQ[2] = oz + bz * c0 + qz * s0;
        if (!pq()) { started = false; continue; }
        if (!started) ctx.moveTo(PQ[3]!, PQ[4]!), (started = true);
        else ctx.lineTo(PQ[3]!, PQ[4]!);
      }
      ctx.strokeStyle = P.glow;
      ctx.lineJoin = "round";
      if (P.night) ctx.globalCompositeOperation = "lighter";
      for (const [w, a] of [[16, 0.08], [8, 0.16], [3, 0.5]] as const) (ctx.lineWidth = w), (ctx.globalAlpha = a), ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }
  function beamAt(fw: number, sd: number) {
    const F = run.chart.F, cy = v._s[20]!, sy = v._s[21]!, x = cy * fw + sy * sd, z = -sy * fw + cy * sd;
    const px = R * F[3]! + x * F[0]! + z * F[6]!, py = R * F[4]! + x * F[1]! + z * F[7]!, pz = R * F[5]! + x * F[2]! + z * F[8]!, l = Math.sqrt(px * px + py * py + pz * pz);
    HQ[0] = px / l; HQ[1] = py / l; HQ[2] = pz / l;
    o.hq();
    const r = R + HQ[3]! + 0.05;
    OQ[0] = HQ[0]! * r; OQ[1] = HQ[1]! * r; OQ[2] = HQ[2]! * r;
    const ok = opq();
    tmp[0] = PQ[3]!; tmp[1] = PQ[4]!;
    return ok;
  }
  function paintBeam(ctx: CanvasRenderingContext2D) {
    if (!run.S[DK] || v.crashed) return;
    if (!beamAt(1.0, -0.35)) return;
    ctx.beginPath();
    ctx.moveTo(tmp[0]!, tmp[1]!);
    if (!beamAt(6.6, -2.4)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    if (!beamAt(7.2, 0)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    if (!beamAt(6.6, 2.4)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    if (!beamAt(1.0, 0.35)) return;
    ctx.lineTo(tmp[0]!, tmp[1]!);
    ctx.closePath();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.lamp;
    ctx.globalAlpha = P.night ? 0.13 : 0.07;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function paintBolt(ctx: CanvasRenderingContext2D, i: number, p: DioramaPoints) {
    const x = p.sx[i]!, y = p.sy[i]!, r = Math.max(1.6, p.sr[i]!);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = P.bolt;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.8, r * 1.5, r * 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  const LBL = ["!", "★", "⇧", "★"];
  function drawOverlay(ctx: CanvasRenderingContext2D) {
    if (fx.live) {
      OQ[0] = FXA[0]!; OQ[1] = FXA[1]!; OQ[2] = FXA[2]!;
      const ok = opq(), dx = ok ? PQ[3]! - FXA[3]! : 0, dy = ok ? PQ[4]! - FXA[4]! : 0;
      ctx.save();
      ctx.translate(dx, dy);
      fx.draw(ctx, !P.night);
      ctx.restore();
    }
    if (wo.attract || run.S[PH] === DOWN) return;
    // The goal: a sticker over it, or an arrow at the edge of the picture toward it.
    const gk = run.goal(), ux = run.GOAL[0]!, uy = run.GOAL[1]!, uz = run.GOAL[2]!, label = LBL[gk]!;
    HQ[0] = ux; HQ[1] = uy; HQ[2] = uz;
    o.hq();
    const g0 = R + HQ[3]!, h = g0 + (gk === 0 ? 2.4 : 4.4), W = dio.width, H = dio.height;
    OQ[0] = ux * g0; OQ[1] = uy * g0; OQ[2] = uz * g0;
    let seen = opq() && OQ[6]! > -2.5 && PQ[3]! > 16 && PQ[3]! < W - 16 && PQ[4]! < H - 16;
    if (seen) {
      OQ[0] = ux * h; OQ[1] = uy * h; OQ[2] = uz * h;
      seen = opq();
      tmp[0] = PQ[3]!; tmp[1] = Math.max(PQ[4]!, tall ? 116 : 100);
    }
    ctx.font = "900 13px ui-rounded, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const colr = gk === 2 ? P.open : P.bNext;
    if (seen) {
      const x = tmp[0]!, y = tmp[1]!, w = 26, hh = 22;
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.roundRect(x - w / 2 + 3, y - hh + 3, w, hh, 6);
      ctx.fill();
      ctx.fillStyle = colr;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - hh, w, hh, 6);
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x + 5, y);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = gk === 2 ? P.ink : "#ffffff";
      ctx.fillText(label, x, y - hh / 2 + 0.5);
      return;
    }
    const Q = view.Q, bx = ux - view.up[0]!, by = uy - view.up[1]!, bz = uz - view.up[2]!;
    const rx = Q[0]! * bx + Q[1]! * by + Q[2]! * bz, rz = Q[6]! * bx + Q[7]! * by + Q[8]! * bz, a = Math.atan2(rx, -rz);
    PQ[0] = padO.pos[0]!; PQ[1] = padO.pos[1]! + 0.6; PQ[2] = padO.pos[2]!;
    pq();
    const cx = PQ[3]!, cy = PQ[4]!, rad = Math.max(70, Math.min(W, H) * 0.2), px = cx + Math.sin(a) * rad, py = cy - Math.cos(a) * rad * 0.8;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.moveTo(3, -13 + 3); ctx.lineTo(13 + 3, 8 + 3); ctx.lineTo(3, 3 + 3); ctx.lineTo(-10 + 3, 8 + 3); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colr;
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -13); ctx.lineTo(13, 8); ctx.lineTo(0, 3); ctx.lineTo(-13, 8); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = P.night ? "#ffffff" : P.ink;
    ctx.fillText(label, px, py + 20);
  }
  /** The speech bubble follows its friend on the screen. */
  function placeSay() {
    if (sayEl.hidden || sayAt < 0) return;
    const i = sayAt * 3, ux = run.friend[i]!, uy = run.friend[i + 1]!, uz = run.friend[i + 2]!;
    HQ[0] = ux; HQ[1] = uy; HQ[2] = uz;
    o.hq();
    const h = R + HQ[3]! + 1.9;
    OQ[0] = ux * h; OQ[1] = uy * h; OQ[2] = uz * h;
    const ok = opq() && OQ[6]! > -1;
    if (!ok) return void (sayEl.style.opacity = "0");
    sayEl.style.opacity = "1";
    const W = dio.width, bw = sayEl.offsetWidth || 200;
    sayEl.style.transform = `translate(${Math.round(Math.max(8, Math.min(W - bw - 8, PQ[3]! - bw / 2)))}px,${Math.round(Math.max(64, PQ[4]!) - (sayEl.offsetHeight || 60))}px)`;
  }

  // ---- the loop ----
  engine.add({
    read() {
      if (V[1]) {
        V[1] = 0;
        const next = palette(pl, wo.next, wo.theme() === "light");
        if (next.night !== P.night) (P = next), buildScene(), (dirty = true);
      }
      if (V[0]) {
        V[0] = 0;
        const cr = canvas.getBoundingClientRect();
        const w = cr.width || 1, h = cr.height || 1;
        dio.resize(w, h, Math.min(2, devicePixelRatio || 1) * (V[2] || 1));
        sky = null;
        if (V[6] !== w || tall !== h / w > 0.9) frame();
        hudDirty = dirty = true;
      }
      if (V[4] && !readPad()) GP.fill(0);
    },
    step(e, dt) {
      if (auto) run.autopilot(I);
      else {
        const sx = c.stick.active ? c.stick.x : 0, sy = c.stick.active ? c.stick.y : 0;
        I[IN_GAS] = c.down(GAS) || sy < -0.25 || GP[1]! < -0.3 ? 1 : Math.max(GP[2]!, 0);
        I[IN_BRAKE] = c.down(BRAKE) || sy > 0.35 || GP[1]! > 0.4 ? 1 : GP[3]!;
        I[IN_STEER] = (+c.down(RIGHT) - +c.down(LEFT)) || sx || GP[0]!;
        I[IN_FIRE] = c.down(FIRE) || GP[4]! > 0.5 ? 1 : 0;
        I[IN_BOOST] = c.down(BOOSTK) || GP[5]! > 0.5 ? 1 : 0;
        I[IN_JUMP] = c.hit(JUMP) ? 1 : 0;
        I[IN_ACT] = c.hit(ACT) || c.down(ACT) || GP[6]! > 0.5 ? 1 : 0;
      }
      if (!card.hidden) I.fill(0);
      const ph0 = run.S[PH]!;
      let moving = run.step(dt, I);
      if (run.n) events(), (moving = true);
      const gap = view.follow(run.U, run.Fw, Math.min(1, 2.4 * dt), 1);
      if (gap > 1e-6) moving = true;
      if (stepFx(dt)) moving = true;
      if (toastT > 0) (toastT = Math.max(0, toastT - dt)), (moving = true), toastT === 0 && (toastEl.hidden = true);
      if (sayT > 0) (sayT = Math.max(0, sayT - dt)), (moving = true), sayT === 0 && ((sayEl.hidden = true), (sayAt = -1));
      if (ph0 === RUN || run.S[PH] === RUN) moving = true;
      if (moving) (pulse += dt), (spin += dt * 1.6), e.busy(), (dirty = true), (hudDirty = true);
    },
    render() {
      if (hudDirty) (hudDirty = false), hudWrite();
      if (!dirty) return;
      dirty = false;
      pose();
      const cam = dio.cam, k = fx.shake * 0.6, sx = Math.sin(engine.time * 71) * k, sy = Math.cos(engine.time * 53) * k * 0.7;
      (cam.ox += sx), (cam.oy += sy);
      camBasis();
      dio.draw();
      placeSay();
      (cam.ox -= sx), (cam.oy -= sy), (V[5] = 1);
    },
  });
  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!pads) return false;
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p || !p.connected) continue;
      const ax = p.axes, b = p.buttons, bv = (k: number) => (b[k] ? b[k]!.value || (b[k]!.pressed ? 1 : 0) : 0);
      const dz = (a: number) => (a > 0.15 ? (a - 0.15) / 0.85 : a < -0.15 ? (a + 0.15) / 0.85 : 0);
      GP[0] = dz(ax[0] ?? 0); GP[1] = dz(ax[1] ?? 0); GP[2] = bv(7); GP[3] = bv(6); GP[4] = bv(0); GP[5] = Math.max(bv(2), bv(5)); GP[6] = bv(3);
      if (bv(1) > 0.5 && !was[9]) c.press("jump"), (was[9] = 1);
      else if (bv(1) <= 0.5 && was[9] === 1) c.press("jump", false), (was[9] = 0);
      if (GP[0] || GP[1] || GP[2] || GP[3] || GP[4] || GP[5] || GP[6]) (auto = false), engine.wake();
      return true;
    }
    return false;
  }

  // ---- input ----
  const MAP: Record<string, string> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake", Space: "fire", KeyF: "fire", ShiftLeft: "boost", ShiftRight: "boost", KeyJ: "jump", KeyE: "act", Enter: "act" };
  stage.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || wo.attract) return;
    if (e.code === "KeyM") return void (e.preventDefault(), toggle());
    if (e.code === "Escape") return void (e.preventDefault(), wo.on("menu", 0));
    const k = MAP[e.code];
    if (!k || (e.target as Element).closest?.(".bui-pad") || (e.target as Element).closest?.(".mr-card") || (e.target as Element).closest?.(".mr-keys")) return;
    e.preventDefault();
    if (!card.hidden) return;
    auto = false;
    if (!e.repeat) c.press(k);
    engine.wake();
  }, sig);
  stage.addEventListener("keyup", (e) => {
    const k = MAP[e.code];
    if (k) c.press(k, false);
  }, sig);
  play.addEventListener("pointerdown", (e) => (e.preventDefault(), play.focus({ preventScroll: true })), sig);
  muteK.addEventListener("click", toggle, sig);
  menuK.addEventListener("click", () => wo.on("menu", 0), sig);
  again.addEventListener("click", respawn, sig);
  thePad.el.addEventListener("pointerdown", () => ((auto = false), engine.wake()), sig);

  /** Put the rover `back` units short of orb point u, facing it (still, on the ground). Tests. */
  function near(u: ArrayLike<number>, back: number) {
    const ux = u[0]!, uy = u[1]!, uz = u[2]!, F = run.chart.F;
    let dx = F[3]! - ux, dy = F[4]! - uy, dz = F[5]! - uz;
    const dd = dx * ux + dy * uy + dz * uz;
    dx -= dd * ux; dy -= dd * uy; dz -= dd * uz;
    const dl = Math.hypot(dx, dy, dz) || 1, a = back / R;
    const px = ux + (dx / dl) * a, py = uy + (dy / dl) * a, pz = uz + (dz / dl) * a, pl2 = Math.hypot(px, py, pz);
    tmp[0] = px / pl2; tmp[1] = py / pl2; tmp[2] = pz / pl2;
    run.chart.at(tmp, [ux - tmp[0]!, uy - tmp[1]!, uz - tmp[2]!]);
    v.reset(0, 0, 0);
    run.sync();
    view.follow(run.U, run.Fw, 1);
    dirty = true;
    engine.wake();
  }

  buildScene();
  view.follow(run.U, run.Fw, 1);
  engine.start();
  if (!wo.attract) requestAnimationFrame(() => play.isConnected && play.focus({ preventScroll: true }));
  return {
    engine,
    run,
    near,
    respawn,
    get auto() { return auto; },
    set auto(on: boolean) { auto = on; engine.wake(); },
    /** The theme changed: rebuild in the new colours. */
    retheme() { V[1] = 1; engine.wake(); },
    get state() {
      const S = run.S;
      let ships2 = 0;
      for (let s = 0; s < SHIPS; s++) ships2 += run.SH[s * 9] ? 1 : 0;
      return {
        planet: pl.id, phase: S[PH]!, mission: S[MP]!, progress: S[MK]!, clock: S[CLK]!, crystals: S[CRY]!, shields: S[SHD]!, maxShields: S[MAXS]!, dark: !!S[DK], kills: S[KILLS]!, met: S[MET]!, near: S[NEAR]!, carry: S[CARRY]!,
        ships: ships2, speed: v.speed, air: v.air, down: !card.hidden, talking: !sayEl.hidden, says: sayEl.hidden ? "" : sayText.textContent, tiles: V[3]!, drawn: V[5]!,
      };
    },
    destroy: () => engine.destroy(),
  };
}
void [READY, GONE, M_OFFER, M_BACK, KILLS];
