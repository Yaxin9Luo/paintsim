// node paintings/harbour.gen.mjs   →   paintings/harbour.json
//
// "Impasto oil painting of a small fishing harbour at sunset: three or four wooden boats with masts at their moorings,
//  a stone quay with a few houses, an orange and rose sky breaking into cool violet clouds, the water full of broken
//  reflections laid on with a palette knife, thick paint, warm light."
//
// The picture is composed here — the scene is built first as geometry (sky, clouds, quay, houses, boats), so that the
// water can be painted as a reflection of it — and written out as an ordinary painting document. The document does not
// refer back to this file. Infrastructure (engine loading, seeded chance, palette, step writers) follows magpie.gen.mjs.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {spline, arc, circleArc, lerp, clamp, smooth, fbm} = P.util;
const circleArcP = (x, y, r, a0, a1, n) => circleArc(x, y, r, a0, a1, n).map(p => [p[0], p[1] * .55 + y * .45]);   // a coil seen from above
const OUT = process.argv[2] || join(dir, 'harbour.json');

/* ---------- chance, with a seed ---------- */
let seed = 20261112;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
const G = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;   // a soft bell between -1 and 1

/* ---------- the palette: colours mixed from pigments ---------- */
const MIX = {
  // sky, from the top down
  'zenith': {mix: {'ultramarine': 2, 'dioxazine violet': .6, 'alizarin crimson': .5, 'titanium white': 1.3}},
  'violet cloud': {mix: {'ultramarine': 1, 'dioxazine violet': .4, 'alizarin crimson': .7, 'titanium white': 2.2}},
  'violet deep': {mix: {'ultramarine': 1, 'dioxazine violet': .5, 'alizarin crimson': .6, 'burnt umber': .25, 'titanium white': .7}},
  'violet grey': {mix: {'ultramarine': 1, 'alizarin crimson': .6, 'raw umber': .3, 'titanium white': 3}},
  'mauve': {mix: {'rose madder': 3, 'alizarin crimson': .3, 'ultramarine': .35, 'titanium white': 3.2}},
  'rose': {mix: {'rose madder': 2, 'cadmium red': .4, 'titanium white': 3}},
  'rose pale': {mix: {'rose madder': 1, 'cadmium red': .2, 'titanium white': 5, 'naples yellow': .5}},
  'salmon': {mix: {'cadmium red': 1, 'rose madder': .5, 'titanium white': 3, 'cadmium yellow': .4}},
  'orange': {mix: {'cadmium yellow': 2, 'cadmium red': 1.2, 'titanium white': 1}},
  'orange deep': {mix: {'cadmium red': 2, 'cadmium yellow': 1, 'burnt sienna': .3}},
  'gold': {mix: {'cadmium yellow': 3, 'cadmium red': .4, 'titanium white': 1.5}},
  'pale gold': {mix: {'titanium white': 4, 'cadmium yellow': 1, 'cadmium red': .1}},
  'sun white': {mix: {'titanium white': 10, 'cadmium yellow': .5, 'naples yellow': .5}},
  'green gap': {mix: {'cerulean': .6, 'titanium white': 6, 'cadmium yellow': .3, 'naples yellow': 1}},
  // distance and water
  'shore': {mix: {'ultramarine': 1, 'alizarin crimson': .7, 'titanium white': 1.6, 'burnt umber': .2}},
  'shore far': {mix: {'ultramarine': 1, 'rose madder': 1.5, 'titanium white': 4}},
  'water violet': {mix: {'ultramarine': 1.5, 'alizarin crimson': .9, 'titanium white': 1.1, 'burnt umber': .15}},
  'water deep': {mix: {'ultramarine': 1.6, 'alizarin crimson': .6, 'burnt umber': .3, 'titanium white': .45}},
  'water dark': {mix: {'ultramarine': 1, 'burnt umber': 1, 'alizarin crimson': .4}},
  'umber': {mix: {'burnt umber': 2, 'ultramarine': .6}},
  'umber violet': {mix: {'burnt umber': 1, 'ultramarine': 1, 'alizarin crimson': .5}},
  // stone, walls and roofs
  'stone lit': {mix: {'yellow ochre': 1, 'titanium white': 2, 'cadmium red': .2}},
  'stone pale': {mix: {'naples yellow': 2, 'titanium white': 2, 'cadmium red': .15}},
  'stone shade': {mix: {'ultramarine': 1, 'alizarin crimson': .5, 'burnt sienna': .5, 'titanium white': 2}},
  'stone dark': {mix: {'ultramarine': 1, 'burnt umber': 1, 'alizarin crimson': .4, 'titanium white': .35}},
  'weed': {mix: {'sap green': 1, 'burnt umber': 1, 'ultramarine': .3}},
  'wall ochre': {mix: {'yellow ochre': 2, 'cadmium yellow': .4, 'cadmium red': .35, 'titanium white': 1.5}},
  'wall pink': {mix: {'cadmium red': .6, 'rose madder': .6, 'titanium white': 3, 'yellow ochre': .5}},
  'wall white': {mix: {'titanium white': 5, 'naples yellow': 1, 'cadmium red': .1}},
  'wall blue': {mix: {'cerulean': 1, 'titanium white': 3, 'rose madder': .3}},
  'wall terra': {mix: {'burnt sienna': 1, 'cadmium red': .5, 'titanium white': 1.6}},
  'wall sienna': {mix: {'raw sienna': 2, 'titanium white': 1.5, 'cadmium red': .2}},
  'roof': {mix: {'burnt sienna': 2, 'cadmium red': .5, 'ultramarine': .3}},
  'roof slate': {mix: {"payne's grey": 2, 'dioxazine violet': .3, 'titanium white': .6}},
  'shutter green': {mix: {'viridian': 2, 'titanium white': 1, 'raw umber': .3}},
  'shutter blue': {mix: {'cobalt blue': 2, 'titanium white': 1}},
  'window': {mix: {'ultramarine': 1, 'burnt umber': 1.3, 'alizarin crimson': .3}},
  // boats
  'hull blue': {mix: {'ultramarine': 2, 'prussian blue': .5, 'titanium white': .5}},
  'hull red': {mix: {'cadmium red': 2, 'burnt sienna': 1, 'alizarin crimson': .3}},
  'hull green': {mix: {'viridian': 2, 'burnt umber': .5, 'titanium white': .4}},
  'hull ochre': {mix: {'yellow ochre': 2, 'raw sienna': .5, 'titanium white': 1}},
  'hull white': {mix: {'titanium white': 4, 'naples yellow': .6, 'ultramarine': .1}},
  'sail': {mix: {'burnt sienna': 2, 'cadmium red': .6, 'yellow ochre': .5}},
  'deck': {mix: {'raw sienna': 1.5, 'titanium white': 1, 'rose madder': .3}},
  'mast': {mix: {'burnt umber': 2, 'lamp black': .5, 'ultramarine': .3}},
  'tar': {mix: {'lamp black': 2, 'burnt umber': 1, 'ultramarine': .5}},
  'rope': {mix: {'raw umber': 2, 'titanium white': .5}}
};
const CC = new Map();
const C = c => { if (typeof c !== 'string') return c; let v = CC.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); CC.set(c, v) } return v };
const km = (a, b, t) => t <= 0 ? C(a) : t >= 1 ? C(b) : P.mix([[C(a), 1 - t], [C(b), t]]);   // mixed as pigments
const tone = (c, k) => { c = C(c); return [c[0] * k, c[1] * k, c[2] * k] };
const hex = c => P.hex(C(c));
const lerp3 = (a, b, t) => { a = C(a); b = C(b); t = clamp(t, 0, 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
const jit = (c, a) => { c = C(c); const k = 1 + G() * a; return [clamp(c[0] * k * (1 + G() * a * .4), 0, 1), clamp(c[1] * k * (1 + G() * a * .4), 0, 1), clamp(c[2] * k * (1 + G() * a * .4), 0, 1)] };
const ramp = (stops, t) => { t = clamp(t, 0, 1); for (let i = 0; i < stops.length - 1; i++) if (t <= stops[i + 1][0]) return lerp3(stops[i][1], stops[i + 1][1], (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0])); return C(stops[stops.length - 1][1]) };
const lum = c => { c = C(c); return .3 * c[0] + .59 * c[1] + .11 * c[2] };

/* ---------- the document ---------- */
const doc = {
  paintsim: 1, engine: P.VERSION, title: 'Harbour at sunset',
  note: 'A small fishing harbour at sunset: moored wooden boats, a stone quay with houses, an orange and rose sky breaking into violet clouds, the water laid on with a knife. Oil on a warm toned canvas. Written by paintings/harbour.gen.mjs.',
  size: [1000, 800],
  ground: 'sienna canvas',
  light: 'evening raking',
  seed: 20261112,
  define: {
    pigments: MIX,
    grounds: {'sienna canvas': {base: 'canvas', note: 'a canvas toned with a warm burnt-sienna imprimatura', color: '#a8714c', tooth: .45}},
    lights: {'evening raking': {base: 'raking', note: 'a low lamp from the upper left, a little softer on the highlights', elevation: 28, shoulder: .3, lens: {vignette: .22, contrast: .1, grain: .6, blur: 0}}},
    materials: {
      'thin': {base: 'oil', note: 'paint thinned with turpentine for the lay-in', body: .18, opacity: .78, ridges: .22, grain: .05, gloss: .12, open: .25, pickup: 0, merge: .05, reach: 0, bury: .3, dry: .35},
      'sky': {base: 'oil', note: 'buttery oil that stays open and blends with what it is laid into', body: .6, ridges: .08, grain: .03, level: .25, gloss: .26, open: .9, pickup: .03, merge: .35, reach: 0},
      'paint': {base: 'oil', note: 'ordinary oil, a little leaner', body: .95, ridges: .26, reach: 0, merge: .18},
      'wall': {base: 'oil', note: 'paint for the walls: smoother, so the brush marks do not read as weave', body: .8, ridges: .14, grain: .03, reach: 0, merge: .2},
      'dark': {base: 'oil', note: 'dark oil with body and gloss, so that its relief still reads', body: .95, gloss: .42, sharp: .55, ridges: .2, reach: 0, merge: .12},
      'impasto': {base: 'oil', note: 'stiff paint straight from the tube for the lights', body: 1.55, ridges: .22, grain: .04, gloss: .38, sharp: .5, merge: .03, pickup: .004, bury: .95, open: .5, reach: 0},
      'clean': {base: 'oil', note: 'a clean touch that does not sink into what is wet beneath', body: .9, merge: 0, pickup: 0, open: .3, reach: 0},
      'line': {base: 'oil', note: 'thin dark paint for rigging and ropes', body: .35, ridges: .05, gloss: .3, merge: 0, pickup: 0, open: .2, reach: 0, dry: .15}
    },
    brushes: {
      'big': {base: 'flat', note: 'a big hog flat', width: 44, rag: 9, wobble: .7, var: .15},
      'hog': {base: 'flat', note: 'a middling hog flat', width: 16, rag: 4, wobble: .5, var: .15},
      'small': {base: 'flat', note: 'a small flat', width: 7, rag: 2, wobble: .35, var: .12, clump: 1.6},
      'fil': {base: 'filbert', note: 'a filbert for rounded touches', width: 12, wobble: .5, var: .2},
      'cloud': {base: 'filbert', note: 'a worn filbert pressed nearly flat: broad strokes with rounded, ragged ends', width: 16, clump: 2.2, streak: 1.3, wobble: .8, var: .18, rag: 3},
      'scumble': {base: 'flat', note: 'a nearly dry brush dragged over the tooth', dry: .74, charge: .5, wobble: .7, streak: 1.6, rag: 6},
      'small knife': {base: 'knife', note: 'the tip of the knife', width: 10, varLen: 12, rag: 2},
      'slab': {base: 'knife', note: 'a knife laid flat and pulled sideways: a thin slab with a soft lip and ragged ends', edge: .22, rag: 6, jit: .5, vary: .16, varLen: 16, wobble: .4},
      'rigger': {base: 'liner', note: 'a long thin rigger', width: 1.6, wobble: .25, var: .15},
      'pole': {base: 'round', note: 'a round pressed evenly, for masts', profile: 'flat', width: 4, clump: 2, streak: .6, wobble: .12, var: .05},
      'dab': {base: 'round', profile: 'comma', width: 6, wobble: .4}
    }
  },
  shapes: {}, steps: []
};

/* ---------- writing steps (as in magpie.gen.mjs) ---------- */
let cur = null, grp = null, marks = 0;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100;
const PT = pts => pts.map(p => [n1(p[0]), n1(p[1])]);
const colOf = c => typeof c === 'string' && c[0] === '#' ? c : hex(c);
function stage(name, note) { cur = {name, do: []}; if (note) cur.note = note; doc.steps.push(cur); grp = null }
function put(shared, step) { const key = JSON.stringify(shared); if (!grp || grp.key !== key) { grp = {key, node: {with: shared, do: []}}; cur.do.push(grp.node) } grp.node.do.push(step); marks++ }
// a stroke. o: w width · c, c2 colours · a opacity · pr pressure · press · grad · load · wob · tone2 · clip · raw (no spline)
function st(material, brush, path, o = {}) {
  if (!path || path.length < 2) return;
  const s = {path: PT(path)};
  if (o.w !== undefined) s.width = o.w < 4 ? n2(o.w) : n1(o.w);
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.c2 !== undefined) s.color2 = colOf(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.pr !== undefined) s.pressure = typeof o.pr === 'string' ? o.pr : o.pr.map(n2);
  if (o.press !== undefined) s.press = n2(o.press);
  if (o.grad) s.grad = n2(o.grad);
  if (o.load !== undefined) s.load = Math.round(o.load);
  if (o.wob !== undefined) s.wobble = n2(o.wob);
  if (o.tone2) s.tone2 = n2(o.tone2);
  if (o.clip !== undefined) s.clip = o.clip;
  if (o.raw) s.spline = false;
  put({material, brush}, s);
}
function fl(material, shape, o = {}) {
  const s = {shape: Array.isArray(shape) && typeof shape[0][0] === 'number' ? PT(shape) : shape};
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.c2 !== undefined) s.color2 = colOf(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  for (const k of ['soft', 'uneven', 'scale', 'angle']) if (o[k] !== undefined) s[k] = n2(o[k]);
  if (o.clip !== undefined) s.clip = o.clip;
  put({material}, s);
}
function dots(material, list, o = {}) {
  if (!list.length) return;
  const s = list.length === 1 ? {at: [n1(list[0][0]), n1(list[0][1])], r: n2(list[0][2])} : {dots: list.map(d => [n1(d[0]), n1(d[1]), n2(d[2])])};
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.soft !== undefined) s.soft = n2(o.soft);
  if (o.dome !== undefined) s.dome = n2(o.dome);
  put({material}, s);
}
const dry = (v = true) => { cur.do.push({dry: v}); grp = null };

