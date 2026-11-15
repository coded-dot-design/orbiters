// The rover and its pilot, built from a look (the garage's choices) into a diorama: the gallery
// daily's rover (deck, cab, solar wing, mast and dish, lights, a thruster, four wheels on springs)
// with three bodies, three wheel styles, paint, trim, a decal and the parts you fit (a tow claw on
// the back, an armour plate, a boost tank); in the cab, the pilot's helmet and visor. One builder for
// the drive scene and the garage preview.
import type { Diorama, DioramaObject } from "@fzlt/core/diorama";

export const BODIES = [
  { id: "scout", name: "Scout" },
  { id: "hauler", name: "Hauler" },
  { id: "dart", name: "Dart" },
] as const;
export const WHEELS = [
  { id: "balloon", name: "Balloon" },
  { id: "disc", name: "Disc" },
  { id: "knobby", name: "Knobby" },
] as const;
export const HELMETS = [
  { id: "dome", name: "Dome" },
  { id: "fin", name: "Fin" },
  { id: "box", name: "Box" },
] as const;
export const DECALS = [
  { id: "none", name: "None" },
  { id: "stripe", name: "Stripe" },
  { id: "check", name: "Checks" },
  { id: "bolt", name: "Bolt" },
] as const;
/** Flat colours (Cyberpunk × Tron): name, colour. */
export const PAINTS: [string, string][] = [
  ["Moon white", "#eef0ff"], ["Hot pink", "#ff4fa8"], ["Neon cyan", "#22e6ff"], ["Acid", "#b6ff3c"],
  ["Sunset", "#ff8a3d"], ["Violet", "#9a63ff"], ["Gold", "#ffd166"], ["Night", "#2a2a46"],
];
export interface Look {
  body: number; wheels: number; paint: number; trim: number; decal: number;
  suit: number; helmet: number; visor: number;
}
export const LOOK0: Look = { body: 0, wheels: 0, paint: 0, trim: 2, decal: 1, suit: 6, helmet: 0, visor: 2 };
export interface Fit { claw?: boolean; armour?: boolean; tank?: boolean; tyres?: boolean }
export interface Shade { chassis: string; tyre: string; hub: string; lamp: string; tail: string; flame: string; visor: string; panel: string; panel2: string; ink: string }

const col = (i: number) => PAINTS[((i % PAINTS.length) + PAINTS.length) % PAINTS.length]![1];

/** Build the rover under `on` (an object whose local y is up and +x forward). Returns its body (for
 *  the springs), the four wheel hubs and the thruster flame. */
