// node tools/test.mjs — the checks that can run without a browser. Exits with 1 if any fails.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim, hills = JSON.parse(readFileSync(join(root, 'paintings/hills.json'), 'utf8'));

let failed = 0;
const test = (name, fn) => { try { const r = fn(); console.log('ok    ' + name + (r ? '  — ' + r : '')) } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message) } };
const must = (cond, msg) => { if (!cond) throw new Error(msg) };
const print = s => { const px = s.pixels; let h = 0; for (let i = 0; i < px.length; i++) h = (Math.imul(h, 31) + px[i]) | 0; return (h >>> 0).toString(16) };
const base = (steps, more) => Object.assign({paintsim: 1, size: [120, 80], ground: 'toned panel', steps}, more);

test('every recipe passes lint', () => {
  let n = 0;
  for (const [kind, reg] of [['material', P.materials], ['brush', P.brushes], ['ground', P.grounds], ['light', P.lights], ['pigment', P.pigments]])
    for (const name of Object.keys(reg)) { const pr = P.lint(kind, name); must(!pr.length, kind + ' "' + name + '": ' + pr.join('; ')); n++ }
  return n + ' recipes';
});

test('every paint lays down with every brush, without a browser', () => {
  const brushes = Object.keys(P.brushes); let n = 0;
  for (const m of Object.keys(P.materials)) {
    const s = P.create({width: 160, height: 60, scale: 1, ground: 'paper', seed: 2}), before = print(s.render());
    brushes.forEach((b, i) => { s.paint({material: m, brush: b, path: [[8 + i * 10, 10], [14 + i * 10, 30], [10 + i * 10, 50]]}); n++ });
    s.fill({material: m, shape: [[150, 5], [158, 5], [158, 55], [150, 55]]}).dot({material: m, at: [154, 30], r: 3}).dry().render();
    for (const v of s.buffers.CR) must(isFinite(v), m + ' left a number that is not finite');
    if (m !== 'water' && m !== 'varnish' && m !== 'diamond dust') must(print(s) !== before, m + ' left no mark');
  }
  return n + ' strokes';
});

test('every lighting set-up renders', () => {
  const s = P.create({width: 80, height: 60, scale: 1, seed: 2}); s.fill({material: 'gold leaf', shape: [[10, 10], [70, 10], [70, 50], [10, 50]]});
  const seen = new Set(Object.keys(P.lights).map(l => print(s.light(l).render())));
  must(seen.size === Object.keys(P.lights).length, 'two set-ups gave the same picture'); return seen.size + ' set-ups';
});

test('polygon areas are exact', () => {
  const s = P.create({width: 100, height: 100, scale: 2}), sum = polys => s.polyMask(polys).a.reduce((a, b) => a + b, 0), near = (a, b, t) => must(Math.abs(a - b) < t, 'area ' + a + ', expected ' + b);
  near(sum([[[10, 10], [30, 10], [30, 30], [10, 30]]]), 1600, .01);
  near(sum([[[10, 10], [10, 30], [30, 30], [30, 10]]]), 1600, .01);                                         // the other way round
  near(sum([[[10.3, 60.7], [45.2, 63.1], [22.9, 91.4]]]), 2082.38, .02);
  near(sum([[[-40, -40], [20, -40], [20, 20], [-40, 20]]]), 1600, .01);                                    // cut by the corner of the page
  near(sum([[[10, 10], [30, 10], [30, 30], [10, 30]], [[20, 20], [40, 20], [40, 40], [20, 40]]]), 2800, .01);   // overlap counts once
  near(sum(P.shape({circle: [50, 50, 20]})), Math.PI * 1600, 12);
});

test('a painting gives the same picture every time', () => {
  const a = print(P.render(hills, {scale: 1})), b = print(P.render(hills, {scale: 1}));
  must(a === b, 'two renderings differ: ' + a + ' and ' + b); return 'fingerprint ' + a + ' at 1×';
});

test('painting step by step equals painting at once', () => {
  const pl = P.open(hills, {scale: 1}); while (!pl.done) { pl.run(7); pl.surface.flush() } pl.surface.render();
  must(print(pl.surface) === print(P.render(hills, {scale: 1})), 'the pictures differ');
});

