# How to paint a picture with PaintSim

This guide is for whoever paints: a person or a model. The README says what every call and field does. This guide says how to get a good picture, and it lists the mistakes that everyone makes first. It comes from six finished paintings (`paintings/magpie.json` is one of them).

## 1. The loop

You cannot paint well without looking. Work in this loop and do it many times (the finished paintings took 8 to 19 rounds each):

1. Change the generator.
2. `node paintings/NAME.gen.mjs` writes `paintings/NAME.json`.
3. `node tools/render.mjs paintings/NAME.json /tmp/a.png --scale 1` paints it (1 to 3 seconds).
4. **Open the PNG and look at it.** Say honestly what is wrong. Then go to 1.

For a close look, add `--scale 3 --crop x0,y0,x1,y1` (page units). Before you stop, look at every part of the picture at 2.5× to 3×. `--upto "stage name"` shows the picture after one stage; use it to find the stage that made a defect. A crop still paints the whole picture first, so it is not faster than a full render.

## 2. Start from the starter

Copy `paintings/starter.gen.mjs`. Keep its top half (engine loading, seeded chance, palette, the `st` / `fl` / `dry` / `stage` writers, `run`, the writer at the end). Replace the picture. A picture needs thousands of strokes (3,000 to 20,000), so a program composes them; nobody writes them by hand.

Keep one seeded random stream for accidents, but decide the things that make the composition (where objects are, which windows are lit) by fixed lists or by a hash of their position. Otherwise every edit early in the program moves everything after it.

## 3. The order of work

Paint as a painter does: back to front, thin to thick, large to small.

1. **Toned ground.** `toned canvas`, or your own colour. For a night picture use a dark ground.
2. **Lay-in.** Fill every large area with its own colour, thinly (`fl` with a thin paint). Everything later is then painted over colour, not over bare canvas.
3. **Masses.** Broad strokes over each area, with the colour changing across it.
4. **Modelling.** Smaller strokes that follow the form.
5. **Lights and accents.** Thick, clean paint, put down last and left alone.

Put `dry()` between layers that must not mix. Give each stage a name and a note.

## 4. Coverage

- A gap between strokes shows whatever is under it. If that is the toned canvas, the picture has brown holes. The lay-in (step 2) prevents this.
- Strokes that are lifted at the edge of a shape stop a little short of it. Put a fill of the same colour under the shape first.
- Points scattered evenly over a shape in perspective leave its far end almost empty. Scatter more points there, or fill it first.
- A pass of strokes over a whole region paints over everything in it. Cut the strokes at objects with `run(path, ok)`.
- Thin paint on a canvas ground shows the weave as a grid of dots. Lay-ins are covered later, so that is fine; anything that stays visible needs body 0.5 or more.

## 5. What the brushes do

- **Flat brushes** (`flat`, `knife`, `dry`, `fan`): the width is constant. Pressure changes only how much paint comes off. A flat stroke with a tapering profile fades; it does not get narrower.
- **Round brushes** (`round`, `filbert`, `liner`, `pen`): pressure changes the width. The named profiles (`leaf`, `feather`, `taper`) make pointed, leaf-shaped marks. Many of them together look like leaves or flames, whatever you meant them to be. For a blunt touch give pressure as numbers with a floor, for example `[.55, .9, 1, 1, .9, .55]`.
- **The knife** lays a slab with a raised rim (`edge: .5`) and 2.4 times the body of the paint. With the shared `oil` that is very thick. It is right for lights; for dark walls and skies define a paint with less body, or the picture looks like bricks.
- **`blender`** carries no paint. It moves wet paint and softens it: good for a halo round a lamp.
- With `grad`, the second colour lies on the left side of the stroke's direction of travel.
- A stroke has at most 700 bristles: keep `width × scale` under 700 pixels.

## 6. Oil

- The shared `oil` runs out after 320 units (`reach`). Define your own with `reach: 0` unless you want strokes that fade.
- Oil stays wet. A stroke laid into wet oil picks colour up (`pickup`) and melts into it (`merge`). Inside one passage that is what you want. Between a light and a dark it makes mud: `dry()` before lights go over darks.
- For lights and accents define a clean thick paint: `{base: 'oil', body: 1.5, merge: 0, pickup: 0, reach: 0}`.
- Paint laid over wet glossy paint (`enamel`) sinks into it. Dry first (`{"dry": "still"}` dries at once).

## 7. Colour

