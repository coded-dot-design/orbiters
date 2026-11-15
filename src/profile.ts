// The profile: one pilot and one rover, saved on this device (localStorage, guarded: a private window
// or blocked storage just means no save), versioned and migrated step by step, repaired when partial
// (`normalize`), never written over by an older game when a newer one saved it; an export code
// (OB1-…, with a checksum) moves it to another device. Credits come from missions and trading
// crystals; the garage spends them on parts and a few premium looks.
import { LOOK0, PAINTS, BODIES, WHEELS, HELMETS, DECALS, type Look } from "./rover.ts";
import { PLANETS, type PartId } from "./planets.ts";

export const VERSION = 2;
export const PARTS: PartId[] = ["tyres", "tank", "armour", "claw"];
export const PART_PRICE: Record<PartId, number> = { tyres: 600, tank: 700, armour: 800, claw: 500 };
/** Paints from this index on, and decals from this index on, are bought once (credits). */
export const PREMIUM_PAINT = 4, PREMIUM_DECAL = 2, LOOK_PRICE = 150;

export interface Profile {
  v: number;
  name: string;
  credits: number;
  look: Look;
  /** Parts owned and parts fitted. */
  parts: PartId[];
  fit: PartId[];
  /** Premium looks bought: "paint:5", "decal:3". */
  owned: string[];
  unlocked: string[];
  cleared: string[];
  /** The world you were last on. */
  at: string;
  stats: { crystals: number; kills: number; trips: number };
}
export interface Store { get(k: string): string | null; set(k: string, v: string): void }
export const KEY = "orbiters:profile";
export const local: Store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* no storage: play on, unsaved */ } },
};

export const fresh = (): Profile => ({ v: VERSION, name: "PILOT", credits: 0, look: { ...LOOK0 }, parts: [], fit: [], owned: [], unlocked: [PLANETS[0]!.id], cleared: [], at: PLANETS[0]!.id, stats: { crystals: 0, kills: 0, trips: 0 } });

/** Version steps, in order: each takes the save from v to v + 1. */
const STEPS: Record<number, (p: any) => any> = {
  // v1 (the first saves) kept the parts as booleans and the worlds as an index.
  1: (p) => ({ ...p, v: 2, parts: PARTS.filter((k) => p.parts?.[k]), fit: PARTS.filter((k) => p.parts?.[k]), unlocked: PLANETS.slice(0, Math.max(1, (p.reach ?? 0) + 1)).map((w) => w.id), cleared: PLANETS.slice(0, p.reach ?? 0).map((w) => w.id), reach: undefined }),
};
export function migrate(p: any): any {
  let q = { ...p, v: typeof p.v === "number" ? p.v : 1 };
  while (q.v < VERSION && STEPS[q.v]) q = STEPS[q.v]!(q);
  return q;
}
const clampI = (n: unknown, max: number, d: number) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < max ? (n as number) : d);
/** Repair a partial or out-of-range save. */
export function normalize(p: any): Profile {
  const f = fresh(), ids = PLANETS.map((w) => w.id), look = p.look ?? {};
  const list = <T extends string>(a: unknown, ok: readonly T[]) => (Array.isArray(a) ? [...new Set(a.filter((x): x is T => ok.includes(x as T)))] : []);
  const unlocked = list(p.unlocked, ids);
  if (!unlocked.includes(ids[0]!)) unlocked.unshift(ids[0]!);
  const parts = list(p.parts, PARTS);
  return {
    v: VERSION,
    name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 12).toUpperCase() : f.name,
    credits: Number.isFinite(p.credits) ? Math.max(0, Math.min(999999, Math.floor(p.credits))) : 0,
    look: {
      body: clampI(look.body, BODIES.length, LOOK0.body), wheels: clampI(look.wheels, WHEELS.length, LOOK0.wheels), paint: clampI(look.paint, PAINTS.length, LOOK0.paint), trim: clampI(look.trim, PAINTS.length, LOOK0.trim),
      decal: clampI(look.decal, DECALS.length, LOOK0.decal), suit: clampI(look.suit, PAINTS.length, LOOK0.suit), helmet: clampI(look.helmet, HELMETS.length, LOOK0.helmet), visor: clampI(look.visor, PAINTS.length, LOOK0.visor),
    },
    parts,
    fit: list(p.fit, PARTS).filter((k) => parts.includes(k)),
    owned: Array.isArray(p.owned) ? [...new Set(p.owned.filter((s: unknown) => typeof s === "string" && /^(paint|decal):\d$/.test(s)))] as string[] : [],
    unlocked,
    cleared: list(p.cleared, ids).filter((k) => unlocked.includes(k)),
    at: unlocked.includes(p.at) ? p.at : ids[0]!,
    stats: { crystals: Math.max(0, p.stats?.crystals | 0), kills: Math.max(0, p.stats?.kills | 0), trips: Math.max(0, p.stats?.trips | 0) },
  };
}
/** Load: a fresh profile when there is none or it is garbage; `newer` when a newer game wrote it (then it is never written over). */
export function load(s: Store = local): { profile: Profile; newer: boolean } {
  const raw = s.get(KEY);
  if (!raw) return { profile: fresh(), newer: false };
  try {
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return { profile: fresh(), newer: false };
    if (typeof p.v === "number" && p.v > VERSION) return { profile: normalize(p), newer: true };
    return { profile: normalize(migrate(p)), newer: false };
  } catch {
    return { profile: fresh(), newer: false };
  }
}
export function save(p: Profile, s: Store = local, newer = false) {
  if (newer) return false;
  s.set(KEY, JSON.stringify(p));
  return true;
}
const sum = (t: string) => { let h = 7; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0; return (h % 46656).toString(36).padStart(3, "0"); };
const b64 = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
const unb64 = (t: string) => new TextDecoder().decode(Uint8Array.from(atob(t), (ch) => ch.charCodeAt(0)));
/** The export code: OB1-<base64 json>-<checksum>. */
export function exportCode(p: Profile) {
  const body = b64(JSON.stringify(p));
  return `OB1-${body}-${sum(body)}`;
}
/** Read an export code back; null when it is not one (or a character slipped). */
export function importCode(code: string): Profile | null {
  const m = /^OB1-([A-Za-z0-9+/=]+)-([0-9a-z]{3})$/.exec(code.trim());
  if (!m || sum(m[1]!) !== m[2]) return null;
  try {
    const p = JSON.parse(unb64(m[1]!));
    return p && typeof p === "object" ? normalize(migrate(p)) : null;
  } catch {
    return null;
  }
}

