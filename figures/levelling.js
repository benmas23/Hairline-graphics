/**
 * Levelling: a laser-cut topographic model, each contour line a thin layer,
 * stacked on a board into twin summits, a ridge and a knoll, with a square pad
 * graded level into it: a site made ready to build on. The pointer is
 * projected back onto the board, and the pad follows it, cut and filled level
 * at the land's height there, so the layers re-form round its edges; at rest
 * it sits on the slope of the tallest hill. The pad's own contour takes the
 * bright stroke. The slider is the pad's size.
 *
 * The pattern: a continuous field, as Terrain. Springs for where the pad is
 * and its level, a falloff at its edge, a hit test on the board (which never
 * moves), and contours traced from the height field by marching squares.
 */
const {
  Cam, clamp, facing, fit, open, poly, prism, proj, rings, seg, unproj, spring, stepS,
  disposer, mk, pointer, put, register, solid,
} = HL;

const W = 150, G = 50, CS = W / G, K = 12, T = 3.9, PB = 5, PAD = [62, 96];
const ease = (t) => t * t * (3 - 2 * t);

/** The land at rest, in levels: Gaussian hills [x, y, height, spread], held to zero at the board's edge. */
const HILLS = [[48, 50, 7.6, 17], [84, 44, 6.6, 13], [110, 104, 9.4, 20], [38, 112, 4.8, 13], [75, 78, 2.8, 48], [128, 38, 3.4, 14], [20, 80, 2.6, 12], [96, 140, 2.8, 12]];
const edge = (x, y) => { const e = clamp(Math.min(x, W - x, y, W - y) / 13, 0, 1); return e * e * (3 - 2 * e); };
const land = (x, y) => edge(x, y) * HILLS.reduce((h, [cx, cy, a, s]) => h + a * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s)), 0);
const BASE = new Float32Array((G + 1) * (G + 1));
for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) BASE[j * (G + 1) + i] = land(i * CS, j * CS);

/** Each marching-squares case: the pairs of cell edges (0 bottom, 1 right, 2 top, 3 left) its contour joins. Saddles 5 and 10 by the centre. */
const CASES = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[3, 2]], [[2, 3]], [[0, 2]], null, [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];

/** One pass of corner cutting on a closed loop: every corner rounds, and the loop keeps its place. */
const smooth = (loop) => loop.flatMap((p, k) => { const q = loop[(k + 1) % loop.length]; return [[0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]]; });