/* ---------- geometry ---------- */
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
const bbox = p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) } return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0} };
function sampleIn(poly, n) { const b = bbox(poly), out = []; let guard = 0; while (out.length < n && guard++ < n * 200) { const x = R(b.x0, b.x1), y = R(b.y0, b.y1); if (inPoly(x, y, poly)) out.push([x, y]) } return out }
// the part of a stroke that lies where ok() holds, around its middle: a brush is lifted at the edge, not masked
function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }
const within = (path, poly) => run(path, p => inPoly(p[0], p[1], poly));
const seg = (a, b, n) => Array.from({length: n + 1}, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
const L2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// a straight-ish stroke from a to b with a hand's small deviations
const hand = (a, b, n = 4, j = .6) => seg(a, b, n).map((p, i) => i && i < n ? [p[0] + G() * j, p[1] + G() * j] : p);
const prof = (f, n = 10) => Array.from({length: n + 1}, (_, i) => Math.max(0, f(i / n)));
const roundEnds = (a = 5, b = 4, lo = .5) => prof(t => lo + (1 - lo) * Math.min(1, Math.sqrt(Math.max(0, t * a)), Math.sqrt(Math.max(0, (1 - t) * b))), 12);   // blunt, rounded ends for a round brush
const pathLen = p => { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l };

/* =====================================================================
   THE SCENE — built as geometry first
   ===================================================================== */
const W = 1000, H = 800, HY = 400, SX = 724, SY = 334, SR = 22;

/* ---------- sky ---------- */
function skyCol(x, y) {
  const v = clamp(y / HY, 0, 1.05), cool = smooth((300 - x) / 400) * .1;
  let c = ramp([[0, 'zenith'], [.22, 'violet cloud'], [.45, 'mauve'], [.62, 'rose'], [.78, 'salmon'], [.9, 'orange'], [1, 'gold']], v - cool);
  const d = Math.hypot((x - SX) * .55, (y - SY) * 1.15), g1 = Math.exp(-Math.pow(d / 300, 2)), g2 = Math.exp(-Math.pow(d / 120, 2)), g3 = Math.exp(-Math.pow(d / 50, 2));
  c = lerp3(c, v > .6 ? 'gold' : 'salmon', g1 * .55);
  c = lerp3(c, 'gold', g2 * .35);
  c = lerp3(c, 'pale gold', g2 * .45);
  c = lerp3(c, 'sun white', g3 * .35);
  return c;
}
/* ---------- clouds: a density field; cloud where it is above 0 ---------- */
const CLOUDS = [
  {cx: 260, cy: 30, rx: 560, ry: 120, tilt: .05, k: 1},
  {cx: 860, cy: 60, rx: 300, ry: 82, tilt: -.06, k: 1},
  {cx: 560, cy: 182, rx: 300, ry: 30, tilt: .03, k: .8},
  {cx: 900, cy: 214, rx: 220, ry: 24, tilt: -.04, k: .8},
  {cx: 330, cy: 262, rx: 260, ry: 22, tilt: .02, k: .7},
  {cx: 650, cy: 300, rx: 210, ry: 11, tilt: -.015, k: .75},
  {cx: 905, cy: 330, rx: 160, ry: 9, tilt: 0, k: .6}
];
function cloudAt(x, y) {   // → {d, c} the strongest cloud here: d > 0 inside
  let best = -9, bc = null;
  for (const c of CLOUDS) { const ca = Math.cos(c.tilt), sa = Math.sin(c.tilt), dx = x - c.cx, dy = y - c.cy, u = (dx * ca + dy * sa) / c.rx, v = (-dx * sa + dy * ca) / c.ry;
    const d = (1 - u * u - v * v) * c.k + (fbm(x / 70 + c.cx * .01, y / (c.ry * .9 + 14), 4) - .5) * 1.1 + (fbm(x / 22, y / 12, 2) - .5) * .25;
    if (d > best) { best = d; bc = c } }
  return {d: best, c: bc};
}
function cloudCol(x, y, cl) {
  const c = cl.c, v = (y - c.cy) / c.ry, under = smooth(v * .9 + .25 + (fbm(x / 40, y / 20, 2) - .5) * .8);
  const ds = Math.hypot((x - SX) * .7, y - SY), sp = Math.exp(-ds / 260), hi = smooth(1 - y / 240);
  const top = lerp3(lerp3('violet deep', 'violet cloud', .25 + .5 * fbm(x / 50, y / 30, 2)), 'zenith', hi * .3);
  const lit = lerp3(lerp3('rose', 'mauve', hi * .6), lerp3('orange', 'pale gold', sp), sp * .9);
  return lerp3(top, lit, under * (.35 + .65 * Math.max(sp * 1.3, .45 - hi * .3)));
}

/* ---------- quay and houses: the row runs back toward a vanishing point on the horizon, right of the picture ---------- */
const VPR = [1350, HY - 8], X0 = -20;
const qLine = y0 => t => [X0 + t * (VPR[0] - X0), y0 + t * (VPR[1] - y0)];
const qBase = qLine(548), qEdge = qLine(590), qWater = qLine(664), kOf = t => 1 - t, tAtX = x => (x - X0) / (VPR[0] - X0);
const QX = 524, QT = tAtX(QX);   // the quay ends here
const quayWaterY = x => qWater(tAtX(x))[1];
const quayFace = [qEdge(0), qEdge(QT), qWater(QT), qWater(0)];
const quayTop = [qBase(0), qBase(QT), qEdge(QT), qEdge(0)];
const quayEnd = [qBase(QT), [QX + 10, qBase(QT)[1] + 3], [QX + 10, qWater(QT)[1] - 3], qWater(QT), qEdge(QT)];   // the end, turned toward the sun
doc.shapes['quay face'] = PT(quayFace); doc.shapes['quay top'] = PT(quayTop); doc.shapes['quay end'] = PT(quayEnd);

const WALLS = ['wall ochre', 'wall pink', 'wall white', 'wall blue', 'wall terra', 'wall sienna', 'wall white', 'wall pink', 'wall ochre', 'wall blue'];
const houses = [];
{ let x = X0, i = 0;
  while (x < 488) {
    const t0 = tAtX(x), k0 = kOf(t0), type = [ 'gable', 'eave', 'gable', 'gable', 'eave', 'gable', 'eave', 'gable', 'gable', 'eave'][i % 10];
    const h = (type === 'eave' ? R(185, 235) : R(170, 215)) * (i === 1 ? 1.12 : 1), w = R(118, 160) * k0 * (type === 'eave' ? 1.15 : .9), x1 = Math.min(x + w, 512), t1 = tAtX(x1), k1 = kOf(t1);
    const BL = qBase(t0), BR = qBase(t1), TL = [BL[0], BL[1] - h * k0], TR = [BR[0], BR[1] - h * k1];
    const gh = type === 'gable' ? R(55, 80) : 0, tm = (t0 + t1) / 2, peak = [(x + x1) / 2, qBase(tm)[1] - (h + gh) * kOf(tm)];
    const facade = type === 'gable' ? [BL, BR, TR, peak, TL] : [BL, BR, TR, TL];
    let roof = null;
    if (type === 'eave') { const rh = R(55, 75); roof = [[TL[0] - 3 * k0, TL[1] + 1], [TR[0] + 3 * k1, TR[1] + 1], [TR[0] - 8 * k1, TR[1] - rh * k1], [TL[0] + 4 * k0, TL[1] - rh * k0]] }
    houses.push({i, x0: x, x1, t0, t1, k0, k1, h, BL, BR, TL, TR, peak, type, facade, roof, wall: WALLS[i % WALLS.length], roofC: rnd() < .7 ? 'roof' : 'roof slate'});
    doc.shapes['facade ' + i] = PT(facade); if (roof) doc.shapes['roof ' + i] = PT(roof);
    x = x1 + (rnd() < .3 ? R(4, 9) * k1 : 0); i++;
  } }
// a point on a house front: s across it (0 left … 1 right), z height above the quay in the house's own units
const onFacade = (hs, s, z) => { const t = lerp(hs.t0, hs.t1, s), b = qBase(t); return [b[0], b[1] - z * kOf(t)] };
const inHouse = (x, y) => houses.some(hs => inPoly(x, y, hs.facade) || (hs.roof && inPoly(x, y, hs.roof)));
// a tower at the far end of the row, over the roofs
const TW = {x: -999, base: 0, top: -10, w: 1};   // (a tower was tried here and left out)
TW.poly = [[TW.x - TW.w / 2, TW.base], [TW.x + TW.w / 2, TW.base], [TW.x + TW.w / 2, TW.top + 40], [TW.x, TW.top], [TW.x - TW.w / 2, TW.top + 40]];

/* ---------- breakwater, lighthouse and the far shore ---------- */
const shoreTop = x => HY - 3 - 26 * smooth((x - 760) / 240) - 5 * (fbm(x / 40, 3, 3) - .5) - 8 * smooth((x - 900) / 100) * (fbm(x / 25, 7, 2));
const shore = [[740, HY + 1]]; for (let x = 740; x <= 1010; x += 10) shore.push([x, shoreTop(x)]); shore.push([1010, HY + 1]);
const brkTop = x => 410 + (x - 800) * .055, brkBot = x => 418 + (x - 800) * .085;
const breakwater = [[796, brkTop(796)], [1010, brkTop(1010)], [1010, brkBot(1010)], [796, brkBot(796) - 1]];
const LH = {x: 808, base: 409, top: 362, w: 9};
doc.shapes['breakwater'] = PT(breakwater);

/* ---------- boats ---------- */
// a boat in its own frame: u along the hull (-1 stern … 1 bow), v up. Screen: x = cx + u·hl·dir, y = cy + u·hl·slope − v
function makeBoat(o) {
  const b = Object.assign({}, o), hl = o.L / 2;
  b.X = (u, v) => [o.cx + u * hl * o.dir, o.cy + u * hl * o.slope - v];
  b.sheer = u => o.Hh * (1 + .5 * Math.pow(Math.max(0, u), 2.2) + .2 * Math.pow(Math.max(0, -u), 2));
  b.keel = u => u > .72 ? o.Hh * 1.05 * Math.pow((u - .72) / .31, 2) : u < -.96 ? o.Hh * .3 * (-.96 - u) / .04 : 0;
  b.deckH = u => o.deck * Math.sqrt(Math.max(0, 1 - Math.pow((u + .02) / 1.02, 2)));
  const hull = [], deck = [], N = 30;
  for (let i = 0; i <= N; i++) { const u = -1 + 2.03 * i / N; hull.push(b.X(u, b.sheer(u))) }
  for (let i = N; i >= 0; i--) { const u = -1 + 2.03 * i / N; hull.push(b.X(u, Math.min(b.keel(u), b.sheer(u)))) }
  b.poly = hull;
  for (let i = 0; i <= N; i++) { const u = -.99 + 2 * i / N; deck.push(b.X(u, b.sheer(u))) }
  for (let i = N; i >= 0; i--) { const u = -.99 + 2 * i / N; deck.push(b.X(u, b.sheer(u) + b.deckH(u))) }
  b.deckPoly = deck;
  b.wl = x => { const u = (x - o.cx) / (hl * o.dir); return o.cy + u * hl * o.slope };
  b.xr = [Math.min(b.X(-1, 0)[0], b.X(1.03, 0)[0]), Math.max(b.X(-1, 0)[0], b.X(1.03, 0)[0])];
  if (o.mast) { const u = o.mast.u; b.mastBase = b.X(u, b.sheer(u) + b.deckH(u) * .5); b.mastTop = [b.mastBase[0] + o.mast.lean, b.mastBase[1] - o.mast.h] }
  return b;
}
const boats = [
  makeBoat({name: 'far', cx: 884, cy: 474, L: 150, dir: -1, slope: .03, Hh: 17, deck: 8, hull: 'hull green', strake: 'hull white', band: 'hull red', mast: {u: .3, h: 196, lean: 3}, sail: true, cabin: null}),
  makeBoat({name: 'quay', cx: 330, cy: 618, L: 230, dir: 1, slope: -.19, Hh: 27, deck: 13, hull: 'hull red', strake: 'hull ochre', band: 'tar', mast: {u: .22, h: 300, lean: -3}, sail: true, cabin: {u0: -.66, u1: -.3, h: 30}}),
  makeBoat({name: 'main', cx: 640, cy: 646, L: 330, dir: 1, slope: -.05, Hh: 40, deck: 20, hull: 'hull blue', strake: 'hull white', band: 'hull red', mast: {u: .16, h: 420, lean: 4}, sail: true, cabin: {u0: -.62, u1: -.18, h: 44}}),
  makeBoat({name: 'skiff', cx: 175, cy: 752, L: 180, dir: -1, slope: .08, Hh: 22, deck: 20, hull: 'hull ochre', strake: 'hull white', band: 'shutter green', mast: null, sail: false, cabin: null})
];
boats.forEach(b => { doc.shapes['hull ' + b.name] = PT(b.poly); doc.shapes['deck ' + b.name] = PT(b.deckPoly) });

/* ---------- colour of things in the evening light ---------- */
const DUSK = '#80566e';
const facadeCol = (hs, z, x = 0) => { const base = lerp3(lerp3(hs.wall, DUSK, .5), hs.wall, (fbm(x / 26 + hs.i * 7, z / 30, 3) - .5) * .5), haze = smooth((hs.x0 + hs.x1) / 2 / 600) * .3;
  return lerp3(lerp3(lerp3(tone(base, .74), tone(base, .9), smooth(z / hs.h)), 'rose', .12 * smooth(z / hs.h)), skyCol(hs.x1, hs.TR[1] + 30), haze) };
const roofCol = hs => lerp3(tone(lerp3(hs.roofC, DUSK, .35), .85), skyCol(hs.x1, hs.TR[1]), smooth((hs.x0 + hs.x1) / 2 / 600) * .3);

/* ---------- what the water mirrors ---------- */
function sceneAt(x, y) {   // the colour of the scene above the water at (x, y), roughly as it will be painted
  for (const b of boats.slice().reverse()) if (inPoly(x, y, b.poly)) return lerp3(lerp3(b.hull, DUSK, .2), 'water dark', .3);
  if (inPoly(x, y, quayFace)) return lerp3(lerp3('stone shade', 'stone dark', .45), 'violet deep', .25);
  if (inPoly(x, y, quayTop)) return C('stone pale');
  for (const hs of houses) { if (inPoly(x, y, hs.facade)) return facadeCol(hs, (hs.BL[1] - y) / hs.k0); if (hs.roof && inPoly(x, y, hs.roof)) return roofCol(hs) }
  if (inPoly(x, y, TW.poly)) return km('wall sienna', 'violet grey', .4);
  if (inPoly(x, y, breakwater)) return C('violet deep');
  if (inPoly(x, y, shore)) return lerp3('shore', 'shore far', .3);
  const cl = cloudAt(x, y); if (cl.d > 0) return lerp3(skyCol(x, y), cloudCol(x, y, cl), smooth(cl.d / .25));
  return skyCol(x, y);
}
function mirrorAt(x, y) {   // the reflection seen in still water at (x, y): {c, obj}
  for (const b of boats.slice().reverse()) if (x > b.xr[0] && x < b.xr[1]) { const w = b.wl(x); if (y > w && y < w + b.Hh * 2.3) { const yy = 2 * w - y; if (inPoly(x, yy, b.poly)) return {c: sceneAt(x, yy), obj: true} } }
  if (x < QX + 10) { const w = quayWaterY(Math.min(x, QX)); if (y > w) { const yy = 2 * w - y; if (inPoly(x, yy, quayFace) || inPoly(x, yy, quayTop) || inPoly(x, yy, quayEnd) || inHouse(x, yy) || inPoly(x, yy, TW.poly)) return {c: sceneAt(x, yy), obj: true} } }
  if (x > 790) { const yy = 2 * brkBot(x) - y; if (y > brkBot(x) && inPoly(x, yy, breakwater)) return {c: C('violet deep'), obj: true} }
  const ys = HY - (y - HY) * .82;
  if (x > 745 && inPoly(x, ys, shore)) return {c: sceneAt(x, ys), obj: true};
  return {c: sceneAt(x, Math.max(2, ys)), obj: false};
}
const deepAt = y => lerp3('water violet', 'water deep', smooth((y - HY) / 380));
function waterCol(x, y) {
  const m = mirrorAt(x, y), depth = (y - HY) / (H - HY), f = .12 + .38 * depth;
  let c = lerp3(m.c, deepAt(y), m.obj ? f * .6 : f);
  return tone(c, m.obj ? .86 : .94 - .1 * depth);
}
// the column of broken light under the sun, widening toward the viewer
const glit = (x, y) => { const hw = 14 + (y - HY) * .26, d = (x - SX) / hw; return Math.exp(-d * d * 1.6) * clamp(.4 + 1.1 * fbm(x / 16, y / 6, 3) - .25, 0, 1.2) * smooth((y - HY - 3) / 26) };
const offQuay = (x, y) => !(x < QX + 10 && y < quayWaterY(Math.min(x, QX)) + .5 && y > qBase(tAtX(x))[1] - 4);
const onWater = (x, y) => y > HY + 1.5 && !boats.some(b => inPoly(x, y, b.poly)) && !(x < QX + 10 && y < quayWaterY(Math.min(x, QX)) + .5) && !(x > 790 && y < brkBot(x) + .5);
const across = (p, dir, len, n = 5, curv = 0) => arc(p[0] - Math.cos(dir) * len / 2, p[1] - Math.sin(dir) * len / 2, dir, len, curv, n);

/* =====================================================================
   THE PAINTING
   ===================================================================== */

/* the drawing, in thin paint */
function drawing() {
  stage('Drawing', 'The main lines drawn with a small brush in thin violet-brown: horizon, quay, houses, hulls and masts.');
  const ln = (a, b, w = 2.2, al = .7) => st('thin', 'small', hand(a, b, 5, 1.2), {w: w * R(.8, 1.2), c: 'umber violet', a: al * R(.8, 1)});
  ln([-10, HY + R(-1, 1)], [1010, HY + R(-1, 1)], 2, .55);
  ln(qEdge(0), qEdge(QT)); ln(qWater(0), qWater(QT)); ln(qBase(0), qBase(QT), 1.8, .5);
  for (const hs of houses) { ln(hs.TL, hs.BL, 1.8); ln(hs.BR, hs.TR, 1.6); if (hs.type === 'gable') { ln(hs.TL, hs.peak, 1.6); ln(hs.peak, hs.TR, 1.6) } else { ln(hs.TL, hs.TR, 1.6); ln(hs.roof[3], hs.roof[2], 1.4, .5) } }
  for (const b of boats) { const n = b.poly.length >> 1; st('thin', 'small', b.poly.slice(0, n).filter((_, i) => i % 3 === 0), {w: 2.4, c: 'umber violet', a: .7}); st('thin', 'small', b.poly.slice(n).filter((_, i) => i % 3 === 0), {w: 2.4, c: 'umber violet', a: .7});
    if (b.mast) ln(b.mastBase, b.mastTop, 2, .6) }
}

/* the dark masses blocked in thin, before any light paint */
function blockIn() {
  stage('Block-in', 'Thin colour scrubbed into the masses: the houses, roofs, quay and hulls, darker than they will end.');
  const skyLocal = (x, y) => { const cl = cloudAt(x, y); return cl.d > 0 ? lerp3(skyCol(x, y), cloudCol(x, y, cl), smooth(cl.d / .3)) : skyCol(x, y) };
  for (let y = 4; y < HY + 10; y += R(16, 24)) for (let x = R(-60, 0); x < W + 20; x += R(70, 120)) { const len = R(110, 170);
    st('thin', 'big', arc(x, y + G() * 4, G() * .04, len, G() * .1, 5), {w: R(36, 44), c: jit(skyLocal(x + len / 2, y), .03), a: .85}) }
  for (let y = HY + 6; y < H + 20; y += R(14, 20)) for (let x = R(-60, 0); x < W + 20; x += R(70, 120)) { const len = R(110, 170);
    st('thin', 'big', run(arc(x, y + G() * 3, G() * .02, len, G() * .05, 9), q => offQuay(q[0], q[1] - 18) && offQuay(q[0], q[1] + 18)), {w: R(30, 40), c: jit(waterCol(x + len / 2, y), .03), a: .85}) }
  for (const hs of houses) {
    for (const p of sampleIn(hs.facade, 9)) st('thin', 'hog', within(across(p, Math.PI / 2 + R(-.1, .1), 80 * hs.k0, 6), hs.facade), {w: R(14, 24) * hs.k0, c: jit(km(hs.wall, 'umber violet', .55), .1), a: .8});
    if (hs.roof) for (const p of sampleIn(hs.roof, 5)) st('thin', 'hog', within(across(p, R(-.1, .1), 70 * hs.k0, 6), hs.roof), {w: R(10, 18) * hs.k0, c: jit(km(hs.roofC, 'umber', .5), .1), a: .8}) }
  for (const p of sampleIn(quayFace, 40)) st('thin', 'hog', within(across(p, -.19, 60, 6), quayFace), {w: R(10, 20), c: jit('umber', .12), a: .75});
  for (const b of boats) for (const p of sampleIn(b.poly, 12)) st('thin', 'hog', within(across(p, Math.atan(b.slope * b.dir), 60, 6), b.poly), {w: R(6, 12), c: jit(km(b.hull, 'umber', .55), .1), a: .8});
}

/* the sky, laid in wet, then the clouds into it */
function sky() {
  stage('Sky', 'Broad strokes of buttery paint, violet above to orange and gold at the horizon, curving round the sun; laid wet so they blend.');
  const hidden = (x, y) => inHouse(x, y + 20) && inHouse(x - 25, y + 20) && inHouse(x + 25, y + 20);
  for (let y = -6; y < HY + 8; y += R(9, 14)) {
    let x = R(-80, -10);
    while (x < W + 20) { const len = R(90, 210), mx = x + len / 2, d = Math.hypot((mx - SX) * .55, (y - SY) * 1.15), ang = R(-.06, .06) + (d < 160 ? (y - SY) * (mx - SX) * -.000004 : 0);
      const c = skyCol(mx, y), c2 = skyCol(mx + R(-40, 40), y + R(4, 12));
      if (!hidden(mx, y)) st('sky', 'big', arc(x, y + R(-3, 3), ang, len, R(-.12, .12), 6), {w: R(28, 42), c: jit(c, .03), c2: jit(c2, .03), a: .96});
      x += len * R(.62, .85) }
  }
  for (let i = 0; i < 560; i++) { const x = R(-20, W + 20), y = Math.pow(rnd(), .8) * (HY + 4), len = R(40, 110), ang = R(-.12, .12);
    if (hidden(x, y)) continue;
    st('sky', 'hog', across([x, y], ang, len, 5, R(-.2, .2)), {w: R(12, 22), c: jit(skyCol(x, y + R(-8, 8)), .045), a: .95}) }

  stage('Clouds', 'The violet cloud masses worked into the wet sky, their undersides warmed where the sun reaches them.');
  const pts = []; for (let i = 0; i < 7000 && pts.length < 1500; i++) { const x = R(-30, W + 30), y = R(-20, HY - 30), cl = cloudAt(x, y); if (cl.d > .02) pts.push([x, y, cl]) }
  pts.sort((a, b) => a[1] - b[1]);
  for (const [x, y, cl] of pts) { const c = cl.c, len = R(30, 90) * (c.ry > 50 ? 1.3 : .8), ang = c.tilt + R(-.12, .12) + (c.ry > 50 ? (fbm(x / 120, y / 60, 2) - .5) * .6 : 0);
    const path = run(across([x, y], ang, len, 8, R(-.25, .25)), p => cloudAt(p[0], p[1]).d > -.04); if (path.length < 2) continue;
    const w = c.ry > 50 ? R(12, 24) : R(6, 12) * (.5 + c.ry / 40);
    st('sky', rnd() < .5 ? 'hog' : 'cloud', path, {w, c: jit(cloudCol(x, y, cl), .05), c2: jit(cloudCol(x + R(-10, 10), y + R(-6, 6), cl), .05), a: .95, pr: roundEnds(R(3, 8), R(2, 6))}) }
  dry();
}

/* impasto lights in the sky */
function skyLights() {
  stage('Sky lights', 'Thick paint for the sun, the glow round it and the lit edges of the clouds.');
  // the glow: flat strokes laid across the sky round the sun, paler toward it
  for (let i = 0; i < 110; i++) { const a = R(0, 6.283), r = SR * 1.6 + Math.pow(rnd(), 1.2) * 150, x = SX + Math.cos(a) * r * 1.6, y = SY + Math.sin(a) * r * .55;
    if (y > HY - 4 || cloudAt(x, y).d > .05) continue;
    const len = R(20, 60), c = lerp3(skyCol(x, y), 'sun white', R(.08, .3) * Math.exp(-r / 70));
    st('paint', rnd() < .5 ? 'hog' : 'small', run(across([x, y], G() * .05, len, 4, G() * .08), q => q[1] < HY - 3), {w: R(4, 9), c: jit(c, .025), a: .92, pr: prof(t => Math.min(1, t * 4, (1 - t) * 3))}) }
  // the sun: a raised disc of the palest paint, worked round with the brush
  dots('impasto', [[SX, SY, SR * 1.06]], {c: 'pale gold', a: 1, soft: .25});
  dots('impasto', [[SX, SY, SR * .92]], {c: '#fffbea', a: 1, dome: .7, soft: .1});

  // the lit edges of the clouds
  const pts = []; for (let i = 0; i < 26000 && pts.length < 700; i++) { const x = R(0, W), y = R(0, HY - 20), cl = cloudAt(x, y); if (cl.d > 0 && cl.d < .2) { const dn = cloudAt(x, y + 6).d; if (dn < cl.d - .02) pts.push([x, y, cl]) } }
  for (const [x, y, cl] of pts) { if (inHouse(x, y)) continue; const ds = Math.hypot((x - SX) * .7, y - SY), sp = Math.exp(-ds / 300); if (rnd() > .25 + .75 * sp) continue;
    const ang = cl.c.tilt + R(-.1, .1), len = R(20, 70) * (.6 + sp), c = lerp3(lerp3('rose', 'salmon', sp), lerp3('orange', 'pale gold', sp * sp), sp);
    const path = run(across([x, y], ang, len, 6, R(-.15, .15)), q => { const d = cloudAt(q[0], q[1]).d; return d > -.06 && d < .3 });
    st(sp > .35 ? 'impasto' : 'paint', rnd() < .5 ? 'small' : 'cloud', path, {w: R(2.5, 6) * (.6 + sp), c: jit(c, .04), a: .9, pr: roundEnds(R(2, 6), R(1.5, 4))}) }
  // the high clouds, cool violet broken over the warm with a nearly dry brush
  // the cores of the high clouds, worked over once more in overlapping strokes: the darkest in the middle, cooler and lighter out to the edge
  for (let i = 0; i < 600; i++) { const x = R(-20, W + 20), y = R(-10, 230), cl = cloudAt(x, y); if (cl.d < .1 || inHouse(x, y) || rnd() > .55) continue;
    const core = smooth((cl.d - .1) / .5), ang = cl.c.tilt + R(-.08, .08) + (fbm(x / 160, y / 80, 2) - .5) * .35, len = R(40, 110), path = run(across([x, y], ang, len, 6, R(-.15, .15)), q => cloudAt(q[0], q[1]).d > .04);
    const c = lerp3(cloudCol(x, y, cl), lerp3('violet deep', 'zenith', R(0, .5)), core * R(.4, .9)), wC = R(10, 22) * (.6 + .5 * core); if (pathLen(path) < wC * 2.5) continue;
    const rb = rnd() < .55; st('sky', rb ? 'cloud' : 'hog', path, {w: wC, c: jit(c, .04), a: .93, pr: rb ? roundEnds(R(3, 7), R(2, 5), R(.35, .6)) : prof(t => Math.min(1, t * R(4, 8), (1 - t) * R(3, 6)))}) }
  dry();
  // the low band across the sun, crossing it when it is dry
  for (let i = 0; i < 6; i++) { const y = SY - 12 + G() * 5, x0 = SX - R(60, 160), len = R(80, 220); st('paint', 'small', arc(x0, y, R(-.03, .02), len, R(-.05, .05), 6), {pr: prof(t => Math.min(1, t * 3, (1 - t) * 3)), w: R(2, 4.5), c: jit(lerp3('mauve', 'rose', R(0, 1)), .04), a: .85}) }
  // two gulls
  for (const [x, y, s] of [[560, 236, 9], [598, 252, 6.5]]) { st('clean', 'dab', [[x - s, y - s * .2], [x - s * .5, y - s * .55], [x, y]], {w: s * .32, c: 'violet deep', a: .95}); st('clean', 'dab', [[x + s, y - s * .35], [x + s * .5, y - s * .6], [x, y]], {w: s * .32, c: 'violet deep', a: .95}) }
}

/* far shore, breakwater, lighthouse */
function distance() {
  stage('Far shore', 'The low headland across the harbour mouth in hazy violet, the breakwater dark against the glow, and its light.');
  for (let i = 0; i < 90; i++) { const x = R(740, 1010), top = shoreTop(x), y = R(top, HY); const ang = R(-.06, .06), len = R(20, 60);
    st('paint', 'hog', within(across([x, y], ang, len, 5), shore), {w: R(5, 10), c: jit(lerp3('shore far', 'shore', (y - top) / (HY - top + 1) * .7 + .2), .05), a: .95}) }
  for (let x = 750; x < 1010; x += R(8, 18)) st('paint', 'small', [[x, shoreTop(x) + 1.5], [x + R(10, 20), shoreTop(x + 15) + 1.5]], {w: R(2, 3), c: jit(lerp3('rose', 'salmon', .5), .05), a: .7});
  for (let i = 0; i < 26; i++) { const x = R(796, 1010); st('dark', 'hog', within(across([x, (brkTop(x) + brkBot(x)) / 2], .06, 30, 4), breakwater), {w: R(6, 10), c: jit('violet deep', .07), a: .97}) }
  st('impasto', 'small', [[797, brkTop(797) + .5], [900, brkTop(900) + .5], [1010, brkTop(1010) + .5]], {w: 2, c: 'salmon', a: .8});
  const {x, base, top, w} = LH;
  st('paint', 'small', [[x, base], [x + .5, top]], {w, c: 'violet grey', a: .97, pr: prof(t => 1 - .25 * t)});
  st('impasto', 'small', [[x + w * .3, base - 1], [x + w * .3, top + 4]], {w: w * .45, c: 'rose pale', a: .9, pr: prof(t => 1 - .3 * t)});
  st('paint', 'small', [[x, top + 2], [x, top - 6]], {w: w * 1.1, c: 'hull red', a: .95});
  dots('impasto', [[x, top - 3, 2.2]], {c: 'pale gold', a: 1, dome: 1});
  dry();
}

/* water, laid in horizontally as a reflection of everything */
function water() {
  stage('Water', 'Horizontal strokes, each the colour of what the water mirrors at that place, getting bigger toward the viewer.');
  for (let y = HY + 1.5; y < H + 12;) { const s = 1.6 + (y - HY) * .045; let x = R(-60, -10);
    while (x < W + 20) { const len = R(22, 60) * (1 + (y - HY) / 160), mx = x + len / 2, c = waterCol(mx + R(-3, 3), y), c2 = waterCol(mx + len * .35, y + s * .5);
      const wS = s * R(1.6, 2.4); st('paint', rnd() < .5 ? 'hog' : 'big', run(arc(x, y + G() * s * .4, R(-.025, .025), len, R(-.06, .06), 7), q => offQuay(q[0], q[1] - wS / 2) && offQuay(q[0], q[1] + wS / 2)), {w: wS, c: jit(c, .04), c2: jit(c2, .04), a: .96});
      x += len * R(.55, .9) }
    y += s * R(.8, 1.2) }
  dry();
}

/* the quay wall and the paving */
function quay() {
  stage('Quay', 'The stone wall in shadow, coursed and jointed, warm with light thrown up from the water; wet and weedy low down; the paving on top.');
  const face = (s, z) => { const t = s * QT; return L2(qEdge(t), qWater(t), z) };
  const dirAt = p => Math.atan2(VPR[1] - p[1], VPR[0] - p[0]);
  for (let i = 0; i < 300; i++) { const s = rnd(), z = rnd(), k = kOf(s * QT), len = R(30, 80) * k + 10, p = face(s, z), ang = dirAt(p) + R(-.04, .04);
    const lit = .2 + .45 * fbm(p[0] / 30, p[1] / 30, 2) + .2 * smooth((z - .4) / .5), c = z > .84 ? lerp3('stone dark', 'weed', R(0, .7)) : lerp3(lerp3(lerp3('stone dark', 'violet deep', .3), 'stone shade', lit), 'rose', R(0, .15) * z);
    st('paint', 'hog', run(across(p, ang, len, 5, R(-.05, .05)), q => inPoly(q[0], q[1], quayFace)), {w: R(7, 15) * (.4 + .6 * k), c: jit(c, .06), a: .95}) }
  for (let r = 1; r < 7; r++) { const z = r / 7 + R(-.02, .02); st('dark', 'small', seg(face(0, z), face(1, z), 8).map(p => [p[0], p[1] + G() * .6]), {w: 1.6, c: 'stone dark', a: .5, clip: 'quay face'});
    for (let s = R(0, .05); s < 1; s += R(.04, .08)) { const a = face(s, z), b = face(s + .003, z + 1 / 7); st('dark', 'small', [a, b], {w: 1.5 * kOf(s * QT) + .4, c: 'stone dark', a: .45, clip: 'quay face'}) } }
  // stones catching the reflected light from the water, low and warm
  for (let i = 0; i < 80; i++) { const s = rnd(), z = R(.4, .82), p = face(s, z), k = kOf(s * QT), len = R(8, 30) * k + 4;
    st('paint', 'small', run(across(p, dirAt(p) + R(-.04, .04), len, 3), q => inPoly(q[0], q[1], quayFace)), {w: R(3, 7) * (.5 + .5 * k), c: jit(lerp3(lerp3('stone shade', 'violet deep', .2), 'salmon', R(.15, .45)), .05), a: .85, pr: 'leaf'}) }
  for (let i = 0; i < 110; i++) { const s = rnd(), z = R(.78, 1), p = face(s, z), k = kOf(s * QT), len = R(10, 40) * k + 5, ang = dirAt(p) + R(-.06, .06);
    st('dark', 'small', run(across(p, ang, len, 3), q => inPoly(q[0], q[1], quayFace)), {w: R(2, 6) * k + 1, c: jit(lerp3(lerp3('weed', 'stone dark', R(0, 1)), 'water deep', R(0, .5)), .07), a: .9}) }
  // the paving on top, pale under the sky
  fl('paint', 'quay top', {c: lerp3('stone pale', 'mauve', .35), a: .95, angle: Math.atan2(VPR[1] - qEdge(0)[1], VPR[0] - qEdge(0)[0])});
  for (let i = 0; i < 190; i++) { const s = rnd(), t = s * QT, p = L2(qBase(t), qEdge(t), R(0, 1)), k = kOf(t), len = R(20, 70) * k + 6;
    st('paint', 'hog', run(across(p, dirAt(p) + R(-.03, .03), len, 4), q => inPoly(q[0], q[1], quayTop)), {w: R(4, 10) * k + 2, c: jit(lerp3('stone pale', 'mauve', R(.1, .5)), .05), a: .95}) }
  // the edge, where the coping stones catch the sky
  st('impasto', 'small', seg(qEdge(0), qEdge(QT), 10).map(p => [p[0], p[1] - .8]), {w: 2.6, c: lerp3('rose pale', 'pale gold', .5), a: .8, pr: prof(t => .5 + .5 * t)});
  // the end of the quay, turned to the sun
  for (let i = 0; i < 14; i++) { const y = R(qBase(QT)[1], qWater(QT)[1]); st('impasto', 'small', run([[QX - 2, y], [QX + 6, y + 1], [QX + 14, y + 2]], q => inPoly(q[0], q[1], quayEnd)), {w: R(3, 6), c: jit(lerp3('stone lit', 'orange', R(0, .5)), .05), a: .95}) }
}

/* houses, far to near */
function town() {
  stage('Houses', 'Tall narrow houses along the quay, painted far to near; their fronts in shadow against the sun, warm and violet; the tower behind.');
  if (false) { const {x, base, top, w} = TW;
    for (let i = 0; i < 18; i++) { const xx = x + R(-w / 2, w / 2), yy = R(top + 30, base); st('paint', 'hog', run(across([xx, yy], Math.PI / 2, R(30, 70), 4), q => inPoly(q[0], q[1], TW.poly)), {w: R(6, 10), c: jit(lerp3(km('wall sienna', 'violet grey', .45), 'violet deep', R(0, .3)), .05), a: .96}) }
    st('paint', 'small', [[x - w / 2, top + 40], [x, top], [x + w / 2, top + 40]], {w: 4, c: km('roof slate', 'violet deep', .2), a: .95, raw: true});
    for (let i = 0; i < 6; i++) st('paint', 'small', [[x + R(-6, 6) * (i / 6), top + 4 + i * 6], [x - (w / 2) * (i + 1) / 7, top + 6 + i * 6 + 4], [x + (w / 2) * (i + 1) / 7, top + 6 + i * 6 + 4]].slice(1), {w: 6, c: jit(km('roof slate', 'violet deep', .2), .05), a: .95, clip: 'tower'});
    st('impasto', 'small', [[x + w / 2 - 1.5, base - 10], [x + w / 2 - 1.5, top + 40]], {w: 3, c: lerp3('orange', 'pale gold', .4), a: .9, raw: true, pr: prof(t => .3 + .7 * t)});
    st('impasto', 'small', [[x + 1, top + 2], [x + w / 2 - 1, top + 39]], {w: 2.2, c: 'pale gold', a: .85, raw: true});
    for (const yy of [top + 60, top + 95]) st('dark', 'small', [[x - 2, yy], [x - 2, yy + 16]], {w: 6, c: 'window', a: .95, raw: true}) }
  for (const hs of houses.slice().reverse()) {
    const k = hs.k0, kk = s => kOf(lerp(hs.t0, hs.t1, s));
    // the roof band of an eaves house
    if (hs.roof) { fl('paint', 'roof ' + hs.i, {c: roofCol(hs), a: .95, angle: Math.atan2(hs.TR[1] - hs.TL[1], hs.TR[0] - hs.TL[0])});
      for (let i = 0; i < 30; i++) { const p = sampleIn(hs.roof, 1)[0]; if (!p) break; const len = R(30, 70) * k + 6;
        st('paint', 'hog', across(p, Math.atan2(hs.TR[1] - hs.TL[1], hs.TR[0] - hs.TL[0]) + R(-.05, .05), len, 4), {w: R(6, 12) * k + 2, c: jit(lerp3(roofCol(hs), km(hs.roofC, 'rose', .2), R(0, .6)), .06), a: .96, clip: 'roof ' + hs.i}) }
      for (let r = 1; r < 7; r++) { const f = r / 7, a = L2(hs.roof[0], hs.roof[3], f), b = L2(hs.roof[1], hs.roof[2], f); st('dark', 'small', hand(a, b, 6, .5), {w: 1.3 * k + .4, c: lerp3(roofCol(hs), 'umber', .5), a: .5, clip: 'roof ' + hs.i});
        for (let q = R(0, .06); q < 1; q += R(.05, .1)) { const p = L2(a, b, q); st('paint', 'small', [[p[0], p[1] - 2 * k], [p[0] + R(6, 14) * k, p[1] - 2.4 * k]], {w: R(3, 5) * k + 1, c: jit(lerp3(roofCol(hs), lerp3(hs.roofC, 'salmon', .3), f * R(0, 1)), .07), a: .9, clip: 'roof ' + hs.i}) } } }
    // the front: vertical strokes, a little lighter and rosier high up where the sky reaches it
    fl('paint', 'facade ' + hs.i, {c: facadeCol(hs, hs.h * .5), a: .96, angle: Math.PI / 2});
    { const cols = Math.ceil((hs.x1 - hs.x0) / (9 * hs.k0)) + 1, rows = Math.ceil((hs.h + 80) / 34);
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const s = (c + R(-.4, .4)) / (cols - 1), z = (r + R(0, 1)) * 34 - 10, p = onFacade(hs, clamp(s, 0, 1), z); if (!inPoly(p[0], p[1] - 4, hs.facade) && !inPoly(p[0], p[1] + 4, hs.facade)) continue;
        const hz = rnd() < .14, len = (hz ? R(30, 50) : R(30, 65)) * kk(s) + 5, dir = hz ? Math.atan2(hs.BR[1] - hs.BL[1], hs.BR[0] - hs.BL[0]) + R(-.08, .08) : Math.PI / 2 + R(-.06, .06);
        st('wall', rnd() < .7 ? 'hog' : 'small', across(p, dir, len, 4, R(-.06, .06)), {w: (hz ? R(4, 7) : R(7, 13)) * kk(s) + 2, c: jit(facadeCol(hs, z, p[0]), .05), a: .96, clip: 'facade ' + hs.i}) } }
    // eaves, verges and the corner
    if (hs.type === 'gable') st('paint', 'small', [L2(hs.TL, hs.peak, -.03), hs.peak, L2(hs.TR, hs.peak, -.03)], {w: 4 * k + 1, c: km(hs.roofC, 'umber', .35), a: .95, raw: true});
    else st('dark', 'small', [hs.TL, hs.TR], {w: 5 * k + 1, c: km(hs.wall, 'umber violet', .65), a: .9});
    st('dark', 'small', [hs.TL, hs.BL], {w: 2 * k + .5, c: km(hs.wall, 'umber violet', .6), a: .55});
    // windows: rows of dark openings, a few lit from inside, shutters, sills
    const floors = Math.max(2, Math.floor((hs.h - 30) / 58)), cols = hs.type === 'eave' ? 3 : 2;
    for (let r = 0; r < floors; r++) for (let cI = 0; cI < cols; cI++) {
      if (r === 0 && cI === 0) continue;   // the door
      const sw = cols === 3 ? .15 : .2, s0 = (cI + .5) / cols - sw / 2 + G() * .015, s1 = s0 + sw, z0 = 30 + r * 58 + G() * 2, z1 = z0 + 36;
      const a = onFacade(hs, s0, z1), b = onFacade(hs, s1, z1), cc = onFacade(hs, s1, z0), d = onFacade(hs, s0, z0), wdt = Math.max(1.6, b[0] - a[0]);
      const lit = rnd() < .28;
      st('dark', 'small', [L2(a, b, .5), L2(d, cc, .5)], {w: wdt, c: jit(lit ? lerp3('orange deep', 'umber', .3) : 'window', .06), a: .97, raw: true});
      if (lit) { st('impasto', 'small', [L2(L2(a, b, .5), L2(d, cc, .5), .25), L2(L2(a, b, .5), L2(d, cc, .5), .8)], {w: wdt * .55, c: jit(lerp3('gold', 'orange', R(0, .6)), .04), a: .9, raw: true, pr: 'leaf'}); st('dark', 'small', [L2(a, b, .5), L2(d, cc, .5)], {w: Math.max(.7, wdt * .12), c: 'umber', a: .8, raw: true}) }
      st('clean', 'small', [L2(a, b, -.08), L2(a, b, 1.08)].map(q => [q[0], q[1] - 1.2 * kk(s0)]), {w: Math.max(.9, 2.6 * kk(s0)), c: jit(lerp3(facadeCol(hs, z1), 'stone pale', .35), .04), a: .9, raw: true});
      if (rnd() < .55) { const sc = jit(tone(lerp3(pick(['shutter green', 'shutter blue']), DUSK, .55), .88), .05), sh = Math.max(1.2, wdt * .38);
        st('clean', 'small', [[a[0] - sh * .6, a[1]], [d[0] - sh * .6, d[1]]], {w: sh, c: sc, a: .95, raw: true}); st('clean', 'small', [[b[0] + sh * .6, b[1]], [cc[0] + sh * .6, cc[1]]], {w: sh, c: sc, a: .95, raw: true}) }
      st('paint', 'small', [[d[0] - 1, d[1] + 1], [cc[0] + 1, cc[1] + 1]], {w: 1.6 * kk(s0) + .5, c: lerp3(facadeCol(hs, z0), 'rose pale', .5), a: .85, raw: true})
      if (r >= 1 && rnd() < .22) { const kf = kk(s0); st('dark', 'small', [[d[0] - kf, d[1] + 1.2 * kf], [cc[0] + kf, cc[1] + 1.2 * kf]], {w: 4.2 * kf + .6, c: lerp3('shutter green', DUSK, .5), a: .95, raw: true});
        const fl = []; for (let q = 0; q < 6; q++) { const p = L2(d, cc, R(.05, .95)); fl.push([p[0], p[1] - R(0, 3.5) * kf, R(1.4, 2.4) * kf + .3]) } dots('paint', fl, {c: lerp3(pick(['hull red', 'rose', 'cadmium red']), DUSK, .25), a: .95}) } }
    // the door
    { const a = onFacade(hs, .12, 54), b = onFacade(hs, .3, 54), d = onFacade(hs, .12, 0), cc = onFacade(hs, .3, 0);
      st('dark', 'small', [L2(a, b, .5), L2(d, cc, .5)], {w: Math.max(2, b[0] - a[0]), c: jit(lerp3(pick(['shutter green', 'shutter blue', 'hull red', 'window']), DUSK, .45), .05), a: .97, raw: true}) }
    // chimneys
    if (rnd() < .8) { const top = hs.type === 'gable' ? L2(hs.TL, hs.peak, R(.55, .8)) : L2(hs.roof[3], hs.roof[2], R(.15, .85)), ch = R(22, 34) * k, cw = R(9, 13) * k;
      const p = [top[0], top[1] + 6 * k];
      st('paint', 'small', [p, [p[0], p[1] - ch]], {w: cw, c: jit(km(hs.wall, 'violet deep', .45), .05), a: .97, raw: true});
      st('impasto', 'small', [[p[0] + cw * .32, p[1] - 4 * k], [p[0] + cw * .32, p[1] - ch]], {w: cw * .3, c: lerp3('orange', 'pale gold', .3), a: .9, raw: true, pr: prof(t => .3 + .7 * t)});
      st('dark', 'small', [[p[0] - cw * .62, p[1] - ch], [p[0] + cw * .62, p[1] - ch]], {w: 2.6 * k + .5, c: 'umber', a: .9}) }
  }
  dry();
  stage('House lights', 'The low sun along the edges turned to it, in thick paint: the right-hand verges and corners, ridges, the tops of the walls.');
  for (const hs of houses) { const k = hs.k0;
    st('impasto', 'small', hand([hs.BR[0] - 1.2, hs.BR[1] - 4], [hs.TR[0] - 1.2, hs.TR[1] + 1], 4, .3), {w: 2.2 * hs.k1 + .6, c: lerp3(hs.wall, 'pale gold', .55), a: .8, raw: true, pr: prof(t => .2 + .8 * t * t)});
    if (hs.type === 'gable') st('impasto', 'small', [L2(hs.peak, hs.TR, .02), L2(hs.peak, hs.TR, .97)], {w: 2.6 * k + .6, c: lerp3('gold', 'pale gold', .5), a: .92});
    else st('impasto', 'small', hand([hs.roof[3][0] + 2, hs.roof[3][1] + .8], [hs.roof[2][0], hs.roof[2][1] + .8], 5, .3), {w: 2.4 * k + .5, c: lerp3('salmon', 'gold', .5), a: .9, pr: prof(t => .4 + .6 * t)});
    // rosy light from the sky on the upper wall
    for (let i = 0; i < 10; i++) { const s = R(.05, .95), z = hs.h * R(.6, 1.05) + (hs.type === 'gable' ? 50 * (1 - Math.abs(s - .5) * 2) * R(0, 1) : 0), p = onFacade(hs, s, z); if (!inPoly(p[0], p[1], hs.facade)) continue;
      const kk = kOf(lerp(hs.t0, hs.t1, s)), len = R(10, 30) * kk + 4;
      st('wall', 'hog', run(across(p, Math.PI / 2 + R(-.08, .08), len, 4), q => inPoly(q[0], q[1], hs.facade)), {w: R(4, 8) * kk + 2, c: jit(lerp3(facadeCol(hs, z, p[0]), 'rose pale', R(.12, .3)), .04), a: .85, pr: prof(t => Math.min(1, t * 3, (1 - t) * 3))}) } }
  // bollards and a lamp on the quay
  for (const t of [.06, .16, .27, .36]) { const e = qEdge(t), k = kOf(t), w = 11 * k + 2, h = 15 * k + 2, x = e[0], y = e[1] - 2 * k;
    st('dark', 'small', [[x, y], [x, y - h]], {w, c: 'tar', a: .97, raw: true}); st('dark', 'small', [[x - w * .65, y - h], [x + w * .65, y - h]], {w: 3 * k + 1, c: 'tar', a: .97});
    st('impasto', 'small', [[x + w * .32, y - .5], [x + w * .32, y - h + 1]], {w: w * .22, c: 'orange', a: .85, raw: true}) }
  { const t = .21, b = L2(qBase(t), qEdge(t), .45), k = kOf(t), h = 120 * k; st('dark', 'pole', [b, [b[0], b[1] - h]], {w: 3 * k + .8, c: 'tar', a: .97, raw: true});
    st('dark', 'small', [[b[0] - 5 * k, b[1] - h + 2], [b[0] + 5 * k, b[1] - h + 2]], {w: 10 * k + 1, c: 'tar', a: .97});
    dots('impasto', [[b[0], b[1] - h + 7 * k, 4 * k + .8]], {c: 'pale gold', a: 1, dome: .8}) }
}

