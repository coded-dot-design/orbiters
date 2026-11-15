// The system: six small round worlds, in the order the story opens them. Each is an orb (./orb.ts)
// with its own size, surface, gravity and grip, its hazards, a friendly species and a hostile one,
// and one mission whose reward relights that world's beacon and opens the route to the next.
// The story: the Beacon Network that guided rovers between the worlds went dark. Relight it.
// All names, aliens and lines are original.

export type MissionKind = "collect" | "race" | "deliver" | "rescue" | "defend" | "beacon";
export type PartId = "tyres" | "tank" | "armour" | "claw";

export interface Mission {
  kind: MissionKind;
  title: string;
  /** What the giver says when offering it. */
  offer: string;
  /** A reminder while it runs. */
  doing: string;
  /** Thanks, on hand-in. */
  thanks: string;
  /** Targets (cells, gates, stranded friends, shards). */
  count: number;
  /** Seconds (race: to finish; defend: to hold). */
  time?: number;
  reward: { credits: number; part?: PartId };
}

export interface Alien {
  name: string;
  /** Body shape the scene builds. */
  shape: "blob" | "tall" | "squat" | "wisp" | "crystal" | "ringed";
  lines: string[];
}

/** Terrain colours: day ×3, crater floor, rim, dusk ×2, night ×3, night floor, night rim, rock, night rock, dust, lava/glow accent. */
export type Ground = [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];

export interface Planet {
  id: string;
  name: string;
  /** One word for the surface. */
  surface: string;
  blurb: string;
  hazard: string;
  radius: number;
  seed: number;
  craters: number;
  hills: number;
  depth: number;
  /** Drive: gravity, tyre grip, top speed, accel. */
  gravity: number;
  grip: number;
  top: number;
  rocks: number;
  crystals: number;
  crates: number;
  ramps: number;
  /** Lava below this terrain height (Cinder), else none. */
  lava?: number;
  /** Tall crystal spires for rocks (Prism). */
  spires?: boolean;
  /** Foe: chaser speed, and what a hit costs (a shield, or crystals stolen). */
  foeSpeed: number;
  steal?: boolean;
  friend: Alien;
  foe: Alien;
  mission: Mission;
  dark: Ground;
  light: Ground;
  /** Sky: base, middle, horizon (dark, light) and the limb glow (dark, light). */
  sky: [string, string, string, string, string, string, string, string];
  /** Friend colours (body, body 2, tip) and foe colours (hull, hull 2, glow). */
  ally: [string, string, string];
  enemy: [string, string, string];
  /** A ring round this world, seen from the others (and in its own sky as a band). */
  ring?: boolean;
}

