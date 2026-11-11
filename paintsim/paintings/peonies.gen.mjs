// node paintings/peonies.gen.mjs   →   paintings/peonies.json
//
// "Alla prima oil painting of pink and white peonies in a glazed celadon vase, a few fallen petals on the table, soft grey-green
//  background with loose brushwork, daylight from a window on the left, thick creamy highlights on the petals, painterly and fresh."
//
// Composed here by rule and by seeded chance, and written out as an ordinary painting document. Infrastructure (engine loading,
// seeded chance, palette, writers, final check) follows paintings/magpie.gen.mjs.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {spline, arc, circleArc, lerp, clamp, smooth, fbm} = P.util;

/* ---------- chance, with a seed ---------- */
let seed = 5121107;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;

/* ---------- the palette: every colour mixed from pigments ---------- */
const MIX = {
  // the wall: soft grey-greens, warmer near the window, cooler and darker away from it
  'wall light': {mix: {'titanium white': 3, 'terre verte': 1.5, "payne's grey": .15, 'raw umber': .1}},
  'wall warm': {mix: {'titanium white': 3, 'terre verte': 1.2, 'yellow ochre': .25, 'raw umber': .2}},
  'wall cool': {mix: {'titanium white': 3, 'terre verte': 1, "payne's grey": .4, 'cerulean': .1}},
  'wall mid': {mix: {'titanium white': 2, 'terre verte': 2, "payne's grey": .25, 'raw umber': .25}},
  'wall dark': {mix: {'titanium white': .8, 'terre verte': 2, "payne's grey": .5, 'raw umber': .6}},
  'wall deep': {mix: {'titanium white': .35, 'terre verte': 2, "payne's grey": .7, 'raw umber': .9}},
  // the table
  'table': {mix: {'raw umber': 1, 'titanium white': 1.6, 'burnt sienna': .15, 'yellow ochre': .2}},
  'table light': {mix: {'raw umber': 1, 'titanium white': 3.5, 'naples yellow': .5}},
  'table dark': {mix: {'raw umber': 1.2, 'titanium white': .6, 'ultramarine': .15, 'burnt sienna': .1}},
  'table deep': {mix: {'raw umber': 1.2, 'titanium white': .25, 'ultramarine': .3, 'burnt umber': .3}},
  // the lay-in
  'umber wash': {mix: {'raw umber': 2, 'terre verte': 1}},
  // pink peonies
  'pink hi': {mix: {'titanium white': 8, 'rose madder': .6, 'naples yellow': .5}},
  'pink light': {mix: {'titanium white': 4, 'rose madder': 1, 'naples yellow': .3}},
  'pink mid': {mix: {'rose madder': 2, 'titanium white': 2.8, 'alizarin crimson': .1, 'naples yellow': .2}},
  'pink deep': {mix: {'alizarin crimson': 1, 'rose madder': 1, 'titanium white': .6, 'terre verte': .12}},
  'pink shadow': {mix: {'rose madder': 1.5, 'alizarin crimson': .5, 'titanium white': 1.2, 'ultramarine': .08, 'raw umber': .1}},
  'pink dusk': {mix: {'alizarin crimson': .6, 'rose madder': .8, 'raw umber': .15, 'ultramarine': .12, 'titanium white': .5}},
  // white peonies
  'white hi': {mix: {'titanium white': 10, 'naples yellow': .6}},
  'cream': {mix: {'titanium white': 5, 'naples yellow': 1, 'rose madder': .05}},
  'blush': {mix: {'titanium white': 8, 'rose madder': .5, 'naples yellow': .4}},
  'white shadow': {mix: {'titanium white': 2.5, "payne's grey": .15, 'rose madder': .05, 'yellow ochre': .1}},
  'white dusk': {mix: {'titanium white': 1, "payne's grey": .35, 'rose madder': .12, 'raw umber': .3}},
  'white night': {mix: {'titanium white': .8, "payne's grey": .5, 'rose madder': .14, 'raw umber': .45, 'terre verte': .2}},
  'pocket': {mix: {'alizarin crimson': .6, 'dioxazine violet': .15, 'burnt umber': .3, 'rose madder': .5, 'titanium white': .3}},
  // leaves and buds
  'leaf deep': {mix: {'sap green': 1.2, 'prussian blue': .3, 'burnt umber': .8}},
  'leaf dusk': {mix: {'sap green': 1, 'terre verte': 1, "payne's grey": .6, 'raw umber': .5, 'titanium white': .3}},
  'leaf': {mix: {'sap green': 1, 'terre verte': 1.5, "payne's grey": .3, 'titanium white': .2}},
  'leaf lit': {mix: {'terre verte': 2, 'sap green': .5, 'titanium white': 1, "payne's grey": .1}},
  'leaf sheen': {mix: {'titanium white': 2, 'terre verte': .6, 'cerulean': .15}},
  // the celadon vase
  'cel hi': {mix: {'titanium white': 6, 'terre verte': .4, 'cerulean': .1}},
  'cel light': {mix: {'terre verte': 2, 'viridian': .3, 'titanium white': 3, 'yellow ochre': .2}},
  'cel mid': {mix: {'terre verte': 2, 'viridian': .3, 'titanium white': 1.2, "payne's grey": .2}},
  'cel dark': {mix: {'terre verte': 1, 'viridian': .5, "payne's grey": .5, 'raw umber': .3}},
  'cel deep': {mix: {'terre verte': 1, 'viridian': .4, "payne's grey": .8, 'raw umber': .6}},
  'cel warm': {mix: {'terre verte': 2, 'titanium white': 2, 'yellow ochre': .5, 'raw sienna': .15}},
  'foot': {mix: {'burnt sienna': 1, 'titanium white': 1, 'raw umber': .3}}
};
const CC = new Map();
const C = c => { if (typeof c !== 'string') return c; let v = CC.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); CC.set(c, v) } return v };
const lerp3 = (a, b, t) => { a = C(a); b = C(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
const hex = c => P.hex(C(c));
// a colour from a ramp of palette tones, t in 0..1
const ramp = (list, t) => { t = clamp(t, 0, 1) * (list.length - 1); const i = Math.min(list.length - 2, Math.floor(t)); return lerp3(list[i], list[i + 1], t - i) };

/* ---------- the document ---------- */
const doc = {
  paintsim: 1, engine: P.VERSION, title: 'Peonies in a celadon vase',
  note: 'Pink and white peonies in a glazed celadon vase, fallen petals on the table, a grey-green wall, daylight from a window on the left. Alla prima oil on a toned canvas. Written by paintings/peonies.gen.mjs.',
  size: [800, 1000], ground: 'toned canvas',
  // the photograph of the painting: soft daylight from the upper left, a little warm, with a cool fill; a gentle vignette
  light: {base: 'window', exposure: 1.08, shoulder: .45, lamps: [{azimuth: 200, elevation: 34, strength: .78, color: '#fff4e6'}, {ambient: true, strength: .24, color: '#e8efff'}], lens: {vignette: .3, contrast: .1}},
  seed: 5121107,
  define: {
    pigments: MIX,
    materials: {
      'lay-in': {base: 'oil', note: 'thin colour scrubbed in with turpentine', body: .2, opacity: .6, ridges: .35, dry: .5, open: .3, merge: 0, pickup: 0, gloss: .08, bury: .3},
      'wall': {base: 'oil', note: 'the background, laid loosely with a big brush', body: .6, ridges: .12, grain: .03, gloss: .2, open: .9, merge: .3, pickup: .03},
      'table': {base: 'oil', note: 'the table top, laid flat and wide', body: .45, level: .35, ridges: .12, grain: .03, gloss: .25, open: .9, merge: .3, pickup: .03},
      'paint': {base: 'oil', note: 'ordinary body colour, worked wet into wet', body: 1, gloss: .3, merge: .18, pickup: .02},
      'leafy': {base: 'oil', note: 'leaf greens: a little more oil, so they have a sheen', body: .9, ridges: .22, grain: .04, gloss: .26, sharp: .45, merge: .2, pickup: .025},
      'petal': {base: 'oil', note: 'thick flower paint, worked into itself', body: 1.2, ridges: .08, grain: .05, gloss: .32, merge: .16, pickup: .02, bury: .7},
      'clean': {base: 'oil', note: 'a clean loaded brush: lies on top of what is beneath', body: 1.05, gloss: .32, merge: 0, pickup: 0, bury: .8},
      'impasto': {base: 'oil', note: 'thick creamy lights, straight from the tube', body: 1.75, ridges: .18, grain: .04, gloss: .38, sharp: .5, merge: 0, pickup: 0, bury: .95, dry: .2},
      'glaze': {base: 'oil glaze', note: 'transparent colour in medium over dry paint', opacity: .4},
      'celadon': {base: 'oil', note: 'the glazed pot: paint with more oil in it, so it shines; a fine crackle in the glaze', body: .4, bury: .9, ridges: .05, grain: .02, level: .9, gloss: .55, sharp: .62, merge: .25, pickup: .03,
        texture: [{mask: 'cells', scale: 7, width: .025, warp: .6, color: '#4f6656', mix: .22, height: -.12}]},
      'celadon hi': {base: 'celadon', note: 'the window caught in the glaze', body: 1.3, level: .25, gloss: .7, sharp: .75, merge: 0, pickup: 0, bury: .9}
    },
    brushes: {
      'bristle': {base: 'flat', note: 'a worn hog flat for the wall', width: 40, rag: 6, wobble: .8, var: .15, streak: .8},
      'big': {base: 'filbert', note: 'a big soft filbert for the wall', clump: 4, streak: .6, wobble: 1.6, var: .2, vary: .05},
      'scrub': {base: 'flat', note: 'a stiff brush scrubbing thin colour', width: 30, rag: 8, dry: .4, wobble: .8},
      'wide': {base: 'filbert', note: 'a big filbert', clump: 3.2, wobble: 1, var: .2, vary: .06},
      'petal': {base: 'filbert', note: 'one touch, one petal', clump: 2.8, streak: .9, wobble: .7, var: .2},
      'flatp': {base: 'flat', note: 'a small flat for crisp petal planes', width: 14, rag: 2.5, wobble: .4, taper: .35},
      'edge': {base: 'round', note: 'the point of a round', profile: 'taper', wobble: .35},
      'comma': {base: 'round', profile: 'comma', wobble: .3},
      'dry': {base: 'flat', note: 'a nearly dry brush dragged over the ridges', dry: .75, charge: .5, streak: 1.6, wobble: .8, rag: 6},
      'dry round': {base: 'filbert', note: 'a nearly dry filbert', dry: .72, charge: .55, streak: 1.5, wobble: .8},
    }
  },
  shapes: {}, steps: []
};

/* ---------- writing steps (as in the magpie) ---------- */
let cur = null, grp = null;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100;
const PT = pts => pts.map(p => [n1(p[0]), n1(p[1])]);
const colOf = c => typeof c === 'string' && c[0] === '#' ? c : hex(c);
function stage(name, note) { cur = {name, do: []}; if (note) cur.note = note; doc.steps.push(cur); grp = null }
function put(shared, step) { const key = JSON.stringify(shared); if (!grp || grp.key !== key) { grp = {key, node: {with: shared, do: []}}; cur.do.push(grp.node) } grp.node.do.push(step) }
let marks = 0;
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
  put({material, brush}, s); marks++;
}
function fl(material, shape, o = {}) {
  const s = {shape: Array.isArray(shape) && typeof shape[0][0] === 'number' ? PT(shape) : shape};
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.c2 !== undefined) s.color2 = colOf(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  for (const k of ['soft', 'uneven', 'scale', 'angle']) if (o[k] !== undefined) s[k] = n2(o[k]);
  if (o.clip !== undefined) s.clip = o.clip;
  put({material}, s); marks++;
}
function dots(material, list, o = {}) {
  if (!list.length) return;
  const s = list.length === 1 ? {at: [n1(list[0][0]), n1(list[0][1])], r: n2(list[0][2])} : {dots: list.map(d => [n1(d[0]), n1(d[1]), n2(d[2])])};
  if (o.c !== undefined) s.color = colOf(o.c);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.soft !== undefined) s.soft = n2(o.soft);
  if (o.dome !== undefined) s.dome = n2(o.dome);
  put({material}, s); marks += list.length;
}
const dry = (v = true) => { cur.do.push({dry: v}); grp = null };

