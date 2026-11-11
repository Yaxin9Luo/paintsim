// node paintings/rain.gen.mjs   →   paintings/rain.json
//
// "A city street on a rainy night: glowing shop windows and street lamps in amber and red, wet cobblestones full of long
// vertical reflections, small figures with umbrellas walking away, deep blue-violet darkness, bold palette-knife strokes,
// thick bright paint for the lights."
//
// The street is set up as a small 3-D scene (a camera, two facades, a cobbled ground) only so that every mark can be put
// where perspective wants it and coloured by the light that would fall there; what is written out is an ordinary painting
// document, back to front and thin to thick, with every stroke in order.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {spline, arc, circleArc, lerp, clamp, smooth, fbm} = P.util;

/* ---------- chance, with a seed ---------- */
let seed = 20261111 ^ 0x5a17;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];

/* ---------- the palette, mixed from pigments ---------- */
const MIX = {
  // the darks
  'night': {mix: {'ultramarine': 2, 'dioxazine violet': 1, 'lamp black': .5}},
  'night blue': {mix: {'ultramarine': 3, 'dioxazine violet': 1, 'burnt umber': 1}},
  'night violet': {mix: {'dioxazine violet': 2, 'ultramarine': 1, 'burnt umber': .6}},
  'indigo': {mix: {'prussian blue': 1, 'dioxazine violet': 1, 'titanium white': .3}},
  'umber dark': {mix: {'burnt umber': 2, 'ultramarine': 1, 'dioxazine violet': .3}},
  // sky and haze
  'sky top': {mix: {'ultramarine': 2, 'dioxazine violet': 1.2, 'lamp black': .7}},
  'sky': {mix: {'ultramarine': 3, 'dioxazine violet': 1.4, 'lamp black': .25, 'titanium white': .3}},
  'sky low': {mix: {'ultramarine': 2, 'dioxazine violet': 1, 'titanium white': 1, 'rose madder': .5}},
  'haze': {mix: {'titanium white': 3, 'ultramarine': .7, 'rose madder': 1.1, 'naples yellow': .4}},
  'haze warm': {mix: {'titanium white': 3, 'naples yellow': 1, 'cadmium yellow': .3, 'rose madder': .6}},
  'violet grey': {mix: {'ultramarine': 1, 'dioxazine violet': .5, 'burnt sienna': .5, 'titanium white': 2}},
  // the buildings
  'stone': {mix: {'ultramarine': 1, 'burnt umber': 1, 'dioxazine violet': .5, 'titanium white': .12}},
  'brick': {mix: {'burnt sienna': .9, 'dioxazine violet': .7, 'ultramarine': .8, 'lamp black': .15}},
  'plaster': {mix: {'ultramarine': 1, 'dioxazine violet': .6, 'burnt umber': .7, 'titanium white': .3}},
  'slate wall': {mix: {"payne's grey": 2, 'dioxazine violet': .4, 'titanium white': .2}},
  'wall lit': {mix: {'burnt sienna': 2, 'yellow ochre': 1.2, 'cadmium red': .3, 'titanium white': .6}},
  'wall red': {mix: {'cadmium red': 1, 'alizarin crimson': 1, 'burnt sienna': .6}},
  // the lights
  'hot': {mix: {'titanium white': 12, 'cadmium yellow': 1, 'naples yellow': 1}},
  'glow': {mix: {'cadmium yellow': 2, 'titanium white': 3}},
  'gold': {mix: {'cadmium yellow': 3, 'cadmium red': .35, 'titanium white': 1}},
  'amber': {mix: {'cadmium yellow': 2, 'cadmium red': .5, 'titanium white': .5}},
  'amber deep': {mix: {'cadmium yellow': 1, 'cadmium red': 1, 'burnt sienna': .3}},
  'ember': {mix: {'cadmium red': 1, 'burnt sienna': 1, 'alizarin crimson': .4}},
  'red': {mix: {'cadmium red': 2, 'alizarin crimson': 1}},
  'red glow': {mix: {'cadmium red': 2, 'cadmium yellow': .6, 'titanium white': .3}},
  'red deep': {mix: {'alizarin crimson': 2, 'cadmium red': 1, 'burnt umber': .4}},
  'pink hot': {mix: {'titanium white': 6, 'cadmium red': 1, 'cadmium yellow': .6}},
  // figures, iron
  'coat': {mix: {'lamp black': 2, 'burnt umber': 1, 'ultramarine': 1}},
  'iron': {mix: {'lamp black': 2, 'ultramarine': 1, 'dioxazine violet': .3}},
  'rain': {mix: {'titanium white': 3, 'ultramarine': .5, 'dioxazine violet': .25}}
};
const CC = new Map();
const C = c => { if (typeof c !== 'string') return Array.isArray(c) ? c : P.color(c); let v = CC.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); CC.set(c, v) } return v };
const km = (a, b, t) => t <= 0 ? C(a) : t >= 1 ? C(b) : P.mix([[C(a), 1 - t], [C(b), t]]);
const tone = (c, k) => { c = C(c); return [c[0] * k, c[1] * k, c[2] * k] };
const hex = c => P.hex(C(c));
const lerp3 = (a, b, t) => { a = C(a); b = C(b); t = clamp(t, 0, 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
const add3 = (a, b, k) => { a = C(a); b = C(b); return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k] };
const cl3 = c => [clamp(c[0], 0, 1), clamp(c[1], 0, 1), clamp(c[2], 0, 1)];

/* ---------- the document ---------- */
const doc = {
  paintsim: 1, engine: P.VERSION, title: 'Rain, late',
  note: 'A narrow street on a rainy night: shop windows and lamps in amber and red, long reflections on wet cobbles, three figures with umbrellas walking away. Oil and palette knife on toned canvas. Written by paintings/rain.gen.mjs.',
  size: [800, 1000], ground: 'night canvas',
  light: {base: 'gallery', lamps: [{azimuth: 235, elevation: 34, strength: 1.12, color: '#fff3df', pool: {at: [.47, .45], radius: .95}}, {ambient: true, strength: .1}], lens: {vignette: .25, contrast: .08, grain: .5}},
  seed: 20261111,
  define: {
    pigments: MIX,
    grounds: {'night canvas': {base: 'toned canvas', color: '#6b5a4c'}},
    materials: {
      'veil': {base: 'oil glaze', note: 'thin transparent colour scrubbed onto the canvas first', opacity: .55, body: .05, gloss: .1, film: .3, level: .5, rim: 0, gran: .15},
      'scrub': {base: 'oil', note: 'paint thinned with turpentine for the block-in: little body, it stays wet', body: .35, opacity: .9, gloss: .22, ridges: .3, grain: .07, dry: .38, open: .9, pickup: .02, merge: .3, bury: .5},
      'paint': {base: 'oil', note: 'the dark body paint: glossy enough that the lamp finds its ridges', body: .85, gloss: .38, sharp: .5, ridges: .28, merge: .22},
      'stiff': {base: 'oil', note: 'paint straight from the tube for knife work', body: 1, gloss: .36, sharp: .5, ridges: .2, grain: .05, merge: .12, pickup: .015},
      'thin': {base: 'oil', note: 'thinned paint for the sky: smooth, little relief', body: .18, opacity: .93, gloss: .25, ridges: .22, merge: .35, pickup: .03, bury: .6},
      'slab': {base: 'oil', note: 'knife paint for walls and sky: less body than the lights, so the darks do not turn to stucco', body: .45, gloss: .34, sharp: .5, ridges: .2, merge: .15},
      'figure': {base: 'oil', note: 'the figures: dark, matt enough to read as a silhouette, burying what is beneath', body: .8, opacity: .99, gloss: .14, sharp: .4, ridges: .15, merge: 0, pickup: 0, open: .2, bury: 1},
      'clean': {base: 'oil', note: 'accents that must stay clean: no merging into what is beneath', body: .8, gloss: .34, merge: 0, pickup: 0, open: .3},
      'impasto': {base: 'oil', note: 'the lights: thick, clean, buttery', body: 1.45, opacity: .99, gloss: .4, sharp: .5, ridges: .12, grain: .03, merge: 0, pickup: 0, open: .35, bury: .9},
      'lamp glass': {base: 'enamel', note: 'the glass of a lantern: a glossy bead of the brightest paint', color: 'hot', body: .7, gloss: .7, sharp: .75, merge: 0, pickup: 0},
      'iron': {base: 'oil', note: 'black iron of the lamp posts', color: 'iron', body: .7, gloss: .5, sharp: .6, metal: .25, merge: 0, pickup: 0, open: .2}
    },
    brushes: {
      'broad': {base: 'flat', note: 'a big hog flat for the block-in', width: 40, wobble: .8, var: .15},
      'hog': {base: 'flat', width: 18, wobble: .6, var: .15},
      'bright': {base: 'filbert', width: 12, wobble: .6, var: .2, clump: 2.2},
      'scumble': {base: 'flat', note: 'nearly dry, so that it catches only the tooth and the ridges', dry: .75, charge: .5, streak: 1.6, wobble: .7},
      'knife small': {base: 'knife', width: 10},
      'knife dry': {base: 'knife', note: 'a knife dragged thin: it skips across the ridges beneath', dry: .62, charge: .75},
      'rigger': {base: 'liner', wobble: .4, var: .25},
      'point': {base: 'round', profile: 'taper', wobble: .25}
    }
  },
  shapes: {}, steps: []
};

/* ---------- writing steps ---------- */
let cur = null, grp = null, MARKS = 0;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100;
const PT = pts => pts.map(p => [n1(p[0]), n1(p[1])]);
const colOf = c => typeof c === 'string' && c[0] === '#' ? c : hex(cl3(C(c)));
function stage(name, note) { cur = {name, do: []}; if (note) cur.note = note; doc.steps.push(cur); grp = null }
function put(shared, step) { const key = JSON.stringify(shared); if (!grp || grp.key !== key) { grp = {key, node: {with: shared, do: []}}; cur.do.push(grp.node) } grp.node.do.push(step); MARKS++ }
function st(material, brush, path, o = {}) {
  if (!path || path.length < 2) return;
  const s = {path: PT(path)};
  if (o.w !== undefined) s.width = o.w < 4 ? n2(o.w) : n1(Math.min(o.w, 220));
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.c2 !== undefined) s.color2 = colOf(o.c2);
  if (o.a !== undefined) s.opacity = n2(clamp(o.a, 0, 1));
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
const dot = (material, x, y, r, o) => dots(material, [[x, y, r]], o);
const dry = (v = true) => { cur.do.push({dry: v}); grp = null };

/* ---------- geometry ---------- */
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
const bbox = p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) } return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0} };
const area = p => { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(s / 2) };
function sampleIn(poly, n) { const b = bbox(poly), out = []; let guard = 0; while (out.length < n && guard++ < n * 200) { const x = R(b.x0, b.x1), y = R(b.y0, b.y1); if (inPoly(x, y, poly)) out.push([x, y]) } return out }
// the part of a stroke that lies inside a shape: a brush is lifted at the edge, not masked
function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }
const within = (path, poly) => run(path, p => inPoly(p[0], p[1], poly));
// a polygon cut to a rectangle (Sutherland–Hodgman)
function clipRect(poly, x0 = -8, y0 = -8, x1 = 808, y1 = 1008) {
  const edge = (pts, inside, cut) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b); if (ia) out.push(a); if (ia !== ib) out.push(cut(a, b)) } return out };
  const ix = (a, b, x) => [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])], iy = (a, b, y) => [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
  let p = poly; p = edge(p, q => q[0] >= x0, (a, b) => ix(a, b, x0)); if (!p.length) return p; p = edge(p, q => q[0] <= x1, (a, b) => ix(a, b, x1)); if (!p.length) return p;
  p = edge(p, q => q[1] >= y0, (a, b) => iy(a, b, y0)); if (!p.length) return p; return edge(p, q => q[1] <= y1, (a, b) => iy(a, b, y1)) }
