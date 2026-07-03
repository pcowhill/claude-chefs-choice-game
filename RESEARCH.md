# RESEARCH.md — concept selection & research notes

A short research pass was done before building, per the brief. This file records what was
considered, what was found, and why the final concept was chosen.

## Brainstorm (candidates considered)

| # | Concept | Why rejected / accepted |
|---|---------|-------------------------|
| 1 | Time-rewind bullet hell | Done often (Braid-likes); rewind is expensive to make legible in one shot |
| 2 | Echolocation stealth (ping reveals world, but attracts hunters) | Gorgeous but slow-paced; fun factor risky; *Dark Echo* already owns the space |
| 3 | Missile-Command roguelite | Solid but the twist is weak — mostly "Missile Command with upgrades" |
| 4 | Pinball/pachinko roguelike | *Peglin* exists; physics tuning is the whole game and hard to nail blind |
| 5 | Reverse bullet-hell (Vampire-Survivors-like) | The genre is saturated; would read as a generic clone |
| 6 | **Snake × Tower Defense — your body IS the tower layout** | **Accepted** — see below |

## Why concept 6 won

- **Legible**: everyone already knows Snake and tower defense. Zero rules friction.
- **Surprising core mechanic**: movement *is* tower placement. Steering your body is
  simultaneously dodging, walling, drafting (you choose which typed mote to eat), and aiming.
- **Rich interactions fall out naturally**: length = firepower but also exposure and turning
  clumsiness; coiling concentrates fire but invites artillery; straightening merges beam
  segments but thins your wall. Risk/reward is baked into the fantasy itself.
- **Feasible to polish in one shot**: circle collisions, no physics engine, single-screen
  arena, procedural art/audio — effort goes into game feel instead of asset pipelines.

## Prior art check (honesty section)

A web search for the mashup found **The Snake Is the Tower** (Happy Distraction Studio, 2025,
Steam/web) — an *incremental* snake-TD where adjacent matching segments merge and numbers grow.
So the raw genre mashup exists. This game deliberately goes a different direction:

- **Protect-the-base spatial defense**: a central Star with HP is the objective; enemies gnaw
  through your segments to reach it, so your coil is literally a living fortification you
  rotate to present healthy armor. (Not present in the incremental game.)
- **Body geometry as a weapon**: Prism segments fire beams perpendicular to your spine —
  straighten your body for a parallel broadside, coil for a radial "sun wheel", and prisms
  aligned within a tolerance merge into an amplified beam. Your *shape* is your aim.
- **Molt**: an active ability that sheds your last three segments as a taunting decoy bomb —
  converting growth (power) into burst defense. Growth becomes a spendable resource.
- **Run structure**: 12 "hours of night" with a tarot-style draft between hours, two bosses,
  a dawn victory, and an optional endless mode — a 15-minute arc rather than an incremental loop.

Other relevant prior art: *Snake* (1976 lineage), slither.io (smooth mouse steering — adopted),
Vampire Survivors (auto-fire + draft cadence — adopted for the between-hour draft).

## Game-feel references

Applied throughout, from the well-known canon of "juice" talks — Jan Willem Nijman's
"The Art of Screenshake" and Martin Jonasson & Petri Purho's "Juice it or lose it":
screen shake with squared trauma falloff, hit-stop on big moments, hit-flash, muzzle pops,
death bursts, trails, floating banners, palette-wide light response (the whole arena is lit
by the Star's remaining HP).

## Asset sources considered

| Source | License | Decision |
|--------|---------|----------|
| Kenney.nl packs (sprites/audio) | CC0 | Not used — bitmap sprites would fight the vector-glow art direction |
| OpenGameArt music loops | varies (CC0/CC-BY) | Not used — generative WebAudio score fits the "night intensifies" design better and carries zero license risk |
| freesound.org SFX | varies | Not used — synthesized SFX match the art direction and can be pitch-varied per event |
| Google Fonts via Fontsource npm packages | SIL OFL 1.1 | **Used** — Cinzel (display) + Alegreya Sans / SC (UI); bundled locally through npm, no hotlinking |

Everything else (serpent, enemies, star, particles, backdrop, music, SFX) is procedural —
drawn to offscreen canvases or synthesized with the Web Audio API at runtime. See `ASSETS.md`.

## Rendering tech decision

Considered PixiJS v8 (WebGL batching + bloom filters) and Phaser 3. Chose **hand-rolled
Canvas 2D**: entity counts are modest (≤ ~150 enemies, ~300 projectiles, pooled particles),
additive compositing + pre-rendered radial-gradient glow sprites give the bloom look without
WebGL, there is no framework API-version risk, and headless-Chromium screenshot verification
is fully deterministic with Canvas 2D. Vite + strict TypeScript for the toolchain; the only
runtime dependencies are the two OFL font packages.

## Search links that informed the above

- https://store.steampowered.com/app/2957070/The_Snake_Is_the_Tower/ (prior art)
- https://itch.io/games/in-jam/tag-tower-defense (jam TD landscape scan)
- Name-collision checks: "Starwyrm" is used by a 2019 jam game, a 5e supplement, and an
  Age of Sigmar creature — rejected. **"Wyrmlight"** had no game collisions — accepted.