/* ---------- geometry ---------- */
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }
const PETALPR = [[.55, 1, 1, .9, .6], [.7, 1, .95, .5], [.4, .9, 1, 1, .8], [.8, 1, 1, .7]];
const prof = (f, n = 12) => Array.from({length: n + 1}, (_, i) => Math.max(0, f(i / n)));
// a stroke from a centre, in a direction, curving
const strokeAt = (x, y, ang, len, curv, n = 5) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);

/* =====================================================================
   THE SET-UP
   ===================================================================== */
const TABLE_Y = 742;                                     // the back edge of the table
const VX = 398, VTOP = 598, VFOOT = 880;                  // the vase
const vprof = [[598, 66], [606, 60], [622, 50], [646, 74], [672, 104], [700, 121], [724, 126], [752, 122], [790, 108], [828, 90], [858, 76], [872, 72], [880, 73]];
const VPS = spline(vprof.map(p => [p[1], p[0]]), 12);   // the profile as a smooth curve (x = half width, y = height)
const hw = y => { if (y <= VPS[0][1]) return VPS[0][0]; for (let i = 0; i < VPS.length - 1; i++) if (y <= VPS[i + 1][1]) { const k = (y - VPS[i][1]) / ((VPS[i + 1][1] - VPS[i][1]) || 1); return VPS[i][0] + (VPS[i + 1][0] - VPS[i][0]) * k } return VPS[VPS.length - 1][0] };
const vaseOutline = (() => { const L = [], Rr = []; for (let y = VTOP; y <= VFOOT; y += 4) { L.push([VX - hw(y), y]); Rr.push([VX + hw(y), y]) }
  const bot = []; for (let i = 1; i < 16; i++) { const a = Math.PI * i / 16; bot.push([VX + Math.cos(a) * hw(VFOOT), VFOOT + Math.sin(a) * 10]) }
  const lip = []; for (let i = 1; i < 16; i++) { const a = -Math.PI * i / 16; lip.push([VX + Math.cos(a) * hw(VTOP), VTOP + Math.sin(a) * 9]) }
  return L.concat(bot.reverse(), Rr.reverse(), lip) })();
