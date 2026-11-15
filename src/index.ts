// Orbiters: drive a little rover round six small round worlds, meet their aliens, run their
// missions and relight the beacon network. Built on Fizlet, by Chris Cooley.
//   createOrbiters({ host })                 mount in an element (the play page)
//   createOrbiters({ host, attract: true })  the landing hero: Pebble on the autopilot
//   createOrbiters()                         a layer over the whole page; destroy() gives it back
export { createOrbiters, type Orbiters, type OrbitersOptions } from "./game.ts";
export { PLANETS } from "./planets.ts";
