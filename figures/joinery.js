/**
 * Joinery: a sixteen-piece puzzle, assembled in a shallow tray. Pieces near
 * the pointer rise out of the board and turn a little, the nearest highest,
 * each over its own empty slot with dashed guides dropping to it; the swell
 * follows the pointer, and pieces settle home behind it. Every piece has a
 * border line inset on its face and four dots at its heart. At rest one piece
 * stands lifted, as if about to be placed. The slider is the swell's reach.
 *
 * Seated pieces paint all their walls before any of their faces, so the board
 * reads as one surface; lifted pieces paint whole, after it, back to front.
 */
const {
  Cam, clamp, fillet, fit, poly, prism, proj, rad, rings, seg, unproj,
  spring, stepS, disposer, mk, place, pointer, put, register, solid, facing,
} = HL;

const N = 4, A = 26, HF = A / 2, T = 4, H = 24, IN = 1.5;
const REST = [0.5 * A, -0.5 * A + 0.2, 0.62]; // a ground point and a height: one piece lifted, its neighbours stirring
const seam = (a, b) => ((a + b) % 2 ? 1 : -1); // tab or socket across each seam, alternating

/** One edge from p to q, outward normal n; kind 1 a tab, -1 a socket, 0 flat. */
function edge(p, q, n, kind, out, r) {
  const at = (t, d) => [p[0] + (q[0] - p[0]) * t + n[0] * d * A * kind, p[1] + (q[1] - p[1]) * t + n[1] * d * A * kind];
  out.push({ pt: p, r });
  if (!kind) return;
  out.push({ pt: at(0.36, 0), r: 1 }, { pt: at(0.42, 0.07), r: 0.5 });
  for (let a = 232; a >= -52; a -= 24) out.push({ pt: at(0.5 + 0.12 * Math.cos(rad(a)), 0.17 + 0.12 * Math.sin(rad(a))), r: 0 });
  out.push({ pt: at(0.58, 0.07), r: 0.5 }, { pt: at(0.64, 0), r: 1 });
}

