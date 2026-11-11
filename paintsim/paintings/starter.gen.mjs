// node paintings/starter.gen.mjs   →   paintings/starter.json
//
// A starting point for a painting generator: copy this file, keep the top half, replace the picture.
// A picture with thousands of strokes is composed by a program like this one, with chance from a seed,
// and written out as a plain painting document. See GUIDE.md for how to work.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const file = fileURLToPath(import.meta.url), dir = dirname(file), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {arc, spline, clamp, smooth, fbm} = P.util;

/* ---------- chance, from a seed: the same picture every run ---------- */
let seed = 1;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];

/* ---------- the palette: every colour a mix of pigments by parts ---------- */
const MIX = {
  'wall': {mix: {'raw umber': 2, 'ultramarine': .6, 'titanium white': 1.2}}, 'wall dark': {mix: {'burnt umber': 2, 'ultramarine': 1}},
  'table': {mix: {'burnt sienna': 2, 'yellow ochre': 1}}, 'table light': {mix: {'yellow ochre': 2, 'titanium white': 1.5, 'burnt sienna': .5}},
  'pear': {mix: {'cadmium yellow': 2, 'sap green': 1, 'titanium white': .5}}, 'pear shade': {mix: {'sap green': 2, 'burnt umber': 1}}, 'pear light': {mix: {'cadmium yellow': 1, 'titanium white': 3}},
  'shadow': {mix: {'burnt umber': 2, 'ultramarine': 1, 'alizarin crimson': .3}}
};
const CC = new Map(), C = c => { if (typeof c !== 'string') return c; let v = CC.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); CC.set(c, v) } return v };
const mixc = (a, b, t) => { a = C(a); b = C(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };   // between two palette colours, for one stroke
const hex = c => P.hex(C(c));
// console.log(Object.keys(MIX).map(k => k + ' ' + hex(k)).join('\n'));   // look at what the mixes give

/* ---------- the document ---------- */
const W = 400, H = 300;
const doc = {
  paintsim: 1, engine: P.VERSION, title: 'A pear', note: 'The starter picture: a pear on a table, oil on toned canvas.',
  size: [W, H], ground: 'toned canvas', light: 'raking', seed: 1,
  define: {
    pigments: MIX,
    materials: {
      'paint': {base: 'oil', note: 'oil that never runs out in mid-stroke', reach: 0},
      'thin': {base: 'oil', note: 'thinned colour for the lay-in', opacity: .8, body: .25, open: .3, pickup: 0, merge: 0, reach: 0},
      'impasto': {base: 'oil', note: 'thick clean paint for the lights: it does not sink into what is under it', body: 1.5, gloss: .36, merge: 0, pickup: 0, reach: 0}
    },
    brushes: {}
  },
  shapes: {}, steps: []
};

/* ---------- writing steps ---------- */
let cur = null, grp = null;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100;
const stage = (name, note) => { cur = {name, note, do: []}; doc.steps.push(cur); grp = null };   // a stage: a named top-level step
// one stroke. o: w width · c, c2 colours · a opacity · pr pressure (profile name or list of numbers) · grad · load · tone2 · clip (a shape or its name)
function st(material, brush, path, o = {}) {
  if (path.length < 2) return;
  const s = {path: path.map(p => [n1(p[0]), n1(p[1])])};
  if (o.w !== undefined) s.width = o.w < 4 ? n2(o.w) : n1(o.w);
  if (o.c !== undefined) s.color = hex(o.c);
  if (o.c2 !== undefined) s.color2 = hex(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.pr !== undefined) s.pressure = o.pr;
  if (o.grad) s.grad = n2(o.grad);
  if (o.load !== undefined) s.load = Math.round(o.load);
  if (o.tone2) s.tone2 = n2(o.tone2);
  if (o.clip !== undefined) s.clip = o.clip;
  const key = material + '|' + brush;   // strokes that follow each other with the same paint and brush share one group
  if (!grp || grp.key !== key) { grp = {key, node: {with: {material, brush}, do: []}}; cur.do.push(grp.node) }
  grp.node.do.push(s);
}
// one filled shape: a polygon [[x,y],…], a name from doc.shapes, or {rect} {circle} {ellipse} {curve}
function fl(material, shape, o = {}) { const s = {material, shape}; if (o.c !== undefined) s.color = hex(o.c); if (o.a !== undefined) s.opacity = n2(o.a); for (const k of ['soft', 'uneven', 'angle']) if (o[k] !== undefined) s[k] = o[k]; if (o.clip !== undefined) s.clip = o.clip; cur.do.push(s); grp = null }
const dry = () => { cur.do.push({dry: true}); grp = null };   // between layers that must not mix

/* ---------- geometry ---------- */
const line = (x, y, ang, len, curv = 0, n = 3) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);   // a stroke centred on (x, y)
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
// the part of a stroke, around its middle, for which ok(point) holds: a brush is lifted at an edge, not masked
function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }

