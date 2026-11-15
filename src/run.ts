// A visit to one world, headless (tests/run.test.mjs): the planet's orb (./orb.ts), the rover on
// @fzlt/core/drive through the orb's chart (the gallery daily's handling, tuned per world and by the
// rover's parts), and the session: crystals, crates, rocks and ramps all over; a village of friends
// (the mission giver, the trader) and an outpost whose friends hand out gifts as you drive up; the
// mission (collect, race, deliver, rescue, defend, the great beacon); hostiles that come for you on
// the night side (or round the beacon you defend) and burn up in the sun; lava on Cinder; a launch
// pad that opens once the mission is done. Seeded and fixed-step: the same inputs give the same
// visit, bit for bit. Zero allocation per step. Everything is in orb space (the world's own frame).
import { drive, type Drive } from "@fzlt/core/drive";
import { orb } from "./orb.ts";
import type { Planet } from "./planets.ts";

/** Phases. */
export const READY = 0, RUN = 1, DOWN = 2, GONE = 3;
/** Events: [type, value, x, y, z] (orb space). */
export const E_START = 1, E_CRYSTAL = 2, E_FRIEND = 5, E_SHOT = 6, E_KILL = 7, E_HIT = 8, E_CRATE = 9, E_DARK = 10, E_JUMP = 11, E_CRASH = 12, E_RIGHT = 13, E_DOWN = 14, E_BUMP = 16, E_SPAWN = 17, E_BURN = 18, E_LAND = 19,
  E_TALK = 20, E_MSTART = 21, E_MSTEP = 22, E_MDONE = 23, E_MFAIL = 24, E_PAD = 25, E_LOCKED = 26, E_LAVA = 27, E_STEAL = 28, E_NEED = 29, E_TRADE = 30, E_DROP = 31, E_RETURN = 32;
/** Gifts an outpost friend gives. */
export const G_BOOST = 0, G_CRYSTALS = 1, G_SHIELD = 2;
export const SHIPS = 4, BOLTS = 10, BASES = 2, FRIENDS = 4, MAXT = 8;
/** Friends: 0 the mission giver, 1 the trader (village); 2, 3 the outpost. */
export const GIVER = 0, TRADER = 1;
/** Mission phases: offered, running, bring it back, done. */
export const M_OFFER = 0, M_RUN = 1, M_BACK = 2, M_DONE = 3;
/** Inputs: gas, brake, steer (−1..1, + right), fire, boost, jump, act. */
export const IN_GAS = 0, IN_BRAKE = 1, IN_STEER = 2, IN_FIRE = 3, IN_BOOST = 4, IN_JUMP = 5, IN_ACT = 6;
// S: phase, mission clock, -, crystals, -, -, shields, boost, hurt, fire cd, jump cd, dark, spawn timer, crashed timer,
// kills, friends met, time run, mission phase, mission progress, friend near, carrying, heat, max shields, act held, pad cool, need cool.
export const PH = 0, CLK = 1, CRY = 3, SHD = 6, BOOST = 7, HURT = 8, FCD = 9, JCD = 10, DARK = 11, SPN = 12, DWN = 13, KILLS = 14, MET = 15, RUN_T = 16, MP = 17, MK = 18, NEAR = 19, CARRY = 20, HEAT = 21, MAXS = 22, ACTH = 23, PADC = 24, NEEDC = 25;

/** What the rover brings: its parts. */
export interface Kit { tyres?: boolean; tank?: boolean; armour?: boolean; claw?: boolean; /** This world's mission is already done (free roam). */ cleared?: boolean }

function lcg(seed: number) {
  const s = new Uint32Array([seed >>> 0 || 1]);
  return () => ((s[0] = Math.imul(s[0]!, 1664525) + 1013904223), s[0]! / 4294967296);
}
const norm = (v: number[]) => { const l = Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!); return [v[0]! / l, v[1]! / l, v[2]! / l]; };
const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];

