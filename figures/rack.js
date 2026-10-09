/**
 * Rack: a wooden wine rack of twenty slots, bottles lying necks-out, three
 * slots bare. The bottle under the pointer slides out of its slot, and the
 * ones around it follow a little, staggered outwards from it on the 700ms
 * lift curve. At rest one bottle, tonight's, stands proud and bright. Only
 * what is in front of the rack's face is drawn, so a bottle is never seen
 * through the wood. The slider is how far the chosen bottle comes out.
 *
 * The pattern: discrete items, as Riffle. Tweens, a stagger by grid distance,
 * and a hit test on a fixed plane just in front of the face, so a bottle
 * sliding out from under the pointer cannot change the choice.
 */
const {
  Cam, circ, fit, facing, hull, open, poly, prism, proj, rings, rrect, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, reflect, register, solid,
} = HL;

const COLS = 5, ROWS = 4, PITCH = 18, M = 5, W = COLS * PITCH + 2 * M, ZT = ROWS * PITCH + 2 * M;
const D = 66, PL = 4, BASE = 4, SLOT = 7.7, SR = 3.4, STEP = 45, FALL = [1, 0.18, 0.05];
const EMPTY = new Set([3 * COLS + 3, 1 * COLS + 0, 0 * COLS + 4]), TONIGHT = 2 * COLS + 1, PROUD = 26;