/** The closed loops where field F crosses level L, as world [x, y] points, smoothed twice. */
function trace(F, L) {
  const at = (i, j) => F[j * (G + 1) + i], nb = new Map(), pt = new Map();
  const point = (k, a, b) => {
    if (!pt.has(k)) { const fa = at(...a), fb = at(...b), t = (L - fa) / (fb - fa); pt.set(k, [(a[0] + (b[0] - a[0]) * t) * CS, (a[1] + (b[1] - a[1]) * t) * CS]); }
    return k;
  };
  const join = (a, b) => { (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); };
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
    const n = (c[0] >= L) | ((c[1] >= L) << 1) | ((c[2] >= L) << 2) | ((c[3] >= L) << 3);
    if (n === 0 || n === 15) continue;
    const e = [
      () => point(`h${i},${j}`, [i, j], [i + 1, j]), () => point(`v${i + 1},${j}`, [i + 1, j], [i + 1, j + 1]),
      () => point(`h${i},${j + 1}`, [i, j + 1], [i + 1, j + 1]), () => point(`v${i},${j}`, [i, j], [i, j + 1]),
    ];
    const mid = (c[0] + c[1] + c[2] + c[3]) / 4 >= L;
    const pairs = CASES[n] || (n === 5 ? (mid ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]) : mid ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]]);
    for (const [a, b] of pairs) join(e[a](), e[b]());
  }
  const loops = [], seen = new Set();
  for (const start of nb.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur); loop.push(pt.get(cur));
      const [a, b] = nb.get(cur), next = a !== prev ? a : b;
      prev = cur; cur = next;
    }
    if (loop.length > 2) loops.push(smooth(smooth(loop)));
  }
  return loops;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let R = value, over = null;
  const C = Cam(45, 0.5, 1.55);
  fit(C, [[-6, -6, -PB], [W + 6, W + 6, -PB], [W + 6, -6, -PB], [-6, W + 6, -PB], [W / 2, W / 2, (K + 1) * T]], 200, 170);
  const P = proj(C), front = facing(C);
  /** The pad's level at world point q: half a layer above the layer the land is on there. */
  const level = (q) => Math.floor(land(...q)) + 0.5;
  const bx = spring(PAD[0]), by = spring(PAD[1]), ph = spring(level(PAD), { eps: 0.004 });
  const F = new Float32Array(BASE.length);

  // The board, then one group per level, bottom up: higher layers sit inside lower ones, so they cover them.
  const g = mk("g", {}, svg);
  const [br, bi] = rings(-6, -6, W + 6, W + 6, 8, 2), board = solid(g);
  put(board, prism(P, front, br, bi, -PB, 0));
  const levels = [];
  for (let k = 1; k <= K; k++) {
    const lg = mk("g", {}, g);
    levels.push({ k, g: lg, band: mk("path", { class: "fo" }, lg), foot: mk("path", { class: "nf lo" }, lg), top: mk("path", { class: "sil" }, lg), loops: [] });
  }
  // The pad: a level platform half a layer thick, its edge the bright mark. It is moved in the paint order to sit on its own layer.
  const pad = solid(g);
  pad.sil.classList.add("hi");
  let padAt = -1;
  /** Traces the field as it is now, redraws every layer, and sets the pad on the one it is cut into. */
  function draw() {
    for (let j = 0, n = 0; j <= G; j++) for (let i = 0; i <= G; i++, n++) {
      // a rounded square: how far the point is from the pad's middle, in pad half-widths
      const x = i * CS, y = j * CS, q = (((x - bx.x) / R) ** 4 + ((y - by.x) / R) ** 4) ** 0.25;
      const w = (1 - ease(clamp((q - 0.8) / 0.55, 0, 1))) * edge(x, y);
      F[n] = Math.min(K + 0.6, BASE[n] + w * (ph.x - BASE[n]));
    }
    for (const lv of levels) {
      lv.loops = trace(F, lv.k);
      const z1 = lv.k * T, z0 = z1 - T, ring = (l, z) => l.map(([x, y]) => P(x, y, z));
      // the cut edge: the loop swept from its foot to its top, filled; then the foot's line, the top, and its two side edges
      lv.band.setAttribute("d", lv.loops.map((l) => [0, 0.5].map((f) => poly(ring(l, z0 + f * T))).join("")).join(""));
      lv.foot.setAttribute("d", lv.loops.map((l) => open(ring(l, z0))).join(""));
      lv.top.setAttribute("d", lv.loops.map((l) => {
        const a = ring(l, z1), lo = a.reduce((m, p) => (p[0] < m[0] ? p : m)), hi = a.reduce((m, p) => (p[0] > m[0] ? p : m));
        return poly(a) + seg(lo, [lo[0], lo[1] + (P(0, 0, 0)[1] - P(0, 0, T)[1])]) + seg(hi, [hi[0], hi[1] + (P(0, 0, 0)[1] - P(0, 0, T)[1])]);
      }).join(""));
    }
    const k = clamp(Math.floor(ph.x), 0, K), h = R * 0.8;
    if (k !== padAt) { padAt = k; (k ? levels[k - 1].g : board.g).after(pad.g); }
    const [pr2, pi2] = rings(bx.x - h, by.x - h, bx.x + h, by.x + h, h * 0.35, 1.2);
    put(pad, prism(P, front, pr2, pi2, k * T, ph.x * T));
  }

  const B = register(stage, (dt) => {
    let m = stepS(ph, dt);
    if (stepS(bx, dt)) m = true;
    if (stepS(by, dt)) m = true;
    draw();
    return m;
  });
  bag.add(B.unregister);

  /** Moves the pad to world point q and grades it level at the land's height there. */
  const site = (q) => { bx.t = q[0]; by.t = q[1]; ph.t = level(q); B.wake(); };
  bag.add(pointer(stage, {
    move: (p) => {
      over = unproj(C, p[0], p[1], 0).map((v) => clamp(v, 0, W));
      site(over);
      read.textContent = `pad ${Math.round(level(over) * 100)} m`;
    },
    leave: () => { over = null; site(PAD); read.textContent = "rest"; },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "levelling",
  means: "A layered contour model with a site graded into it: the land under the pointer is levelled into a flat pad, ready to build on.",
  rules: [1, 3, 5, 9],
  range: [14, 20, 28],
  tour: [[220, 141], [204, 219], [176, 198], null],
  mount,
});
