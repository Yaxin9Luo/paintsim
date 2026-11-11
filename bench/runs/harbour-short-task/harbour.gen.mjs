// node paintings/harbour.gen.mjs   →   paintings/harbour.json
//
// A small fishing harbour at sunset, in thick oil: four wooden boats at their moorings, a stone quay with
// a row of houses, an orange and rose sky under violet clouds, and water laid on with the knife.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const file = fileURLToPath(import.meta.url), dir = dirname(file), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {arc, spline, clamp, smooth, fbm, hash} = P.util;

/* ---------- chance, from a seed: the same picture every run ---------- */
let seed = 1;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
const reseed = n => { seed = n };   // every stage starts its own stream, so that an edit in one stage leaves the others alone

/* ---------- colour: the palette is mixed on the palette and carried to the canvas as plain colour ---------- */
const CC = new Map(), C = c => { if (typeof c !== 'string') return c; let v = CC.get(c); if (!v) { v = P.color(c); CC.set(c, v) } return v };
const mixc = (a, b, t) => { a = C(a); b = C(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
const hex = c => P.hex(C(c).map(v => clamp(v, 0, 1)));
// a little of the accident of mixing: every load of the brush or knife is a slightly different colour
const jc = (c, a = .03) => { c = C(c); const d = R(-a, a); return [c[0] + d + R(-a, a) * .5, c[1] + d + R(-a, a) * .5, c[2] + d + R(-a, a) * .5] };
const warm = (c, t) => mixc(c, '#ffb060', t), cool = (c, t) => mixc(c, '#3c3868', t);

/* ---------- the document ---------- */
const W = 1000, H = 800;
const doc = {
  paintsim: 1, engine: P.VERSION, title: 'Harbour, last light',
  note: 'A small fishing harbour at sunset. Oil on a warm toned canvas: brushed sky, knife-laid water, thick lights.',
  size: [W, H], ground: 'sienna canvas', light: 'evening', seed: 11,
  define: {
    grounds: {'sienna canvas': {base: 'canvas', color: '#a87450'}},
    lights: {'evening': {base: 'raking', elevation: 33, shoulder: .32, lens: {vignette: .2, contrast: .1, grain: .45}}},
    materials: {
      'thin': {base: 'oil', note: 'thinned colour for the lay-in', opacity: .86, body: .25, open: .3, pickup: 0, merge: 0, reach: 0},
      'under': {base: 'oil', note: 'flat opaque colour under a shape', opacity: .97, body: .32, open: .3, pickup: 0, merge: 0, reach: 0},
      'paint': {base: 'oil', note: 'the working paint: stays wet and melts a little into what is wet', body: .95, reach: 0, merge: .22, pickup: .03},
      'soft': {base: 'oil', note: 'for the sky: wetter, melts more', body: .8, reach: 0, merge: .38, pickup: .05, open: .95},
      'firm': {base: 'oil', note: 'clean paint that lies on top', body: .9, reach: 0, merge: 0, pickup: 0},
      'dark': {base: 'oil', note: 'darks with gloss, so that their relief shows', body: .8, gloss: .4, reach: 0, merge: .1, pickup: .01},
      'slab': {base: 'oil', note: 'for the knife in the water: the knife gives it 2.4 times this body', body: .46, gloss: .34, reach: 0, merge: 0, pickup: 0, dry: .34},
      'slab thick': {base: 'oil', note: 'knife lights', body: .78, gloss: .36, reach: 0, merge: 0, pickup: 0, dry: .3},
      'drag': {base: 'oil', note: 'paint dragged thin with the knife: it breaks over the ridges under it', body: .4, gloss: .32, reach: 0, merge: 0, pickup: 0, dry: .72, charge: .7},
      'impasto': {base: 'oil', note: 'thick clean paint for the lights', body: 1.5, gloss: .36, merge: 0, pickup: 0, reach: 0}
    },
    brushes: {
      'knife small': {base: 'knife', width: 10, clump: 30, varLen: 14, rag: 5, vary: .2},
      'palette': {base: 'knife', rag: 4.5, vary: .22, varLen: 30},
      'bristle': {base: 'flat', streak: 1.9, rag: 7},
      'touch': {base: 'flat', note: 'a small square brush set down once', rag: 1.2, streak: .7, taper: .25, wobble: .2}
    }
  },
  shapes: {}, steps: []
};

/* ---------- writing steps ---------- */
let cur = null, grp = null;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100;
const stage = (name, note) => { cur = {name, note, do: []}; doc.steps.push(cur); grp = null; reseed(1000 + doc.steps.length * 7919) };
function st(material, brush, path, o = {}) {
  if (!path || path.length < 2) return;
  const s = {path: path.map(p => [n1(p[0]), n1(p[1])])};
  if (o.w !== undefined) s.width = o.w < 4 ? n2(o.w) : n1(o.w);
  if (o.c !== undefined) s.color = hex(o.c);
  if (o.c2 !== undefined) s.color2 = hex(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.pr !== undefined) s.pressure = o.pr;
  if (o.grad) s.grad = n2(o.grad);
  if (o.load !== undefined) s.load = Math.round(o.load);
  if (o.tone2) s.tone2 = n2(o.tone2);
  if (o.sp === false) s.spline = false;
  if (o.clip !== undefined) s.clip = o.clip;
  const key = material + '|' + brush;
  if (!grp || grp.key !== key) { grp = {key, node: {with: {material, brush}, do: []}}; cur.do.push(grp.node) }
  grp.node.do.push(s);
}
function fl(material, shape, o = {}) { const s = {material, shape: Array.isArray(shape) ? shape.map(p => [n1(p[0]), n1(p[1])]) : shape}; if (o.c !== undefined) s.color = hex(o.c); if (o.a !== undefined) s.opacity = n2(o.a); for (const k of ['soft', 'uneven', 'angle']) if (o[k] !== undefined) s[k] = o[k]; cur.do.push(s); grp = null }
const dry = () => { cur.do.push({dry: true}); grp = null };

/* ---------- geometry ---------- */
const line = (x, y, ang, len, curv = 0, n = 4) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c };
function run(path, ok) { const m = path.length >> 1; if (!ok(path[m])) return []; let a = m, b = m; while (a > 0 && ok(path[a - 1])) a--; while (b < path.length - 1 && ok(path[b + 1])) b++; return path.slice(a, b + 1) }
const lerp = (a, b, t) => a + (b - a) * t, sm = (a, b, x) => smooth((x - a) / (b - a));
const bbox = p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]) } return [x0, y0, x1, y1] };
const inP = p => { const b = bbox(p); return q => q[0] >= b[0] && q[0] <= b[2] && q[1] >= b[1] && q[1] <= b[3] && inPoly(q[0], q[1], p) };
const BLUNT = [.6, .92, 1, 1, .92, .6], EVEN = [.85, 1, .95, 1, .9];
const KP = [[.7, 1, 1, .9, .6], [.6, .9, 1, 1, .8], [.85, 1, .85, 1, .8], [.95, 1, 1, .8, .55], [.7, .95, 1, .95, .9]], kp = () => pick(KP);   // the knife set down, pulled, lifted
const ripple = (x, y) => fbm(x / 190 + 4.2, Math.pow(Math.max(0, y - 352), .72) / 2.1 + x / 900, 3);   // long bands of swell: where the facets tip to the light, where away
// a line drawn by a hand: it wavers
const wav = (x0, y0, x1, y1, amp = 1, n = 5) => { const p = [], dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1; for (let i = 0; i <= n; i++) { const t = i / n, k = (i === 0 || i === n) ? .4 : 1, o = R(-amp, amp) * k; p.push([x0 + dx * t - dy / l * o, y0 + dy * t + dx / l * o]) } return p };

/* =====================================================================
   THE PICTURE
   ===================================================================== */
const HZ = 352;                 // the far edge of the water
const SUN = [236, 322];         // the sun, almost down, over the far shore