doc.shapes['vase'] = PT(vaseOutline);
const inVase = (x, y) => inPoly(x, y, vaseOutline);

// the flowers, back to front: centre, radius, squash of the face (k), turn of the face (rot), colour, how far open
const FL = [
  {x: 586, y: 286, r: 78, k: .8, rot: .45, kind: 'blush', open: .85},
  {x: 452, y: 262, r: 70, k: .78, rot: -.2, kind: 'white', open: .8},
  {x: 530, y: 468, r: 112, k: .78, rot: .3, kind: 'pink', open: 1},
  {x: 330, y: 418, r: 126, k: .8, rot: -.35, kind: 'white', open: 1},
  {x: 646, y: 628, r: 68, k: .66, rot: .95, kind: 'pink', open: .75},
  {x: 236, y: 584, r: 86, k: .68, rot: -.8, kind: 'deep', open: .92}
];
const BUDS = [{x: 186, y: 304, r: 26, ang: -2.3, kind: 'pink'}, {x: 694, y: 404, r: 21, ang: -.55, kind: 'green'}, {x: 380, y: 198, r: 22, ang: -2.0, kind: 'blush'}, {x: 152, y: 478, r: 18, ang: -2.7, kind: 'green'}];
const CENTER = [430, 470];
const inMass = (x, y, pad = 0) => FL.some(f => { const dx = (x - f.x) / (f.r + pad), dy = (y - f.y) / (f.r * .92 + pad); return dx * dx + dy * dy < 1 }) || BUDS.some(b => Math.hypot(x - b.x, y - b.y) < b.r + pad);

// the light: a window on the left, a little above
const LV = (() => { const v = [-.78, -.42, .46], l = Math.hypot(...v); return v.map(c => c / l) })();

/* the face of a flower: an ellipse turned by rot; f is the fraction of the radius */
function ellPt(F, th, f) { const c = Math.cos(F.rot), s = Math.sin(F.rot), u = Math.cos(th) * F.r * f, v = Math.sin(th) * F.r * f * F.k; return [F.x + u * c - v * s, F.y + u * s + v * c] }
function ellTan(F, th) { const c = Math.cos(F.rot), s = Math.sin(F.rot), du = -Math.sin(th), dv = Math.cos(th) * F.k; return Math.atan2(du * s + dv * c, du * c - dv * s) }
function ell(F, a0, a1, f, n = 8, bulge = 0) { const p = []; for (let i = 0; i <= n; i++) { const t = i / n, th = a0 + (a1 - a0) * t; p.push(ellPt(F, th, f * (1 + bulge * Math.sin(Math.PI * t)))) } return p }
// the heart of a bloom sits toward the top of its face
const heartOf = F => { const s = .2; return [F.x + Math.cos(F.rot - 1.7) * F.r * s * .4, F.y - F.r * s * F.k * .9] };

/* =====================================================================
   1. THE LAY-IN — thin umber drawing and shadow masses on the toned canvas
   ===================================================================== */
function layIn() {
  stage('Lay-in', 'Thin umber and terre verte, scrubbed in: where the masses sit and where the shadows fall.');
  for (let y = VTOP + 10; y < VFOOT; y += 14) { const h = hw(y); st('lay-in', 'scrub', [[VX + h * .1, y], [VX + h * .95, y + 3]], {w: 16, c: 'umber wash', a: .45}) }
  st('lay-in', 'edge', vaseOutline.filter((_, i) => i % 5 === 0), {w: 2.2, c: 'umber wash', a: .5});
  for (const f of FL) { for (let i = 0; i < 5; i++) { const a0 = R(-.5, 1.2), a1 = a0 + R(1.4, 2.6), rr = f.r * R(.55, .95);
      st('lay-in', 'scrub', ell(f, a0, a1, rr / f.r, 9), {w: f.r * R(.25, .4), c: 'umber wash', a: .35}) }
    st('lay-in', 'edge', ell(f, 0, 6.4, 1, 18), {w: 2, c: 'umber wash', a: .4}) }
  st('lay-in', 'edge', [[-10, TABLE_Y + 1], [400, TABLE_Y - 1], [810, TABLE_Y + 2]], {w: 2.5, c: 'umber wash', a: .45});
  for (let i = 0; i < 6; i++) st('lay-in', 'scrub', [[VX + 30, VFOOT - 4 + i * 4], [VX + 260 - i * 20, VFOOT - 20 + i * 5]], {w: 14, c: 'umber wash', a: .4});
}

/* =====================================================================
   2. THE WALL AND THE TABLE
   ===================================================================== */