// ---- the story and the garage ----
/** A mission done: its reward in, the beacon lit, the next world opened. */
export function complete(p: Profile, id: string): Profile {
  const i = PLANETS.findIndex((w) => w.id === id), w = PLANETS[i];
  if (!w || p.cleared.includes(id)) return p;
  const r = w.mission.reward, next = PLANETS[i + 1];
  return {
    ...p,
    credits: p.credits + r.credits,
    parts: r.part && !p.parts.includes(r.part) ? [...p.parts, r.part] : p.parts,
    fit: r.part && !p.fit.includes(r.part) ? [...p.fit, r.part] : p.fit,
    cleared: [...p.cleared, id],
    unlocked: next && !p.unlocked.includes(next.id) ? [...p.unlocked, next.id] : p.unlocked,
  };
}
export const trade = (p: Profile, crystals: number): Profile => ({ ...p, credits: p.credits + crystals * 5, stats: { ...p.stats, crystals: p.stats.crystals + crystals } });
export function buyPart(p: Profile, k: PartId): Profile {
  if (p.parts.includes(k) || p.credits < PART_PRICE[k]) return p;
  return { ...p, credits: p.credits - PART_PRICE[k], parts: [...p.parts, k], fit: [...p.fit, k] };
}
export const fitPart = (p: Profile, k: PartId, on: boolean): Profile => (!p.parts.includes(k) ? p : { ...p, fit: on ? [...new Set([...p.fit, k])] : p.fit.filter((x) => x !== k) });
/** The price of a look choice (0 when free or owned). */
export function lookPrice(p: Profile, key: keyof Look, i: number) {
  if ((key === "paint" || key === "trim") && i >= PREMIUM_PAINT && !p.owned.includes("paint:" + i)) return LOOK_PRICE;
  if (key === "decal" && i >= PREMIUM_DECAL && !p.owned.includes("decal:" + i)) return LOOK_PRICE;
  return 0;
}
/** Set a look choice, buying it if it is premium (refused when short of credits). */
export function setLook(p: Profile, key: keyof Look, i: number): Profile {
  const cost = lookPrice(p, key, i);
  if (cost > p.credits) return p;
  const tag = key === "decal" ? "decal:" + i : "paint:" + i;
  return { ...p, credits: p.credits - cost, owned: cost ? [...p.owned, tag] : p.owned, look: { ...p.look, [key]: i } };
}
