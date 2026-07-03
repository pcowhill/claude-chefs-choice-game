# DELIVERY_NOTES.md

## Final concept

**WYRMLIGHT** — a snake × tower-defense arcade game. You are a celestial serpent defending
the last Star through the twelve hours of night. Every body segment is an auto-firing turret;
your movement is simultaneously dodging, wall-building (enemies gnaw through your coils to
reach the Star), drafting (you grow by eating typed starlight motes), and aiming (prism
segments fire perpendicular to your spine and merge when aligned). Active abilities: Surge
(speed burst + ram) and Molt (shed tail segments as a taunting decoy bomb). Two bosses
(Hour VI: The Maw, Hour XII: The Eclipse), a boon draft between hours, victory at dawn, then
an optional Endless Night. Score, stats, and local best records close the loop.

Concept rationale and prior-art check: `RESEARCH.md`. Asset provenance: `ASSETS.md`.

## Implementation summary

- **Stack**: Vite 6 + TypeScript (strict). Hand-rolled Canvas 2D renderer (pre-rendered
  supersampled glow sprites, additive compositing, cached full-screen light/void textures).
  DOM overlays (styled with bundled OFL fonts) for HUD, title/help/pause/draft/end screens.
  Web Audio for synthesized SFX and a generative intensity-driven score. No backend; the only
  runtime deps are three Fontsource font packages.
- **Structure** (~4.9k lines TS/CSS): `config.ts` (all tuning), `types.ts` (state model),
  engine (`util`, `input`, `sprites`, `audio`, `particles`), systems (`serpent`, `turrets`,
  `enemies`, `bullets`, `motes`, `star`, `waves`, `draft`), presentation (`render`, `hud`,
  `screens`, `style.css`), `main.ts` (fixed-timestep loop + state machine), `debug.ts`
  (QA hooks + the autopilot that also drives the title-screen attract demo).
- **Game content**: 5 turret types with tiering and cross-synergies, 5 regular enemies + 2
  scripted bosses, 12 authored hours + endless scaling, 20 draft cards in 3 rarities, 7
  contextual tutorial toasts, hit-stop/screenshake/particle juice, dawn & nightfall endings
  with stat breakdowns.

## Verification checklist

| Check | Result |
|---|---|
| `npm install` | ✅ clean |
| `npm run build` (tsc + vite) | ✅ clean |
| `npm run typecheck` | ✅ clean |
| Dev server boots, first screen not blank | ✅ (canvas ink check ≈ 95% lit) |
| Title → help → gameplay flow | ✅ headless Playwright |
| Hour banner, tutorial toasts | ✅ screenshot-verified |
| Draft appears, card picks (click + keys) | ✅ |
| Boss fight (Maw) with boss HP bar | ✅ |
| Pause / resume / auto-pause on tab-hide | ✅ (Esc flow screenshot-verified) |
| Victory: dawn cinematic → stats → NEW BEST → endless | ✅ (after fixing an end-cause bug found by this test) |
| Endless continuation (HOUR XII+1) | ✅ |
| Defeat: nightfall → stats | ✅ |
| Play-again restarts cleanly | ✅ |
| Full campaign soak, autopilot at 4×, hours I–XII unskipped | ✅ zero errors; bot victory with 33/100 star, 1 heart — intended knife-edge curve |
| Production build, no debug flags, real mouse+keyboard input, 1512×982 laptop viewport | ✅ |
| Console/page errors across all of the above | ✅ none |
| Local records persistence (best/dawns/nights) | ✅ observed across runs in-session |

## Known issues / limitations

- **Audio is unheard in CI** — headless verification proves the synth graph runs without
  errors, but mix levels were set by construction, not by ear.
- **Balance is autopilot-tuned.** The bot is a mediocre player by design; humans should find
  a first win hard-but-reachable. Numbers all live in `src/config.ts` for easy retuning.
- Desktop-only by design (no touch); needs an ES2022 browser with Web Audio.
- The QA autopilot (`?bot=1`) plays legitimately but does not showcase molt walls or deliberate
  prism alignment — human play looks better than bot play.

## Branch / commits

- Branch: `claude/browser-game-oneshot-wnguuw`
- Implementation commit: `d44f11d`; verification/polish + docs: `2b60f78`; this file lands in
  the final delivery commit on the branch (HEAD).