/** Two bottles: knots [y, radius] along the axis, from the base. `sh` is where the shoulder starts, `s` its slope. */
const BORDEAUX = {
  body: [[0, 7], [47, 7], [50.5, 6.3], [53, 4.6], [56, 2.7]], sh: 47, s: 0.5,
  neck: [[56, 2.7], [76, 2.8], [76.6, 3.2], [79.5, 3.2]], cap: [66, 76.6],
};
const BURGUNDY = {
  body: [[0, 7.4], [38, 7.4], [46, 6.4], [53, 4.4], [58, 2.8]], sh: 38, s: 0.24,
  neck: [[58, 2.8], [76, 2.9], [76.6, 3.3], [79.5, 3.3]], cap: [67, 76.6],
};
const U = circ(1, 20);
const key = (p) => p[0].toFixed(2) + "," + p[1].toFixed(2);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let pull = value;

  // Fitted with the bottom-left bottle at its farthest, so nothing leaves the frame at intensity 1.
  const C = Cam(45, 0.5, 1.5), YT = BASE + 58 + 79.5, cx0 = M + PITCH / 2;
  fit(C, [[0, 0, -PL], [W, 0, -PL], [0, D, -PL], [W, D, -PL], [0, 0, ZT], [W, 0, ZT], [0, D, ZT], [W, D, ZT],
    [cx0 - 7, YT, M], [cx0 - 7, YT, ZT - M]], 200, 166);
  const P = proj(C), front = facing(C);
  // V points at the camera: the one direction the projection flattens.
  const o = P(0, 0, 0), ex = P(1, 0, 0), ey = P(0, 1, 0), ez = P(0, 0, 1);
  const a = [ex[0] - o[0], ey[0] - o[0], ez[0] - o[0]], b = [ex[1] - o[1], ey[1] - o[1], ez[1] - o[1]];
  let V = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  if (V[2] < 0) V = V.map((n) => -n);

  // The rack: a plinth, then the carcass, then its face with twenty rounded slots.
  const g = mk("g", {}, svg);
  const [kr, ki] = rings(3, 3, W - 3, D - 3, 3, 1.2);
  reflect(svg, g, P, front, kr, -PL, 14);
  put(solid(g), prism(P, front, kr, ki, -PL, 0));
  const [cr, ci] = rings(0, 0, W, D, 4, 1.6);
  put(solid(g), prism(P, front, cr, ci, 0, ZT));

  const slots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c, x = M + (c + 0.5) * PITCH, z = M + (r + 0.5) * PITCH;
    const d = poly(rrect(x - SLOT, z - SLOT, x + SLOT, z + SLOT, SR, 4).map((q) => P(q.u, D, q.v)));
    slots.push({ i, c, r, x, z, el: mk("path", { d, class: "nf" }, g), bt: null });
  }

  // Bottles, painted far to near along V: lower rows and left columns first.
  const order = slots.filter((s) => !EMPTY.has(s.i)).sort((p, q) => (V[0] * p.x + V[2] * p.z) - (V[0] * q.x + V[2] * q.z));
  for (const s of order) {
    const grp = mk("g", {}, g), p = (s.c + 2 * s.r) % 3 === 0 ? BURGUNDY : BORDEAUX;
    const jit = ((s.c * 7 + s.r * 3) % 4) * 0.7, rest = s.i === TONIGHT ? PROUD : jit;
    s.bt = {
      p, jit, rest, tw: tween(rest), drawn: NaN,
      body: mk("path", { class: "sil" }, grp), sh: mk("path", { class: "nf lo" }, grp),
      under: mk("path", { class: "fo" }, grp), neck: mk("path", { class: "nf sil" }, grp),
      cap: mk("path", { class: "nf lo" }, grp), cork: mk("path", { class: "nf lo" }, grp),
    };
  }

  /** A bottle `out` units from home: only what stands in front of the face (y ≥ D) is drawn. */
  function draw(s, out) {
    const bt = s.bt, p = bt.p, dy = BASE + out;
    const ring = (y, rho) => U.map((q) => P(s.x + q.u * rho, y, s.z + q.v * rho));
    const arc = (y, rho, slope) => (y < D ? "" : open(run(U, (q) => q.u * V[0] + q.v * V[2] + slope * V[1] > 0)
      .map((q) => P(s.x + q.u * rho, y, s.z + q.v * rho))));
    const clip = (ks) => {
      const kept = [];
      ks.forEach(([y0, r0], k) => {
        const y = y0 + dy;
        if (y < D) return;
        const prev = ks[k - 1];
        if (prev && prev[0] + dy < D) kept.push([D, r0 + ((prev[1] - r0) * (y - D)) / (y - prev[0] - dy)]);
        kept.push([y, r0]);
      });
      return kept;
    };
    const bk = clip(p.body), nk = clip(p.neck);
    bt.body.setAttribute("d", bk.length > 1 ? poly(hull(bk.flatMap(([y, r]) => ring(y, r)))) : "");
    bt.sh.setAttribute("d", arc(p.sh + dy, p.body[1][1], p.s));
    let under = "", neck = "";
    if (nk.length > 1) {
      const h = hull(nk.flatMap(([y, r]) => ring(y, r)));
      under = poly(h);
      // Where the neck meets the shoulder there is no edge: leave the back of its hull undrawn.
      const back = new Set(nk[0][0] > D ? ring(nk[0][0], nk[0][1]).map(key) : []), n = h.length;
      const i0 = h.findIndex((q, k) => !back.has(key(q)) && back.has(key(h[(k + n - 1) % n])));
      if (i0 < 0) neck = poly(h);
      else {
        const line = [h[(i0 + n - 1) % n]];
        for (let k = i0; !back.has(key(h[k % n])) && line.length <= n; k++) line.push(h[k % n]);
        line.push(h[(i0 + line.length - 1) % n]);
        neck = open(line);
      }
    }
    bt.under.setAttribute("d", under);
    bt.neck.setAttribute("d", neck);
    bt.cap.setAttribute("d", p.cap.map((y) => arc(y + dy, p.neck[1][1], 0)).join(""));
    const tip = p.neck[p.neck.length - 1];
    bt.cork.setAttribute("d", tip[0] + dy < D ? "" : poly(ring(tip[0] + dy, tip[1] - 1.1)));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const s of order) {
      const v = tval(s.bt.tw, now);
      if (v !== s.bt.drawn) { s.bt.drawn = v; draw(s, v); }
      if (!tdone(s.bt.tw, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  // Hit test on the plane y = D + 10, where the necks sit at rest. It never moves.
  const YH = D + 8, h0 = P(0, YH, 0), hx = P(1, YH, 0), hz = P(0, YH, 1);
  const ux = [hx[0] - h0[0], hx[1] - h0[1]], uz = [hz[0] - h0[0], hz[1] - h0[1]], det = ux[0] * uz[1] - ux[1] * uz[0];
  function hit([sx, sy]) {
    const qx = sx - h0[0], qy = sy - h0[1];
    const x = (qx * uz[1] - qy * uz[0]) / det, z = (ux[0] * qy - ux[1] * qx) / det;
    const c = Math.floor((x - M) / PITCH), r = Math.floor((z - M) / PITCH);
    return c < 0 || c >= COLS || r < 0 || r >= ROWS ? -1 : r * COLS + c;
  }

  let act = -1;
  /** Chooses slot a (-1 puts every bottle home). The stagger spreads out from the slot chosen, or the one let go. */
  function setActive(a, force) {
    if (a === act && !force) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    for (const s of slots) {
      const f = slots[from], d = f ? Math.max(Math.abs(s.c - f.c), Math.abs(s.r - f.r)) : 0;
      if (s.bt) {
        tset(s.bt.tw, a < 0 ? s.bt.rest : s.bt.jit + pull * (FALL[d] ?? 0), now, d * STEP);
        const on = a < 0 ? s.i === TONIGHT : s.i === a;
        s.bt.body.classList.toggle("hi", on); s.bt.neck.classList.toggle("hi", on);
      }
      s.el.classList.toggle("hi", s.i === a && !s.bt);
    }
    const s = slots[a];
    read.textContent = a < 0 ? "rest" : `row ${ROWS - s.r}·${s.c + 1}${s.bt ? "" : " empty"}`;
    B.wake();
  }
  setActive(-1, true);

  bag.add(pointer(stage, { move: (pt) => setActive(hit(pt)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { pull = v; if (act >= 0) setActive(act, true); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "rack",
  means: "A wine rack, bottles lying necks-out: the one under the pointer slides out, and its neighbours follow a little, in turn.",
  rules: [1, 2, 5, 6],
  range: [28, 42, 58],
  tour: [[174, 141], [155, 178], [212, 230], null],
  mount,
});
