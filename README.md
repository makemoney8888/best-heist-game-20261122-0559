[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/makemoney8888/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/makemoney8888/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

# The Midnight Vault

A top-down heist game, written from scratch in plain canvas JavaScript with no
libraries and no network requests. One thief, one museum after dark: sneak past
three patrolling guards and three sweeping security cameras, lift the Starlight
Diamond from the vault, and reach the green getaway pad — without the alarm
meter filling up.

## How it plays

- **Read the cones before you move.** Amber cones are patrols; red means a guard
  or camera has eyes on you. The alarm climbs only while you are seen and falls
  while you are hidden — a full meter means you are caught.
- **Several routes.** The vault has two doors: the south door past the vault-door
  camera, or the west door past the gallery guard. Display cases are solid cover
  that blocks sight as well as movement.
- **Tools, at a cost.** Every tool spends some of your take: a noise-maker
  (`1`, $50) throws a clink that pulls guards away to investigate; an EMP (`2`,
  $100) kills every camera for 8 seconds; a disguise (`3`, $150) makes guards
  ignore you for 6 seconds unless they are right next to you. Cameras see
  through the disguise — only an EMP stops them.
- **Side loot.** Paintings ($300) and cash ($150) are worth grabbing on the way,
  if the patrols allow it. Your final take is loot minus tool costs.
- **Fair catches.** Being spotted flashes SPOTTED and turns the cones red, but
  it still takes about two seconds of being stared at to fill the alarm — and a
  guard who touches you catches you on the spot, so mind the patrols.

## Controls

- Move: `WASD` or arrow keys, or click where to go.
- Tools: `1` noise-maker, `2` EMP, `3` disguise.
- Pause: `P` or `Esc`. Start / restart: `Space`, `Enter` or click.

## Run it

```sh
node serve.ts
```

then open http://localhost:8080 in desktop Chrome. The game is static files
under `game/` with no build step.

## Layout

- `game/index.html` — the page and canvas.
- `game/src/config.js` — every tuning number and colour.
- `game/src/level.js` — the museum floor: walls, cover, loot, patrols, cameras.
- `game/src/guards.js` — patrols, vision cones, suspicion and the hunt.
- `game/src/cameras.js` — sweeping camera cones and the EMP blackout.
- `game/src/thief.js` — movement, wall sliding and the disguise timer.
- `game/src/world.js` — the rules: alarm, loot, tools, caught and getaway.
- `game/src/render.js` — drawing only.
- `game/src/input.js` — keyboard and click-to-move.
- `game/src/shots.js` — the staged screenshot scenes (`?shot=title|play|caught|win`).
- `game/src/main.js` — boot and the fixed-step loop.
- `game/src/random.js` — the seeded RNG that makes scenes repeatable.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json` with the vendored make.fun library.