test('the picture is the same picture at another size', () => {
  const mean = s => { const px = s.pixels; let r = 0, g = 0, b = 0; for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2] } const n = px.length / 4; return [r / n, g / n, b / n] };
  const a = mean(P.render(hills, {scale: 1})), b = mean(P.render(hills, {scale: 2})), d = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  must(d < 4, 'mean colour differs by ' + d.toFixed(1) + ' of 255'); return 'mean colour within ' + d.toFixed(1) + ' of 255 between 1× and 2×';
});

test('the accidents of a stroke do not depend on the size it is painted at', () => {
  // every stroke takes one number from the surface's stream, however many bristles or droplets it needs,
  // so the stream stands at the same place afterwards and the strokes that follow get the same accidents
  const next = scale => { const s = P.create({width: 120, height: 80, scale, seed: 5});
    s.paint({material: 'oil', brush: 'flat', width: 18, path: [[10, 20], [60, 30], [110, 18]]}).paint({material: 'spray paint', brush: 'spray', path: [[20, 60], [100, 55]]}).paint({material: 'ink', brush: 'pen', path: [[10, 70], [10.3, 70.2]]});
    return s.random() };
  const a = next(1), b = next(2), c = next(3.5);
  must(a === b && b === c, 'after the same strokes the random stream stands at ' + a + ', ' + b + ' and ' + c);
  // and a sprayed cloud is as dense at one size as at another
  const cover = (scale, brush) => { const s = P.create({width: 120, height: 80, scale, seed: 5, ground: 'panel'}); s.paint({material: 'spray paint', brush, color: '#000000', path: [[20, 40], [100, 40]]}).render();
    const px = s.pixels; let t = 0; for (let i = 0; i < px.length; i += 4) t += px[i]; return t / (px.length / 4) };
  let worst = 0; for (const brush of ['spray', 'spatter']) { const d = Math.abs(cover(1, brush) - cover(3, brush)); must(d < 4, 'a line of "' + brush + '" is ' + d.toFixed(1) + ' of 255 darker at one size than at another'); worst = Math.max(worst, d) }
  return 'the same stream at 1×, 2× and 3.5×; sprays within ' + worst.toFixed(1) + ' of 255 between 1× and 3×';
});

test('stages: stop after one, and each has its own random seed', () => {
  const full = P.open(hills, {scale: 1}), part = P.open(hills, {scale: 1, upTo: 'far hills'});
  must(part.total < full.total && part.stages.length === 3, 'upTo did not stop after the third stage');
  const edited = JSON.parse(JSON.stringify(hills)); edited.steps[1].material = 'old gold';            // change one early stage …
  const rect = (s, x0, y0, x1, y1) => { const px = s.pixels, w = s.pxWidth; let h = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) h = (Math.imul(h, 31) + px[(y * w + x) * 4]) | 0; return h };
  const a = P.render(hills, {scale: 1}), b = P.render(edited, {scale: 1});
  must(rect(a, 320, 110, 440, 310) === rect(b, 320, 110, 440, 310), 'the tree changed when only the sun was changed');   // … and a later one is untouched
  must(rect(a, 130, 106, 170, 146) !== rect(b, 130, 106, 170, 146), 'the sun did not change');
});

test('recipes of a painting stay inside it', () => {
  const d1 = base([{path: [[10, 40], [110, 40]], material: 'mine', brush: 'flat', width: 20}], {define: {pigments: {'my red': '#b02a2a'}, materials: {mine: {base: 'oil', color: 'my red'}}}});
  const d2 = JSON.parse(JSON.stringify(d1)); d2.define.pigments['my red'] = '#2a52b0';
  must(print(P.render(d1, {scale: 1})) !== print(P.render(d2, {scale: 1})), 'the two paintings look the same');
  must(P.materials.mine === undefined && P.pigments['my red'] === undefined, 'a recipe leaked into the shared palette');
  must(P.check(base([{path: [[1, 1], [9, 9]], material: 'mine'}])).length === 1, 'another painting could use it');
});