const seg = (a, b, n = 2) => Array.from({length: n + 1}, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
const jit = (p, j) => p.map(q => [q[0] + R(-j, j), q[1] + R(-j, j)]);

/* =====================================================================
   THE SCENE: a camera at eye height looking down a narrow street
   ===================================================================== */
const VPx = 382, VPy = 520, F = 600, EYE = 1.6, CAMX = .3, XL = -3.2, XR = 3.6, ZFAR = 95, HFAR = 9;
const proj = (X, Y, Z) => [VPx + F * (X - CAMX) / Z, VPy - F * (Y - EYE) / Z];
const groundAt = (x, y) => { const Z = F * EYE / Math.max(.6, y - VPy); return {Z, X: CAMX + (x - VPx) * Z / F} };
const wallAt = (side, x, y) => { const X = side < 0 ? XL : XR, dx = x - VPx, Z = clamp(F * (X - CAMX) / (Math.abs(dx) < .5 ? (side < 0 ? -.5 : .5) : dx), 1, ZFAR); return {X, Z, Y: EYE - (y - VPy) * Z / F} };
const ZminL = F * (XL - CAMX) / (-14 - VPx), ZminR = F * (XR - CAMX) / (814 - VPx);
const wallZ0 = side => side < 0 ? ZminL : ZminR;
const fog = Z => 1 - Math.exp(-Math.max(0, Z - 6) / 42);

// buildings along each side: [z0, z1, height, wall colour]
const LB = [[2, 10.2, 15.5, 'brick'], [10.2, 16.5, 11.6, 'plaster'], [16.5, 24, 13.6, 'stone'], [24, 33, 10.6, 'brick'], [33, 45, 12.6, 'plaster'], [45, 61, 10.2, 'stone'], [61, ZFAR, 11.4, 'brick']];
const RB = [[2, 8.6, 12.5, 'plaster'], [8.6, 15, 14.2, 'stone'], [15, 22, 10.2, 'brick'], [22, 32, 12.8, 'plaster'], [32, 46, 11, 'stone'], [46, 66, 13, 'brick'], [66, ZFAR, 10, 'plaster']];
const wallPoly = (side, b) => { const X = side < 0 ? XL : XR, z0 = Math.max(b[0], wallZ0(side)); return clipRect([proj(X, 0, z0), proj(X, 0, b[1]), proj(X, b[2], b[1]), proj(X, b[2], z0)]) };
const skyline = []; for (const b of LB) { const z0 = Math.max(b[0], ZminL); skyline.push(proj(XL, b[2], z0), proj(XL, b[2], b[1])) }
skyline.push(proj(XL, HFAR, ZFAR), proj(XR, HFAR, ZFAR)); for (const b of RB.slice().reverse()) { const z0 = Math.max(b[0], ZminR); skyline.push(proj(XR, b[2], b[1]), proj(XR, b[2], z0)) }
const SKY = clipRect([[-30, -40]].concat(skyline.map(p => [p[0], Math.max(-40, p[1])]), [[830, -40]]));
const GROUND = clipRect([proj(XL, 0, ZFAR), proj(XL, 0, ZminL), [-14, 1014], [814, 1014], proj(XR, 0, ZminR), proj(XR, 0, ZFAR)]);
const FARWALL = [proj(XL, 0, ZFAR), proj(XR, 0, ZFAR), proj(XR, HFAR, ZFAR), proj(XL, HFAR, ZFAR)];

/* ---------- the lights ---------- */
// windows: side, z0, z1, y0, y1, colour of the glow inside, hot colour, strength
const WINS = [
  {side: -1, z0: 5.8, z1: 9.3, y0: .55, y1: 2.9, c: 'amber', hot: 'hot', mid: 'gold', s: 1.15, bars: 4},
  {side: -1, z0: 11.4, z1: 14.6, y0: .55, y1: 2.7, c: 'amber', hot: 'glow', mid: 'gold', s: .95, bars: 3},
  {side: -1, z0: 18.2, z1: 21.6, y0: .55, y1: 2.7, c: 'amber deep', hot: 'glow', mid: 'amber', s: .8, bars: 3},
  {side: -1, z0: 27, z1: 31, y0: .6, y1: 2.6, c: 'amber', hot: 'glow', mid: 'gold', s: .7, bars: 2},
  {side: -1, z0: 39, z1: 43, y0: .6, y1: 2.5, c: 'amber deep', hot: 'gold', mid: 'amber', s: .55, bars: 2},
  {side: 1, z0: 6.0, z1: 9.0, y0: .5, y1: 2.75, c: 'red', hot: 'amber', mid: 'red glow', s: 1.1, bars: 3},
  {side: 1, z0: 15.4, z1: 18.8, y0: .55, y1: 2.6, c: 'amber deep', hot: 'glow', mid: 'amber', s: .85, bars: 3},
  {side: 1, z0: 26, z1: 29.5, y0: .6, y1: 2.5, c: 'ember', hot: 'gold', mid: 'amber deep', s: .6, bars: 2},
  {side: 1, z0: 48, z1: 52, y0: .6, y1: 2.5, c: 'amber', hot: 'glow', mid: 'gold', s: .5, bars: 2}
];
// lamps on posts on the left pavement, and one lantern on a bracket on the right
const LAMPS = [{X: -2.35, Z: 8.2, Y: 3.95, s: 1.25}, {X: -2.35, Z: 19.5, Y: 3.95, s: 1}, {X: -2.35, Z: 36, Y: 3.95, s: .85}, {X: -2.35, Z: 62, Y: 3.95, s: .7}];
const LANTERN = {X: 3.0, Z: 11.2, Y: 3.55, s: .95};
const winX = w => w.side < 0 ? XL : XR;
// light falling on a point of the scene: sum of the sources, with the colour they bring
const SRC = [];
for (const l of LAMPS) SRC.push({p: [l.X, l.Y, l.Z], s: l.s * 1.1, r: 3, c: 'gold'});
SRC.push({p: [LANTERN.X, LANTERN.Y, LANTERN.Z], s: LANTERN.s * 1.1, r: 2.8, c: 'amber'});
for (const w of WINS) for (let i = 0; i < 4; i++) { const z = w.z0 + (w.z1 - w.z0) * (i + .5) / 4; SRC.push({p: [winX(w) - w.side * .45, 1.6, z], s: w.s * .3, r: 1.8, c: w.c}) }
function lightAt(X, Y, Z) { let s = 0, r = 0, g = 0, b = 0;
  for (const L of SRC) { const dx = X - L.p[0], dy = Y - L.p[1], dz = Z - L.p[2], q = 1 + (dx * dx + dy * dy + dz * dz) / (L.r * L.r), k = L.s / (q * q); if (k < .002) continue; const c = C(L.c); s += k; r += c[0] * k; g += c[1] * k; b += c[2] * k }
  return s > 0 ? {s, c: [r / s, g / s, b / s]} : {s: 0, c: C('amber')} }

/* ---------- what the wet ground mirrors ---------- */
// each blob is the mirror image of a piece of a light, stretched downwards by the roughness of the wet stones
const BLOBS = [];
const blob = (X, Y, Z, wW, s, c, k = 1) => { const m = proj(X, -Y, Z), base = proj(X, 0, Z)[1], d = m[1] - base; BLOBS.push({x: m[0], y: m[1], base, wx: Math.max(1.5, wW * F / Z), up: d * .55 + 2, down: (d * 1.7 + 30) * k, s, c}) };
for (const l of LAMPS) { blob(l.X, l.Y, l.Z, .28, l.s * 1.5, 'glow', 1.4); blob(l.X, l.Y, l.Z, .7, l.s * .35, 'amber', 1.6) }
blob(LANTERN.X, LANTERN.Y, LANTERN.Z, .3, LANTERN.s * 1.3, 'gold', 1.3); blob(LANTERN.X, LANTERN.Y, LANTERN.Z, .8, .3, 'amber', 1.5);
for (const w of WINS) { const n = Math.max(2, Math.round((w.z1 - w.z0) * 1.6)); for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
  const z = w.z0 + (w.z1 - w.z0) * (i + .5) / n, y = w.y0 + (w.y1 - w.y0) * (j + .5) / 3, X = winX(w) - w.side * .1, wz = (w.z1 - w.z0) / n * Math.abs(X - CAMX) / z * 1.15;
  blob(X, y, z, wz, w.s * .22, j === 1 ? lerp3(w.c, w.mid, .4) : w.c, .8) } }
