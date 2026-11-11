// node bench/make-kit.mjs <target folder> [case stem]
//
// Makes the folder a tested model works in: PaintSim with its documents, the starter generator and two finished
// documents as examples of the format. It leaves out every benchmark case (generator, document, picture) and the
// magpie's generator, so that nothing in the folder shows how a case was painted.
// With a case stem it also prints that case's task: the exact text the model is given.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), src = join(here, '..', 'paintsim');
const [target, stem] = process.argv.slice(2);
if (!target) { console.error('usage: node bench/make-kit.mjs <target folder> [case stem]'); process.exit(2) }
const out = resolve(target);
if (existsSync(out) && readdirSync(out).length) { console.error(out + ' is not empty'); process.exit(1) }

const FILES = ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js', 'GUIDE.md', 'play.html', 'swatches.html', 'example.html',
  'tools/render.mjs', 'paintings/starter.gen.mjs', 'paintings/hills.json', 'paintings/magpie.json'];
for (const f of FILES) { mkdirSync(dirname(join(out, f)), {recursive: true}); copyFileSync(join(src, f), join(out, f)) }
// the README, without the lines about files that are not in the kit
const gone = ['magpie.gen.mjs', 'tools/test.mjs', 'tools/spectral.mjs', '`build.mjs`', 'magpie.standalone.html'];
writeFileSync(join(out, 'README.md'), readFileSync(join(src, 'README.md'), 'utf8').split('\n').filter(l => !gone.some(g => l.includes(g))).join('\n'));
console.log('kit written to ' + out + '  (' + (FILES.length + 1) + ' files)');

export function task(c) {
  return readFileSync(join(here, 'TASK.md'), 'utf8').split('---\n').pop().trim()
    .replaceAll('{SUBJECT}', c.subject).replaceAll('{W}', c.size[0]).replaceAll('{H}', c.size[1]).replaceAll('{STEM}', c.stem);
}
if (stem) { const c = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8')).find(c => c.stem === stem); if (!c) { console.error('no case "' + stem + '"'); process.exit(1) } console.log('\n----- task -----\n' + task(c)) }