export function roverRun(pl: Planet, kit: Kit = {}, seed = 20261123) {
  const R = pl.radius, CRYSTALS = pl.crystals, ROCKS = pl.rocks, CRATES = pl.crates, RAMPS = pl.ramps, M = pl.mission, kind = M.kind;
  const o = orb({ radius: R, seed: pl.seed, craters: pl.craters, hills: pl.hills, depth: pl.depth });
  const S = new Float64Array(28);
  const rnd = lcg(pl.seed * 977 + 13);
  const sun = norm([0.82, 0.42, -0.39]), T1 = norm(cross(sun, [0, 1, 0])), T2 = cross(T1, sun);
  /** The seam: a closed curve round the world through both sides (θ in 0..2π). */
  const seam = (th: number) => norm([Math.cos(th) * sun[0]! + Math.sin(th) * T1[0]! + 0.62 * Math.sin(2 * th) * T2[0]!, Math.cos(th) * sun[1]! + Math.sin(th) * T1[1]! + 0.62 * Math.sin(2 * th) * T2[1]!, Math.cos(th) * sun[2]! + Math.sin(th) * T1[2]! + 0.62 * Math.sin(2 * th) * T2[2]!]);
  const TH0 = -0.62;
  const placed: number[][] = [];
  const free = (u: number[], r: number) => placed.every((p) => { const d = Math.sqrt(Math.max(0, 2 - 2 * (u[0]! * p[0]! + u[1]! * p[1]! + u[2]! * p[2]!))) * R; return d > r + p[3]!; });
  const randDir = () => { for (;;) { const v = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1], d = v[0]! * v[0]! + v[1]! * v[1]! + v[2]! * v[2]!; if (d > 0.01 && d < 1) return norm(v); } };
  const day = (u: number[]) => u[0]! * sun[0]! + u[1]! * sun[1]! + u[2]! * sun[2]!;
  const lava = pl.lava ?? -99;
  const dry = (u: number[]) => o.terrain(u[0]!, u[1]!, u[2]!) > lava + 0.25;
  const spot = (r: number, near: number, test?: (u: number[]) => boolean) => {
    for (let k = 0; k < 600; k++) {
      let u: number[];
      if (rnd() < near) {
        const th = rnd() * Math.PI * 2, c = seam(th), c2 = seam(th + 0.01), f = norm([c2[0]! - c[0]!, c2[1]! - c[1]!, c2[2]! - c[2]!]), side = cross(f, c), a = (rnd() * 2 - 1) * 0.22;
        u = norm([c[0]! + side[0]! * a, c[1]! + side[1]! * a, c[2]! + side[2]! * a]);
      } else u = randDir();
      if (test && !test(u)) continue;
      if (free(u, r)) return placed.push([...u, r]), u;
    }
    const u = randDir();
    return placed.push([...u, r]), u;
  };
  /** Angular distance between unit vectors, in units on the surface. */
  const apart = (a: number[], b: ArrayLike<number>) => Math.acos(Math.max(-1, Math.min(1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!))) * R;
  // Start: on the seam in the sun, facing along it. The village (base 0) just ahead, the pad beside it.
  const start = seam(TH0 + 0.02), startF = (() => { const a = seam(TH0 + 0.25); return norm([a[0]! - start[0]!, a[1]! - start[1]!, a[2]! - start[2]!]); })();
  const side0 = cross(startF, start);
  const at = (fw: number, sd: number) => norm([start[0]! + startF[0]! * fw / R + side0[0]! * sd / R, start[1]! + startF[1]! * fw / R + side0[1]! * sd / R, start[2]! + startF[2]! * fw / R + side0[2]! * sd / R]);
  placed.push([...start, 2.5]);
  const base = new Float64Array(BASES * 3), friend = new Float64Array(FRIENDS * 3), pad = new Float64Array(3), beacon = new Float64Array(3);
  const village = at(14, 6);
  base.set(village, 0);
  placed.push([...village, 3.6]);
  const padU = at(6, -8);
  pad.set(padU);
  placed.push([...padU, 3.4]);
  const bcn = at(20, -2);
  beacon.set(bcn);
  placed.push([...bcn, 2.2]);
  // The outpost: far round the world, in the sun.
  const outpost = spot(3.6, 0.9, (v) => day(v) > 0.2 && apart(v, village) > R * 1.4 && dry(v));
  base.set(outpost, 3);
  for (let b = 0; b < BASES; b++) {
    const u = [base[b * 3]!, base[b * 3 + 1]!, base[b * 3 + 2]!];
    for (let k = 0; k < 2; k++) {
      const sd = norm(cross(u, [0.3, 1, 0.1])), a = (k ? 1 : -1) * 0.1;
      friend.set(norm([u[0]! + sd[0]! * a, u[1]! + sd[1]! * a, u[2]! + sd[2]! * a]), (b * 2 + k) * 3);
    }
  }
  // Mission targets.
  const NT = kind === "beacon" ? M.count + 1 : M.count, target = new Float64Array(MAXT * 3);
  if (kind === "race") for (let k = 0; k < NT; k++) { const u = seam(TH0 + 0.45 + (k / NT) * Math.PI * 1.7); placed.push([...u, 4]); target.set(u, k * 3); }
  else if (kind === "deliver") { target.set(spot(3, 0.6, (v) => apart(v, village) > R * 0.7 && apart(v, village) < R * 1.4 && dry(v)), 0); const u = at(0, 0); void u; const op = norm([outpost[0]! + T2[0]! * 0.12, outpost[1]! + T2[1]! * 0.12, outpost[2]! + T2[2]! * 0.12]); target.set(op, 3); }
  else if (kind === "defend") target.set(spot(8, 0.7, (v) => apart(v, village) > R * 1 && dry(v)), 0);
  else {
    for (let k = 0; k < M.count; k++) target.set(spot(2.4, 0.5, (v) => apart(v, village) > 18 && dry(v)), k * 3);
    if (kind === "beacon") target.set(spot(5, 0.8, (v) => apart(v, village) > R * 1.5 && dry(v)), M.count * 3);
  }
  const ramp = new Float64Array(RAMPS * 6);
  for (let k = 0; k < RAMPS; k++) {
    const th = TH0 + ((k + 0.55) / RAMPS) * Math.PI * 2 + (rnd() - 0.5) * 0.12, c = seam(th), c2 = seam(th + 0.01), f = norm([c2[0]! - c[0]!, c2[1]! - c[1]!, c2[2]! - c[2]!]);
    const sd = cross(f, c), a = (rnd() - 0.5) * 0.06, u = norm([c[0]! + sd[0]! * a, c[1]! + sd[1]! * a, c[2]! + sd[2]! * a]);
    if (!free(u, 2.4)) continue;
    placed.push([...u, 2.4]);
    ramp.set([...u, ...f], k * 6);
    o.ramp(u, f, 3.6, 2.4, 0.95);
  }
  const crystal = new Float64Array(CRYSTALS * 3), rock = new Float64Array(ROCKS * 4), crate = new Float64Array(CRATES * 3);
  for (let i = 0; i < CRYSTALS; i++) crystal.set(spot(1.2, 0.72), i * 3);
  for (let i = 0; i < CRATES; i++) crate.set(spot(1.3, 0.8), i * 3);
  for (let i = 0; i < ROCKS; i++) { const r = (pl.spires ? 0.55 : 0.45) + rnd() * rnd() * 1.3; rock.set([...spot(r + 1.6, 0.3), r], i * 4); }

  // ---- live state ----
  const got = new Uint8Array(CRYSTALS), smashed = new Uint8Array(CRATES), tgot = new Uint8Array(MAXT);
  const fCool = new Float64Array(FRIENDS), fReact = new Float64Array(FRIENDS), fGift = new Uint8Array(FRIENDS);
  const SH = new Float64Array(SHIPS * 9), BO = new Float64Array(BOLTS * 7);
  const ev = new Float64Array(64 * 5);
  let n = 0;
  const G = o.chart();
  const car: Drive = drive(G, {
    wheels: [0.72, -0.56, 0.72, 0.56, -0.72, -0.56, -0.72, 0.56], radius: 0.32, rest: 0.34, travel: 0.4, stiffness: 60, progressive: 1, damping: 0.5, rebound: 0.8, inertia: 1.4,
    gravity: pl.gravity, accel: 9, top: pl.top, grip: Math.min(1.05, pl.grip + (kit.tyres ? 0.2 : 0)), steer: 0.55, steerFall: 14, cg: 0.32, crashPitch: 1.25, crashRoll: 1.2, crashDrop: 40, airPitch: 1.6,
  });
  const MAXSH = 3 + (kit.armour ? 1 : 0), DRAIN = kit.tank ? 0.26 : 0.42, FOE = pl.foeSpeed;
  const P = new Float64Array(3), U = new Float64Array(3), Fw = new Float64Array(3), X3 = new Float64Array(4), GOAL = new Float64Array(3);
  const rng = new Uint32Array(1);
  const rand = () => ((rng[0] = Math.imul(rng[0]!, 1664525) + 1013904223), rng[0]! / 4294967296);

  function emitA(type: number, val: number, A: Float64Array, i: number, scale: number) {
    if (n >= 64) return;
    const k = n++ * 5;
    ev[k] = type; ev[k + 1] = val; ev[k + 2] = A[i]! * scale; ev[k + 3] = A[i + 1]! * scale; ev[k + 4] = A[i + 2]! * scale;
  }
  function home() {
    G.at(start, startF);
    car.reset(0, 0, 0);
    where();
  }
  function reset() {
    S.fill(0);
    S[SHD] = S[MAXS] = MAXSH; S[BOOST] = 1; S[SPN] = 1; S[NEAR] = -1;
    if (kit.cleared) S[MP] = M_DONE;
    got.fill(0); smashed.fill(0); tgot.fill(0); fCool.fill(0); fReact.fill(0); SH.fill(0); BO.fill(0);
    for (let i = 0; i < FRIENDS; i++) fGift[i] = i % 3;
    rng[0] = seed;
    n = 0;
    home();
  }
  /** After the rover went down: back at the village, shields full; a running race or defence starts over, cargo is lost. */
  function respawn() {
    S[SHD] = MAXSH; S[HURT] = 1.6; S[PH] = RUN; S[HEAT] = 0; S[CARRY] = 0;
    for (let s = 0; s < SHIPS; s++) SH[s * 9] = 0;
    if (S[MP] === M_RUN && kind === "race") (S[MP] = M_OFFER), (S[MK] = 0);
    if (S[MP] === M_RUN && kind === "defend") S[CLK] = M.time!;
    home();
    emitA(E_RIGHT, 1, P, 0, 1);
  }
  function where() {
    const F = G.F, cy = car._s[20]!, sy = car._s[21]!, x = car.pos[0]!, y = R + car.pos[1]!, z = car.pos[2]!;
    P[0] = y * F[3]! + x * F[0]! + z * F[6]!; P[1] = y * F[4]! + x * F[1]! + z * F[7]!; P[2] = y * F[5]! + x * F[2]! + z * F[8]!;
    U[0] = F[3]!; U[1] = F[4]!; U[2] = F[5]!;
    Fw[0] = cy * F[0]! - sy * F[6]!; Fw[1] = cy * F[1]! - sy * F[7]!; Fw[2] = cy * F[2]! - sy * F[8]!;
  }
  const HQ = o.HQ;
  /** The rover's distance² to the surface point over unit dir A[i..i+2]. */
  function d2(A: Float64Array, i: number) {
    const x = A[i]!, y = A[i + 1]!, z = A[i + 2]!;
    HQ[0] = x; HQ[1] = y; HQ[2] = z;
    o.hq();
    const r = R + HQ[3]!, dx = x * r - P[0]!, dy = y * r - P[1]!, dz = z * r - P[2]!;
    return dx * dx + dy * dy + dz * dz;
  }
  const near = (A: Float64Array, i: number, lim: number) => d2(A, i) < lim * lim;
  function push(A: Float64Array, i: number, kind2: number) {
    const x = A[i]!, y = A[i + 1]!, z = A[i + 2]!, r = kind2 === 0 ? A[i + 3]! * 0.85 : kind2 === 1 ? 1.6 : 0.3;
    const F = G.F, gx = x * R - R * F[3]!, gy = y * R - R * F[4]!, gz = z * R - R * F[5]!;
    const cx = gx * F[0]! + gy * F[1]! + gz * F[2]! - car.pos[0]!, cz = gx * F[6]! + gy * F[7]! + gz * F[8]! - car.pos[2]!, d = Math.sqrt(cx * cx + cz * cz), m = r + 0.85;
    if (d >= m || d < 1e-6) return false;
    const nx = cx / d, nz = cz / d, v = car.vel, vn = v[0]! * nx + v[2]! * nz;
    car.pos[0] = car.pos[0]! - nx * (m - d);
    car.pos[2] = car.pos[2]! - nz * (m - d);
    if (vn > 0) (v[0] = v[0]! - nx * vn * 1.4), (v[2] = v[2]! - nz * vn * 1.4);
    return vn > 3;
  }
  function arc(A: Float64Array, i: number) {
    const a = X3[3]!;
    let ux = A[i]! + A[i + 3]! * a, uy = A[i + 1]! + A[i + 4]! * a, uz = A[i + 2]! + A[i + 5]! * a;
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz);
    ux /= ul; uy /= ul; uz /= ul;
    let tx = A[i + 3]! - A[i]! * a, ty = A[i + 4]! - A[i + 1]! * a, tz = A[i + 5]! - A[i + 2]! * a;
    const d = tx * ux + ty * uy + tz * uz;
    tx -= d * ux; ty -= d * uy; tz -= d * uz;
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    A[i] = ux; A[i + 1] = uy; A[i + 2] = uz; A[i + 3] = tx / tl; A[i + 4] = ty / tl; A[i + 5] = tz / tl;
  }
  function done() {
    S[MP] = M_DONE; S[CARRY] = 0;
    emitA(E_MDONE, 0, beacon, 0, R);
  }
  /** Talk to friend i (ACT near them): take or hand in the mission, trade crystals, or a line. */
  function talk(i: number) {
    S[MET] = S[MET]! + 1;
    fReact[i] = 2.4;
    if (i === GIVER) {
      const mp = S[MP]!;
      if (mp === M_OFFER) {
        S[MP] = M_RUN; S[MK] = 0; S[CARRY] = 0; tgot.fill(0);
        if (M.time) S[CLK] = M.time;
        emitA(E_MSTART, 0, friend, 0, R);
        return;
      }
      if (mp === M_BACK && kind !== "beacon") return void done();
      emitA(E_TALK, i, friend, i * 3, R);
      return;
    }
    if (i === TRADER && S[CRY]! > 0) {
      const c = S[CRY]!;
      S[CRY] = 0;
      emitA(E_TRADE, c, friend, i * 3, R);
      return;
    }
    emitA(E_TALK, i, friend, i * 3, R);
  }
  function mission(dt: number) {
    const mp = S[MP]!;
    if (mp !== M_RUN && !(mp === M_BACK && kind === "beacon")) return;
    if (kind === "race") {
      S[CLK] = Math.max(0, S[CLK]! - dt);
      const k = S[MK]!;
      if (near(target, k * 3, 4.4)) {
        tgot[k] = 1; S[MK] = k + 1;
        emitA(E_MSTEP, k + 1, target, k * 3, R);
        if (k + 1 >= NT) return void done();
      }
      if (S[CLK] === 0) (S[MP] = M_OFFER), (S[MK] = 0), tgot.fill(0), emitA(E_MFAIL, 0, P, 0, 1);
    } else if (kind === "deliver") {
      if (!S[CARRY] && near(target, 0, 3.4)) (S[CARRY] = 1), emitA(E_MSTEP, 1, target, 0, R);
      else if (S[CARRY] && near(target, 3, 4.4)) (S[MK] = 2), done();
    } else if (kind === "defend") {
      if (near(target, 0, 8)) {
        S[CLK] = Math.max(0, S[CLK]! - dt);
        if (!S[MK]) emitA(E_MSTEP, 1, target, 0, R);
        S[MK] = 1;
        if (S[CLK] === 0) done();
      } else S[MK] = 0;
    } else if (mp === M_BACK) {
      if (near(target, M.count * 3, 4.6)) done();
    } else {
      for (let k = 0; k < M.count; k++) {
        if (tgot[k] || !near(target, k * 3, 2.4)) continue;
        if (kind === "rescue" && !kit.claw) {
          if (S[NEEDC] === 0) (S[NEEDC] = 3), emitA(E_NEED, k, target, k * 3, R);
          continue;
        }
        tgot[k] = 1; S[MK] = S[MK]! + 1;
        emitA(E_MSTEP, S[MK]!, target, k * 3, R);
        if (S[MK]! >= M.count) (S[MP] = M_BACK), emitA(E_RETURN, 0, P, 0, 1);
      }
    }
  }

  function step(dt: number, I: ArrayLike<number>) {
    const ph = S[PH]!;
    if (ph === GONE || ph === DOWN) return false;
    const any = I[IN_GAS]! > 0 || I[IN_BRAKE]! > 0 || I[IN_STEER] !== 0 || I[IN_FIRE]! > 0 || I[IN_BOOST]! > 0 || I[IN_JUMP]! > 0 || I[IN_ACT]! > 0;
    if (ph === READY) {
      if (!any) return false;
      S[PH] = RUN;
      emitA(E_START, 0, P, 0, 1);
    }
    S[RUN_T] = S[RUN_T]! + dt;
    const crashed = car.crashed;
    if (crashed) {
      S[DWN] = S[DWN]! + dt;
      if (S[DWN]! > 1.1) {
        S[DWN] = 0;
        car.reset(0, 0, car.yaw);
        S[HURT] = Math.max(S[HURT]!, 1);
        emitA(E_RIGHT, 0, P, 0, 1);
      }
    }
    car.set(I[IN_GAS]!, I[IN_BRAKE]!, I[IN_STEER]!, 0);
    const air0 = car.air;
    car.step(dt);
    if (!crashed && car.crashed) emitA(E_CRASH, 0, P, 0, 1);
    if (air0 > 0.25 && car.air === 0 && !car.crashed) emitA(E_LAND, Math.round(air0 * 100), P, 0, 1);
    const cy = car._s[20]!, sy = car._s[21]!, onGround = car.air === 0 && !car.crashed;
    if (I[IN_BOOST]! > 0 && S[BOOST]! > 0.02 && onGround) {
      S[BOOST] = Math.max(0, S[BOOST]! - dt * DRAIN);
      if (car.speed < pl.top + 6) (car.vel[0] = car.vel[0]! + cy * 16 * dt), (car.vel[2] = car.vel[2]! - sy * 16 * dt);
    } else S[BOOST] = Math.min(1, S[BOOST]! + dt * 0.11);
    S[JCD] = Math.max(0, S[JCD]! - dt);
    if (I[IN_JUMP]! > 0 && onGround && S[JCD] === 0) (car.vel[1] = car.vel[1]! + 7.2), (S[JCD] = 0.7), emitA(E_JUMP, 0, P, 0, 1);
    where();
    for (let i = 0; i < ROCKS; i++) if (near(rock, i * 4, 5) && push(rock, i * 4, 0)) emitA(E_BUMP, i, P, 0, 1);
    for (let b = 0; b < BASES; b++) if (near(base, b * 3, 5)) push(base, b * 3, 1);
    if (near(beacon, 0, 2)) push(beacon, 0, 2);
    G.recentre(car);
    where();
    for (let i = 0; i < CRATES; i++) {
      if (smashed[i] || !near(crate, i * 3, 1.45)) continue;
      smashed[i] = 1;
      car.vel[0] = car.vel[0]! * 0.75; car.vel[2] = car.vel[2]! * 0.75;
      S[CRY] = S[CRY]! + 2;
      emitA(E_CRATE, i, crate, i * 3, R);
    }
    for (let i = 0; i < CRYSTALS; i++) {
      if (got[i] || !near(crystal, i * 3, 1.7)) continue;
      got[i] = 1;
      S[CRY] = S[CRY]! + 1;
      emitA(E_CRYSTAL, i, crystal, i * 3, R);
    }
    // ---- friends: who is near; ACT talks; the outpost hands out gifts as you drive up ----
    let nf = -1, nd = 4.4 * 4.4;
    for (let i = 0; i < FRIENDS; i++) {
      fCool[i] = Math.max(0, fCool[i]! - dt);
      fReact[i] = Math.max(0, fReact[i]! - dt);
      const d = d2(friend, i * 3);
      if (d < nd) (nd = d), (nf = i);
      if (i < 2 || fCool[i]! > 0 || d > 3.4 * 3.4) continue;
      const g = fGift[i]!;
      fCool[i] = 22; fReact[i] = 2.4; fGift[i] = (g + 1) % 3;
      S[MET] = S[MET]! + 1;
      if (g === G_BOOST) (S[BOOST] = 1), (car.vel[0] = car.vel[0]! + cy * 5), (car.vel[2] = car.vel[2]! - sy * 5);
      else if (g === G_CRYSTALS) S[CRY] = S[CRY]! + 3;
      else if (S[SHD]! < MAXSH) S[SHD] = S[SHD]! + 1;
      else S[CRY] = S[CRY]! + 2;
      emitA(E_FRIEND, i * 4 + g, friend, i * 3, R);
    }
    S[NEAR] = nf;
    const act = I[IN_ACT]! > 0;
    if (act && !S[ACTH] && nf >= 0) talk(nf);
    S[ACTH] = act ? 1 : 0;
    S[NEEDC] = Math.max(0, S[NEEDC]! - dt);
    mission(dt);
    // ---- the launch pad ----
    S[PADC] = Math.max(0, S[PADC]! - dt);
    if (near(pad, 0, 2.6) && onGround && car.speed < 8) {
      if (S[MP] === M_DONE) (S[PH] = GONE), emitA(E_PAD, 0, pad, 0, R);
      else if (S[PADC] === 0) emitA(E_LOCKED, 0, pad, 0, R);
      S[PADC] = 2.5;
    }
    // ---- lava (Cinder): the low ground burns ----
    if (onGround && lava > -90) {
      HQ[0] = U[0]!; HQ[1] = U[1]!; HQ[2] = U[2]!;
      o.hq();
      if (HQ[3]! < lava) {
        S[HEAT] = S[HEAT]! + dt;
        if (S[HEAT]! > 0.8 && S[HURT] === 0) {
          S[HEAT] = 0; S[HURT] = 1.6; S[SHD] = S[SHD]! - 1; car.vel[1] = car.vel[1]! + 6;
          if (S[CARRY]) (S[CARRY] = 0), emitA(E_DROP, 0, P, 0, 1);
          emitA(E_LAVA, S[SHD]!, P, 0, 1);
        }
      } else S[HEAT] = Math.max(0, S[HEAT]! - dt);
    }
    // ---- light and dark ----
    const pl2 = Math.sqrt(P[0]! * P[0]! + P[1]! * P[1]! + P[2]! * P[2]!), lightK = (P[0]! * sun[0]! + P[1]! * sun[1]! + P[2]! * sun[2]!) / pl2;
    const dark = S[DARK]! ? lightK < 0.04 : lightK < -0.04;
    if (dark !== !!S[DARK]) (S[DARK] = dark ? 1 : 0), emitA(E_DARK, dark ? 1 : 0, P, 0, 1);
    // ---- bolts ----
    S[FCD] = Math.max(0, S[FCD]! - dt);
    if (I[IN_FIRE]! > 0 && S[FCD] === 0 && !car.crashed) {
      S[FCD] = 0.2;
      for (let b = 0; b < BOLTS; b++) {
        const k = b * 7;
        if (BO[k]! > 0) continue;
        BO[k] = 0.75;
        const px = P[0]! + Fw[0]! * 1.1, py = P[1]! + Fw[1]! * 1.1, pz = P[2]! + Fw[2]! * 1.1, l = Math.sqrt(px * px + py * py + pz * pz);
        BO[k + 1] = px / l; BO[k + 2] = py / l; BO[k + 3] = pz / l; BO[k + 4] = Fw[0]!; BO[k + 5] = Fw[1]!; BO[k + 6] = Fw[2]!;
        (X3[0] = px), (X3[1] = py), (X3[2] = pz), emitA(E_SHOT, b, X3, 0, 1);
        break;
      }
    }
    const boltSp = 32 + Math.max(0, car.speed);
    for (let b = 0; b < BOLTS; b++) {
      const k = b * 7;
      if (BO[k]! <= 0) continue;
      BO[k] = BO[k]! - dt;
      X3[3] = (boltSp * dt) / R;
      arc(BO, k + 1);
      const bx = BO[k + 1]!, by = BO[k + 2]!, bz = BO[k + 3]!;
      HQ[0] = bx; HQ[1] = by; HQ[2] = bz; o.hq();
      const br = R + HQ[3]! + 0.75;
      for (let s = 0; s < SHIPS; s++) {
        const q = s * 9;
        if (!SH[q] || SH[q + 8]! > 0) continue;
        HQ[0] = SH[q + 1]!; HQ[1] = SH[q + 2]!; HQ[2] = SH[q + 3]!; o.hq();
        const sr = R + HQ[3]! + 1.5, dx = bx * br - SH[q + 1]! * sr, dy = by * br - SH[q + 2]! * sr, dz = bz * br - SH[q + 3]! * sr;
        if (dx * dx + dy * dy + dz * dz > 1.7 * 1.7) continue;
        SH[q] = 0; BO[k] = 0;
        S[KILLS] = S[KILLS]! + 1;
        (X3[0] = SH[q + 1]! * sr), (X3[1] = SH[q + 2]! * sr), (X3[2] = SH[q + 3]! * sr), emitA(E_KILL, s, X3, 0, 1);
        break;
      }
      if (BO[k]! <= 0) continue;
      for (let i = 0; i < CRATES; i++) {
        if (smashed[i]) continue;
        const dx = bx - crate[i * 3]!, dy = by - crate[i * 3 + 1]!, dz = bz - crate[i * 3 + 2]!;
        if ((dx * dx + dy * dy + dz * dz) * R * R > 1.0) continue;
        smashed[i] = 1; BO[k] = 0;
        S[CRY] = S[CRY]! + 2;
        emitA(E_CRATE, i, crate, i * 3, R);
        break;
      }
    }
    // ---- hostiles: in the dark (or round the beacon you defend), burning up in the sun ----
    S[HURT] = Math.max(0, S[HURT]! - dt);
    let alive = 0;
    for (let s = 0; s < SHIPS; s++) alive += SH[s * 9]! ? 1 : 0;
    const siege = kind === "defend" && S[MP] === M_RUN && S[MK] === 1;
    if (S[DARK] || siege) {
      S[SPN] = S[SPN]! - dt;
      const want = siege ? 2 : (lightK < -0.45 ? 3 : 2);
      if (S[SPN]! <= 0 && alive < want) {
        S[SPN] = siege ? 2.8 : 3;
        for (let s = 0; s < SHIPS; s++) {
          const q = s * 9;
          if (SH[q]) continue;
          const a = rand() * 2 - 1, sx = Fw[0]! + a * (U[1]! * Fw[2]! - U[2]! * Fw[1]!), sy2 = Fw[1]! + a * (U[2]! * Fw[0]! - U[0]! * Fw[2]!), sz = Fw[2]! + a * (U[0]! * Fw[1]! - U[1]! * Fw[0]!);
          const back = siege ? 0 : 0.25;
          let ux = U[0]! + sx * 0.62 - sun[0]! * back, uy = U[1]! + sy2 * 0.62 - sun[1]! * back, uz = U[2]! + sz * 0.62 - sun[2]! * back;
          const l = Math.sqrt(ux * ux + uy * uy + uz * uz);
          ux /= l; uy /= l; uz /= l;
          SH[q] = 1; SH[q + 1] = ux; SH[q + 2] = uy; SH[q + 3] = uz; SH[q + 4] = SH[q + 5] = SH[q + 6] = 0; SH[q + 7] = 0; SH[q + 8] = 0;
          emitA(E_SPAWN, s, SH, q + 1, R);
          break;
        }
      }
    } else S[SPN] = Math.min(S[SPN]!, 0.6);
    for (let s = 0; s < SHIPS; s++) {
      const q = s * 9;
      if (!SH[q]) continue;
      SH[q + 7] = SH[q + 7]! + dt;
      const ux = SH[q + 1]!, uy = SH[q + 2]!, uz = SH[q + 3]!, sl = ux * sun[0]! + uy * sun[1]! + uz * sun[2]!;
      const lead = 0.4 + s * 0.15, tx0 = P[0]! / pl2 + Fw[0]! * lead * 0.05 * car.speed / 12, ty0 = P[1]! / pl2 + Fw[1]! * lead * 0.05 * car.speed / 12, tz0 = P[2]! / pl2 + Fw[2]! * lead * 0.05 * car.speed / 12;
      let gx = tx0 - ux, gy = ty0 - uy, gz = tz0 - uz;
      const d = gx * ux + gy * uy + gz * uz;
      gx -= d * ux; gy -= d * uy; gz -= d * uz;
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1, flee = (!siege && sl > 0.06) || SH[q + 8]! > 0;
      const sp = flee ? -6 : (9.4 + s * 0.4) * FOE;
      const k = Math.min(1, 2.4 * dt);
      SH[q + 4] = SH[q + 4]! + ((gx / gl) * sp - SH[q + 4]!) * k;
      SH[q + 5] = SH[q + 5]! + ((gy / gl) * sp - SH[q + 5]!) * k;
      SH[q + 6] = SH[q + 6]! + ((gz / gl) * sp - SH[q + 6]!) * k;
      let vx = SH[q + 4]!, vy = SH[q + 5]!, vz = SH[q + 6]!;
      let nx2 = ux + (vx * dt) / R, ny2 = uy + (vy * dt) / R, nz2 = uz + (vz * dt) / R;
      const nl = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2);
      nx2 /= nl; ny2 /= nl; nz2 /= nl;
      const vd = vx * nx2 + vy * ny2 + vz * nz2;
      vx -= vd * nx2; vy -= vd * ny2; vz -= vd * nz2;
      SH[q + 1] = nx2; SH[q + 2] = ny2; SH[q + 3] = nz2; SH[q + 4] = vx; SH[q + 5] = vy; SH[q + 6] = vz;
      if (flee) {
        SH[q + 8] = SH[q + 8]! + dt;
        if (SH[q + 8]! > 1.4) (SH[q] = 0), emitA(E_BURN, s, SH, q + 1, R);
        continue;
      }
      HQ[0] = nx2; HQ[1] = ny2; HQ[2] = nz2; o.hq();
      const sr = R + HQ[3]! + 1.5, dx = nx2 * sr - P[0]!, dy = ny2 * sr - P[1]!, dz = nz2 * sr - P[2]!;
      if (dx * dx + dy * dy + dz * dz < 1.75 * 1.75 && S[HURT] === 0 && S[PH] === RUN) {
        SH[q] = 0;
        S[HURT] = 1.6;
        car.spinOut(rand() < 0.5 ? 5 : -5, 0.55);
        (X3[0] = nx2 * sr), (X3[1] = ny2 * sr), (X3[2] = nz2 * sr);
        if (pl.steal && S[CRY]! > 0) {
          const t = Math.min(5, S[CRY]!);
          S[CRY] = S[CRY]! - t;
          emitA(E_STEAL, t, X3, 0, 1);
        } else {
          S[SHD] = S[SHD]! - 1;
          if (S[CARRY]) (S[CARRY] = 0), emitA(E_DROP, 0, P, 0, 1);
          emitA(E_HIT, S[SHD]!, X3, 0, 1);
        }
      }
    }
    if (S[SHD]! <= 0 && S[PH] === RUN) (S[PH] = DOWN), emitA(E_DOWN, 0, P, 0, 1);
    return true;
  }

  /** GOAL = the unit direction of what to do next; returns 0 giver, 1 target, 2 pad, 3 beacon core / outpost. */
  function goal() {
    const mp = S[MP]!;
    let src: Float64Array = friend, i = 0, kindG = 0;
    if (mp === M_RUN) {
      kindG = 1;
      src = target;
      if (kind === "race") i = S[MK]!;
      else if (kind === "deliver") i = S[CARRY] ? 3 : 0;
      else if (kind === "defend") i = 0;
      else {
        let best = Infinity;
        for (let k = 0; k < M.count; k++) {
          if (tgot[k]) continue;
          const d = d2(target, k * 3);
          if (d < best) (best = d), (i = k * 3);
        }
        GOAL[0] = target[i]!; GOAL[1] = target[i + 1]!; GOAL[2] = target[i + 2]!;
        return 1;
      }
      i *= 3;
    } else if (mp === M_BACK && kind === "beacon") (src = target), (i = M.count * 3), (kindG = 3);
    else if (mp === M_DONE) (src = pad), (kindG = 2);
    GOAL[0] = src[i]!; GOAL[1] = src[i + 1]!; GOAL[2] = src[i + 2]!;
    return kindG;
  }
  /** Drive by itself toward the goal, ACT at the giver, fire at any hostile ahead (the hero, the tests). */
  function autopilot(I: Float64Array) {
    goal();
    const F = G.F, bx = GOAL[0]!, by = GOAL[1]!, bz = GOAL[2]!;
    const tx = bx - F[3]!, ty = by - F[4]!, tz = bz - F[5]!, a = tx * F[0]! + ty * F[1]! + tz * F[2]!, b = tx * F[6]! + ty * F[7]! + tz * F[8]!;
    const cy = car._s[20]!, sy = car._s[21]!, fx = cy, fz = -sy, l = Math.sqrt(a * a + b * b) || 1, dx = a / l, dz = b / l;
    const crossv = fx * dz - fz * dx, dot = fx * dx + fz * dz, dist = l * R;
    I.fill(0);
    I[IN_STEER] = Math.max(-1, Math.min(1, (dot < 0 ? (crossv < 0 ? -1 : 1) : crossv * 2.4)));
    I[IN_GAS] = (dot > 0.2 || car.speed < 3) && !(dist < 4 && car.speed > 4) ? 1 : 0;
    I[IN_BRAKE] = (dot < -0.3 && car.speed > 6) || (dist < 4 && car.speed > 5) ? 1 : 0;
    if (S[NEAR] === GIVER && (S[MP] === M_OFFER || S[MP] === M_BACK) && !S[ACTH]) I[IN_ACT] = 1;
    for (let s = 0; s < SHIPS; s++) {
      const q = s * 9;
      if (!SH[q]) continue;
      const vx = SH[q + 1]! * R - P[0]!, vy = SH[q + 2]! * R - P[1]!, vz = SH[q + 3]! * R - P[2]!, vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (vl < 24 && (vx * Fw[0]! + vy * Fw[1]! + vz * Fw[2]!) / vl > 0.55) I[IN_FIRE] = 1;
    }
  }
  function clear() { n = 0; }
  reset();
  return {
    planet: pl, kit, radius: R, orb: o, car, chart: G, S, ev, get n() { return n; }, clear, reset, respawn, step, autopilot, goal, GOAL, talk,
    sync: where,
    nt: NT, crystal, rock, crate, base, friend, ramp, target, pad, beacon, got, smashed, tgot, fReact, fGift, SH, BO, P, U, Fw, start,
    counts: { crystals: CRYSTALS, rocks: ROCKS, crates: CRATES, ramps: RAMPS },
    day: (x: number, y: number, z: number) => x * sun[0]! + y * sun[1]! + z * sun[2]!,
    sun, seam,
  };
}
export type RoverRun = ReturnType<typeof roverRun>;