function wallLight(x, y) {
  // daylight falls across the wall from the window on the left, strongest high up near it
  let L = .3 + .42 * Math.pow(clamp(1 - x / 800, 0, 1), 1.3) - .2 * (y / TABLE_Y) + .22 * Math.exp(-Math.hypot(x + 60, y - 160) / 300);
  // the shadow of the bunch on the wall: the same shapes, thrown to the right and a little down, soft at the edge
  let sh = 0; for (const f of FL) { const dx = (x - f.x - 95) / (f.r * 1.35), dy = (y - f.y - 40) / (f.r * 1.25); sh = Math.max(sh, smooth((1.25 - Math.hypot(dx, dy)) / .7)) }
  for (const [lx, ly, lr] of [[640, 470, 110], [700, 600, 90], [520, 300, 90]]) sh = Math.max(sh, .7 * smooth((1.2 - Math.hypot(x - lx - 80, y - ly - 30) / lr) / .7));   // the foliage
  const vx = (x - VX - 110) / 150, vy = (y - 690) / 110; sh = Math.max(sh, .85 * smooth((1.2 - Math.hypot(vx, vy)) / .7));
  L -= .34 * sh;
  L += (fbm(x / 160 + 3, y / 160 + 7, 3) - .5) * .18;
  return clamp(L, 0, 1);
}
const WALL = ['wall deep', 'wall dark', 'wall mid', 'wall light'];
function wallCol(x, y, j = .05) {
  const L = clamp(wallLight(x, y) + gauss() * j, 0, 1), c = ramp(WALL, L * .88);
  const r = rnd(); return r < .25 ? lerp3(c, 'wall warm', .4 * L) : r < .5 ? lerp3(c, 'wall cool', .35) : c;
}
const clipWall = p => p.map(q => [q[0], Math.min(q[1], TABLE_Y + 3)]);
function wall() {
  stage('The wall', 'Grey-green, laid loosely with a big brush: light by the window, cooler and darker where the bunch throws its shadow.');
  // a thin first coat that already holds the light and the shadow, left to set so that the strokes over it keep their value
  fl('lay-in', {rect: [-5, -5, 805, TABLE_Y + 6]}, {c: ramp(WALL, .42), a: .95, uneven: .3, scale: 120});
  for (let i = 0; i < 90; i++) { const x = R(-40, 840), y = R(-40, TABLE_Y + 20), L = wallLight(x, y);
    fl('lay-in', {ellipse: [n1(x), n1(y), n1(R(70, 120)), n1(R(50, 90)), n1(R(-50, 10))]}, {c: ramp(WALL, L * .88), a: .9, soft: 30, uneven: .3, scale: 80}) }
  dry('still');
  // big strokes everywhere above the table, rows from the top so they overlap like a hand works down; the hand mostly sweeps one way
  for (let y = -30; y < TABLE_Y + 30; y += 38) for (let x = R(-80, -20); x < 860;) {
    const len = R(150, 280), ang = rnd() < .7 ? R(-1.05, -.45) : R(1.25, 1.85), cx = x + len * .4, cy = y + R(-15, 15), c = wallCol(cx, cy, .04);
    st('wall', rnd() < .6 ? 'bristle' : 'big', clipWall(strokeAt(cx, cy, ang, len, R(-.35, .35), 5)), {w: R(60, 110), c, c2: lerp3(c, rnd() < .5 ? 'wall light' : 'wall mid', R(.05, .16)), a: .96, load: len * R(1.5, 3), pr: [.5, 1, 1, 1, .8]});
    x += len * R(.45, .7) }
  // a soft clean brush through the far corners, so that the wall goes quiet away from the flowers
  for (let i = 0; i < 26; i++) { const x = rnd() < .5 ? R(-20, 260) : R(560, 820), y = R(-20, 300) + (rnd() < .3 ? R(300, 500) : 0); if (inMass(x, y, 60)) continue;
    st('wall', 'blender', strokeAt(x, y, R(-1, -.4), R(120, 220), R(-.3, .3), 4), {w: R(50, 90), a: .6}) }
  // looser, smaller strokes that keep it moving: cutting in round the bunch
  for (let i = 0; i < 260; i++) { const x = R(-20, 820), y = R(-20, TABLE_Y - 5); if (inMass(x, y, -10)) continue;
    const nearB = inMass(x, y, 70); if (!nearB && rnd() < .75) continue;
    const ang = nearB ? Math.atan2(y - CENTER[1], x - CENTER[0]) + 1.57 + R(-.5, .5) : R(-1.1, -.4), len = R(50, 130), c = wallCol(x, y, .06);
    st('wall', rnd() < .25 ? 'dry' : 'bristle', clipWall(strokeAt(x, y, ang, len, R(-.6, .6), 5)), {w: R(18, 44), c, c2: lerp3(c, 'wall light', R(0, .12)), a: R(.85, .97), load: len * R(1, 1.8)}) }
}
function tableLight(x, y, cast = true) { let L = .6 + .22 * (1 - x / 800) - .12 * smooth((y - 900) / 100) + (fbm(x / 150, y / 50 + 4, 3) - .5) * .16; if (!cast) return clamp(L, 0, 1);
  const sx = (x - VX - 160) / 190, sy = (y - VFOOT + 4) / 30; L -= .4 * Math.exp(-(sx * sx + sy * sy) * 1.3) * smooth((x - VX + 40) / 60);   // the vase's shadow
  return clamp(L, 0, 1) }
const TAB = ['table deep', 'table dark', 'table', 'table light'];
function table() {
  stage('The table', 'Warm grey-brown, laid flat and wide; the vase throws its shadow to the right.');
  for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) { const x0 = i * 100 - 10, y0 = TABLE_Y + 4 + j * 45, L = tableLight(x0 + 50, y0 + 22, false);
    fl('table', [[x0 - 14, y0 - 10], [x0 + 114, y0 - 10], [x0 + 114, y0 + 55], [x0 - 14, y0 + 55]], {c: ramp(TAB, L), soft: 22, uneven: .3, scale: 60, angle: 0}) }
  for (let y = TABLE_Y + 8; y < 1040; y += R(10, 16)) for (let x = R(-160, -20); x < 830;) { const len = R(140, 320), c = ramp(TAB, tableLight(x + len / 2, y) + gauss() * .035);
      st('table', 'bristle', [[x, y + R(-1.5, 1.5)], [x + len * .5, y + R(-1.5, 1.5)], [x + len, y + R(-1.5, 1.5)]], {w: R(18, 32), c, c2: lerp3(c, 'table light', R(0, .1)), a: .93, load: len * 2.5, wob: .15, pr: [.5, 1, 1, 1, .7]}); x += len * R(.6, .9) }
  // the back edge, where the table meets the wall
  st('table', 'edge', [[-10, TABLE_Y + 3], [300, TABLE_Y + 2], [600, TABLE_Y + 4], [810, TABLE_Y + 3]], {w: 5, c: 'table dark', a: .7, pr: 'flat'});
  st('table', 'edge', [[-10, TABLE_Y + 8], [400, TABLE_Y + 9], [810, TABLE_Y + 8]], {w: 3, c: 'table light', a: .35, pr: 'flat'});
  fl('glaze', {ellipse: [VX + 175, VFOOT - 4, 215, 30, -2]}, {c: 'table deep', a: .35, soft: 16});
  fl('glaze', {ellipse: [VX + 60, VFOOT + 1, 120, 16, 0]}, {c: 'table deep', a: .3, soft: 8});
  // the shadow beside the vase, worked into the wet table
  for (let i = 0; i < 22; i++) { const t = rnd(), x = VX + 50 + t * 260, y = VFOOT - 6 + R(-7, 9) - t * 12, len = R(70, 140);
    st('table', 'petal', [[x - len / 2, y + R(-2, 2)], [x + len / 2, y + R(-2, 2)]], {w: R(10, 20) * (1.2 - t * .6), c: lerp3('table deep', 'table dark', t * .8 + R(0, .2)), a: .8 - t * .3}) }
  st('table', 'edge', [[VX - hw(VFOOT) - 4, VFOOT + 1], [VX, VFOOT + 11], [VX + hw(VFOOT) + 14, VFOOT + 3]], {w: 8, c: 'table deep', a: .9, pr: 'flat'});
}

/* =====================================================================
   3. LEAVES AND STEMS
   ===================================================================== */
