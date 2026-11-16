# NEON BREACH — Kestrel Yard

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/morashad1010/neon-breach/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/morashad1010/neon-breach/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)


A complete, original round-based tactical FPS that runs entirely in the browser
(three.js, no build step). You + 4 AI teammates (Kestrels) vs 5 AI enemies (Vultures)
on a night-time container yard. Plant the charge at site A or B; first to 8 rounds wins.

## Run

```sh
node serve.ts          # Node 22+, serves game/ at http://localhost:8082
# open http://localhost:8082
```

Grader entrypoint: `node main.ts` copies `game/` + `screenshots/` to `/output`
(or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` via the vendored make.fun library.

## Controls

| Input | Action |
|---|---|
| WASD | move |
| Mouse | look (click to lock pointer) |
| LMB | fire |
| R | reload |
| 1 / 2 / 3 | knife / sidearm / rifle |
| G | throw grenade |
| B | buy menu (freeze time) |
| E | plant / defuse (hold) |
| Ctrl | crouch |
| Shift | walk (quiet) |
| Tab | scoreboard |

## Features

- Full match loop: freeze (buy phase) -> live round -> round end -> first to 8, with
  economy ($800 start, kill/round/plant rewards), buy menu (pistol, SMG, rifle, shotgun,
  armor, grenades, medkit, defuse kit for defenders).
- Bomb plant/defuse with a 40 s charge, defuse kit, and round-win conditions
  (elimination, charge detonation, defuse, timer).
- 9 AI bots with distinct names/personalities: patrol, push, defend-site, hunt, plant,
  defuse, flank behaviors, waypoint nav-graph pathfinding, line-of-sight checks,
  reaction time, accuracy falloff by distance/movement, hearing gunshots.
- Hitscan weapons with spread/bloom, recoil, damage falloff, headshot multiplier,
  pellet shotgun, melee knife; grenades with physics + radial damage; armor absorption.
- Effects: tracers, muzzle flashes, impact sparks, blood, decals, screen shake,
  damage vignette, hitmarkers, killfeed, round banners, plant beeping.
- Synthesized WebAudio SFX (shots, hits, footsteps, plant beeps, round stingers) —
  no audio assets.
- Deterministic seeded RNG (`?seed=N`) and an autopilot (`?shot=start|play|buy|plant`)
  used to generate the screenshots in `screenshots/` headlessly.

## Layout

```
main.ts            grader entrypoint (copies game/ + screenshots/ to output, writes dossier.json)
serve.ts           local static server (port 8082)
vendor/            make.fun three.js bundle (three.module.min.js) + makefun-threejs.ts
grader/record.ts   grader recorder
game/index.html    HUD + menus
game/src/*.js      config, rng, input, audio, map, effects, weapons, player, bots, game, hud, viewmodel, shots, main
screenshots/       4 PNGs captured in-browser (start menu, firefight, buy menu, plant)
```
