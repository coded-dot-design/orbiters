# Orbiters

Drive a little rover round six small round worlds, meet their aliens, run their missions and relight the beacon network. A game by [Chris Cooley](https://coded.design/), built on [Fizlet](https://fizlet.com/). Play at <https://orbiters.domvirus.com>.

## The game

- **Six worlds**, each a small ball you can drive all the way round: Pebble (dust craters), Rime (ice), Dunemar (dunes), Cinder (lava fields), Prism (crystal spires) and Halo (the ringed world, low gravity). Day on one side, night on the other.
- **Aliens.** Drive up and tap ACT (E or Enter): the elder gives the world's mission, the trader buys crystals, the outpost hands out boosts and shields. On the night side hostiles come for you: they ram (a shield) or steal (crystals). FIRE shoots them; the sun burns them up.
- **Missions**, one per world, in order: collect six power cells, race six ice gates against the clock, deliver a beacon core, tow three stranded friends home (needs the tow claw), hold the beacon ring for 25 seconds, gather five shards for the great beacon. Each one lights that world's beacon and opens the launch pad to the next.
- **Garage.** Pilot: suit, helmet, visor. Rover: body, wheels, paint, trim, decal, and parts (spike tyres, boost tank, armour plate, tow claw). Credits come from missions and trading crystals. One profile, saved on this device, plus a save code to move it.

Keys: arrows or WASD drive · E talks · Space fires · Shift boosts · J jumps · M mutes · Escape opens the map. Phone: a stick on the left; FIRE, BOOST, ACT and JUMP on the right. A gamepad works too.

## Use it

```js
import { createOrbiters } from "./dist/orbiters.mjs";
const game = createOrbiters({ host: document.getElementById("game") });
```

`dist/orbiters.js` is the same as one script (global `orbiters`). No runtime dependencies: the Fizlet bricks it uses are bundled. `game.destroy()` gives the page back exactly as it was.

## Develop

```sh
npm ci
npm run check          # typecheck, build dist/, size budget
npm test               # the run headless: missions, determinism, zero allocation; the profile
npm run test:settle    # it sleeps when nothing moves
npm run test:browser   # drive, talk, a mission, the pad to Rime, the garage, the phone pad
npm run site:build && npm run test:site
```

Source: `src/orb.ts` (the round world: surface, tiles, the drive ground on a sphere, the camera rule), `src/run.ts` (a visit, headless), `src/scene.ts` (a world on screen), `src/rover.ts` (rover and pilot), `src/planets.ts` (the six worlds), `src/profile.ts` (the save), `src/game.ts` (map, garage, flight).

MIT © Chris Cooley.