/* boats, far to near */
function boat(b) {
  const X = b.X, sh = b.sheer, dk = b.deckH, hullSh = lerp3(b.hull, DUSK, .2), N = 10;
  const along = (f, u0 = -1, u1 = 1.02) => Array.from({length: N + 1}, (_, i) => { const u = u0 + (u1 - u0) * i / N; return X(u, Math.max(b.keel(u), sh(u) * f)) });
  // the hull planks, along the boat, darker and cooler at the waterline
  for (let i = 0; i < 30; i++) { const f = R(0, 1), u0 = R(-1.05, .2), u1 = Math.min(1.05, u0 + R(.7, 1.4)), c = f > .82 ? lerp3(lerp3(b.strake, DUSK, .3), b.strake, R(0, .3)) : f > .7 ? lerp3(b.band, DUSK, .2) : lerp3(hullSh, lerp3(hullSh, 'water dark', .55), (1 - f) * .8);
    st('paint', 'hog', along(f, u0, u1), {w: b.Hh * R(.22, .4), c: jit(c, .05), a: .97, clip: 'hull ' + b.name}) }
  for (let r = 1; r < 5; r++) st('dark', 'small', along(r / 5 - .05, -.98, .99), {w: Math.max(.8, b.Hh * .035), c: km(b.hull, 'tar', .6), a: .4, clip: 'hull ' + b.name});
  st('clean', 'hog', along(.91, -1.02, 1.04), {w: b.Hh * .2, c: lerp3(lerp3(b.strake, DUSK, .25), b.strake, .35), a: .95, clip: 'hull ' + b.name});
  st('clean', 'small', along(.75, -1.02, 1.04), {w: b.Hh * .11, c: lerp3(b.band, DUSK, .15), a: .95, clip: 'hull ' + b.name});
  // reflected light from the water low on the hull
  for (let i = 0; i < 6; i++) { const u0 = R(-.9, .3); st('paint', 'scumble', along(R(.08, .3), u0, u0 + R(.3, .6)), {w: b.Hh * R(.12, .2), c: jit(lerp3(hullSh, 'salmon', .4), .05), a: .8, clip: 'hull ' + b.name}) }
  // the deck seen from above, warm, and the inside of the far bulwark
  if (b.mast) for (let i = 0; i < 10; i++) { const f = R(.15, .85), path = Array.from({length: N + 1}, (_, j) => { const u = -.96 + 1.9 * j / N; return X(u, sh(u) + dk(u) * f) });
    st('paint', 'small', path, {w: b.deck * R(.3, .5), c: jit(lerp3('deck', 'salmon', R(0, .45)), .05), a: .95, clip: 'deck ' + b.name}) }
  st('dark', 'small', Array.from({length: N + 1}, (_, j) => { const u = -.97 + 1.95 * j / N; return X(u, sh(u) + dk(u) * .88) }), {w: b.deck * .24, c: km(b.hull, 'tar', .35), a: .9});
  // a few things on deck: a coil, a crate, a net
  if (!b.mast) { // an open boat: its shadowed inside, and the thwarts across it
    for (let i = 0; i < 8; i++) { const f = R(.25, .85), path = Array.from({length: N + 1}, (_, j) => { const u = -.9 + 1.75 * j / N; return X(u, sh(u) + dk(u) * f) });
      st('paint', 'small', path, {w: b.deck * R(.25, .4), c: jit(lerp3(lerp3(b.hull, DUSK, .45), 'umber', R(.1, .4)), .05), a: .95, clip: 'deck ' + b.name}) }
    for (const u of [-.55, .05, .55]) { const a = X(u, sh(u) + dk(u) * .05), c = X(u + .04, sh(u) + dk(u) * .95); st('clean', 'small', [a, c], {w: b.L * .035, c: jit(lerp3('deck', 'pale gold', .3), .04), a: .95, raw: true, clip: 'deck ' + b.name}) } }
  else { const u = R(-.05, .1), p = X(u, sh(u) + dk(u) * .5); st('paint', 'fil', circleArcP(p[0], p[1], b.deck * .22, 0, 6.3, 8), {w: b.deck * .14, c: 'rope', a: .9}) }
  if (b.cabin) { const {u0, u1, h} = b.cabin, a = X(u0, sh(u0) + dk(u0) * .45), c = X(u1, sh(u1) + dk(u1) * .45), topL = [a[0], a[1] - h], topR = [c[0], c[1] - h];
    const fr = [a, c, topR, topL]; doc.shapes['cabin ' + b.name] = PT(fr);
    for (let i = 0; i < 9; i++) { const z = R(0, 1); st('paint', 'hog', [L2(a, topL, z), L2(c, topR, z)], {w: h * .3, c: jit(lerp3(km('hull white', 'violet grey', .5), 'rose pale', z * .35), .05), a: .96, clip: 'cabin ' + b.name}) }
    st('dark', 'small', [[topL[0] - h * .08, topL[1] - 1], [topR[0] + h * .08, topR[1] - 1]], {w: Math.max(2.4, h * .16), c: lerp3('umber violet', DUSK, .3), a: .95});
    st('impasto', 'small', [[topL[0] - h * .06, topL[1] - 1 - h * .08], [topR[0] + h * .08, topR[1] - 1 - h * .08]], {w: Math.max(1.2, h * .06), c: lerp3('rose pale', 'pale gold', .6), a: .9, pr: prof(t => .4 + .6 * t)});
    st('impasto', 'small', [L2(c, topR, .05), L2(c, topR, .95)], {w: Math.max(1.6, h * .08), c: lerp3('salmon', 'pale gold', .5), a: .85, raw: true});
    for (const f of [.2, .58]) { const p = L2(L2(a, c, f), L2(topL, topR, f), .62), q = L2(L2(a, c, f + .2), L2(topL, topR, f + .2), .62); st('dark', 'small', [p, q], {w: h * .28, c: 'window', a: .95, raw: true});
      st('clean', 'small', [L2(p, q, .55), q], {w: h * .1, c: 'orange', a: .8, raw: true}) } }
  // the sun along the gunwale and the stem; the dark of the waterline
  st('impasto', 'small', along(1, -.98, 1.02).map(p => [p[0], p[1] - .6]), {w: Math.max(1.6, b.Hh * .09), c: lerp3('orange', 'pale gold', .55), a: .92, pr: prof(t => .4 + .6 * t)});
  st('impasto', 'small', Array.from({length: 7}, (_, i) => { const u = .76 + .27 * i / 6; return X(u, Math.max(b.keel(u), 2) + 1) }).map(p => [p[0] + b.dir * .8, p[1]]), {w: Math.max(1.4, b.Hh * .08), c: lerp3('salmon', 'gold', .5), a: .75});
  st('dark', 'hog', along(.05, -1, .8), {w: b.Hh * .16, c: lerp3('tar', 'water dark', .5), a: .9, clip: 'hull ' + b.name});
  if (b.mast) { const {mastBase: mb, mastTop: mt} = b, u = b.mast.u, mw = Math.max(2.4, b.L * .014);
    if (b.sail) { const hb = b.cabin ? b.cabin.h + 10 : b.Hh * .7, boomStart = L2(mb, mt, hb / b.mast.h), boomEnd = X(-.9, sh(-.9) + dk(-.9) + (b.cabin ? b.cabin.h * .9 : b.Hh * .35));   // a boom clears the cabin roof, and no more
      st('line', 'rigger', [mt, L2(mt, boomEnd, .5), boomEnd], {w: Math.max(.5, b.L * .002), c: 'umber violet', a: .55});
      st('dark', 'pole', [boomStart, boomEnd], {w: mw * .7, c: 'mast', a: .97, raw: true});
      const sail = seg(boomStart, boomEnd, 6).map((p, i) => [p[0], p[1] - mw * (1.3 + .7 * Math.sin(i / 6 * Math.PI))]);
      st('paint', 'hog', sail, {w: mw * 2.6, c: km('sail', 'violet deep', .25), c2: 'sail', grad: 1, a: .97, pr: prof(t => .5 + .5 * Math.sin(Math.PI * Math.min(1, t * 1.1)))});
      st('impasto', 'small', sail.map(p => [p[0], p[1] - mw * .9]), {w: mw * .6, c: lerp3('sail', 'orange', .6), a: .85, pr: 'leaf'});
      for (let i = 1; i < 5; i++) { const p = L2(boomStart, boomEnd, i / 5); st('dark', 'small', [[p[0] - 1, p[1] - mw * 2.5], [p[0] + 1, p[1] + .5]], {w: 1, c: 'umber', a: .7}) } }
    st('dark', 'pole', [mb, mt], {w: mw, c: 'mast', a: .98, raw: true, pr: prof(t => 1 - .45 * t)});
    st('impasto', 'pole', [L2(mb, mt, .05), L2(mb, mt, .93)].map(p => [p[0] + mw * .3 + .2, p[1]]), {w: Math.max(.9, mw * .3), c: lerp3('orange', 'pale gold', .4), a: .9, raw: true, pr: prof(t => .3 + .7 * t)});
    st('dark', 'small', [[mt[0] - mw * 3, mt[1] + b.mast.h * .14], [mt[0] + mw * 3, mt[1] + b.mast.h * .14]], {w: mw * .6, c: 'mast', a: .95});
    st('clean', 'dab', [[mt[0], mt[1] + 2], [mt[0] - 8 - b.L * .03, mt[1] + 5], [mt[0] - 16 - b.L * .05, mt[1] + 3]], {w: mw * 1.4, c: 'hull red', a: .95});
    const lines = [[mt, X(1.03, sh(1.03))], [mt, X(-1, sh(-1) + 2)], [L2(mt, mb, .14), X(u + .12, sh(u + .12))], [L2(mt, mb, .14), X(u - .1, sh(u - .1))]];
    for (const [p, q] of lines) st('line', 'rigger', [p, L2(p, q, .5).map((v, i) => i ? v + 1.5 : v), q], {w: Math.max(.6, b.L * .0026), c: 'umber violet', a: .7}) }
}
function boatsStage() {
  stage('Boats', 'The boats far to near: planked hulls in shadow, warm decks, the sun along the gunwales; masts, furled sails and rigging.');
  for (const b of boats) boat(b);
  { const b = boats[3]; st('dark', 'pole', [b.X(-.6, b.Hh + 12), b.X(.55, b.Hh + 7)], {w: 3.2, c: 'mast', a: .95, raw: true}); st('impasto', 'pole', [b.X(-.55, b.Hh + 13.5), b.X(.5, b.Hh + 8.5)], {w: 1.2, c: 'orange', a: .8, raw: true}) }
  dry();
}