/* ----- sky ----- */
const SKY = [[0, '#3d4276'], [70, '#5d5890'], [140, '#a0688e'], [200, '#d97a7c'], [255, '#ef8f5c'], [305, '#f7ae4c'], [352, '#fbc866']];
function skyBase(x, y) {
  y = clamp(y + (x - 500) * .03, 0, HZ);
  let c = C(SKY[SKY.length - 1][1]);
  for (let i = 1; i < SKY.length; i++) if (y <= SKY[i][0]) { c = mixc(SKY[i - 1][1], SKY[i][1], sm(SKY[i - 1][0], SKY[i][0], y)); break }
  c = mixc(c, '#4c4a80', sm(520, 1100, x) * .4 * sm(330, 120, y) + sm(600, 1100, x) * .12);   // the side away from the sun is cooler
  const d = Math.hypot(x - SUN[0], (y - SUN[1]) * 1.25);
  c = mixc(c, '#ffd27a', Math.pow(clamp(1 - d / 300, 0, 1), 1.6) * .7);
  c = mixc(c, '#ffe9a4', Math.pow(clamp(1 - d / 110, 0, 1), 1.5) * .6);
  return c;
}
function cloudDens(x, y) {
  const near = clamp(1 - Math.hypot(x - SUN[0], y - SUN[1]) / 150, 0, 1);
  const v = fbm(x / 250 + 3.1 + y / 900, y / 78 + 7.7, 4) + .13 * (1 - y / 300) - .2 * near + .05 * sm(400, 1000, x);
  let d = sm(.5, .62, v);
  const v2 = fbm(x / 340 + 11.3, y / 20 + 2.9 + x / 1500, 3), band = sm(175, 215, y) * sm(338, 300, y);
  d = Math.max(d, band * sm(.585, .68, v2) * .85 * (1 - near));
  return d;
}
function skyAt(x, y) {
  const b = skyBase(x, y), d = cloudDens(x, y);
  if (d < .004) return b;
  const ux = SUN[0] - x, uy = SUN[1] - y, ul = Math.hypot(ux, uy) || 1;
  const lit = clamp((d - cloudDens(x + ux / ul * 20, y + uy / ul * 20 + 9)) * 1.9, 0, 1);
  const hi = sm(330, 40, y);
  let cc = mixc('#7a5f8e', '#494472', clamp(hi * .8 + sm(300, 1000, x) * .35, 0, 1));
  cc = mixc(cc, b, .14);
  let c = mixc(b, cc, d * .93);
  const lc = mixc(mixc('#f58a62', '#e07a86', hi), '#ffc27a', clamp(1 - ul / 420, 0, 1));
  return mixc(c, lc, lit * .9);
}

/* ----- far shore ----- */
const hillY = x => 340 - 26 * sm(170, -20, x) - 52 * sm(330, 640, x) - 9 * fbm(x / 60 + 5, 3.3, 3) + 5;
const hillPoly = (() => { const p = []; for (let x = -10; x <= 700; x += 10) p.push([x, hillY(x)]); p.push([700, HZ + 3], [-10, HZ + 3]); return p })();

/* ----- quay and houses: everything follows one perspective, vanishing far to the left on the horizon ----- */
const QX0 = 468, sc = x => lerp(.56, 1, (x - QX0) / (W - QX0));     // how large things are at x
const hb = x => lerp(371, 388, (x - QX0) / (W - QX0));               // the foot of the houses
const quayTop = x => lerp(379, 412, (x - QX0) / (W - QX0));          // the edge of the quay
const quayBase = x => lerp(393, 484, (x - QX0) / (W - QX0));         // where the wall meets the water
const quayPoly = [[QX0, quayTop(QX0)], [W + 10, quayTop(W + 10)], [W + 10, quayBase(W + 10)], [QX0, quayBase(QX0)]];
const headPoly = [[QX0 - 15, 383.5], [QX0, quayTop(QX0) - 1], [QX0, quayBase(QX0)], [QX0 - 15, 395.5]];   // the end of the pier, turned to the sun
const floorPoly = [[QX0 - 15, 377], [QX0 - 1, 370], [W + 10, hb(W + 10)], [W + 10, quayTop(W + 10)], [QX0, quayTop(QX0)], [QX0 - 15, 383.5]];
const HOUSES = [
  {x0: 496, xs: 508, x1: 548, hh: 62, rh: 26, wall: '#6a4a44', fc: '#4c3846', roof: '#4c3a52', win: 0, name: 'net loft'},
  {x0: 542, xs: 560, x1: 632, hh: 118, rh: 40, wall: '#d9a070', fc: '#a8705c', roof: '#7c4038', win: 2},
  {x0: 626, xs: 648, x1: 734, hh: 158, rh: 44, wall: '#e6d2b4', fc: '#b09ea8', roof: '#5a4a66', win: 3},
  {x0: 728, xs: 752, x1: 846, hh: 124, rh: 50, wall: '#cf7f62', fc: '#a05a5c', roof: '#84463a', win: 2},
  {x0: 838, xs: 868, x1: 1012, hh: 172, rh: 52, wall: '#c9b092', fc: '#9a8078', roof: '#5c4a62', win: 3}
];
for (const h of HOUSES) {
  const top = x => hb(x) - h.hh * sc(x), xm = (h.x0 + h.xs) / 2, off = h.xs - xm, rd = x => top(x) - h.rh * sc(x);
  h.top = top;
  h.side = [[h.x0, top(h.x0)], [xm, rd(xm)], [h.xs, top(h.xs)], [h.xs, hb(h.xs) + 1], [h.x0, hb(h.x0) + 1]];
  h.front = [[h.xs, top(h.xs)], [h.x1, top(h.x1)], [h.x1, hb(h.x1) + 1], [h.xs, hb(h.xs) + 1]];
  h.roofP = [[xm, rd(xm)], [h.x1 - off, rd(h.x1 - off)], [h.x1 + 2, top(h.x1) + 1], [h.xs - 1, top(h.xs) + 1]];
  h.ridge = [[xm, rd(xm)], [h.x1 - off, rd(h.x1 - off)]];
  h.frontC = C(h.fc);       // the fronts are turned from the sun
  h.sideC = mixc(warm(h.wall, .5), '#ffd9a0', .2);        // the gable ends catch it
  h.roofC = cool(h.roof, .12);
}
const WINDOWS = [];   // {x, y, w, h, lit, col}
for (const [hi, h] of HOUSES.entries()) {
  if (!h.win) continue;
  const s = sc((h.xs + h.x1) / 2), fw = h.x1 - h.xs, cols = Math.max(2, Math.round(fw / (30 * s)));
  for (let r = 0; r < h.win; r++) for (let k = 0; k < cols; k++) {
    const x = h.xs + fw * (k + .5) / cols + (hash(hi * 31 + k, r * 17 + 3) - .5) * 3, f = (r + .55) / (h.win + .18), y = lerp(h.top(x), hb(x), f);
    const ground = r === h.win - 1, door = ground && (hash(hi, 99) * cols | 0) === k;
    const lit = hash(hi * 7 + k * 13, r * 5 + 41) < (ground ? .5 : .3);
    WINDOWS.push({x, y: y + (door ? 5 * s : 0), w: (door ? 10 : 8.5) * s, h: (door ? 27 : 15) * s, lit: lit && !door, door, hi});
  }
}
// what stands at (x, y) on the quay — for the reflections. null is sky.
function quayScene(x, y) {
  if (x < QX0 - 15) return null;
  if (y > quayTop(x)) return mixc('#4a3a50', '#66504e', fbm(x / 30, y / 12, 2));
  if (y > hb(x)) return C('#b88468');
  for (let i = HOUSES.length - 1; i >= 0; i--) { const h = HOUSES[i]; if (x < h.x0 - 2 || x > h.x1 + 2) continue;
    if (inPoly(x, y, h.front)) { for (const w of WINDOWS) if (w.lit && Math.abs(x - w.x) < w.w * .9 && Math.abs(y - w.y) < w.h * .8) return C('#ffb648'); return h.frontC }
    if (inPoly(x, y, h.side)) return h.sideC;
    if (inPoly(x, y, h.roofP)) return h.roofC }
  return null;
}

