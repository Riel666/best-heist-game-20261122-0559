# best-heist-game-20261122-0559

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Riel666/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Riel666/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

Gilded Vault — a top-down heist game. Slip through three floors of the Meridian Bank at night past patrolling guards and sweeping cameras, crack the vault, and get out before the getaway van leaves. Every loot bag you carry slows you down, so plan the route: EMP the cameras, smoke the cones, toss a coin to pull a guard away, hack the keycard terminals, and time the laser grids.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Validation

Local runs (twice, fresh output dirs) wrote identical bytes:

`node main.ts` with `MAKEFUN_OUTPUT_DIR` set copies `game/` and `screenshots/` and writes `dossier.json` (346,945 bytes). Screenshots are real renders of the game in headless Chromium at 1280x800: `1-cover.jpg` (65,081 bytes), `2-alarm.jpg` (71,092 bytes), `3-victory.jpg` (67,497 bytes) — each under the 256 KiB cap.

Headless play-tests with the real rules: `?selftest=1` clears floor 1 in 0:13 with no alarm raised (score 1836); `?selftest=alarm` raises the alarm and gets caught at 0:33. Node smoke tests of the pure logic (levels, BFS paths, vision cones, laser timing, guard patrol/investigate/chase/search) all pass.

## Play

Move with WASD or the arrow keys, or click a spot to walk there. Hold Shift to sneak — slower, but much harder to spot. `1` EMP (kills cameras for a few seconds), `2` smoke pellet (blocks all sight around you), `3` or right-click tosses a coin to distract a guard. `E` (hold) hacks a keycard terminal. `Q` drops a loot bag when you need to run light. Grab the vault gold first — the van only waits so long. `R` retries a floor, `M` toggles sound.