/* the knife: broken reflections, horizontal slabs */
function knifeWater() {
  stage('Knife reflections', 'The palette knife drawn across the dry water in short horizontal slabs: reflected sky, the dark of the boats and the quay.');
  const slabs = [];
  for (let i = 0; i < 5000; i++) { const y = HY + 2 + Math.pow(rnd(), 1.15) * (H - HY + 10), x = R(-20, W + 20), s = 1.6 + (y - HY) * .045; if (!onWater(x, y)) continue;
    const m = mirrorAt(x, y), g = glit(x, y); if (rnd() < (m.obj ? .35 : .7)) continue; slabs.push([x, y, s, m, g]) }
  for (const [x, y, s, m, g] of slabs) { const w = s * R(.35, 1) * (rnd() < .15 ? 1.6 : 1), len = s * R(4, 16) + 4, sl = G() * .03;
    const path = run(arc(x - len / 2, y, sl, len, G() * .06, 6), p => onWater(p[0], p[1])); if (path.length < 2) continue;
    let c = waterCol(x + R(-4, 4), y); if (!m.obj) c = lerp3(c, lerp3(m.c, 'pale gold', .15), R(.1, .42) * (1 - (y - HY) / 700));
    const skyHere = lerp3(skyCol(x + G() * 40, Math.max(2, HY - (y - HY) * R(.4, 1))), deepAt(y), .3 + .3 * (y - HY) / 400);
    if (m.obj && rnd() < .3) c = lerp3(c, skyHere, R(.5, .85)); else if (!m.obj && rnd() < .14) c = lerp3(c, deepAt(y), R(.3, .6));
    st(m.obj ? 'dark' : 'paint', 'slab', path, {w, c: jit(c, .06), a: .96, pr: prof(t => Math.min(1, t * R(4, 9), (1 - t) * R(2, 8)) * R(.85, 1))}) }
  dry();
  stage('Glitter', 'The sun\'s path on the water in thick pale paint, and sparks across the ripples; the last touches of light.');
  const sparks = [];
  for (let i = 0; i < 12000 && sparks.length < 1000; i++) { const y = HY + 2 + Math.pow(rnd(), 1.3) * (H - HY), x = R(0, W), g = glit(x, y); if (!onWater(x, y)) continue; if (rnd() < g * .9 || (rnd() < .0015 && !mirrorAt(x, y).obj)) sparks.push([x, y, g]) }
  for (const [x, y, g] of sparks) { const s = 1.6 + (y - HY) * .045, w = s * R(.3, .85) * (.6 + g * .5), len = s * R(3, 12) * (.5 + g) + 3;
    const path = run(arc(x - len / 2, y, G() * .03, len, G() * .06, 5), p => onWater(p[0], p[1])); if (path.length < 2) continue;
    const c = g > .2 ? lerp3(lerp3('orange', 'gold', R(0, 1)), lerp3('pale gold', 'sun white', R(0, 1)), Math.min(1, g * R(.5, 1.2))) : lerp3(waterCol(x, y), lerp3(skyCol(x, HY - (y - HY) * .82), 'rose pale', .2), R(.4, .7));
    st('impasto', 'slab', path, {w, c: jit(c, .03), a: .97, pr: prof(t => Math.min(1, t * R(4, 9), (1 - t) * R(2, 6)))}) }
  for (let i = 0; i < 60; i++) { const y = HY + 3 + Math.pow(rnd(), 2) * (H - HY), hw = 10 + (y - HY) * .2, x = SX + G() * hw, s = 1.6 + (y - HY) * .045; if (!onWater(x, y)) continue;
    const len = s * R(1.2, 4) + 2, path = run(arc(x - len / 2, y, G() * .03, len, 0, 4), p => onWater(p[0], p[1]));
    st('impasto', 'slab', path, {w: s * R(.2, .45), c: jit(lerp3('pale gold', '#fffdf0', R(.3, 1)), .01), a: 1, pr: prof(t => Math.min(1, t * 6, (1 - t) * 4))}) }
  // the boats' masts, wavering down through the water in broken pieces
  for (const b of boats) { if (!b.mast) continue; const x0 = b.mastBase[0], w0 = b.wl(x0), len = b.mast.h * .8;
    // one long wiggle, sideways swing growing with distance from the boat, broken into pieces more and more often
    const yEnd = Math.min(H + 5, w0 + len), wig = [], sd = R(0, 99);
    for (let y = w0 + b.Hh * 1.02; y < yEnd; y += 1.6) { const dd = (y - w0) / len; wig.push([x0 + (fbm(sd, y / (5 + 9 * dd), 2) - .5) * 3.2 * (1.2 + 9 * dd), y, dd]) }
    for (let i = 0; i < wig.length - 2;) { const dd = wig[i][2], n = Math.max(2, Math.round(R(3, 9) * (1 - .6 * dd))), piece = wig.slice(i, i + n + 1);
      if (piece.length > 1 && rnd() < .95 - .5 * dd) st('dark', 'small', piece.map(q => [q[0], q[1]]), {w: R(1.5, 2.6) * (1 - .4 * dd) * (b.L / 330 + .45), c: jit(lerp3('mast', 'water dark', .1 + .45 * dd), .05), a: .95});
      i += n + Math.round(R(0, 3) * (.3 + 2.5 * dd)) } }
  st('impasto', 'small', hand([600, HY + 1.2], [1000, HY + 1.6], 8, .3), {w: 1.8, c: 'pale gold', a: .7, pr: prof(t => .3 + .7 * Math.sin(Math.PI * t))});
}