/* ----- boats ----- */
// u runs from stern (0) to bow (1); dir is the way the bow points
function makeBoat(b) {
  const X = u => b.dir > 0 ? b.x0 + u * b.L : b.x0 + b.L - u * b.L;
  const sheer = u => b.wy - b.h * (.66 + .5 * Math.pow(clamp(u, 0, 1), 2.4) + .1 * Math.pow(1 - clamp(u, 0, 1), 2));
  const keel = u => b.wy + b.h * .07 * Math.sin(Math.PI * clamp(u, 0, 1));
  const far = u => sheer(u) - b.h * b.open * Math.pow(Math.sin(Math.PI * clamp(u, .02, .98)), .7);
  const hull = [], inside = [];
  for (let i = 0; i <= 14; i++) hull.push([X(i / 14), sheer(i / 14)]);
  hull.push([X(1.035), sheer(1) + b.h * .22], [X(1.0), b.wy - b.h * .2], [X(.95), b.wy + 1]);
  for (let i = 12; i >= 1; i--) hull.push([X(i / 14 * .98 + .02), keel(i / 14)]);
  hull.push([X(.005), b.wy - b.h * .02], [X(-.02), sheer(0) + b.h * .1]);
  for (let i = 0; i <= 14; i++) inside.push([X(i / 14), sheer(i / 14) + .5]);
  for (let i = 14; i >= 0; i--) inside.push([X(i / 14), far(i / 14)]);
  const mx = X(b.mast.t), my = sheer(b.mast.t) - b.h * b.open * .4;
  return Object.assign(b, {X, sheer, keel, far, hullP: hull, insideP: inside, mastFoot: [mx, my], mastTop: [mx + b.mast.lean * b.mast.h, my - b.mast.h], isHull: inP(hull), isInside: inP(inside)});
}
const BOATS = [
  makeBoat({name: 'far boat', x0: 384, L: 104, wy: 431, h: 19, dir: -1, open: .2, hull: '#a8523a', band: '#3d3550', rail: '#f2c090', in: '#4a3038', mast: {t: .46, h: 112, lean: .02}, sail: '#d9b48a'}),
  makeBoat({name: 'cream boat', x0: 664, L: 196, wy: 531, h: 36, dir: 1, open: .24, hull: '#e9d6b6', band: '#7a3a34', rail: '#3f6a70', in: '#5a3c38', mast: {t: .5, h: 236, lean: -.025}, sail: '#b98a5c', cabin: [.12, .36]}),
  makeBoat({name: 'dark boat', x0: 52, L: 168, wy: 497, h: 29, dir: 1, open: .2, hull: '#2d2a4c', band: '#5a2c34', rail: '#e08a58', in: '#2e2233', mast: {t: .42, h: 196, lean: .03}, sail: '#7a3c36'}),
  makeBoat({name: 'green boat', x0: 318, L: 338, wy: 652, h: 64, dir: -1, open: .3, hull: '#2c6a72', band: '#b3482c', rail: '#f3dcae', in: '#6a4634', mast: {t: .44, h: 430, lean: -.018}, sail: '#b4502e'})
];
const inAnyBoat = p => BOATS.some(b => b.isHull(p) || b.isInside(p));
const isWater = p => p[1] > HZ + 1 && !(p[0] > QX0 - 15 && p[1] < quayBase(Math.max(p[0], QX0)) + 1);

/* ----- water: it mirrors the sky above it, darker and cooler, more so toward us ----- */
function waterAt(x, y) {
  const d = clamp((y - HZ) / (H - HZ), 0, 1);
  const sy = HZ - (y - HZ) * .78, wob = 26 * (fbm(x / 90, y / 14, 2) - .5) * (1 + d * 2);
  let c = skyAt(x + wob, clamp(sy, 0, HZ - 2));
  c = mixc(c, '#2f2e62', .1 + .34 * Math.pow(d, .85));
  if (y < HZ + 40 && x < 640) { const hy = HZ - (y - HZ) * 1.0; if (hy > hillY(x + wob * .4)) c = mixc(c, '#5a4a72', .55) }   // the far shore in the water
  return c;
}
const sunPath = (x, y) => { const w = 15 + (y - HZ) * .15, cx = SUN[0] + 5 * Math.sin(y / 23); return Math.exp(-Math.pow((x - cx) / w, 2)) };

/* ===================================================================== painting ===================================================================== */

stage('Lay-in', 'On a warm sienna ground, the big areas thinly in their own colours: nothing later has to cover bare canvas.');
for (let y = 0; y < HZ; y += 22) for (let x = 0; x < W; x += 125) fl('thin', {rect: [x - 6, y - 4, x + 131, y + 26]}, {c: skyAt(x + 62, y + 11), soft: 5, angle: R(-.3, .1)});
for (let y = HZ; y < H; y += 28) for (let x = 0; x < W; x += 125) fl('thin', {rect: [x - 6, y - 3, x + 131, y + 31]}, {c: mixc(waterAt(x + 62, y + 14), '#3a3566', .18), soft: 5, angle: R(-.1, .1)});
dry();

stage('Sky', 'Brushed wet into wet with a broad bristle, from violet overhead through rose to orange and yellow over the far shore.');
for (let i = 0; i < 1250; i++) {
  const x = R(-30, W + 30), y = R(-12, HZ + 6), yy = clamp(y, 2, HZ - 2), cd = cloudDens(x, yy);
  const near = clamp(1 - Math.hypot(x - SUN[0], y - SUN[1]) / 260, 0, 1);
  const ang = -.1 + R(-.28, .28) + (cd > .3 ? R(-.2, .2) : 0) + near * R(-.5, .5);
  st('soft', 'bristle', line(x, y, ang, R(46, 120) * (1 - near * .4), R(-.5, .5)), {w: R(17, 36) * (1 - near * .3), c: jc(skyAt(x, yy), .022), c2: jc(skyAt(x + R(-40, 40), clamp(yy + R(-16, 16), 2, HZ - 2)), .02)});
}

stage('Clouds', 'The cloud bodies in cool violet, their undersides turned to the sun in rose and orange, smaller touches worked into the wet sky.');
for (let i = 0, n = 0; n < 820 && i < 30000; i++) {
  const x = R(-20, W + 20), y = R(0, HZ - 14), d = cloudDens(x, y);
  if (d < .25 || rnd() > d + .15) continue; n++;
  st('paint', rnd() < .55 ? 'filbert' : 'flat', line(x, y, -.1 + R(-.5, .45), R(22, 64), R(-.9, .9), 5), {w: R(10, 24), pr: BLUNT, c: jc(skyAt(x, y), .03), c2: jc(skyAt(x + R(-18, 18), clamp(y + R(4, 16), 0, HZ - 2)), .025)});
}
// clear sky seen between the clouds, restated so the cloud edges are found again
for (let i = 0, n = 0; n < 260 && i < 20000; i++) {
  const x = R(0, W), y = R(20, HZ - 10), d = cloudDens(x, y);
  if (d > .06 || cloudDens(x + R(-40, 40), y + R(-26, 26)) < .4) continue; n++;
  st('paint', 'flat', line(x, y, -.1 + R(-.35, .35), R(24, 60), R(-.5, .5)), {w: R(9, 18), c: jc(mixc(skyBase(x, y), '#ffd9a0', .08), .025)});
}
dry();

stage('Sky lights', 'Thick clean paint put down last and left alone: lit cloud edges, the glow, the sun itself.');
for (let i = 0, n = 0; n < 190 && i < 60000; i++) {
  const x = R(0, W), y = R(10, HZ - 16), d = cloudDens(x, y);
  if (d < .12 || d > .8) continue;
  const ux = SUN[0] - x, uy = SUN[1] - y, ul = Math.hypot(ux, uy) || 1, lit = (d - cloudDens(x + ux / ul * 20, y + uy / ul * 20 + 9)) * 1.9;
  if (lit < .4) continue; n++;
  const near = clamp(1 - ul / 520, 0, 1), c = mixc(mixc('#ea8a86', '#f79a5e', sm(40, 300, y)), '#ffd08a', near * .75);
  st(rnd() < .45 ? 'impasto' : 'firm', rnd() < .5 ? 'filbert' : 'flat', line(x, y, -.1 + R(-.3, .3), R(24, 66), R(-.5, .5), 5), {w: R(7, 14), pr: BLUNT, c: jc(c, .025), c2: jc(mixc(c, skyAt(x, y), .5), .025)});
}
for (let i = 0; i < 120; i++) {   // the glow round the sun: long level touches, palest nearest to it
  const a = R(Math.PI, Math.PI * 2), r = 20 + Math.pow(rnd(), 1.3) * 150, x = SUN[0] + Math.cos(a) * r * 1.6, y = SUN[1] + Math.sin(a) * r * .66;
  if (y > hillY(x) - 3 || y < 200 || cloudDens(x, y) > .5) continue;
  const t = clamp(r / 160, 0, 1);
  st(rnd() < .5 ? 'impasto' : 'firm', 'flat', line(x, y, R(-.16, .16), R(26, 64) * (1 - t * .3), (x < SUN[0] ? -1 : 1) * R(0, .35), 5), {w: R(7, 14), pr: BLUNT, c: jc(mixc('#ffe6a0', mixc('#ffc468', '#f99a58', sm(320, 230, y)), Math.pow(t, .6)), .02), c2: jc(skyAt(x, y), .02)});
}
cur.do.push({at: [SUN[0], SUN[1]], r: 12.5, material: 'firm', color: '#fff8dc', soft: .4}); grp = null;
for (let i = 0; i < 6; i++) { const a = R(0, Math.PI * 2), x = SUN[0] + Math.cos(a) * 14.5, y = SUN[1] + Math.sin(a) * 13; if (y > SUN[1] + 9) continue; st('firm', 'filbert', line(x, y, R(-.25, .25), R(9, 15), R(-.5, .5), 4), {w: R(4, 6), pr: BLUNT, c: jc(skyBase(x, y), .015)}) }   // the sky closes on its edge: no compass drew it
st('firm', 'flat', line(SUN[0] + 3, SUN[1] + 5.5, -.04, 30, .1), {w: 2.6, c: '#ffc874'}); st('firm', 'flat', line(SUN[0] - 6, SUN[1] + 10, .03, 22, -.1), {w: 2.2, c: '#f9b060'});   // two bars of low cloud across it

