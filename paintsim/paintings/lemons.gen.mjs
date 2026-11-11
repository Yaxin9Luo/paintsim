// node paintings/lemons.gen.mjs   →   paintings/lemons.json
//
// "Oil painting still life in the Dutch manner: three lemons, one cut open with its peel curling off the table edge, a blue-and-white
//  porcelain bowl, a pewter knife, on a rumpled linen cloth over a dark wooden table, deep dark background, light from the upper left,
//  rich chiaroscuro, visible brushwork."
//
// Composed here by rule and seeded chance, and written out as an ordinary painting document. Every object is modelled as a small
// piece of 3-D geometry (an ellipsoid, a surface of revolution, a height field, a helix) so that each stroke can ask how much light
// falls where it lands and which way the form turns there; the colour of the stroke comes from that, and its direction follows the form.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {spline, arc, clamp, smooth, fbm} = P.util;

/* ---------- chance, with a seed ---------- */
let seed = 16490311;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
const RR = r => R(r[0], r[1]);

/* ---------- the palette: every colour mixed from pigments ---------- */
const MIX = {
  // the dark wall and the table
  'umber black': {mix: {'burnt umber': 2, 'lamp black': 1.2}},
  'umber deep': {mix: {'burnt umber': 3, 'lamp black': .6, 'sap green': .3}},
  'umber': {mix: {'raw umber': 3, 'burnt umber': 1, 'lamp black': .3}},
  'umber olive': {mix: {'raw umber': 3, 'sap green': .6, 'lamp black': .25}},
  'umber light': {mix: {'raw umber': 3, 'burnt umber': .6, 'yellow ochre': .6, 'lamp black': .1}},
  'umber glow': {mix: {'raw umber': 2, 'yellow ochre': 1, 'burnt sienna': .2, 'lamp black': .05}},
  'wood dark': {mix: {'burnt umber': 3, 'lamp black': .7, 'burnt sienna': .4}},
  'wood': {mix: {'burnt umber': 2, 'burnt sienna': .9, 'lamp black': .12}},
  'wood warm': {mix: {'burnt umber': 2, 'burnt sienna': 1, 'raw sienna': .3}},
  'wood light': {mix: {'burnt sienna': 1, 'raw sienna': 1, 'yellow ochre': .6, 'raw umber': .5}},
  // linen
  'linen deep': {mix: {'raw umber': 2, 'titanium white': .7, 'ivory black': .15, 'ultramarine': .05}},
  'linen dark': {mix: {'titanium white': 1, 'raw umber': 1.3, 'ivory black': .2, 'rose madder': .05}},
  'linen shade': {mix: {'titanium white': 3, 'raw umber': .8, 'ivory black': .18, 'rose madder': .06}},
  'linen half': {mix: {'titanium white': 5, 'raw umber': .6, 'naples yellow': .3, 'ivory black': .1}},
  'linen': {mix: {'lead white': 6, 'naples yellow': .35, 'raw umber': .15}},
  'linen light': {mix: {'titanium white': 8, 'naples yellow': .6}},
  'linen top': {mix: {'titanium white': 9, 'naples yellow': .5}},
  // porcelain
  'porc deep': {mix: {'titanium white': 1, 'ivory black': .5, 'raw umber': .3, 'cobalt blue': .08}},
  'porc shade': {mix: {'titanium white': 3, 'ivory black': .4, 'raw umber': .15, 'cobalt blue': .08}},
  'porc half': {mix: {'titanium white': 6, 'ivory black': .25, 'cobalt blue': .05, 'naples yellow': .2}},
  'porc': {mix: {'titanium white': 9, 'cobalt blue': .05, 'naples yellow': .15}},
  'porc light': {mix: {'titanium white': 10, 'naples yellow': .2}},
  'blue deep': {mix: {'ultramarine': 2, 'cobalt blue': 1, 'ivory black': .3}},
  'blue': {mix: {'cobalt blue': 3, 'ultramarine': 1.2}},
  'blue light': {mix: {'cobalt blue': 2, 'ultramarine': 1, 'titanium white': .5, 'raw umber': .1}},
  'blue wash': {mix: {'cobalt blue': 1, 'ultramarine': .6, 'titanium white': 2.2, 'ivory black': .08}},
  // lemons
  'lemon deep': {mix: {'raw umber': 2, 'burnt umber': .7, 'yellow ochre': .6, 'burnt sienna': .2}},
  'lemon shade': {mix: {'raw umber': 2, 'yellow ochre': 1.2, 'burnt sienna': .5}},
  'lemon olive': {mix: {'yellow ochre': 2, 'raw umber': .7, 'raw sienna': .5}},
  'lemon half': {mix: {'yellow ochre': 2, 'raw sienna': .4, 'cadmium yellow': .4, 'raw umber': .2}},
  'lemon mid': {mix: {'cadmium yellow': 2, 'yellow ochre': 1.5, 'raw sienna': .2}},
  'lemon': {mix: {'cadmium yellow': 3, 'yellow ochre': .5}},
  'lemon light': {mix: {'cadmium yellow': 3, 'titanium white': .6}},
  'lemon top': {mix: {'cadmium yellow': 1, 'titanium white': 2.5}},
  'lemon glint': {mix: {'titanium white': 6, 'cadmium yellow': .3}},
  'lemon warm': {mix: {'cadmium yellow': 2, 'yellow ochre': 1, 'vermilion': .12}},
  'lemon green': {mix: {'cadmium yellow': 3, 'sap green': .8}},
  'pith': {mix: {'titanium white': 4, 'naples yellow': 1, 'cadmium yellow': .15}},
  'pith shade': {mix: {'titanium white': 3, 'naples yellow': 1, 'raw umber': .35}},
  'pulp': {mix: {'cadmium yellow': 2, 'naples yellow': 1.2, 'titanium white': .8}},
  'pulp deep': {mix: {'cadmium yellow': 3, 'yellow ochre': 1.4, 'raw sienna': .3}},
  'pulp light': {mix: {'naples yellow': 2, 'titanium white': 2, 'cadmium yellow': .6}},
  // knife
  'pewter deep': {mix: {'ivory black': 1, 'raw umber': .3, 'titanium white': .8}},
  'pewter': {mix: {'titanium white': 2, 'ivory black': .7, 'raw umber': .2}},
  'pewter light': {mix: {'titanium white': 5, 'ivory black': .4, 'cobalt blue': .08}},
  'ebony': {mix: {'lamp black': 1.2, 'burnt umber': 1.5, 'burnt sienna': .3}},
  'ebony light': {mix: {'burnt umber': 2, 'burnt sienna': .6, 'titanium white': .6, 'lamp black': .2}}
};
const CC = new Map();
const C = c => { if (typeof c !== 'string') return c; let v = CC.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); CC.set(c, v) } return v };
const km = (a, b, t) => t <= 0 ? C(a) : t >= 1 ? C(b) : P.mix([[C(a), 1 - t], [C(b), t]]);   // mixed as pigments
const hex = c => P.hex(C(c));
// a value 0…1 → a colour, through a list of [value, colour] stops, mixed as pigment between neighbours
function ramp(stops, v) { if (v <= stops[0][0]) return C(stops[0][1]); for (let i = 0; i < stops.length - 1; i++) { const a = stops[i], b = stops[i + 1]; if (v <= b[0]) return km(a[1], b[1], (v - a[0]) / (b[0] - a[0])) } return C(stops[stops.length - 1][1]) }

/* ---------- the document ---------- */
const W = 1000, H = 800;
const doc = {
  paintsim: 1, engine: P.VERSION, title: 'Lemons, a kraak bowl and a knife',
  note: 'Still life in the Dutch manner: three lemons, one cut with its peel hanging over the edge, a blue-and-white bowl and a pewter knife on a rumpled linen cloth. Oil on toned canvas. Written by paintings/lemons.gen.mjs.',
  size: [W, H], ground: 'toned canvas',
  light: {base: 'raking', shoulder: .25, lens: {vignette: .32, contrast: .12, grain: .5}},
  seed: 16490311,
  define: {
    pigments: MIX,
    grounds: {'toned canvas': {base: 'canvas', color: '#6b5a43', tooth: .38}},
    materials: {
      'imprimatura': {base: 'oil glaze', note: 'a thin wash of umber over the whole canvas', color: 'umber', opacity: .55, gloss: .15},
      'thin': {base: 'oil', note: 'paint thinned with turpentine for the dead colouring', body: .18, ridges: .2, gloss: .12, sharp: .35, open: .9, pickup: .02, merge: .3, bury: .35, reach: 300, dry: .4},
      'wall': {base: 'oil', note: 'the wall: thin, rubbed in, a little oily', body: .2, ridges: .15, gloss: .22, sharp: .4, pickup: .02, merge: .35, bury: .5},
      'dark': {base: 'oil', note: 'the darks: thin but oily, so they keep some gloss', body: .35, ridges: .22, gloss: .3, sharp: .45, pickup: .02, merge: .25, bury: .6},
      'paint': {base: 'oil', note: 'ordinary body colour', body: .5, ridges: .2, gloss: .2, merge: .25, pickup: .02},
      'body': {base: 'oil', note: 'stiff paint for the lights', body: .95, ridges: .2, gloss: .26, merge: .12, pickup: .012, bury: .85},
      'impasto': {base: 'oil', note: 'thick lead white and its tints, laid on and left', body: 1.4, ridges: .15, grain: .04, gloss: .32, sharp: .5, merge: .05, pickup: .004, bury: .95, reach: 0},
      'clean': {base: 'oil', note: 'a clean touch that does not mix with what is wet beneath', body: .75, merge: 0, pickup: 0, reach: 0},
      'shadow glaze': {base: 'oil glaze', note: 'transparent umber for the cast shadows', color: 'umber black', opacity: .45, level: .5, gloss: .4},
      'warm glaze': {base: 'oil glaze', color: {mix: {'raw sienna': 1, 'burnt umber': .4}}, opacity: .3, gloss: .4},
      'yellow glaze': {base: 'oil glaze', color: {mix: {'cadmium yellow': 2, 'yellow ochre': 1}}, opacity: .35, gloss: .5},
      'skin': {base: 'oil', note: 'lemon skin: oily, pitted with pores', body: .5, ridges: .18, gloss: .34, sharp: .45, merge: .3, pickup: .02,
        texture: [{mask: 'noise', scale: 1.1, amount: .5, soft: .35, signed: true, height: .16, tone: .97}, {mask: 'speck', scale: 3.2, amount: .25, size: .25, height: -.3, tone: .95}, {mask: 'noise', scale: 9, amount: .5, soft: .3, tone: .96}]},
      'peel': {base: 'oil', note: 'the outside of the peel: waxy, not shiny', body: .6, ridges: .2, gloss: .22, sharp: .4, merge: .15, pickup: .01, bury: .85},
      'skin light': {base: 'skin', body: 1.05, merge: .18, pickup: .01, bury: .9},
      'porcelain': {base: 'oil', note: 'white with a glassy glaze', body: .4, level: .55, ridges: .12, gloss: .45, sharp: .85, merge: .3, pickup: .02},
      'cobalt': {base: 'oil', note: 'the blue, laid into the wet white so that its edges soften like blue under a glaze', body: .35, level: .5, ridges: .2, gloss: .45, sharp: .85, merge: .35, pickup: .01, open: .6},
      'cobalt line': {base: 'cobalt', merge: .1, opacity: .92},
      'glint': {base: 'oil', note: 'the last thick white on a glossy thing', color: 'porc light', body: 1.4, level: .3, gloss: .7, sharp: .8, merge: 0, pickup: 0, reach: 0},
      'juice': {base: 'enamel', note: 'wet juice: a bead of clear yellow', color: 'pulp light', body: .3, opacity: .55, gloss: .95, sharp: .95, merge: 0},
      'pewter': {base: 'iron', note: 'soft grey metal, not quite polished', color: 'pewter', metal: .22, gloss: .5, sharp: .55, level: .6, body: .45,
        texture: [{mask: 'lines', scale: .6, length: 20, angle: .9, signed: true, height: .2, tone: .95}, {mask: 'noise', scale: 14, amount: .4, soft: .2, tone: .88}]},
      'pewter paint': {base: 'oil', note: 'grey paint with a little metal in it, for the reflections on the blade', body: .5, level: .5, gloss: .55, sharp: .6, metal: .15, merge: .1, pickup: 0}
    },
    brushes: {
      'hog': {base: 'flat', note: 'a big worn hog brush for the background', clump: 3, streak: 1.6, rag: 9, wobble: 1.2, var: .15},
      'hog round': {base: 'filbert', note: 'a big round hog', clump: 3.2, streak: 1.5, wobble: 1, var: .2},
      'scrub': {base: 'filbert', note: 'nearly dry, dragged so it catches the weave', dry: .72, charge: .55, streak: 1.6, wobble: .8, var: .2},
      'fil': {base: 'filbert', note: 'the everyday filbert', clump: 2.4, streak: 1.2, wobble: .6, var: .15},
      'fil soft': {base: 'filbert', note: 'a softer filbert for blending passages', clump: 2, streak: .7, wobble: .4, var: .1},
      'flat small': {base: 'flat', width: 10, clump: 2, rag: 2.5, wobble: .4},
      'point': {base: 'round', profile: 'taper', wobble: .2},
      'rigger': {base: 'liner', wobble: .4, var: .25},
      'comma': {base: 'round', profile: 'comma', wobble: .2},
      'dab': {base: 'filbert', note: 'a short loaded touch', profile: 'comma', clump: 2.2, wobble: .3},
      'drybrush': {base: 'filbert', note: 'almost dry, catches only the ridges', dry: .8, charge: .5, streak: 1.5, wobble: .6, var: .3},
      'knife small': {base: 'knife', width: 12, varLen: 10},
      'soft blender': {base: 'blender', width: 18, rag: 4}
    }
  },
  shapes: {}, steps: []
};