// the glow at the end of the street, mirrored down its middle
BLOBS.push({x: VPx + 4, y: VPy + 8, base: VPy + 2, wx: 24, up: 4, down: 200, s: .24, c: lerp3('haze warm', 'amber', .4)});
BLOBS.push({x: VPx + 4, y: VPy + 8, base: VPy + 2, wx: 60, up: 4, down: 140, s: .08, c: 'violet grey'});
// rough wet stones break a reflection into vertical stripes, finer with distance
const streak = (x, y) => { const Z = F * EYE / Math.max(.6, y - VPy), ws = clamp(F / Z * .05, 1.2, 7), n = fbm(x / ws + 11, y / 70, 2); return .06 + .94 * smooth((n - .34) / .3) };
function reflAt(x, y) { let s = 0, r = 0, g = 0, b = 0;
  for (const B of BLOBS) { if (y < B.base) continue; const dx = (x - B.x) / B.wx; if (dx * dx > 9) continue; const dy = y - B.y, v = dy < 0 ? Math.exp(-(dy / B.up) * (dy / B.up)) : Math.exp(-dy / B.down), k = B.s * Math.exp(-dx * dx) * v; if (k < .003) continue; const c = C(B.c); s += k; r += c[0] * k; g += c[1] * k; b += c[2] * k }
  if (s > 0) { const k = streak(x, y); return {s: s * k, c: [r / s, g / s, b / s]} } return {s: 0, c: C('amber')} }

/* ---------- figures with umbrellas, seen from behind ---------- */
const FIG = [
  {X: .9, Z: 8.9, umb: 'night', umbHi: 'gold', coat: 'coat', step: .25, lean: .02, side: -1, h: 1.72},
  {X: -.65, Z: 9.9, umb: 'red deep', umbHi: 'red glow', coat: 'coat', step: .7, lean: -.02, side: -1, h: 1.64},
  {X: 0.0, Z: 20, umb: 'night blue', umbHi: 'amber', coat: 'coat', step: .5, lean: 0, side: 1, h: 1.75}
];
// the figures stand in the wet too: their dark mirror images (and the red of the umbrella) lie in the reflections below them
function figRefl(x, y) { let k = 0, c = null;
  for (const f of FIG) { const s = F / f.Z, g = proj(f.X, 0, f.Z), dx = (x - g[0]) / s, dy = (y - g[1]) / s * 1.7 / f.h; if (dy < 0 || dy > 2.6 || Math.abs(dx) > .7) continue;
    const body = dy < 1.5 ? smooth((.27 - Math.abs(dx + (dy < .8 ? 0 : 0)) + .04) / .08) * (dy < .85 ? .75 : .9) : 0, umb = dy > 1.72 && dy < 2.45 ? smooth((.58 - Math.abs(dx)) / .08) * smooth((dy - 1.72) / .1) * smooth((2.45 - dy) / .2) : 0;
    const kk = Math.max(body, umb) * (.55 + .45 * streak(x, y)); if (kk > k) { k = kk; c = umb > body ? lerp3(f.umb, 'night', .3) : 'night' } }
  return {k, c} }

/* ---------- colours of the scene at a point ---------- */
function skyCol(x, y) { const t = clamp(y / 470, 0, 1), dv = Math.hypot(x - VPx, (y - 470) * 1.6), glow = Math.exp(-dv / 120), n = fbm(x / 90 + 3, y / 60 + 1, 3);
  let c = t < .5 ? lerp3('sky top', 'sky', t * 2 * (.7 + .5 * n)) : lerp3('sky', 'sky low', (t - .5) * 2);
  c = lerp3(c, 'night', (1 - t) * .5 * (1 - n));
  return lerp3(c, 'haze', glow * .75) }
function wallCol(side, b, X, Y, Z) { const L = lightAt(X - side * .02, Y, Z), n = fbm(Z / 3 + side * 7, Y / 4, 2), base = lerp3(b[3], n > .5 ? 'night violet' : 'indigo', .35 + .3 * Math.abs(n - .5)), up = smooth((Y - 1.8) / 5.5);
  let c = lerp3(base, lerp3('night', 'indigo', .3), up);
  const lit = clamp(L.s * .75, 0, 1.1), lc = lerp3(km(b[3], 'wall lit', .7), L.c, .3);
  c = lerp3(c, lc, Math.pow(lit, 1.3) * .85);
  if (L.s > 1) c = lerp3(c, L.c, (L.s - 1) * .5);
  return lerp3(c, lerp3('haze', 'sky low', .4), fog(Z) * .8) }
function groundBase(x, y) { const g = groundAt(x, y), far = smooth((g.Z - 8) / 60), n = fbm(x / 40, y / 25, 3);
  let c = lerp3('night blue', 'night', clamp(.4 + (n - .5) * .8, 0, 1));
  c = lerp3(c, 'indigo', .25 * n);
  c = lerp3(c, 'night', smooth((y - 780) / 220) * .35);
  { const L = lightAt(g.X, .05, g.Z); c = lerp3(c, lerp3('ember', L.c, .4), clamp(L.s * .45, 0, .35) * clamp((40 - g.Z) / 20, 0, 1)) }   // light pooling on the wet stones near a lamp or a window
  return lerp3(c, lerp3('violet grey', 'sky', .4), far * .55) }
function groundCol(x, y, k = 1) { const r = reflAt(x, y), base = groundBase(x, y), s = r.s * k;
  let c = lerp3(base, r.c, clamp(s, 0, 1) * .92);
  if (s > 1) c = lerp3(c, 'hot', clamp((s - 1) * .5, 0, .7));
  const fr = figRefl(x, y); if (fr.k > 0) return {c: lerp3(c, fr.c, fr.k * .85), s: s * (1 - fr.k)};
  return {c, s} }
const depthW = (Z, k, a, b) => clamp(k * F / Z, a, b);

/* =====================================================================
   STAGES
   ===================================================================== */
function underpainting() {
  stage('Toned ground and drawing', 'A transparent scrub of warm sienna where the lights will be and violet in the dark, then the perspective drawn with thin umber.');
  fl('veil', SKY, {c: {mix: {'ultramarine': 2, 'dioxazine violet': 1}}, a: .6, uneven: .8, scale: 120});
  fl('veil', [[-10, -10], [810, -10], [810, 1010], [-10, 1010]], {c: {mix: {'ultramarine': 1, 'dioxazine violet': 1, 'burnt umber': 1}}, a: .45, uneven: .9, scale: 160});
  for (const w of WINS) { const X = winX(w), q = [proj(X, w.y0 - .8, w.z0 - 1.5), proj(X, w.y0 - .8, w.z1 + 1.5), proj(X, w.y1 + 1, w.z1 + 1.5), proj(X, w.y1 + 1, w.z0 - 1.5)];
    fl('veil', clipRect(q), {c: 'burnt sienna', a: .55, soft: 12, uneven: .6, scale: 40}) }
  for (const l of LAMPS) { const p = proj(l.X, l.Y, l.Z), r = 1.6 * F / l.Z; fl('veil', {circle: [n1(p[0]), n1(p[1]), n1(r)]}, {c: 'burnt sienna', a: .5, soft: r * .5}) }
  // the drawing: the lines that run to the vanishing point, the shop fronts, the figures
  const sk = (path, a = .45, w = 1.6) => st('scrub', 'point', jit(path, 1.2), {w: w * R(.8, 1.2), c: 'umber dark', a, wob: 1});
  for (const X of [XL, XR]) for (const Y of [0, 3.0, 6.5]) sk(seg(proj(X, Y, X < 0 ? ZminL : ZminR), proj(X, Y, 60), 3));
  for (const w of WINS.slice(0, 7)) { const X = winX(w); sk([proj(X, w.y0, w.z0), proj(X, w.y1, w.z0)], .35, 1.2); sk([proj(X, w.y0, w.z1), proj(X, w.y1, w.z1)], .35, 1.2) }
  sk(seg([-10, 798], [VPx, VPy], 3), .3); sk(seg([810, 842], [VPx, VPy], 3), .3);
  dry();
}