stage('Far shore', 'A low headland across the water, violet against the light, warmer where the sun goes down behind it.');
fl('under', hillPoly, {c: '#6f5c86', soft: 2});
const onHill = p => p[1] > hillY(p[0]) - 1.5 && p[1] < HZ + 4;
for (let i = 0; i < 300; i++) {
  const x = R(-10, 690), hy = hillY(x), y = R(hy, HZ + 2), near = clamp(1 - Math.abs(x - SUN[0]) / 190, 0, 1), top = clamp(1 - (y - hy) / 16, 0, 1);
  let c = mixc(mixc('#6d5a88', '#55497a', sm(300, 650, x)), '#b56a70', near * .75);
  c = mixc(c, '#f0a070', near * top * .5); c = mixc(c, '#8a6e96', (1 - top) * .25);
  st('paint', 'flat', run(line(x, y, R(-.15, .12), R(18, 46), R(-.3, .3), 6), onHill), {w: R(5, 11), c: jc(c, .025)});
}
for (let i = 0; i < 16; i++) { const x = R(330, 480); st('firm', 'round', line(x, R(338, 349), 0, R(2, 5)), {w: R(1.6, 2.6), pr: EVEN, c: jc(pick(['#ffc870', '#f7a860', '#e9d2b0']), .03)}) }   // a village on the far side
dry();

stage('Water, brushed', 'The whole harbour first with a bristle brush: the sky upside down, darker and cooler toward us.');
for (let i = 0; i < 950; i++) {
  const y = HZ + Math.pow(rnd(), 1.25) * (H - HZ + 10), x = R(-30, W + 30), k = (y - HZ) / (H - HZ);
  st('paint', 'bristle', line(x, y, R(-.05, .05), R(30, 70) + k * 80, R(-.12, .12)), {w: 5 + k * 20 + R(0, 6), c: jc(waterAt(x, y), .025), c2: jc(waterAt(x + R(-30, 30), y + R(-8, 8)), .025)});
}
dry();

stage('Quay and houses', 'A stone pier with a row of houses: fronts in shadow, gable ends and the quay itself in the last sun.');
fl('under', floorPoly, {c: '#c08a6a'}); fl('under', quayPoly, {c: '#54424e'}); fl('under', headPoly, {c: '#e29a6c'});
for (const h of HOUSES) {
  const s = sc((h.x0 + h.x1) / 2), isF = inP(h.front), isS = inP(h.side), isR = inP(h.roofP), fb = bbox(h.front), sb = bbox(h.side), rb = bbox(h.roofP);
  fl('under', h.front, {c: h.frontC}); fl('under', h.side, {c: h.sideC}); fl('under', h.roofP, {c: h.roofC});
  // front: brushed up and down, lighter and cooler high up under the sky, warmer low where the quay throws light back
  for (let i = 0, n = Math.round((fb[2] - fb[0]) * (fb[3] - fb[1]) / 46); i < n; i++) {
    const x = R(fb[0], fb[2]), y = R(fb[1], fb[3]), f = (y - h.top(x)) / (hb(x) - h.top(x));
    let c = mixc(h.frontC, '#8a7aa6', (1 - f) * .2); c = mixc(c, warm(h.wall, .25), sm(.5, 1, f) * .32); c = mixc(c, '#4a3a62', sm(h.xs, h.x1, x) * .16);
    st('paint', 'flat', run(line(x, y, (rnd() < .25 ? 0 : Math.PI / 2) + R(-.22, .22), R(12, 30) * s + 4, R(-.3, .3), 6), isF), {w: R(6, 12) * s + 2, c: jc(mixc(c, rnd() < .15 ? warm(h.wall, .2) : c, .4), .02)});
  }
  // roof: along the slope
  for (let i = 0, n = Math.round((rb[2] - rb[0]) * (rb[3] - rb[1]) / 40); i < n; i++) {
    const x = R(rb[0], rb[2]), y = R(rb[1], rb[3]), f = clamp((y - rb[1]) / (rb[3] - rb[1]), 0, 1);
    const c = mixc(mixc(h.roofC, '#c0766a', (1 - f) * .3), '#3a3158', rnd() < .25 ? .3 : 0);
    st('paint', 'flat', run(line(x, y, R(-.06, .1), R(12, 28) * s + 3, 0, 6), isR), {w: R(4, 7) * s + 1.5, c: jc(c, .03)});
  }
  dry();
  // gable end in the sun: knife, top to bottom
  for (let i = 0, n = Math.round((sb[2] - sb[0]) * (sb[3] - sb[1]) / 30); i < n; i++) {
    const x = R(sb[0], sb[2]), y = R(sb[1], sb[3]), f = clamp((y - sb[1]) / (sb[3] - sb[1]), 0, 1);
    st('slab', 'knife small', run(line(x, y, Math.PI / 2 + R(-.1, .1), R(10, 24) * s + 3, 0, 6), isS), {w: R(4, 8) * s + 1.5, c: jc(mixc(h.sideC, '#f58a5a', f * .3 + R(0, .15)), .03)});
  }
  { const xm = (h.x0 + h.xs) / 2, ry = h.ridge[0][1];
    st('firm', 'round', wav(xm, ry, h.xs, h.top(h.xs) + 1, .5, 3), {w: 2.2 * s + 1, pr: EVEN, c: jc(mixc(h.roofC, '#2e2848', .4), .02)});
    st('impasto', 'round', wav(h.x0 - .5, h.top(h.x0) + 1, xm, ry, .5, 3), {w: 1.5 * s + .7, pr: EVEN, c: jc('#ffd4a4', .02)}) }
  // ridge and eaves catch the light; a chimney
  st('impasto', 'round', wav(h.ridge[0][0], h.ridge[0][1], h.ridge[1][0], h.ridge[1][1], .8, 4), {w: 2.2 * s + .8, pr: EVEN, c: jc('#f6a878', .03)});
  st('dark', 'round', wav(h.xs, h.top(h.xs) + 2 * s, h.x1, h.top(h.x1) + 2 * s, .7, 5), {w: 2 * s + .6, pr: EVEN, c: jc('#342c4e', .02), a: .85});
  if (h.win) { const cx = lerp(h.ridge[0][0], h.ridge[1][0], .3 + hash(h.x0, 5) * .5), cy = lerp(h.ridge[0][1], h.ridge[1][1], .5), cw = 9 * s, ch = 20 * s;
    st('firm', 'flat', [[cx, cy + 4 * s], [cx, cy - ch]], {w: cw, c: jc(cool(h.wall, .45), .02)});
    st('impasto', 'flat', [[cx - cw * .32, cy + 3 * s], [cx - cw * .32, cy - ch]], {w: cw * .4, c: jc('#f7b07a', .02)});
    st('dark', 'flat', [[cx - cw * .6, cy - ch], [cx + cw * .6, cy - ch]], {w: 3 * s, c: '#3a2e44'}) }
}
for (const w of WINDOWS) {
  const s = w.w / 8.5;
  if (w.lit) {
    st('firm', 'touch', wav(w.x, w.y - w.h * .56, w.x, w.y + w.h * .56, .3, 2), {w: w.w * 1.25, c: jc('#4a3040', .02)});
    st('impasto', 'touch', wav(w.x + R(-.5, .5), w.y - w.h * .42, w.x, w.y + w.h * .42, .3, 2), {w: w.w * .86, c: jc(mixc('#ffb040', '#ffe08a', R(0, .8)), .02), c2: '#f58a3a'});
    if (rnd() < .6) st('dark', 'round', [[w.x, w.y - w.h * .44], [w.x + R(-.3, .3), w.y + w.h * .44]], {w: 1.1 * s, pr: EVEN, c: '#5a3530'});
  } else {
    st('dark', 'touch', wav(w.x, w.y - w.h / 2, w.x + R(-.6, .6), w.y + w.h / 2, .3, 2), {w: w.w * R(.9, 1.1), c: jc(w.door ? '#3a2a36' : '#33283e', .02), c2: jc('#463a56', .02)});
    if (!w.door && rnd() < .5) st('firm', 'round', [[w.x - w.w * .3, w.y - w.h * .3], [w.x + w.w * .1, w.y - w.h * .36]], {w: 1.5 * s, pr: EVEN, c: jc('#b08a98', .03)});   // a pane that still holds the sky
  }
  if (!w.door) st('firm', 'round', wav(w.x - w.w * .7, w.y + w.h * .58, w.x + w.w * .7, w.y + w.h * .58, .3, 2), {w: 1.6 * s, pr: EVEN, c: jc('#cdb7a8', .03), a: .8});   // sill
}
// gable-end windows, dark in the bright wall
for (const h of HOUSES) if (h.win) { const s = sc(h.x0), x = (h.x0 + h.xs) / 2 + .5, y = lerp(h.top(x), hb(x), .32); st('dark', 'touch', [[x, y - 6 * s], [x, y + 6 * s]], {w: 5 * s, c: '#6a4450'}) }
// the quay floor, raked by the sun
const isFloor = inP(floorPoly);
for (let i = 0; i < 170; i++) { const x = R(QX0 - 14, W + 5), y = R(hb(Math.max(x, QX0)) - 1, quayTop(Math.max(x, QX0))), k = sm(QX0, W, x);
  st('slab', 'knife small', run(line(x, y, .045, R(14, 44), 0, 6), isFloor), {w: R(2.5, 4) + k * 5, c: jc(mixc(mixc('#f0ac78', '#d98a6c', rnd()), '#8a6478', rnd() < .28 ? .7 : 0), .03)}) }