function leaf(x, y, ang, len, wid, lit, mat = 'leafy', front = false) {
  const kind = front ? .5 + rnd() * .5 : rnd();
  if (kind < .14) {   // seen edge on: one dark stroke
    const p = arc(x, y, ang, len * R(.7, 1), R(-.5, .5), 5);
    st(mat, 'petal', p, {w: wid * R(.22, .32), c: ramp(['leaf deep', 'leaf dusk', 'leaf'], lit * .7), c2: ramp(['leaf deep', 'leaf dusk', 'leaf', 'leaf lit'], lit * .8 + .15), grad: 1, a: .97, pr: 'leaf'}); return }
  if (kind < .3) { len *= R(.55, .75); wid *= R(1.05, 1.25) }   // foreshortened
  // a leaflet folded along its midrib: two halves, the one turned to the window lighter
  const bend = R(-.5, .5), p = arc(x, y, ang, len, bend, 6); const nx = -Math.sin(ang), ny = Math.cos(ang), up = (nx * LV[0] + ny * LV[1]) > 0 ? 1 : -1;
  const half = (s, k) => p.map((v, i) => { const t = i / (p.length - 1), e = Math.sin(Math.PI * Math.pow(t, .8)) * wid * .24 * k; return [v[0] + nx * s * e, v[1] + ny * s * e] });
  const fold = R(.1, .5), cD = ramp(['leaf deep', 'leaf dusk', 'leaf', 'leaf lit'], lit * .8), cL = ramp(['leaf deep', 'leaf dusk', 'leaf', 'leaf lit', 'leaf sheen'], lit * .8 + fold * .4);
  st(mat, 'petal', half(-up, 1), {w: wid * .6, c: lerp3(cD, 'leaf deep', R(.1, .4)), a: .97, pr: 'leaf'});
  st(mat, 'petal', half(up, 1), {w: wid * .55, c: lerp3(cD, cL, .5), c2: cL, grad: -up * .6, a: .97, pr: 'leaf'});
  if (lit > .6 && rnd() < .5) st(mat, 'dry round', half(up, .9).slice(1, 5), {w: wid * R(.2, .3), c: 'leaf sheen', a: .7});      // sheen where the light finds it
}
// how lit a leaf is: by where it lies in the bunch (upper left toward the window) and how deep it sits
const leafLit = (x, y, depth) => clamp(.55 - .45 * ((x - CENTER[0]) / 330) * .6 - .35 * ((y - CENTER[1]) / 260) - depth * .35 + R(-.12, .12), 0, 1);
function leavesBack() {
  stage('Leaves behind', 'Foliage laid into the wet wall: a dark loose mass first, then leaflets over it, darker away from the window, so that the blooms stand out.');
  // the shadow mass of the foliage, scrubbed into the wall so that its edges go soft
  for (let i = 0; i < 70; i++) { const th = R(0, 6.283), d = R(.35, .85), x = CENTER[0] + Math.cos(th) * 270 * d, y = CENTER[1] + 30 + Math.sin(th) * 230 * d;
    if (y > TABLE_Y - 40 || y < 170) continue; const L = clamp(wallLight(x, y) - .25, 0, 1);
    st('leafy', 'big', strokeAt(x, y, th + 1.57 + R(-.6, .6), R(50, 110), R(-.5, .5), 4), {w: R(30, 55), c: lerp3('leaf deep', ramp(WALL, L), R(.15, .4)), c2: lerp3('leaf deep', 'leaf', .4), a: .9}) }
  // stems, mostly hidden: they gather into the mouth of the vase
  for (const F of FL.slice(2)) { const a = [F.x + R(-10, 10), F.y + F.r * .45], b = [VX + R(-30, 30), VTOP + 6], m = [(a[0] + b[0]) / 2 + R(-12, 12), (a[1] + b[1]) / 2];
    st('leafy', 'edge', [a, m, b], {w: R(5, 7), c: lerp3('leaf deep', 'leaf', R(0, .3)), a: .9, pr: 'flat'}) }
  // leaflets, in the places where foliage grows in a bunch like this: thick round the mouth of the vase, along the sides, a few on top
  const regions = [[[290, 640], [560, 600], 26], [[150, 420], [235, 540], 9], [[620, 380], [720, 570], 13], [[400, 250], [540, 340], 5], [[640, 640], [730, 700], 5], [[160, 600], [260, 660], 6], [[230, 330], [270, 370], 2]];
  for (const [[x0, y0], [x1, y1], n] of regions) for (let i = 0; i < n; i++) {
    const x = R(Math.min(x0, x1), Math.max(x0, x1)), y = R(Math.min(y0, y1), Math.max(y0, y1)), ang = Math.atan2(y - CENTER[1] + 40, x - CENTER[0]) + R(-.9, .9);
    leaf(x, y, ang, R(45, 105), R(20, 36), leafLit(x, y, .45)) }
}
function leavesFront() {
  stage('Leaves in front', 'A few leaves over the lip of the vase and under the low blooms, and the buds on their stems.');
  for (const [x, y, ang, len, w] of [[352, 600, 2.3, 90, 26], [362, 596, 1.75, 70, 22], [452, 598, .9, 84, 25], [470, 590, .35, 92, 26], [300, 640, 2.0, 70, 22], [560, 560, .6, 80, 24], [700, 668, .8, 80, 22], [150, 640, 2.5, 76, 22], [410, 590, 1.35, 60, 20]])
    leaf(x, y, ang + R(-.15, .15), len * R(.9, 1.1), w, leafLit(x, y, .1) + .1, 'leafy', true);
}

/* =====================================================================
   4. THE VASE
   ===================================================================== */
function vaseLight(x, y) { const h = hw(y), nx = clamp((x - VX) / h, -1, 1), nz = Math.sqrt(Math.max(0, 1 - nx * nx));
  const yy = Math.min(VFOOT, Math.max(VTOP, y)), slope = (hw(yy + 3) - hw(yy - 3)) / 6, ny = -slope * .7;
  let L = .06 + .98 * Math.pow(Math.max(0, nx * LV[0] + ny * LV[1] + nz * LV[2]), 1.2);
  L += .22 * smooth((nx - .74) / .22);                                         // reflected light from the table and the wall
  L -= .12 * smooth((y - 815) / 60);                                         // the foot sits in its own shadow
  L -= .2 * smooth((660 - y) / 50);                                          // the shoulder in the shade of the flowers
  return clamp(L + (fbm(x / 40, y / 40, 2) - .5) * .08, 0, 1) }
