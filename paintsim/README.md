# PaintSim

A small physical paint simulator for the browser and for Node. No dependencies, three script files.

A stroke is a bundle of bristles. Each bristle carries its own colour and load, lays down pigment **and thickness**, breaks up on the tooth of the ground, runs dry, and can drag wet colour along. The finished relief is then photographed under a raking lamp, so ridges, leaf and flakes catch the light.

**Paint is data.** A paint, a brush and a ground are each a small JSON-able recipe. The engine knows nothing about any particular picture.

**A painting is data too.** One JSON document — page, ground, light, its own recipes, and a list of steps — gives the same picture, pixel for pixel, in the browser and from the command line.

**Colours mix as pigments.** Blue and yellow make green, a little white goes a long way, complements make a dark neutral, and a glaze deepens with every coat.

**Wet paint behaves wet.** A wash blooms on wet paper and keeps its edge on dry paper, wet colours run into each other, and a drop of water makes a backrun. Oil laid into wet oil mixes with it, and a clean brush blends it.

| File | What it is |
|---|---|
| `paintsim.js` | the engine (`PaintSim` global); runs in a browser and in Node |
| `paintsim.recipes.js` | the palette: 40 paints and clean water, 14 brushes, 7 grounds, 31 pigments, 8 lighting set-ups — all data |
| `paintsim.painting.js` | a whole painting as one JSON document: check it, paint it step by step, render it |
| `paintings/hills.json` | a small sample painting, written by hand |
| `paintings/magpie.json` | a large one: a magpie in the margin of a manuscript page, about 11,000 marks in 18 stages (see [The magpie](#the-magpie)) |
| `paintings/magpie.gen.mjs` | `node paintings/magpie.gen.mjs` — the program that composed the magpie and wrote that document |
| `play.html` | the player: watch a painting being painted, stop after any stage, change light and size, save a PNG |
| `tools/render.mjs` | `node tools/render.mjs painting.json out.png` — paints without a browser |
| `tools/test.mjs` | `node tools/test.mjs` — the tests |
| `swatches.html` | every paint × every brush under one lamp, with a live recipe editor |
| `example.html` | the quick start below as a page |
| `build.mjs` | `node build.mjs` checks every recipe and painting, then writes `swatches.standalone.html`, `play.standalone.html` and `magpie.standalone.html` (one file each, open anywhere) |
| `tools/spectral.mjs` | prints the spectral tables that the engine mixes with (only needed to change them) |

## Quick start

```html
<canvas id="c"></canvas>
<script src="paintsim.js"></script>
<script src="paintsim.recipes.js"></script>
<script>
  const s = PaintSim.create({canvas: document.getElementById('c'), width: 400, height: 300, scale: 2, ground: 'toned panel', seed: 7});
  s.fill({material: 'gold leaf', shape: [[40,40],[160,40],[160,120],[40,120]]});
  s.paint({material: 'oil', brush: 'flat', width: 30, path: [[30,200],[200,180],[370,210]]});
  s.paint({material: {base: 'oil', color: {mix: {ultramarine: 1, 'cadmium yellow': 2}}}, brush: 'round', width: 22, path: [[60,262],[200,232],[340,268]]});
  s.paint({material: 'iron gall ink', brush: 'pen', path: [[200,60],[240,90],[280,50],[330,95]]});
  s.render();
</script>
```

Units are **page units**: the surface is `width` × `height` units and `scale` pixels per unit. Every length in a command or recipe is in page units, so the same picture renders at any resolution by changing `scale` only.

Everything is deterministic: the same `seed` and the same commands give the same picture. At another `scale` it is the same picture too, down to which streaks a stroke has and where it breaks, because every stroke draws its accidents from a random stream of its own.

## A painting as data

The code API below paints one touch at a time. A **painting** is the layer above it: everything needed to make a picture, written down as JSON.

```json
{
  "paintsim": 1,
  "title": "Three marks",
  "size": [200, 120],
  "ground": "toned panel",
  "steps": [
    {"name": "wash", "do": [
      {"shape": {"rect": [20, 20, 180, 100]}, "material": "watercolour", "color": "cerulean"},
      {"dry": true}
    ]},
    {"name": "marks", "with": {"material": "oil", "brush": "flat", "width": 14}, "do": [
      {"path": [[30, 40], [100, 34], [170, 42]], "color": "cadmium red"},
      {"path": [[30, 80], [100, 74], [170, 82]], "color": {"mix": {"ultramarine": 1, "cadmium yellow": 2}}}
    ]},
    {"name": "sun", "shape": {"circle": [150, 60, 12]}, "material": "gold leaf"}
  ]
}
```

```bash
node tools/render.mjs painting.json out.png --scale 2
```

```js
const problems = PaintSim.check(painting);                      // [] when it is sound
const surface  = PaintSim.render(painting, {canvas, scale: 2}); // paint all of it
const player   = PaintSim.open(painting, {canvas, scale: 2});   // or step by step:
while (player.runFor(15)) { player.surface.flush(); await nextFrame(); }
```

Or open `play.html?doc=painting.json`.

### The document

| Field | |
|---|---|
| `paintsim` | `1` — the version of this format. Required |
| `size` | `[width, height]` in page units. Required. Pixels are chosen when rendering (`scale`), never in the painting |
| `steps` | what is painted, in order. Required |
| `ground` | name or recipe of the support; default `vellum` |
| `light` | name or recipe of the lighting; default `raking`. The renderer may override it |
| `seed` | a number; the same painting with another seed has the same strokes and other accidents |
| `define` | recipes the painting brings along: `{pigments, materials, brushes, grounds, lights}`, each `{name: recipe}`. They exist only inside this painting, and may build on a shared recipe of the same name |
| `shapes` | `{name: shape}` — outlines to fill and to clip by |
| `title`, `note`, `engine` | text for people; `engine` is the PaintSim version it was made with |

### Steps

A step is an object that does **one** thing. Which thing is decided by the key it has:

| Key | What it does | Other fields |
|---|---|---|
| `path` | one stroke along `[[x, y], …]` | everything `surface.paint()` takes: `material`, `brush`, `width`, `pressure` (a name or a list of numbers), `press`, `color`, `color2`, `opacity`, `grad`, `load`, `wobble`, `tone2`, `spline`, `seg`, `clip`, `opts` |
| `paths` | several strokes with the same settings: a list of paths | the same |
| `shape` | fills a shape | `material`, `color`, `color2`, `opacity`, `soft`, `uneven`, `scale`, `angle`, `cushion`, `clip` |
| `at` | one dot at `[x, y]` | `r` (required), `material`, `color`, `opacity`, `soft`, `dome` |
| `dots` | several dots: `[[x, y], …]` or `[[x, y, r], …]` | the same |
| `flow` | time passes for wet washes: a number, 1 ≈ a wet sheet drying | |
| `dry` | `true` lets everything finish and dry · a number 0–1 dries part-way · `"still"` dries at once with no movement | |
| `do` | a **group**: a list of steps | `with`: fields shared by every step inside |

Any step may also have `name`, `note` (for people; ignored), `hide: true` (skip it) and `seed`.

**Groups and stages.** Fields in a group's `with` are handed down to the steps inside; a step's own fields win, and `null` removes one. A field that a step cannot use is ignored for that step, so one group can hold strokes and fills that share a material. Each step at the top level is a **stage**, with its `name`; the player can stop after any of them. Every stage starts from its own random seed, so changing one stage leaves the accidents of the others alone.

**Shapes.** A shape is a polygon `[[x, y], …]`, a list of shapes, a name from `shapes`, or one of:

| | |
|---|---|
| `{"rect": [x0, y0, x1, y1]}` | |
| `{"circle": [cx, cy, r]}` | |
| `{"ellipse": [cx, cy, rx, ry, degrees]}` | `degrees` is optional |
| `{"curve": [[x, y], …]}` | a smooth closed outline through the points — a few points make an organic shape |

`clip` takes a shape too: the stroke or fill lands only inside it. A shape may reach beyond the page.

**When it ends.** After the last step the painting is left to dry, as if `{"dry": true}` came last.

### Checking

`PaintSim.check(painting)` lists everything that is wrong and where: `steps[3].do[1].material: unknown material "oli" (did you mean "oil"?)`. It checks every field name, colour, recipe, shape and number, so a painting that passes will paint. `PaintSim.open` and `PaintSim.render` refuse a painting that does not pass. `node tools/render.mjs painting.json --check` does the same from the command line.

### The player and the renderer

`PaintSim.open(painting, options)` returns a player. Options: `canvas`, `scale` (default 2), `light` (overrides the painting's), `upTo` (a stage name or number: stop after it).

| | |
|---|---|
| `player.next()` | paints one step; `false` when there are no more |
| `player.run(n)`, `player.runFor(ms)` | several steps; `true` while steps remain |
| `player.finish()` | all the rest; returns the surface |
| `player.surface` | the surface, for `flush()`, `render()`, `light()`, `pixels` |
| `player.at`, `.total`, `.done`, `.stage`, `.stages` | where it is: `stages` is `[{name, from, to}]` |

`node tools/render.mjs painting.json [out.png] [--scale 2] [--light window] [--upto "stage name"] [--crop x0,y0,x1,y1]` needs nothing but Node. It prints a fingerprint of the pixels; the browser gives the same one. `--crop` writes only a part of the picture (in page units); with a large `--scale` that is a close look at a detail.

### Writing a painting

- Work from back to front and from thin to thick, as on paper: washes, then body colour, then line and leaf.
- Put `{"dry": true}` between layers that should not run together. Leave it out between washes that should.
- One unit is a small thing: a hairline is 1–2 units wide, a broad brush 30–40, a page 400–1000 across.
- A path of 3 or more points is drawn as a smooth curve. Give `"spline": false` for corners.
- Define each colour once under `define.materials` and use its name; mix pigments by parts.
- `PaintSim.check` after every change.
- A picture with thousands of marks is written by a program. `paintings/magpie.gen.mjs` is one: it composes the picture and writes plain steps, and the document it writes does not need it afterwards.

## The surface

`PaintSim.create(options)` → a surface.

| Option | Default | |
|---|---|---|
| `canvas` | a new canvas | where the picture is drawn |
| `width`, `height` | 1000, = width | size in page units |
| `scale` | 2 | pixels per unit |
| `ground` | `'vellum'` | name or recipe of the support |
| `seed` | 1 | seed of the surface's random numbers |
| `define` | none | recipes of this surface's own: `{pigments, materials, brushes, grounds, lights}`. They come before the shared ones and are not visible elsewhere |
| `light` | `'raking'` | a lighting set-up: a name or a recipe |

### Painting

**`surface.paint(cmd)`** — one stroke of a material with a brush.

| Field | |
|---|---|
| `material` | name, or a recipe (`{base:'oil', color:'viridian'}` is the usual way to change a colour; naming `color` without `color2` gives a single tone) |
| `brush` | name or recipe; default `'round'` |
| `path` | `[[x,y], …]`, at least two points (a spray brush also takes one: a puff held in place). 3–39 points are smoothed into a curve (`spline:false` keeps the corners; `seg` sets the subdivision) |
| `width` | overrides the brush's width |
| `pressure` | pressure along the stroke: a profile name, a function `t → 0…1`, or an array of numbers |
| `press` | overall pressure multiplier |
| `color`, `color2` | override the recipe's colours |
| `opacity` | overrides the recipe's opacity |
| `grad` | 0–1: sort the two tones from one side of the brush to the other (a double-loaded brush) |
| `load` | how far this stroke travels before it runs out |
| `wobble` | overrides the brush's wobble |
| `tone2` | darkens (negative) or lightens the stroke toward its end |
| `clip` | a mask from `surface.polyMask(polygons)`: the stroke lands only inside it (`fill` takes one too) |
| `opts` | raw engine options; these override everything (see `stroke()` in the source) |

**`surface.fill(cmd)`** — a material laid over a whole shape: flat colour, a wash, leaf on a raised cushion.
`material`, `shape` (one polygon or a list of polygons), `soft` (edge softness), `opacity`, `uneven`, `scale` (size of the cloudiness, default 50), `color`, `angle` (direction it is brushed in, radians, default −0.2), `cushion` (`{height, round}` or `null`).

**`surface.dot(cmd)`** — a round touch: `material`, `at: [x,y]`, `r`, `color`, `opacity`, `soft`, `dome` (extra height in the middle: a raised bead).

**`surface.flow(t = 1)`** — lets time pass: wet washes move (see *Wet in wet*). `t = 1` is about the time a sheet wetted with clean water takes to dry.

**`surface.dry(amount = 1, still = false)`** — lets the washes finish moving, then dries everything. Dry paint is no longer picked up, merged into, blended or smudged. `dry(1, true)` dries at once, with no movement.

**`surface.ground(g)`** — a fresh support. This clears the surface.

**`surface.stroke(points, o)`**, **`surface.spray(points, o)`** — the low-level calls that `paint()` fills in from a material and a brush.

### Seeing it

- **`surface.render()`** — light the whole surface and draw it.
- **`surface.flush(maxTiles)`** — relight only the 64-pixel tiles that changed; returns how many it did. Use it to show a painting as it is made.
- **`surface.light(setup)`**, **`surface.getLight()`** — the lighting. Changing it costs one `render()`, not a repaint.

`surface.light('window')` switches to a named set-up. `surface.light({elevation: 12})` changes single values of the current one; `azimuth` and `elevation` move its main lamp.

| Set-up | |
|---|---|
| `raking` | the default: one lamp low on the upper left, so every ridge shows |
| `studio` | two lamps at 45° either side, as on a copy stand: even, little shadow |
| `flat` | no direction at all, like a scanner: colour only |
| `window` | cool daylight from the left, warm room light filling in |
| `two lamps` | a warm lamp from the upper left and a weaker cool one from the right |
| `gallery` | a spotlight from above that leaves the corners darker |
| `candle` | one small warm flame at the lower left; the far side falls into dusk |
| `macro` | the default lamp seen through a close-up lens: sharp in the middle, soft toward the edges, darker corners |

A set-up is data, like a paint: `PaintSim.defineLight('north light', {base: 'window', lamps: […]})`.

| Field | Default | |
|---|---|---|
| `azimuth` | 230 | where the main lamp stands, in degrees: 0 right, 90 below, 180 left, 270 above (230 = upper left) |
| `elevation` | 30 | its height above the surface; low = raking light, long shadows |
| `relief` | 1.15 | how strongly the relief is read |
| `contrast` | 0.5 | strength of the shading on slopes |
| `cavity` | 0.08 | darkening in hollows |
| `shadow` | 0.2 | cast shadows |
| `softbox` | 0.35 | the broad soft light that gives gloss and metal their sheen |
| `cockle` | 1 | multiplies the ground's own `cockle` |
| `exposure` | 1 | scales the whole photograph |
| `shoulder` | 0 | 0 clips highlights to white; towards 1 they roll off softly, as on film |
| `lamps` | one lamp | up to four lamps, see below |

A lamp: `azimuth`, `elevation` · `strength` (all lamps together about 1) · `color` (its tint) · `ambient: true` (light from everywhere: colour, no relief, no shine) · `pool: {at: [x, y], radius}` (a lamp close by: brightest at `at`, given as 0–1 across and down the picture, falling off over `radius` picture-widths).

A set-up may also have a **lens**, for the look of a close-up photograph: `lens: {focus: [x, y], depth, blur, vignette, contrast, grain}`. `focus` is the sharpest point (0–1 across and down the picture; default the middle), `depth` how far from it the picture stays sharp (in picture-widths, default 0.3), `blur` the radius of the blur at the far corner (page units), `vignette` how much the corners darken, `contrast` a gentle S-curve, `grain` film grain. `render()` applies the lens; `flush()` does not, so a painting is watched sharp and photographed at the end.

### Other

- **`surface.save()`**, **`surface.restore(state)`** — keep and bring back the whole state (for example the bare ground).
- **`surface.random()`**, **`surface.reseed(n)`** — the surface's seeded random numbers.
- **`surface.forget()`** — drop compiled recipes and weathering masks (each mask keeps one byte per pixel).
- **`surface.polyMask(polygons, pad)`**, **`surface.blurMask(mask, radiusPx)`** — clip masks.
- **`surface.define(recipes)`** — add recipes of this surface's own.
- **`surface.pixels`** — the rendered picture as RGBA bytes (in Node there is no canvas, so this is the result).
- `surface.canvas`, `.ctx`, `.width`, `.height`, `.scale`, `.pxWidth`, `.pxHeight`, `.buffers` (the raw per-pixel state).

## Recipes

```js
PaintSim.define('lapis', {base: 'tempera', color: '#23408f', color2: '#3b5fc0', blend: .5, grain: .12, note: 'ground lapis in egg'});
PaintSim.defineBrush('scrubber', {base: 'dry', width: 40, rag: 12});
PaintSim.defineGround('grey board', {base: 'panel', color: '#8d8a84'});
```

`base` inherits everything from another recipe. `PaintSim.materials`, `.brushes`, `.grounds`, `.pigments` are the registries (plain objects). `PaintSim.material(nameOrRecipe)` returns the resolved recipe.

`PaintSim.lint(kind, nameOrRecipe)` (kind: `'material'`, `'brush'`, `'ground'`, `'pigment'`, `'light'`) returns a list of problems: unknown fields, colours, masks, profiles. The engine ignores a field it does not know, so lint a recipe that was written by hand or by a model. `node build.mjs` lints the whole palette.

### Colour and mixing

Anywhere a colour is expected you can give:

| Form | Example |
|---|---|
| hex | `'#1c2f8c'` |
| numbers 0–1 | `[0.11, 0.18, 0.55]` |
| a pigment name | `'ultramarine'` |
| **a mix, by parts** | `{mix: {ultramarine: 1, 'cadmium yellow': 2}}` |
| a mix with a mix inside | `{mix: [[{mix: {ultramarine: 1, 'cadmium yellow': 2}}, 3], ['titanium white', 1]]}` |
| a colour with its own pigment properties | `{color: '#0d5a4c', scatter: 0.08, strength: 2}` |

`PaintSim.mix(parts)` returns the mixed colour and `PaintSim.hex(colour)` writes any colour as hex.

A mix is worked out as paint, not as light: each colour gets a reflectance curve over 16 bands of the spectrum, the pigments' absorption and scattering are added up (Kubelka–Munk), and the result is turned back into a colour. The same mixing happens in three more places:

- **a brush loaded with two tones** (`color` and `color2`): the bristles between them carry true mixtures;
- **pick-up**: a brush dragged through wet paint takes some up and carries the mixture on;
- **stains** (watercolour, glaze, ink): a transparent layer absorbs by its thickness. `opacity` is its strength; two coats at 0.5 equal one at 1, and where more gathers (the drying rim) it goes deeper than the recipe's colour.

Opaque paint laid over other paint covers it, as before.

A pigment in `PaintSim.pigments` is a colour, or `{color, scatter, strength}`:

| Field | |
|---|---|
| `scatter` | how opaque the pigment is, 0–1 (titanium white 1, a transparent lake about 0.1). An opaque pigment carries its own lightness into a mix; a transparent one only tints. If it is not given it is guessed from how pale the colour is |
| `strength` | tinting strength: how far a little of it goes in a mix (1 is ordinary, prussian blue 2.5) |

### Wet in wet

**Water media** (`watercolour`, `ink`, `iron gall ink`, `gouache`, and any paint with `water`) lay down water as well as colour, and a share of the pigment stays afloat in it. Nothing moves until time passes: call `surface.flow(t)` or `surface.dry()`.

| What you do | What happens |
|---|---|
| a wash on dry paper | keeps a crisp edge; pigment gathers along it as it dries |
| `fill` or `paint` with `material: 'water'` first, then a wash | the wash blooms through the wet area and stops at its edge |
| a second colour into a wash that is still wet | it spreads into the first and mixes with it |
| two wet washes that touch | they run into each other; a gap of dry paper (2 units or more) keeps them apart |
| `flow(0.5)`, then drops of `'water'` into the damp wash | backruns: the water pushes the pigment out to a ring |
| `ink` on wet paper | a soft grey halo round the line |
| `dry()` between coats | a glaze: the next coat lies on top, crisp, and deepens the colour |

The wetter the surface, the further colour travels and the longer it takes to dry. Two calls with `'water'` make a deeper pool than one.

**Oil, enamel and chalk** do not flow. They are worked:

- `merge` — a touch laid into wet paint takes some of it in, as pigment, instead of lying cleanly on top. White into wet red goes pink.
- `pickup` — the brush also takes wet paint up and trails it; clean paint keeps coming down a loaded brush, so the trail fades.
- brush `'blender'` — a clean soft brush that carries no paint. It pulls wet paint about and softens the edge between two wet colours.
- brush `'finger'` — the same, small and firm, for smudging pastel and charcoal. Chalk stays workable until `dry()`, which acts as a fixative.

### A paint

| Field | Default | |
|---|---|---|
| `color`, `color2` | grey, none | the one or two tones loaded on the brush (any colour form above, mixes included) |
| `blend` | 0.5 | how strongly the two tones streak across the bristles |
| `opacity` | 0.95 | cover of one pass; for a stain, its strength |
| `mode` | `'body'` | `'body'` is opaque paint; `'stain'` is transparent and darkens what is beneath |
| `film` | 1 / 0 for stains | stains: how much of a surface film it leaves (0 sinks in like watercolour, 1 like varnish) |
| `body` | 0.5 | thickness of the film → relief. 1 is a thick oil stroke |
| `ridges`, `grain` | 0.15, 0.04 | tone variation between bristle clumps / between single hairs |
| `level` | 0 | 0 keeps every bristle furrow (oil) … 1 flows out flat (enamel) |
| `gloss`, `sharp` | 0.1, 0.4 | strength of the highlight; how tight it is (0 satin … 1 mirror) |
| `metal` | 0 | 0–1: reflects like metal, tinted by its own colour |
| `flake` | none | glitter and interference colour, see below |
| `dry` | 0.3 | how readily it breaks up on the tooth (dry brush). Near 1 it is a powder |
| `charge` | 1.15 | how full the brush is loaded (about 0.6 for chalk that only dusts the tooth) |
| `reach` | 0 | how far a loaded brush travels before it runs out; 0 = never |
| `open` | 0.2 | how wet the laid paint stays (0 dries at once … 1 stays workable) |
| `pickup` | 0 | how much wet paint beneath is taken up per unit travelled and mixed into what the brush carries |
| `merge` | 0 | laid into wet paint, how far it melts into it instead of lying on top |
| `water`, `flow` | 0, 0.6 with water | water media: how much water a touch brings (clean water is 1), and the share of its pigment that stays afloat |
| `bury` | 0.5 | how completely it hides the relief beneath (0 thin … 1 slab) |
| `rim`, `gran` | 0.5, 0.3 for stains | darker drying edge; pigment settling into the tooth |
| `uneven`, `soft` | — | for `fill()`: cloudiness of the layer; softness of its edge |
| `cushion` | none | `{height, round}`: `fill()` lays it on a raised bed (leaf on gesso) |
| `texture` | none | weathering, see below. With `base`, `addTexture` appends to the parent's list |
| `family`, `note` | | labels only (the swatch page groups by `family`) |

**Flakes** — `flake: {amount, hue, spread, chroma, size, sparkle, sheen, drift}`. `sparkle` is glitter: single flakes that flash. `sheen` is a smooth interference colour that drifts across the surface. `hue` is in degrees and `spread` is how far the flakes stray from it (1 = every hue). `size` is the flake size and `drift` the size of the sheen's colour patches, both in units.

**Weathering** — `texture` is a list of `{mask, …mask settings, …effects}`. Masks live in page space, so cracks and rust run unbroken under every stroke of the material.

| Mask | Settings | Looks like |
|---|---|---|
| `noise` | `scale`, `amount` (share of the area), `soft`, `stretch`, `angle` | patches: tarnish, bloom, chips |
| `ridge` | `scale`, `width` | thin wandering lines: scratches, hairline cracks, wrinkles |
| `cells` | `scale`, `width`, `warp` | a network of cracks: craquelure, dried mud |
| `speck` | `scale`, `amount`, `size` | pits and specks |
| `lines` | `scale`, `length`, `angle` | fine parallel marks: burnishing, brushed metal |
| `grain` | `scale` | fine all-over grain |
| `tooth` | — | the ground's own tooth |

All take `seed` (a different pattern of the same kind) and `invert`.

| Effect where the mask is 1 | |
|---|---|
| `color` (+ `mix`) | shifts the colour |
| `tone` | multiplies the colour (0.8 = darker) |
| `height` | raises (or, negative, sinks) the relief |
| `lip` | a raised rim along the mask's edge (cupped cracks, curling paint) |
| `gloss`, `sharp`, `metal`, `flake` | the new value there |
| `cover` | 0 = the paint is missing there (chips, peeling) |
| `signed: true` | `height` and `tone` swing both ways around the middle of the mask |

### A brush

`shape` `'round'` (width follows pressure) or `'flat'` · `width` · `profile` (pressure curve) · `clump` (width of a bristle clump) · `streak`, `jit`, `body`, `reach`, `pickup`, `opacity`, `charge` (multiply the paint's own) · `dry`, `level` (added to the paint's own) · `load` (the furthest so lightly loaded a brush can go) · `rag` (ragged ends) · `wobble` · `var` (pressure tremor) · `vary`, `varLen` (chatter along the stroke) · `taper` (0 = thick to the edge) · `edge` (ridge pushed up at the sides) · `gaps` (missing bristles) · `nib` (fixed pen angle, radians) · `bury` · `blend` (0–1: a brush that carries no paint and only moves what is wet).
`kind: 'spray'` throws droplets instead: `density`, `drop: [min, max]`.

Pressure profiles: `leaf`, `feather`, `taper`, `comma`, `hair`, `flat`, `pen`, `full`.

### A ground

`kind` `'vellum' | 'paper' | 'canvas' | 'panel'` · `color` · `tooth` (how strongly the texture catches light and dry paint) · `pitch` (canvas thread spacing) · `vary` (strength of the mottling) · `gloss` · `cockle` (how far the support is from flat; it moves the sheen about).

## The swatch page

Open `swatches.html` through any web server (or run `node build.mjs` and open `swatches.standalone.html` directly). Each row is one paint: flat brush, round brush, dry brush, knife, lines (liner, pen, nib), spray and spatter, fill. The black bars show covering power. Click a row to move the lamp over it, drag its values, or edit its recipe as JSON; **Copy recipe** gives a `PaintSim.define(…)` line to paste into `paintsim.recipes.js`. Below the paints, the **Mixing** chart shows palette mixes (with plain RGB averaging beside them for comparison), a double-loaded brush, colour dragged through wet paint, and glazes; the **Wet in wet** chart shows washes on dry and wet paper, colour dropped into a wash, backruns, ink on wet paper, oil into wet oil, blending and smudging; the **Lighting** chart shows one patch under every set-up, and the Light menu at the top relights the whole page; the last chart shows every pigment in eight media.

This page is where a paint is tuned. Add a recipe to `paintsim.recipes.js`, give it a `family`, and it appears.

## The magpie

The subject and its prompt come from a post by hallie iris ([@irisfIowers](https://x.com/irisfIowers/status/2119934629658370237)), whose image was made with Midjourney; that image was not copied. Here the model paints the picture itself.

`paintings/magpie.json` is the library used in earnest: *a magpie perched in the margin of a medieval manuscript page, holding a pen nib in its beak*. About 11,000 marks in 18 stages, 1.3 MB of JSON, painted in about 8 seconds at 2000 × 2000 pixels in Node.

```bash
node paintings/magpie.gen.mjs                                   # compose it again → paintings/magpie.json
node tools/render.mjs paintings/magpie.json magpie.png          # paint it
node tools/render.mjs paintings/magpie.json eye.png --scale 4 --crop 540,190,700,350   # a close look
```

Or open `play.html?doc=paintings/magpie.json`, or `magpie.standalone.html` with no server at all.

What it takes from the library:

| | |
|---|---|
| vellum | the `vellum` ground; stains and follicles in a waterless stain |
| the script | `iron gall ink` with a broad `nib` held at one angle; rubrics in body colour |
| gold | `gold leaf` on a raised `cushion` for the bar, the ivy leaves and the bezants; a nib of the same leaf on a higher, rounder cushion |
| first washes | `watercolour`, laid wet: indigo over a dry pale wash, running only where the page was wetted again with `water` |
| the whites | a thick lead white that stays open, dragged through its own shadows (`pickup`, `merge`) |
| the blacks | body colour with gloss, mixed from lamp black and prussian blue; dry-brushed where a feather should break |
| the gloss | a **clear medium full of interference flakes** (`mode: 'stain'`, white, `film: 1`, `flake`): it has no colour of its own, so the black stays black and turns blue-green only where the lamp finds it, more on the slopes that face the light |
| the eye, the ink drop | `enamel` dots with a `dome`: the shine on them is the lamp's; only the catchlight in the eye is painted |
| the photograph | the `raking` lamp and a `lens` focused on the bird, so the script at the edge of the page is out of focus |

Every colour in it is named in `define.pigments` as a mix of pigments by parts.

## Design choices

- **Recipes are plain data, not code.** Any model or tool can write, compare and store them. The cost is that a paint can only do what the engine's fixed set of properties and masks allows; the low-level `stroke()` options are the way out.
- **Page units, not pixels.** A picture is resolution-free. The cost is that very fine textures (grain near one unit) look different at very low `scale`.
- **The surface stores a fixed set of values per pixel** (colour, thickness, gloss, sharpness, metal, flake, wetness). It is fast and simple.
- **Mixing is spectral, storage is not.** Colours are mixed over 16 spectral bands with Kubelka–Munk, then stored as ordinary colour again. I compared this against mixing on the three RGB channels and against 8 and 36 bands: three channels turn pure blue and yellow into black, 8 bands give wrong hues for saturated colours, and 16 bands stay within 16/255 of 36 bands in the worst case (pure primaries) and are near identical for real pigments. Storing a full spectrum per pixel would be more exact where many layers mix, at five times the memory. The cost of the choice made: a colour's spectrum is rebuilt from its sRGB value every time it is mixed, so mixes are plausible paint, not a measured match of a real tube.

- **Washes flow on a coarse grid.** Water and floating pigment move on cells about 2 units wide, and each pixel then keeps the share of its own pigment that stayed and receives what arrived. This lets colour travel tens of units in a fraction of a second while edges, granulation and brush marks stay sharp. The cost: a dry gap narrower than 2 units may leak, and the finest feathering is made by the paper's noise, not computed.

- **A painting is a record, not a program.** The format has no loops, no variables and no arithmetic: every stroke is written out. That keeps it trivial to check, to cut at any stage, to diff and to hand from one tool to another. The cost is size: a thousand strokes are a thousand paths, so a painting of any ambition is written by a program (or a model writing a program), not by hand. Groups with shared fields, `paths`, `dots` and named shapes keep the writing-out compact.
- **The key says what a step does** (`path`, `shape`, `at`, …) instead of an `"op"` field. It reads like a sentence and saves a field on every step; `check` catches a step with two such keys or none.
- **The engine draws its own polygons**, with exact area coverage, instead of asking a canvas. That is what makes a painting come out the same in every browser and in Node.

## Known limits

- Pigment spectra are reconstructed from sRGB, not measured, and scattering is one number per paint.
- What lies under a wet opaque paint is not remembered: paint scraped or blended away does not uncover the layer beneath.
- Water does not creep onto dry paper and does not run downhill: a wash moves only inside what is already wet.
- A whole sheet soaked and left to dry (1000 × 1000 units) takes about 4 seconds; ordinary washes take a fraction of that. Using water media adds four numbers per pixel of memory.
- Light is worked out on display values, not on physical light: lamps add up plausibly, but a set-up is a look, not a measurement. A lamp's `pool` changes its brightness across the picture, not its direction.
- A painting is reproduced exactly by the engine version it was made with (`engine`). Later versions aim to keep the look but may differ in detail; the format version (`paintsim`) changes only when old documents would stop being read.
- The lens blurs by distance from one point; it is not a tilted focal plane.
- Relief is per pixel: at a larger scale a brush has more and finer bristles. Shapes, colours and the accidents of each stroke are the same at every scale; the finest texture is not.
- Dots cannot be clipped; strokes and fills can.
- A stroke has at most 700 bristles: keep `width × scale` under 700 pixels and use `fill()` for larger areas.
- At most 255 different flake recipes on one surface.

## Roadmap

1. ~~Real pigment mixing (absorption and scattering).~~ Done in 0.3.
2. ~~Wet-in-wet: paint that keeps moving on the surface.~~ Done in 0.4.
3. ~~Lighting set-ups beyond one lamp.~~ Done in 0.5.
4. ~~A data format for a whole painting (a list of strokes) on top of this API.~~ Done in 0.6.
5. ~~Acceptance: repaint the magpie with the library.~~ Done in 0.7: `paintings/magpie.json`.