function sky() {
  stage('Sky', 'Deep blue-violet scrubbed in with a big brush in crossing diagonals, a few dark knife slabs, paling toward the glow at the end of the street.');
  // a flat dark under-layer, a little past the edges, so that no canvas shows where strokes are lifted at the roofs
  fl('thin', SKY.map(p => [p[0], p[1]]), {c: lerp3('sky top', 'sky', .5), a: .97});
  const pts = sampleIn(SKY, 560); pts.sort((a, b) => a[1] - b[1]);
  for (const p of pts) { const ang = R(-.75, -.35) + (rnd() < .3 ? 1.1 : 0), len = R(30, 80), w = R(16, 36), c = skyCol(p[0], p[1]);
    const path = within(arc(p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2, ang, len, R(-.3, .3), 6), SKY);
    st('thin', rnd() < .6 ? 'broad' : 'hog', path, {w, c: tone(c, R(.92, 1.06)), c2: lerp3(c, rnd() < .6 ? 'night' : 'sky low', R(.1, .25)), a: .95, load: len * 1.6}) }
  for (let i = 0; i < 26; i++) { const p = sampleIn(SKY, 1)[0]; if (!p || p[1] > 380) continue; const ang = R(-.7, -.3), len = R(30, 70), c = skyCol(p[0], p[1]);
    st('thin', 'knife', within(arc(p[0], p[1], ang, len, R(-.15, .15), 5), SKY), {w: R(10, 22), c: lerp3(c, rnd() < .7 ? 'night violet' : 'sky low', R(.1, .25)), a: .9}) }
  // the haze of light where the street ends, wet into the sky
  const G = [VPx + 2, 478];
  for (let i = 0; i < 230; i++) { const a = R(0, 6.283), r = Math.pow(rnd(), .6) * 150, x = G[0] + Math.cos(a) * r * 1.25, y = G[1] + Math.sin(a) * r * .75; if (y > 526 || !inPoly(x, y, SKY) && !inPoly(x, y, FARWALL) && y < 300) continue;
    const t = r / 150, c = lerp3(lerp3('haze warm', 'haze', t * 1.2), skyCol(x, y), smooth(t * 1.1)), ang = R(-.3, .3) + (rnd() < .3 ? 1.57 : 0), len = R(20, 46);
    st('paint', rnd() < .5 ? 'hog' : 'broad', arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, R(-.2, .2), 4), {w: R(10, 22), c, a: .9}) }
  // far houses, dissolving in the haze: a flat under-layer first so that no canvas shows between the small strokes
  for (const [side, list] of [[-1, LB], [1, RB]]) for (const b of list) { if (b[0] < 24) continue; const poly = wallPoly(side, b); if (poly.length < 3) continue; const zc = (b[0] + b[1]) / 2; fl('scrub', poly, {c: wallCol(side, b, side < 0 ? XL : XR, 4, zc), a: .95}) }
  for (const [side, list] of [[-1, LB], [1, RB]]) for (const b of list) { if (b[0] < 24) continue; const poly = wallPoly(side, b); if (poly.length < 3) continue;
    for (const p of sampleIn(poly, Math.ceil(area(poly) / 9) + 6)) { const w = wallAt(side, p[0], p[1]), c = wallCol(side, b, w.X, w.Y, w.Z), vert = rnd() < .5, ang = vert ? 1.57 : Math.atan2(VPy - p[1], VPx - p[0]), len = R(5, 14);
      st('scrub', 'hog', within(arc(p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2, ang, len, 0, 3), poly), {w: R(3, 7), c: tone(c, R(.9, 1.1)), a: .95}) } }
  for (const p of sampleIn(FARWALL, 90)) st('paint', 'hog', [[p[0], p[1] - 5], [p[0] + R(-.5, .5), p[1] + 5]], {w: R(3, 6), c: lerp3(lerp3('haze', 'haze warm', .3), 'violet grey', R(.2, .6)), a: .95});
  for (let i = 0; i < 160; i++) { const x = R(VPx - 70, VPx + 70), y = R(410, 526), d = Math.hypot((x - VPx) / 1.3, y - 478) / 90; if (d > 1) continue; const c = lerp3(lerp3('haze warm', 'haze', d), sceneCol(x, y), smooth(d) * .6), ang = rnd() < .5 ? 1.57 : R(-.2, .2), len = R(8, 22);
    st('paint', 'hog', [[x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2], [x + Math.cos(ang) * len / 2, y + Math.sin(ang) * len / 2]], {w: R(4, 9), c, a: .9}) }
  // mist drifting across the far houses: a nearly dry brush
  for (let i = 0; i < 40; i++) { const x = R(G[0] - 110, G[0] + 110), y = R(400, 520), len = R(25, 60);
    st('scrub', 'scumble', [[x - len / 2, y], [x + len / 2, y + R(-3, 3)]], {w: R(6, 14), c: lerp3('haze', 'haze warm', R(0, .6)), a: .8}) }
  dry();
}

// what is painted at a point of the picture, before any lights: used to fade a halo into exactly what lies around it
function sceneCol(x, y) {
  if (inPoly(x, y, SKY)) return skyCol(x, y);
  if (y > VPy && inPoly(x, y, GROUND)) return groundCol(x, y).c;
  const side = x < VPx ? -1 : 1, w = wallAt(side, x, y), b = (side < 0 ? LB : RB).find(b => w.Z >= b[0] && w.Z < b[1]) || (side < 0 ? LB : RB)[0];
  return wallCol(side, b, w.X, w.Y, w.Z) }
// a glow in the wet air round a light: short strokes laid wet, warm at the middle, the colour of what is there at the edge
function halo(cx, cy, R0, col, k, n) {
  const pts = []; for (let i = 0; i < n; i++) { const r = R0 * Math.pow(rnd(), .75), a = R(0, 6.283); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, r]) }
  pts.sort((p, q) => q[2] - p[2]);
  for (const [x, y, r] of pts) { const t = r / R0, f = k * Math.exp(-2.6 * t * t), c = lerp3(sceneCol(x, y), lerp3(col, 'glow', clamp(1 - t * 2.2, 0, 1) * .8), f), sky = inPoly(x, y, SKY), ang = sky ? R(-.75, -.35) : rnd() < .3 ? 1.57 + R(-.08, .08) : Math.atan2(VPy - y, VPx - x) + R(-.12, .12), len = R(.15, .32) * R0;
    st('paint', 'hog', arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, R(-.3, .3), 3), {w: R(.07, .14) * R0, c, a: .9}) }
  for (let i = 0; i < 18; i++) { const a = R(0, 6.283), r0 = R(.1, .4) * R0, r1 = R(.7, 1) * R0; st('paint', 'blender', [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a + R(-.2, .2)) * r1, cy + Math.sin(a + R(-.2, .2)) * r1]], {w: R(.15, .3) * R0}) } }

function facades() {
  stage('Facades', 'The two walls blocked in along the lines of the street, dark above and warmed from below by the lamps and windows; the glow round each lamp worked in wet.');
  for (const [side, list] of [[-1, LB], [1, RB]]) for (const b of list.slice().reverse()) { if (b[0] >= 24) continue; const poly = wallPoly(side, b); if (poly.length < 3) continue;
    { const zc = Math.max(b[0], wallZ0(side)) * .6 + b[1] * .4; fl('scrub', poly, {c: wallCol(side, b, side < 0 ? XL : XR, 6, zc), a: .97}) }
    const n = Math.ceil(area(poly) / 240) + 12, pts = sampleIn(poly, n);
    pts.sort((p, q) => Math.abs(p[0] - VPx) - Math.abs(q[0] - VPx));
    for (const p of pts) { const w = wallAt(side, p[0], p[1]), c = wallCol(side, b, w.X, w.Y, w.Z), vert = rnd() < .35, ang = vert ? Math.PI / 2 + R(-.06, .06) : Math.atan2(VPy - p[1], VPx - p[0]) + R(-.08, .08);
      const ww = depthW(w.Z, .3, 3, 42) * R(.7, 1.2), len = ww * R(2, 3.6), path = within(arc(p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2, ang, len, R(-.1, .1), 6), poly);
      const knife = rnd() < .3;
      st(knife ? 'slab' : 'paint', knife ? 'knife' : (ww > 20 ? 'broad' : 'hog'), path, {w: ww, c: tone(c, R(.88, 1.08)), c2: lerp3(c, rnd() < .6 ? 'night' : 'wall lit', R(.08, .25)), a: .96, load: len * 2}) } }
  for (const l of LAMPS) { const h = proj(l.X, l.Y, l.Z), s = F / l.Z; halo(h[0], h[1], 1.7 * s, 'gold', 1, Math.round(clamp(1.7 * s * 3, 50, 360))) }
  { const l = LANTERN, h = proj(l.X, l.Y, l.Z), s = F / l.Z; halo(h[0], h[1], 1.4 * s, 'gold', .95, 220) }
  dry();
}

// a rectangle on a wall, in its own terms
const wq = (side, z0, z1, y0, y1) => { const X = side < 0 ? XL : XR; return [proj(X, y0, z0), proj(X, y0, z1), proj(X, y1, z1), proj(X, y1, z0)] };
function wallStroke(side, Y, z0, z1, o) { const X = side < 0 ? XL : XR; st(o.m || 'clean', o.b || 'hog', seg(proj(X, Y, z0), proj(X, Y, z1), 3), o) }
function wallVert(side, Z, y0, y1, o) { const X = side < 0 ? XL : XR; st(o.m || 'clean', o.b || 'hog', [proj(X, y0, Z), proj(X, y1, Z)], o) }

