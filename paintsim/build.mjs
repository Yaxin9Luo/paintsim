// node build.mjs — check every recipe and every painting, then write the one-file pages:
//   swatches.standalone.html   the swatch page with the engine and the palette inside it
//   play.standalone.html       the player with the engine, the palette and the sample painting inside it
//   magpie.standalone.html     the same player with the magpie inside it
// Each opens anywhere, with no server.
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), 'utf8');

for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(read(f), {filename: f});
const P = globalThis.PaintSim, problems = [];

// a misspelt field or an unknown colour stops the build
for (const [kind, reg] of [['material', P.materials], ['brush', P.brushes], ['ground', P.grounds], ['light', P.lights], ['pigment', P.pigments]])
  for (const name of Object.keys(reg)) for (const msg of P.lint(kind, name)) problems.push(kind + ' "' + name + '": ' + msg);
const paintings = readdirSync(join(dir, 'paintings')).filter(f => f.endsWith('.json'));
for (const f of paintings) {
  let doc; try { doc = JSON.parse(read('paintings/' + f)) } catch (e) { problems.push('paintings/' + f + ': ' + e.message); continue }
  for (const msg of P.check(doc)) problems.push('paintings/' + f + ': ' + msg);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log('recipes ok  ' + ['materials', 'brushes', 'grounds', 'pigments', 'lights'].map(k => Object.keys(P[k]).length + ' ' + k).join(', ') + '   paintings ok  ' + paintings.join(', '));

function standalone(page, scripts, extra, out) {
  let inlined = 0;
  let html = read(page).replace(/<script src="([^"]+)"><\/script>/g, (tag, src) => {
    const js = read(src);
    if (/<\/script/i.test(js)) throw new Error(src + ' contains "</script" and cannot be inlined');
    inlined++;
    return '<script>\n' + js + '\n</script>';
  });
  if (inlined !== scripts) throw new Error(page + ': expected ' + scripts + ' script tags to inline, found ' + inlined);
  if (extra) html = html.replace('<script>\n/*! PaintSim', () => extra + '\n<script>\n/*! PaintSim');
  out = out || page.replace('.html', '.standalone.html');
  writeFileSync(join(dir, out), html);
  console.log(out + '  ' + (html.length / 1024).toFixed(0) + ' kB');
}
standalone('swatches.html', 2);
const builtIn = f => { const text = read('paintings/' + f); if (/<\/script/i.test(text)) throw new Error('paintings/' + f + ' contains "</script"'); return '<script type="application/json" id="built-in">\n' + text + '</script>' };
standalone('play.html', 3, builtIn('hills.json'));
if (paintings.includes('magpie.json')) standalone('play.html', 3, builtIn('magpie.json'), 'magpie.standalone.html');