const CEL = ['cel deep', 'cel dark', 'cel mid', 'cel light', 'cel hi'];
function vase() {
  stage('The vase', 'Celadon, painted down the turn of the pot: each stroke one value, light on the left, the reflected light on the far edge; then across the form with a drier brush.');
  const meridian = (u, y0, y1) => { const pts = []; for (let k = 0; k <= 6; k++) { const y = y0 + (y1 - y0) * k / 6; pts.push([VX + u * hw(y), y]) } return pts };
  // the glaze laid in as soft-edged bands down the pot, so that the turn of the form is smooth
  const band = (u0, u1, y0, y1) => meridian(u0, y0, y1).concat(meridian(u1, y0, y1).reverse());
  const US = [-1.2, -.9, -.75, -.6, -.45, -.3, -.15, 0, .15, .3, .45, .6, .72, .82, .9, 1.2], YS = [VTOP - 12, 628, 652, 676, 702, 735, 775, 815, 850, VFOOT + 12];
  for (let j = 0; j < YS.length - 1; j++) for (let i = 0; i < US.length - 1; i++) { const um = clamp((US[i] + US[i + 1]) / 2, -.98, .98), ym = (YS[j] + YS[j + 1]) / 2, L = vaseLight(VX + um * hw(ym), ym) * .97;
    fl('celadon', band(US[i] - .03, US[i + 1] + .03, YS[j] - 6, YS[j + 1] + 6), {c: ramp(CEL, L * .9), c2: ramp(CEL, L * .9 + .04), soft: 9, uneven: .25, scale: 30, angle: 1.5, clip: 'vase'}) }
  dry('still');
  // the edge of the pot on the shadow side, turned crisply against the wall
  { const pts = []; for (let y = 640; y <= VFOOT - 4; y += 12) pts.push([VX + hw(y) - 3, y]); st('celadon', 'edge', pts, {w: 5, c: 'cel deep', a: .6, pr: 'flat', clip: 'vase'}) }
  // the foot ring: unglazed clay
  st('paint', 'edge', [[VX - hw(VFOOT) + 4, VFOOT + 1], [VX - 20, VFOOT + 9.5], [VX + 30, VFOOT + 9.5], [VX + hw(VFOOT) - 3, VFOOT + 1]], {w: 4.5, c: lerp3('foot', 'cel deep', .35), c2: lerp3('foot', 'cel deep', .7), grad: 1, a: .9, pr: 'flat'});
}
function vaseLights() {
  stage('Light on the glaze', 'The window caught on the shoulder of the pot, thick and clean, and a softer reflected light on the far side.');
  // the mouth: a dark opening, the rim round it lit on the left
  const lipE = (a0, a1, k = 1) => { const p = []; for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; p.push([VX + Math.cos(a) * hw(VTOP) * k, VTOP + Math.sin(a) * 9 * k]) } return p };
  fl('paint', {ellipse: [VX, VTOP, n1(hw(VTOP) * .86), 6.5]}, {c: 'cel deep', soft: 1.5});
  st('celadon hi', 'edge', lipE(Math.PI * .95, Math.PI * .45), {w: 4.5, c: 'cel light', a: .95, pr: 'flat'});
  st('celadon hi', 'edge', lipE(Math.PI * .45, Math.PI * .05), {w: 4, c: 'cel mid', a: .9, pr: 'flat'});
  st('celadon', 'edge', lipE(-Math.PI * .95, -Math.PI * .05, .97), {w: 2.2, c: 'cel mid', a: .8, pr: 'flat'});
  for (const [u, y0, y1, w, a, c] of [[-.5, 664, 790, 10, .9, 'cel hi'], [-.36, 676, 770, 6, .75, 'cel hi'], [-.62, 700, 760, 4, .7, 'cel light']]) { const pts = []; for (let k = 0; k <= 6; k++) { const y = y0 + (y1 - y0) * k / 6; pts.push([VX + u * hw(y), y]) }
    st('celadon hi', 'petal', pts, {w, c, a, pr: prof(t => Math.sin(Math.PI * Math.pow(t, .8)) * .85 + .15), clip: 'vase'}) }
  // (no separate glint: the window streaks carry the light)
  for (const [u, y0, y1] of [[.86, 680, 790], [.84, 770, 860]]) { const pts = []; for (let k = 0; k <= 6; k++) { const y = y0 + (y1 - y0) * k / 6; pts.push([VX + u * hw(y), y]) }
    st('celadon', 'petal', pts, {w: 7, c: 'cel warm', c2: 'cel light', a: .55, pr: 'leaf', clip: 'vase'}) }
}

/* =====================================================================
   5. THE FLOWERS
   ===================================================================== */
