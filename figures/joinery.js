/**
 * Joinery: four interlocking pieces of one square, three of them loose and
 * turned on the ground around a dashed outline of where they belong, one
 * already seated. Each loose piece slides home and squares up as the pointer
 * nears its seat, the nearer the further, so the pointer at the middle locks
 * all four. The slider is the reach: how far the pull extends past a seat.
 *
 * The pattern: a field. The pointer lands on the ground plane, which never
 * moves, and each piece's pull is measured to its seat, not to where it is.
 */
const {
  Cam, clamp, fillet, fit, poly, proj, rad, seg, unproj,
  spring, stepS, disposer, mk, pointer, register,
} = HL;

const A = 44, HF = A / 2, T = 4.5, CORE = 33;
// i, j: the piece's place in the 2 × 2; gap and yaw: how far out and how turned it rests
const PIECES = [
  { i: 0, j: 0, gap: 17, yaw: 11 },
  { i: 1, j: 0, gap: 27, yaw: -15 },
  { i: 0, j: 1, gap: 0, yaw: 0 },
  { i: 1, j: 1, gap: 21, yaw: 8 },
];
const SEATED = 2;

/** One edge from p to q, outward normal n; kind 1 is a tab, -1 a socket, 0 flat. */
function edge(p, q, n, kind, out) {
  const at = (t, d) => [p[0] + (q[0] - p[0]) * t + n[0] * d * A * kind, p[1] + (q[1] - p[1]) * t + n[1] * d * A * kind];
  out.push({ pt: p, r: 3 });
  if (!kind) return;
  out.push({ pt: at(0.36, 0), r: 1.2 }, { pt: at(0.42, 0.07), r: 0.6 });
  for (let a = 232; a >= -52; a -= 24) out.push({ pt: at(0.5 + 0.12 * Math.cos(rad(a)), 0.17 + 0.12 * Math.sin(rad(a))), r: 0 });
  out.push({ pt: at(0.58, 0.07), r: 0.6 }, { pt: at(0.64, 0), r: 1.2 });
}

/** The piece's outline in its own frame, centred on the origin. */
function outline({ i, j }) {
  const col = j === 0 ? 1 : -1, row = i === 1 ? 1 : -1; // the seams: tab or socket, matched across each
  const kinds = {
    top: j === 1 ? -row : 0, right: i === 0 ? col : 0,
    bottom: j === 0 ? row : 0, left: i === 1 ? -col : 0,
  };
  const out = [];
  edge([-HF, -HF], [HF, -HF], [0, -1], kinds.top, out);
  edge([HF, -HF], [HF, HF], [1, 0], kinds.right, out);
  edge([HF, HF], [-HF, HF], [0, 1], kinds.bottom, out);
  edge([-HF, HF], [-HF, -HF], [-1, 0], kinds.left, out);
  return fillet(out.map((o) => o.pt), out.map((o) => o.r || 0.01), 3);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;

  const C = Cam(45, 0.5, 1.95);
  const far = A + 20;
  fit(C, [[-far, -far, 0], [far, far, 0], [far, -far, 0], [-far, far, T]], 200, 170);
  const P = proj(C);

  const g = mk("g", {}, svg);
  mk("path", { class: "nf dash", d: poly(fillet([[-A, -A], [A, -A], [A, A], [-A, A]], [3, 3, 3, 3]).map((p) => P(p[0], p[1], 0))) }, g);

  const pieces = PIECES.map((pc, k) => {
    const grp = mk("g", {}, g);
    const foot = mk("path", { class: "sil" }, grp);
    const sides = mk("path", { class: "nf sil" }, grp);
    const body = [1, 2, 3].map(() => mk("path", { class: "fo" }, grp));
    const top = mk("path", { class: "sil" }, grp);
    const seat = [(pc.i - 0.5) * A, (pc.j - 0.5) * A];
    const len = Math.hypot(seat[0], seat[1]);
    return { ...pc, k, grp, foot, sides, body, top, seat, dir: [seat[0] / len, seat[1] / len], shape: outline(pc), sp: spring(pc.gap), last: NaN };
  });

  function draw() {
    pieces.forEach((p) => {
      const gp = p.sp.x;
      if (Math.abs(gp - p.last) < 1e-3) return;
      p.last = gp;
      const yaw = rad(p.gap ? p.yaw * (gp / p.gap) : 0), c = Math.cos(yaw), s = Math.sin(yaw);
      const cx = p.seat[0] + p.dir[0] * gp, cy = p.seat[1] + p.dir[1] * gp;
      const ring = (z) => p.shape.map(([u, v]) => P(cx + u * c - v * s, cy + u * s + v * c, z));
      const at = (z) => poly(ring(z));
      p.foot.setAttribute("d", at(0));
      // the wall's silhouette: an upright line wherever the outline turns back on screen; the fills above hide those behind
      const lo = ring(0), hi = ring(T), n = lo.length;
      let d = "";
      for (let m = 0; m < n; m++) {
        const a = lo[(m + n - 1) % n][0], b = lo[m][0], e = lo[(m + 1) % n][0];
        if ((b - a) * (e - b) < 0) d += seg(lo[m], hi[m]);
      }
      p.sides.setAttribute("d", d);
      p.body.forEach((el, n) => el.setAttribute("d", at((T * (n + 1)) / 4)));
      p.top.setAttribute("d", at(T));
      p.depth = cx + cy;
    });
    // back to front by where each piece is now: the group moves, nothing is redrawn
    pieces.slice().sort((a, b) => a.depth - b.depth).forEach((p) => g.appendChild(p.grp));
  }

  const B = register(stage, (dt) => {
    let moving = false;
    pieces.forEach((p) => { if (stepS(p.sp, dt)) moving = true; });
    draw();
    return moving;
  });
  bag.add(B.unregister);

  function light(k) { pieces.forEach((p) => p.top.classList.toggle("hi", p.k === k)); }

  /** Each piece's gap falls with the pointer's distance to its seat, on the ground plane. */
  function aim(pt) {
    if (!pt) {
      pieces.forEach((p) => { p.sp.t = p.gap; });
      light(SEATED); read.textContent = "rest"; B.wake(); return;
    }
    const [wx, wy] = unproj(C, pt[0], pt[1], 0);
    let near = SEATED, nd = Infinity;
    pieces.forEach((p) => {
      const d = Math.hypot(wx - p.seat[0], wy - p.seat[1]);
      p.sp.t = p.gap * clamp((d - CORE) / reach, 0, 1);
      if (p.gap && d < nd) { nd = d; near = p.k; }
    });
    light(near);
    read.textContent = `${pieces.filter((p) => p.sp.t <= p.gap * 0.15).length} of 4`;
    B.wake();
  }

  draw();
  aim(null);
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { reach = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "joinery",
  means: "Four interlocking pieces of one square: each slides home and squares up as the pointer nears its seat.",
  rules: [1, 3, 5, 6],
  range: [24, 46, 72],
  tour: [[250, 120], [205, 215], [200, 170], null],
  mount,
});