function structure() {
  stage('Windows, cornices, doors', 'The upper windows (dark, a few lit), cornices catching the light from below, doors, shop fronts and the red awning.');
  for (const [side, list] of [[-1, LB], [1, RB]]) for (const b of list) { if (b[0] >= 46) continue; const X = side < 0 ? XL : XR, z0 = Math.max(b[0], wallZ0(side) - 2);
    // cornice under the roof and a string course above the shops
    for (const [Y, k] of [[b[2] - .45, 1], [3.15, .8]]) { if (Y > b[2]) continue; const L = lightAt(X, Y, (b[0] + b[1]) / 2), c = lerp3(wallCol(side, b, X, Y, (z0 + b[1]) / 2), 'wall lit', clamp(L.s, 0, 1) * .6);
      wallStroke(side, Y, Math.max(z0, wallZ0(side)), b[1], {m: 'stiff', b: 'knife', w: depthW((z0 + b[1]) / 2, .22 * k, 1.5, 14), c, a: .9});
      wallStroke(side, Y - .25, Math.max(z0, wallZ0(side)), b[1], {m: 'paint', b: 'hog', w: depthW((z0 + b[1]) / 2, .14, 1, 9), c: tone(c, .4), a: .7}) }
    // the joint between two houses
    if (b[0] > wallZ0(side)) wallVert(side, b[0], 0, b[2], {m: 'paint', b: 'point', w: depthW(b[0], .12, 1, 6), c: 'night', a: .8});
    // upper windows
    for (const [y0, y1] of [[4.1, 5.7], [7.0, 8.5], [9.9, 11.3], [12.6, 14]]) { if (y1 > b[2] - .7) continue;
      for (let z = b[0] + .9; z + 1.1 < b[1]; z += 2.3) { if (z < wallZ0(side) + .3) continue; const z1 = z + 1.05, q = wq(side, z, z1, y0, y1), sw = Math.abs(q[1][0] - q[0][0]); if (sw < 1) continue;
        const L = lightAt(X, (y0 + y1) / 2, z), hh = Math.abs(Math.sin(side * 91.7 + z * 12.9898 + y0 * 78.233) * 43758.5453) % 1, lit = z > 9 && hh < .14, fz = fog(z);   // which windows are lit does not depend on the random stream
        let c = lit ? lerp3(pick(['amber deep', 'ember', 'amber']), 'umber dark', R(.35, .6)) : lerp3(lerp3('night', 'indigo', R(0, .5)), lerp3('sky low', 'violet grey', .5), R(0, .25) + fz * .5);
        if (!lit) c = lerp3(c, L.c, clamp(L.s, 0, 1) * .25);
        const nv = Math.max(1, Math.round(sw / 7));
        for (let i = 0; i < nv; i++) { const t = (i + .5) / nv, zt = z + (z1 - z) * t; wallVert(side, zt, y0, y1, {m: 'paint', b: sw / nv > 5 ? 'knife small' : 'hog', w: Math.max(1.2, sw / nv * 1.25), c: tone(c, R(.85, 1.12)), a: .95}) }
        if (lit) wallVert(side, z + (z1 - z) * R(.3, .7), y0 + .2, y1 - .3, {m: 'clean', b: 'hog', w: Math.max(1, sw * .25), c: lerp3(pick(['amber', 'amber deep']), 'gold', R(0, .4)), a: .6});
        // sill catching the light, and the lintel shadow
        const sc = lerp3(wallCol(side, b, X, y0, z), 'wall lit', clamp(L.s, 0, 1) * .5 + .15);
        wallStroke(side, y0 - .08, z - .1, z1 + .1, {m: 'stiff', b: 'knife small', w: depthW(z, .1, 1, 6), c: sc, a: .9});
        wallStroke(side, y1 + .05, z - .05, z1 + .05, {m: 'paint', b: 'hog', w: depthW(z, .12, 1, 6), c: 'night', a: .7}) } } }
  // doors: dark recesses with a lit fanlight
  for (const [side, z0, z1] of [[-1, 9.6, 10.6], [-1, 15.1, 16], [1, 10.1, 11], [1, 20.5, 21.3], [-1, 22.4, 23.2]]) { const q = wq(side, z0, z1, 0, 2.3), sw = Math.abs(q[1][0] - q[0][0]), n = Math.max(1, Math.round(sw / 6));
    for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * (i + .5) / n; wallVert(side, z, 0, 2.3, {m: 'paint', b: 'hog', w: Math.max(1.2, sw / n * 1.3), c: lerp3('night', 'umber dark', R(0, .6)), a: .97}) }
    wallStroke(side, 2.45, z0, z1, {m: 'clean', b: 'knife small', w: depthW(z0, .2, 1.2, 10), c: 'amber', a: .9}) }
  // shop-front frames: dark wood round every window, fascia board above
  for (const w of WINS) { const X = winX(w), zm = (w.z0 + w.z1) / 2;
    const board = lerp3('umber dark', w.c, .18 + .2 * w.s);
    wallStroke(w.side, w.y1 + .45, w.z0 - .25, w.z1 + .25, {m: 'paint', b: 'knife', w: depthW(zm, .55, 1.5, 34), c: board, a: .95});
    wallStroke(w.side, (w.y0) / 2, w.z0 - .1, w.z1 + .1, {m: 'paint', b: 'knife', w: depthW(zm, .42, 1.2, 26), c: lerp3('night', w.c, .12), a: .95});
    for (const z of [w.z0 - .12, w.z1 + .12]) wallVert(w.side, z, 0, w.y1 + .7, {m: 'paint', b: 'hog', w: depthW(z, .2, 1, 12), c: lerp3('night', w.c, .1), a: .95}) }
  // the red awning over the shop on the right, lit from beneath
  { const w = WINS[5], top = 3.45, out = .95, low = 2.95, zs = [w.z0 - .2, w.z1 + .2], A = (z, f) => proj(XR - out * f, top - (top - low) * f, z);
    const poly = [A(zs[0], 0), A(zs[1], 0), A(zs[1], 1), A(zs[0], 1)];
    doc.shapes['awning'] = PT(poly);
    for (let i = 0; i < 9; i++) { const f = (i + .5) / 9, c = lerp3('red deep', 'red', f * .8);
      st('stiff', 'knife', seg(A(zs[0] - .1, f), A(zs[1] + .1, f), 3), {w: Math.abs(A(zs[0], 1)[1] - A(zs[0], 0)[1]) / 9 * 2.2 + 2, c: tone(c, R(.85, 1.1)), a: .96, clip: 'awning'}) }
    // its valance, scalloped and glowing from the window under it
    const vp = []; for (let i = 0; i <= 14; i++) { const z = zs[0] + (zs[1] - zs[0]) * i / 14; vp.push(A(z, 1)) }
    st('stiff', 'knife', vp, {w: depthW(7.5, .32, 4, 30), c: 'red glow', c2: 'red', a: .97});
    st('paint', 'point', vp.map(p => [p[0], p[1] + depthW(7.5, .16, 2, 15)]), {w: depthW(7.5, .06, 1, 5), c: 'red deep', a: .9}) }
  dry();
}

function street() {
  stage('Street, wet', 'The road and pavements blocked in with horizontal strokes, then the reflections dragged down into them while all of it is wet.');
  fl('scrub', GROUND, {c: 'night blue', a: .97});
  { const far = clipRect(GROUND, -8, VPy - 2, 808, VPy + 40); if (far.length > 2) fl('scrub', far, {c: groundCol(VPx, VPy + 14).c, a: .95, soft: 4}) }
  const pts = sampleIn(GROUND, 1700); pts.sort((a, b) => a[1] - b[1]);
  for (const p of pts) { const g = groundAt(p[0], p[1]), w = clamp(960 * .22 / (g.Z * g.Z), 1.6, 26) * R(.8, 1.25), len = depthW(g.Z, .9, 8, 110) * R(.6, 1.2), gc = groundCol(p[0], p[1], .3);
    st(rnd() < .5 ? 'paint' : 'scrub', w > 14 ? 'broad' : 'hog', arc(p[0] - len / 2, p[1] + R(-1, 1), R(-.03, .03), len, R(-.05, .05), 5), {w, c: tone(gc.c, R(.85, 1.1)), c2: lerp3(gc.c, 'night', R(.1, .35)), a: .95}) }
  // the reflections, dragged straight down into the wet paint
  const cand = sampleIn(GROUND, 9000).filter(p => { const r = reflAt(p[0], p[1]); return rnd() < Math.min(1, r.s * 1.4) });
  cand.sort((a, b) => a[1] - b[1]);
  for (const p of cand.filter(() => rnd() < .55)) { const g = groundAt(p[0], p[1]), gc = groundCol(p[0], p[1], .85), len = clamp(R(.6, 1.6) * F / g.Z * .5 + R(10, 30), 8, 120), w = clamp(R(.08, .2) * F / g.Z, 1.5, 22);
    st('paint', rnd() < .5 ? 'hog' : 'knife', seg([p[0], p[1] - len * .3], [p[0] + R(-1, 1), p[1] + len * .7], 2), {w, c: gc.c, c2: lerp3(gc.c, groundBase(p[0], p[1]), .35), a: .9, load: len * 1.5}) }
  // curbs: the edge of each pavement, a thin light line and its shadow
  for (const X of [-1.95, 2.45]) { const zs = X < 0 ? ZminL - 1.6 : ZminR - 1.6, pts = []; for (let z = Math.max(2.4, zs); z < 70; z *= 1.18) pts.push(proj(X, .14, z));
    const lo = pts.map(p => { const g = groundAt(p[0], p[1]); return proj(X, 0, g.Z) });
    st('stiff', 'knife small', pts, {w: 3, c: lerp3('violet grey', 'night blue', .3), a: .9}); st('paint', 'hog', lo, {w: 2.5, c: 'night', a: .9}) }
  dry();
}