/* ---------- writing steps (as in the magpie) ---------- */
let cur = null, grp = null;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100;
const PT = pts => pts.map(p => [n1(p[0]), n1(p[1])]);
// the picture is composed in its own frame and brought a little closer when written out: zoom Z about the bottom of the page,
// so that the table and its things fill more of the canvas and less of it is empty wall
const Z = 1.08, DX = -40, DY = -64, TX = p => [p[0] * Z + DX, p[1] * Z + DY], TP = pts => PT(pts.map(TX));
const TSHAPE = sh => Array.isArray(sh) && typeof sh[0][0] === 'number' ? TP(sh) : sh.curve ? {curve: TP(sh.curve)} : sh.rect ? {rect: [...TX(sh.rect.slice(0, 2)), ...TX(sh.rect.slice(2))].map(n1)} : sh;
const colOf = c => typeof c === 'string' && c[0] === '#' ? c : hex(c);
function stage(name, note) { cur = {name, do: []}; if (note) cur.note = note; doc.steps.push(cur); grp = null }
function put(shared, step) { const key = JSON.stringify(shared); if (!grp || grp.key !== key) { grp = {key, node: {with: shared, do: []}}; cur.do.push(grp.node) } grp.node.do.push(step) }
function st(material, brush, path, o = {}) {
  if (!path || path.length < 2) return;
  const s = {path: TP(path)}, w = o.w === undefined ? undefined : o.w * Z;
  if (w !== undefined) s.width = w < 4 ? n2(w) : n1(w);
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.c2 !== undefined) s.color2 = colOf(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.pr !== undefined) s.pressure = typeof o.pr === 'string' ? o.pr : o.pr.map(n2);
  if (o.press !== undefined) s.press = n2(o.press);
  if (o.grad) s.grad = n2(o.grad);
  if (o.load !== undefined) s.load = Math.round(o.load * Z);
  if (o.wob !== undefined) s.wobble = n2(o.wob);
  if (o.tone2) s.tone2 = n2(o.tone2);
  if (o.clip !== undefined) s.clip = o.clip;
  if (o.raw) s.spline = false;
  put({material, brush}, s);
}
function fl(material, shape, o = {}) {
  const s = {shape: TSHAPE(shape)};
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.c2 !== undefined) s.color2 = colOf(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  for (const k of ['soft', 'uneven', 'scale', 'angle']) if (o[k] !== undefined) s[k] = n2(k === 'soft' || k === 'scale' ? o[k] * Z : o[k]);
  if (o.clip !== undefined) s.clip = o.clip;
  put({material}, s);
}
function dots(material, list, o = {}) {
  if (!list.length) return;
  const L2 = list.map(d => [...TX(d), d[2] * Z]), s = L2.length === 1 ? {at: [n1(L2[0][0]), n1(L2[0][1])], r: n2(L2[0][2])} : {dots: L2.map(d => [n1(d[0]), n1(d[1]), n2(d[2])])};
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.soft !== undefined) s.soft = n2(o.soft);
  if (o.dome !== undefined) s.dome = n2(o.dome);
  put({material}, s);
}
const dot = (material, x, y, r, o) => dots(material, [[x, y, r]], o);
const dry = (v = true) => { cur.do.push({dry: v}); grp = null };

/* ---------- geometry ---------- */
const closed = p => p.concat([p[0]]);
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
function distPoly(x, y, p) { let d = 1e18; for (let i = 0; i < p.length - 1; i++) { const ax = p[i][0], ay = p[i][1], vx = p[i + 1][0] - ax, vy = p[i + 1][1] - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1), dx = x - ax - vx * t, dy = y - ay - vy * t, dd = dx * dx + dy * dy; if (dd < d) d = dd } return Math.sqrt(d) }
const bbox = p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) } return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0} };
function sampleIn(poly, n) { const b = bbox(poly), out = []; let guard = 0; while (out.length < n && guard++ < n * 200) { const x = R(b.x0, b.x1), y = R(b.y0, b.y1); if (inPoly(x, y, poly)) out.push([x, y]) } return out }
// jittered grid: even cover with no clumps, which a painter's hand gives and pure chance does not
function gridIn(poly, step, jit = .5) { const b = bbox(poly), out = []; for (let y = b.y0 + step / 2; y < b.y1; y += step * .87) for (let x = b.x0 + step / 2 + ((Math.round(y / step) & 1) * step * .5); x < b.x1; x += step) { const px = x + R(-jit, jit) * step, py = y + R(-jit, jit) * step; if (inPoly(px, py, poly)) out.push([px, py]) } return out }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
// the part of a stroke that lies inside a shape: the brush is lifted at the edge, not masked
function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }
const within = (path, poly) => run(path, p => inPoly(p[0], p[1], poly));
const ellipse = (cx, cy, rx, ry, rot = 0, n = 64) => { const c = Math.cos(rot), s = Math.sin(rot), o = []; for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI, x = Math.cos(t) * rx, y = Math.sin(t) * ry; o.push([cx + x * c - y * s, cy + x * s + y * c]) } return o };
const resamp = (path, step) => { const out = [path[0]]; let acc = 0; for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); acc += d; if (acc >= step || i === path.length - 1) { out.push(path[i]); acc = 0 } } return out };
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const gauss = (x, y, cx, cy, rx, ry) => Math.exp(-((x - cx) * (x - cx) / (rx * rx) + (y - cy) * (y - cy) / (ry * ry)));

/* ---------- the light: one window high on the left, a little in front ----------
   World frame: x right, y up, z toward the viewer. We look down on the table from about 14°. */
const EL = Math.asin(.24), cE = Math.cos(EL), sE = Math.sin(EL);
const LW = norm3([-.74, .55, .36]);           // toward the window
const VW = [0, sE, cE];                        // toward the eye
const HW = norm3([LW[0] + VW[0], LW[1] + VW[1], LW[2] + VW[2]]);
const BOUNCE = norm3([.25, -.8, .55]);         // light thrown back up from the cloth and the table
const viewToWorld = n => [n[0], n[1] * cE + n[2] * sE, -n[1] * sE + n[2] * cE];   // a normal seen on the page (x right, y up, z out) → world
// how lit a surface with this world normal is: diffuse, with a soft terminator, plus a little bounce
const diffuse = n => { const d = (dot3(n, LW) + .3) / 1.3; return d <= 0 ? 0 : d >= 1 ? 1 : d * d * (3 - 2 * d) * .5 + d * .5 };
const spec = (n, p) => Math.pow(Math.max(0, dot3(n, HW)), p);

/* ---------- composition ---------- */
const BACK = 438, EDGE = 668, EDGE2 = 679;            // back edge of the table, its front edge, and the bottom of the bevel
const BWL = {x: 300, y: 448, R0: 168, H: 124, K: .24}; // the bowl: rim centre, rim radius, depth of the body, ellipse ratio
const LA = {x: 324, y: 452, rx: 77, ry: 51, ang: -.2, nip: .2, nip2: .08};        // the lemon in the bowl
const LB = {x: 524, y: 610, rx: 81, ry: 54, ang: .12, nip: .22, nip2: .1};       // the whole lemon on the cloth
const LC = {x: 738, y: 594, rx: 92, ry: 58, ang: .04, face: {rx: 37, ry: 58}};    // the cut half: the cut face looks left, toward the window
const KN = {tip: [96, 636], bol: [278, 660], end: [400, 690]};                   // the knife
const PEEL = {x: 858};

// the cloth on the table top, and the part of it that hangs over the front edge
const CLOTH_TOP = [[-20, BACK - 6], [80, BACK - 4], [190, BACK - 2], [330, BACK], [440, BACK + 6], [520, BACK + 22], [586, BACK + 52], [630, BACK + 92], [652, 560], [662, 598], [654, 632], [640, EDGE + 1], [-20, EDGE + 1]];
const CLOTH_HANG = [[-20, EDGE - 1], [641, EDGE - 1], [652, 690], [650, 718], [640, 752], [628, 790], [621, H + 20], [-20, H + 20]];

/* =====================================================================
   1. Imprimatura and drawing
   ===================================================================== */
function imprimatura() {
  stage('Imprimatura', 'A thin wash of umber over the whole canvas, darker toward the top and the right.');
  fl('imprimatura', {rect: [-10, -10, W + 10, H + 10]}, {uneven: .6, scale: 120});
  fl('imprimatura', {curve: [[560, -40], [1060, -40], [1060, 500], [800, 420], [620, 160]]}, {a: .35, soft: 60, uneven: .7, scale: 90});
  dry();
  stage('Drawing', 'The objects found with a brush and thin dark paint, loosely, more than once.');
  const sk = (path, a = .7) => st('thin', 'rigger', path.map(p => [p[0] + R(-2, 2), p[1] + R(-2, 2)]), {w: R(1.6, 2.8), c: 'umber deep', a});
  for (let k = 0; k < 2; k++) {
    sk(ellipse(BWL.x, BWL.y, BWL.R0, BWL.R0 * BWL.K, 0, 20).concat([[BWL.x + BWL.R0, BWL.y]]));
    sk([[BWL.x - BWL.R0, BWL.y], [BWL.x - 120, BWL.y + 70], [BWL.x - 72, BWL.y + 118], [BWL.x + 72, BWL.y + 122], [BWL.x + 122, BWL.y + 70], [BWL.x + BWL.R0, BWL.y]]);
    for (const L of [LA, LB]) sk(lemonOutline(L, 26).concat([lemonOutline(L, 26)[0]]));
    sk(ellipse(LC.x, LC.y, LC.rx, LC.ry, LC.ang, 26).filter((_, i) => i < 8 || i > 18));
    sk(ellipse(LC.x - 8, LC.y, LC.face.rx, LC.face.ry, LC.ang, 24));
    sk([[-10, EDGE], [400, EDGE + R(-2, 2)], [1010, EDGE]]); sk([[630, BACK], [1010, BACK]], .45);
    sk([KN.tip, KN.bol, KN.end], .6);
  }
  dry();
}

/* =====================================================================
   2. The wall and the table
   ===================================================================== */
// the wall: a dull glow behind the objects, falling to near black at the top and the right
const wallV = (x, y) => clamp(.08 + .62 * gauss(x, y, 600, 340, 420, 300) + .1 * gauss(x, y, 150, 420, 260, 160) + (fbm(x / 140 + 3, y / 140, 3) - .5) * .22 - .15 * smooth((y - 120) / -200), 0, 1);
const WALL = [[0, 'umber black'], [.28, 'umber deep'], [.55, 'umber'], [.78, 'umber light'], [1, 'umber glow']];
function wall() {
  stage('Wall', 'The dark ground behind: big crossing strokes of a hog brush, softened, a dull glow behind the bowl, near black at the corners.');
  const poly = [[-30, -30], [W + 30, -30], [W + 30, BACK + 10], [-30, BACK + 10]];
  for (const p of shuffle(gridIn(poly, 46, .5))) { const ang = R(-.9, .9) + (rnd() < .5 ? 0 : Math.PI / 2), len = R(90, 170), v = wallV(p[0], p[1]) * .8;
    st('thin', 'hog', arc(p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2, ang, len, R(-.3, .3), 5), {w: R(50, 80), c: ramp(WALL, v), c2: ramp(WALL, v * .85), a: .9, load: 0}) }
  for (const p of shuffle(gridIn(poly, 28, .55))) { const v = clamp(wallV(p[0], p[1]) + R(-.05, .05), 0, 1), ang = (rnd() < .5 ? .7 : -.75) + R(-.35, .35), len = R(60, 120);
    st('wall', rnd() < .6 ? 'hog' : 'hog round', arc(p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2, ang, len, R(-.4, .4), 5), {w: R(30, 56), c: ramp(WALL, v), c2: ramp(WALL, clamp(v + R(-.08, .06), 0, 1)), a: R(.75, .95), load: len * R(1.2, 2.2)}) }
  // softened with a big clean brush, so that the crossing marks melt into an atmosphere
  for (const p of shuffle(gridIn(poly, 50, .5))) { const ang = R(-.6, .6) + (rnd() < .5 ? 0 : 1.5), len = R(80, 150); st('wall', 'soft blender', arc(p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2, ang, len, R(-.3, .3), 5), {w: R(40, 70), a: .7}) }
  // a few scumbles of the light colour, dragged nearly dry so that the weave catches them
  for (const p of sampleIn([[340, 120], [900, 120], [900, 430], [340, 430]], 60)) { const v = wallV(p[0], p[1]); if (v < .5) continue; const ang = R(-1, 1), len = R(40, 90);
    st('wall', 'scrub', arc(p[0], p[1], ang, len, R(-.3, .3), 4), {w: R(20, 40), c: ramp(WALL, Math.min(1, v + .15)), a: .7, load: len}) }
  dry();
}