test('check says what is wrong, and where', () => {
  const cases = [
    [{size: [100, 100], steps: []}, 'paintsim: missing'],
    [base([], {size: [100]}), 'size: must be [width, height]'],
    [base([{path: [[1, 1], [9, 9]], material: 'oli'}]), 'steps[0].material: unknown material "oli" (did you mean "oil"?)'],
    [base([{path: [[1, 1], [9, 9]], brush: 'flatt'}]), 'unknown brush "flatt" (did you mean "flat"?)'],
    [base([{path: [[1, 1], [9, 9]], colour: 'red'}]), 'steps[0]: unknown field "colour" (did you mean "color"?)'],
    [base([{path: [[1, 1], [9, 9]], color: 'no such'}]), 'steps[0].color: unknown colour "no such"'],
    [base([{path: [[1, 1]]}]), 'steps[0].path: a path is a list of at least 2 points'],
    [base([{path: [[1, 1], [2, 'x']]}]), 'steps[0].path: point 2 is not [x, y]'],
    [base([{path: [[1, 1], [9, 9]], shape: {rect: [1, 1, 9, 9]}}]), 'steps[0]: has path and shape: a step does one thing'],
    [base([{material: 'oil'}]), 'steps[0]: a step needs one of'],
    [base([{shape: 'nowhere'}]), 'steps[0].shape: unknown shape "nowhere"'],
    [base([{shape: {rect: [1, 2, 3]}}]), 'rect is [x0, y0, x1, y1]'],
    [base([{at: [5, 5]}]), 'steps[0]: a dot needs r'],
    [base([{dots: [[5, 5], [9, 9, 2]]}]), 'steps[0].dots[0]: has no radius'],
    [base([{dry: 'yes'}]), 'steps[0].dry: must be true'],
    [base([{flow: -1}]), 'steps[0].flow: must be a number'],
    [base([{do: [{path: [[1, 1], [9, 9]], pressure: 'leef'}]}]), 'steps[0].do[0].pressure: unknown pressure profile "leef" (did you mean "leaf"?)'],
    [base([{with: {widht: 3}, do: []}]), 'steps[0].with: unknown field "widht" (did you mean "width"?)'],
    [base([{shape: {rect: [1, 1, 9, 9]}, width: 3}]), 'a fill step does not take it'],
    [base([], {ground: 'velum'}), 'ground: unknown ground "velum" (did you mean "vellum"?)'],
    [base([], {light: {lamps: [{azimut: 3}]}}), 'light: lamp 1: unknown field "azimut"'],
    [base([], {define: {materials: {x: {base: 'oil', glos: 1}}}}), 'define.materials["x"]: unknown field "glos"'],
    [base([], {titel: 'x'}), 'unknown field "titel" (did you mean "title"?)'],
  ];
  for (const [doc, want] of cases) { const pr = P.check(doc); must(pr.some(m => m.includes(want)), 'expected “' + want + '”, got ' + JSON.stringify(pr)) }
  must(P.check(hills).length === 0, 'the sample painting has problems: ' + P.check(hills).join('; '));
  let thrown = ''; try { P.open(base([{path: [[1, 1], [9, 9]], material: 'oli'}])) } catch (e) { thrown = e.message }
  must(thrown.includes('1 problem') && thrown.includes('did you mean "oil"'), 'open() did not refuse a broken painting'); return cases.length + ' kinds of mistake';
});

test('shared fields: a group hands them down, a step may override', () => {
  const doc = base([{with: {material: 'oil', brush: 'flat', width: 12, color: 'cadmium red'}, do: [{path: [[10, 20], [110, 20]]}, {path: [[10, 50], [110, 50]], color: 'ultramarine'}, {shape: {rect: [50, 60, 70, 76]}}]}]);
  must(P.check(doc).length === 0, P.check(doc).join('; '));
  const s = P.render(doc, {scale: 1}), px = s.pixels, at = (x, y) => [px[(y * 120 + x) * 4], px[(y * 120 + x) * 4 + 2]];
  must(at(60, 20)[0] > at(60, 20)[1] + 60, 'the first stroke is not red'); must(at(60, 50)[1] > at(60, 50)[0] + 40, 'the second stroke is not blue'); must(at(60, 68)[0] > at(60, 68)[1] + 60, 'the fill did not take the group colour');
});

console.log(failed ? '\n' + failed + ' failed' : '\nall passed');
process.exit(failed ? 1 : 0);