// long shadows of the houses across it are already there in the darker touches; now the wall, stone by stone, with the knife
const isWall = inP(quayPoly), wallAng = Math.atan2(quayBase(W) - quayBase(QX0) + quayTop(W) - quayTop(QX0), 2 * (W - QX0));
const STONE = ['#5a4654', '#6a5050', '#4e3f56', '#735a52', '#453a52', '#5f4c5c', '#7c6054'];
for (let i = 0; i < 900; i++) {
  const x = QX0 + Math.pow(rnd(), .8) * (W + 8 - QX0), t = rnd(), y = lerp(quayTop(x) + 1, quayBase(x), t), s = sc(x);
  let c = mixc(pick(STONE), '#2a2640', sm(.6, 1, t) * .6); c = mixc(c, '#b07a62', sm(.22, 0, t) * .3);
  st('slab', 'knife small', run(line(x, y, wallAng * lerp(.4, 1.6, t) + R(-.03, .03), R(9, 26) * s + 3, 0, 6), isWall), {w: R(4, 8.5) * s + 1, c: jc(c, .035)});
}
for (let i = 0; i < 70; i++) { const x = R(QX0, W), s = sc(x); st('dark', 'flat', line(x, quayBase(x) - R(0, 7) * s, wallAng * 1.6 + R(-.08, .08), R(8, 24) * s), {w: R(2.5, 6) * s, c: jc(pick(['#2a2742', '#2f3a34', '#2c3040', '#3b2f3a', '#252238']), .02)}) }   // weed and wet at the foot
for (let x = QX0 - 12; x < W; ) { const l = R(16, 50), xa = Math.max(x, QX0); st('dark', 'round', wav(x, quayBase(xa) + .5, x + l, quayBase(Math.max(x + l, QX0)) + .5, .7, 3), {w: 1.6 + sc(xa) * 2.4, pr: EVEN, c: jc('#221f36', .015)}); x += l - 3 }
dry();
for (let x = QX0; x < W; ) { const l = R(14, 60); st('impasto', 'round', wav(x, quayTop(x) + .5, x + l, quayTop(x + l) + .5, .5, 3), {w: 1.6 + sc(x) * 1.6, pr: EVEN, c: jc(mixc('#ffc890', '#f39a6a', rnd()), .03)}); x += l + (rnd() < .3 ? R(3, 12) : -2) }   // the lit edge of the quay
{ const isHd = inP(headPoly); for (let i = 0; i < 16; i++) st('slab thick', 'knife small', run(line(R(QX0 - 14, QX0), R(382, 396), Math.PI / 2 + R(-.1, .1), R(6, 12), 0, 5), isHd), {w: R(3, 5), c: jc(mixc('#ffb880', '#ee8a62', rnd()), .03)}) }
// the harbour light on the pier head
{ const x = QX0 + 4, y0 = 376, y1 = 334;
  st('firm', 'flat', wav(x, y0, x + .5, y1, .4, 3), {w: 9, c: '#8f7a98', c2: '#6a5a84'});
  st('impasto', 'flat', wav(x - 2.6, y0, x - 2.2, y1 + 1, .3, 3), {w: 3.6, c: '#ffe2bc'});
  st('firm', 'flat', [[x - 6, y1 - 1], [x + 6.5, y1 - 1]], {w: 3, c: '#3a2e44'});
  st('firm', 'flat', [[x, y1 - 2], [x + .3, y1 - 12]], {w: 6.5, c: '#a8362c', c2: '#d95a3a'});
  st('impasto', 'round', [[x - 1, y1 - 5], [x + 1, y1 - 8]], {w: 3, pr: EVEN, c: '#fff2c0'});
  st('firm', 'round', [[x - 3, y1 - 13], [x, y1 - 17], [x + 3.4, y1 - 13]], {w: 2.4, pr: EVEN, c: '#3a2e44'}) }
// bollards, a few people, a heap of pots and nets
for (const x of [520, 596, 690, 792, 905, 978]) { const s = sc(x), y = quayTop(x) - 1.5 * s; st('dark', 'round', [[x, y], [x, y - 7 * s]], {w: 4.5 * s, pr: EVEN, c: '#2e2840'}); st('impasto', 'round', [[x - 1.4 * s, y - 1], [x - 1.4 * s, y - 6.5 * s]], {w: 1.5 * s, pr: EVEN, c: '#f7a870'}) }
for (const [x, col] of [[575, '#3c3458'], [583, '#6a3038'], [706, '#33405a'], [826, '#4a3048'], [941, '#2f3a50'], [950, '#7a4634']]) { const s = sc(x), y = lerp(hb(x), quayTop(x), .55);
  st('dark', 'round', wav(x, y, x + R(-1, 1), y - 15 * s, .5, 2), {w: 5 * s, pr: [.7, 1, .9], c: jc(col, .02)});
  st('firm', 'round', [[x - .5, y - 16.5 * s], [x + .5, y - 19 * s]], {w: 3.4 * s, pr: EVEN, c: jc('#d99a7a', .03)});
  st('impasto', 'round', [[x - 1.8 * s, y - 3 * s], [x - 1.6 * s, y - 14 * s]], {w: 1.3 * s, pr: EVEN, c: '#ffb070'});
  st('dark', 'flat', [[x + 1, y + .5], [x + 22 * s, y + 2.5 * s]], {w: 2.2 * s, c: '#6a4a62', a: .75}) }   // a long shadow
for (let i = 0; i < 16; i++) { const x = R(752, 790), s = sc(x), y = lerp(hb(x), quayTop(x), R(.2, .7)) - R(0, 9); st('firm', 'filbert', line(x, y, R(-.4, .4), R(6, 12), R(-1, 1)), {w: R(4, 7), pr: BLUNT, c: jc(pick(['#5a3f3a', '#3a4a52', '#7a5038', '#c98248', '#2f2a44']), .03)}) }
dry();

stage('Water, knife', 'Slabs laid flat with the palette knife over the brushed water, small and close far off, long and thick near us.');
const waterOK = p => isWater(p);
for (let i = 0; i < 2700; i++) {
  const y = HZ + 2 + Math.pow(rnd(), 1.45) * (H - HZ + 6), x = R(-20, W + 20), k = (y - HZ) / (H - HZ);
  let c = waterAt(x, y);
  const q = ripple(x, y) + R(-.1, .1);   // the swell: facets tipped to the bright low sky, facets tipped away
  if (q > .58) c = mixc(c, skyBase(x, clamp(HZ - (y - HZ) * .3, 210, HZ)), sm(.58, .7, q) * .6); else if (q < .44) c = mixc(c, '#2a2b5e', sm(.44, .32, q) * (.22 + k * .3));
  if (rnd() < .06) c = mixc(c, '#e88a80', .3);
  const long = rnd() < .18;
  st(rnd() < .2 ? 'drag' : 'slab', k < .2 ? 'knife small' : 'palette', run(line(x, y, R(-.07, .07), (R(12, 34) + k * R(30, 100)) * (long ? 1.7 : 1), R(-.14, .14), 5), waterOK), {w: (2.6 + k * R(6, 17) + R(0, 2)) * (long ? .7 : 1), pr: kp(), c: jc(c, .025), c2: jc(c, .035)});
}

