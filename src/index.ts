// Moon Rover: drive a little rover round six small round worlds, meet their aliens, run their
// missions and relight the beacon network. Built on Fizlet, by Chris Cooley.
//   createMoonRover({ host })                 mount in an element (the play page)
//   createMoonRover({ host, attract: true })  the landing hero: Pebble on the autopilot
//   createMoonRover()                         a layer over the whole page; destroy() gives it back
export { createMoonRover, type MoonRover, type MoonRoverOptions } from "./game.ts";
export { PLANETS } from "./planets.ts";