/* mooring lines and the last accents */
function accents() {
  stage('Moorings', 'Mooring lines from the bollards to the boats, sagging; small dark accents at the waterlines.');
  const rope = (p, q, sag, w = 1.1) => { const m = L2(p, q, .5); st('line', 'rigger', [p, [m[0], m[1] + sag], q], {w, c: 'rope', a: .85}) };
  const bq = boats[1], bm = boats[2], bs = boats[3], bol = t => { const e = qEdge(t), k = kOf(t); return [e[0], e[1] - 2 * k - (15 * k + 2) * .6] };
  rope(bol(.27), bq.X(1.0, bq.sheer(1)), 10);
  rope(bol(.16), bq.X(-1, bq.sheer(-1)), 8, .9);
  rope(bol(.36), bm.X(-1, bm.sheer(-1) + 1), 24, 1.3);
  rope(bol(.06), bs.X(1.02, bs.sheer(1.02)), 30, 1.3);
  for (const b of boats) st('dark', 'small', seg(b.X(-1, .5), b.X(.8, .5), 6), {w: 2, c: 'water dark', a: .8, pr: prof(t => Math.sin(Math.PI * t))});
}

/* =====================================================================
   PAINT IT
   ===================================================================== */
drawing();
blockIn();
sky();
skyLights();
distance();
water();
knifeWater();
quay();
town();
boatsStage();
accents();

const problems = P.check(doc);
if (problems.length) { console.error(problems.length + ' problems\n  - ' + problems.slice(0, 20).join('\n  - ')); process.exit(1) }
// one mark to a line: a long file, but one that a person can still read and a diff can still show
const J = v => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
const line = q => q.do ? '      {"with": ' + J(q.with) + ', "do": [\n' + q.do.map(m => '        ' + J(m)).join(',\n') + '\n      ]}' : '      ' + J(q);
const body = doc.steps.map(s => '    {"name": ' + JSON.stringify(s.name) + (s.note ? ', "note": ' + JSON.stringify(s.note) : '') + ', "do": [\n' + s.do.map(line).join(',\n') + '\n    ]}').join(',\n');
const head = Object.assign({}, doc); delete head.steps;
const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "steps": [\n' + body + '\n  ]\n}\n');
JSON.parse(text);
writeFileSync(OUT, text);
let count = 0; const walk = l => l.forEach(s => s.do ? walk(s.do) : count += s.paths ? s.paths.length : s.dots ? s.dots.length : 1); walk(doc.steps);
console.log(OUT.split('/').pop() + '  ' + (text.length / 1024).toFixed(0) + ' kB  ' + doc.steps.length + ' stages, ' + count + ' marks');
