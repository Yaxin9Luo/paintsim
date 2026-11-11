// node paintings/magpie.gen.mjs   →   paintings/magpie.json
//
// "A magpie perched in the margin of a medieval manuscript page, holding a pen nib in its beak."
//
// The picture is composed here — by rule, and by seeded chance where a hand would vary — and written out as an ordinary
// painting document: every stroke, fill and dot in order, with the paints, brushes and light it needs. The document does
// not refer back to this file. A painting of this size is not written by hand; some program writes it, and this is one.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {spline, arc, circleArc, rect, lerp, clamp, smooth, fbm} = P.util;

/* ---------- chance, with a seed ---------- */
let seed = 20261111;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];

/* ---------- the palette: colours are mixed from pigments, the way they would be on a shell ---------- */
const MIX = {
  'ink': '#15100e', 'sepia': {mix: {'burnt umber': 2, 'raw sienna': 1}}, 'script brown': '#30200f',
  'rubric': {mix: {'vermilion': 3, 'alizarin crimson': .5}}, 'azure': {mix: {'ultramarine': 2, 'titanium white': 1}}, 'azure deep': {mix: {'ultramarine': 3, 'prussian blue': 1}}, 'azure light': {mix: {'ultramarine': 1, 'titanium white': 2.5}},
  // the bird's blacks, and the colours its gloss turns to
  'black': {mix: {'lamp black': 3, 'prussian blue': 1}}, 'black warm': {mix: {'lamp black': 3, 'burnt umber': 1.2}}, 'black violet': {mix: {'lamp black': 3, 'dioxazine violet': .5}},
  'slate': '#1c2437', 'slate light': '#2b3752',
  'night blue': {mix: {'prussian blue': 1, 'ultramarine': 2}}, 'night teal': {mix: {'prussian blue': 1, 'phthalo green': 1}}, 'night green': {mix: {'phthalo green': 2, 'prussian blue': .4, 'burnt umber': .3}}, 'night violet': {mix: {'dioxazine violet': 1, 'prussian blue': .6}},
  'gloss blue': {mix: {'ultramarine': 3, 'cerulean': 1, 'titanium white': .5}}, 'gloss teal': {mix: {'phthalo green': 1, 'cerulean': 2, 'titanium white': .3}}, 'gloss green': {mix: {'viridian': 3, 'phthalo green': 1, 'cadmium yellow': .2, 'titanium white': .3}}, 'gloss violet': {mix: {'dioxazine violet': 1, 'ultramarine': 1, 'titanium white': .6}},
  'glint blue': {mix: {'cobalt blue': 2, 'cerulean': 1, 'titanium white': 2.5}}, 'glint teal': {mix: {'cerulean': 2, 'viridian': 1, 'titanium white': 2.5}}, 'glint green': {mix: {'viridian': 2, 'cadmium yellow': .3, 'titanium white': 2}}, 'glint violet': {mix: {'dioxazine violet': .5, 'cobalt blue': 1, 'titanium white': 2.5}},
  // whites and their shadows
  'white': 'titanium white', 'white warm': {mix: {'titanium white': 8, 'naples yellow': 1}}, 'white bone': 'lead white',
  'shade cool': {mix: {"payne's grey": 1, 'rose madder': .3, 'titanium white': 4}}, 'shade deep': {mix: {'ultramarine': 1, 'alizarin crimson': .3, 'raw umber': .6, 'titanium white': 2.5}}, 'shade warm': {mix: {'raw sienna': .5, 'rose madder': .3, 'titanium white': 5}},
  // stem and leaves
  'bark': {mix: {'burnt umber': 2, 'lamp black': .4}}, 'bark light': {mix: {'raw sienna': 2, 'yellow ochre': 1, 'titanium white': .6}}, 'bark mid': {mix: {'burnt umber': 1, 'raw sienna': 1.5}},
  'leaf': {mix: {'sap green': 2, 'viridian': 1}}, 'leaf light': {mix: {'sap green': 2, 'cadmium yellow': 1, 'titanium white': 1}}, 'leaf dark': {mix: {'sap green': 1, 'prussian blue': .3, 'burnt umber': .4}},
  'rose': {mix: {'rose madder': 2, 'titanium white': 1}}, 'rose light': {mix: {'rose madder': 1, 'titanium white': 2.5, 'naples yellow': .5}}, 'rose dark': {mix: {'alizarin crimson': 1, 'burnt umber': .3}},
  'horn': {mix: {'lamp black': 2, 'raw umber': 1, 'titanium white': .25}}, 'horn light': {mix: {"payne's grey": 2, 'titanium white': 1.2}}
};
const CC = new Map();
const C = c => { if (typeof c !== 'string') return c; let v = CC.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); CC.set(c, v) } return v };
const km = (a, b, t) => t <= 0 ? C(a) : t >= 1 ? C(b) : P.mix([[C(a), 1 - t], [C(b), t]]);   // mixed as pigments
const tone = (c, k) => { c = C(c); return [c[0] * k, c[1] * k, c[2] * k] };
const hex = c => P.hex(C(c));

/* ---------- the document ---------- */
const doc = {
  paintsim: 1, engine: P.VERSION, title: 'Magpie in the margin',
  note: 'A magpie perched in the margin of a manuscript page with a pen nib in its bill: watercolour washes, body colour and ink on vellum, with gold leaf. Written by paintings/magpie.gen.mjs.',
  size: [1000, 1000], ground: 'vellum',
  light: {base: 'raking', lens: {focus: [.47, .46], depth: .34, blur: 11, vignette: .36, contrast: .16, grain: 1}},
  seed: 20261111,
  define: {
    pigments: MIX,
    materials: {
      // transparent colour in water
      'tint': {base: 'watercolour', note: 'a thin glaze that stays where it is put', water: 0, flow: 0, rim: .2, gran: .3, opacity: .35, uneven: .5, soft: 1.2},
      'stain': {base: 'watercolour', note: 'what age leaves on the skin', color: '#ddbf91', water: 0, flow: 0, rim: 0, gran: .2, opacity: .08, uneven: .6, soft: 22},
      'ruling': {base: 'watercolour', note: 'lines ruled in red lead', color: '#9e5c52', water: 0, flow: 0, rim: 0, gran: .5, opacity: .32},
      'script ink': {base: 'iron gall ink', color: 'script brown', opacity: .93},
      'quill ink': {base: 'ink', note: 'carbon ink from a quill; dry before the next touch', body: .44, water: 0, flow: 0, reach: 0},
      // body colour
      'colour': {base: 'tempera', note: 'pigment in glair, for the small bright things', opacity: .93, body: .6, ridges: .3, grain: .05, gloss: .1, blend: .7, dry: .3, reach: 0},
      'lead white': {base: 'tempera', note: 'thick white that keeps the mark of the brush', color: 'white bone', color2: 'white', blend: .5, opacity: .92, body: .85, ridges: .05, grain: .015, level: .05, gloss: .08, sharp: .25, dry: .35, open: .6, pickup: .012, merge: .15, bury: .6, reach: 0},
      'bar leaf': {base: 'gold leaf', note: 'the leaf of the bar and the border', sharp: .5},
      'berry': {base: 'enamel', color: {mix: {'alizarin crimson': 2, 'vermilion': 1}}, gloss: .6, sharp: .7, body: .3},
      // the bird
      'plumage': {note: 'black body colour with a little gloss; it stays wet long enough to be worked into', color: 'black', color2: 'slate', blend: .6, opacity: .96, body: .7, ridges: .3, grain: .1, gloss: .34, sharp: .5, dry: .12, open: .5, pickup: .008, merge: .1, bury: .6},
      'horn': {base: 'plumage', note: 'bill and legs', color: 'horn', color2: 'horn light', body: .7, ridges: .45, gloss: .28, sharp: .5, open: .1, pickup: 0, merge: 0},
      'sheen blue': {base: 'plumage', note: 'dark paint full of interference flakes: the gloss of the feathers', opacity: .88, gloss: .36, sharp: .55, open: .2, pickup: 0, merge: 0, flake: {amount: .9, hue: 225, spread: .2, chroma: .75, size: .8, sparkle: .9, sheen: .6}},
      'sheen teal': {base: 'sheen blue', flake: {amount: .9, hue: 188, spread: .2, chroma: .75, size: .8, sparkle: .9, sheen: .6}},
      'sheen green': {base: 'sheen blue', flake: {amount: .9, hue: 152, spread: .2, chroma: .75, size: .8, sparkle: .9, sheen: .6}},
      'sheen violet': {base: 'sheen blue', flake: {amount: .9, hue: 268, spread: .2, chroma: .75, size: .8, sparkle: .9, sheen: .6}},
      'gloss': {note: 'a clear medium full of interference flakes: no colour of its own, only what the light gives it, and that changes with the slope of the paint beneath', color: '#ffffff', mode: 'stain', film: 1, opacity: .9, body: .12, ridges: .05, level: .3, gloss: .5, sharp: .6, rim: 0, gran: 0, dry: .1, bury: .08,
        flake: {amount: 1, hue: 200, spread: .22, chroma: .8, size: .7, sparkle: .7, sheen: 1, drift: 26}},
      'gloss green': {base: 'gloss', flake: {amount: 1, hue: 160, spread: .14, chroma: .8, size: .7, sparkle: .7, sheen: 1, drift: 26}},
      'gloss violet': {base: 'gloss', flake: {amount: 1, hue: 250, spread: .08, chroma: .75, size: .7, sparkle: .7, sheen: 1, drift: 26}},
      'eye': {base: 'enamel', note: 'a drop of dark varnish', color: '#0b0705', body: .3},
      'nib metal': {base: 'gold leaf', note: 'a cut and polished nib', color: '#f1cd78', sharp: .78, cushion: {height: 6, round: 9},
        texture: [{mask: 'lines', scale: .5, length: 18, angle: 1.4, signed: true, height: .22}, {mask: 'noise', scale: 11, amount: .1, soft: .08, tone: .82}]},
      'nib ink': {base: 'ink', note: 'ink still wet on the point', water: 0, flow: 0, reach: 0, gloss: .6, sharp: .7, body: .3}
    },
    brushes: {
      'point': {base: 'round', note: 'a pointed brush pressed evenly', profile: 'taper', wobble: .2},
      'feather': {base: 'filbert', note: 'one touch, one small feather', wobble: 1, var: .25, clump: 3},
      'comma': {base: 'round', profile: 'comma', wobble: .2},
      'hair': {base: 'liner', wobble: .5, dry: .3},
      'vane': {base: 'round', note: 'the whole vane of a feather, or a stem, in one shaped stroke', clump: 2.6, streak: 1.2, wobble: .2, var: .05},
      'scumble': {base: 'round', note: 'a nearly dry brush dragged along', profile: 'taper', dry: .72, streak: 1.3, wobble: .5},
      'barb': {base: 'round', profile: 'comma', width: 2, dry: .38, wobble: .2},
      'drag': {base: 'filbert', note: 'the feather touch, drier', dry: .34, wobble: 1, var: .25, clump: 2.6, streak: 1.2},
      'wide': {base: 'filbert', note: 'for the broad whites', clump: 3.5, wobble: 1.4, var: .25, vary: .05},
      'wide leaf': {base: 'round', clump: 3.5, wobble: 1.4, var: .25, vary: .05},
      'wide dry': {base: 'filbert', clump: 3.5, wobble: 1.4, var: .25, vary: .05, dry: .4},
      'dry feather': {base: 'filbert', note: 'almost dry, so that it catches only on the ridges of the paint beneath', dry: .8, charge: .5, wobble: 1, var: .3, clump: 2.2, streak: 1.5},
      'bill': {base: 'round', clump: 2.6, streak: 1.1, wobble: .8, dry: .35},
      'quill': {base: 'pen'},
      'sketch': {base: 'pen', note: 'a quill that is in a hurry', var: .6, wobble: .6},
      'outline': {base: 'pen', profile: 'flat', var: .2, wobble: .15},
      'hatch': {base: 'pen', profile: 'hair', var: .4},
      'broad nib': {base: 'nib', width: 3.7},
      'rule': {shape: 'flat', profile: 'flat', width: .55, clump: 3, streak: .2},
      'band': {base: 'flat', width: 8, rag: 0, wobble: .3}
    }
  },
  shapes: {}, steps: []
};