function cobbles() {
  stage('Cobbles', 'Each sett a rounded dab of stiff paint, lit along its top and dark beneath, coloured by what the wet stone mirrors there.');
  const crowns = [];
  let row = 0;
  for (let Z = 2.25; Z < 10.5; Z += .17 * R(.92, 1.08), row++) { const off = row % 2 ? .1 : 0;
    for (let X = XL - .3 + off; X < XR + .3; X += .2 * R(.85, 1.15)) { const pav = X < -1.95 || X > 2.45, Xc = X + R(-.04, .04), Zc = Z + R(-.03, .03), p = proj(Xc, 0, Zc); if (rnd() < .1) continue;
      if (p[0] < -15 || p[0] > 815 || p[1] > 1015 || !inPoly(p[0], Math.min(1005, p[1]), GROUND)) continue;
      if (pav && rnd() < .55) continue;   // pavement: big flags, fewer of them
      const len = (pav ? .55 : .2) * F / Zc * R(.62, 1.02), th = 960 * (pav ? .58 : .17) / (Zc * Zc) * R(.65, 1);
      let gc = groundCol(p[0], p[1]); for (const dx of [-.3, .3]) { const g2 = groundCol(p[0] + dx * len, p[1]); if (g2.s > gc.s) gc = g2 }   // a wet stone takes the brightest light that falls across it
      const I = gc.s * R(.7, 1.25);
      let c = lerp3(groundBase(p[0], p[1]), gc.c, clamp(I, 0, 1) * .9); if (I > 1.1) c = lerp3(c, 'hot', (I - 1.1) * .3);
      c = tone(c, R(.8, 1.12));
      const tilt = R(-.1, .1) * len;
      const sag = R(-.12, .12) * th;
      if (rnd() < .35 && len > 6) st('stiff', 'knife small', [[p[0] - len / 2, p[1] - tilt / 2], [p[0], p[1] + sag], [p[0] + len / 2, p[1] + tilt / 2]], {w: th * .9, c, c2: lerp3(c, 'night', R(.3, .5)), a: .96});
      else st('stiff', 'bright', [[p[0] - len / 2, p[1] - tilt / 2], [p[0], p[1] + sag], [p[0] + len / 2, p[1] + tilt / 2]], {w: th, c, c2: lerp3(c, 'night', R(.35, .6)), grad: 1, a: .96, pr: [R(.5, .9), 1, 1, 1, R(.5, .9)]});
      if (gc.s > .25 && rnd() < .25 + gc.s * .5) crowns.push([p[0] + R(-.2, .2) * len, p[1] - th * R(.15, .3), len * R(.25, .55), th * R(.2, .35), gc, true]);
      else if (rnd() < .22) crowns.push([p[0] + R(-.2, .2) * len, p[1] - th * .28, len * R(.2, .4), th * .18, {c: lerp3('violet grey', 'sky', .4), s: .2}, false]) } }
  // far cobbles: just the texture of rows
  for (let i = 0; i < 3400; i++) { const yy = VPy + F * EYE / R(10.4, 92); const g = groundAt(0, yy), xl = proj(XL, 0, g.Z)[0], xr = proj(XR, 0, g.Z)[0], x = R(xl, xr);
    const gc = groundCol(x, yy), len = R(.15, .45) * F / g.Z, w = Math.max(1, 960 * .13 / (g.Z * g.Z)) * R(.8, 1.4);
    st('stiff', 'knife small', [[x - len / 2, yy], [x + len / 2, yy + R(-.3, .3)]], {w, c: tone(lerp3(groundBase(x, yy), gc.c, clamp(gc.s * R(.5, 1.2), 0, 1)), R(.8, 1.2)), a: .92}) }
  dry();
  for (const [x, y, l, t, gc, warm] of crowns) { const c = warm ? lerp3(gc.c, 'hot', clamp(gc.s - .4, 0, .6) * R(.5, 1)) : gc.c;
    st(warm ? 'impasto' : 'clean', 'bright', [[x - l / 2, y + R(-.2, .2) * t], [x + l / 2, y + R(-.2, .2) * t]], {w: Math.max(1, t), c, a: warm ? .92 : .55}) }
  dry();
}

function shopWindows() {
  stage('Shop windows', 'The glow inside each window laid in wet: dim and red at the edges, gold toward the lamp inside, with the shapes of shelves and a shopkeeper melting into it.');
  const HOT = [];
  for (const w of WINS) { const X = winX(w), q = clipRect(wq(w.side, w.z0, w.z1, w.y0, w.y1)); if (q.length < 3) continue;
    const zm = (w.z0 + w.z1) / 2, sy = F / zm, sw = Math.abs(q[1][0] - q[0][0]), cu = R(.38, .62), cv = R(.25, .42);
    const edge = tone(km(w.c, 'ember', .5), .6), deep = tone(km(w.c, 'red deep', .55), .42);
    const spots = [[cu, cv, .45, .6, 1]]; for (let i = 0; i < 2; i++) spots.push([R(.15, .85), R(.8, .95), .12, .1, R(.6, .9)]);
    const boxes = []; for (let i = 0; i < 3; i++) { const u0 = R(-.05, .9), v0 = R(-.05, .5); boxes.push([u0, v0, u0 + R(.08, .25), v0 + R(.25, .6), R(.35, .7)]) }
    const val = (u, v) => { let c = 0; for (const [a, b, ru, rv, k] of spots) c = Math.max(c, k * Math.exp(-Math.pow((u - a) / ru, 2) - Math.pow((v - b) / rv, 2)));
      for (const [u0, v0, u1, v1, k] of boxes) if (u > u0 && u < u1 && v > v0 && v < v1) c *= 1 - k;
      return c * R(.85, 1.12) };
    const glow = (u, v) => { const e = val(u, v); return e < .2 ? lerp3(deep, edge, e / .2) : e < .45 ? lerp3(edge, w.c, (e - .2) / .25) : e < .75 ? lerp3(w.c, w.mid, (e - .45) / .3) : lerp3(w.mid, w.hot, (e - .75) / .25 * .5) };
    const uv = (x, y) => { const a = wallAt(w.side, x, y); return [(a.Z - w.z0) / (w.z1 - w.z0), (a.Y - w.y0) / (w.y1 - w.y0)] };
    const N = Math.round(area(q) / 14) + 12;
    for (const p of sampleIn(q, N)) { const [u, v] = uv(p[0], p[1]), c = glow(u, v), vert = rnd() < .65, len = R(.12, .35) * sy * (vert ? 1 : .6), ww = clamp(R(.05, .12) * sy * (vert ? Math.min(1, sw / sy * 1.5) : 1), 1.1, 12);
      const path = vert ? [[p[0], p[1] - len / 2], [p[0] + R(-.6, .6), p[1] + len / 2]] : [[p[0] - len / 2, p[1]], [p[0] + len / 2, p[1] + R(-.4, .4)]];
      st('stiff', 'hog', within(seg(path[0], path[1], 3), q), {w: ww, c: tone(c, R(.92, 1.06)), c2: lerp3(c, edge, R(.1, .25)), a: .96}) }
    HOT.push([w, q, cu, cv, uv, sw, sy]) }
  dry();
  // the lights inside: slabs of thick bright paint where the glow is strongest
  for (const [w, q, cu, cv, uv, sw, sy] of HOT) { const n = Math.round(clamp(sw / 2.5, 5, 34)), X = winX(w);
    for (let i = 0; i < n; i++) { const r = Math.pow(rnd(), .7), a = R(0, 6.283), u = clamp(cu + Math.cos(a) * r * .3, .03, .97), v = clamp(cv + Math.sin(a) * r * .35, .03, .92), z = w.z0 + (w.z1 - w.z0) * u, Y = w.y0 + (w.y1 - w.y0) * v, p = proj(X, Y, z), len = R(.05, .15) * sy * (1.2 - r * .6);
      const c = lerp3(lerp3(w.c, w.mid, .7), w.hot, clamp(1.1 - r * 1.2, 0, .8) * R(.55, 1)), ang = 1.57 + R(-.2, .2);
      st('impasto', rnd() < .25 ? 'knife small' : 'bright', within(seg([p[0] - Math.cos(ang) * len / 2, p[1] - Math.sin(ang) * len / 2], [p[0] + Math.cos(ang) * len / 2, p[1] + Math.sin(ang) * len / 2], 2), q), {w: clamp(R(.04, .1) * sy * Math.min(1, sw / sy * 1.3), 1.1, 8), c, a: .96}) } }
  dry();
  stage('Window bars', 'Dark glazing bars over the dry glow, a warm edge on each frame.');
  for (const w of WINS) { const X = winX(w), zm = (w.z0 + w.z1) / 2, q = wq(w.side, w.z0, w.z1, w.y0, w.y1), sw = Math.abs(q[1][0] - q[0][0]);
    const barC = lerp3('umber dark', 'night', .4);
    for (let i = 1; i < w.bars; i++) { const z = w.z0 + (w.z1 - w.z0) * i / w.bars; wallVert(w.side, z, w.y0, w.y1, {b: 'point', w: depthW(z, .04, .8, 3.5), c: barC, a: .92}) }
    const tr = w.y1 - (w.y1 - w.y0) * .22; wallStroke(w.side, tr, w.z0, w.z1, {b: 'point', w: depthW(zm, .04, .8, 3.5), c: barC, a: .92});
    wallStroke(w.side, w.y0 + .3, w.z0, w.z1, {b: 'hog', w: depthW(zm, .08, 1, 5), c: lerp3('umber dark', w.c, .2), a: .85});
    for (const z of [w.z0, w.z1]) wallVert(w.side, z, w.y0, w.y1 + .05, {b: 'point', w: depthW(z, .1, 1, 7), c: barC, a: .95});
    wallStroke(w.side, w.y1, w.z0, w.z1, {b: 'point', w: depthW(zm, .1, 1, 7), c: barC, a: .95});
    wallStroke(w.side, w.y0, w.z0 - .05, w.z1 + .05, {b: 'hog', w: depthW(zm, .16, 1.2, 12), c: lerp3('umber dark', w.c, .15), a: .97});
    // the light the window throws on its own frame and on the pavement in front of it
    wallVert(w.side, w.z1 + .2, .1, w.y1 + .3, {b: 'point', w: depthW(w.z1, .05, .8, 3), c: lerp3(w.mid, 'wall lit', .4), a: .8}) }
  dry();
}

