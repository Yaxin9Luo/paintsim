// node tools/spectral.mjs — prints the tables that paintsim.js uses to mix pigments.
//
// A colour is given as sRGB, but paint mixes by wavelength. So every colour is given a reflectance curve over
// 16 bands (390–710 nm, 20 nm each): the smoothest curves for the red, green and blue primaries that stay
// within 0…1, add up to 1 and give back exactly the same colour (the method of Scott Burns). RHO_* are those
// curves; MIX_* turn a reflectance curve back into linear sRGB.
//
// Colour matching functions: analytic fit of Wyman, Sloan & Shirley, "Simple Analytic Approximations to the
// CIE XYZ Color Matching Functions", JCGT 2013. The illuminant is a smooth curve chosen so that a flat
// reflectance is sRGB white.
const N = 16, LO = 390, HI = 710;
const g = (w, mu, a, b) => { const t = (w - mu) * (w < mu ? a : b); return Math.exp(-.5 * t * t) };
const xbar = w => .362 * g(w, 442, .0624, .0374) + 1.056 * g(w, 599.8, .0264, .0323) - .065 * g(w, 501.1, .0490, .0382);
const ybar = w => .821 * g(w, 568.8, .0213, .0247) + .286 * g(w, 530.9, .0613, .0322);
const zbar = w => 1.217 * g(w, 437, .0845, .0278) + .681 * g(w, 459, .0385, .0725);
const XYZ2RGB = [[3.2406, -1.5372, -.4986], [-.9689, 1.8758, .0415], [.0557, -.2040, 1.0570]];

function solve(A, b) {                       // Gauss–Jordan with partial pivoting
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c]; if (Math.abs(d) < 1e-14) throw new Error('singular system');
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// colour matching functions averaged over each band, then to linear sRGB
const bw = (HI - LO) / N, cm = [[], [], []];
for (let i = 0; i < N; i++) {
  let x = 0, y = 0, z = 0; const m = 40;
  for (let j = 0; j < m; j++) { const w = LO + bw * (i + (j + .5) / m); x += xbar(w); y += ybar(w); z += zbar(w) }
  cm[0].push(x / m * bw); cm[1].push(y / m * bw); cm[2].push(z / m * bw);
}
const M0 = XYZ2RGB.map(r => cm[0].map((_, i) => r[0] * cm[0][i] + r[1] * cm[1][i] + r[2] * cm[2][i]));
const u = i => (i + .5) / N * 2 - 1;
const co = solve(M0.map(r => [0, 1, 2].map(p => r.reduce((s, v, i) => s + v * Math.pow(u(i), p), 0))), [1, 1, 1]);
const E = cm[0].map((_, i) => co[0] + co[1] * u(i) + co[2] * u(i) * u(i));
if (Math.min(...E) <= 0) throw new Error('illuminant is not positive');
const M = M0.map(r => r.map((v, i) => v * E[i]));

// smoothest primaries: unknowns rhoR and rhoG (rhoB = 1 − rhoR − rhoG); minimise the squared steps of all three
const n2 = 2 * N, Q = Array.from({ length: n2 }, () => new Array(n2).fill(0)), DD = Array.from({ length: N }, () => new Array(N).fill(0));
for (let i = 0; i < N - 1; i++) { DD[i][i] += 1; DD[i + 1][i + 1] += 1; DD[i][i + 1] -= 1; DD[i + 1][i] -= 1 }
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { Q[i][j] = 2 * DD[i][j]; Q[N + i][N + j] = 2 * DD[i][j]; Q[i][N + j] = DD[i][j]; Q[N + i][j] = DD[i][j] }
for (let i = 0; i < n2; i++) Q[i][i] += 1e-9;
const zeros = () => new Array(N).fill(0), eq = [];
for (let c = 0; c < 3; c++) { eq.push([M[c].concat(zeros()), c === 0 ? 1 : 0]); eq.push([zeros().concat(M[c]), c === 1 ? 1 : 0]) }
const active = []; let x;
for (let it = 0; it < 200; it++) {            // add the worst broken bound as a constraint until none is broken
  const C = eq.concat(active), m = C.length, K = Array.from({ length: n2 + m }, () => new Array(n2 + m).fill(0)), rhs = new Array(n2 + m).fill(0);
  for (let i = 0; i < n2; i++) for (let j = 0; j < n2; j++) K[i][j] = Q[i][j];
  C.forEach((c, r) => { for (let j = 0; j < n2; j++) { K[n2 + r][j] = c[0][j]; K[j][n2 + r] = c[0][j] } rhs[n2 + r] = c[1]; if (r >= eq.length) K[n2 + r][n2 + r] = -1e-7 });
  x = solve(K, rhs).slice(0, n2);
  let worst = -1e-7, add = null;
  for (let i = 0; i < N; i++) {
    const r = x[i], gg = x[N + i], b = 1 - r - gg, v = new Array(n2).fill(0);
    if (r < worst) { worst = r; v[i] = 1; add = [v.slice(), 0]; v[i] = 0 }
    if (gg < worst) { worst = gg; v[N + i] = 1; add = [v.slice(), 0]; v[N + i] = 0 }
    if (b < worst) { worst = b; v[i] = 1; v[N + i] = 1; add = [v, 1] }
  }
  if (!add) break; active.push(add);
}
const cl = v => Math.min(1, Math.max(0, v)), f = a => '[' + a.map(v => { const s = v.toFixed(5).replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s }).join(',') + ']';
const rhoR = x.slice(0, N).map(cl), rhoG = x.slice(N).map(cl);

// check: each primary, and white, must come back as itself from the rounded tables
const rr = JSON.parse(f(rhoR)), rg = JSON.parse(f(rhoG)), rb = rr.map((r, i) => 1 - r - rg[i]), Mr = M.map(r => JSON.parse(f(r)));
let err = 0;
for (const [c, want] of [[rr, [1, 0, 0]], [rg, [0, 1, 0]], [rb, [0, 0, 1]], [rr.map(() => 1), [1, 1, 1]]])
  for (let ch = 0; ch < 3; ch++) err = Math.max(err, Math.abs(Mr[ch].reduce((s, v, i) => s + v * c[i], 0) - want[ch]));
if (Math.min(...rb) < -1e-4) throw new Error('blue primary goes negative');

console.log('// 16 bands, 390–710 nm. Largest round-trip error of the rounded tables: ' + err.toExponential(1));
console.log('const RHO_R=' + f(rhoR) + ',\n  RHO_G=' + f(rhoG) + ',');
console.log('  MIX_R=' + f(M[0]) + ',\n  MIX_G=' + f(M[1]) + ',\n  MIX_B=' + f(M[2]) + ';');