/** Piece (i, j)'s outline and its inset border, centred on the origin. Only the board's own corners are round. */
function shapes(i, j) {
  const k = {
    top: j > 0 ? -seam(i, j - 1) : 0, bottom: j < N - 1 ? seam(i, j) : 0,
    left: i > 0 ? -seam(i - 1, j + 7) : 0, right: i < N - 1 ? seam(i, j + 7) : 0,
  };
  const round = (p) => {
    const cx = i + (p[0] > 0 ? 1 : 0), cy = j + (p[1] > 0 ? 1 : 0);
    return (cx === 0 || cx === N) && (cy === 0 || cy === N) ? 2.5 : 0.01;
  };
  const out = [];
  edge([-HF, -HF], [HF, -HF], [0, -1], k.top, out, round([-HF, -HF]));
  edge([HF, -HF], [HF, HF], [1, 0], k.right, out, round([HF, -HF]));
  edge([HF, HF], [-HF, HF], [0, 1], k.bottom, out, round([HF, HF]));
  edge([-HF, HF], [-HF, -HF], [-1, 0], k.left, out, round([-HF, HF]));
  const shape = fillet(out.map((o) => o.pt), out.map((o) => o.r || 0.01), 3);
  // the border: every point moved IN along the outline's inward normal
  const m = shape.length, inset = shape.map((p, q) => {
    const a = shape[(q + m - 1) % m], b = shape[(q + 1) % m], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / l) * IN, p[1] + (dx / l) * IN];
  });
  return { shape, inset };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;

  const C = Cam(45, 0.5, 1.62);
  const E = N * HF + 7;
  fit(C, [[-E, -E, -5], [E, E, -5], [E, -E, -5], [-E, E, -5], [-E, -E, H + T]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [tr, ti] = rings(-E, -E, E, E, 6, 2);
  put(solid(g), prism(P, front, tr, ti, -5, 0));
  const slots = mk("g", {}, g), wallsL = mk("g", {}, g), topsL = mk("g", {}, g), liftL = mk("g", {}, g);

  const pieces = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const { shape, inset } = shapes(i, j), seat = [(i - N / 2 + 0.5) * A, (j - N / 2 + 0.5) * A];
    mk("path", { class: "nf lo", d: poly(shape.map(([u, v]) => P(seat[0] + u, seat[1] + v, 0))) }, slots);
    const w = mk("g", {}, wallsL), t = mk("g", {}, topsL);
    const p = {
      i, j, shape, inset, seat, w, t, yaw: ((i * 7 + j * 13) % 5 - 2) * 6 + 3,
      guide: mk("path", { class: "nf dash" }, w), foot: mk("path", { class: "sil" }, w), sides: mk("path", { class: "nf sil" }, w),
      fills: [1, 2, 3].map(() => mk("path", { class: "fo" }, w)),
      top: mk("path", { class: "sil" }, t), border: mk("path", { class: "nf lo" }, t),
      dots: [0, 1, 2, 3].map(() => mk("circle", { r: 0.95, class: "dot off" }, t)),
      sp: spring(0), last: NaN,
    };
    pieces.push(p);
  }

  function draw() {
    pieces.forEach((p) => {
      const z0 = p.sp.x;
      if (Math.abs(z0 - p.last) < 1e-3) return;
      p.last = z0;
      const yaw = rad(p.yaw * clamp(z0 / H, 0, 1)), c = Math.cos(yaw), s = Math.sin(yaw);
      const W = ([u, v], z) => P(p.seat[0] + u * c - v * s, p.seat[1] + u * s + v * c, z);
      const lo = p.shape.map((q) => W(q, z0)), hi = p.shape.map((q) => W(q, z0 + T)), n = lo.length;
      p.foot.setAttribute("d", poly(lo));
      let d = "";
      for (let m = 0; m < n; m++) {
        const a = lo[(m + n - 1) % n][0], b = lo[m][0], e = lo[(m + 1) % n][0];
        if ((b - a) * (e - b) < 0) d += seg(lo[m], hi[m]);
      }
      p.sides.setAttribute("d", d);
      p.fills.forEach((el, q) => el.setAttribute("d", poly(p.shape.map((pt) => W(pt, z0 + (T * (q + 1)) / 4)))));
      p.top.setAttribute("d", poly(hi));
      p.border.setAttribute("d", poly(p.inset.map((q) => W(q, z0 + T))));
      p.dots.forEach((el, q) => place(el, W([((q % 2) - 0.5) * 3.4, (Math.floor(q / 2) - 0.5) * 3.4], z0 + T)));
      p.guide.setAttribute("d", z0 > 1 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => seg(P(p.seat[0] + a * HF, p.seat[1] + b * HF, 0), W([a * HF, b * HF], z0))).join("") : "");
    });
    // seated: walls, then faces, as one surface; lifted: whole, after the board, back to front
    pieces.slice().sort((a, b) => a.seat[0] + a.seat[1] - b.seat[0] - b.seat[1]).forEach((p) => {
      if (p.sp.x > 0.25) { liftL.appendChild(p.w); liftL.appendChild(p.t); }
      else { wallsL.appendChild(p.w); topsL.appendChild(p.t); }
    });
  }

  const B = register(stage, (dt) => {
    let moving = false;
    pieces.forEach((p) => { if (stepS(p.sp, dt)) moving = true; });
    draw();
    return moving;
  });
  bag.add(B.unregister);

  /** The swell, centred on a ground point: height falls with distance to each seat, to nothing past the reach. */
  function swell(wx, wy, k) {
    let near = null, nd = Infinity;
    pieces.forEach((p) => {
      const d = Math.hypot(wx - p.seat[0], wy - p.seat[1]), f = Math.exp(-2.2 * (d / reach) ** 2);
      p.sp.t = f < 0.05 ? 0 : H * k * f;
      if (d < nd) { nd = d; near = p; }
    });
    pieces.forEach((p) => {
      p.top.classList.toggle("hi", p === near);
      p.dots.forEach((el) => el.setAttribute("class", p === near ? "dot m" : "dot off"));
    });
    return near;
  }

  function aim(pt) {
    if (!pt) { swell(REST[0], REST[1], REST[2]); read.textContent = "rest"; B.wake(); return; }
    const [wx, wy] = unproj(C, pt[0], pt[1], 0);
    if (Math.max(Math.abs(wx), Math.abs(wy)) > N * HF + 10) { aim(null); return; } // off the board is rest
    const near = swell(wx, wy, 1);
    read.textContent = `piece ${near.j + 1}·${near.i + 1}`;
    B.wake();
  }

  aim(null);
  draw();
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { reach = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "joinery",
  means: "A sixteen-piece puzzle in a tray: the pieces near the pointer rise out of their slots, and settle home behind it.",
  rules: [1, 3, 5, 6],
  range: [16, 26, 40],
  tour: [[170, 152], [230, 212], [260, 167], null],
  mount,
});