function lampPosts() {
  stage('Lamp posts', 'Iron posts and lanterns, and the bracket lamp on the right; the halo round each light scumbled on dry.');
  const lantern = (X, Y, Z, post) => { const s = F / Z, b = proj(X, 0, Z), h = proj(X, Y, Z);
    if (post) { st('iron', 'point', [[b[0], b[1]], [b[0] + .3, (b[1] + h[1]) / 2], [h[0], h[1] + .35 * s]], {w: .1 * s, pr: [1, .9, .75, .7, .7], a: .97});
      st('iron', 'hog', [[b[0], b[1] + .05 * s], [b[0], b[1] - .4 * s]], {w: .22 * s, a: .97});
      st('iron', 'point', [[h[0] - .14 * s, h[1] + .32 * s], [h[0] + .14 * s, h[1] + .32 * s]], {w: .05 * s, a: .95});
      st('clean', 'point', [[b[0] - .03 * s, b[1] - .1 * s], [h[0] - .03 * s, h[1] + .4 * s]], {w: .02 * s + .3, c: 'amber deep', a: .3}) }
    // the lantern body: a cap, the glass box, a finial
    const cap = [[h[0] - .2 * s, h[1] - .28 * s], [h[0], h[1] - .42 * s], [h[0] + .2 * s, h[1] - .28 * s]];
    st('iron', 'hog', cap, {w: .1 * s, a: .97}); st('iron', 'point', [[h[0], h[1] - .42 * s], [h[0], h[1] - .55 * s]], {w: .04 * s + .5, a: .95});
    st('iron', 'hog', [[h[0] - .12 * s, h[1] + .3 * s], [h[0] + .12 * s, h[1] + .3 * s]], {w: .06 * s, a: .97}) };
  for (const l of LAMPS) lantern(l.X, l.Y, l.Z, true);
  { const l = LANTERN, s = F / l.Z, h = proj(l.X, l.Y, l.Z), wpt = proj(XR, l.Y + .35, l.Z);
    const arm = [wpt, [wpt[0] * .6 + h[0] * .4, wpt[1] - .04 * s], [h[0] + .02 * s, wpt[1]], [h[0], h[1] - .45 * s]];
    st('iron', 'hog', arm, {w: .05 * s, a: .97, raw: true});
    st('iron', 'point', circleArc(wpt[0] - .2 * s, wpt[1] + .25 * s, .2 * s, -1.4, 1.2, 8), {w: .03 * s, a: .9});
    st('iron', 'hog', [proj(XR, l.Y + .1, l.Z), proj(XR, l.Y + .6, l.Z)], {w: .08 * s, a: .97});
    lantern(l.X, l.Y, l.Z, false) }
  dry();
}

function figure(f) {
  const s = F / f.Z, g = proj(f.X, 0, f.Z), P2 = (dx, Y) => [g[0] + (dx + f.lean * Y) * s, g[1] - Y * s * f.h / 1.7], fz = fog(f.Z) * .6;
  const dk = lerp3(f.coat, 'violet grey', fz), lit = lightAt(f.X + f.side * .3, 1.2, f.Z), rimC = lerp3(lit.c, 'hot', .25);
  // legs, one in mid-stride, the heel lifted
  const st1 = f.step, ph = Math.sin(st1 * 6.283);
  st('figure', 'point', [P2(-.08, .82), P2(-.09 - ph * .03, .42), P2(-.1 - ph * .05, .02)], {w: .12 * s, pr: [1, .9, .7], c: dk, a: .97});
  st('figure', 'point', [P2(.08, .82), P2(.1 + ph * .03, .45), P2(.12 + ph * .04, .12)], {w: .12 * s, pr: [1, .9, .7], c: tone(dk, .8), a: .97});
  st('figure', 'hog', [P2(-.14 - ph * .05, .03), P2(-.06 - ph * .05, .02)], {w: .07 * s, c: 'night', a: .97});
  st('figure', 'hog', [P2(.07 + ph * .04, .14), P2(.16 + ph * .04, .1)], {w: .06 * s, c: 'night', a: .97});
  // coat: a silhouette filled with short strokes along its length, the hem swinging
  const coat = [P2(-.1, 1.53), P2(-.19, 1.48), P2(-.24, 1.36), P2(-.25, 1.0), P2(-.3 - ph * .02, .64), P2(.3 + ph * .03, .62), P2(.26, 1.0), P2(.24, 1.36), P2(.19, 1.48), P2(.1, 1.53)];
  fl('figure', {curve: PT(coat)}, {c: tone(dk, .85)});
  for (let i = 0; i < 12; i++) { const u = R(-.22, .22), y0 = R(.66, 1.1), y1 = Math.min(1.5, y0 + R(.35, .7)), path = within(seg(P2(u, y1), P2(u * 1.1, y0), 4), coat);
    st('figure', 'hog', path, {w: R(.05, .09) * s, c: tone(dk, R(.75, 1.1)), c2: tone(dk, .6), a: .9}) }
  st('figure', 'bright', [P2(-.29, .66), P2(.29 + ph * .03, .64)], {w: .05 * s, c: tone(dk, .7), a: .95});
  // head and collar under the umbrella, the arm up to the handle
  st('figure', 'hog', [P2(0, 1.48), P2(0, 1.56)], {w: .1 * s, c: tone(dk, .75), a: .98});
  dot('figure', ...P2(0, 1.61), .085 * s, {c: tone(dk, .8), soft: .3});
  for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, y0 = R(.7, 1.2); st('figure', 'bright', [P2(sd * R(.22, .27), y0 + R(.2, .3)), P2(sd * R(.25, .31), y0)], {w: R(.03, .06) * s, c: tone(dk, R(.7, .95)), a: .95}) }
  st('figure', 'point', [P2(.18, 1.4), P2(.16, 1.22), P2(.04, 1.3)], {w: .09 * s, c: tone(dk, .9), a: .97});
  // rim light: broken touches just inside the side that faces the light
  for (let i = 0; i < 6; i++) { const y0 = R(.68, 1.4), y1 = y0 + R(.08, .22), xo = f.side * (.23 + .05 * (y0 < 1 ? (1 - y0) / .36 : 0));
    st('impasto', 'point', [P2(xo, y1), P2(xo + f.side * .02, y0)], {w: .025 * s + .4, c: rimC, a: R(.5, .85) * (.5 + .5 * clamp(lit.s, 0, 1))}) }
  for (let i = 0; i < 2; i++) { const y0 = R(.1, .5); st('impasto', 'point', [P2(f.side * .14, y0 + .15), P2(f.side * .15, y0)], {w: .02 * s + .3, c: rimC, a: .5}) }
  // the umbrella: canopy, scalloped rim, ribs, tip; wet sheen along the top
  const top = 2.12, rim = 1.8, hw = .56, cp = []; for (let i = 0; i <= 10; i++) { const u = -1 + 2 * i / 10; cp.push(P2(u * hw, rim + (top - rim) * Math.sqrt(1 - u * u * .92))) }
  const sc = []; for (let i = 0; i <= 8; i++) { const u = -1 + 2 * i / 8; sc.push(P2(u * hw, rim + (i % 2 ? .05 : -.02) - .04 * (1 - u * u))) }
  const canopy = cp.concat(sc.slice().reverse()); const name = 'umbrella ' + FIG.indexOf(f); doc.shapes[name] = PT(canopy);
  for (let i = 0; i < 4; i++) { const Y = rim + (top - rim) * (i + .4) / 4.2, k = Math.sqrt(Math.max(0, 1 - Math.pow((Y - rim) / (top - rim), 2))) * hw + .08, bow = (top - rim) * .25;
    st('figure', 'bright', [P2(-k, Y - bow), P2(0, Y + bow * .4), P2(k, Y - bow)], {w: (top - rim) / 4 * s * 1.9, c: tone(lerp3(f.umb, 'violet grey', fz), R(.8, 1.15) * (1 - i * .06)), c2: tone(f.umb, .7), grad: 1, a: .98, clip: name}) }
  st('figure', 'point', sc, {w: .04 * s + .4, c: tone(f.umb, .6), a: .9});
  for (const u of [-.5, 0, .5]) st('figure', 'point', [P2(0, top), P2(u * hw * .9, rim + .1)], {w: .02 * s + .3, c: tone(f.umb, .55), a: .6, clip: name});
  st('figure', 'point', [P2(0, top), P2(0, top + .14)], {w: .025 * s + .4, c: 'night', a: .95});
  st('figure', 'point', [P2(.02, 1.26), P2(0, rim)], {w: .025 * s + .3, c: 'night', a: .9});
  const hi = cp.slice(f.side < 0 ? 1 : 5, f.side < 0 ? 6 : 10);
  for (let i = 0; i + 2 < hi.length; i += 2) st('impasto', 'point', jit(hi.slice(i, i + 3), .3), {w: .04 * s + .5, c: lerp3(f.umbHi, 'hot', R(0, .35)), a: R(.6, .9), pr: 'taper'});
  st('figure', 'point', jit(cp.slice(2, 9), .3), {w: .025 * s + .3, c: lerp3(f.umb, f.umbHi, .5), a: .5});
  return {g, s}
}
function figures() {
  stage('Figures', 'Three people under umbrellas walking away into the glow (their reflections are already in the wet road).');
  const order = FIG.slice().sort((a, b) => b.Z - a.Z);
  for (const f of order) figure(f);
  dry();
}