/* ---------- writing steps ---------- */
let cur = null, grp = null;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100, n3 = v => Math.round(v * 1000) / 1000;
const PT = pts => pts.map(p => [n1(p[0]), n1(p[1])]);
const colOf = c => typeof c === 'string' && c[0] === '#' ? c : hex(c);
function stage(name, note) { cur = {name, do: []}; if (note) cur.note = note; doc.steps.push(cur); grp = null }
// consecutive steps with the same paint and brush share them through one group
function put(shared, step) { const key = JSON.stringify(shared); if (!grp || grp.key !== key) { grp = {key, node: {with: shared, do: []}}; cur.do.push(grp.node) } grp.node.do.push(step) }
// a stroke. o: w width · c, c2 colours · a opacity · pr pressure (name or list) · press · grad · load · wob · tone2 · clip · raw (no spline)
function st(material, brush, path, o = {}) {
  if (path.length < 2) return;
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
  if (o.cushion) s.cushion = o.cushion;
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
const dot = (material, x, y, r, o) => dots(material, [[x, y, r]], o);
const flow = t => { cur.do.push({flow: t}); grp = null }, dry = (v = true) => { cur.do.push({dry: v}); grp = null };

/* ---------- geometry ---------- */
const closed = p => p.concat([p[0]]);
const local = (pts, x, y, ang, s) => { const c = Math.cos(ang), n = Math.sin(ang); return pts.map(p => [x + (p[0] * c - p[1] * n) * s, y + (p[0] * n + p[1] * c) * s]) };
function blob(cx, cy, r, n = 11, irr = .3) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283, rr = r * (1 + R(-irr, irr)); p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]) } return p }   // used as {curve}
function tendril(x, y, ang, len, k0, k1) { const p = [[x, y]], s = 4; for (let d = 0; d < len; d += s) { const t = d / len; ang += (k0 + (k1 - k0) * t * t) * s; x += Math.cos(ang) * s; y += Math.sin(ang) * s; p.push([x, y]) } return p }
function tipArc(sx, sy, ang, len, wid, t0, t1) { const ca = Math.cos(ang), sa = Math.sin(ang), cx = sx + ca * len * .66, cy = sy + sa * len * .66, ra = len * .34, rb = wid * .5, p = [];
  for (let i = 0; i <= 8; i++) { const th = t0 + (t1 - t0) * i / 8, a = ra * Math.cos(th), b = rb * Math.sin(th); p.push([cx + ca * a - sa * b, cy + sa * a + ca * b]) } return p }
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
function distPoly(x, y, p) { let d = 1e18; for (let i = 0; i < p.length - 1; i++) { const ax = p[i][0], ay = p[i][1], vx = p[i + 1][0] - ax, vy = p[i + 1][1] - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1), dx = x - ax - vx * t, dy = y - ay - vy * t, dd = dx * dx + dy * dy; if (dd < d) d = dd } return Math.sqrt(d) }
const bbox = p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) } return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0} };
function sampleIn(poly, n) { const b = bbox(poly), out = []; let guard = 0; while (out.length < n && guard++ < n * 80) { const x = R(b.x0, b.x1), y = R(b.y0, b.y1); if (inPoly(x, y, poly)) out.push([x, y]) } return out }
// blue-noise scatter with a spacing that changes over the shape (small feathers on the face, large on the body)
function poisson(poly, rf, rmin, rmax) { const b = bbox(poly), cell = rmax, grid = new Map(), out = [], M = Math.ceil(b.w * b.h / (rmin * rmin) * 9);
  for (let i = 0; i < M; i++) { const x = R(b.x0, b.x1), y = R(b.y0, b.y1); if (!inPoly(x, y, poly)) continue; const r = rf(x, y), gx = Math.floor(x / cell), gy = Math.floor(y / cell); let ok = true;
    for (let a = gx - 1; a <= gx + 1 && ok; a++) for (let c = gy - 1; c <= gy + 1 && ok; c++) { const g = grid.get(a * 8192 + c); if (g) for (const p of g) { const dx = p[0] - x, dy = p[1] - y; if (dx * dx + dy * dy < r * r) { ok = false; break } } }
    if (ok) { const key = gx * 8192 + gy; let g = grid.get(key); if (!g) grid.set(key, g = []); g.push([x, y]); out.push([x, y]) } }
  return out }

/* ---------- the pen ---------- */
function pen(path, o = {}) { st(o.mat || 'quill ink', o.brush || 'quill', path, {w: o.w ?? 1.15, c: o.c, a: o.a ?? .88, raw: o.raw, wob: o.wob, pr: o.pr}) }
// a quick line as a hand draws it: restated, never twice in the same place, overshooting its ends
function loose(path, o = {}) { if (path.length < 2) return; const n = o.n ?? 2, j = o.j ?? 2, ext = o.ext ?? 7;
  for (let k = 0; k < n; k++) { const dx = k ? R(-j, j) : 0, dy = k ? R(-j, j) : 0; let L = path.map(p => [p[0] + dx + R(-j, j) * .5, p[1] + dy + R(-j, j) * .5]);
    const a = L[0], b = L[1], c = L[L.length - 2], d = L[L.length - 1], l0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, l1 = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1, e0 = R(-ext * .3, ext), e1 = R(-ext * .3, ext);
    L = [[a[0] + (a[0] - b[0]) / l0 * e0, a[1] + (a[1] - b[1]) / l0 * e0]].concat(L.slice(1, -1), [[d[0] + (d[0] - c[0]) / l1 * e1, d[1] + (d[1] - c[1]) / l1 * e1]]);
    pen(L, {brush: 'sketch', w: (o.w ?? 1.2) * R(.7, 1.3), c: o.c, a: (o.a ?? .75) * (k ? R(.4, .8) : 1), wob: o.wob}) } }
// a patch of quick parallel hatching
function inkHatch(x, y, ang, n, len, gap, o = {}) { const nx = -Math.sin(ang), ny = Math.cos(ang);
  for (let i = 0; i < n; i++) { const off = gap * i + R(-gap * .3, gap * .3), l = len * R(.6, 1.15), sh = R(-len * .15, len * .15);
    pen(arc(x + nx * off + Math.cos(ang) * sh, y + ny * off + Math.sin(ang) * sh, ang + R(-.08, .08), l, R(-.25, .25), 4), {brush: 'hatch', w: (o.w ?? .9) * R(.7, 1.2), c: o.c || 'sepia', a: (o.a ?? .45) * R(.6, 1.1)}) } }

/* =====================================================================
   THE PAGE
   ===================================================================== */
function vellum() {
  stage('The vellum', 'What the skin brings with it: stains, follicles, the marks of the scraper.');
  for (let i = 0; i < 7; i++) fl('stain', {curve: PT(blob(R(0, 1000), R(0, 1000), R(60, 190), 9, .4))});
  for (const [x, y, r] of [[40, 60, 150], [985, 950, 190], [30, 965, 170], [960, 40, 130]]) fl('stain', {curve: PT(blob(x, y, r, 9, .3))}, {a: .11, soft: 40});
  const bins = [[], [], [], []], add = (x, y, r, a) => bins[a < .1 ? 0 : a < .15 ? 1 : a < .2 ? 2 : 3].push([x, y, r]);
  for (let i = 0; i < 2600; i++) add(R(0, 1000), R(0, 1000), R(.25, .9), R(.05, .26));
  for (let c = 0; c < 26; c++) { const cx = R(0, 1000), cy = R(0, 1000), an = R(0, 3.14); for (let i = 0; i < 34; i++) { const d = R(-60, 60), o = R(-9, 9); add(cx + Math.cos(an) * d - Math.sin(an) * o, cy + Math.sin(an) * d + Math.cos(an) * o, R(.3, .8), R(.06, .22)) } }
  bins.forEach((b, i) => dots('tint', b, {c: '#946e47', a: [.075, .125, .175, .23][i], soft: .5}));
  for (let i = 0; i < 60; i++) { const x = R(0, 1000), y = R(0, 1000), an = R(-.5, -.15), l = R(40, 200); st('tint', 'point', [[x, y], [x + Math.cos(an) * l, y + Math.sin(an) * l]], {w: R(.5, 1.1), c: '#ccb38c', a: R(.05, .12)}) }
}