stage('Reflections of the quay', 'Wall, houses and lit windows upside down in the water, broken into bars that slide apart as they come nearer.');
for (let i = 0; i < 1900; i++) {
  const x = R(QX0 - 20, W + 10), xb = Math.max(x, QX0), wb = quayBase(xb), reach = (wb - HZ) * 2.2 + 190 * sc(xb), d = Math.pow(rnd(), 1.25) * reach, y = wb + 1 + d;
  if (y > H + 5) continue;
  const sx = x + R(-1, 1) * (3 + d * .09), src = quayScene(sx, wb - d * .96 - 1);
  if (!src) continue;
  const f = d / reach; if (rnd() < f * .62) continue;
  const k = (y - HZ) / (H - HZ), isLamp = src[0] > .95 && src[2] < .4;
  const lum = .3 * src[0] + .59 * src[1] + .11 * src[2];
  let c = mixc(src, waterAt(x, y), .12 + f * .4); c = mixc(c, '#272450', isLamp ? 0 : lum > .62 ? .06 : .34 - f * .1); if (lum > .62) c = mixc(c, '#f58a4a', .25);
  st('slab', k < .22 ? 'knife small' : 'palette', run(line(x, y, R(-.06, .06), R(10, 26) + k * R(16, 60), R(-.1, .1), 6), waterOK), {w: 2.6 + k * R(6, 13), pr: kp(), c: jc(c, .028), c2: jc(c, .035)});
}
for (let x = QX0 - 10; x < W; x += R(20, 70)) { const xa = Math.max(x, QX0), k = (quayBase(xa) - HZ) / (H - HZ); st('slab thick', 'knife small', run(line(x, quayBase(xa) + 2.5 + k * 3 + R(0, 1.5), wallAng * 1.6, R(8, 24), 0, 5), waterOK), {w: 1.5 + k * 3, pr: kp(), c: jc(mixc('#e9a08a', '#c08aa0', rnd()), .03)}) }
for (const w of WINDOWS) if (w.lit) {   // the lamps go down into the water as wavering columns
  const wb = quayBase(w.x), d0 = wb - w.y;
  for (let j = 0; j < 9; j++) { const d = d0 * .96 + R(-6, 26) + j * R(3, 9), y = wb + d, k = (y - HZ) / (H - HZ); if (y > H) break;
    if (rnd() < .25) continue;
    st('slab thick', 'knife small', run(line(w.x + Math.sin(y / 9 + w.x) * (2 + d * .03) + R(-3, 3), y, R(-.05, .05), R(7, 15) + k * 22, 0, 5), waterOK), {w: R(2.5, 4) + k * 5, c: jc(mixc('#ffbe58', '#f0803e', clamp(j / 9 + R(-.2, .2), 0, 1)), .03)}) }
}
dry();

stage('The sun on the water', 'The brightest paint in the picture, thick from the knife: a broken path of light from the far shore to the bottom edge, and stray glints.');
const glintOK = p => waterOK(p) && !inAnyBoat(p);
for (let i = 0, n = 0; n < 330 && i < 30000; i++) {
  const y = HZ + 2 + Math.pow(rnd(), 1.5) * (H - HZ), k = (y - HZ) / (H - HZ), w = 15 + (y - HZ) * .15, x = SUN[0] + R(-2.2, 2.2) * w;
  if (rnd() > sunPath(x, y) * (1 - k * .35)) continue; n++;
  const core = sunPath(x, y);
  const c = mixc(mixc('#f78a48', '#ffc060', core), '#fff0b0', core * core * (1 - k * .55));
  st(rnd() < .2 ? 'drag' : 'slab thick', k < .25 ? 'knife small' : 'palette', run(line(x, y, R(-.06, .06), R(8, 20) + k * R(20, 70), R(-.12, .12), 6), glintOK), {w: 2 + k * R(4, 11), pr: kp(), c: jc(c, .025), c2: jc(c, .03)});
}
for (let i = 0, n = 0; n < 190 && i < 20000; i++) {   // rose and gold glints where the swell tips to the bright sky
  const y = HZ + 6 + Math.pow(rnd(), 1.2) * (H - HZ), x = R(0, W), k = (y - HZ) / (H - HZ);
  if (ripple(x, y) < .56 || rnd() < sm(350, 950, x) * .55) continue; n++;
  st('slab thick', k < .25 ? 'knife small' : 'palette', run(line(x, y, R(-.06, .06), R(8, 18) + k * R(10, 50), R(-.12, .12), 6), glintOK), {w: 1.8 + k * R(3, 7), pr: kp(), c: jc(mixc(pick(['#f7a070', '#f0908a', '#ffc078', '#f2a48e', '#f9b48a']), waterAt(x, y), .2), .03)});
}
for (let i = 0, n = 0; n < 190 && i < 20000; i++) {   // and deep cool troughs near us
  const y = 500 + Math.pow(rnd(), .8) * 310, x = R(0, W), k = (y - HZ) / (H - HZ);
  if (ripple(x, y) > .47) continue; n++;
  st('slab', 'palette', run(line(x, y, R(-.06, .06), R(20, 80) * k + 12, R(-.12, .12), 6), glintOK), {w: 2 + k * R(4, 9), pr: kp(), c: jc(mixc(pick(['#2c2c62', '#3a3470', '#283458', '#42366a']), waterAt(x, y), .15), .025)});
}
dry();