function brightReflections() {
  stage('Reflections, thick', 'The long reflections of the lamps and windows: short drags of a loaded knife that skips over the cobbles, densest near the mirrored light; bright touches where they are strongest.');
  const strong = BLOBS.filter(b => b.s > .3 && b.wx < 30);
  for (const B of strong) { const n = Math.round(clamp(B.s * B.wx * 3, 10, 70));
    for (let i = 0; i < n; i++) { const gx = (rnd() + rnd() + rnd() - 1.5) * 1.1, x = B.x + gx * B.wx * .55, y = rnd() < .2 ? B.y - R(0, 1) * B.up : B.y + Math.pow(rnd(), 1.6) * B.down * 1.4;
      if (y < B.base + 2 || y > 1005) continue; const gc = groundCol(x, y); if (gc.s < .3) continue; const Z = F * EYE / (y - VPy);
      const c = lerp3(gc.c, 'hot', clamp(gc.s - .7, 0, .7) * R(.4, 1)), vert = rnd() < .18 && Math.abs(y - B.y) < B.down * .4;
      if (vert) { const len = R(4, 14); st('impasto', 'bright', [[x, y - len / 2], [x + R(-.6, .6), y + len / 2]], {w: clamp(B.wx * R(.2, .5), 1.2, 9), c, a: .95}) }
      else { const len = clamp(R(.5, 1.5) * B.wx, 2, 28), th = clamp(960 * R(.025, .06) / (Z * Z), .9, 5.5); st('impasto', rnd() < .5 ? 'knife small' : 'bright', [[x - len / 2, y + R(-.4, .4)], [x + len / 2, y + R(-.4, .4)]], {w: th, c, a: .95}) } } }
  // glints: light caught on the wet tops of the stones inside the reflections
  const cand = sampleIn(GROUND, 14000).filter(p => p[1] > VPy + 6).map(p => [p[0], p[1], groundCol(p[0], p[1])]).filter(q => q[2].s > .5 && rnd() < (q[2].s - .4) * .4);
  for (const [x, y, gc] of cand) { const g = groundAt(x, y), len = clamp(R(.05, .2) * F / g.Z, 2, 24), w = clamp(960 * R(.02, .05) / (g.Z * g.Z), .9, 5);
    st('impasto', 'bright', [[x - len / 2, y + R(-.3, .3)], [x + len / 2, y + R(-.5, .5)]], {w, c: lerp3(gc.c, 'hot', clamp(gc.s - .4, 0, .8) * R(.5, 1)), a: .95}) }
  dry();
}

function lights() {
  stage('The lights', 'Lantern glass in thick enamel-bright paint, the window centres pushed hotter, the lit fanlights.');
  const glass = (X, Y, Z, k) => { const s = F / Z, h = proj(X, Y, Z);
    const box = [[h[0] - .15 * s, h[1] - .27 * s], [h[0] + .15 * s, h[1] - .27 * s], [h[0] + .11 * s, h[1] + .28 * s], [h[0] - .11 * s, h[1] + .28 * s]];
    for (let i = 0; i < 3; i++) { const u = (i - 1) / 1.6; st('impasto', s > 40 ? 'knife small' : 'bright', [[h[0] + u * .13 * s, h[1] - .25 * s], [h[0] + u * .1 * s, h[1] + .25 * s]], {w: .12 * s, c: i === 1 ? 'hot' : lerp3('glow', 'hot', .4), a: .99}) }
    dot('lamp glass', h[0], h[1] + .04 * s, .055 * s, {dome: 1, c: '#fff3c4'});
    return box };
  const boxes = [];
  for (const l of LAMPS) boxes.push([glass(l.X, l.Y, l.Z, l.s), F / l.Z, proj(l.X, l.Y, l.Z)]);
  boxes.push([glass(LANTERN.X, LANTERN.Y, LANTERN.Z, 1), F / LANTERN.Z, proj(LANTERN.X, LANTERN.Y, LANTERN.Z)]);
  for (const w of WINS.slice(0, 7)) { const X = winX(w), zc = w.z0 + (w.z1 - w.z0) * R(.35, .65), s = F / zc, p = proj(X, w.y0 + (w.y1 - w.y0) * .38, zc);
    for (let i = 0; i < 4; i++) { const dx = R(-.12, .12) * s * Math.abs(X - CAMX) / zc, y0 = p[1] + R(-.25, .2) * s; st('impasto', 'bright', [[p[0] + dx, y0], [p[0] + dx + R(-.5, .5), y0 + R(.06, .16) * s]], {w: clamp(.05 * s * Math.abs(X - CAMX) / zc * 2, 1, 5), c: lerp3(w.mid, w.hot, R(.5, .85)), a: .95}) } }
  dry('still');
  for (const [box, s, h] of boxes) { st('iron', 'point', [box[0], box[3]], {w: .035 * s + .4, a: .95}); st('iron', 'point', [box[1], box[2]], {w: .035 * s + .4, a: .95});
    st('iron', 'point', [[h[0], h[1] - .27 * s], [h[0], h[1] + .28 * s]], {w: .02 * s + .3, a: .7}) }
  dry();
}

function rain() {
  stage('Rain', 'The rain: fine slanting streaks, lit warm where they fall through the light; splashes in the reflections.');
  const ang = Math.PI / 2 + .2;
  for (let i = 0; i < 420; i++) { const x = R(-20, 820), y = R(-20, 990), len = R(10, 34), lt = Math.max(...LAMPS.map(l => { const p = proj(l.X, l.Y, l.Z), s = F / l.Z; return Math.exp(-Math.hypot(x - p[0], y - p[1]) / (1.4 * s)) }), 0);
    const near = rnd() < .2, c = lerp3('rain', 'glow', clamp(lt * 1.3, 0, 1));
    st('clean', 'rigger', [[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len]], {w: near ? R(.9, 1.4) : R(.5, .9), c, a: (near ? R(.25, .45) : R(.12, .3)) + lt * .35}) }
  // splashes: tiny rings in the brightest reflections
  const cand = sampleIn(GROUND, 6000).filter(p => p[1] > 620).map(p => [p[0], p[1], groundCol(p[0], p[1])]).filter(q => q[2].s > .5 && rnd() < .3);
  for (const [x, y, gc] of cand) { const g = groundAt(x, y), r = clamp(R(.03, .07) * F / g.Z, 1.2, 7);
    st('clean', 'point', circleArc(x, y, r, R(3.3, 3.7), R(5.7, 6.1), 6).map(p => [p[0], y + (p[1] - y) * .35]), {w: R(.5, 1), c: lerp3(gc.c, 'hot', .5), a: .8}) }
}

/* =====================================================================
   THE PAINTING
   ===================================================================== */
underpainting();
sky();
facades();
structure();
street();
cobbles();
shopWindows();
lampPosts();
figures();
brightReflections();
lights();
rain();

const problems = P.check(doc);
if (problems.length) { console.error(problems.length + ' problems\n  - ' + problems.slice(0, 20).join('\n  - ')); process.exit(1) }
const J = v => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
const line = q => q.do ? '      {"with": ' + J(q.with) + ', "do": [\n' + q.do.map(m => '        ' + J(m)).join(',\n') + '\n      ]}' : '      ' + J(q);
const body = doc.steps.map(s => '    {"name": ' + JSON.stringify(s.name) + (s.note ? ', "note": ' + JSON.stringify(s.note) : '') + ', "do": [\n' + s.do.map(line).join(',\n') + '\n    ]}').join(',\n');
const head = Object.assign({}, doc); delete head.steps;
const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "steps": [\n' + body + '\n  ]\n}\n');
JSON.parse(text);
writeFileSync(join(dir, 'rain.json'), text);
let count = 0; const walk = l => l.forEach(s => s.do ? walk(s.do) : count += s.paths ? s.paths.length : s.dots ? s.dots.length : 1); walk(doc.steps);
console.log('rain.json  ' + (text.length / 1024).toFixed(0) + ' kB  ' + doc.steps.length + ' stages, ' + count + ' marks');
