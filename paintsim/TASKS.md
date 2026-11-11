# PaintSim — tasks

Goal: a reusable paint simulator. Any model, any picture: paint is data, brushes are data, the engine is a library.

## This round: materials as data + swatch page
- [x] Engine as a standalone library (`paintsim.js`), independent of the magpie
- [x] Generalised surface: gloss + sharpness, metal tinted by its own colour, flake/sheen slots
- [x] Procedural weathering inside a material (mottle, cracks, chips, pits, specks, scratches)
- [x] Grounds as data (vellum, paper, canvas, panel)
- [x] Brush presets as data (round, flat, dry, fan, knife, pen, nib, spray…)
- [x] Material recipes (media, metals, sparkle, wasteland/aged)
- [x] Swatch page: every material with every brush under one lamp; recipe editor; lamp control
- [x] README (API + recipe fields) and standalone build
- [x] Tuning pass on the swatch page (bends, fills, powders, metals, pearl, oil slick, cockle moved to the ground)

## Round 2: real pigment mixing
- [x] Compare models on real pigment pairs (RGB lerp, Kubelka–Munk on 3 / 8 / 16 / 36 bands) → 16 spectral bands
- [x] Mixing core in the engine; colours as mixes by parts (`{mix:{…}}`, `PaintSim.mix`)
- [x] Two-tone brushes, pick-up from wet paint and fills mix as pigment
- [x] Stains absorb by thickness (deeper with every coat)
- [x] Pigment scatter and tinting strength as data
- [x] Mixing chart on the swatch page; README

## Round 3: wet in wet
- [x] Water layer: water media lay down water, and a share of their pigment stays afloat
- [x] `flow(t)` / `dry()`: water levels out and carries pigment, pigment spreads and settles, rims and backruns form
- [x] Clean water as a material; colour travels only where it is wet
- [x] Oil: `merge` into wet paint, pick-up with a brush that refills, `blender` and `finger` brushes
- [x] Wet-in-wet chart on the swatch page; README

## Round 4: lighting set-ups
- [x] Up to four lamps: direction, strength, colour; ambient lamps; a pool of light that falls off
- [x] Exposure, and a shoulder that rolls highlights off instead of clipping
- [x] Seven set-ups as data (`raking`, `studio`, `flat`, `window`, `two lamps`, `gallery`, `candle`); `defineLight`, lint
- [x] Lighting chart and Light menu on the swatch page; README
- [x] Default light checked against the old engine: same picture (3 bytes differ by 1)

## Round 5: a painting as data
- [x] Engine runs without a browser: its own polygon rasteriser (exact area), no canvas needed; `surface.pixels`
- [x] A surface can carry recipes of its own (`define`), invisible to other surfaces
- [x] The format (`paintsim: 1`): page, ground, light, own recipes, named shapes, steps, groups with shared fields, stages
- [x] `PaintSim.check` (says what is wrong and where, with "did you mean"), `PaintSim.open` (player), `PaintSim.render`
- [x] `tools/render.mjs` (JSON in, PNG out), `play.html` (watch, stop after a stage, relight, save), sample painting
- [x] `tools/test.mjs`: 11 headless tests; browser and Node give the same fingerprint for the sample

## Round 6: acceptance — the magpie, repainted with the library
- [x] A lens for lighting set-ups (`lens`: focus, depth, blur, vignette, contrast, grain) and a `macro` set-up; `render()` applies it, `flush()` does not
- [x] `paintings/magpie.gen.mjs` composes the picture (from the text prompt and my own earlier composition; the reference photo was not used) and writes `paintings/magpie.json`: about 11,000 marks, 18 stages, one mark to a line
- [x] Page: vellum, ruled and written text column, gold bar on raised gesso, border sprays with gilded leaves
- [x] Bird: underdrawing, wet first washes, thick whites, flight feathers, black plumage, scapulars, bill, eye, legs, pen work
- [x] Gloss as a clear medium with interference flakes over the black, instead of coloured paint
- [x] The nib: leaf on a high round cushion, slit, breather hole, wet ink on the point
- [x] `tools/render.mjs --crop` for close looks; `magpie.standalone.html` from `build.mjs`
- [x] Found and fixed on the way: a stroke's accidents depended on the scale (each stroke now has a random stream of its own; test added); sprays were about `scale²` denser at a larger scale (now per page area; `spray` density recalibrated to look the same at 2×; test added)
- [x] Checked: 12 headless tests pass; browser and Node give the same fingerprint for the magpie at 2×; the standalone page loads nothing else

## Round 7: more paintings, and the tasks
- [x] Five oil paintings: `birches`, `harbour`, `rain`, `peonies`, `lemons` (the last four by separate agents from a long brief)
- [x] `GUIDE.md`, from what those agents had to find out for themselves; `paintings/starter.gen.mjs`
- [x] `bench/`: the five prompts, the task text, the kit builder
- [x] One run from the task text alone (harbour): sound document, engine untouched; see `bench/runs/harbour-short-task/`
- [ ] The same for a hard subject (peonies or lemons), and harbour a second time, to see the spread
- [ ] A scoring procedure; held-out prompts that are not in this repository; a sandbox, so that a run cannot read outside its kit
- [ ] Smaller preview images for the README (the PNGs are 7 to 9 MB each)

## Reported by the painting agents (not yet acted on)
- [ ] `tools/render.mjs --crop` paints the whole picture and prints the fingerprint of the whole picture, not of the file it writes
- [ ] `PaintSim.mix` / `PaintSim.color` accept a value that is not a colour and return near-black or NaN without an error
- [ ] `check` reports a NaN coordinate as "point N is not [x, y]"
- [ ] The README does not list `PaintSim.util` (`arc`, `spline`, `fbm`, …) or say which side `grad` puts `color2` on
- [ ] Thickness does not build up layer on layer (`HT` is replaced, not added to)
- [ ] `varnish` flattens relief visibly even when thin
- [ ] Techniques that each agent wrote for itself and that belong in a library: reflections in water (mirror sampler, broken slabs, wavering mast lines, glitter path); a one-point-perspective street with a field of reflected lights; a halo round a lamp; a turned vessel (surface of revolution) with decoration mapped onto it; cloth from fold curves; an ellipsoid painter; a 3-D ribbon (peel); a flower head built from cupped petals; a folded leaf; a value-only preview without painting; a separate random stream for each part of a generator

## Found on the way (not scheduled)
- [ ] A lens with a tilted focal plane (today: blur by distance from one point)
- [ ] Soft-edged clip in a painting document (today a clip is a hard shape; the magpie lifts strokes at the edge instead)
- [ ] The magpie's document is 1.3 MB; macros (below) or per-stroke defaults would shrink it
- [ ] Thin-film colour order for `oil slick` (it cycles the plain hue wheel today)
- [ ] A film model that makes stain and body one continuum (hiding from scatter and thickness)
- [ ] Water that creeps onto dry paper and runs downhill (tilted board, drips)
- [ ] Lifting: wetting dry watercolour again and taking colour off
- [ ] Faster flow for whole-sheet washes (4 s for 1000 × 1000 units today)
- [ ] `fan` and `mop` brushes exist as recipes but are not shown on the swatch page
- [ ] Lighting in physical (linear) light, and lamps whose direction changes across the picture
- [ ] Techniques as macros in a painting (hatch a shape, scatter marks) so that a painting written by hand stays short
- [ ] A recorder: turn calls to the code API into a painting document
- [ ] Clip for dots