/* ----- a boat: its reflection first, then the hull, the inside, the spars ----- */
function reflectBoat(b) {
  const ok = p => waterOK(p) && !inAnyBoat(p), n = Math.round(b.L * b.h / 7.5), reach = b.h * 1.6, k0 = (b.wy - HZ) / (H - HZ);
  for (let i = 0; i < n; i++) {
    const u = R(-.02, 1.03), d = Math.pow(rnd(), 1.3) * reach, f = d / reach; if (rnd() < f * .5 - .05 || Math.abs(u - .5) > .56 - f * .14) continue;
    const x = b.X(u) + R(-1, 1) * (2 + d * .3), y = b.keel(u) + 1 + d;
    let c = f < .17 ? mixc(b.band, '#241f3c', .45) : mixc(b.hull, '#24244a', b.lum > .5 ? .3 : .3);
    c = mixc(c, waterAt(x, y), .05 + f * .3);
    st('slab', k0 < .3 ? 'knife small' : 'palette', run(line(x, y, R(-.06, .06), (R(9, 22) + k0 * R(14, 50)) * (1 - f * .3), R(-.1, .1), 6), ok), {w: 2.4 + k0 * R(5, 11), pr: kp(), c: jc(c, .028), c2: jc(c, .03)});
  }
  for (let i = 0; i < n * .05; i++) {   // the water's own light cutting back into it
    const u = R(0, 1), d = R(.22, 1) * reach, x = b.X(u) + R(-12, 12), y = b.keel(u) + 1 + d;
    st('slab', k0 < .3 ? 'knife small' : 'palette', run(line(x, y, R(-.06, .06), R(10, 24) + k0 * R(14, 60), R(-.1, .1), 6), ok), {w: 2 + k0 * R(3, 8), pr: kp(), c: jc(waterAt(x, y), .03)}) }
  // the mast in the water: a broken, snaking line
  const [mx] = b.mastFoot, mh = b.mast.h * .92, dark = mixc('#3a2a36', '#2a2850', .5);
  for (let d = b.h * .9; d < mh; d += R(5, 12) * (1 + k0)) { const y = b.wy + d, f = d / mh; if (y > H + 4) break; if (rnd() < .12 + f * .3) continue;
    const x = mx - b.mast.lean * d + Math.sin(d / (11 + k0 * 14) + b.x0) * (2.5 + d * .05) * (1 + k0);
    st('slab', 'knife small', run(line(x, y, R(-.1, .1), R(6, 13) * (1 + k0 * 1.6), 0, 5), ok), {w: R(2.4, 4) * (1 + k0 * 1.4), c: jc(mixc(dark, waterAt(x, y), f * .5), .025)});
    if (rnd() < .35) st('slab thick', 'knife small', run(line(x - R(5, 9) * (1 + k0), y + R(-2, 2), R(-.1, .1), R(5, 10) * (1 + k0), 0, 5), ok), {w: R(1.8, 3) * (1 + k0), c: jc('#f7a468', .03)}) }
}
function paintBoat(b) {
  const sunSide = u => clamp(b.dir < 0 ? u : 1 - u, 0, 1);   // the end turned to the sun
  const s = b.h / 36, lum = b.lum;
  fl('under', b.insideP, {c: b.in}); fl('under', b.hullP, {c: cool(b.hull, .3)});
  // inside: the far planking, thwarts
  for (let i = 0; i < 26 * s + 8; i++) { const u = R(.03, .97), y = lerp(b.far(u), b.sheer(u), R(.1, .9));
    st('dark', 'flat', run(line(b.X(u), y, R(-.1, .1), R(10, 26) * s, 0, 5), b.isInside), {w: R(3, 6) * s, c: jc(mixc(b.in, warm(b.in, .5), sunSide(u) * .5 + (y < lerp(b.far(u), b.sheer(u), .4) ? .25 : 0)), .03)}) }
  for (const u of [.24, .5, .74]) { const x = b.X(u), o = b.dir * b.L * .012; st('firm', 'flat', run([[x + o, b.far(u) + 1], [x + o * .5, lerp(b.far(u), b.sheer(u), .5)], [x, b.sheer(u) - 1]], b.isInside), {w: 3.6 * s + .6, c: jc(warm(b.in, .45), .03)}) }
  // the hull in planks that follow the sheer
  const rows = Math.max(4, Math.round(b.h / 6.5));
  for (let r = 0; r < rows; r++) for (let j = 0; j < 7; j++) {
    const f = (r + R(.2, .8)) / rows, u0 = R(-.04, .9), u1 = u0 + R(.12, .3), pts = [];
    for (let k = 0; k <= 6; k++) { const u = lerp(u0, u1, k / 6); pts.push([b.X(u), lerp(b.sheer(u), b.keel(u), f) + R(-.6, .6)]) }
    const um = (u0 + u1) / 2, li = sunSide(um);
    let c = f > .72 ? b.band : b.hull;
    c = mixc(cool(c, .12 + .3 * (1 - li)), warm(c, .4), Math.pow(li, 1.6) * .75);   // shadow toward one end, sun toward the other
    c = mixc(c, mixc(c, '#ffffff', .25), (1 - f) * .3); c = mixc(c, '#231f3a', sm(.8, 1, f) * .35);
    st(lum > .5 || r % 2 ? 'paint' : 'dark', 'flat', run(pts, b.isHull), {w: b.h / rows * 1.5 + R(0, 1.5), c: jc(c, .02), c2: jc(c, .025)});
  }
  dry();
  // knife lights on the sunward end, and the sky on the turn of the bilge
  for (let i = 0; i < 6 * s + 3; i++) { const u = b.dir < 0 ? R(.72, 1) : R(0, .24), f = R(.08, .5);
    st('slab', 'knife small', run(line(b.X(u), lerp(b.sheer(u), b.keel(u), f), (b.dir < 0 ? -1 : 1) * b.dir * R(.1, .3) * (b.dir < 0 ? -1 : 1) * 0 + R(-.12, .12), R(8, 22) * s, 0, 5), b.isHull), {w: R(3, 5) * s + 1, pr: kp(), c: jc(mixc(warm(b.hull, .34), '#ffd9a0', R(0, .12)), .02)}) }
  for (let i = 0; i < 3 * s + 2; i++) { const u = R(.1, .9); st('drag', 'knife small', run(line(b.X(u), lerp(b.sheer(u), b.keel(u), R(.5, .66)), R(-.05, .05), R(14, 30) * s, 0, 5), b.isHull), {w: R(2, 3.2) * s + .6, pr: kp(), c: jc(mixc(b.hull, '#9a86b0', .3), .02)}) }
  // rails: far one thin, near one thick and lit
  const rail = (fn, w, col, dy) => { for (let u0 = 0; u0 < 1; ) { const u1 = Math.min(1, u0 + R(.14, .34)), pts = []; for (let k = 0; k <= 4; k++) { const u = lerp(u0, u1, k / 4); pts.push([b.X(u), fn(u) + dy + R(-.35, .35)]) }
    const li = sunSide((u0 + u1) / 2); st('impasto', 'round', pts, {w: w * R(.85, 1.15), pr: EVEN, c: jc(mixc(cool(col, .35), warm(col, .3), li), .03)}); if (u1 >= 1) break; u0 = u1 - .01 } };
  rail(b.far, 1.6 * s + .7, mixc(b.rail, b.in, .3), 0); rail(b.sheer, 2.6 * s + 1, b.rail, .6 * s);
  // stem and stern posts
  st('dark', 'round', wav(b.X(1.0), b.sheer(1) - 3 * s, b.X(1.03), b.sheer(1) + b.h * .2, .4, 3).concat([[b.X(.975), b.wy - 1]]), {w: 2.6 * s + 1, pr: EVEN, c: jc(mixc(b.band, '#2a2440', .5), .02)});
  st('dark', 'round', wav(b.X(-.012), b.sheer(0) - 1, b.X(.002), b.wy - 1, .4, 3), {w: 2.4 * s + 1, pr: EVEN, c: jc(mixc(b.band, '#2a2440', .5), .02)});
  if (b.dir < 0) st('impasto', 'round', wav(b.X(1.03) - 1, b.sheer(1) - 2 * s, b.X(1.04) - 1, b.sheer(1) + b.h * .2, .3, 2), {w: 1.2 * s + .6, pr: EVEN, c: '#ffc080'});
  // waterline: a dark seam and a bright lick of sky beside it
  for (let u0 = .02; u0 < .94; ) { const u1 = u0 + R(.1, .22), pts = []; for (let k = 0; k <= 3; k++) { const u = Math.min(.96, lerp(u0, u1, k / 3)); pts.push([b.X(u), b.keel(u) + 1.2 * s]) } st('dark', 'round', pts, {w: 2 * s + .8, pr: EVEN, c: jc('#1f1b34', .015)}); u0 = u1 + (rnd() < .3 ? .03 : -.01) }
  for (let i = 0; i < 5 + 4 * s; i++) { const u = R(.02, .98); st('slab thick', 'knife small', run(line(b.X(u) + R(-4, 4), b.keel(u) + R(3.5, 6) * s, R(-.04, .04), R(9, 24) * s, 0, 5), p => waterOK(p) && !inAnyBoat(p)), {w: R(1.6, 2.6) * s + .4, c: jc(mixc('#f7b88a', '#ffdca0', rnd()), .03)}) }
  // a wheelhouse
  if (b.cabin) { const [ua, ub] = b.cabin, xa = b.X(ua), xb = b.X(ub), xl = Math.min(xa, xb), xr = Math.max(xa, xb), yb = b.sheer((ua + ub) / 2) - b.h * b.open * .45, ch = b.h * .92, sw = (xr - xl) * .3;
    const sideP = [[xl, yb + 2], [xl, yb - ch + 2], [xl + sw, yb - ch], [xl + sw, yb + 3]], frontP = [[xl + sw, yb + 3], [xl + sw, yb - ch], [xr, yb - ch + 1], [xr, yb + 2]];
    fl('under', sideP, {c: '#f4c090'}); fl('under', frontP, {c: '#8c7890'});
    for (let i = 0; i < 6; i++) st('firm', 'flat', run(line(R(xl, xl + sw), R(yb - ch, yb), Math.PI / 2 + R(-.1, .1), R(10, 18), 0, 5), inP(sideP)), {w: R(4, 6), c: jc(mixc('#f6c898', '#ffdcae', rnd()), .02)});
    for (let i = 0; i < 14; i++) st('firm', 'flat', run(line(R(xl + sw, xr), R(yb - ch, yb), Math.PI / 2 + R(-.15, .15), R(10, 18), 0, 5), inP(frontP)), {w: R(5, 8), c: jc(mixc('#8c7890', '#a08a98', rnd()), .02)});
    st('dark', 'flat', wav(xl - 3, yb - ch - .5, xr + 3, yb - ch, .4, 3), {w: 3.6 * s, pr: EVEN, c: '#4a3440'});
    st('impasto', 'round', wav(xl - 3, yb - ch - 2.6, xl + sw + 6, yb - ch - 2.2, .3, 2), {w: 1.6, pr: EVEN, c: '#ffc890'});
    for (const [t, col] of [[.3, '#33283e'], [.72, '#f29a50']]) { const x = xl + sw + (xr - xl - sw) * t; st('dark', 'touch', [[x, yb - ch * .74], [x + R(-.4, .4), yb - ch * .44]], {w: (xr - xl - sw) * .26, c: col}) }
    st('dark', 'touch', [[xl + sw * .5, yb - ch * .72], [xl + sw * .5, yb - ch * .46]], {w: sw * .4, c: '#6a4450'}) }
  // mast, boom and furled sail, stays
  const [mx, my] = b.mastFoot, [tx, ty] = b.mastTop, mw = 2.2 + b.h * .075, wood = '#4a3136';
  const boomDir = b.cabin ? b.dir : -b.dir, bl = b.L * (b.cabin ? .3 : .4), by = my - b.h * .85 - b.mast.h * .03, bx1 = mx + boomDir * bl, by1 = by - b.h * .12;
  // stays first, thin and wavering, behind the mast
  const stay = (x0, y0, x1, y1) => { const sag = Math.hypot(x1 - x0, y1 - y0) * .012, p = [[x0, y0], [lerp(x0, x1, .33) + R(-.5, .5), lerp(y0, y1, .33) + sag], [lerp(x0, x1, .68) + R(-.5, .5), lerp(y0, y1, .68) + sag], [x1, y1]]; st('dark', 'liner', p.slice(0, 3), {w: .8 + s * .35, c: jc('#4a3846', .02), a: .7}); st('dark', 'liner', p.slice(1), {w: .7 + s * .3, c: jc('#5a4450', .03), a: .6}) };
  stay(tx, ty + 6, b.X(1.0), b.sheer(1) - 2); stay(tx, ty + 10, b.X(.02), b.sheer(.02) - 1); stay(lerp(mx, tx, .7), lerp(my, ty, .7), b.X(b.mast.t - .13), b.sheer(b.mast.t - .13));
  // mast in two lifts of the brush, thinner above
  const mm = [lerp(mx, tx, .48) + R(-.6, .6), lerp(my, ty, .48)];
  st('dark', 'round', wav(mx, my + b.h * .2, mm[0], mm[1], .5, 4), {w: mw, pr: EVEN, c: jc(wood, .02), c2: jc('#6a4438', .02)});
  st('dark', 'round', wav(mm[0], mm[1] + 4, tx, ty, .5, 4), {w: mw * .8, pr: [1, .95, .9, .8, .6], c: jc(wood, .02)});
  for (let t0 = R(.02, .08); t0 < .96; ) { const t1 = Math.min(1, t0 + R(.1, .3)); st('impasto', 'round', wav(lerp(mx, tx, t0) - mw * .3, lerp(my, ty, t0), lerp(mx, tx, t1) - mw * .26, lerp(my, ty, t1), .25, 2), {w: mw * .36, pr: EVEN, c: jc(mixc('#ffb070', '#f08a5a', t0), .03)}); t0 = t1 + R(.02, .1) }
  st('dark', 'round', wav(mx - boomDir * 3, by + 1, bx1, by1, .5, 3), {w: mw * .7, pr: EVEN, c: jc(wood, .02)});
  // the sail lashed along the boom: lumps of thick paint
  const ba = Math.atan2(by1 - by, bx1 - mx);
  for (let t = .04; t < .95; t += R(.08, .14)) { const bulk = .55 + .45 * Math.sin(Math.PI * Math.pow(t, .7)), x = lerp(mx, bx1, t), y = lerp(by, by1, t) - b.h * .1 * bulk;
    const lit = boomDir > 0 ? 1 - t * .6 : .35 + t * .4;
    st('impasto', 'filbert', line(x, y + R(-1, 1) * s, ba + R(-.2, .2), b.L * R(.09, .14), R(-.5, .5), 4), {w: b.h * R(.16, .3) * bulk, pr: BLUNT, c: jc(mixc(cool(b.sail, .34), warm(b.sail, .2), lit), .04), c2: jc(cool(b.sail, .4), .03)});
    if (rnd() < .75) st('impasto', 'round', line(x - 1, y - b.h * .1 * bulk, ba + R(-.15, .15), b.L * R(.05, .09), R(-.4, .4)), {w: b.h * .055 + .6, pr: EVEN, c: jc(mixc(warm(b.sail, .5), '#ffd9a8', .3), .03)});
    if (rnd() < .3) st('dark', 'round', [[x, y - b.h * .12 * bulk], [x + R(-1.5, 1.5), y + b.h * .14 * bulk]], {w: 1 + s * .4, pr: EVEN, c: '#3a2a36'}) }
  stay(bx1, by1, tx, ty + 14);
  st('firm', 'round', [[tx, ty + 1], [tx + 5 * s + 3, ty + 2.5], [tx + 11 * s + 5, ty + 1.5]], {w: 2.4 * s + 1.2, pr: [1, .8, .5], c: jc(pick(['#c8402c', '#e0a040', '#b8382c']), .03)});   // a pennant
}
for (const b of BOATS) { const c = C(b.hull); b.lum = .3 * c[0] + .59 * c[1] + .11 * c[2] }
for (const b of BOATS) {
  stage('The ' + b.name, 'Its reflection with the knife, then hull, rails, mast and the furled sail.');
  reflectBoat(b); dry(); paintBoat(b); dry();
}