const woodV = (x, y) => clamp(.42 + .4 * gauss(x, y, 700, 560, 300, 110) - .18 * smooth((x - 840) / 160) - .12 * smooth((470 - y) / 30) + (fbm(x / 60, y / 12, 3) - .5) * .25, 0, 1);
const WOOD = [[0, 'umber black'], [.25, 'wood dark'], [.5, 'wood'], [.76, 'wood warm'], [1, 'wood light']];
function table() {
  stage('Table', 'Dark walnut: the top in long strokes along the grain, the bevel catching the window, the front in shadow.');
  const top = [[560, BACK - 4], [W + 20, BACK - 4], [W + 20, EDGE + 2], [600, EDGE + 2]];
  // dead colour
  for (let y = BACK; y < EDGE + 4; y += 9) { const x0 = y < 560 ? R(380, 420) : R(560, 620); st('thin', 'hog', [[x0, y + R(-2, 2)], [x0 + 300, y + R(-3, 3)], [x0 + 640, y + R(-3, 3)]], {w: R(18, 26), c: ramp(WOOD, .25), a: .9, load: 0}) }
  // the grain: long strokes, with streaks of lighter and darker wood
  const rows = []; for (let y = BACK + 3; y < EDGE; y += R(4, 8)) rows.push(y);
  for (const y of rows) { let x = y < 560 ? R(400, 440) : R(520, 600); while (x < W + 20) { const len = R(90, 260), v = woodV(x + len / 2, y) + R(-.12, .12), wv = (fbm(x / 90, y / 7, 2) - .5) * 3;
      st('dark', rnd() < .6 ? 'fil' : 'hog', [[x, y + wv], [x + len * .5, y + wv + R(-1.5, 1.5)], [x + len, y + R(-2, 2)]], {w: R(6, 14), c: ramp(WOOD, clamp(v, 0, 1)), c2: ramp(WOOD, clamp(v - .1, 0, 1)), a: R(.75, .95), load: len * 1.4});
      x += len * R(.6, .95) } }
  // the reflection of the window in the polish: a soft paler sheen in the middle distance
  for (let i = 0; i < 40; i++) { const x = R(700, 960), y = R(BACK + 20, BACK + 110), len = R(60, 160);
    st('dark', 'scrub', [[x, y], [x + len, y + R(-2, 2)]], {w: R(6, 14), c: 'wood light', a: R(.3, .6), load: len}) }
  dry();
  // the front of the table: very dark, with a little grain
  const front = [[600, EDGE2], [W + 20, EDGE2], [W + 20, H + 20], [600, H + 20]];
  for (let y = EDGE2 + 2; y < H + 10; y += R(5, 9)) { let x = R(560, 620); while (x < W + 20) { const len = R(120, 280), v = .05 + .1 * gauss(x, y, 700, 690, 260, 30) + R(-.04, .04);
      st('dark', 'fil', [[x, y], [x + len / 2, y + R(-1.5, 1.5)], [x + len, y + R(-2, 2)]], {w: R(8, 14), c: ramp(WOOD, v), a: .92, load: 0}); x += len * R(.7, .95) } }
  // the bevel: a rounded edge that catches the light, broken
  for (let i = 0; i < 3; i++) { st('dark', 'flat small', [[600, EDGE + 2 + i * 3.5], [800, EDGE + 2 + i * 3.5 + R(-.5, .5)], [W + 20, EDGE + 2 + i * 3.5]], {w: 5, c: ramp(WOOD, [.5, .62, .3][i]), a: .9, load: 0}) }
  dry();
  // the shadow the cloth throws onto the table along its edge
  { const edge = CLOTH_TOP.slice(6, 12).concat([[640, EDGE]]); fl('shadow glaze', edge.map(p => [p[0] + 12, p[1] + 2]).concat(edge.slice().reverse().map(p => [p[0] - 6, p[1]])), {a: .55, soft: 6}) }
  for (let x = 640; x < W; x += R(30, 90)) { const len = R(30, 110); st('body', 'drybrush', [[x, EDGE + 3.5], [x + len, EDGE + 3.5 + R(-.6, .6)]], {w: R(2, 4), c: km('wood light', 'linen half', R(0, .4)), a: .85, load: len}) }
  dry();
}

/* =====================================================================
   3. The cloth — a height field of folds, lit
   ===================================================================== */
// ridges (positive) and hollows (negative) as curves; each lifts or sinks the cloth near it
const FOLDS = [
  {p: [[-30, 488], [70, 506], [160, 556], [214, 612], [236, 668]], a: 16, w: 30},   // the long fold from the back left to the edge
  {p: [[30, 600], [70, 630], [96, 668]], a: 7, w: 12},                              // a small crease in front of it
  {p: [[60, 456], [150, 470], [196, 490]], a: 8, w: 20},                            // behind the bowl
  {p: [[150, 662], [270, 640], [380, 652], [440, 668]], a: -9, w: 30},              // a hollow in front of the bowl
  {p: [[450, 470], [534, 512], [580, 584], [592, 668]], a: 18, w: 28},              // the cloth heaped at the right
  {p: [[548, 460], [612, 506], [640, 572], [650, 620]], a: 12, w: 16},
  {p: [[406, 520], [452, 552], [440, 596]], a: -10, w: 22},                         // the hollow between heap and bowl
  {p: [[290, 600], [360, 604], [404, 592]], a: 5, w: 10},
  {p: [[470, 640], [520, 656], [566, 650]], a: 6, w: 10},
  {p: [[-30, 560], [20, 570], [60, 590]], a: -6, w: 18}
].map(f => ({...f, p: spline(f.p, 8)}));
const HANG = [];   // folds of the hanging part: they fall from the edge and open out
{ let x = R(0, 20); while (x < 650) { const big = rnd() < .7; HANG.push({x, dx: R(-26, 26), a: (big ? R(16, 26) : R(4, 7)) * (rnd() < .15 ? -1 : 1), w: big ? R(22, 34) : R(9, 13)}); x += big ? R(60, 100) : R(25, 40) } }
const clothTopH0 = (x, y) => { let h = 0; for (const f of FOLDS) { const d = distPoly(x, y, f.p); h += f.a * Math.exp(-d * d / (f.w * f.w)) } return h };
const clothTopH = (x, y) => clothTopH0(x, y) + (fbm(x / 40, y / 25, 3) - .5) * 3;
const clothHangH0 = (x, y) => { let h = 0; const t = clamp((y - EDGE) / 110, 0, 1); for (const f of HANG) { const fx = f.x + f.dx * t + 6 * Math.sin(y / 30 + f.x); const d = x - fx; h += f.a * (.35 + .65 * t) * Math.exp(-d * d / (f.w * f.w * (.6 + .6 * t))) } return h };
const clothHangH = (x, y) => clothHangH0(x, y) + (fbm(x / 30, y / 50, 2) - .5) * 2;
// cast shadows on the cloth: the bowl, the lemons
const FOOT_Y = BWL.y + BWL.H * 1.1 + (BWL.R0 * .5 - 6) * BWL.K;
const shadowCloth = (x, y) => { let s = 1;
  s *= 1 - .6 * smooth(1.2 - Math.hypot((x - BWL.x - 120) / 150, (y - FOOT_Y + 12) / 20));   // the bowl's shadow, thrown to the right
  s *= 1 - .7 * smooth(1.15 - Math.hypot((x - BWL.x - 80) / 85, (y - FOOT_Y + 2) / 9));     // where the foot stands
  s *= 1 - .6 * smooth(1.2 - Math.hypot((x - LB.x - 72) / 88, (y - LB.y - LB.ry + 6) / 14)); // the whole lemon's shadow
  s *= 1 - .45 * smooth(1.2 - Math.hypot((x - LC.x + 60) / 40, (y - LC.y) / 50));           // the cut lemon's shadow on the edge of the cloth
  s *= 1 - .35 * smooth(1.1 - Math.hypot((x - BWL.x + 80) / 120, (y - BWL.y - 14) / 26));   // under the bowl's lip, behind
  return s };
const clothFall = (x, y) => clamp(1.05 - .32 * smooth((x - 420) / 300) - .3 * smooth((200 - x) / 220) - .5 * smooth((BACK + 60 - y) / 70) - .12 * smooth((y - 600) / 70), 0, 1);   // the light weakens to the right and to the back
function clothTopV(x, y) { const e = 2, hx = (clothTopH(x + e, y) - clothTopH(x - e, y)) / (2 * e), hy = (clothTopH(x, y + e) - clothTopH(x, y - e)) / (2 * e);
  const n = norm3([-hx * 2.2, 1, -hy * 1.5]);   // world normal of the cloth lying on the table; page-down is toward the viewer
  const d = clamp((dot3(n, LW) + .05) / 1.05, 0, 1), ao = clamp(clothTopH(x, y) / 12, -1, 1);
  return clamp((.04 + 1.12 * Math.pow(d, 1.3) + .06 * ao) * clothFall(x, y) * shadowCloth(x, y), 0, 1) }
function clothHangV(x, y) { const e = 2, hx = (clothHangH(x + e, y) - clothHangH(x - e, y)) / (2 * e), hy = (clothHangH(x, y + e) - clothHangH(x, y - e)) / (2 * e);
  const n = norm3([-hx * 1.8, -.1 + hy * .6, 1]);
  const d = clamp((dot3(n, LW) + .15) / 1.15, 0, 1), fall = .82 - .25 * smooth((x - 380) / 300) - .25 * smooth((220 - x) / 240) - .3 * smooth((y - EDGE) / 140);
  return clamp((.02 + 1.0 * Math.pow(d, 1.2)) * fall * (1 - .35 * smooth(1 - (y - EDGE) / 14)), 0, 1) }
// the direction a brush takes over the cloth: along the fold where there is one (an axis, so its sign is taken to agree with the
// base direction), easing into the base direction where the cloth is flat
const clothDir = (hf, x, y, base) => { const e = 3, hx = (hf(x + e, y) - hf(x - e, y)) / (2 * e), hy = (hf(x, y + e) - hf(x, y - e)) / (2 * e), g = Math.min(1, Math.hypot(hx, hy) * 2.5);
  let a = Math.atan2(hx, -hy); if (Math.cos(a - base) < 0) a += Math.PI; const k = .35; return Math.atan2(Math.sin(base) * k + Math.sin(a) * g, Math.cos(base) * k + Math.cos(a) * g) };