/* gothic book hand for the (unreadable) text: every letter a few strokes of a broad nib held at one angle */
const GL = {
  i: {w: .3, s: [[[-.07, -.9], [0, -1], [0, -.1], [.1, 0]]]},
  n: {w: .6, s: [[[-.07, -.9], [0, -1], [0, -.1], [.08, 0]], [[0, -.8], [.15, -1], [.3, -.88], [.3, -.1], [.4, 0]]]},
  m: {w: .9, s: [[[-.07, -.9], [0, -1], [0, -.1], [.08, 0]], [[0, -.8], [.15, -1], [.3, -.88], [.3, -.1], [.36, 0]], [[.3, -.8], [.45, -1], [.6, -.88], [.6, -.1], [.7, 0]]]},
  u: {w: .6, s: [[[-.05, -.92], [0, -1], [0, -.16], [.12, 0], [.3, -.2]], [[.3, -1], [.3, -.1], [.4, 0]]]},
  o: {w: .52, s: [[[.18, -1], [.02, -.74], [.02, -.25], [.17, 0], [.33, -.26], [.33, -.76], [.18, -1]]]},
  c: {w: .46, s: [[[.32, -.84], [.17, -1], [.02, -.72], [.02, -.25], [.16, 0], [.33, -.14]]]},
  e: {w: .48, s: [[[.32, -.84], [.17, -1], [.02, -.72], [.02, -.25], [.16, 0], [.33, -.14]], [[.04, -.52], [.33, -.68], [.2, -.98]]]},
  a: {w: .58, s: [[[.04, -.88], [.2, -1], [.32, -.85], [.32, -.1], [.42, 0]], [[.32, -.56], [.1, -.5], [.01, -.24], [.12, 0], [.32, -.2]]]},
  l: {w: .3, s: [[[-.06, -1.66], [0, -1.75], [0, -.1], [.12, 0]]]},
  b: {w: .54, s: [[[-.06, -1.66], [0, -1.75], [0, -.1], [.14, 0], [.33, -.24], [.33, -.74], [.18, -1], [0, -.8]]]},
  d: {w: .54, s: [[[.18, -1], [.02, -.74], [.02, -.25], [.17, 0], [.33, -.26], [.33, -.76]], [[-.14, -1.62], [.1, -1.26], [.33, -.78]]]},
  p: {w: .54, s: [[[-.06, -.92], [0, -1], [0, .72]], [[0, -.8], [.18, -1], [.33, -.74], [.33, -.25], [.15, 0], [0, -.12]]]},
  s: {w: .3, s: [[[.3, -1.58], [.16, -1.76], [.03, -1.5], [.03, -.06], [-.05, .06]]]},
  t: {w: .44, s: [[[.03, -1.22], [.03, -.16], [.15, 0], [.31, -.13]], [[-.1, -.96], [.32, -.96]]]},
  r: {w: .42, s: [[[-.07, -.9], [0, -1], [0, -.1], [.1, 0]], [[.02, -.84], [.2, -1], [.32, -.9]]]},
  g: {w: .56, s: [[[.18, -1], [.02, -.74], [.02, -.25], [.17, 0], [.33, -.26]], [[.33, -.94], [.33, .32], [.2, .62], [0, .56], [-.05, .4]]]}
}, GK = Object.keys(GL);
function script(x0, x1) {
  stage('Ruling and script', 'The text column at the edge of the page, written before anything was painted.');
  const Sx = 27, LH = 64;
  for (let y = 44; y < 1010; y += LH) st('ruling', 'rule', [[x0 - 36, y + 2.5], [1004, y + 2.5 + R(-.6, .6)]]);
  st('ruling', 'rule', [[x0 - 5, -5], [x0 - 5 + R(-1, 1), 1005]]);
  const glyph = (key, gx, gy, s, mat, o) => { for (const sp of GL[key].s) st(mat, 'broad nib', sp.map(p => [gx + p[0] * s + R(-.4, .4), gy + p[1] * s + R(-.4, .4)]), o) };
  const initials = [];
  for (let y = 44; y < 1010; y += LH) { let x = x0 + R(-2, 4), first = true;
    while (x < x1 - 10) { const n = 2 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) { const key = pick(GK), g = GL[key]; if (x + g.w * Sx > x1 + 8) break;
        if (first && rnd() < .13) { initials.push([x - 3, y + 1.5, rnd() < .5]); x += GL.o.w * Sx * 1.22 }
        else { glyph(key, x, y + R(-.6, .6), Sx, 'script ink'); x += g.w * Sx + R(0, 1.1) } first = false }
      x += Sx * .5 } }
  for (const [x, y, red] of initials) glyph('o', x, y, Sx * 1.22, 'colour', {w: 5.4, c: red ? 'rubric' : 'azure deep'});
  dry();
}

function gilding() {
  stage('Gold leaf', 'A bar of leaf on raised gesso between the picture and the text, with its blue fillet.');
  fl('bar leaf', {rect: [852, -30, 870, 1030]}, {cushion: {height: 3.4, round: 2.2}});
  st('colour', 'band', [[846.6, -20], [846.4, 1020]], {c: 'azure deep', c2: 'azure', load: 0});
  const pearls = []; for (let y = 6; y < 1000; y += 10.5) pearls.push([846.5 + R(-.4, .4), y + R(-.5, .5), R(1, 1.45)]);
  dots('lead white', pearls, {dome: 1.2});
  for (const x of [842.4, 851.2, 870.8]) pen([[x, -10], [x + R(-.3, .3), 500], [x + R(-.3, .3), 1010]], {w: .95, a: .8});
}

/* ---------- the small furniture of a border ---------- */
function ivyLeaf(x, y, ang, s) { const ctl = local([[0, 0], [.12, -.5], [.32, -.62], [.5, -.3], [1, 0], [.5, .3], [.32, .62], [.12, .5]], x, y, ang, s);
  fl('gold leaf', {curve: PT(ctl)}, {cushion: {height: 2.6, round: 1.3}});
  pen(closed(spline(ctl, 5, true)), {brush: 'outline', w: .9, a: .85, raw: true});
  pen([[x + Math.cos(ang) * s * .1, y + Math.sin(ang) * s * .1], [x + Math.cos(ang) * s * .7, y + Math.sin(ang) * s * .7]], {w: .6, a: .5}) }
function bezant(x, y, r) { fl('gold leaf', {circle: [n1(x), n1(y), n2(r)]}, {cushion: {height: 2.8, round: n2(Math.max(.8, r * .42))}});
  pen(circleArc(x, y, r, 0, 6.4, 22), {brush: 'outline', w: .85, a: .85, raw: true});
  for (let i = 0; i < 3; i++) { const a = R(0, 6.283); pen(arc(x + Math.cos(a) * r, y + Math.sin(a) * r, a, R(5, 9), R(-.8, .8), 4), {brush: 'hatch', w: .7, a: .7}) } }
function floret(x, y, r, col, lit) { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + .3;
    st('colour', 'feather', arc(x + Math.cos(a) * r * .2, y + Math.sin(a) * r * .2, a, r, 0, 3), {w: r * .8, c: col, c2: lit, a: .93});
    st('lead white', 'point', arc(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, a, r * .4, 0, 2), {w: r * .2, a: .8}) }
  bezant(x, y, r * .3) }
function berry(x, y, r) { dot('berry', x, y, r, {dome: 2.4}); dot('lead white', x - r * .3, y - r * .34, r * .22, {a: .8});
  pen(circleArc(x, y, r, 0, 6.4, 18), {brush: 'outline', w: .8, a: .8, raw: true}) }
function vine(x, y, ang, len, k0, k1, gap = 40, first = 30) { const p = tendril(x, y, ang, len, k0, k1);
  pen(p, {brush: 'sketch', w: 1.2, a: .85, raw: true});
  let side = rnd() < .5 ? 1 : -1;
  for (let i = Math.round(first / 4); i < p.length - 3; i += Math.round(R(gap * .8, gap * 1.2) / 4)) {
    const a = p[i], b = p[i + 1], ta = Math.atan2(b[1] - a[1], b[0] - a[0]), sa = ta + side * R(.9, 1.3), sl = R(11, 18), e = [a[0] + Math.cos(sa) * sl, a[1] + Math.sin(sa) * sl];
    pen(arc(a[0], a[1], sa, sl, side * -.5, 4), {brush: 'outline', w: .8, a: .8}); const r = rnd();
    if (r < .6) ivyLeaf(e[0], e[1], sa, R(14, 19)); else if (r < .8) bezant(e[0] + Math.cos(sa) * 5, e[1] + Math.sin(sa) * 5, R(4.5, 6.5));
    else if (r < .92) { const blue = rnd() < .5; floret(e[0] + Math.cos(sa) * 8, e[1] + Math.sin(sa) * 8, R(8, 10), blue ? 'azure deep' : 'rose', blue ? 'azure' : 'rose light') } else berry(e[0] + Math.cos(sa) * 5, e[1] + Math.sin(sa) * 5, R(4.5, 6));
    side = -side }
  const e = p[p.length - 1]; bezant(e[0], e[1], 4.6) }
function border() {
  stage('Border sprays', 'Pen tendrils with ivy leaves and bezants in gold, a few flowers and berries.');
  vine(-8, 250, .25, 560, -.0012, -.034);
  vine(790, -8, 1.6, 300, .004, .05);
  vine(676, 859, 1.1, 170, .008, .08, 34, 24);
  vine(-8, 640, -.9, 200, .006, .07, 36, 26);
}

/* =====================================================================
   THE MAGPIE — drawn in its own frame, then set on the page
   ===================================================================== */
const AX = [-.57, .82], AN = [.82, .57], BK = 1.2, BX = 545, BY = 272;
const B = (x, y) => [(x - 880) * BK + BX, (y - 420) * BK + BY], Bp = p => B(p[0], p[1]);
// the direction the plumage lies: swept back from the bill, then down the body
function lie(x, y) { const hx = x - 985, hy = y - 412, hd = Math.hypot(hx, hy) || 1, t = smooth((Math.hypot(x - 880, y - 420) - 70) / 170), w = .45 + .55 * t;
  return Math.atan2(hy / hd * (1 - w) + AX[1] * w, hx / hd * (1 - w) + AX[0] * w) + (fbm(x / 55, y / 55, 2) - .5) * .5 }