/* =====================================================================
   THE PICTURE — replace everything from here to the writer
   ===================================================================== */
const TABLE = 205, pear = spline([[200, 98], [214, 112], [222, 150], [238, 182], [232, 214], [200, 226], [168, 214], [162, 182], [178, 150], [186, 112]], 8, true);
const onPear = p => inPoly(p[0], p[1], pear);

stage('Lay-in', 'The big masses, thin: nothing later has to cover bare canvas.');
fl('thin', {rect: [-5, -5, W + 5, TABLE]}, {c: 'wall', angle: .6}); fl('thin', {rect: [-5, TABLE, W + 5, H + 5]}, {c: 'table', angle: .05});
dry();

stage('Wall and table', 'Broad strokes, darker away from the light, which comes from the upper left.');
for (let i = 0; i < 140; i++) { const x = R(-10, W + 10), y = R(-10, TABLE); st('paint', 'flat', line(x, y, R(.2, 1.2), R(40, 90), R(-.4, .4)), {w: R(18, 34), c: mixc('wall', 'wall dark', clamp(x / W * .8 + R(-.2, .2), 0, 1))}) }
for (let i = 0; i < 110; i++) { const x = R(-10, W + 10), y = R(TABLE + 2, H + 5); st('paint', 'flat', line(x, y, R(-.1, .1), R(40, 100)), {w: R(10, 22), c: mixc('table', 'table light', clamp(.7 - x / W + R(-.2, .2), 0, 1))}) }
dry();   // dry before the pear, or its colours would pick up the brown

stage('Pear', 'Shadow on the table first, then the form in strokes that follow it, then the light, thick.');
for (let i = 0; i < 14; i++) st('thin', 'flat', line(R(215, 285), R(214, 228), R(-.1, .1), R(30, 60)), {w: R(8, 14), c: 'shadow', a: .5});
fl('thin', pear, {c: mixc('pear shade', 'pear', .4), soft: 1});   // its own colour under the strokes, so that no gap between them shows the wall
const BLUNT = [.55, .9, 1, 1, .9, .55];   // a round brush set down and lifted without a point; the named profiles make leaf shapes
for (let i = 0; i < 260; i++) { const x = R(158, 242), y = R(96, 230), lit = clamp(.62 - (x - 200) / 62 - (y - 165) / 260 + R(-.12, .12), 0, 1);
  st('paint', 'round', run(line(x, y, Math.PI / 2 + (x - 200) / 55 + R(-.25, .25), R(14, 30), R(-.5, .5), 4), onPear), {w: R(8, 14), pr: BLUNT, c: mixc('pear shade', 'pear', lit), c2: mixc('pear', 'pear light', lit * .6)}) }
dry();
for (let i = 0; i < 12; i++) st('impasto', 'round', line(R(178, 190), R(146, 198), Math.PI / 2 + R(-.3, .3), R(8, 18)), {w: R(4, 7), pr: BLUNT, c: mixc('pear light', 'titanium white', R(0, .5))});
st('paint', 'round', [[200, 100], [203, 88], [210, 80]], {w: 3.2, c: 'wall dark'});   // the stalk

/* =====================================================================
   check it and write it: one mark to a line, under the name of this file
   ===================================================================== */
const problems = P.check(doc);
if (problems.length) { console.error(problems.length + ' problems\n  - ' + problems.slice(0, 20).join('\n  - ')); process.exit(1) }
const J = v => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
const ln = q => q.do ? '      {"with": ' + J(q.with) + ', "do": [\n' + q.do.map(m => '        ' + J(m)).join(',\n') + '\n      ]}' : '      ' + J(q);
const body = doc.steps.map(s => '    {"name": ' + JSON.stringify(s.name) + ', "note": ' + JSON.stringify(s.note || '') + ', "do": [\n' + s.do.map(ln).join(',\n') + '\n    ]}').join(',\n');
const head = Object.assign({}, doc); delete head.steps;
const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "steps": [\n' + body + '\n  ]\n}\n');
JSON.parse(text);
const out = join(dir, basename(file).replace('.gen.mjs', '.json'));
writeFileSync(out, text);
let count = 0; const walk = l => l.forEach(s => s.do ? walk(s.do) : count++); walk(doc.steps);
console.log(basename(out) + '  ' + (text.length / 1024).toFixed(0) + ' kB  ' + doc.steps.length + ' stages, ' + count + ' marks');