- Colours mix as pigments. Lamp black and prussian blue are very strong. A little white goes far. Two complements make a dark neutral.
- Print what your mixes give before you use them: `PaintSim.hex(PaintSim.color({mix: {…}}))`.
- Mixing a yellow or an orange with a blue-violet to make a shadow gives green or olive, because that is what those pigments do. For a shadow colour, move the local colour toward one chosen shadow colour with the plain interpolation (`mixc` in the starter).
- Give every stroke a slightly different colour: interpolate between two palette colours by position, by light, and by chance.
- A stroke has one colour along its length (`color2` varies it across the brush). To shade along a curved form, cut the stroke into short pieces.
- Do not sort the strokes of a passage from dark to light: the last stroke wins where strokes overlap, so the passage ends up too light. Keep them in random order.
- A dark stroke laid into a wet pale layer comes out far lighter than its paint, because white dominates a mix. Dry the pale layer first.
- White with raw umber or cobalt blue goes greenish. For a cool grey use ivory black with a little rose madder.
- The colour on the picture is lighter than the paint if the light has `exposure` above 1. Mix shadows darker than they look on the palette.
- `PaintSim.mix` and `PaintSim.color` do not check their input. A wrong value gives a near-black or `#NaNNaNNaN`; `PaintSim.check` reports the second, not the first.

## 8. Relief and light

- Relief shows as shading on light paint. On dark paint it shows only as gloss: give dark passages `gloss: .3` to `.4` and some body, or they are flat.
- Gloss on ridged dark paint makes it greyer than its colour. Push darks darker and more saturated than you think.
- A dot with a `dome`, or strokes laid in circles, look like a button or a groove under a low lamp. Use them only where you want that.
- A nearly dry brush dragged over canvas leaves dotted rectangles like a screen. On canvas, use it over paint, not over bare ground.
- `raking` shows brushwork best. `gallery` flattens it. Compare before you choose. `shoulder: .3` keeps bright lights from clipping to white.
- A lens (`vignette`, a little `contrast`, `grain`) helps most pictures. Blur is for close-up photographs only.
- `spray` makes separate droplets, not mist. For a glow, paint short strokes wet into wet and soften them with the `blender`.
- A large glossy area gets a broad sheen under `raking` and looks much lighter than its colour. Keep gloss at .2 to .45 on big shapes, and look at the picture with `--light flat` to see the colours without the lamp.
- Brush ridges that run across the direction of the light show strongly. A smooth thing (a glazed pot) painted with strokes looks fluted: lay it in with soft fills clipped to its shape and a levelled paint (`level: .9`).
- Thickness does not pile up. Paint over paint takes the thickness of the last layer.
- `--light NAME` replaces the whole light of the document, its exposure and lens included.

## 9. Edges

- End strokes at the edge of a shape with `run(path, ok)`. The edge then looks painted. A clip mask gives a hard, cut edge; use it for hard things (a bill, a window bar, a hull).
- `clip` takes a name from `shapes`. Named masks are made once, so they are cheap.
- A stroke is as wide beyond its path as on it: a path that stops at an edge still paints half its width past it. For a crisp object, clip every stroke to its shape; for a soft one, lift.
- Fills laid side by side in a grid show their blocks even with a large `soft`. Scattered soft ellipses give a smooth field.

## 10. Why a picture looks digital

Check each of these before you stop:

- Marks of one size, one length and one direction over a large area.
- Straight ruled edges and even lines (masts, walls, window grids). A hand wavers: add a little wobble, break long lines, vary the width.
- Thin, even, perfectly opaque lines for hair, twigs or rain.
- Half-transparent shapes with clean edges. For broken colour use a nearly dry brush at high opacity (`dry: .8`, `charge: .5`).
- Shapes that are symmetrical, or repeated without change.
- A large area with nothing happening in it.
- Flat colour inside a shape: no turn from light to shade.

## 11. Limits

- Keep the document under about 3 MB and the render at 2× under about 40 seconds. Round coordinates to one decimal.
- A coordinate that is not a number is reported as `point N is not [x, y]`. Look for a NaN in your own arithmetic.
- At most 255 different flake recipes on one surface.
- Do not change the engine to make a picture work. If something in it is wrong, say so.

## 12. Done

- `node tools/render.mjs paintings/NAME.json --check` says `sound`.
- `paintings/NAME.png` is written at the default scale 2.
- You have looked at the whole picture and at every part of it close up, and you can say what is still weak and where.