const bst = (mat, brush, path, o = {}) => path.length > 1 && st(mat, brush, path.map(Bp), Object.assign({}, o, o.w === undefined ? null : {w: o.w * BK}, o.load ? {load: o.load * BK} : null, o.wob === undefined ? null : {wob: o.wob * BK}));
const bpen = (path, o = {}) => { if (path.length > 1) pen(path.map(Bp), Object.assign({}, o, {w: (o.w || 1) * BK})) };
const bloose = (path, o = {}) => loose(path.map(Bp), Object.assign({}, o, {w: (o.w || 1.2) * BK, j: (o.j ?? 2) * BK, ext: (o.ext ?? 7) * BK}));
const bhatch = (x, y, ang, n, len, gap, o = {}) => { const c = B(x, y); inkHatch(c[0], c[1], ang, n, len * BK, gap * BK, Object.assign({}, o, {w: (o.w || .9) * BK})) };
const tailSort = (a, b) => (a[0] * .57 - a[1] * .82) - (b[0] * .57 - b[1] * .82);   // from the tail forward, so that each feather overlaps the one behind it
const thin = (a, k = 3) => a.filter((_, i) => i % k === 0 || i === a.length - 1);
const lerp3 = (a, b, t) => { a = C(a); b = C(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
const prof = (f, n = 12) => Array.from({length: n + 1}, (_, i) => Math.max(0, f(i / n)));
// the part of a stroke that lies inside a shape: a brush is lifted at the edge, not masked
function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }
const within = (path, poly) => run(path, p => inPoly(p[0], p[1], poly));
const FAMS = [['green', 152], ['teal', 188], ['blue', 225], ['violet', 268]];
const famOf = h => { h = ((h % 360) + 360) % 360; let best = FAMS[0], bd = 1e9; for (const f of FAMS) { const d = Math.abs(h - f[1]); if (d < bd) { bd = d; best = f } } return best[0] };

// one long flight or tail feather: the vane in one shaped stroke, dry-brushed webs, barbs, gloss, shaft and a pen edge
function feather(a, b, o) {
  const w = o.w, bend = o.bend || 0, shape = o.shape || .9, pal = o.pal, tMax = o.tMax || 1, NS = 30;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, c = [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend];
  const Q = t => [(1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]];
  const T = t => { const x = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), y = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]), l = Math.hypot(x, y) || 1; return [x / l, y / l] };
  const wp = t => Math.pow(Math.sin(Math.PI * Math.pow(t, shape)), .55), wid = t => w / 2 * wp(t);
  const ax = [], le = [], ri = []; for (let i = 0; i <= NS; i++) { const t = i / NS, p = Q(t), tg = T(t), wv = wid(t); ax.push(p); le.push([p[0] - tg[1] * wv, p[1] + tg[0] * wv]); ri.push([p[0] + tg[1] * wv, p[1] - tg[0] * wv]) }
  const side = (f, t0, t1) => { const path = []; for (let i = 0; i <= 10; i++) { const t = t0 + (t1 - t0) * i / 10, p = Q(t), tg = T(t), wv = wid(t) * f; path.push([p[0] - tg[1] * wv, p[1] + tg[0] * wv]) } return path };
  bst('plumage', 'vane', thin(ax), {w, pr: prof(wp), c: pal.base, c2: pal.base2, grad: -1, a: .97});
  for (const f of (o.webs || [.62, .3, -.22, -.5, -.74])) { const t0 = R(.03, .12), t1 = Math.min(tMax, R(.8, .95)), ex = f < 0;
    bst('plumage', 'scumble', side(f, t0, t1), {w: w * R(.2, .3), c: ex ? pal.web : pal.web2, c2: ex ? pal.hi : pal.web, a: R(.55, .85), load: L * (t1 - t0) * R(.6, 1.1)}) }
  for (let i = 0; i < (o.barbs || 40); i++) { const t = R(.04, Math.min(.97, tMax)), s = rnd() < .68 ? -1 : 1, p = Q(t), tg = T(t), n = [-tg[1] * s, tg[0] * s], wv = wid(t) * R(.72, 1.02), fw = wv * R(.6, 1.25);
    const e = [p[0] + n[0] * wv + tg[0] * fw, p[1] + n[1] * wv + tg[1] * fw], m = [p[0] + n[0] * wv * .6 + tg[0] * fw * .22, p[1] + n[1] * wv * .6 + tg[1] * fw * .22];
    bst('plumage', 'barb', [p, m, e], {w: R(1.3, 2.6), c: s < 0 ? lerp3(pal.web, pal.hi, R(.2, 1)) : pal.web2, a: R(.3, .7)}) }
  if (o.sheen) for (let i = 0; i < 3; i++) { const f = R(-.8, -.15), t0 = R(.08, .5) * tMax, t1 = Math.min(tMax, t0 + R(.2, .4)), fam = pick(o.sheen);
    bst('sheen ' + fam, 'scumble', side(f, t0, t1), {w: w * R(.14, .24), c: lerp3('night ' + fam, 'gloss ' + fam, R(.4, .9)), c2: km('gloss ' + fam, 'glint ' + fam, R(.3, .8)), a: R(.5, .8) * (o.sheenA || 1), load: L * (t1 - t0) * R(.5, .9)}) }
  const sh = thin(ax.slice(1, Math.max(3, Math.round(NS * Math.min(1, tMax + .05)))));
  bst('plumage', 'point', sh, {w: 1.9, c: '#040408', a: .92});
  bst('plumage', 'point', sh.map(p => [p[0] + nx * 1.5, p[1] + ny * 1.5]), {w: .9, c: '#b8c7e6', a: .3});
  const e0 = Math.round(NS * .06), e1 = Math.round(NS * Math.min(.98, tMax));
  for (const sd of [le, ri]) { const cut = Math.round(R(.4, .7) * (e1 - e0)) + e0; bpen(thin(sd.slice(e0, cut), 2), {brush: 'sketch', w: 1.25, a: .6, wob: 1.1}); bpen(thin(sd.slice(cut + 1, e1), 2), {brush: 'sketch', w: 1.1, a: .5, wob: 1.1}) }
}
// a field of overlapping body feathers, laid like roof tiles
function plumage(poly, o) { const pts = poisson(poly, (x, y) => o.size(x, y) * o.spacing, o.rmin, o.rmax); pts.sort(tailSort);
  for (const p of pts) { const x = p[0], y = p[1], s = o.size(x, y) * R(.7, 1.4), ang = lie(x, y) + R(-.36, .36), len = s * o.lenK, wid = s * o.widK, l = o.lit(x, y), c = o.color(x, y, l);
    const sx = x - Math.cos(ang) * len * .45, sy = y - Math.sin(ang) * len * .45;
    bst('plumage', o.brush, arc(sx, sy, ang, len, R(-.35, .35), 4), {w: wid, c: c[0], c2: c[1], grad: rnd() < .5 ? 1 : -1, a: o.a, tone2: o.tone2 ? o.tone2 * l : 0, load: o.loadK ? len * o.loadK : undefined});
    if (o.rim && l > o.rimMin && rnd() < o.rimP) bst('plumage', 'point', tipArc(sx, sy, ang, len * .97, wid * .9, R(-1.3, -.5), R(.5, 1.3)), {w: R(1.1, 2.2), c: o.rim(l), a: R(.3, .65) * l}) } }
// broad strokes of body colour laid along the lie of the feathers and lifted at the edge of the shape
function broad(poly, n, o) { const pts = sampleIn(poly, n); pts.sort(tailSort);
  for (const p of pts) { const x = p[0], y = p[1], l = o.lit(x, y), ang = lie(x, y) + R(-.42, .42), len = R(o.len[0], o.len[1]), c = o.color(x, y, l);
    const path = within(arc(x - Math.cos(ang) * len * .5, y - Math.sin(ang) * len * .5, ang, len, R(-.4, .4), 6), poly); if (path.length < 2) continue;
    bst(o.mat, rnd() < .5 ? o.brush[0] : o.brush[1], path, {w: Math.min(R(o.w[0], o.w[1]), o.room ? 2 * (o.room(x, y) + 4) : 1e9), c: c[0], c2: c[1], grad: rnd() < .5 ? 1 : -1, a: o.a, load: len * R(1, 1.8)}) } }
// faint curved touches that only hint at the edges of feathers
function hints(poly, n, o) { for (const p of sampleIn(poly, n)) { const ang = lie(p[0], p[1]) + R(-.2, .2), len = R(o.len[0], o.len[1]), wid = len * R(.5, .7);
    bst('tint', 'point', tipArc(p[0] - Math.cos(ang) * len * .5, p[1] - Math.sin(ang) * len * .5, ang, len, wid, R(-1.2, -.3), R(.3, 1.2)), {w: R(o.w[0], o.w[1]), c: o.c, a: R(o.a[0], o.a[1])}) } }
// fine hatching with a small pointed brush, following the lie of the feathers
function hatch(poly, n, o) { const pts = sampleIn(poly, n); pts.sort(tailSort);
  for (const p of pts) { const l = o.lit(p[0], p[1]), ang = lie(p[0], p[1]) + R(-.45, .45), len = R(o.len[0], o.len[1]) * (rnd() < .15 ? 1.7 : 1);
    bst(o.mat, 'hair', arc(p[0] - Math.cos(ang) * len * .4, p[1] - Math.sin(ang) * len * .4, ang, len, R(-.5, .5), 3), {w: R(o.w[0], o.w[1]) * (rnd() < .12 ? 2.2 : 1), c: o.color(l), a: R(o.a[0], o.a[1])}) } }

// a painted leaf on the perch: a wash that misses its outline, body colour, veins, and the pen going round last
function leaf(x, y, ang, len, wid, pal) { const bend = R(-.5, .5), NS = 22, ax = [], le = [], ri = [], wp = t => Math.pow(Math.sin(Math.PI * Math.pow(t, .7)), 1.05);
  for (let i = 0; i <= NS; i++) { const t = i / NS, a = ang + bend * (t - .5), px = x + Math.cos(ang + bend * (t * .5 - .25)) * len * t, py = y + Math.sin(ang + bend * (t * .5 - .25)) * len * t, wv = wid / 2 * wp(t);
    ax.push([px, py]); le.push([px - Math.sin(a) * wv, py + Math.cos(a) * wv]); ri.push([px + Math.sin(a) * wv, py - Math.cos(a) * wv]) }
  const ox = R(-2.4, 2.4), oy = R(-2.4, 2.4), th = a => a.filter((_, i) => i % 4 === 0 || i === NS);
  fl('watercolour', thin(le, 2).concat(thin(ri, 2).reverse()).map(p => [p[0] + ox * 1.8, p[1] + oy * 1.8]), {c: pal[1], a: .5, soft: 2.2, uneven: 1, scale: 14});
  st('colour', 'vane', thin(ax, 2).map(p => [p[0] + ox, p[1] + oy]), {w: wid * 1.08, pr: prof(wp), c: pal[0], c2: pal[1], grad: -1, a: .9, wob: .8});
  st('tint', 'point', thin(ax.map((p, i) => [(p[0] + le[i][0]) / 2, (p[1] + le[i][1]) / 2]).slice(2, NS - 1), 2), {w: wid * .36, c: pal[2], a: .55});
  for (let i = 4; i < NS - 2; i += 3) for (const sd of [le, ri]) { const p = ax[i], e = sd[Math.min(NS, i + 3)]; pen([p, [p[0] + (e[0] - p[0]) * .5, p[1] + (e[1] - p[1]) * .5 + .6], [p[0] + (e[0] - p[0]) * .88, p[1] + (e[1] - p[1]) * .88]], {w: .6, a: .45, c: lerp3(pal[2], 'ink', .4)}) }
  for (let i = 5; i < NS - 3; i += 2) { const p = ri[i], c = ax[i + 1]; st('lead white', 'comma', [[p[0] * .82 + c[0] * .18, p[1] * .82 + c[1] * .18], [p[0] * .35 + c[0] * .65, p[1] * .35 + c[1] * .65]], {w: .9, a: .6}) }
  loose(th(ax), {w: .9, a: .8, n: 1, j: .7, ext: 7}); loose(th(le), {w: .95, a: .8, n: 2, j: 1.1, ext: 6}); loose(th(ri), {w: .95, a: .75, n: 1, j: 1.1, ext: 6}) }

