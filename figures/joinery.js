/**
 * Joinery: four interlocking pieces of one square, three of them loose and
 * turned on the ground around a dashed outline of where they belong, one
 * already seated. Hovering anywhere assembles it: the loose pieces slide home
 * and square up on the 700ms curve, staggered out from the piece nearest the
 * pointer, and leaving takes it apart again. The slider is the stagger, in ms.
 *
 * Walls are painted for every piece before any top face, so once assembled
 * the four tops make one surface and the joints' walls stay hidden.
 */
const {
  Cam, fillet, fit, poly, proj, rad, seg, unproj,
  tween, tset, tval, tdone, disposer, mk, pointer, register,
} = HL;

const A = 44, HF = A / 2, T = 4.5;
// i, j: the piece's place in the 2 × 2; gap and yaw: how far out and how turned it rests
const PIECES = [
  { i: 0, j: 0, gap: 17, yaw: 11 },
  { i: 1, j: 0, gap: 27, yaw: -15 },
  { i: 0, j: 1, gap: 0, yaw: 0 },
  { i: 1, j: 1, gap: 21, yaw: 8 },
];
const SEATED = 2;

/** One edge from p to q, outward normal n; kind 1 is a tab, -1 a socket, 0 flat. */
function edge(p, q, n, kind, out, outer) {
  const at = (t, d) => [p[0] + (q[0] - p[0]) * t + n[0] * d * A * kind, p[1] + (q[1] - p[1]) * t + n[1] * d * A * kind];
  out.push({ pt: p, r: outer(p) ? 3 : 0.01 }); // only the square's own corners are round, so the seams close flush
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
  const out = [], sx = i ? 1 : -1, sy = j ? 1 : -1;
  const outer = (p) => Math.sign(p[0]) === sx && Math.sign(p[1]) === sy;
  edge([-HF, -HF], [HF, -HF], [0, -1], kinds.top, out, outer);
  edge([HF, -HF], [HF, HF], [1, 0], kinds.right, out, outer);
  edge([HF, HF], [-HF, HF], [0, 1], kinds.bottom, out, outer);
  edge([-HF, HF], [-HF, -HF], [-1, 0], kinds.left, out, outer);
  return fillet(out.map((o) => o.pt), out.map((o) => o.r || 0.01), 3);
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.95);
  const far = A + 20;
  fit(C, [[-far, -far, 0], [far, far, 0], [far, -far, 0], [-far, far, T]], 200, 170);
  const P = proj(C);

  const g = mk("g", {}, svg);
  mk("path", { class: "nf dash", d: poly(fillet([[-A, -A], [A, -A], [A, A], [-A, A]], [3, 3, 3, 3]).map((p) => P(p[0], p[1], 0))) }, g);
  // every piece's walls first, every top face after: assembled, the tops tile one surface and hide the joints' walls
  const walls = mk("g", {}, g), tops = mk("g", {}, g);

  const pieces = PIECES.map((pc, k) => {
    const grp = mk("g", {}, walls);
    const foot = mk("path", { class: "sil" }, grp);
    const sides = mk("path", { class: "nf sil" }, grp);
    const body = [1, 2, 3].map(() => mk("path", { class: "fo" }, grp));
    const top = mk("path", { class: "sil" }, tops);
    const seat = [(pc.i - 0.5) * A, (pc.j - 0.5) * A];
    const len = Math.hypot(seat[0], seat[1]);
    return { ...pc, k, grp, foot, sides, body, top, seat, dir: [seat[0] / len, seat[1] / len], shape: outline(pc), tw: tween(pc.gap), last: NaN };
  });

  function draw(now) {
    pieces.forEach((p) => {
      const gp = tval(p.tw, now);
      if (Math.abs(gp - p.last) < 1e-3) return;
      p.last = gp;
      const yaw = rad(p.gap ? p.yaw * (gp / p.gap) : 0), c = Math.cos(yaw), s = Math.sin(yaw);
      const cx = p.seat[0] + p.dir[0] * gp, cy = p.seat[1] + p.dir[1] * gp;
      const ring = (z) => p.shape.map(([u, v]) => P(cx + u * c - v * s, cy + u * s + v * c, z));
      const lo = ring(0), hi = ring(T), n = lo.length;
      p.foot.setAttribute("d", poly(lo));
      // the wall's silhouette: an upright line wherever the outline turns back on screen
      let d = "";
      for (let m = 0; m < n; m++) {
        const a = lo[(m + n - 1) % n][0], b = lo[m][0], e = lo[(m + 1) % n][0];
        if ((b - a) * (e - b) < 0) d += seg(lo[m], hi[m]);
      }
      p.sides.setAttribute("d", d);
      p.body.forEach((el, q) => el.setAttribute("d", poly(ring((T * (q + 1)) / 4))));
      p.top.setAttribute("d", poly(hi));
      p.depth = cx + cy;
    });
    // back to front by where each piece is now: the groups move, nothing is redrawn
    pieces.slice().sort((a, b) => a.depth - b.depth).forEach((p) => { walls.appendChild(p.grp); tops.appendChild(p.top); });
  }

  const B = register(stage, (_dt, now) => {
    draw(now);
    return pieces.some((p) => !tdone(p.tw, now));
  });
  bag.add(B.unregister);

  let on = null;
  /** Hovering anywhere assembles it, the piece nearest the pointer first; leaving takes it apart from the one let go. */
  function aim(pt) {
    const now = performance.now();
    let near = SEATED;
    if (pt) {
      const [wx, wy] = unproj(C, pt[0], pt[1], 0);
      let nd = Infinity;
      pieces.forEach((p) => { const d = Math.hypot(wx - p.seat[0], wy - p.seat[1]); if (d < nd) { nd = d; near = p.k; } });
    }
    const join = !!pt, from = join ? near : on ?? SEATED;
    if (join !== (on !== null)) {
      // the stagger runs outward from the piece the pointer is nearest, by place in the 2 × 2
      const pa = pieces[from];
      pieces.forEach((p) => tset(p.tw, join ? 0 : p.gap, now, (Math.abs(p.i - pa.i) + Math.abs(p.j - pa.j)) * stag));
    }
    on = join ? near : null;
    pieces.forEach((p) => p.top.classList.toggle("hi", p.k === near));
    read.textContent = join ? "4 of 4" : "rest";
    B.wake();
  }

  draw(performance.now());
  aim(null);
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "joinery",
  means: "Four interlocking pieces of one square, one seated: hover and the rest slide home, nearest first.",
  rules: [2, 5, 6, 8],
  range: [0, 70, 150],
  tour: [[250, 120], [205, 215], [200, 170], null],
  mount,
});
