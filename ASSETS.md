# ASSETS.md

Every asset in WYRMLIGHT is either procedurally generated at runtime or bundled from an
npm-distributed open-font package. Nothing is hotlinked; the production build is fully
self-contained.

## Fonts (the only external assets)

| Asset | Source | License | Use |
|---|---|---|---|
| **Cinzel** (weights 600–900) | [`@fontsource/cinzel`](https://www.npmjs.com/package/@fontsource/cinzel) (npm), upstream: [Google Fonts — Cinzel](https://fonts.google.com/specimen/Cinzel) by Natanael Gama | SIL Open Font License 1.1 | Display type: title wordmark, hour banners, headings, score numerals |
| **Alegreya Sans** (400/500/700) | [`@fontsource/alegreya-sans`](https://www.npmjs.com/package/@fontsource/alegreya-sans) (npm), upstream: [Google Fonts — Alegreya Sans](https://fonts.google.com/specimen/Alegreya+Sans) by Juan Pablo del Peral / Huerta Tipográfica | SIL Open Font License 1.1 | Body/UI text |
| **Alegreya Sans SC** (500/700) | [`@fontsource/alegreya-sans-sc`](https://www.npmjs.com/package/@fontsource/alegreya-sans-sc) (npm), same upstream | SIL Open Font License 1.1 | Small-caps HUD labels, toasts, stat captions |

The OFL permits bundling and redistribution; full license texts ship inside each package
(`node_modules/@fontsource/*/LICENSE`) and are copied into `dist/` font assets at build time.

## Procedural / code-generated assets

| Asset | How it's made | Where |
|---|---|---|
| Serpent plates, head, enemies, motes, star, decoy | Drawn once to offscreen canvases (2× supersampled) at runtime — gradients, paths, glow sprites | `src/sprites.ts` |
| Starfield & nebulae backdrop | Random-scatter render to an offscreen canvas at boot | `src/render.ts` |
| Light/void full-screen gradients | Pre-rendered radial textures, scaled per frame | `src/render.ts` |
| Particles, beams, lightning arcs, shells | Immediate-mode canvas drawing | `src/particles.ts`, `src/render.ts` |
| **All sound effects** | Web Audio synthesis (oscillators, filtered noise bursts, bell partials) — no samples | `src/audio.ts` |
| **Music** | Generative score: D-minor drone + pad progression + probabilistic pentatonic plucks; layer volumes/density driven by game intensity; shifts to D-major for the dawn | `src/audio.ts` |
| Favicon & cursor | Hand-authored inline SVG data URIs | `index.html`, `src/style.css` |

No AI-generated image/audio assets were used. No copyrighted characters, trademarks, or
third-party game assets are included.
