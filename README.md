# Casino Tycoon — Corrupted Casino Owner

A single-player 3D web tycoon game. You are **Victor Vane**, owner of a strip-mall casino with a dream of the Las Vegas strip and no scruples about how to get there.

Built with [Three.js](https://threejs.org) and [Vite](https://vitejs.dev). All 3D models are procedural low-poly and every texture is drawn to a canvas at runtime (no asset downloads), so the world can change shape as you buy upgrades.

**Art direction: neon noir.** Deep blacks and wet asphalt, saturated pink and gold neon, bloom and haze, cigarette smoke in the light cones. Rendering runs through ACES filmic tone mapping, an image-based environment, and a post chain of bloom + a custom grade pass (vignette, film grain, chromatic aberration, warm/cool split-tone). The three activity minigames are drawn on a 2D canvas with the same palette — light pools, chase-light bulb strips, gold corner brackets, and neon display type.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes a static site to `dist/`; `npm run preview` serves it.

## How to play

| Key | Action |
| --- | --- |
| **W A S D** / arrows | Walk |
| Drag mouse / **Q** | Orbit the camera · scroll to zoom |
| **E** | Interact with the glowing zone you're standing in |
| **1 / 2 / 3** | Jump to the street, the safe, or the dealer table |
| **U** | Open the Ledger (upgrades) · **Tab** stats · **H** help · **Esc** close |

### The loop

Guests walk in (passively from *walk-in traffic*, or because you slipped them an ad card), sit at a slot machine or a table, and spend into that machine's **hopper**. Hopper cash isn't yours until you haul it to the **safe**, and a full hopper stops earning. Bank money, spend it in the Ledger, buy the next casino. Three casinos: The Lucky Duck → The Golden Rat → Palazzo Diablo, Las Vegas.

### Three activities

- **Advertising** (street outside) — Operation-style: guide the ad card through the winding gap into the mark's pocket without touching the fabric. Every planted card has a chance (*Ad Card Conversion*) to bring a guest.
- **Cash Run** (the safe in your office) — drag cash stacks from the hoppers into the safe before time runs out. The safe door swings shut periodically. You only bank what lands.
- **Dealer** (first table) — a target number is drawn, the house number sweeps 0–100 for 10 seconds; lock it inside the gambler's margin and the house takes the bet. Drunks have a wide margin, sharps a tiny one, whales bet big.

### Progression

- **3 casinos**, each with its own **15 upgrades** (more machines, gas in the AC, board up the windows, bribe the fire marshal, rigged roulette, hotel tower, own the governor…).
- **15 advertising campaigns** that follow you between casinos (school bus wrap, retirement-home shuttle, spam texts, highway billboard, subliminal cinema frames…).
- **5 skill paths × 5 levels** for Victor — Sleight of Hand, Strong Back, Poker Face, Silver Tongue, Fast Feet — each one makes an activity easier and changes his outfit.
- **5 cosmetic awards** (gold toilet, statue of yourself, name in lights, a pet tiger called Audit, a champagne fountain) that are "cosmetic" but still move real stats.
- Every card in the Ledger shows the exact stat change it makes (`60s → 66s`), and upgrades with a physical form appear in the 3D world.
- **Heat** is how much the authorities notice you. Inspectors drop by now and then and the envelope costs money. Bribes bring heat down.

Progress auto-saves in the browser (`localStorage`). "Wipe the books" on the title screen starts over.

## Project layout

```
index.html                 HUD, ledger, minigame overlay, intro/help/result modals
src/main.js                boot, main loop, activity dispatch, key handling
src/state.js               game state, stat computation, purchases, save/load
src/data/casinos.js        the three casinos and their base stats
src/data/upgrades.js       15 ad upgrades, 15 upgrades per casino, 5 awards
src/data/skills.js         5 skill paths
src/engine/scene.js        renderer, lights, environment, sky
src/engine/textures.js     procedural canvas textures (carpet, wallpaper, felt, reels, neon type)
src/engine/postfx.js       bloom + custom grade pass (vignette, grain, aberration, split-tone)
src/engine/player.js       third-person controller + camera
src/world/models.js        procedural low-poly models (machines, tables, props)
src/world/people.js        rigged low-poly figures — Victor and the guests — and their animation
src/world/casino.js        builds the casino + street from stats and owned upgrades
src/world/customers.js     guest AI: arrive, find a machine/seat, spend, leave
src/world/effects.js       floating money numbers, smoke, sparks
src/minigames/base.js      the shared neon-noir 2D drawing kit (panels, neon, bulbs, grain)
src/minigames/*.js         the three activity games, drawn with that kit
src/ui/icons.js            inline SVG icon set
src/ui/hud.js              HUD, portrait, toasts, stats panel
src/ui/ledger.js           upgrade screen
test/run.sh                starts `vite preview`, runs a test script, tears the server down
test/smoke.mjs             headless Playwright end-to-end pass
test/minis.mjs             drives each minigame into its play phase and screenshots it
```

Tests need `playwright` installed and run as `bash test/run.sh test/minis.mjs`.

Tuning knobs live in `src/data/*.js` and `PLAYER_BASE` in `src/state.js` — every number the game uses is data.