export const PLANETS: Planet[] = [
  {
    id: "pebble", name: "Pebble", surface: "Dust craters", hazard: "Dusk Darts on the night side",
    blurb: "The home moon: grey dust, deep craters and a night side that bites.",
    radius: 30, seed: 7, craters: 58, hills: 16, depth: 1.9, gravity: 14, grip: 0.95, top: 13,
    rocks: 40, crystals: 44, crates: 16, ramps: 7, foeSpeed: 1,
    friend: { name: "Blips", shape: "blob", lines: ["Beep! You drive like a comet.", "Our beacon went dark last cycle.", "Bring cells, we light it, you fly."] },
    foe: { name: "Dusk Darts", shape: "wisp", lines: [] },
    mission: { kind: "collect", title: "Power the beacon", offer: "Six power cells fell round the moon. Fetch them home and our beacon wakes.", doing: "Cells! Six of them. The arrow knows.", thanks: "It glows! Fuel for your pad, friend.", count: 6, reward: { credits: 300 } },
    dark: ["#9da3cc", "#a8add6", "#b4b9df", "#7f85b2", "#cdd1ef", "#b07fb8", "#c48ab4", "#24224f", "#2a275c", "#211e48", "#1a1840", "#3a3678", "#4f5384", "#1c1a3e", "#9a9ccc", "#22e6ff"],
    light: ["#f1e7d6", "#eadfca", "#e3d5bd", "#d6c4a8", "#fbf6ec", "#f1a98e", "#e99a8a", "#8a84bd", "#938dc6", "#7f79b1", "#726ca4", "#a7a1d6", "#c4b298", "#6e68a0", "#d9c8ad", "#13a9bb"],
    sky: ["#03041a", "#0b0a2e", "#1d0f45", "#b9c3f5", "#dcd2fa", "#ffe6d8", "#22e6ff", "#ff7a59"],
    ally: ["#7ff0b8", "#4fd39c", "#ffd166"], enemy: ["#4a3f7e", "#6a5bb0", "#ff2e5e"],
  },
  {
    id: "rime", name: "Rime", surface: "Ice sheets", hazard: "Slick ice and Shard Mites that steal crystals",
    blurb: "A frozen ball of glass-blue ice. Grip is a rumour here.",
    radius: 32, seed: 21, craters: 30, hills: 22, depth: 1.2, gravity: 13, grip: 0.62, top: 14,
    rocks: 30, crystals: 40, crates: 12, ramps: 9, foeSpeed: 1.05, steal: true,
    friend: { name: "Snoots", shape: "tall", lines: ["Hoo! Slide with it, not against it.", "Our gates froze shut. Thaw them by speed.", "Fast wheels make warm gates."] },
    foe: { name: "Shard Mites", shape: "crystal", lines: [] },
    mission: { kind: "race", title: "The thaw run", offer: "Drive through all six ice gates before the cold wins. Seventy seconds!", doing: "Gates in order. Go go go!", thanks: "Thawed! Take these spike tyres, they bite ice.", count: 6, time: 70, reward: { credits: 400, part: "tyres" } },
    dark: ["#7fc8e8", "#8fd3ee", "#a2def2", "#5fa8cc", "#d8f4ff", "#8a9fe0", "#9ab0ea", "#173a5c", "#1c4468", "#143352", "#0f2a44", "#2f6a96", "#4f8fb8", "#163a5a", "#c8ecff", "#7ff6ff"],
    light: ["#e6f6fc", "#d9f0f8", "#cbe8f4", "#b4dcec", "#ffffff", "#b9c8f2", "#aabce8", "#7fa6c8", "#89b0d2", "#7299bc", "#6a90b4", "#a6c8e0", "#9cc4dc", "#5f86aa", "#eefaff", "#1a9cc8"],
    sky: ["#020c1c", "#06203a", "#0f3a5c", "#c4e4f6", "#e2f2fb", "#f4f0ff", "#7ff6ff", "#1a9cc8"],
    ally: ["#f4f7ff", "#cfe0ff", "#ff8a3d"], enemy: ["#2a6a96", "#5fb0e0", "#b8ffff"],
  },
  {
    id: "dunemar", name: "Dunemar", surface: "Rolling dunes", hazard: "Sand Rays that ram from the shadows",
    blurb: "Hot orange dunes in long waves. Big air on every crest.",
    radius: 34, seed: 33, craters: 12, hills: 40, depth: 0.9, gravity: 14, grip: 0.85, top: 14,
    rocks: 26, crystals: 42, crates: 14, ramps: 10, foeSpeed: 1.1,
    friend: { name: "Burrowers", shape: "squat", lines: ["Psst. Up here. We dig, you drive.", "The outpost needs its beacon core.", "Rays hate the sun. Stay bright."] },
    foe: { name: "Sand Rays", shape: "wisp", lines: [] },
    mission: { kind: "deliver", title: "Core delivery", offer: "Pick up the beacon core at our depot and haul it to the far outpost. Rays will try to knock it loose.", doing: "Depot first, then the outpost. Don't get rammed!", thanks: "Core in! A tow claw, for the heavy jobs ahead.", count: 2, reward: { credits: 450, part: "claw" } },
    dark: ["#e0874a", "#e8955a", "#efa66c", "#b8643a", "#ffd0a0", "#d06a8a", "#e07a8e", "#4a1f3a", "#552442", "#3e1a32", "#33142a", "#6a2e52", "#9a4a3a", "#3a1830", "#f2b88a", "#ff9a3c"],
    light: ["#ffd6a8", "#ffcb96", "#f8be86", "#eaa874", "#fff0dc", "#f2a0a0", "#ea9098", "#b27a9a", "#bc86a4", "#a46e8c", "#9a6484", "#c89ab4", "#d4926a", "#8e5a7a", "#ffe2c0", "#ff6a2a"],
    sky: ["#14061a", "#2a0c2a", "#4a1a2e", "#ffd6b8", "#ffe8d0", "#fff4e0", "#ff9a3c", "#ff6a2a"],
    ally: ["#c89a5a", "#a87a3e", "#39ffb0"], enemy: ["#3a1a42", "#6a2e7a", "#ff4f9e"],
  },
  {
    id: "cinder", name: "Cinder", surface: "Lava fields", hazard: "Lava in the low ground; Magma Wisps",
    blurb: "Black basalt over rivers of lava. Keep to the high ground.",
    radius: 31, seed: 45, craters: 44, hills: 18, depth: 2.0, gravity: 15, grip: 0.95, top: 13,
    rocks: 34, crystals: 40, crates: 12, ramps: 8, lava: -0.55, foeSpeed: 1.15,
    friend: { name: "Emberkin", shape: "blob", lines: ["Warm welcome! Literally.", "Three of us got stuck out on the flows.", "Your claw can tow them home."] },
    foe: { name: "Magma Wisps", shape: "wisp", lines: [] },
    mission: { kind: "rescue", title: "Off the flows", offer: "Three Emberkin are stranded out on the lava fields. Tow them home with your claw!", doing: "Find them, grab them, bring them back.", thanks: "All home! Take this armour plate. You'll need it.", count: 3, reward: { credits: 500, part: "armour" } },
    dark: ["#3a3446", "#423a50", "#4a4258", "#ff5a1f", "#6a6080", "#7a3a5a", "#8a4462", "#1c1622", "#221a2a", "#18121e", "#ff3a12", "#3a2a44", "#2a2432", "#140e18", "#8a7a90", "#ff7a1a"],
    light: ["#6a5e72", "#74687c", "#7e7286", "#ff7a2a", "#9a8ea6", "#b27088", "#bc7a90", "#4a3e52", "#52465a", "#42364a", "#ff5a1a", "#6a5a76", "#4a4052", "#3a3042", "#b4a8bc", "#ff4a12"],
    sky: ["#0e0408", "#2a0a10", "#4a1410", "#f6c8b0", "#ffd8c4", "#ffe8d8", "#ff7a1a", "#ff4a12"],
    ally: ["#ffb35c", "#ff8a3d", "#fff6d6"], enemy: ["#4a1a12", "#8a2a1a", "#ffd166"],
  },
  {
    id: "prism", name: "Prism", surface: "Crystal spires", hazard: "Spires to dodge; Hollows swarm the beacon",
    blurb: "A world grown from crystal. Spires everywhere; the light bends.",
    radius: 33, seed: 58, craters: 26, hills: 20, depth: 1.4, gravity: 12, grip: 0.9, top: 14,
    rocks: 46, crystals: 50, crates: 10, ramps: 8, spires: true, foeSpeed: 1.2,
    friend: { name: "Glints", shape: "crystal", lines: ["Ting! You reflect well.", "Hollows want our beacon's song.", "Hold the ring and they fade."] },
    foe: { name: "Hollows", shape: "wisp", lines: [] },
    mission: { kind: "defend", title: "Hold the song", offer: "Stay by our beacon for twenty-five seconds while it tunes. Hollows will come. Shoot them!", doing: "Inside the ring! Keep it singing.", thanks: "It sings again! A boost tank for you.", count: 1, time: 25, reward: { credits: 550, part: "tank" } },
    dark: ["#8a6ae0", "#9a7aea", "#aa8cf2", "#6a4ec0", "#e0d0ff", "#d06ad0", "#e07ae0", "#24184a", "#2a1c56", "#1e143e", "#180f36", "#3e2a7a", "#c070ff", "#3a2470", "#c8b0ff", "#ff4fd8"],
    light: ["#e6dcff", "#dcd0fc", "#d0c2f6", "#c0aef0", "#ffffff", "#f6b8f0", "#eeaaea", "#9a88d0", "#a494d8", "#8e7cc4", "#8270bc", "#b8a8e8", "#c890ff", "#7a64bc", "#f0e8ff", "#d040c0"],
    sky: ["#08041a", "#160a34", "#2a1050", "#d8ccfa", "#ece2fc", "#fff0fa", "#ff4fd8", "#d040c0"],
    ally: ["#7ff6ff", "#4fd0e8", "#ffffff"], enemy: ["#1a1030", "#3a2060", "#b18cff"],
  },
  {
    id: "halo", name: "Halo", surface: "Ringed plains", hazard: "Low gravity; every Dusk Dart left in the system",
    blurb: "The ringed world at the edge. Light gravity, huge jumps, the great beacon.",
    radius: 36, seed: 71, craters: 40, hills: 24, depth: 1.6, gravity: 9, grip: 0.9, top: 15,
    rocks: 32, crystals: 50, crates: 14, ramps: 12, foeSpeed: 1.25, ring: true,
    friend: { name: "Ringwardens", shape: "ringed", lines: ["You came all this way? Brave wheels.", "The great beacon needs five shards.", "Light it and every world sees home."] },
    foe: { name: "Dusk Darts", shape: "wisp", lines: [] },
    mission: { kind: "beacon", title: "The great beacon", offer: "Five beacon shards lie scattered round Halo. Gather them and set them in the great beacon.", doing: "Shards first, then the great beacon.", thanks: "THE NETWORK IS LIT. Every world can see the way home.", count: 5, reward: { credits: 1000 } },
    dark: ["#4a5ab0", "#5464ba", "#5e70c4", "#3a4890", "#a8b8ff", "#8a5ab8", "#9a66c4", "#141a44", "#181f50", "#10163a", "#0c1232", "#2a347a", "#3a4898", "#121a48", "#9aa8ff", "#ffd166"],
    light: ["#cdd6ff", "#c2ccfa", "#b6c2f4", "#a8b4ec", "#f4f6ff", "#d8b2f0", "#ccaaea", "#8890cc", "#929ad4", "#7c84c0", "#7078b8", "#a8b0e4", "#9aa6e4", "#6a74b8", "#e4e8ff", "#e8a400"],
    sky: ["#04061a", "#0a0e34", "#1a1650", "#c8cef8", "#e0e2fc", "#fff2dc", "#ffd166", "#e8a400"],
    ally: ["#ffd166", "#ffb347", "#22e6ff"], enemy: ["#2a2060", "#4a3a9a", "#ff4fa8"],
  },
];

export const planet = (id: string) => PLANETS.find((p) => p.id === id) ?? PLANETS[0]!;
export const PART_NAME: Record<PartId, string> = { tyres: "Spike tyres", tank: "Boost tank", armour: "Armour plate", claw: "Tow claw" };
export const PART_WHAT: Record<PartId, string> = { tyres: "+grip, ice bites", tank: "boost lasts longer", armour: "+1 shield", claw: "tow cargo and friends" };