const PAL = {
  white: ['white night', 'white dusk', 'white shadow', 'cream', 'white hi'],
  blush: ['pink dusk', 'white dusk', 'blush', 'cream', 'white hi'],
  pink: ['pink dusk', 'pink shadow', 'pink mid', 'pink light', 'pink hi'],
  deep: ['pink dusk', 'pink deep', 'pink mid', 'pink light', 'pink hi']
};
const inFront = (F, x, y) => { for (let i = FL.indexOf(F) + 1; i < FL.length; i++) { const G = FL[i], c = Math.cos(-G.rot), sn = Math.sin(-G.rot), dx = x - G.x, dy = y - G.y, u = (dx * c - dy * sn) / (G.r * G.open), v = (dx * sn + dy * c) / (G.r * G.k * G.open); if (u * u + v * v < .92) return true } return false };
const visible = (F, path) => run(path, p => !inFront(F, p[0], p[1]));
const fst = (F, mat, brush, path, o) => st(mat, brush, visible(F, path), o);
const ACCENT = {white: 'white dusk', blush: 'pink dusk', pink: 'pocket', deep: 'pocket'};
// lightness on a flower: a dome lit from the window, with the ruffle of the petals
function flowerLight(F, x, y) {
  const c = Math.cos(-F.rot), s = Math.sin(-F.rot), dx = x - F.x, dy = y - F.y, u = (dx * c - dy * s) / F.r, v = (dx * s + dy * c) / (F.r * F.k), d2 = u * u + v * v;
  const nz = Math.sqrt(Math.max(.05, 1 - Math.min(1, d2))), nx = dx / F.r, ny = dy / F.r, l = Math.hypot(nx, ny, nz);
  let L = .06 + 1.0 * Math.max(0, ((nx * LV[0] + ny * LV[1] + nz * LV[2]) / l + .15) / 1.15);   // light wraps a little round a soft, fluffy thing
  L -= .18 * smooth((Math.sqrt(d2) - .7) / .3) * smooth((dy / F.r) / .5);   // under the bloom: the outer petals hang into shadow
  L = clamp(L + (fbm(x / 22 + F.x, y / 22, 3) - .5) * .2, 0, 1);
  return .1 + .9 * (.45 * L + .55 * smooth((L - .12) / .75));   // light and shadow kept apart, as a painter groups them
}
function flowerBlock(F) {
  const pal = PAL[F.kind];
  // a flat underlayer first, so that no wall shows through the bloom
  fl('petal', {ellipse: [n1(F.x), n1(F.y), n1(F.r * .8 * F.open), n1(F.r * .8 * F.k * F.open), n1(F.rot * 57.3)]}, {c: ramp(pal, .3), soft: 4});
  for (let i = 0; i < 14; i++) { const th = R(0, 6.283), f = .62 * Math.sqrt(rnd()) * F.open, m = ellPt(F, th, f), L = flowerLight(F, m[0], m[1]);   // patches of light and shade under the petals
    fl('petal', {ellipse: [n1(m[0]), n1(m[1]), n1(F.r * .26), n1(F.r * .22), n1(R(0, 180))]}, {c: ramp(pal, L * .82), soft: F.r * .1}) }
  for (let i = 0; i < 22; i++) { const th = R(0, 6.283), f = .85 * Math.sqrt(rnd()) * F.open, m = ellPt(F, th, f), L = flowerLight(F, m[0], m[1]), len = F.r * R(.3, .5);
    st('petal', 'wide', strokeAt(m[0], m[1], ellTan(F, th) + R(-1.2, 1.2), len, R(-.6, .6), 3), {w: F.r * R(.25, .38), c: ramp(pal, L * .8 - .04), c2: ramp(pal, L * .8 + .06), grad: -1, a: .95, pr: pick(PETALPR)}) }
  const h = heartOf(F);
  for (let i = 0; i < 7; i++) { const a = R(0, 6.283); st('petal', 'comma', strokeAt(h[0] + Math.cos(a) * F.r * .08, h[1] + Math.sin(a) * F.r * .06, a + 1.57, F.r * R(.15, .3), R(-.8, .8)), {w: F.r * R(.08, .14), c: ramp(pal, R(0, .22)), a: .85}) }
}
// the petals of one bloom, as a list: a few big cupped guard petals round the outside, then the mound of crumpled petals,
// smaller toward the heart, which sits toward the top of the face
function petalsOf(F) {
  const h = heartOf(F), out = [];
  const nG = 5 + Math.floor(rnd() * 3), off = R(0, 6.283);
  for (let i = 0; i < nG; i++) { const th = off + i * 6.283 / nG + R(-.2, .2), f = R(.8, 1.0) * F.open;
    out.push({guard: true, th, f, span: 6.283 / nG * R(1, 1.3)}) }
  const nB = Math.round(F.r * .28);
  for (let i = 0; i < nB; i++) { const f = .74 * Math.sqrt(rnd()) * F.open, th = R(0, 6.283); out.push({guard: false, th, f}) }
  out.sort((a, b) => b.f - a.f);
  for (const q of out) { const G = q.guard ? F : Object.assign({}, F, {x: F.x + (h[0] - F.x) * (1 - q.f / F.open), y: F.y + (h[1] - F.y) * (1 - q.f / F.open)});
    q.G = G; const c = ellPt(G, q.th, q.f); q.x = c[0]; q.y = c[1]; q.L = clamp(flowerLight(F, q.x, q.y) - .3 * smooth((.3 - q.f / F.open) / .25), 0, 1) }
  return out;
}
function paintPetal(F, q, pal) {
  if (q.guard) {   // a big cup: its hollow first, then the lit outer face along the rim
    const a0 = q.th - q.span * .45, a1 = q.th + q.span * .45, far = Math.sin(q.th) < -.2, inner = clamp(far ? q.L - .06 : q.L - .3, 0, 1);   // on the far side we look into the cup, and the window lights it
    const base = ell(F, a0, a1, q.f * .9, 6, R(.04, .1)), rim = ell(F, a0 + q.span * .06, a1 - q.span * .06, q.f * 1.0, 6, R(.06, .14));
    st('petal', 'petal', base, {w: F.r * R(.26, .34), c: ramp(pal, inner * .8 + R(-.08, .05)), c2: ramp(pal, inner * .8 + R(.06, .18)), grad: -1, a: .97, pr: pick(PETALPR)});
    const lift = q.L < .5 ? .15 : 0;   // in the shade the rim still catches light reflected from the table and the wall
    st('petal', rnd() < .5 ? 'petal' : 'flatp', rim, {w: F.r * R(.1, .16), c: ramp(pal, q.L * .9 + lift), c2: ramp(pal, Math.min(.96, q.L * .95 + .1 + lift)), grad: -1, a: .97, pr: pick(PETALPR)});
    q.path = rim; q.w = F.r * .13; return }
  // the mound: each petal a cup seen from outside — a broad touch in its own shade, bulging away from the heart,
  // and its lit rim laid along the outer edge into the wet paint
  const h = heartOf(F), tan = ellTan(q.G, q.th) + R(-.7, .7), size = F.r * (.27 + .3 * q.f) * R(.8, 1.25);
  let curv = R(.4, 1.3), p = strokeAt(q.x, q.y, tan, size, curv, 3);
  const dh = v => Math.hypot(v[0] - h[0], v[1] - h[1]);
  if (dh(p[1]) + dh(p[2]) < dh(p[0]) + dh(p[3])) { curv = -curv; p = strokeAt(q.x, q.y, tan, size, curv, 3) }
  const Lp = clamp(q.L + R(-.12, .12) + R(-.14, .14) * (1 - Math.abs(2 * q.L - 1)), 0, 1), w = size * R(.5, .7);   // the ruffle breaks the edge of the shadow
  st('petal', rnd() < .6 ? 'flatp' : 'petal', p, {w, c: ramp(pal, Lp * .82 - .06), c2: ramp(pal, Lp * .82 + .02), grad: rnd() < .5 ? 1 : -1, a: .96, pr: pick(PETALPR)});
  const mx = (p[1][0] + p[2][0]) / 2, my = (p[1][1] + p[2][1]) / 2, ox = (mx - h[0]) / (dh([mx, my]) || 1), oy = (my - h[1]) / (dh([mx, my]) || 1), k = w * .32;
  const rim = p.map((v, i) => [v[0] + ox * k * (i === 0 || i === 3 ? .5 : 1), v[1] + oy * k * (i === 0 || i === 3 ? .5 : 1)]);
  if (Lp > .25 || rnd() < .4) st('petal', rnd() < .5 ? 'flatp' : 'petal', rim, {w: w * R(.3, .42), c: ramp(pal, Math.min(.97, Lp * .9 + .14)), a: .95, pr: pick(PETALPR)});
  q.path = rim; q.w = w * .6; q.Lp = Lp;
}
// where one guard petal tucks under the next: a dark crease running in toward the heart, and the rim of the cup catching some light
function guardCreases(F, list, pal) {
  for (const q of list) { if (!q.guard) continue;
    for (const e of [-.45, .45]) { if (rnd() < .35 || q.L > .45) continue; const th = q.th + e * q.span, a = ellPt(F, th, q.f * 1.0), b = ellPt(F, th + R(-.1, .1), q.f * R(.62, .75));
      fst(F, 'clean', 'petal', [a, [(a[0] + b[0]) / 2 + R(-2, 2), (a[1] + b[1]) / 2 + R(-2, 2)], b], {w: F.r * R(.03, .055), c: ramp(pal, clamp(q.L * .5 + R(-.05, .05), .02, .3)), a: R(.6, .85), pr: 'taper'}) }
    if (q.L < .56 && rnd() < .7) fst(F, 'clean', 'edge', ell(F, q.th - q.span * .3, q.th + q.span * .3, q.f * 1.0, 5, .08), {w: F.r * R(.025, .04), c: ramp(pal, q.L * .9 + .2), a: R(.6, .85), wob: 1}) }
}
// the deepest pockets of a bloom: few, small, dark, near the heart and under the mound
function pockets(F, pal) {
  const h = heartOf(F), acc = ACCENT[F.kind];
  for (let i = 0; i < 6; i++) { const th = R(0, 6.283), f = R(.04, .26), G = Object.assign({}, F, {x: h[0], y: h[1]}), p = ellPt(G, th, f);
    fst(F, 'clean', 'flatp', strokeAt(p[0], p[1], ellTan(G, th) + R(-.5, .5), F.r * R(.08, .14), R(-1, 1), 3), {w: F.r * R(.05, .08), c: lerp3(acc, ramp(pal, .15), R(.4, .8)), a: R(.6, .85), pr: [.6, 1, .9, .5]}) }
  // the shadow the mound throws on the guard petals below it
  for (let i = 0; i < 4; i++) { const th = R(1, 2.4), p = ell(F, th - .35, th + .35, R(.62, .74) * F.open, 4);
    fst(F, 'clean', 'edge', p, {w: F.r * R(.03, .06), c: lerp3(acc, ramp(pal, .15), .5), a: R(.5, .75), wob: .8}) }
}
// the outline broken by petal tips: short convex touches that run a little past the edge of the bloom
function silhouette(F, pal) {
  const n = 7 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) { const th = R(0, 6.283), f = R(.9, .98) * F.open, span = R(.22, .4), p = ell(F, th - span / 2, th + span / 2, f, 4, R(.06, .12)), m = p[2], L = flowerLight(F, m[0], m[1]);
    fst(F, 'petal', rnd() < .5 ? 'petal' : 'flatp', p, {w: F.r * R(.13, .2), c: ramp(pal, L * .85 + .02), c2: ramp(pal, Math.min(.97, L * .9 + .14)), grad: -1, a: .95, pr: pick(PETALPR)}) }
}
function petalLights(F, list, pal) {
  const lit = list.filter(q => q.path && (q.Lp ?? q.L) > .68);
  for (const q of lit) { if (rnd() < .3) continue; const p = q.path, L = q.Lp ?? q.L, c = ramp(pal, Math.min(1, L * .6 + .42)), w = q.w * R(.4, .7);
    const sub = rnd() < .5 ? p.slice(0, 4) : p.slice(1); fst(F, 'impasto', rnd() < .3 ? 'flatp' : 'petal', sub, {w, c, c2: ramp(pal, 1), grad: rnd() < .5 ? 1 : -1, a: .97, pr: rnd() < .5 ? 'comma' : 'leaf'}) }
}
function bud(B) {
  // a round bud on a short stem, held in its sepals, lit from the window
  const pal = B.kind === 'green' ? ['leaf deep', 'leaf', 'leaf lit', 'leaf sheen'] : B.kind === 'pink' ? ['pink dusk', 'pink shadow', 'pink mid', 'pink light'] : ['white dusk', 'blush', 'cream', 'white hi'];
  const sa = B.ang + Math.PI, lx = Math.cos(Math.atan2(LV[1], LV[0])), ly = Math.sin(Math.atan2(LV[1], LV[0]));
  st('leafy', 'edge', arc(B.x + Math.cos(sa) * B.r * .6, B.y + Math.sin(sa) * B.r * .6, sa + R(-.2, .2), B.r * 1.9, R(-.6, .6), 4), {w: 4.5, c: 'leaf', a: .92, pr: 'flat'});
  fl('petal', {circle: [n1(B.x), n1(B.y), n1(B.r * .78)]}, {c: ramp(pal, .35), soft: .6});
  for (let i = 0; i < 4; i++) { const a0 = B.ang + Math.PI * .5 + i * 1.6 + R(-.3, .3), p = circleArc(B.x, B.y, B.r * R(.3, .42), a0, a0 + R(1.8, 2.6), 6), m = p[3], L = clamp(.5 + .55 * (((m[0] - B.x) * lx + (m[1] - B.y) * ly) / (B.r * .5)), 0, 1);
    st('petal', 'petal', p, {w: B.r * R(.4, .52), c: ramp(pal, L * .8), c2: ramp(pal, L * .9 + .1), grad: -1, a: .95, pr: [.6, 1, 1, .7]}) }
  if (B.kind !== 'green') st('impasto', 'comma', circleArc(B.x, B.y, B.r * .45, Math.atan2(ly, lx) - .7, Math.atan2(ly, lx) + .5, 4), {w: B.r * .18, c: ramp(pal, 1), a: .9});
  for (let i = 0; i < 3; i++) { const a = sa + (i - 1) * R(.6, .9), base = [B.x + Math.cos(sa) * B.r * .7, B.y + Math.sin(sa) * B.r * .7], tip = [B.x + Math.cos(a) * B.r * .95, B.y + Math.sin(a) * B.r * .95];
    st('leafy', 'petal', [base, [(base[0] + tip[0]) / 2 + Math.cos(a) * 3, (base[1] + tip[1]) / 2 + Math.sin(a) * 3], tip], {w: B.r * R(.3, .4), c: lerp3('leaf deep', 'leaf', R(.2, .7)), c2: 'leaf lit', grad: .6, a: .95, pr: 'leaf'}) }
}