// the direction along the nearest folds: each fold pulls the brush along its own length, as much as it is near
function foldDir(x, y, base) { let sx = Math.cos(base) * .25, sy = Math.sin(base) * .25;
  for (const f of FOLDS) { let bd = 1e9, bi = 0; for (let i = 0; i < f.p.length; i++) { const d = (f.p[i][0] - x) ** 2 + (f.p[i][1] - y) ** 2; if (d < bd) { bd = d; bi = i } }
    const q = f.p[Math.min(f.p.length - 1, bi + 1)], r = f.p[Math.max(0, bi - 1)]; let tx = q[0] - r[0], ty = q[1] - r[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    if (tx * sx + ty * sy < 0 && (sx || sy)) { tx = -tx; ty = -ty } const wgt = Math.exp(-bd / (f.w * f.w * 2.2)); sx += tx * wgt; sy += ty * wgt }
  return Math.atan2(sy, sx) }
const LINEN = [[0, 'linen deep'], [.18, 'linen dark'], [.38, 'linen shade'], [.58, 'linen half'], [.76, 'linen'], [.9, 'linen light'], [1, 'linen top']];

// a path that follows a direction field from a point both ways: the brush goes along the fold, not straight across it
function trace(x, y, dirf, len, n = 6) { const h = len / 2 / n, fw = [[x, y]], bw = []; let a0 = dirf(x, y), cx = x, cy = y, pa = a0;
  for (let i = 0; i < n; i++) { let a = dirf(cx, cy); if (Math.cos(a - pa) < 0) a += Math.PI; cx += Math.cos(a) * h; cy += Math.sin(a) * h; fw.push([cx, cy]); pa = a }
  cx = x; cy = y; pa = a0 + Math.PI; for (let i = 0; i < n; i++) { let a = dirf(cx, cy); if (Math.cos(a - pa) < 0) a += Math.PI; cx += Math.cos(a) * h; cy += Math.sin(a) * h; bw.push([cx, cy]); pa = a }
  return bw.reverse().concat(fw) }
// a passage of strokes over a shape: colour from a value field, each stroke following a direction field, in random order
function flowPassage(poly, o) {
  const pts = (o.step ? gridIn(poly, o.step, .6) : sampleIn(poly, o.n)).map(p => ({p, v: clamp(o.val(p[0], p[1]) + R(-(o.vj || 0), o.vj || 0), 0, 1)}));
  shuffle(pts);
  for (const {p, v} of pts) { if (o.only && !o.only(v, p)) continue;
    const j = R(-(o.jit || 0), o.jit || 0), len = RR(o.len);
    let path = trace(p[0], p[1], (x, y) => o.dir(x, y) + j, len, 6);
    if (o.clip !== false) path = within(path, poly); if (path.length < 2) continue;
    const c = o.color ? o.color(v, p) : ramp(o.ramp, v);
    st(o.mat, Array.isArray(o.brush) ? pick(o.brush) : o.brush, path, {w: RR(o.w) * (o.wk ? o.wk(v) : 1), c, c2: o.c2 ? o.c2(v, p) : undefined, a: o.a, load: o.load ? len * o.load : undefined, pr: o.pr}) } }

function cloth() {
  const dTop = (x, y) => foldDir(x, y, -.06), dHang = (x, y) => clothDir(clothHangH0, x, y, 1.5);
  stage('Cloth: dead colour', 'The linen laid in thin: its shadows and middle tones, no lights yet.');
  fl('thin', CLOTH_TOP, {c: 'linen shade', a: .95, soft: 1}); fl('thin', CLOTH_HANG, {c: 'linen dark', a: .95, soft: 1});
  flowPassage(CLOTH_TOP, {step: 14, val: (x, y) => clothTopV(x, y) * .9, ramp: LINEN, dir: dTop, len: [40, 80], w: [14, 22], mat: 'thin', brush: 'hog round', a: .92});
  flowPassage(CLOTH_HANG, {step: 14, val: (x, y) => clothHangV(x, y) * .9, ramp: LINEN, dir: dHang, len: [50, 100], w: [12, 20], mat: 'thin', brush: 'hog round', a: .92});
  dry();
  stage('Cloth: modelling', 'Every fold turned with the brush along it, then softened with a clean brush while it is wet.');
  flowPassage(CLOTH_TOP, {step: 8, val: clothTopV, vj: .03, ramp: LINEN, dir: dTop, len: [30, 64], w: [7, 13], mat: 'paint', brush: ['fil soft', 'fil', 'flat small'], a: .94, load: 1.6});
  flowPassage(CLOTH_HANG, {step: 8, val: clothHangV, vj: .03, ramp: LINEN, dir: dHang, len: [80, 140], w: [9, 15], mat: 'paint', brush: ['fil soft', 'flat small', 'flat small'], a: .94, load: 2});
  for (const [poly, dir] of [[CLOTH_TOP, dTop], [CLOTH_HANG, dHang]]) for (const p of shuffle(gridIn(poly, 16, .6))) { const path = within(trace(p[0], p[1], dir, R(40, 80), 6), poly); if (path.length > 1) st('paint', 'soft blender', path, poly === CLOTH_HANG ? {w: R(14, 22), a: .6} : {w: R(10, 16), a: .4}) }
  dry();
  stage('Cloth: lights', 'The crests of the folds caught along their length in stiff paint, the brightest thick; the hollows drawn dark.');
  // the light along each crest, broken into touches whose colour follows the light along it
  for (const f of FOLDS) if (f.a > 0) { const off = f.w * .22, pts = f.p.map((p, i) => { const q = f.p[Math.min(f.p.length - 1, i + 1)], r = f.p[Math.max(0, i - 1)], dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l; if (nx * -.7 + ny * -.7 < 0) { nx = -nx; ny = -ny } return [p[0] + nx * off, p[1] + ny * off] });
    for (let i = 0; i < pts.length - 3;) { const n = Math.min(pts.length - 1 - i, 3 + Math.floor(rnd() * 6)), seg = within(pts.slice(i, i + n + 1), CLOTH_TOP); i += Math.max(1, n - 1); if (seg.length < 2) continue;
      const v = clothTopV(...seg[seg.length >> 1]); if (v < .55) continue;
      st(v > .82 ? 'impasto' : 'body', rnd() < .5 ? 'point' : 'flat small', seg, {w: R(.1, .18) * f.w * (.6 + .6 * v), c: ramp(LINEN, clamp(v + .08, 0, 1)), a: .9}) } }
  flowPassage(CLOTH_TOP, {step: 22, val: clothTopV, vj: .02, ramp: LINEN, only: v => v > .82, dir: dTop, len: [50, 100], w: [6, 11], mat: 'body', brush: ['flat small', 'fil soft'], a: .9});
  flowPassage(CLOTH_HANG, {step: 13, val: clothHangV, vj: .02, ramp: LINEN, only: v => v > .62, dir: dHang, len: [60, 120], w: [3, 6], mat: 'body', brush: ['flat small', 'point'], a: .9});
  flowPassage(CLOTH_TOP, {step: 16, val: clothTopV, ramp: LINEN, only: v => v > .92 && rnd() < .5, dir: dTop, len: [16, 34], w: [3, 6], mat: 'impasto', brush: ['flat small', 'point'], a: .95});
  // the darkest creases: thin dark lines in the hollows of the folds where they lie in shadow
  for (const f of FOLDS) if (f.a < 0) { const path = f.p.filter((_, i) => i % 3 === 0); st('dark', 'point', path, {w: R(2, 4), c: 'linen deep', a: .55}) }
  // the hem and the edge where the cloth folds over the table
  { const hem = spline([[641, EDGE - 1], [652, 690], [650, 718], [640, 752], [628, 790], [621, H + 10]], 8);
    st('dark', 'point', hem.map(p => [p[0] + 2.5, p[1]]), {w: 4, c: 'umber black', a: .8});
    st('body', 'rigger', hem.map(p => [p[0] - 2, p[1]]), {w: 2.2, c: 'linen shade', a: .8});
    // where the cloth rolls over the table's edge it faces the light: a lit band that turns into the shadow of the hanging part
    for (let x = -20; x < 630; x += R(30, 70)) { const len = Math.min(R(50, 110), 640 - x), v = clamp(clothTopV(x + len / 2, EDGE - 4) * .9 + .15, 0, 1); st('body', 'flat small', [[x, EDGE + 2.5 + R(-1, 1)], [x + len, EDGE + 2.5 + R(-1, 1)]], {w: R(5, 7), c: ramp(LINEN, v), a: .85}) }
    for (let x = -20; x < 630; x += R(40, 80)) { const len = Math.min(R(60, 120), 645 - x); st('paint', 'fil soft', [[x, EDGE + 9], [x + len, EDGE + 9 + R(-1, 1)]], {w: 7, c: ramp(LINEN, .3), a: .45}) } }
  dry();
}


/* =====================================================================
   4. The kraak bowl — a surface of revolution
   ===================================================================== */
const bR = t => t <= 1 ? BWL.R0 * (1 - .5 * Math.pow(Math.max(0, t), 1.7)) : t <= 1.04 ? BWL.R0 * .5 - 6 * (t - 1) / .04 : BWL.R0 * .5 - 6;
const bRd = t => t <= 1 ? -BWL.R0 * .5 * 1.7 * Math.pow(Math.max(t, .001), .7) : 0;
const bPt = (th, t) => { const r = bR(t); return [BWL.x + r * Math.cos(th), BWL.y + BWL.H * t + r * BWL.K * Math.sin(th)] };
const bNorm = (th, t) => norm3([BWL.H * Math.cos(th), bRd(t) * .55, BWL.H * Math.sin(th)]);   // outward, world
function bowlOuter() { const o = []; for (let i = 0; i <= 24; i++) o.push(bPt(Math.PI - i / 24 * Math.PI, 0)); for (let i = 0; i <= 12; i++) o.push(bPt(0, i / 12 * 1.1)); for (let i = 0; i <= 16; i++) o.push(bPt(i / 16 * Math.PI, 1.1)); for (let i = 12; i >= 0; i--) o.push(bPt(Math.PI, i / 12 * 1.1)); return o }
const RIM = ellipse(BWL.x, BWL.y, BWL.R0, BWL.R0 * BWL.K, 0, 96);
// light on the outside: diffuse, a bounce from the cloth near the foot, the lemon's yellow near it, and the shadow side
const bowlV = (th, t) => { const n = bNorm(th, t); return clamp(-.08 + 1.25 * diffuse(n) + .18 * Math.max(0, dot3(n, BOUNCE)) * smooth(t), 0, 1) };
const bowlInV = (th, t) => { const n = bNorm(th, t).map(v => -v); const shade = smooth((th - Math.PI - .9) / .9) * (1 - .5 * smooth((t - .2) / .5)); return clamp((.1 + .85 * diffuse(n)) * (.35 + .65 * shade), 0, 1) };
const PORC = [[0, 'porc deep'], [.3, 'porc shade'], [.6, 'porc half'], [.82, 'porc'], [1, 'porc light']];
const BLUE = [[0, 'blue deep'], [.5, 'blue'], [.8, 'blue light'], [1, 'blue wash']];

// a curve over the bowl's surface between two (θ, t) points, a little unsteady as a hand is
const bCurve = (th0, th1, t0, t1, n = 14, jit = .002) => { const path = []; for (let i = 0; i <= n; i++) { const f = i / n; path.push(bPt(th0 + (th1 - th0) * f + R(-jit, jit), t0 + (t1 - t0) * f + R(-jit, jit))) } return path };
// a line drawn with a loaded brush: a faint halo where the blue has run into the glaze, the line itself in two or three strokes
function blueLine(path, col, w, clip, a = .9) { if (path.length < 2) return;
  st('cobalt', 'fil soft', path, {w: w * 2.6, c: km(col, 'blue wash', .5), a: .22, clip});
  const n = path.length, cut = Math.max(2, Math.floor(n * R(.35, .65)));
  for (const part of [path.slice(0, cut + 1), path.slice(cut - 1)]) if (part.length > 1) st('cobalt line', 'point', part, {w: w * R(.8, 1.2), pr: [R(.4, .8), 1, R(.7, 1), R(.5, 1), R(.2, .6)], c: col, a, clip, wob: .3}) }

function bowlInside() {
  stage('Bowl: inside', 'The inner wall seen over the rim: its far side lit, the near side under the shadow of the rim.');
  doc.shapes['bowl inside'] = PT(RIM);
  fl('thin', RIM, {c: 'porc deep', a: .95, soft: .6});
  const strokes = [];
  for (let t = .01; t < .62; t += .03) for (let th = Math.PI - .1; th < 2 * Math.PI + .1;) { const dth = R(.2, .45); strokes.push({path: bCurve(th, th + dth, t, t + R(-.01, .01), 6, .003), v: bowlInV(th + dth / 2, t)}); th += dth * R(.6, .9) }
  shuffle(strokes);
  for (const s of strokes) st('porcelain', 'fil', s.path, {w: R(6, 10), c: ramp(PORC, clamp(s.v + R(-.03, .03), 0, 1)), a: .93, clip: 'bowl inside'});
  for (let k = 0; k < 40; k++) { const t = R(.05, .55), th = R(Math.PI, 2 * Math.PI); st('porcelain', 'soft blender', bCurve(th, th + R(.3, .6), t, t, 6), {w: R(10, 16), a: .5, clip: 'bowl inside'}) }
  dry();
  // a blue border inside the rim: two lines and a scroll between them
  for (const t of [.035, .13]) blueLine(bCurve(Math.PI, 2 * Math.PI, t, t, 40, .002), ramp(BLUE, .45), 2, 'bowl inside', .8);
  for (let th = Math.PI + .05; th < 2 * Math.PI - .05; th += R(.14, .2)) { const a = bPt(th, .06), b = bPt(th + .06, .11); st('cobalt', 'comma', [a, [(a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2], b], {w: 3, c: ramp(BLUE, clamp(bowlInV(th, .08) * .8, 0, 1)), a: .7, clip: 'bowl inside'}) }
  // the far rim: its lip catches the light on the left; a few chips of glaze
  { const back = bCurve(Math.PI, 2 * Math.PI, 0, 0, 48, 0); st('paint', 'point', back, {w: 2.6, c: 'porc half', a: .85}); st('body', 'point', back.slice(0, 20), {w: 2, c: 'porc light', a: .8});
    const chips = []; for (let i = 0; i < 6; i++) { const p = bPt(R(Math.PI, 2 * Math.PI), 0); chips.push([p[0] + R(-1, 1), p[1] + R(-.5, .5), R(.6, 1.3)]) } dots('clean', chips, {c: '#7a5e40', a: .7, soft: .5}) }
  // the lemon lying in the bowl throws its shadow on the far wall, to the right
  fl('shadow glaze', ellipse(LA.x + 58, LA.y + 6, 62, 24, -.15), {a: .45, soft: 8, clip: 'bowl inside'});
  dry();
}

function bowlBody() {
  stage('Bowl: body', 'The white body turned with the brush round its form, light on the left and grey toward the right, a warm bounce near the foot.');
  const out = bowlOuter(); doc.shapes['bowl'] = PT(out);
  fl('thin', out, {c: 'porc shade', a: .95, soft: .4});
  const strokes = [];
  for (let t = 0; t < 1.1; t += .026) for (let th = -.15; th < Math.PI + .15;) { const dth = R(.22, .5); strokes.push({path: bCurve(th, th + dth, Math.min(1.09, t), Math.min(1.09, t + R(-.006, .006)), 6, .002), v: bowlV(th + dth / 2, t), th: th + dth / 2, t}); th += dth * R(.55, .85) }
  shuffle(strokes);
  for (const s of strokes) { const warm = s.t > .6 && s.th < 1.3 ? .22 * smooth((s.t - .6) / .4) * smooth((1.3 - s.th) / .6) : 0;   // the lemon on the cloth throws yellow into the porcelain
    let c = ramp(PORC, clamp(s.v + R(-.04, .04), 0, 1)); if (warm) c = km(c, 'lemon light', warm);
    st('porcelain', s.t > 1 ? 'fil soft' : 'fil', s.path, {w: R(6, 11), c, a: .93, clip: 'bowl'}) }
  for (let k = 0; k < 70; k++) { const t = R(.03, 1.05), th = R(-.2, Math.PI); st('porcelain', 'soft blender', bCurve(th, th + R(.3, .6), t, t, 6), {w: R(10, 16), a: .45, clip: 'bowl'}) }
  dry();
  stage('Bowl: decoration', 'Kraak panels in cobalt: a pale wash in each broad panel, drawn over in deep blue with a flower and leaves; beads in the narrow ones; bands at the rim and the foot.');
  const sz = th => .35 + .65 * Math.max(0, Math.sin(th));   // marks seen face on are full width, at the sides foreshortened
  const bv = (th, t, k = 0) => clamp(bowlV(th, t) * .9 + k + R(-.04, .04), 0, 1);
  const deep = (th, t) => ramp(BLUE, bv(th, t, -.38)), mid = (th, t) => ramp(BLUE, bv(th, t, -.12)), wash = (th, t) => km(ramp(PORC, bv(th, t, -.1)), ramp(BLUE, bv(th, t, -.05)), .42);
  // the rim border: a band of wash between two lines, with a scroll of deep blue in it
  for (let th = -.15; th < Math.PI + .15; th += .12) st('cobalt', 'fil soft', bCurve(th, th + .16, .078, .078, 4, .003), {w: 9, c: wash(th, .08), a: .55, clip: 'bowl'});
  blueLine(bCurve(-.15, Math.PI + .15, .024, .024, 40), deep(1.6, .02), 2.2, 'bowl'); blueLine(bCurve(-.15, Math.PI + .15, .132, .132, 40), deep(1.6, .13), 1.8, 'bowl');
  for (let th = -.1; th < Math.PI + .1; th += .2) { const path = []; for (let i = 0; i <= 8; i++) { const f = i / 8; path.push(bPt(th + .2 * f, .078 + .03 * Math.sin(f * Math.PI * 2))) } st('cobalt line', 'point', path, {w: 2.2 * sz(th), c: deep(th, .08), a: .85, wob: .4, clip: 'bowl'}) }
  // panels: broad ones with an arched top and a flower, narrow ones with beads; double lines between them
  const NP = 11, edges = []; for (let i = 0; i <= NP; i++) edges.push(-.2 + i / NP * (Math.PI + .4));
  for (let i = 0; i < NP; i++) { const a = edges[i], b = edges[i + 1], mid0 = (a + b) / 2, broad = i % 2 === 0, k = sz(mid0);
    for (const d of [.016, -.016]) blueLine(bCurve(b + d, b + d, .17, .88, 10), deep(b, .5), 2 * sz(b) + .3, 'bowl', .85);
    if (broad) {
      const pan = []; for (let q = 0; q <= 8; q++) { const f = q / 8, th = a + .035 + (b - a - .07) * f; pan.push(bPt(th, .25 - .07 * Math.sin(f * Math.PI))) }
      pan.push(bPt(b - .035, .845), bPt(a + .035, .845)); const nm = 'panel ' + i; doc.shapes[nm] = PT(pan);
      fl('cobalt', pan, {c: wash(mid0, .5), a: .7, soft: 1.2});
      for (let q = 0; q < 5; q++) { const th = a + .04 + (b - a - .08) * (q + .5) / 5; st('cobalt', 'flat small', bCurve(th, th + R(-.02, .02), .2, .86, 6, .004), {w: 7 * k + 3, c: km(wash(th, .5), mid(th, .5), R(0, .35)), a: R(.25, .45), clip: nm}) }
      for (let q = 0; q < 4; q++) { const th = a + (b - a) * R(.2, .8); st('cobalt', 'soft blender', bCurve(th, th, .2, .85, 6), {w: 10 * k + 4, a: .5, clip: nm}) }
      blueLine(closed(pan), deep(mid0, .5), 1.9 * k + .4, 'bowl', .85);
      // a peony filling the panel: a ring of petals in mid blue drawn round in deep blue, a dark heart, two broad leaves, a stem, buds
      const ct = R(.4, .46), prT = (b - a) * .33, prV = .1, P2 = (dth, dt) => bPt(mid0 + dth, ct + dt);
      for (let q = 0; q < 8; q++) { const an = q / 8 * 6.283 + R(-.15, .15), e = [Math.cos(an) * prT, Math.sin(an) * prV];
        st('cobalt', 'dab', [P2(e[0] * .25, e[1] * .25), P2(e[0] * .65, e[1] * .65), P2(e[0], e[1])], {w: 9 * k, c: mid(mid0, ct), a: .8, clip: nm});
        const rim = []; for (let r = 0; r <= 6; r++) { const aa = an - .5 + r / 6; rim.push(P2(Math.cos(aa) * prT * 1.02, Math.sin(aa) * prV * 1.02)) } st('cobalt line', 'point', rim, {w: 1.5 * k + .4, c: deep(mid0, ct), a: .85, clip: nm}) }
      for (let q = 0; q < 6; q++) { const an = q / 6 * 6.283 + .3; st('cobalt line', 'comma', [P2(0, 0), P2(Math.cos(an) * prT * .45, Math.sin(an) * prV * .45)], {w: 3 * k, c: deep(mid0, ct), a: .85, clip: nm}) }
      dot('cobalt line', ...P2(0, 0), 2.4 * k, {c: deep(mid0, ct), a: .9});
      st('cobalt line', 'rigger', bCurve(mid0, mid0 + R(-.03, .03), ct + prV, .82, 8, .004), {w: 1.6, c: deep(mid0, .7), a: .85, clip: nm});
      for (const side of [-1, 1]) { const p0 = P2(0, prV + .06), pm = P2(side * prT * .55, prV + .1), p1 = P2(side * prT * 1.05, prV + .2);
        st('cobalt', 'comma', [p0, pm, p1], {w: 8 * k, c: mid(mid0, ct + .2), a: .8, clip: nm}); st('cobalt line', 'point', [p0, pm, p1], {w: 1.1, c: deep(mid0, ct + .2), a: .85, clip: nm});
        const p2 = P2(side * prT * .5, .33), p3 = P2(side * prT * .9, .27); st('cobalt', 'comma', [P2(0, .3), p2, p3], {w: 5 * k, c: mid(mid0, .7), a: .8, clip: nm}) }
      for (const side of [-1, 1]) { dot('cobalt', ...P2(side * prT * .9, -prV * 1.4), 2.4 * k, {c: mid(mid0, ct - .1), a: .8}); st('cobalt line', 'rigger', [P2(side * prT * .9, -prV * 1.2), P2(side * prT * .5, -prV * .6)], {w: 1, c: deep(mid0, ct), a: .8, clip: nm}) }
    } else {
      const pan = [bPt(a + .025, .2), bPt(b - .025, .2), bPt(b - .025, .84), bPt(a + .025, .84)];
      fl('cobalt', pan, {c: km(wash(mid0, .5), ramp(PORC, bv(mid0, .5)), .5), a: .55, soft: 1.2});
      if (Math.sin(mid0) > .3) for (let q = 0; q < 6; q++) { const tt = .26 + q * .095; dot('cobalt', ...bPt(mid0, tt), 2.4 * k, {c: deep(mid0, tt), a: .85}); if (q < 5) st('cobalt line', 'point', [bPt(mid0, tt + .02), bPt(mid0, tt + .075)], {w: 1.1, c: deep(mid0, tt), a: .75, clip: 'bowl'}) }
      for (let q = -1; q <= 1; q++) st('cobalt', 'point', [bPt(mid0, .78), bPt(mid0 + q * .022, .88)], {w: 2.2 * k, c: deep(mid0, .84), a: .85, clip: 'bowl'}) } }
  // the foot: a band between two lines
  blueLine(bCurve(-.15, Math.PI + .15, .965, .965, 40), deep(1.6, .96), 2, 'bowl');
  for (let th = -.15; th < Math.PI + .15; th += .14) st('cobalt', 'fil soft', bCurve(th, th + .18, 1.035, 1.035, 4, .002), {w: 7, c: mid(th + .07, 1.03), a: .75, clip: 'bowl'});
  blueLine(bCurve(-.15, Math.PI + .15, 1.075, 1.075, 40), deep(1.6, 1.07), 1.8, 'bowl');
  dry();
  stage('Bowl: glaze and lights', 'The glassy lights: the window on the shoulder, the lit rim, the chips of glaze at the rim; the foot sitting in its shadow.');
  { const front = bCurve(-.05, Math.PI + .05, .002, .002, 48, 0);
    st('clean', 'point', front, {w: 2.8, c: 'porc half', a: .9});
    for (let i = 0; i < 3; i++) { const t0 = R(.55, .92), t1 = Math.min(1, t0 + R(.05, .15)), seg = front.slice(Math.floor(t0 * 48), Math.floor(t1 * 48)); if (seg.length > 2) st('glint', 'point', seg, {w: 1.8, c: 'porc light', a: .9}) }
    const chips = []; for (let i = 0; i < 9; i++) { const th = R(-.1, Math.PI + .1), p = bPt(th, 0); chips.push([p[0] + R(-1, 1), p[1] + R(-.5, .5), R(.6, 1.3)]) } dots('clean', chips, {c: '#7a5e40', a: .7, soft: .5}) }
  // the window on the shoulder: a soft band of light down the wall, and one crisp touch in it
  { let best = null, bvv = -1; for (let th = .3; th < Math.PI; th += .02) for (let t = .2; t < .6; t += .02) { const sp = spec(bNorm(th, t), 40); if (sp > bvv) { bvv = sp; best = [th, t] } }
    const [th0, t0] = best;
    for (let q = 0; q < 5; q++) { const th = th0 + R(-.035, .035); st('glint', 'fil soft', bCurve(th, th + R(-.015, .015), Math.max(.16, t0 - R(.14, .22)), Math.min(.82, t0 + R(.18, .28)), 6, .002), {w: R(5, 8), c: km('porc', 'porc light', R(.6, 1)), a: .75, clip: 'bowl'}) }
    st('glint', 'point', bCurve(th0 - .01, th0 - .012, t0 - .12, t0 + .14, 5, 0), {w: 3.2, c: 'porc light', a: .95, clip: 'bowl'});
    st('glint', 'point', bCurve(-.1 + th0 * .15, -.1 + th0 * .15, .25, .55, 4, 0), {w: 2, c: 'porc half', a: .5, clip: 'bowl'});
    st('porcelain', 'fil soft', bCurve(th0 - .4, th0 - .42, t0 + .05, t0 + .3, 5), {w: 3, c: 'porc half', a: .45, clip: 'bowl'}) }
  fl('shadow glaze', {curve: [[BWL.x - 70, FOOT_Y - 6], [BWL.x + 20, FOOT_Y - 10], [BWL.x + 120, FOOT_Y - 6], [BWL.x + 30, FOOT_Y + 6]]}, {a: .45, soft: 5});
  dry();
}

/* =====================================================================
   5. Lemons — ellipsoids with a nipple at each end
   ===================================================================== */
const lemR = (L, th) => 1 + L.nip * Math.exp(-Math.pow(Math.atan2(Math.sin(th), Math.cos(th)) / .2, 2)) + L.nip2 * Math.exp(-Math.pow(Math.atan2(Math.sin(th - Math.PI), Math.cos(th - Math.PI)) / .25, 2));
function lemonOutline(L, n = 72) { const o = [], c = Math.cos(L.ang), s = Math.sin(L.ang); for (let i = 0; i < n; i++) { const th = i / n * 2 * Math.PI, r = lemR(L, th), x = Math.cos(th) * L.rx * r, y = Math.sin(th) * L.ry * (1 - .25 * (r - 1)); o.push([L.x + x * c - y * s, L.y + x * s + y * c]) } return o }
const lemLocal = (L, x, y) => { const dx = x - L.x, dy = y - L.y, c = Math.cos(L.ang), s = Math.sin(L.ang); return [dx * c + dy * s, -dx * s + dy * c] };
const lemPt = (L, u, v) => { const c = Math.cos(L.ang), s = Math.sin(L.ang), x = u * L.rx, y = v * L.ry; return [L.x + x * c - y * s, L.y + x * s + y * c] };
// the world normal of the lemon at a page point
function lemNormal(L, x, y) { const [lx, ly] = lemLocal(L, x, y), th = Math.atan2(ly / L.ry, lx / L.rx), r = lemR(L, th), u = lx / (L.rx * r), v = ly / (L.ry * (1 - .25 * (r - 1))), q = u * u + v * v, w = Math.sqrt(Math.max(0, 1 - q));
  const nl = norm3([u * L.ry / L.rx * (r > 1.02 ? 1.6 : 1), v, w]), c = Math.cos(L.ang), s = Math.sin(L.ang);
  return viewToWorld(norm3([nl[0] * c - nl[1] * s, -(nl[0] * s + nl[1] * c), nl[2]])) }
const LEM = [[0, 'lemon deep'], [.25, 'lemon shade'], [.42, 'lemon olive'], [.56, 'lemon half'], [.68, 'lemon mid'], [.8, 'lemon'], [.9, 'lemon light'], [1, 'lemon top']];
const LL = norm3([-.62, .56, .55]);   // the lemons are lit a little more from the front than the rest: a painter's licence, so that each shows a broad light
const lemV = (L, x, y, occl = () => 1) => { const n = lemNormal(L, x, y); const d = Math.max(0, (dot3(n, LL) + .12) / 1.12); return clamp((.03 + 1.0 * Math.pow(d, 1.15)) * occl(x, y) + .16 * Math.max(0, dot3(n, BOUNCE)), 0, 1) };

// a stroke that runs over the lemon's surface: along its length (v fixed) or round its girth (u fixed), in its own (u, v) frame
function lemCurve(L, u0, v0, along, len, n = 6) { const path = []; for (let i = 0; i <= n; i++) { const f = (i / n - .5) * len;
    if (along) { const u = u0 + f; path.push(lemPt(L, u, v0 * Math.sqrt(Math.max(0, 1 - u * u * .35)))) } else { const v = v0 + f; path.push(lemPt(L, u0 * Math.sqrt(Math.max(0, 1 - v * v * .25)), v)) } } return path }
const inDisc = (lim = 1) => { for (;;) { const u = R(-1, 1), v = R(-1, 1); if (u * u + v * v <= lim) return [u, v] } };
function lemon(L, name, occl = () => 1, opt = {}) {
  const out = lemonOutline(L), V = (x, y) => lemV(L, x, y, occl), k = L.rx / 74, poly = opt.poly || out, nm = 'lemon ' + name;
  doc.shapes[nm] = PT(opt.base || out);
  const S = (path, o) => st(o.mat || 'skin', o.brush, path, Object.assign({clip: nm}, o));
  stage(name, 'A dark ochre ground, the yellow turned round the form and softened, the lights laid thick into it, the window on the shoulder.');
  fl('thin', opt.base || poly, {c: ramp(LEM, .25), a: .95, soft: .7});
  // the body: strokes along the form, coloured by the light where they lie
  for (let i = 0; i < (opt.n || 230); i++) { const [u0, v0] = opt.uv ? opt.uv() : inDisc(), along = rnd() < .55, path = within(lemCurve(L, u0, v0, along, R(.3, .6)), poly); if (path.length < 2) continue;
    const v = clamp(V(...lemPt(L, u0, v0)) + R(-.04, .04), 0, 1); S(path, {brush: rnd() < .5 ? 'round' : 'fil soft', w: R(9, 15) * k, c: ramp(LEM, v), a: .95, load: 140}) }
  // the ends: the nipple and the stem end drawn out along the axis
  for (const [u0, u1] of opt.noNip ? [] : [[.78, 1.22]]) for (let q = 0; q < 6; q++) { const v0 = R(-.18, .18), p0 = lemPt(L, u0, v0), p1 = lemPt(L, u1, v0 * .2); S([p0, p1], {brush: 'round', w: R(5, 8) * k, pr: [1, .9, .6, .25], c: ramp(LEM, clamp(V(...p0) * .92, 0, 1)), a: .9}) }
  // the edge turning away, firmed all round with the colour of the shadow side
  { const ring = out.concat([out[0]]); let seg = [];
    const flush = () => { if (seg.length > 3) S(seg, {mat: 'skin', brush: 'point', w: 6 * k, c: ramp(LEM, clamp(V(...seg[seg.length >> 1]) * .8, 0, 1)), a: .55}); seg = [] };
    for (const p of ring) { if (inPoly(p[0], p[1], opt.base || poly)) seg.push(p); else flush(); if (seg.length > 8) { const q = seg[seg.length - 1]; flush(); seg.push(q) } } flush() }
  // softened along the form while it is wet
  for (let i = 0; i < (opt.nb || 70) + 30; i++) { const [u0, v0] = opt.uv ? opt.uv() : inDisc(.9), path = within(lemCurve(L, u0, v0, rnd() < .5, R(.3, .5)), poly); if (path.length > 1) S(path, {brush: 'soft blender', w: R(10, 16) * k, a: .55}) }
  dry(.5);
  // the lights, stiffer, only where the light is, softened into each other; the pores show in them
  const lights = []; for (let i = 0; i < (opt.nl || 160); i++) { const [u0, v0] = opt.uv ? opt.uv() : inDisc(.9), p = lemPt(L, u0, v0), v = V(...p); if (v < .6) continue; lights.push({u0, v0, v}) }
  lights.sort((a, b) => a.v - b.v);
  for (const s of lights) { const path = within(lemCurve(L, s.u0, s.v0, rnd() < .6, R(.2, .42), 5), poly); if (path.length < 2) continue;
    S(path, {mat: 'skin light', brush: rnd() < .5 ? 'point' : 'fil soft', w: R(4, 7) * k, c: ramp(LEM, clamp(s.v + .05, 0, 1)), a: .82}) }
  for (const s of lights.filter(() => rnd() < .5)) { const path = within(lemCurve(L, s.u0, s.v0, rnd() < .5, R(.2, .35), 4), poly); if (path.length > 1) S(path, {brush: 'soft blender', w: R(6, 10) * k, a: .35}) }
  // reflected light in the shadow, from the cloth beneath: warm and low
  for (let i = 0; i < 14; i++) { const th = R(.6, 2.4), u0 = Math.cos(th) * .86, v0 = Math.sin(th) * .86, p = lemPt(L, u0, v0), n = lemNormal(L, ...p), b = Math.max(0, dot3(n, BOUNCE)); if (b < .3) continue;
    const path = within(lemCurve(L, u0, v0, true, R(.2, .4), 4), poly); if (path.length > 1) S(path, {brush: 'point', w: R(3, 6) * k, c: km(ramp(LEM, V(...p)), 'lemon warm', .35 * b), a: .6}) }
  // the window on the shoulder: small, sharp, broken
  { let best = null, bv = -1; for (let u = -.9; u <= .9; u += .03) for (let v = -.9; v <= .9; v += .03) { if (u * u + v * v > .85) continue; const p = lemPt(L, u, v); if (!inPoly(p[0], p[1], poly)) continue; const s = spec(lemNormal(L, ...p), 30) * (1 - .45 * Math.abs(u)); if (s > bv) { bv = s; best = [u, v] } }
    if (best) { for (let i = 0; i < 6; i++) { const path = lemCurve(L, best[0] + R(-.08, .08), best[1] + R(-.06, .06), true, R(.06, .14), 3); S(path, {mat: 'impasto', brush: 'dab', w: R(3, 5) * k, c: km('lemon light', 'lemon top', R(.3, 1)), a: .92}) }
      S(lemCurve(L, best[0] - .03, best[1] - .02, true, .1, 3), {mat: 'glint', brush: 'comma', w: 2.4 * k, c: 'lemon glint', a: .95}) } }
  // the stem end, a small brown star
  if (!opt.noStem) { const sp = lemPt(L, -1.06, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + R(-.3, .3); st('clean', 'point', [sp, [sp[0] + Math.cos(a) * 3 * k, sp[1] + Math.sin(a) * 3 * k]], {w: 1.3, c: 'lemon shade', a: .8}) } dot('clean', sp[0], sp[1], 1.5 * k, {c: '#4a3a1f', a: .85}) }
  dry();
}

/* =====================================================================
   6. The cut lemon, its peel, the knife
   ===================================================================== */
const FACE = {x: LC.x - 2, y: LC.y, rx: LC.face.rx, ry: LC.face.ry, ang: LC.ang};
const facePt = (u, v) => { const c = Math.cos(FACE.ang), s = Math.sin(FACE.ang), x = u * FACE.rx, y = v * FACE.ry; return [FACE.x + x * c - y * s, FACE.y + x * s + y * c] };
const LCL = {x: LC.x, y: LC.y, rx: LC.rx, ry: LC.ry, ang: LC.ang, nip: .2, nip2: 0};
function rindPolygon() { const L = LCL, o = [];
  for (let i = 0; i <= 40; i++) { const th = -Math.PI / 2 + i / 40 * Math.PI, r = lemR(L, th), x = Math.cos(th) * L.rx * r, y = Math.sin(th) * L.ry * (1 - .25 * (r - 1)), c = Math.cos(L.ang), s = Math.sin(L.ang); o.push([L.x + x * c - y * s, L.y + x * s + y * c]) }
  for (let i = 1; i < 30; i++) { const th = Math.PI / 2 + i / 30 * Math.PI; o.push(facePt(Math.cos(th), Math.sin(th))) } return o }

function cutLemon() {
  const rindPoly = rindPolygon();
  stage('Cut lemon: its shadow', 'The shadow the half lemon throws to the right along the table, darkest where it touches.');
  fl('shadow glaze', {curve: [[LC.x - 40, 646], [LC.x + 40, 640], [LC.x + 130, 640], [LC.x + 150, 650], [LC.x + 40, 656]]}, {a: .55, soft: 6});
  st('shadow glaze', 'fil soft', [[LC.x - 40, 648], [LC.x + 20, 651], [LC.x + 80, 646]], {w: 6, a: .6});
  dry();
  // the rind is painted as a lemon whose left half is cut away: only strokes on the right of the cut
  const rindInner = rindPoly.slice(0, 41).concat(rindPoly.slice(41).map(p => [FACE.x + (p[0] - FACE.x) * .75, FACE.y + (p[1] - FACE.y) * .75]));
  lemon(LCL, 'Cut lemon: rind', () => 1.3, {poly: rindInner, base: rindPoly, noStem: true, n: 200, nl: 150, nb: 60, uv: () => { for (;;) { const u = R(-.1, 1), v = R(-1, 1); if (u * u + v * v <= 1) return [u, v] } }});
  const face = ellipse(FACE.x, FACE.y, FACE.rx, FACE.ry, FACE.ang, 72);
  doc.shapes['cut face'] = PT(face);
  stage('Cut lemon: the cut face', 'Pith, the ring of rind, segments of wet pulp drawn out from the core, pale membranes, a pip, beads of juice.');
  const lit = a => .5 + .5 * Math.cos(a - 3.6);   // where on the face the light is strongest: the upper left
  fl('paint', face, {c: 'pith', a: .97, soft: .4});
  // the ring of rind, lit where it faces the window
  for (let a = 0; a < 6.3; a += .45) { const path = []; for (let q = 0; q <= 4; q++) { const t = a + q / 4 * .5; path.push(facePt(Math.cos(t) * .955, Math.sin(t) * .955)) } st('skin', 'point', path, {w: 3.6, c: ramp(LEM, .45 + .5 * lit(a + .25)), a: .95, clip: 'cut face'}) }
  // the pith in shadow toward the lower right
  { const path = []; for (let q = 0; q <= 10; q++) { const t = -.4 + q / 10 * 2.2; path.push(facePt(Math.cos(t) * .87, Math.sin(t) * .87)) } st('paint', 'fil soft', path, {w: 5, c: 'pith shade', a: .6, clip: 'cut face'}) }
  // segments
  const NSEG = 10, rot = R(0, 1), segs = [];
  for (let i = 0; i < NSEG; i++) { const a0 = (i + rot) / NSEG * 2 * Math.PI, a1 = (i + 1 + rot) / NSEG * 2 * Math.PI, am = (a0 + a1) / 2, wedge = [];
    for (let q = 0; q <= 6; q++) { const a = a0 + .07 + (a1 - a0 - .14) * q / 6; wedge.push(facePt(Math.cos(a) * .8, Math.sin(a) * .8)) }
    wedge.push(facePt(Math.cos(a1 - .1) * .2, Math.sin(a1 - .1) * .2), facePt(Math.cos(am) * .11, Math.sin(am) * .11), facePt(Math.cos(a0 + .1) * .2, Math.sin(a0 + .1) * .2));
    segs.push({a0, a1, am, wedge, l: lit(am)}) }
  for (const g of segs) fl('paint', g.wedge, {c: km('pulp deep', 'pulp', .35 + .65 * g.l), a: .97, soft: .5});
  // the juice sacs: little strokes drawn out from the core, deeper at the outside, paler where the light falls
  for (const g of segs) for (let q = 0; q < 16; q++) { const a = g.a0 + .12 + (g.a1 - g.a0 - .24) * rnd(), r0 = R(.14, .5), r1 = Math.min(.79, r0 + R(.12, .3));
    const path = within([facePt(Math.cos(a) * r0, Math.sin(a) * r0), facePt(Math.cos(a) * (r0 + r1) / 2, Math.sin(a) * (r0 + r1) / 2), facePt(Math.cos(a) * r1, Math.sin(a) * r1)], g.wedge);
    if (path.length > 1) st('paint', 'point', path, {w: R(1.8, 3.6), c: km(rnd() < .35 ? 'pulp deep' : 'lemon light', 'pulp light', clamp(g.l * R(0, .9) + (1 - r1) * .15, 0, 1)), a: .85, clip: 'cut face'}) }
  dry();
  // membranes from the core to the pith, tapering
  for (const g of segs) { const a = g.a0 + R(-.03, .03); st('clean', 'point', [facePt(Math.cos(a) * .1, Math.sin(a) * .1), facePt(Math.cos(a + R(-.03, .03)) * .45, Math.sin(a) * .45), facePt(Math.cos(a) * .84, Math.sin(a) * .84)], {w: 1.5, pr: [.4, .7, 1, 1, .8], c: km('pith', 'pith shade', .7 - .7 * lit(a)), a: .85, clip: 'cut face'}) }
  // the core
  { const core = []; for (let q = 0; q < 9; q++) { const a = q / 9 * 6.283, r = R(.07, .13); core.push(facePt(Math.cos(a) * r, Math.sin(a) * r)) } fl('clean', {curve: PT(core)}, {c: 'pith', a: .95, soft: .4}) }
  // a pip lying in a segment
  { const g = segs[3], a = g.am, p0 = facePt(Math.cos(a) * .32, Math.sin(a) * .32), p1 = facePt(Math.cos(a) * .52, Math.sin(a) * .52); st('clean', 'dab', [p0, p1], {w: 5, c: 'pith shade', a: .95}); st('clean', 'point', [p0, p1].map(p => [p[0] - .8, p[1] - .8]), {w: 1.4, c: 'pith', a: .9}) }
  // the face darkens a little toward the table
  st('shadow glaze', 'fil soft', [facePt(.1, .98), facePt(.75, .66), facePt(1, .15)], {w: 10, a: .22, clip: 'cut face'});
  dry();
  // juice: beads that catch the window
  { const beads = []; for (let k = 0; k < 22; k++) { const a = R(0, 6.283), r = Math.sqrt(rnd()) * .76; beads.push([...facePt(Math.cos(a) * r, Math.sin(a) * r), R(.4, 1.3) * (.5 + .7 * lit(a))]) } dots('juice', beads, {dome: 1.4});
    for (let k = 0; k < 10; k++) { const a = R(0, 6.283), r = R(.25, .7), p0 = facePt(Math.cos(a) * r, Math.sin(a) * r), p1 = facePt(Math.cos(a) * (r + R(.06, .14)), Math.sin(a) * (r + .1)); st('juice', 'dab', [p0, p1], {w: R(1.6, 2.6), a: .6, clip: 'cut face'}) }
    dry('still');
    const gl = []; for (const b of beads) if (rnd() < .55) gl.push([b[0] - b[2] * .3, b[1] - b[2] * .35, Math.max(.35, b[2] * .35)]); dots('glint', gl, {c: 'lemon glint', a: .95}) }
  st('glint', 'comma', [facePt(-.62, -.5), facePt(-.42, -.68), facePt(-.15, -.8)], {w: 2.2, c: 'lemon glint', a: .85});
  for (let q = 0; q < 7; q++) { const a = R(3.0, 4.4), r = R(.3, .7), p0 = facePt(Math.cos(a) * r, Math.sin(a) * r); st('glint', 'dab', [p0, [p0[0] + R(-1.5, 1.5), p0[1] + R(1, 3)]], {w: R(1.2, 2.2), c: 'lemon glint', a: .9}) }
  // the cut edge of the rind, a sharp line of light where it faces the window
  { const path = []; for (let q = 0; q <= 12; q++) { const t = 2.4 + q / 12 * 2; path.push(facePt(Math.cos(t), Math.sin(t))) } st('glint', 'point', path, {w: 1.6, c: 'lemon top', a: .8}) }
  dry();
}

/* the peel: a ribbon in space. It leaves the lemon lying flat on the table, bends over the edge and hangs in a loosening helix.
   World: x right, y up from the table top, z toward the viewer from the front edge. */
const pg = (x, y, z) => [x, EDGE - y * cE + z * sE];
function peelRibbon() { const S = [];   // samples: centre P, width direction B, normal N (the outside of the peel), half width
  const lie = spline([[LC.x + 40, 2, -120], [LC.x + 64, 2.5, -96], [PEEL.x - 32, 3, -64], [PEEL.x - 12, 3, -30], [PEEL.x, 2, 0]].map(p => [p[0], p[2]]), 10);
  for (let i = 0; i < lie.length; i++) { const a = lie[Math.max(0, i - 1)], b = lie[Math.min(lie.length - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
    S.push({P: [lie[i][0], 2.5, lie[i][1]], B: [-tz / l, 0, tx / l], N: [0, 1, 0], hw: 8.5}) }
  // over the edge: a quarter turn from lying to hanging
  for (let q = 1; q <= 6; q++) { const a = q / 6 * Math.PI / 2; S.push({P: [PEEL.x, 2.5 - 5 * Math.sin(a) - 2.5 * (1 - Math.cos(a)), 5 * (1 - Math.cos(a)) * .4], B: [1, 0, 0], N: [0, Math.cos(a), Math.sin(a)], hw: 7.8}) }
  // the helix, its axis in front of the table's face, loosening and narrowing as it falls
  const turns = 2.7, N = 260; let y = -6;
  for (let i = 0; i <= N; i++) { const f = i / N, ph = -Math.PI / 2 + f * turns * 2 * Math.PI, Rr = 26 - 9 * f, pitch = 44 - 10 * f, hw = 7.8 - 3.6 * f * f;
    if (i) y -= pitch / (N / turns);
    const xc = PEEL.x + 6 * f, zc = Rr + 2, P = [xc + Rr * Math.cos(ph), y, zc + Rr * Math.sin(ph)], N3 = [Math.cos(ph), 0, Math.sin(ph)];
    const tilt = Math.atan2(pitch, 2 * Math.PI * Rr), T = norm3([-Math.sin(ph) * Math.cos(tilt), -Math.sin(tilt), Math.cos(ph) * Math.cos(tilt)]);
    const B = norm3([T[1] * N3[2] - T[2] * N3[1], T[2] * N3[0] - T[0] * N3[2], T[0] * N3[1] - T[1] * N3[0]]);
    S.push({P, B, N: N3, hw, f}) }
  return S }
function peel() {
  stage('Peel', 'The ribbon of peel: yellow outside, white pith inside; it lies across the table, curls over the edge and hangs free.');
  const S = peelRibbon(), runs = [];
  let cur = null;
  for (let i = 0; i < S.length; i++) { const s = S[i], out = dot3(s.N, VW) >= 0, back = s.P[2] < (s.f !== undefined ? 2 + (26 - 9 * s.f) : -1e9);
    if (!cur || cur.out !== out || cur.back !== back) { if (cur) cur.s.push(s); cur = {out, back, s: cur ? [cur.s[cur.s.length - 1], s] : [s]}; runs.push(cur) } else cur.s.push(s) }
  const band = r => r.s.map(s => pg(s.P[0] + s.B[0] * s.hw, s.P[1] + s.B[1] * s.hw, s.P[2] + s.B[2] * s.hw)).concat(r.s.slice().reverse().map(s => pg(s.P[0] - s.B[0] * s.hw, s.P[1] - s.B[1] * s.hw, s.P[2] - s.B[2] * s.hw)));
  const shade = (s, out) => { const n = out ? s.N : s.N.map(v => -v); return clamp(.22 + .85 * Math.pow(Math.max(0, (dot3(n, LW) + .2) / 1.2), 1.1), 0, 1) };
  // its shadow: on the table under the lying part, and thrown onto the face of the table by the hanging part
  { const L2 = norm3([LW[0], LW[1], LW[2] * 2.2]), proj = (x, y, z) => { const t = Math.max(0, z) / L2[2]; return pg(x - L2[0] * t, y - L2[1] * t, 0) };
    const hang = S.filter(s => s.P[1] < 0), shp = hang.map(s => proj(s.P[0] + s.B[0] * s.hw, s.P[1] + s.B[1] * s.hw, s.P[2])).concat(hang.slice().reverse().map(s => proj(s.P[0] - s.B[0] * s.hw, s.P[1] - s.B[1] * s.hw, s.P[2])));
    for (let i = 0; i + 8 < hang.length; i += 6) { const a = hang.slice(i, i + 9), poly = a.map(s => proj(s.P[0] + s.B[0] * s.hw, s.P[1] + s.B[1] * s.hw, s.P[2])).concat(a.slice().reverse().map(s => proj(s.P[0] - s.B[0] * s.hw, s.P[1] - s.B[1] * s.hw, s.P[2]))); fl('shadow glaze', poly, {a: .4, soft: 3}) }
    const lying = S.filter(s => s.P[1] >= 0); fl('shadow glaze', lying.map(s => pg(s.P[0] + s.B[0] * s.hw + 4, 0, s.P[2] + s.B[2] * s.hw - 6)).concat(lying.slice().reverse().map(s => pg(s.P[0] - s.B[0] * s.hw + 4, 0, s.P[2] - s.B[2] * s.hw - 6))), {a: .5, soft: 3}) }
  // back runs first (we see their inside, the pith), then the front (the yellow outside)
  let k = 0;
  for (const pass of [true, false]) { for (const r of runs) { if (r.back !== pass || r.s.length < 2) continue; const poly = band(r), nm = 'peel ' + (k++); doc.shapes[nm] = PT(poly);
      const mid = r.s[r.s.length >> 1], v = shade(mid, r.out);
      fl(r.out ? 'peel' : 'body', poly, {c: r.out ? ramp(LEM, v * .9) : km('pith shade', 'pith', v), a: .97, soft: .35});
      for (let i = 0; i < r.s.length - 1; i += 4) { const seg = r.s.slice(i, i + 9); if (seg.length < 2) continue; const sv = shade(seg[seg.length >> 1], r.out), wd = Math.max(2, seg[0].hw * 1.6 * Math.abs(seg[0].B[1] || 1));
        const path = seg.map(s => pg(...s.P)); st(r.out ? 'peel' : 'body', 'flat small', path, {w: Math.min(wd, 14), c: r.out ? ramp(LEM, sv) : km('pith shade', 'pith', sv), a: .7, clip: nm}) }
      if (r.out) { const edge = r.s.map(s => pg(s.P[0] + s.B[0] * s.hw * .9, s.P[1] + s.B[1] * s.hw * .9, s.P[2] + s.B[2] * s.hw * .9)); st('clean', 'point', resamp(edge, 3), {w: 1.3, c: 'pith', a: .75, clip: nm}) } }
    if (pass) dry() }
  dry();
  // the lights on the peel where it turns to the window
  for (const r of runs) if (r.out) { for (let i = 1; i < r.s.length - 2; i += 3) { const s = r.s[i], v = shade(s, true); if (v < .78) continue; const p = pg(...s.P), q = pg(...r.s[i + 1].P); st('skin light', 'dab', [p, q], {w: R(2.5, 4.5), c: ramp(LEM, Math.min(1, v + .08)), a: .95}) } }
  dry();
}

function knife() {
  stage('Knife', 'A pewter blade lying on the table with its dark handle over the edge: the cold light along its back, the lemon reflected near its point.');
  const d = [KN.bol[0] - KN.tip[0], KN.bol[1] - KN.tip[1]], Lb = Math.hypot(...d), u = [d[0] / Lb, d[1] / Lb], nv = [-u[1], u[0]];
  const B = (s, o) => [KN.tip[0] + u[0] * s + nv[0] * o, KN.tip[1] + u[1] * s + nv[1] * o];
  const blade = []; for (let i = 0; i <= 20; i++) { const s = i / 20 * Lb; blade.push(B(s, -1.5 * Math.min(1, s / 20))) }
  for (let i = 20; i >= 0; i--) { const s = i / 20 * Lb, w = 15 * Math.pow(Math.sin(Math.min(1, s / (Lb * .4)) * Math.PI / 2), .7); blade.push(B(s, w)) }
  doc.shapes['blade'] = PT(blade);
  fl('shadow glaze', blade.map(p => [p[0] + 6, p[1] - 1]), {a: .45, soft: 2.5});
  fl('pewter', blade, {c: 'pewter', soft: .4});
  // the blade: darker along the edge, lighter toward the back, where it faces the light
  for (let k = 0; k < 7; k++) { const o = 13.5 - k * 2.05, v = k / 6; st('pewter paint', 'point', [B(Lb * R(.04, .15), o * .6), B(Lb * .5, o), B(Lb - 1, o)], {w: 2.4, c: km(k < 2 ? 'pewter deep' : 'pewter', 'pewter light', v), a: .75, clip: 'blade'}) }
  st('pewter paint', 'fil soft', [B(Lb * .15, 8), B(Lb * .5, 10), B(Lb * .9, 10)], {w: 5, c: km('pewter light', 'linen', .5), a: .6, clip: 'blade'});   // the white cloth seen in the blade
  st('pewter paint', 'fil soft', [B(Lb * .55, 6), B(Lb * .75, 7), B(Lb * .95, 7)], {w: 4, c: km('pewter', 'lemon half', .4), a: .45, clip: 'blade'});   // and the lemon
  st('glint', 'point', [B(Lb * .18, .4), B(Lb * .5, .1), B(Lb * .8, .3)], {w: 1.6, c: 'porc light', a: .95, clip: 'blade'});
  st('clean', 'point', blade.slice(21).map(p => [p[0], p[1]]), {w: 1, c: 'pewter deep', a: .6});
  // bolster: a collar of brighter metal
  const bol = [B(Lb - 2, -4.5), B(Lb + 10, -5.5), B(Lb + 10, 17), B(Lb - 2, 16)]; doc.shapes['bolster'] = PT(bol);
  fl('pewter', bol, {c: 'pewter light', soft: .3});
  st('pewter paint', 'point', [B(Lb + 1, -3.5), B(Lb + 1, 15)], {w: 2.2, c: 'pewter deep', a: .8, clip: 'bolster'});
  st('pewter paint', 'point', [B(Lb + 8, -3.5), B(Lb + 8, 15)], {w: 2, c: 'pewter deep', a: .7, clip: 'bolster'});
  st('glint', 'point', [B(Lb + 4, -3.5), B(Lb + 4.5, 4)], {w: 1.6, c: 'porc light', a: .9});
  // the handle: a dark cylinder, lit along its top, over the edge
  const hd = [KN.end[0] - KN.bol[0], KN.end[1] - KN.bol[1]], Lh = Math.hypot(...hd), hu = [hd[0] / Lh, hd[1] / Lh], hn = [-hu[1], hu[0]];
  const Hh = (s, o) => [KN.bol[0] + hu[0] * (s + 10) + hn[0] * (o + 6), KN.bol[1] + hu[1] * (s + 10) + hn[1] * (o + 6)];
  const handle = []; for (let i = 0; i <= 10; i++) handle.push(Hh(i / 10 * (Lh - 9), -10.5 - i * .25)); for (let i = 10; i >= 0; i--) handle.push(Hh(i / 10 * (Lh - 9), 10.5 + i * .25));
  doc.shapes['handle'] = PT(handle);
  // shadow: on the table, and down the face of the table where the handle overhangs
  // on the cloth where the handle still lies on the table; on the hanging cloth below where it projects into the air
  { const on = handle.filter(p => p[1] < EDGE - 2); if (on.length > 2) fl('shadow glaze', on.map(p => [p[0] + 9, p[1] - 1]), {a: .45, soft: 3});
    const hs = [], hb = []; for (let i = 0; i <= 10; i++) { const p = Hh(i / 10 * (Lh - 9), 0); if (p[1] < EDGE - 4) continue; const d = p[0] - Hh(0, 0)[0]; hs.push([p[0] + 10 + d * .15, p[1] + 3 + d * .3]); hb.push([p[0] + 10 + d * .15, p[1] + 21 + d * .3]) }
    if (hs.length > 1) fl('shadow glaze', hs.concat(hb.reverse()), {a: .4, soft: 9}) }
  fl('thin', handle, {c: 'ebony', a: .97, soft: .5});
  for (let k = 0; k < 12; k++) { const o = -10 + k * 1.8, v = clamp(1 - Math.abs(o + 4) / 7, 0, 1) * .9;
    st('dark', 'point', [Hh(R(0, 4), o), Hh((Lh - 9) / 2, o + R(-.4, .4)), Hh(Lh - 9 - R(0, 4), o)], {w: 2.6, c: km('ebony', 'ebony light', v), a: .9, clip: 'handle'}) }
  st('body', 'point', [Hh(4, -4.5), Hh((Lh - 9) * .5, -4.6), Hh(Lh - 16, -4.4)], {w: 2.4, c: 'ebony light', a: .85, clip: 'handle'});
  st('glint', 'point', [Hh(10, -5), Hh(30, -5.1)], {w: 1.5, c: 'porc half', a: .8});
  // a pewter cap at the end
  { const e = [Hh(Lh - 16, -9.8), Hh(Lh - 16, 9.8), Hh(Lh - 8, 10.2), Hh(Lh - 8, -10.2)]; doc.shapes['cap'] = PT(e); fl('pewter', e, {c: 'pewter', soft: .3}); st('pewter paint', 'point', [Hh(Lh - 12, -8), Hh(Lh - 12, 8)], {w: 3, c: 'pewter light', a: .6, clip: 'cap'}); st('glint', 'point', [Hh(Lh - 13, -8), Hh(Lh - 12, -3)], {w: 1.4, c: 'porc light', a: .85}) }
  dry();
}

/* =====================================================================
   7. Last things: cast shadows deepened, pips, the edges
   ===================================================================== */
function accents() {
  stage('Shadows and accents', 'Contact shadows deepened with a glaze; two pips on the table; the darkest darks last.');
  // contact shadows, where things touch what they stand on
  fl('shadow glaze', {curve: [[LB.x - 60, LB.y + LB.ry - 4], [LB.x + 20, LB.y + LB.ry - 6], [LB.x + 110, LB.y + LB.ry - 6], [LB.x + 30, LB.y + LB.ry + 6]]}, {a: .45, soft: 5});

  // pips
  for (const [x, y, a] of [[LC.x - 62, 661, .3], [LC.x - 44, 657, -.5]]) { const ca = Math.cos(a), sa = Math.sin(a), seed = []; for (let q = 0; q < 14; q++) { const t = q / 14 * 6.283, rx = Math.cos(t) > 0 ? 5.5 : 4.2, ry = 2.4 * (Math.cos(t) > 0 ? 1 - .55 * Math.cos(t) * Math.cos(t) : 1); seed.push([x + Math.cos(t) * rx * ca - Math.sin(t) * ry * sa, y + Math.cos(t) * rx * sa + Math.sin(t) * ry * ca]) }
    fl('shadow glaze', seed.map(p => [p[0] + 3, p[1] + 1.2]), {a: .6, soft: 1.2}); fl('body', seed, {c: km('pith shade', 'lemon olive', .35), soft: .3}); st('body', 'point', [[x - 3 * ca, y - 3 * sa - 1], [x + 3 * ca, y + 3 * sa - 1]], {w: 1.6, c: 'pith', a: .8}); dot('glint', x - 1.5 * ca, y - 1.4, .6, {c: 'porc light', a: .9}) }
}

/* ---------- a preview of the light, without paint: PREVIEW=out.png node paintings/lemons.gen.mjs ----------
   Every object's value field pushed through its colour ramp, pixel by pixel, in the order of painting. It shows at once whether the
   chiaroscuro and the forms read, before any stroke is laid. */
if (process.env.PREVIEW) {
  const {deflateSync} = await import('node:zlib');
  const S = .5, w = W * S, h = H * S, img = new Uint8Array(w * h * 3);
  const lut = st => { const o = []; for (let i = 0; i <= 64; i++) o.push(ramp(st, i / 64)); return v => o[Math.round(clamp(v, 0, 1) * 64)] };
  const LW_ = lut(WALL), LWO = lut(WOOD), LLI = lut(LINEN), LPO = lut(PORC), LLE = lut(LEM);
  const set = (x, y, c) => { const i = (Math.round(y * S) * w + Math.round(x * S)) * 3; if (x < 0 || y < 0 || x >= W || y >= H) return; for (let k = 0; k < 3; k++) img[i + k] = Math.round(clamp(Math.pow(c[k], 1 / 2.2), 0, 1) * 255) };
  const lin = c => c.map(v => Math.pow(v, 2.2));
  const each = f => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const x = i / S, y = j / S, c = f(x, y); if (c) set(x, y, lin(c)) } };
  each((x, y) => y < BACK ? LW_(wallV(x, y)) : y < EDGE ? LWO(woodV(x, y)) : LWO(.15));
  each((x, y) => inPoly(x, y, CLOTH_TOP) ? LLI(clothTopV(x, y)) : inPoly(x, y, CLOTH_HANG) ? LLI(clothHangV(x, y)) : null);
  for (let th = Math.PI; th < 2 * Math.PI; th += .004) for (let t = 0; t < .7; t += .004) { const p = bPt(th, t); if (inPoly(p[0], p[1], RIM)) set(p[0], p[1], lin(LPO(bowlInV(th, t)))) }
  { const o = lemonOutline(LA); each((x, y) => inPoly(x, y, o) ? LLE(lemV(LA, x, y)) : null) }
  for (let th = -.1; th < Math.PI + .1; th += .004) for (let t = 0; t < 1.1; t += .003) { const p = bPt(th, t); set(p[0], p[1], lin(LPO(bowlV(th, t)))) }
  { const o = lemonOutline(LB); each((x, y) => inPoly(x, y, o) ? LLE(lemV(LB, x, y)) : null) }
  { const L = {x: LC.x, y: LC.y, rx: LC.rx, ry: LC.ry, ang: LC.ang, nip: .2, nip2: 0}, o = lemonOutline(L); each((x, y) => inPoly(x, y, o) && lemLocal(L, x, y)[0] > 0 ? LLE(lemV(L, x, y)) : null);
    const f = ellipse(FACE.x, FACE.y, FACE.rx, FACE.ry, FACE.ang); each((x, y) => inPoly(x, y, f) ? C('pulp') : null) }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c });
  const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(img.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  const chunk = (t, d) => { const td = Buffer.concat([Buffer.from(t), d]), b = Buffer.alloc(8); b.writeUInt32BE(d.length, 0); b.writeUInt32BE(crc(td), 4); return Buffer.concat([b.subarray(0, 4), td, b.subarray(4)]) };
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2;
  writeFileSync(process.env.PREVIEW, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('preview → ' + process.env.PREVIEW); process.exit(0);
}

/* =====================================================================
   THE PAINTING
   ===================================================================== */
imprimatura();
wall();
table();
cloth();
bowlInside();
lemon(LA, 'Lemon in the bowl', (x, y) => 1 - .35 * smooth((x - LA.x - 20) / 40) * smooth((y - LA.y + 10) / 30));
bowlBody();
lemon(LB, 'Lemon on the cloth');
knife();
peel();
cutLemon();
accents();
stage('Varnish', 'A thin coat of warm varnish over everything: it binds the colours and gives the darks back their depth.');
fl('varnish', {rect: [-10, -10, W + 10, H + 10]}, {a: .2, uneven: .5, scale: 160});

for (const k of Object.keys(doc.shapes)) doc.shapes[k] = TSHAPE(doc.shapes[k]);
const problems = P.check(doc);
if (problems.length) { console.error(problems.length + ' problems\n  - ' + problems.slice(0, 20).join('\n  - ')); process.exit(1) }
const J = v => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
const line = q => q.do ? '      {"with": ' + J(q.with) + ', "do": [\n' + q.do.map(m => '        ' + J(m)).join(',\n') + '\n      ]}' : '      ' + J(q);
const body = doc.steps.map(s => '    {"name": ' + JSON.stringify(s.name) + (s.note ? ', "note": ' + JSON.stringify(s.note) : '') + ', "do": [\n' + s.do.map(line).join(',\n') + '\n    ]}').join(',\n');
const head = Object.assign({}, doc); delete head.steps;
const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "steps": [\n' + body + '\n  ]\n}\n');
JSON.parse(text);
writeFileSync(join(dir, 'lemons.json'), text);
let count = 0; const walk = l => l.forEach(s => s.do ? walk(s.do) : count += s.paths ? s.paths.length : s.dots ? s.dots.length : 1); walk(doc.steps);
console.log('lemons.json  ' + (text.length / 1024).toFixed(0) + ' kB  ' + doc.steps.length + ' stages, ' + count + ' marks');
