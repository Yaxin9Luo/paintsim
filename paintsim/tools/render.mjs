// node tools/render.mjs painting.json [out.png] [--scale 2] [--light window] [--upto "stage name"] [--crop x0,y0,x1,y1] [--check]
//
// Paints a painting (see README, "A painting as data") without a browser and writes a PNG.
// --check only reports what is wrong with the file. --upto stops after the named stage (or stage number, from 0).
// --crop writes only that part of the picture (page units), for a close look.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInThisContext} from 'node:vm';
import {deflateSync} from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['paintsim.js', 'paintsim.recipes.js', 'paintsim.painting.js']) runInThisContext(readFileSync(join(root, f), 'utf8'), {filename: f});
const P = globalThis.PaintSim;

const args = process.argv.slice(2), opt = {}, files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--check') opt.check = true;
  else if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i];
  else files.push(args[i]);
}
if (!files.length) { console.error('usage: node tools/render.mjs painting.json [out.png] [--scale 2] [--light name] [--upto stage] [--crop x0,y0,x1,y1] [--check]'); process.exit(2) }

let doc;
try { doc = JSON.parse(readFileSync(resolve(files[0]), 'utf8')) } catch (e) { console.error(files[0] + ': ' + e.message); process.exit(1) }
const problems = P.check(doc);
if (problems.length) { console.error(files[0] + ': ' + problems.length + ' problem' + (problems.length > 1 ? 's' : '') + '\n  - ' + problems.join('\n  - ')); process.exit(1) }
if (opt.check) { console.log(files[0] + ': sound'); process.exit(0) }

// PNG: 8-bit RGB, no filtering
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c });
const crc32 = buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 };
function png(w, h, rgba) {
  const row = w * 3 + 1, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) for (let x = 0, i = y * w * 4, j = y * row + 1; x < w; x++, i += 4, j += 3) { raw[j] = rgba[i]; raw[j + 1] = rgba[i + 1]; raw[j + 2] = rgba[i + 2] }
  const chunk = (type, data) => { const td = Buffer.concat([Buffer.from(type, 'ascii'), data]), b = Buffer.alloc(8); b.writeUInt32BE(data.length, 0); b.writeUInt32BE(crc32(td), 4); return Buffer.concat([b.subarray(0, 4), td, b.subarray(4)]) };
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const t0 = performance.now();
const upTo = opt.upto === undefined ? undefined : /^\d+$/.test(opt.upto) ? +opt.upto : opt.upto;
const player = P.open(doc, {scale: opt.scale ? +opt.scale : 2, light: opt.light, upTo});
const surface = player.finish(); surface.render();
const px = surface.pixels; let hash = 0; for (let i = 0; i < px.length; i++) hash = (Math.imul(hash, 31) + px[i]) | 0;
const out = files[1] || files[0].replace(/\.json$/i, '') + '.png';
let W = surface.pxWidth, H = surface.pxHeight, img = px;
if (opt.crop) {   // a part of the picture, in page units
  const c = opt.crop.split(',').map(Number), S = surface.scale;
  if (c.length !== 4 || c.some(isNaN)) { console.error('--crop takes x0,y0,x1,y1 in page units'); process.exit(2) }
  const x0 = Math.max(0, Math.round(c[0] * S)), y0 = Math.max(0, Math.round(c[1] * S)), x1 = Math.min(W, Math.round(c[2] * S)), y1 = Math.min(H, Math.round(c[3] * S)), w = x1 - x0, h = y1 - y0;
  if (w < 1 || h < 1) { console.error('--crop: nothing of the picture lies inside ' + opt.crop); process.exit(2) }
  img = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) img.set(px.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1) * 4), y * w * 4);
  W = w; H = h;
}
writeFileSync(resolve(out), png(W, H, img));
console.log(`${out}  ${W}×${H}  ${player.total} steps in ${player.stages.length} stages  ${((performance.now() - t0) / 1000).toFixed(2)} s  fingerprint ${(hash >>> 0).toString(16)}`);