/* =====================================================================
   6. FALLEN PETALS
   ===================================================================== */
function fallen(x, y, ang, s, kind, curl = .9) {
  // a petal lying on the table: a curled cup, its hollow in shade, lit along its upturned rim, with its shadow thrown away from the window
  const pal = PAL[kind], ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
  fl('glaze', {ellipse: [n1(x + s * .22), n1(y + s * .16), n1(s * .56), n1(s * .24), n1(ang * 57.3)]}, {c: 'table deep', a: .5, soft: s * .08});
  const body = arc(x - ca * s * .5, y - sa * s * .5, ang, s, curl, 5), up = nx * LV[0] + ny * LV[1] > 0 ? 1 : -1, sh = (k, d = 0) => body.slice(d, body.length - d).map(v => [v[0] + nx * up * s * k, v[1] + ny * up * s * k]);
  st('petal', 'wide', body, {w: s * .62, c: ramp(pal, .22), c2: ramp(pal, .66), grad: up, a: .97, pr: 'feather'});
  st('impasto', 'petal', sh(.15).slice(1, 5), {w: s * .12, c: ramp(pal, .97), c2: ramp(pal, .8), grad: up, a: .96, pr: 'comma'});
}

/* =====================================================================
   THE PAINTING
   ===================================================================== */
// each part draws from its own stream of chance, so that changing one part leaves the accidents of the others alone
const part = n => { seed = 5121107 + n * 7919 };
part(1); layIn();
dry();
part(2); wall();
part(3); table();
dry();
part(4); leavesBack();
for (const B of BUDS) bud(B);
dry();
part(5); vase();
dry();
vaseLights();
dry();
part(6); stage('Flowers blocked in', 'Each bloom laid in as one mass, darker away from the window, with its hollow heart.');
for (const F of FL) flowerBlock(F);
stage('Petals', 'Cupped guard petals round the outside, then the ruffle, smaller toward the heart, worked wet into the mass.');
const PET = new Map();
for (const F of FL) { const list = petalsOf(F); PET.set(F, list); for (const q of list) paintPetal(F, q, PAL[F.kind]) }
dry();
part(7); stage('Edges and hollows', 'Petal tips that break the outline, dark creases where the guard petals tuck under, and the deepest pockets at the heart, with a clean brush.');
for (const F of FL) { silhouette(F, PAL[F.kind]); guardCreases(F, PET.get(F), PAL[F.kind]); pockets(F, PAL[F.kind]) }
dry();
part(8); stage('Impasto lights', 'Thick creamy lights on the petals that face the window.');
for (const F of FL) petalLights(F, PET.get(F), PAL[F.kind]);
dry();
part(9); leavesFront();
dry();
part(10); stage('Fallen petals', 'A few petals dropped on the table, each with its small shadow.');
fallen(160, 902, .3, 62, 'pink', 1.1); fallen(250, 944, -.6, 44, 'deep', -.9); fallen(610, 958, .2, 52, 'white', .8); fallen(716, 830, -.2, 36, 'pink', -1);

const problems = P.check(doc);
if (problems.length) { console.error(problems.length + ' problems\n  - ' + problems.slice(0, 20).join('\n  - ')); process.exit(1) }
const J = v => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
const line = q => q.do ? '      {"with": ' + J(q.with) + ', "do": [\n' + q.do.map(m => '        ' + J(m)).join(',\n') + '\n      ]}' : '      ' + J(q);
const body = doc.steps.map(s => '    {"name": ' + JSON.stringify(s.name) + (s.note ? ', "note": ' + JSON.stringify(s.note) : '') + ', "do": [\n' + s.do.map(line).join(',\n') + '\n    ]}').join(',\n');
const head = Object.assign({}, doc); delete head.steps;
const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "steps": [\n' + body + '\n  ]\n}\n');
JSON.parse(text);
writeFileSync(join(dir, 'peonies.json'), text);
let count = 0; const walk = l => l.forEach(s => s.do ? walk(s.do) : count += s.paths ? s.paths.length : s.dots ? s.dots.length : 1); walk(doc.steps);
console.log('peonies.json  ' + (text.length / 1024).toFixed(0) + ' kB  ' + doc.steps.length + ' stages, ' + count + ' marks');