function bird() {
  const B1 = [[962, 378], [940, 340], [890, 316], [830, 326], [785, 372], [750, 440], [700, 520], [760, 522], [800, 575], [830, 598], [884, 621], [948, 640], [967, 590], [967, 522], [959, 462], [958, 432]];
  const B2 = [[750, 440], [700, 520], [630, 620], [560, 730], [505, 830], [492, 870], [536, 884], [580, 792], [644, 688], [722, 576], [792, 506]];
  const B3 = [[720, 872], [640, 885], [575, 895], [545, 905], [530, 925], [562, 934], [602, 900], [650, 858], [696, 826], [742, 832], [762, 856]];
  const belly = [[948, 640], [933, 668], [895, 745], [845, 805], [785, 845], [720, 870], [676, 876], [654, 846], [698, 778], [758, 698], [806, 603], [836, 602], [884, 621]];   // its wing side runs a little under the wing, which is painted over it
  const wingPoly = [[790, 500], [720, 570], [640, 680], [570, 790], [520, 880], [480, 960], [540, 930], [610, 880], [690, 790], [760, 700], [815, 590], [830, 545]];
  const sc = []; for (let i = 0; i < 24; i++) { const th = i / 24 * 6.283; sc.push([700 + AX[0] * Math.cos(th) * 112 + AN[0] * Math.sin(th) * 25, 616 + AX[1] * Math.cos(th) * 112 + AN[1] * Math.sin(th) * 25]) }
  const UNDER = [[949, 642], [933, 668], [895, 745], [845, 805], [785, 845], [722, 871]], WINGLOW = [[819, 614], [771, 709], [711, 789], [666, 854]];
  const BACK = [[940, 340], [890, 316], [830, 326], [785, 372], [750, 440], [700, 520], [630, 620], [560, 730], [505, 830]];
  const curve = p => spline(p, 5, true), bellyC = curve(belly), scC = curve(sc), shapeB = p => ({curve: PT(p.map(Bp))});
  // where the painted light falls (from above, slightly left)
  const litBase = (x, y) => { const dh = Math.hypot(x - 880, y - 420), lh = clamp(.5 + .5 * ((x - 880) * -.3 + (y - 420) * -.95) / 112, 0, 1), v = (x - 880) * AN[0] + (y - 420) * AN[1], lb = clamp(.55 - v / 300, 0, 1), t = smooth((dh - 95) / 110); return lh * (1 - t) + lb * t };
  const litBlack = (x, y) => clamp(litBase(x, y) * (.55 + .9 * fbm(x / 60 + 3, y / 60 + 8, 3)), 0, 1);
  const litWhite = (x, y) => clamp((1 - .75 * smooth((y - 690) / 200)) * (.55 + .45 * smooth(distPoly(x, y, WINGLOW) / 34)) * (.72 + .28 * smooth(distPoly(x, y, UNDER) / 40)) * (.8 + .4 * fbm(x / 50 + 9, y / 50 + 1, 2)), 0, 1);
  const litScap = (x, y) => clamp(.95 - .4 * smooth(((x - 700) * AN[0] + (y - 616) * AN[1]) / 28) + (fbm(x / 40, y / 40, 2) - .5) * .25, 0, 1);
  const DK = [tone('black', .62), tone('black violet', .6), tone('black warm', .66), tone('black', .45), tone('black warm', .5)];
  const blackCol = (x, y, l) => { const c = lerp3(pick(DK), 'slate', l * R(.35, .75)); return [c, lerp3(c, 'slate light', .2 + .45 * l)] };
  const WH = ['white warm', 'white', 'white', 'white bone'];
  const whiteCol = (x, y, l) => { const c = km(rnd() < .6 ? 'shade cool' : 'shade warm', pick(WH), Math.pow(l, .75)); return [c, lerp3(c, 'white', .5)] };
  const sizeB = (x, y) => lerp(7.5, 18, smooth((Math.hypot(x - 985, y - 412) - 55) / 300));

  stage('Underdrawing', 'A few searching lines in thin brown ink.');
  { const sk = (path, a = .3) => bpen(path.map(p => [p[0] + R(-3, 3), p[1] + R(-3, 3)]), {brush: 'sketch', w: .7, a, c: 'sepia'});
    sk(BACK.slice(0, 5).map(p => [p[0] - 5, p[1] - 6]), .45); sk(BACK.slice(3).map(p => [p[0] - 7, p[1] - 4]), .45); sk(BACK.map(p => [p[0] - 2, p[1] - 10]), .22);
    sk([[960, 462], [968, 520], [967, 588], [953, 642]], .3); sk(UNDER.slice(1, 5).map(p => [p[0] + 4, p[1] + 3]), .28);
    sk(circleArc(880, 420, 116, -3.6, .3, 9), .36); sk(circleArc(700, 640, 150, 2.2, 4.1, 8), .25); sk([[958, 400], [1030, 392], [1096, 440]], .25); sk(wingPoly.slice(4, 9)); sk([[760, 700], [700, 790], [640, 860]], .25) }

  /* tail — only its base is in the picture */
  stage('Tail', 'Six long feathers, green where the light catches them; they run off the page.');
  { const T0 = [517, 885], td = [-.527, .85], tn = [.85, .527];
    const pal = {base: tone('night green', .32), base2: tone('night green', .62), web: lerp3('night green', 'gloss green', .25), web2: tone('night green', .8), hi: lerp3('gloss green', 'glint green', .2)};
    for (const [off, dev, len] of [[-30, -8, 300], [30, 8, 312], [-19, -4.5, 362], [19, 5, 372], [-8, -1.5, 410], [6, 1.2, 428]]) {
      const a = dev * Math.PI / 180, d = [td[0] * Math.cos(a) - td[1] * Math.sin(a), td[0] * Math.sin(a) + td[1] * Math.cos(a)], b0 = [T0[0] + tn[0] * off, T0[1] + tn[1] * off];
      feather(b0, [b0[0] + d[0] * len, b0[1] + d[1] * len], {w: 58, shape: 1.35, bend: R(-7, 7), pal, barbs: 60, sheen: ['green', 'green', 'teal'], tMax: .5}) } }
  dry();

  /* the perch — a vine stem springing from the gold bar */
  stage('The perch', 'A stem that springs from the gold bar, with painted leaves.');
  { const stem = spline([[849, 697], [800, 786], [680, 858], [521, 884], [353, 893], [197, 914], [53, 964], [-30, 1004]], 12), stemW = 17, sp = t => .5 + .5 * smooth(t / .22);
    const nrm = (path, d) => path.map((p, i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, t = i / (path.length - 1), k = d * sp(t); return [p[0] - dy / l * k, p[1] + dx / l * k] });
    const s4 = thin(stem, 4);
    fl('watercolour', nrm(s4, 13).concat(nrm(s4, -17).reverse()), {c: '#9a8b63', a: .3, soft: 3, uneven: 1, scale: 22});
    st('watercolour', 'point', thin(nrm(stem, 9), 4), {w: 9, c: 'leaf', a: .3, pr: 'full', load: 0});
    flow(.25);
    st('tint', 'band', thin(nrm(stem, -6), 4), {w: 10, c: '#9e8066', a: .3, load: 0});
    st('colour', 'vane', s4, {w: stemW, pr: prof(sp), c: 'bark', c2: 'bark mid', grad: 1, a: .96, load: 0});
    for (let i = 0; i < 9; i++) { const t0 = R(0, .8), seg = stem.slice(Math.floor(t0 * stem.length), Math.floor((t0 + R(.08, .2)) * stem.length)); if (seg.length > 3) st('colour', 'scumble', thin(nrm(seg, R(-5, 6)), 4), {w: R(1, 2.4), c: rnd() < .5 ? tone('bark', .9) : 'bark light', a: R(.35, .6)}) }
    pen(thin(nrm(stem, stemW / 2), 3), {brush: 'sketch', w: 1.25, a: .85, wob: 1.3}); pen(thin(nrm(stem, -stemW / 2), 3), {brush: 'sketch', w: 1.05, a: .8, wob: 1.3});
    loose(nrm(stem, stemW / 2 + 1.5).filter((_, i) => i % 11 === 0).slice(1, 7), {w: .9, a: .45, n: 1, j: 1.6, ext: 12}); loose(nrm(stem, -stemW / 2 - 1.5).filter((_, i) => i % 11 === 0).slice(3, 9), {w: .9, a: .4, n: 1, j: 1.6, ext: 12});
    inkHatch(596, 893, 2.3, 6, 11, 3.6, {a: .4}); inkHatch(318, 903, 2.3, 5, 10, 3.6, {a: .35}); inkHatch(742, 838, 2.6, 5, 10, 3.4, {a: .35});
    const GRN = ['leaf', 'leaf light', 'leaf dark'], ROSE = ['rose', 'rose light', 'rose dark'], BLU = ['azure', 'azure light', 'azure deep'];
    leaf(793, 797, -2.25, 78, 31, GRN); leaf(700, 850, 1.15, 66, 27, ROSE); leaf(604, 872, -1.85, 60, 25, GRN); leaf(300, 900, 1.9, 70, 29, BLU); leaf(822, 748, -.5, 34, 15, ROSE) }
  dry();

  /* thin first washes, as a miniaturist blocks in — laid wet, and left to find their own edges */
  stage('First washes', 'Watercolour, wet: a pale blue that overruns the drawing, indigo for the black, colours dropped in while it is wet.');
  fl('watercolour', [B1, B2].map(p => ({curve: PT(p.map(v => [v[0] + (v[0] - 800) * .03 + R(-5, 5), v[1] + (v[1] - 520) * .03 + R(-5, 5)]).map(Bp))})), {c: '#8892b4', a: .3, soft: 5, uneven: 1, scale: 30});
  dry();
  for (const [x, y, r] of [[668, 568, 17], [530, 850, 24]]) fl('water', {curve: PT(blob(...B(x, y), r, 8, .4))}, {soft: 5});
  fl('watercolour', [B1, B2, B3].map(shapeB), {c: {mix: {indigo: 2, 'prussian blue': 1, 'lamp black': .5}}, a: .95, soft: 2.2, uneven: .5});
  fl('watercolour', shapeB(wingPoly), {c: 'night blue', a: .8, soft: 2, uneven: .5});
  for (const [x, y, r, c] of [[850, 370, 34, 'night violet'], [905, 500, 30, 'night teal'], [720, 540, 36, 'night teal'], [600, 720, 40, 'night green'], [880, 590, 26, 'night violet'], [560, 820, 30, 'night green']])
    fl('watercolour', {curve: PT(blob(...B(x, y), r, 8, .35))}, {c, a: .7, soft: 4});
  flow(.3);
  dry();
  fl('lead white', [shapeB(belly), {polygon: PT(sc.map(Bp))}], {a: .46, soft: 3, uneven: .8});
  fl('watercolour', {curve: PT(UNDER.map(p => [p[0] + 9, p[1] + 7]).concat(UNDER.slice().reverse().map(p => [p[0] - 6, p[1] - 4])).map(Bp))}, {c: '#bdada8', a: .34, soft: 5, uneven: 1, scale: 26});
  fl('watercolour', {curve: PT(blob(...B(560, 800), 46, 9, .45))}, {c: '#8c9ecc', a: .3, soft: 6, uneven: 1, scale: 24});
  flow(.2);
  dry();

  /* white breast and belly — thick body colour, the lights dragged through the shadows while both are wet */
  stage('White plumage', 'Lead white over grey: broad wet strokes first, drier ones over them, then the point of the brush.');
  { const room = (x, y) => distPoly(x, y, UNDER);
    broad(bellyC, 100, {mat: 'lead white', brush: ['wide', 'wide leaf'], lit: litWhite, color: whiteCol, len: [55, 110], w: [22, 40], room});
    fl('tint', shapeB([[933, 668], [895, 745], [845, 805], [785, 845], [720, 870], [704, 842], [772, 806], [840, 758], [890, 694]]), {c: '#9996b8', a: .26, soft: 8, uneven: .4});
    fl('tint', shapeB([[819, 614], [771, 709], [711, 789], [666, 854], [690, 850], [736, 790], [792, 716], [838, 628]]), {c: '#8c8fb3', a: .3, soft: 6, uneven: .4});
    fl('tint', {curve: PT(blob(...B(900, 690), 44, 9, .3))}, {c: '#f7dbcc', a: .3, soft: 14, uneven: .5});
    broad(bellyC, 34, {mat: 'lead white', brush: ['wide dry', 'wide dry'], lit: (x, y) => Math.min(1, litWhite(x, y) + .25), color: whiteCol, len: [40, 80], w: [14, 26], a: .78, room});
    hints(bellyC, 46, {len: [24, 40], w: [1, 1.9], a: [.14, .34], c: '#8c8aa8'});
    const edge = spline(UNDER.concat([[676, 876]]), 6);
    for (let i = 0; i < 26; i++) { const p = pick(edge), ang = lie(p[0], p[1]) + R(-.6, .5), len = R(26, 52), l = litWhite(p[0], p[1]), c = whiteCol(p[0], p[1], Math.min(1, l + .2));
      bst('lead white', 'wide dry', arc(p[0] - Math.cos(ang) * len * .6 + R(-6, 3), p[1] - Math.sin(ang) * len * .6 + R(-6, 3), ang, len, R(-.5, .5), 4), {w: R(6, 13), c: c[0], c2: c[1], a: R(.6, .9), load: len, pr: 'leaf'}) }
    hatch(bellyC, 90, {mat: 'lead white', lit: litWhite, len: [16, 38], w: [1.1, 2.2], a: [.35, .7], color: l => l > .45 ? pick(WH) : km('shade cool', pick(WH), l)}) }
  dry();

  /* legs and feet */
  stage('Legs', 'Dark horn, scaled; the toes close round the stem.');
  for (const [a, b, far] of [[[728, 858], [742, 930], 1], [[772, 848], [791, 925], 0]]) { const base = tone('horn', far ? .55 : .8), hi = lerp3('horn', 'horn light', .35);
    bst('horn', 'vane', [a, [(a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2], b], {w: far ? 8 : 10, pr: prof(t => .82 + .18 * Math.sin(Math.PI * t), 6), c: base, c2: hi, grad: 1, a: .97});
    for (let i = 1; i < 7; i++) { const t = i / 7.5, px = a[0] + (b[0] - a[0]) * t + 3 * Math.sin(Math.PI * t) * .5, py = a[1] + (b[1] - a[1]) * t; bst('horn', 'point', [[px - 4, py - .4], [px + 4, py + 1]], {w: .9, c: '#4d4d57', a: .45}) }
    for (const [dx1, dy1, dx2, dy2] of [[32, 3, 43, 15], [21, 7, 28, 18], [10, 9, 13, 19], [-20, 6, -26, 15]]) {
      bst('horn', 'vane', [b, [b[0] + dx1, b[1] + dy1], [b[0] + dx2, b[1] + dy2]], {w: far ? 5.2 : 6.4, pr: prof(t => 1 - .45 * t, 6), c: base, c2: hi, grad: dx2 > 0 ? -1 : 1, a: .97});
      bst('horn', 'point', [[b[0] + dx1 * .55 - 1.5, b[1] + dy1 * .55 - 2.2], [b[0] + dx1 * .55 + 1.5, b[1] + dy1 * .55 + 2.6]], {w: .8, c: '#52525c', a: .45});
      bst('horn', 'hair', arc(b[0] + dx2, b[1] + dy2, dx2 > 0 ? 1.9 : 1.2, 10, dx2 > 0 ? .9 : -.9, 4), {w: 2.6, c: '#050506', a: .97}) } }

  /* folded wing: seven flight feathers, then three rows of coverts */
  stage('Wing', 'Seven flight feathers, blue along the outer webs, and three rows of coverts over their bases.');
  const A = [790, 590], wa = [-.64, .77], wn = [.77, .64];
  for (let i = 0; i < 7; i++) { const s = 42 - i * 14, L = 483 - i * 36, b0 = [A[0] + wn[0] * s + wa[0] * 40, A[1] + wn[1] * s + wa[1] * 40], tip = [A[0] + wa[0] * L + wn[0] * s * .3, A[1] + wa[1] * L + wn[1] * s * .3];
    const fam = i < 5 ? 'blue' : 'teal', k = i < 2 ? .55 : 1;
    const pal = {base: tone('night ' + fam, .3 * k + .1), base2: tone('night ' + fam, .75 * k), web: lerp3('night ' + fam, 'gloss ' + fam, .45 * k), web2: tone('night ' + fam, .7 * k), hi: lerp3('gloss ' + fam, 'glint ' + fam, .45 * k)};
    feather(b0, tip, {w: 38, shape: .9, bend: R(2, 9), pal, barbs: 54, sheen: [fam, fam, i < 5 ? 'violet' : 'green'], sheenA: i < 2 ? .5 : 1}) }
  { const cov = []; for (let r = 2; r >= 0; r--) for (let j = 0; j < 5; j++) cov.push([A[0] + wn[0] * (42 - j * 21) + wa[0] * (-14 + r * 40) + R(-4, 4), A[1] + wn[1] * (42 - j * 21) + wa[1] * (-14 + r * 40) + R(-4, 4)]);
    for (const c of cov) { const ang = Math.atan2(wa[1], wa[0]) + R(-.12, .12), sx = c[0] - wa[0] * 12, sy = c[1] - wa[1] * 12, len = 68, wid = 38, l = litBlack(c[0], c[1]);
      bst('plumage', 'point', tipArc(sx, sy, ang, len * 1.06, wid * 1.12, -1.2, 1.2), {w: 8, c: '#030308', a: .6});
      bst('plumage', 'feather', arc(sx, sy, ang, len, R(-.2, .2), 4), {w: wid, c: tone('night blue', .45), c2: tone('night blue', .95), grad: -1, tone2: .3});
      bst('plumage', 'point', tipArc(sx, sy, ang, len * .97, wid * .9, R(-1.2, -.6), R(.5, 1.2)), {w: R(1.4, 2.4), c: lerp3('gloss teal', 'glint teal', l * .6), a: R(.4, .7)}) } }

  /* black plumage: block in dark, then model each feather */
  stage('Black plumage', 'Blocked in dark, then every small feather modelled toward the light, then the point of the brush.');
  for (const reg of [B3, B2, B1]) plumage(reg, {brush: 'feather', size: (x, y) => sizeB(x, y) * 1.15, spacing: .62, rmin: 5, rmax: 13.5, lenK: 2.8, widK: 1.15, lit: (x, y) => litBlack(x, y) * .5, color: blackCol});
  for (const reg of [B3, B2, B1]) plumage(reg, {brush: 'drag', size: sizeB, spacing: .56, rmin: 4, rmax: 10.5, lenK: 2.9, widK: 1, lit: litBlack, color: blackCol, a: .9, tone2: .6, loadK: 1.4,
    rim: l => lerp3('#242e45', '#42546f', l), rimMin: .45, rimP: .3});
  dry();
  for (const [reg, n] of [[B3, 110], [B2, 320], [B1, 900]]) hatch(reg, n, {mat: 'plumage', lit: litBlack, len: [10, 30], w: [1, 2.1], a: [.25, .6], color: l => rnd() < .45 + .4 * l ? lerp3('#1a2133', '#42546f', l * R(.4, 1)) : pick(DK)});
  for (const [reg, n] of [[B3, 10], [B2, 26], [B1, 46]]) { const pts = sampleIn(reg, n); pts.sort(tailSort);
    for (const p of pts) { const l = litBlack(p[0], p[1]), ang = lie(p[0], p[1]) + R(-.45, .45), len = R(34, 80);
      bst('plumage', 'scumble', arc(p[0] - Math.cos(ang) * len * .45, p[1] - Math.sin(ang) * len * .45, ang, len, R(-.6, .6), 5), {w: R(4, 10), pr: rnd() < .5 ? 'comma' : 'leaf', c: rnd() < .5 + .3 * l ? lerp3('#12171f', '#334261', l * R(.5, 1)) : pick(DK), c2: '#05060a', a: R(.45, .8), load: len * R(.7, 1.2), wob: 1.2}) } }

  /* white scapulars lying over the wing */
  stage('Scapulars', 'The white shoulder patch, laid over the dry black.');
  { const room = (x, y) => distPoly(x, y, closed(sc));
    broad(scC, 50, {mat: 'lead white', brush: ['wide', 'wide leaf'], lit: litScap, color: whiteCol, len: [50, 95], w: [18, 30], a: .96, room});
    broad(scC, 22, {mat: 'lead white', brush: ['wide dry', 'wide dry'], lit: (x, y) => Math.min(1, litScap(x, y) + .15), color: whiteCol, len: [40, 80], w: [14, 24], a: .8, room});
    for (let i = 0; i < 16; i++) { const th = R(-1, 1), k = R(.7, 1), x = 700 + AX[0] * Math.cos(th) * 112 * k + AN[0] * Math.sin(th) * 25 * k, y = 616 + AX[1] * Math.cos(th) * 112 * k + AN[1] * Math.sin(th) * 25 * k, ang = Math.atan2(AX[1], AX[0]) + R(-.18, .18) + th * .12, len = R(38, 70), l = litScap(x, y), c = whiteCol(x, y, l);
      bst('lead white', 'wide leaf', arc(x - Math.cos(ang) * len * .55, y - Math.sin(ang) * len * .55, ang, len, R(-.25, .25), 5), {w: R(9, 16), c: c[0], c2: c[1], a: .94}) }
    for (let i = 0; i < 70; i++) { const th = R(0, 6.283), x = 700 + AX[0] * Math.cos(th) * 112 + AN[0] * Math.sin(th) * 25, y = 616 + AX[1] * Math.cos(th) * 112 + AN[1] * Math.sin(th) * 25, ang = lie(x, y) + R(-.35, .35), len = R(12, 30), wh = rnd() < .62;
      bst(wh ? 'lead white' : 'plumage', 'hair', arc(x - Math.cos(ang) * len * .5 + R(-3, 3), y - Math.sin(ang) * len * .5 + R(-3, 3), ang, len, R(-.4, .4), 3), {w: R(1.1, 2.4), c: wh ? pick(WH) : pick(DK), a: .88}) }
    hints(scC, 16, {len: [22, 36], w: [1, 1.8], a: [.14, .32], c: '#8c8aa8'});
    hatch(scC, 40, {mat: 'lead white', lit: litScap, len: [16, 36], w: [1.1, 2.2], a: [.35, .7], color: l => l > .45 ? pick(WH) : km('shade cool', pick(WH), l)}) }
  dry();

  /* the gloss: broken touches of interference colour along the feather tracts, where the light would catch them */
  stage('Iridescent gloss', 'Paint with interference flakes in it, scumbled where the light catches the feather tracts: blue and green, a little violet.');
  { const HUES = [[860, 345, 228], [930, 372, 215], [880, 455, 186], [925, 520, 206], [790, 400, 200], [735, 480, 188], [905, 585, 252], [600, 690, 170], [530, 810, 152], [640, 872, 262], [776, 640, 214]];
    const hueAt = (x, y) => { let sx = 0, sy = 0; for (const [hx, hy, h] of HUES) { const d2 = (x - hx) * (x - hx) + (y - hy) * (y - hy) + 400, w = 1 / (d2 * d2), an = h * Math.PI / 180; sx += w * Math.cos(an); sy += w * Math.sin(an) }
      return Math.atan2(sy, sx) * 180 / Math.PI + (fbm(x / 30, y / 30, 2) - .5) * 50 + R(-10, 10) };
    const bump = (x, y, cx, cy, r) => Math.exp(-((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * r));
    const sheenAt = (x, y) => clamp((smooth((litBase(x, y) - .52) / .36) * .9 + .55 * bump(x, y, 872, 468, 46) + .4 * bump(x, y, 905, 580, 42) + .35 * bump(x, y, 640, 872, 40) + .55 * bump(x, y, 776, 640, 46)) * (.5 + .75 * fbm(x / 16 + 7, y / 16 + 3, 3)), 0, 1);
    const COV = [[772, 556], [834, 598], [806, 694], [722, 652]], cand = [];
    for (const [reg, n] of [[B1, 5600], [B2, 2200], [B3, 650], [COV, 700]]) for (const p of sampleIn(reg, n)) { if (inPoly(p[0], p[1], sc)) continue; const sv = sheenAt(p[0], p[1]); if (rnd() < sv * .62) cand.push([p[0], p[1], sv]) }
    cand.sort(tailSort);
    const dark = path => run(path, p => !inPoly(p[0], p[1], sc) && !inPoly(p[0], p[1], bellyC));   // the gloss stops where the white begins
    const medium = h => { h = ((h % 360) + 360) % 360; return h < 172 ? 'gloss green' : h > 240 ? 'gloss violet' : 'gloss' };
    for (const it of cand.filter(() => rnd() < .34)) { const x = it[0], y = it[1], f = it[2], ang = lie(x, y) + R(-.25, .25), len = R(20, 46);   // the medium itself: it only shows where the lamp finds it
      bst(medium(hueAt(x, y)), 'feather', dark(arc(x - Math.cos(ang) * len * .4, y - Math.sin(ang) * len * .4, ang, len, R(-.4, .4), 4)), {w: R(8, 17), a: .2 + .7 * Math.pow(f, 1.4)}) }
    for (const it of cand.filter(() => rnd() < .1)) { const x = it[0], y = it[1], f = it[2], fam = famOf(hueAt(x, y)), ang = lie(x, y) + R(-.25, .25), len = R(18, 40);   // colour that does not depend on the lamp, dragged on nearly dry
      bst('sheen ' + fam, 'dry feather', dark(arc(x - Math.cos(ang) * len * .4, y - Math.sin(ang) * len * .4, ang, len, R(-.4, .4), 4)), {w: R(6, 13), c: lerp3('night ' + fam, 'gloss ' + fam, R(.15, .4) + .35 * f), c2: lerp3('night ' + fam, 'gloss ' + fam, R(.5, 1)), a: .5 + .4 * f, tone2: .6}) }
    for (const it of cand.filter(() => rnd() < .22)) { const x = it[0], y = it[1], f = it[2], fam = famOf(hueAt(x, y)), ang = lie(x, y) + R(-.3, .3), len = R(10, 30);
      bst('sheen ' + fam, 'hair', dark(arc(x - Math.cos(ang) * len * .4, y - Math.sin(ang) * len * .4, ang, len, R(-.5, .5), 3)), {w: R(1, 2.4), c: lerp3('night ' + fam, 'glint ' + fam, R(.2, .45) + .4 * f * rnd()), a: R(.4, .9) * (.3 + .7 * f)}) }
    for (const it of cand.filter(c => c[2] > .55 && rnd() < .1)) { const x = it[0], y = it[1], fam = famOf(hueAt(x, y)), ang = lie(x, y) + R(-.25, .25), len = R(6, 13);   // the last, brightest touches
      bst('sheen ' + fam, 'comma', arc(x, y, ang, len, R(-.4, .4), 2), {w: R(1.6, 3), c: km('gloss ' + fam, 'glint ' + fam, R(.4, 1)), a: .9}) } }

  /* stray hairs that break the silhouette */
  stage('Feather edges', 'Stray hairs that break the outline, so that it is plumage and not a cut-out.');
  { const back = spline(BACK, 10); for (let i = 1; i < back.length - 1; i++) { const p = back[i]; for (let k = 0; k < 2; k++) { const head = 1 - smooth((Math.hypot(p[0] - 880, p[1] - 420) - 120) / 60), ang = lie(p[0], p[1]) + R(.05, .55) * (1 - .6 * head), len = R(8, 26) * (1 - .62 * head);
        bst('plumage', 'hair', arc(p[0] + R(-3, 3), p[1] + R(-3, 3), ang, len, R(-.4, .4), 3), {w: R(1, 2.2), c: pick(DK), a: .9}) } }
    const front = spline([[958, 462], [967, 520], [967, 588], [948, 640]], 14); for (let i = 1; i < front.length; i++) { const p = front[i], ang = lie(p[0], p[1]) - R(.1, .6), len = R(8, 22);
        bst('plumage', 'hair', arc(p[0] + R(-3, 2), p[1] + R(-3, 3), ang, len, R(-.4, .4), 3), {w: R(1, 2), c: pick(DK), a: .9}) }
    const bib = spline([[800, 575], [830, 598], [884, 621], [948, 640]], 14);
    for (let i = 0; i < 44; i++) { const p = pick(bib), ang = lie(p[0], p[1]) + R(-.3, .3), len = R(16, 34);   // small dark feathers lapping over the white
      bst('plumage', 'drag', arc(p[0] + R(-5, 5) - Math.cos(ang) * len * .55, p[1] + R(-8, 0) - Math.sin(ang) * len * .55, ang, len, R(-.3, .3), 3), {w: R(4, 9), c: pick(DK), c2: lerp3(pick(DK), 'slate', .5), pr: 'leaf', a: .95}) }
    for (let i = 0; i < bib.length; i++) { const p = bib[i]; for (let k = 0; k < 2; k++) { const ang = lie(p[0], p[1]) + R(-.35, .35), len = R(12, 30);
        bst('plumage', 'hair', arc(p[0] + R(-4, 4), p[1] + R(-6, 2), ang, len, R(-.4, .4), 3), {w: R(1.1, 2.4), c: pick(DK), a: .9}) } }
    const und = spline(UNDER, 12); for (let i = 2; i < und.length - 9; i++) { const p = und[i], ang = lie(p[0], p[1]) + R(-.5, .15), len = R(8, 22), wh = rnd() < .6;
        bst('lead white', 'hair', arc(p[0] + R(-7, 1), p[1] + R(-7, 1), ang, len, R(-.5, .5), 3), {w: R(.9, 1.8), c: wh ? pick(WH) : '#80706b', a: .8}) } }

  nib();

  /* bill */
  stage('Bill and eye', 'Horn-black bill with one cold light along the culmen; the eye, dark and wet.');
  { const bb = p => [958 + (p[0] - 958) * .86, 432 + (p[1] - 432) * .9];   // drawn large, then brought down to a magpie's bill
    const kst = (m, b, path, o) => bst(m, b, path.map(bb), o), kpen = (path, o) => bpen(path.map(bb), o), kloose = (path, o) => bloose(path.map(bb), o);
    const upC = [[958, 380], [1000, 377], [1046, 395], [1079, 424], [1091, 443], [1070, 437], [1020, 432], [958, 431]].map(bb), loC = [[958, 437], [1020, 439], [1066, 445], [1075, 453], [1040, 463], [1000, 467], [955, 463]].map(bb);
    const up = spline(upC, 7, true), lo = spline(loC, 7, true);
    doc.shapes['upper bill'] = {curve: PT(upC.map(Bp))}; doc.shapes['lower bill'] = {curve: PT(loC.map(Bp))};
    kst('horn', 'band', [[957, 434.5], [1010, 436], [1057, 439.5]], {w: 9, c: '#050405', a: .96});
    fl('horn', 'lower bill', {c: '#0b0b0e', a: .92, uneven: .4}); fl('horn', 'upper bill', {c: '#0f1014', a: .92, uneven: .4});
    kst('horn', 'bill', [[960, 451], [1005, 453], [1050, 452], [1072, 449]], {w: 26, pr: prof(t => 1 - .4 * t, 6), c: '#0a0a0d', c2: '#1f2026', grad: -1, a: .9, clip: 'lower bill'});
    kst('horn', 'scumble', [[966, 442.5], [1010, 444], [1056, 447.5]], {w: 2.2, c: '#4d5466', a: .5, clip: 'lower bill'});
    kst('horn', 'bill', [[960, 406], [1005, 404], [1048, 414], [1082, 435]], {w: 32, pr: prof(t => 1 - .5 * t, 6), c: '#0d0d11', c2: '#2b2e3b', grad: -1, a: .9, clip: 'upper bill'});
    kst('horn', 'scumble', [[962, 396], [1002, 393], [1040, 404], [1068, 422]], {w: 11, pr: 'leaf', c: '#1a1c24', c2: '#383d4d', a: .6, load: 90, wob: 1});
    kst('horn', 'point', [[962, 428], [1015, 429], [1066, 435]], {w: 6, c: '#040406', a: .7, clip: 'upper bill'});
    kst('horn', 'scumble', [[968, 387], [1004, 385], [1042, 398], [1070, 419], [1085, 437]], {w: 5.5, c: '#667087', c2: '#9eabc4', a: .72, load: 80, wob: .8, clip: 'upper bill'});
    kst('lead white', 'comma', [[996, 386.5], [1016, 389], [1034, 395.5]], {w: 2.3, c: '#dee6f5', a: .8, clip: 'upper bill'});
    kst('horn', 'point', [[981, 397], [994, 399.5]], {w: 5, c: '#030304', a: .85});
    kpen([[957, 434], [1012, 435.5], [1068, 440.5]], {w: 1.5, a: .95, c: '#050404'});
    kpen(thin(closed(up), 2), {brush: 'sketch', w: .9, a: .45}); kpen(thin(closed(lo), 2), {brush: 'sketch', w: .9, a: .42});
    kloose([[955, 381], [1000, 376.5], [1046, 394.5], [1080, 424], [1092.5, 445]], {w: 1.3, a: .85, n: 2, j: 1.5, ext: 9}); kloose([[954, 464], [1000, 468], [1040, 464], [1077, 453]], {w: 1.2, a: .8, n: 2, j: 1.4, ext: 8});
    for (let i = 0; i < 30; i++) { const y = R(384, 421), x = R(940, 964); bst('plumage', 'hair', arc(x, y, R(-.06, .3) + (y - 398) / 90, R(7, 21), R(-.7, .7), 3), {w: R(1.2, 2.4), c: pick(DK), a: .92}) }
    for (let i = 0; i < 16; i++) { const y = R(440, 468), x = R(946, 962); bst('plumage', 'hair', arc(x, y, R(.2, .9), R(12, 22), R(-.3, .3), 3), {w: R(1.1, 2), c: pick(DK), a: .9}) }
    }
  { const [ex, ey] = B(926, 404);
    dot('plumage', ex, ey, 17.5, {c: '#050608', soft: .22});
    st('plumage', 'point', circleArc(ex, ey, 14.8, -2.7, .5, 8), {w: 1.5, c: '#545e75', a: .7}); st('plumage', 'point', circleArc(ex, ey, 14.8, .9, 2.9, 6), {w: 1.2, c: '#3d4557', a: .55});
    dot('eye', ex, ey, 12.4, {c: '#110b08', soft: .2, dome: 2.4});
    st('colour', 'point', circleArc(ex + .4, ey + .5, 8.8, .2, 1.9, 6), {w: 2.6, c: '#5c3d24', a: .6});
    dot('eye', ex, ey, 6.6, {c: '#020203', dome: .6});
    dry('still');   // the catchlight goes on when the eye is dry, or it would sink into the dark
    st('lead white', 'comma', [[ex - 7, ey - 3.2], [ex - 4.4, ey - 6.2], [ex - .8, ey - 5.6]], {w: 3.6, c: 'white', a: .97}); dot('lead white', ex + 4.6, ey + 4.8, 1.2, {c: '#ccd9f2', a: .45, soft: .5});
    loose(circleArc(ex, ey, 16.6, -3.4, 1, 6), {w: .9, a: .5, n: 1, j: .8, ext: 4, c: '#4d5469'}) }

  /* last pen work */
  stage('Pen work', 'The pen goes round once more, never quite where the brush went.');
  { const und = spline(UNDER, 9); bpen(thin(und.slice(0, 24), 2), {w: 1.15, c: 'sepia', a: .7}); bpen(thin(und.slice(1, 22), 2).map(p => [p[0] + R(-1.5, 1.5), p[1] + R(-1.5, 1.5)]), {w: .8, c: 'sepia', a: .4}); bpen(thin(und.slice(20, 37), 2), {w: 1.05, c: 'sepia', a: .65});
    bpen(sc.slice(1, 12), {w: .8, c: '#737080', a: .4});
    for (let i = 0; i < 14; i++) { const x = R(700, 880), y = R(700, 850); if (distPoly(x, y, UNDER) < 46) bpen(arc(x, y, lie(x, y) + R(-.2, .2), R(10, 22), R(-.3, .3), 4), {w: .7, c: 'sepia', a: .3}) }
    bloose([[938, 335], [890, 310], [829, 320], [782, 367]], {w: 1.6, a: .85, n: 3, j: 3.2, ext: 16});
    bloose([[790, 361], [747, 435], [696, 516], [627, 615]], {w: 1.5, a: .8, n: 3, j: 3.6, ext: 18});
    bloose([[634, 611], [557, 726], [500, 828]], {w: 1.5, a: .75, n: 2, j: 3.6, ext: 18});
    bloose([[961, 466], [970, 520], [970, 588], [952, 640]], {w: 1.5, a: .85, n: 3, j: 2.6, ext: 14});
    bloose([[951, 644], [935, 670], [897, 747], [847, 807], [792, 845]], {w: 1.5, a: .85, n: 3, j: 2.6, ext: 16, c: lerp3('sepia', 'ink', .6)});
    bloose([[821, 616], [773, 710], [713, 790], [669, 852]], {w: 1, a: .5, n: 2, j: 2.4, ext: 10});
    bloose([sc[2], sc[4], sc[6], sc[8], sc[10]], {w: .95, a: .45, n: 2, j: 2, ext: 9, c: '#4d474d'});
    bhatch(866, 772, 2.25, 8, 26, 4.4, {a: .62, w: 1.1}); bhatch(800, 822, 2.3, 7, 22, 4.2, {a: .6, w: 1.1}); bhatch(742, 752, 2.2, 6, 22, 4, {a: .55, w: 1.1, c: '#4d4d66'}); bhatch(905, 690, 2.2, 5, 16, 4.2, {a: .4}) }
}

// the pen nib: cut metal, gilt, with its slit and breather hole, and ink still on the point
function nib() {
  stage('The nib', 'A gilt pen nib held by its shank: slit, breather hole, and ink still wet on the point.');
  const N0 = B(1048, 439), N1 = B(1078, 613), nl = Math.hypot(N1[0] - N0[0], N1[1] - N0[1]), nu = [(N1[0] - N0[0]) / nl, (N1[1] - N0[1]) / nl], nv = [-nu[1], nu[0]];
  const pr = [[0, 9], [.03, 11.5], [.3, 12.5], [.46, 14], [.54, 21], [.62, 21.5], [.72, 15], [.85, 7.5], [.95, 2.6], [1, .4]].map(p => [p[0], p[1] * BK]);
  const hw = u => { for (let i = 0; i < pr.length - 1; i++) if (u <= pr[i + 1][0]) { const k = (u - pr[i][0]) / (pr[i + 1][0] - pr[i][0]); return pr[i][1] + (pr[i + 1][1] - pr[i][1]) * smooth(k) } return .4 };
  const NP = (u, v) => [N0[0] + nu[0] * u * nl + nv[0] * v, N0[1] + nu[1] * u * nl + nv[1] * v];
  const nL = [], nR = []; for (let i = 0; i <= 40; i++) { const u = i / 40; nL.push(NP(u, -hw(u))); nR.push(NP(u, hw(u))) }
  const poly = nL.concat(nR.slice().reverse());
  doc.shapes['nib'] = PT(poly);
  fl('tint', poly.map(p => [p[0] + 5, p[1] + 6]), {c: '#7a6a5c', a: .3, soft: 5});   // the shadow it throws on the page
  fl('nib metal', 'nib');
  { const edge = (v0, v1, u0, u1) => { const a = [], b = []; for (let i = 0; i <= 12; i++) { const u = u0 + (u1 - u0) * i / 12; a.push(NP(u, hw(u) * v0)); b.push(NP(u, hw(u) * v1)) } return a.concat(b.reverse()) };
    fl('tint', edge(-1.05, -.4, .02, .8), {c: '#6b4a26', a: .42, soft: 2.5, clip: 'nib'});      // the side turned from the light
    fl('tint', edge(.82, 1.05, .02, .8), {c: '#6b4a26', a: .2, soft: 1.5, clip: 'nib'}) }
  for (const uu of [.2, .235]) pen([NP(uu, -hw(uu) * .82), NP(uu, hw(uu) * .82)], {brush: 'outline', w: .9, a: .55, c: '#5c3d1a'});
  { const tip = []; for (let i = 0; i <= 10; i++) { const v = -1 + 2 * i / 10; tip.push(NP(.76 + (fbm(i * .7, 3.3, 2) - .5) * .09, v * 26)) } tip.push(NP(1.02, 26), NP(1.02, -26));
    fl('nib ink', tip, {a: .94, soft: 1.6, clip: 'nib'}) }
  dot('nib ink', ...NP(.585, 0), 3.5, {soft: .3});
  pen([NP(.6, 0), NP(.8, .25), NP(1, 0)], {w: 1, a: .9});
  pen(closed(poly), {brush: 'outline', w: 1.15, a: .9, raw: true});
  loose(nR.filter((_, i) => i % 7 === 0), {w: 1, a: .5, n: 1, j: 1.2, ext: 6});
  const t = NP(1.06, 0), sp = []; for (let i = 0; i < 16; i++) { const r = Math.pow(rnd(), 1.7) * 52, an = R(.35, 2.7); sp.push([t[0] + Math.cos(an) * r * .8, t[1] + Math.sin(an) * r + 7, R(.35, 1.5) * (1 - r / 80)]) }
  dots('quill ink', sp, {a: .8, soft: .4});
  pen([NP(.985, 0), NP(1.03, 0)], {brush: 'outline', w: 2.4, a: .95});
  dot('eye', ...NP(1.045, 0), 4.6, {c: '#070606', soft: .25, dome: 4});
}

/* =====================================================================
   THE PAINTING
   ===================================================================== */
vellum();
script(884, 1012);
gilding();
border();
bird();

const problems = P.check(doc);
if (problems.length) { console.error(problems.length + ' problems\n  - ' + problems.slice(0, 20).join('\n  - ')); process.exit(1) }
// one mark to a line: a long file, but one that a person can still read and a diff can still show
const J = v => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
const line = q => q.do ? '      {"with": ' + J(q.with) + ', "do": [\n' + q.do.map(m => '        ' + J(m)).join(',\n') + '\n      ]}' : '      ' + J(q);
const body = doc.steps.map(s => '    {"name": ' + JSON.stringify(s.name) + (s.note ? ', "note": ' + JSON.stringify(s.note) : '') + ', "do": [\n' + s.do.map(line).join(',\n') + '\n    ]}').join(',\n');
const head = Object.assign({}, doc); delete head.steps;
const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "steps": [\n' + body + '\n  ]\n}\n');
JSON.parse(text);
writeFileSync(join(dir, 'magpie.json'), text);
let count = 0; const walk = l => l.forEach(s => s.do ? walk(s.do) : count += s.paths ? s.paths.length : s.dots ? s.dots.length : 1); walk(doc.steps);
console.log('magpie.json  ' + (text.length / 1024).toFixed(0) + ' kB  ' + doc.steps.length + ' stages, ' + count + ' marks');