export function buildRover(dio: Diorama, on: string, id: string, look: Look, fit: Fit, P: Shade, wheelX: ArrayLike<number>) {
  const body = dio.add({ id, shape: "group", size: [1.9, 0, 1.3], on, shadow: 0.42, pick: false, layer: 5 });
  const paint = col(look.paint), trim = col(look.trim), b = look.body;
  const rp = (size: number[], pos: number[], color: string, x: { shape?: "box" | "wedge" | "cyl"; emissive?: boolean; sides?: number; top?: number; rot?: number[] } = {}) =>
    dio.add({ shape: x.shape || "box", size, pos, rot: x.rot, on: id, color, emissive: x.emissive, sides: x.sides, top: x.top, pick: false });
  // Body: scout (the daily's), hauler (long flat bed, tall cab), dart (low, a long wedge nose).
  const len = b === 1 ? 1.5 : b === 2 ? 1.2 : 1.3, cabH = b === 1 ? 0.44 : b === 2 ? 0.28 : 0.36;
  rp([1.7, 0.16, 1.0], [0, -0.2, 0], P.chassis);
  rp([len, 0.26, 0.96], [-0.1 - (len - 1.3) / 2, -0.06, 0], paint);
  rp([b === 2 ? 0.8 : 0.5, 0.26, 0.96], [b === 2 ? 0.95 : 0.82, -0.06, 0], paint, { shape: "wedge", rot: [0, Math.PI, 0] });
  rp([0.62, cabH, 0.7], [b === 1 ? 0.3 : 0.18, 0.07 + cabH / 2, 0], paint);
  rp([0.12, cabH * 0.66, 0.62], [b === 1 ? 0.62 : 0.5, 0.1 + cabH * 0.4, 0], P.visor, { rot: [0, 0, -0.35] });
  rp([len + 0.02, 0.05, 0.98], [-0.1 - (len - 1.3) / 2, 0.2, 0], trim);
  // Decal: a stripe down the deck, checks on the flank, or a bolt.
  if (look.decal === 1) rp([len * 0.9, 0.03, 0.22], [-0.1, 0.235, 0], paint === "#eef0ff" ? "#ff4fa8" : "#eef0ff");
  else if (look.decal === 2) for (let k = 0; k < 4; k++) rp([0.16, 0.1, 0.02], [-0.5 + k * 0.3, -0.02 + (k % 2) * 0.1, 0.49], k % 2 ? trim : P.ink), rp([0.16, 0.1, 0.02], [-0.5 + k * 0.3, -0.02 + (k % 2) * 0.1, -0.49], k % 2 ? trim : P.ink);
  else if (look.decal === 3) for (const z of [0.49, -0.49]) rp([0.5, 0.06, 0.02], [-0.25, -0.04, z], "#ffd166", { rot: [0, 0, 0.5], emissive: true });
  // Solar wing, mast and dish.
  rp([0.46, 0.035, 1.24], [-0.56, 0.5, 0], P.panel, { rot: [0, 0, 0.42] });
  for (const zz of [-0.31, 0, 0.31]) rp([0.44, 0.04, 0.02], [-0.56, 0.51, zz], P.panel2, { rot: [0, 0, 0.42] });
  rp([0.06, 0.3, 0.06], [-0.56, 0.22, 0], P.hub);
  rp([0.05, 0.62, 0.05], [0.0, 0.5, -0.32], P.hub, { shape: "cyl", sides: 5 });
  rp([0.22, 0.07, 0.22], [0.0, 1.1, -0.32], paint, { shape: "cyl", sides: 8, top: 1.5, rot: [0, 0, 0.6] });
  rp([0.06, 0.06, 0.06], [0.04, 1.16, -0.32], P.tail, { emissive: true });
  for (const zz of [-0.3, 0.3]) rp([0.04, 0.08, 0.16], [1.04, -0.02, zz], P.lamp, { emissive: true });
  for (const zz of [-0.32, 0.32]) rp([0.04, 0.08, 0.14], [-0.76, -0.02, zz], P.tail, { emissive: true });
  rp([0.22, 0.22, 0.34], [-0.82, -0.08, 0], P.chassis, { shape: "cyl", sides: 8, rot: [0, 0, Math.PI / 2] });
  const flame = rp([0.5, 0.3, 0.3], [-0.94, -0.08, 0], P.flame, { shape: "cyl", sides: 6, top: 0, rot: [0, 0, Math.PI / 2], emissive: true });
  // The pilot: a helmet through the cab roof, the visor ahead.
  const cx = b === 1 ? 0.3 : 0.18, cyT = 0.07 + cabH;
  const suit = col(look.suit), vis = col(look.visor);
  rp([0.36, 0.1, 0.4], [cx - 0.04, cyT + 0.04, 0], suit);
  if (look.helmet === 2) rp([0.32, 0.28, 0.32], [cx - 0.02, cyT + 0.22, 0], suit);
  else rp([0.34, 0.3, 0.34], [cx - 0.02, cyT + 0.08, 0], suit, { shape: "cyl", sides: 10, top: 0.55 });
  if (look.helmet === 1) rp([0.3, 0.14, 0.05], [cx - 0.1, cyT + 0.42, 0], trim, { shape: "wedge", rot: [0, Math.PI, 0] });
  rp([0.08, 0.13, 0.26], [cx + 0.13, cyT + 0.22, 0], vis, { emissive: true });
  // Parts you fit: armour plates on the flanks, a boost tank on the deck, a claw on the back.
  if (fit.armour) for (const z of [0.52, -0.52]) rp([1.1, 0.2, 0.05], [-0.05, -0.08, z], P.hub);
  if (fit.tank) rp([0.18, 0.18, 0.5], [-0.3, 0.32, 0.25], "#39ffb0", { shape: "cyl", sides: 8, rot: [Math.PI / 2, 0, 0], emissive: true });
  if (fit.claw) {
    rp([0.36, 0.06, 0.06], [-1.0, 0.06, 0], P.hub);
    for (const z of [-0.1, 0.1]) rp([0.08, 0.2, 0.04], [-1.18, -0.02, z], trim, { rot: [0, 0, 0.4] });
  }
  const hubs: DioramaObject[] = [];
  const w = look.wheels, tr = w === 0 ? 0.7 : w === 2 ? 0.66 : 0.62, tw = w === 0 ? 0.3 : 0.24;
  for (let i = 0; i < 4; i++) {
    const hid = id + "h" + i, hub = dio.add({ id: hid, shape: "group", size: [0.6, 0, 0.6], on: id, layer: 6, behind: 1.5 }), side = wheelX[i * 2 + 1]! > 0 ? 1 : -1;
    dio.add({ shape: "cyl", sides: w === 2 ? 8 : 12, size: [tr, tw, tr], pos: [0, 0, -tw / 2], rot: [Math.PI / 2, 0, 0], on: hid, color: P.tyre, pick: false });
    dio.add({ shape: "cyl", sides: 8, size: [w === 1 ? 0.5 : 0.36, 0.04, w === 1 ? 0.5 : 0.36], pos: [0, 0, side > 0 ? tw / 2 : -tw / 2 - 0.04], rot: [Math.PI / 2, 0, 0], on: hid, color: w === 1 ? trim : P.hub, pick: false });
    dio.add({ size: [0.34, 0.06, 0.06], pos: [0, -0.03, side > 0 ? tw / 2 + 0.04 : -tw / 2 - 0.05], on: hid, color: trim, pick: false });
    hubs.push(hub);
  }
  return { body, hubs, flame };
}
