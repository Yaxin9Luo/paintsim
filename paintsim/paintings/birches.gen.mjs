// node paintings/birches.gen.mjs   →   paintings/birches.json
//
// "A birch grove in autumn, late afternoon: white trunks, gold leaves, violet shadows across the fallen leaves."
// Oil on toned canvas, painted thin to thick: a rubbed-in ground, sky and far woods, the floor of the wood, the trunks
// with a knife, and the leaves last in thick dabs.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, {arc, clamp, smooth, fbm} = P.util;

let seed = 4711;
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 };
const R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];

const W = 800, H = 1000, HOR = 560;   // the far edge of the ground
const MIX = {
  'sky': {mix: {'cerulean': 1, 'cobalt blue': .3, 'titanium white': 5}}, 'sky pale': {mix: {'cerulean': .3, 'titanium white': 6, 'naples yellow': .6}}, 'sky warm': {mix: {'naples yellow': 1.5, 'titanium white': 4, 'cadmium red': .06}},
  'far wood': {mix: {'ultramarine': 1, 'alizarin crimson': .35, 'raw umber': .5, 'titanium white': 2.2}}, 'far gold': {mix: {'yellow ochre': 2, 'titanium white': 1.5, 'dioxazine violet': .05}},
  'gold': {mix: {'cadmium yellow': 3, 'yellow ochre': 1}}, 'lemon': {mix: {'cadmium yellow': 3, 'titanium white': 1.2}}, 'amber': {mix: {'cadmium yellow': 2, 'cadmium red': .6, 'yellow ochre': 1}},
  'orange': {mix: {'cadmium yellow': 1.5, 'cadmium red': 1}}, 'rust': {mix: {'burnt sienna': 2, 'cadmium red': .5}}, 'olive': {mix: {'sap green': 1, 'burnt umber': .8, 'yellow ochre': 1}}, 'moss': {mix: {'sap green': 2, 'yellow ochre': 1.5}},
  'floor light': {mix: {'yellow ochre': 2, 'naples yellow': 2, 'cadmium yellow': .6}}, 'floor': {mix: {'yellow ochre': 2, 'raw sienna': 1.5, 'cadmium yellow': .5}}, 'floor dark': {mix: {'burnt sienna': 1.5, 'burnt umber': 1, 'yellow ochre': .5}},
  'shadow': {mix: {'ultramarine': 1, 'alizarin crimson': .45, 'burnt umber': .5, 'titanium white': .9}}, 'shadow warm': {mix: {'dioxazine violet': .25, 'burnt sienna': 1, 'titanium white': .5}},
  'bark': {mix: {'titanium white': 7, 'naples yellow': 1}}, 'bark sun': {mix: {'titanium white': 6, 'naples yellow': 1.5, 'cadmium yellow': .12}}, 'bark shade': {mix: {"payne's grey": 1, 'rose madder': .3, 'titanium white': 3}}, 'bark deep': {mix: {'ultramarine': 1, 'alizarin crimson': .3, 'raw umber': .7, 'titanium white': 1.6}},
  'bark black': {mix: {'lamp black': 2, 'burnt umber': 1.2}}, 'twig': {mix: {'burnt umber': 2, 'lamp black': .5, 'dioxazine violet': .1}},
  'imprimatura': {mix: {'burnt sienna': 2, 'yellow ochre': 1, 'raw umber': .5}}
};
const CC = new Map(), C = c => { if (typeof c !== 'string') return c; let v = CC.get(c); if (!v) { v = P.color(MIX[c] !== undefined ? MIX[c] : c); CC.set(c, v) } return v };
const mixc = (a, b, t) => { a = C(a); b = C(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
const tone = (c, k) => { c = C(c); return [c[0] * k, c[1] * k, c[2] * k] };
const hex = c => P.hex(C(c));

const doc = {
  paintsim: 1, engine: P.VERSION, title: 'Birches in October',
  note: 'A birch grove in autumn, late in the day: oil on toned canvas, thin to thick, the trunks laid with a knife and the leaves in thick dabs. Written by paintings/birches.gen.mjs.',
  size: [W, H], ground: {base: 'toned canvas', color: '#a58a66'},
  light: {base: 'raking', elevation: 34, lens: {focus: [.5, .55], depth: .6, blur: 0, vignette: .28, contrast: .14, grain: .6}},
  seed: 4711,
  define: {
    pigments: MIX,
    materials: {
      'rub': {base: 'oil', note: 'colour thinned with turpentine and scrubbed in', opacity: .7, body: .2, ridges: .4, dry: .55, gloss: .08, open: .3, pickup: 0, merge: 0, reach: 0},
      'paint': {base: 'oil', note: 'paint as it comes from the tube', reach: 0},
      'shade': {base: 'oil', note: 'thin half-covering colour for shadows', opacity: .62, body: .35, gloss: .2, dry: .35, pickup: .01, merge: .1, reach: 0},
      'dark': {base: 'oil', note: 'a dark that keeps its shine', body: .7, gloss: .42, sharp: .55, merge: .05, pickup: .005, reach: 0},
      'impasto': {base: 'oil', note: 'thick clean paint that does not sink into what is under it', body: 1.6, ridges: .22, gloss: .36, merge: 0, pickup: 0, reach: 0}
    },
    brushes: {
      'scrub': {base: 'flat', width: 60, dry: .3, rag: 10, wobble: 1.5},
      'dab': {base: 'filbert', note: 'one short touch', wobble: .6, var: .3},
      'slab': {base: 'knife', note: 'a short pull of the knife', rag: 4},
      'twig': {base: 'liner', wobble: .8}
    }
  },
  steps: []
};

let cur = null, grp = null;
const n1 = v => Math.round(v * 10) / 10, n2 = v => Math.round(v * 100) / 100;
const stage = (name, note) => { cur = {name, note, do: []}; doc.steps.push(cur); grp = null };
function st(material, brush, path, o = {}) {
  const s = {path: path.map(p => [n1(p[0]), n1(p[1])])};
  if (o.w !== undefined) s.width = o.w < 4 ? n2(o.w) : n1(o.w);
  if (o.c !== undefined) s.color = hex(o.c);
  if (o.c2 !== undefined) s.color2 = hex(o.c2);
  if (o.a !== undefined) s.opacity = n2(o.a);
  if (o.pr !== undefined) s.pressure = o.pr;
  if (o.grad) s.grad = n2(o.grad);
  if (o.load !== undefined) s.load = Math.round(o.load);
  if (o.tone2) s.tone2 = n2(o.tone2);
  const key = material + '|' + brush;
  if (!grp || grp.key !== key) { grp = {key, node: {with: {material, brush}, do: []}}; cur.do.push(grp.node) }
  grp.node.do.push(s);
}
function fl(material, shape, o = {}) { const s = {shape}; if (o.c !== undefined) s.color = hex(o.c); if (o.a !== undefined) s.opacity = n2(o.a); if (o.soft !== undefined) s.soft = o.soft; if (o.angle !== undefined) s.angle = o.angle; cur.do.push(Object.assign({material}, s)); grp = null }
const dry = () => { cur.do.push({dry: true}); grp = null };
const line = (x, y, ang, len, curv = 0, n = 3) => arc(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2, ang, len, curv, n);

/* ---------- the trunks, decided first because everything else is painted round them ---------- */
// x at the foot, the foot's y (nearer = lower), width at the foot, lean (x shift per unit of height)
const TRUNKS = [
  {x: 92, y: 742, w: 20, lean: .03}, {x: 300, y: 700, w: 15, lean: -.02}, {x: 520, y: 716, w: 17, lean: .025}, {x: 708, y: 690, w: 13, lean: -.03}, {x: 410, y: 668, w: 10, lean: .01},
  {x: 205, y: 826, w: 40, lean: -.035}, {x: 628, y: 872, w: 54, lean: .03}, {x: 762, y: 780, w: 30, lean: .05}, {x: 30, y: 930, w: 62, lean: .045}
].sort((a, b) => a.y - b.y);
const tx = (t, y) => t.x + (t.y - y) * t.lean + Math.sin((t.y - y) / 170 + t.x) * t.w * .16, tw = (t, y) => t.w * (.5 + .5 * clamp(1 - (t.y - y) / 1150, 0, 1));
// how much late sun reaches a point on the ground (bands of light between the trunks' shadows)
const SUN = [-.83, -.55];   // the sun stands upper left; shadows run to the lower right
const inShadow = (x, y) => { let s = 0; for (const t of TRUNKS) { if (y < t.y - 4) continue; const d = y - t.y, sx = t.x + d * 1.25; s = Math.max(s, smooth(1 - Math.abs(x - sx) / (t.w * (.9 + d / 260)))) } return s };

function ground() {
  stage('Ground', 'Burnt sienna rubbed thinly over the toned canvas, so that no bare canvas shows and the gold has something warm under it.');
  fl('rub', {rect: [-10, -10, W + 10, H + 10]}, {c: 'imprimatura', a: .55, angle: .5});
  for (let i = 0; i < 160; i++) { const x = R(-30, W + 30), y = R(-30, H + 30); st('rub', 'scrub', line(x, y, R(-.9, .9), R(140, 300), R(-.4, .4)), {w: R(50, 80), c: tone('imprimatura', R(.7, 1.15)), a: R(.45, .75)}) }
  dry();
  // the three big masses laid in thinly, so that nothing later has to cover bare ground
  fl('rub', {rect: [-10, -10, W + 10, HOR - 60]}, {c: mixc('sky', 'sky warm', .5), a: .8, soft: 6, angle: .1});
  fl('rub', {rect: [-10, HOR - 190, W + 10, HOR + 6]}, {c: mixc('far wood', 'far gold', .4), a: .8, soft: 14, angle: 1.5});
  fl('rub', {rect: [-10, HOR, W + 10, H + 10]}, {c: mixc('floor', 'floor dark', .45), a: .85, soft: 5, angle: .05});
  dry();
}
function sky() {
  stage('Sky', 'Pale blue above, warm cream toward the wood: broad strokes, worked into each other while wet.');
  for (let i = 0; i < 430; i++) { const y = R(-10, HOR - 20), x = R(-20, W + 20), k = smooth(y / (HOR - 60));
    const c = mixc(mixc('sky', 'sky pale', clamp(k * 1.3 + R(-.2, .2), 0, 1)), 'sky warm', clamp((k - .55) * 2.2 + R(-.15, .15), 0, 1));
    st('paint', rnd() < .7 ? 'flat' : 'filbert', line(x, y, R(-.5, .5) + (rnd() < .25 ? 1.2 : 0), R(60, 150), R(-.5, .5)), {w: R(30, 58), c, c2: mixc(c, 'titanium white', .35)}) }
}
function farWood() {
  stage('Far wood', 'The trees behind: violet-grey and dull gold, upright touches, kept soft.');
  for (let i = 0; i < 700; i++) { const x = R(-10, W + 10), top = HOR - 150 - 70 * fbm(x / 130, 2.2, 3) - R(0, 40), y = R(top, HOR + 10), k = (y - top) / (HOR - top);
    const c = rnd() < .45 ? mixc(mixc('far gold', 'amber', R(0, .6)), 'far wood', R(0, .35)) : mixc('far wood', 'sky warm', R(0, .4) * (1 - k));
    st('paint', 'flat', line(x, y, Math.PI / 2 + R(-.25, .25), R(22, 60), R(-.3, .3)), {w: R(10, 24), c, c2: mixc(c, 'sky warm', .25)}) }
  for (let i = 0; i < 26; i++) { const x = R(0, W), y0 = HOR + R(-6, 12), h = R(120, 300);   // far trunks, thin and pale
    st('paint', 'round', [[x, y0], [x + R(-6, 6), y0 - h * .5], [x + R(-10, 10), y0 - h]], {w: R(2.5, 5.5), c: mixc('bark shade', 'far wood', R(.1, .6)), a: .8, pr: 'full'}) }
}
function floor() {
  stage('Floor of the wood', 'Fallen leaves: ochre, gold and rust in strokes that lie flat and grow larger toward us.');
  for (let i = 0; i < 1500; i++) { const y = HOR - 8 + Math.pow(rnd(), .8) * (H - HOR + 20), x = R(-20, W + 20), near = (y - HOR) / (H - HOR), sh = inShadow(x, y);
    const path = smooth(1 - Math.abs(x - (400 + (y - HOR) * .1)) / (90 + near * 160)), n = fbm(x / 90, y / 60, 3);
    let c = mixc(mixc('floor', 'floor dark', clamp(n * 1.4 - .35 + R(-.2, .2), 0, 1)), 'floor light', clamp(path * .8 + R(-.2, .25), 0, 1));
    if (rnd() < .22) c = mixc(c, pick(['rust', 'orange', 'olive', 'gold']), R(.4, .9));
    c = mixc(c, 'shadow', sh * .55);
    st('paint', rnd() < .6 ? 'flat' : 'filbert', line(x, y, R(-.22, .22), R(24, 60) * (.5 + near), R(-.3, .3)), {w: R(10, 22) * (.5 + near * 1.1), c, c2: mixc(c, 'floor light', .3)}) }
  dry();
}
function shadows() {
  stage('Shadows', 'The trunks throw long violet shadows across the leaves; between them the low sun lies in bands.');
  for (const t of TRUNKS) { const L = Math.min(520, (H - t.y) * 1.7 + 60);
    for (let i = 0; i < 16 + t.w * .5; i++) { const d = R(0, L), y = t.y + d * .62, x = t.x + d * .775 + R(-1, 1) * t.w * (.5 + d / 300);
      st('shade', 'flat', line(x, y, .67 + R(-.12, .12), R(40, 110), R(-.15, .15)), {w: t.w * R(.5, .95) * (1 + d / 380), c: mixc('shadow', 'shadow warm', R(0, .6)), a: R(.4, .66)}) } }
  for (let i = 0; i < 150; i++) { const y = R(HOR + 10, H), x = R(0, W); if (inShadow(x, y) > .25) continue; const near = (y - HOR) / (H - HOR);   // the bands of sun
    st('paint', 'dab', line(x, y, R(-.2, .2), R(18, 44) * (.5 + near), R(-.3, .3)), {w: R(7, 15) * (.5 + near), c: mixc('floor light', pick(['lemon', 'gold', 'amber']), R(.2, .8)), a: R(.7, .95)}) }
  dry();
}
// the foliage hangs in clumps; each clump is lit from the upper left
const CLUMPS = []; for (let i = 0; i < 34; i++) CLUMPS.push({x: R(-30, W + 30), y: Math.pow(rnd(), 1.25) * 440 - 30, r: R(55, 120)});
for (let x = 0; x <= W; x += 70) CLUMPS.push({x: x + R(-20, 20), y: R(-30, 30), r: R(70, 110)});
function canopy(front) {
  if (!front) stage('Leaves behind', 'The mass of the foliage: dull gold and rust first, so that the bright leaves have something to shine against.');
  else stage('Leaves', 'Thick dabs of yellow, laid last and left alone. A few are falling.');
  const n = front ? 3400 : 3000, g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
  for (let i = 0; i < n; i++) { const k = pick(CLUMPS), dx = g() * k.r, dy = g() * k.r * .75, x = k.x + dx, y = k.y + dy; if (y > 545 || fbm(x / 45, y / 45 + (front ? 9 : 0), 2) < .36) continue;
    const lit = clamp(.5 + (-dx * .6 - dy * .9) / k.r * .7 + (fbm(x / 50, y / 50 + 3, 2) - .5) * .7, 0, 1), s = front ? R(6, 13) : R(8, 17);
    if (!front) st('paint', rnd() < .5 ? 'dab' : 'flat', line(x, y, R(0, Math.PI), s * R(1, 1.9), R(-.6, .6)), {w: s, c: mixc(mixc(mixc('amber', 'rust', R(.1, .7)), 'olive', R(0, .4) * (1 - lit)), 'gold', lit * R(.1, .5)), a: R(.85, .97)});
    else { if (rnd() > .3 + .7 * lit) continue; const c = lit < .3 || rnd() < .12 ? mixc('amber', 'orange', R(.1, .9)) : mixc(mixc('gold', 'lemon', R(0, 1) * lit), 'amber', R(0, .35));
      st('impasto', pick(['slab', 'dab', 'round']), line(x, y, R(0, Math.PI), s * R(.9, 1.7), R(-.6, .6)), {w: s * R(.6, 1), c, c2: mixc(c, 'lemon', .5), a: .96}) } }
  if (front) {
    for (let i = 0; i < 46; i++) { const x = R(0, W), y = R(20, 500); if (CLUMPS.some(k => Math.hypot(x - k.x, y - k.y) < k.r * .5)) st('impasto', 'dab', line(x, y, R(0, 3), R(8, 16)), {w: R(6, 11), c: mixc('sky pale', 'sky', R(0, .6)), a: .95}) }   // sky holes
    for (let i = 0; i < 60; i++) { const x = R(0, W), y = R(420, 960), s = R(3.5, 8); st('impasto', 'dab', line(x, y, R(0, 3), s * 1.5), {w: s, c: pick(['gold', 'lemon', 'amber', 'orange']), a: .95}) }   // falling, and lying on the ground
  }
}
function trunk(t) {
  const top = -30, N = Math.max(8, Math.round((t.y - top) / 46)), ys = Array.from({length: N + 1}, (_, i) => t.y - (t.y - top) * i / N), axis = ys.map(y => [tx(t, y), y]);
  // the whole trunk in shade colour first, wider at the root
  st('paint', 'round', [[axis[0][0] - t.w * .1, t.y + t.w * .25]].concat(axis), {w: t.w * 1.04, c: mixc('bark shade', 'bark', .3), c2: mixc('bark shade', 'bark deep', .5), grad: 1, pr: [1, .86, .8, .76, .72, .68, .64, .6, .56, .5]});
  // the lit side, pulled down in short lengths with the knife; gaps are left for the dark bands
  for (let y = t.y - R(4, 14); y > top;) { const len = R(1.2, 3.4) * t.w + 14, w = tw(t, y), x = tx(t, y - len / 2) - w * R(.1, .2);
    st('impasto', 'slab', [[x + R(-1, 1), y], [tx(t, y - len) - w * .15 + R(-1, 1), y - len]], {w: w * R(.52, .7), c: mixc('bark', 'bark sun', R(0, 1)), c2: mixc('bark', 'bark shade', R(.1, .5))});
    y -= len + R(.12, .5) * t.w + 3 }
  // light turning into shade
  for (let i = 0; i < N * 1.5; i++) { const y = R(top, t.y), w = tw(t, y); st('paint', 'dab', line(tx(t, y) + w * R(.05, .28), y, Math.PI / 2 + R(-.15, .15), R(.8, 2) * t.w + 8), {w: w * R(.2, .34), c: mixc('bark shade', 'bark', R(.1, .55)), a: R(.5, .85)}) }
  // warm light reflected from the leaves into the shaded edge
  for (let i = 0; i < N * .7; i++) { const y = R(top, t.y), w = tw(t, y); st('shade', 'dab', line(tx(t, y) + w * .4, y, Math.PI / 2, R(1, 2) * t.w + 6), {w: w * .16, c: mixc('amber', 'bark shade', R(.3, .6)), a: .5}) }
}
function trunkMarks(t) {
  const top = -30, n = Math.round((t.y - top) / 26);
  for (let i = 0; i < n; i++) { const y = R(top, t.y - 4), w = tw(t, y), x = tx(t, y), big = rnd() < .1;
    if (big) { st('dark', 'dab', line(x + w * R(-.15, .15), y, R(-.18, .18), w * R(.4, .7), R(-.9, .9)), {w: R(.12, .24) * t.w + 1.5, c: 'bark black', c2: 'twig'});   // a scar where a branch was
      st('dark', 'twig', line(x + w * R(-.1, .1), y + w * .2, Math.PI / 2 + R(-.3, .3), w * R(.4, .9)), {w: Math.max(1.2, t.w * .07), c: 'bark black', a: .8}) }
    else st('dark', 'dab', line(x + w * R(-.3, .3), y, R(-.14, .14), w * R(.16, .5), R(-.4, .4)), {w: Math.max(1.3, R(.05, .12) * t.w), c: mixc('bark black', 'bark deep', R(0, .5)), a: R(.7, .95)}) }
  // black, broken bark at the root
  for (let i = 0; i < 3 + t.w * .15; i++) { const y = t.y - R(0, 1.4) * t.w, w = tw(t, y) * 1.1; st('dark', 'slab', line(tx(t, y) + w * R(-.4, .45), y, Math.PI / 2 + R(-.3, .3), R(.4, 1.1) * t.w), {w: R(.15, .34) * t.w + 2, c: mixc('bark black', 'rust', R(0, .3)), a: .92}) }
  // branches: thin, dark, rising
  for (let i = 0; i < 2 + t.w * .05; i++) { const y = R(top + 40, t.y - 150 - t.w * 2), side = rnd() < .5 ? -1 : 1, len = R(60, 170) + t.w, a0 = -Math.PI / 2 + side * R(.5, 1.05), x = tx(t, y) + side * tw(t, y) * .3;
    const p = arc(x, y, a0, len, side * R(-.9, .5), 5); st('dark', 'twig', p, {w: Math.max(1.2, t.w * R(.05, .09)), c: mixc('twig', 'far wood', R(.1, .4)), a: .7});
    for (let k = 0; k < 2; k++) { const q = p[2 + k]; st('dark', 'twig', arc(q[0], q[1], a0 + side * R(-.7, .5), len * R(.25, .5), R(-.4, .4), 3), {w: Math.max(1, t.w * .05), c: 'twig', a: .8}) } }
}
function grasses() {
  stage('Last touches', 'A few dry grasses and bright leaves at our feet.');
  for (let i = 0; i < 90; i++) { const x = R(0, W), y = R(760, H + 10), h = R(18, 60); st('paint', 'twig', arc(x, y, -Math.PI / 2 + R(-.5, .5), h, R(-.7, .7), 3), {w: R(1.2, 2.6), c: mixc(pick(['floor light', 'olive', 'rust']), 'lemon', R(0, .4)), a: .85}) }
  for (let i = 0; i < 70; i++) { const x = R(0, W), y = R(640, H), near = (y - HOR) / (H - HOR), s = R(4, 9) * (.5 + near); if (inShadow(x, y) > .5 && rnd() < .7) continue;
    st('impasto', 'dab', line(x, y, R(-.4, .4), s * 1.6), {w: s, c: pick(['lemon', 'gold', 'orange', 'amber']), a: .95}) }
}

ground(); sky(); farWood(); floor(); shadows(); canopy(false);
dry();
stage('Trunks', 'White bark with the knife on the side of the sun, grey-violet in the shade; then the black bands, the scars and the branches.');
for (const t of TRUNKS) { trunk(t); grp = null }
dry();
for (const t of TRUNKS) trunkMarks(t);
dry();
canopy(true); grasses();

const problems = P.check(doc);
if (problems.length) { console.error(problems.length + ' problems\n  - ' + problems.slice(0, 20).join('\n  - ')); process.exit(1) }
const J = v => JSON.stringify(v).replace(/":/g, '": ').replace(/,"/g, ', "');
const ln = q => q.do ? '      {"with": ' + J(q.with) + ', "do": [\n' + q.do.map(m => '        ' + J(m)).join(',\n') + '\n      ]}' : '      ' + J(q);
const body = doc.steps.map(s => '    {"name": ' + JSON.stringify(s.name) + ', "note": ' + JSON.stringify(s.note) + ', "do": [\n' + s.do.map(ln).join(',\n') + '\n    ]}').join(',\n');
const head = Object.assign({}, doc); delete head.steps;
const text = JSON.stringify(head, null, 2).replace(/\n}$/, ',\n  "steps": [\n' + body + '\n  ]\n}\n');
JSON.parse(text);
writeFileSync(join(dir, 'birches.json'), text);
let count = 0; const walk = l => l.forEach(s => s.do ? walk(s.do) : count++); walk(doc.steps);
console.log('birches.json  ' + (text.length / 1024).toFixed(0) + ' kB  ' + doc.steps.length + ' stages, ' + count + ' marks');