stage('Posts, buoys and lines', 'Mooring posts near us, a buoy or two, the lines that hold the boats, a few gulls.');
const post = (x, yb, h, w) => {
  for (let d = 3; d < h * .9; d += R(5, 10)) { if (rnd() < .15) continue; const y = yb + d; if (y > H + 4) break; st('slab', 'knife small', run(line(x + Math.sin(d / 12 + x) * (2 + d * .06), y, R(-.08, .08), w * R(1.2, 2.2), 0, 5), glintOK), {w: R(4, 7), pr: kp(), c: jc(mixc('#2a2440', waterAt(x, y), d / h * .55), .02)}) }
  const lean = R(-3, 3);
  st('dark', 'bristle', wav(x + w * .16, yb + 3, x + w * .16 + lean, yb - h + R(0, 4), 1.2, 4), {w: w * .72, c: jc('#33263a', .02), c2: jc('#4a3040', .02)});
  st('dark', 'bristle', wav(x - w * .2, yb + 2, x - w * .2 + lean, yb - h + R(0, 3), 1.2, 4), {w: w * .6, c: jc('#7a4a36', .03), c2: jc('#5a3836', .03)});
  for (let t0 = R(0, .1); t0 < .9; ) { const t1 = Math.min(1, t0 + R(.15, .4)); st('impasto', 'round', wav(x - w * .42 + lean * t0, yb - h * t0, x - w * .42 + lean * t1 + R(-.8, .8), yb - h * t1, .5, 2), {w: w * R(.14, .24), pr: EVEN, c: jc(mixc('#f79a5e', '#ffc088', rnd()), .03)}); t0 = t1 + R(.03, .12) }
  st('impasto', 'filbert', line(x + lean - w * .05, yb - h - 1, R(-.15, .15), w * .8, .5), {w: w * .34, pr: BLUNT, c: jc('#f2b488', .02)});
  for (let j = 0; j < 3; j++) st('dark', 'flat', line(x + R(-2, 2), yb - R(0, h * .14), R(-.2, .2), w * R(.6, 1.1)), {w: R(3, 5), c: jc(pick(['#27323a', '#2e3a30', '#241f33']), .02)});
  st('slab thick', 'knife small', line(x - w * .5, yb + R(4, 6), R(-.05, .05), w * R(1.6, 2.4)), {w: 2.6, pr: kp(), c: jc('#ffd09a', .02)});
};
post(905, 742, 128, 15); post(958, 772, 96, 17); post(40, 668, 84, 12);
const buoy = (x, y, r, col) => { st('impasto', 'filbert', line(x, y, R(-.3, .3), r * 1.5, .8), {w: r * 1.5, pr: BLUNT, c: jc(col, .02)}); st('impasto', 'round', line(x - r * .3, y - r * .4, .2, r * .7), {w: r * .5, pr: EVEN, c: '#ffd9a0'});
  for (let j = 0; j < 3; j++) st('slab', 'knife small', line(x + R(-2, 2), y + r * 1.2 + j * r * .9, 0, r * R(1.4, 2.2)), {w: r * .5, c: jc(mixc(col, '#3a2e58', .4 + j * .15), .03)}) };
buoy(262, 584, 6, '#e8502e'); buoy(742, 610, 5.5, '#f0a030'); buoy(352, 446, 3, '#e8502e'); buoy(150, 716, 8, '#f08a2c');
const rope = (x0, y0, x1, y1, sag, w = 1.3) => { const p = []; for (let i = 0; i <= 6; i++) { const t = i / 6; p.push([lerp(x0, x1, t) + R(-.4, .4), lerp(y0, y1, t) + Math.sin(Math.PI * t) * sag]) } st('dark', 'liner', p.slice(0, 4), {w, c: jc('#4a3840', .02), a: .85}); st('dark', 'liner', p.slice(3), {w: w * .9, c: jc('#6a4a48', .02), a: .85}) };
{ const [, cb, , gb] = BOATS;
  rope(gb.X(1.02), gb.sheer(1) + 3, 262, 584, 14, 1.6); rope(cb.X(1.02), cb.sheer(1) + 2, 905, 742 - 110, 30, 1.2);
    rope(gb.X(-.01), gb.sheer(0) + 3, 742, 610, 8, 1.5) }
for (const [x, y, s] of [[392, 148, 1], [431, 171, .7], [318, 205, .55], [640, 118, .8]]) { st('firm', 'liner', [[x - 8 * s, y - 2 * s], [x - 3 * s, y - 4 * s], [x, y]], {w: 1.5 * s + .4, c: '#3e3658'}); st('firm', 'liner', [[x, y], [x + 4 * s, y - 4.5 * s], [x + 9 * s, y - 3 * s]], {w: 1.5 * s + .4, c: '#3e3658'}) }

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
