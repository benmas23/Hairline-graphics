/**
 * Bricks: a tower of studded toy bricks on a studded baseplate, two to a
 * course, each course turned a quarter to the one below so they lock. At rest
 * the tower is drawn apart and staggered: every brick is there, each course
 * hovering over the one below, its two bricks pushed apart and every brick
 * set off its seat. The pointer's height is how far the tower is built: the
 * courses below it settle onto their studs, the ones above stay apart, and
 * moving down takes them apart again.
 *
 * The pattern: a continuous field over discrete items. One spring per brick
 * for how settled it is, its target read off the pointer's height against the
 * built tower's rest pose, which never moves. The slider is the gap.
 */
const {
  Cam, circ, clamp, facing, fit, prism, proj, rings, spring, stepS,
  disposer, mk, pointer, put, register, solid,
} = HL;

const LEN = 40, DEP = 20, HGT = 12, PITCH = 10, SR = 3.2, SH = 2.4, COURSES = 4, N = COURSES * 2;
const PX0 = -12, PX1 = 52, BT = 3, GAP_MAX = 14, SWAY = 0.8;

/** The bricks in build order: two to a course, lying along x on even courses and along y on odd ones, the far one first. */
const BRICKS = [];
for (let c = 0; c < COURSES; c++) for (let k = 0; k < 2; k++) {
  const alongX = c % 2 === 0;
  BRICKS.push({ c, k, alongX, x0: alongX ? 0 : k * DEP, y0: alongX ? k * DEP : 0, z0: c * HGT });
}

/** Where each brick sits when apart, in gaps: the pair in a course part along the line between them, and every brick slips along its length. */
const SLIP = [0.5, -0.7, -0.6, 0.4, 0.8, -0.3, -0.5, 0.9];
const offset = (b, i) => {
  const part = b.k ? 0.45 : -0.45, slip = SLIP[i];
  return b.alongX ? [slip, part] : [part, slip];
};

/** A stud's two rings, round (cx, cy). */
const STUD = circ(SR, 16), STUD_IN = circ(SR - 0.7, 16);
const at = (ring, cx, cy) => ring.map((q) => ({ u: cx + q.u, v: cy + q.v, nu: q.nu, nv: q.nv }));
const stud = (P, front, el, x, y, z) => put(el, prism(P, front, at(STUD, x, y), at(STUD_IN, x, y), z, z + SH));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value;

  // Fitted with the tower apart at the widest gap, so nothing leaves the frame at intensity 1.
  const C = Cam(45, 0.5, 2.15), top = COURSES * (HGT + GAP_MAX) + SH, w = GAP_MAX * SWAY;
  fit(C, [[PX0, PX0, -BT], [PX1, PX1, -BT], [PX1, PX0, -BT], [PX0, PX1, -BT], [-w, -w, top], [LEN + w, LEN + w, top], [LEN + w, -w, top], [-w, LEN + w, top]], 200, 162);
  const P = proj(C), front = facing(C);

  // The baseplate; its studs behind the tower; the tower, course by course; its studs in front.
  const g = mk("g", {}, svg);
  const [pr, pi] = rings(PX0, PX0, PX1, PX1, 4, 1.4);
  put(solid(g), prism(P, front, pr, pi, -BT, 0));
  const plate = [];
  for (let x = PX0 + 7; x < PX1; x += PITCH) for (let y = PX0 + 7; y < PX1; y += PITCH) if (x < 0 || y < 0 || x > LEN || y > LEN) plate.push([x, y]);
  const behind = (q) => q[0] < LEN && q[1] < LEN;
  for (const q of plate.filter(behind)) stud(P, front, solid(g), q[0], q[1], 0);

  const bricks = BRICKS.map((b, i) => {
    const grp = mk("g", {}, g), body = solid(grp), studs = [];
    for (let j = 0; j < 8; j++) studs.push(solid(grp));
    return { ...b, i, off: offset(b, i), body, studs, s: spring(0), drawn: "" };
  });

  for (const q of plate.filter((q) => !behind(q))) stud(P, front, solid(g), q[0], q[1], 0);

  /** Brick b, s settled: 1 on its seat, 0 apart. */
  function draw(b, s) {
    const a = 1 - clamp(s, 0, 1), dx = b.off[0] * gap * SWAY * a, dy = b.off[1] * gap * SWAY * a, h = (b.c + 1) * gap * a;
    const key = dx.toFixed(2) + "," + dy.toFixed(2) + "," + h.toFixed(2);
    if (key === b.drawn) return;
    b.drawn = key;
    const lx = b.alongX ? LEN : DEP, ly = b.alongX ? DEP : LEN, x0 = b.x0 + dx, y0 = b.y0 + dy, z0 = b.z0 + h, z1 = z0 + HGT;
    const [r, inner] = rings(x0, y0, x0 + lx, y0 + ly, 2, 1);
    put(b.body, prism(P, front, r, inner, z0, z1));
    // eight studs, two rows of four, far ones first so the near ones cover them
    b.studs.forEach((st, j) => {
      const u = ((j % 4) - 1.5) * PITCH, v = (Math.floor(j / 4) - 0.5) * PITCH;
      stud(P, front, st, x0 + lx / 2 + (b.alongX ? u : v), y0 + ly / 2 + (b.alongX ? v : u), z1);
    });
  }

  const B = register(stage, (dt) => {
    let moving = false;
    for (const b of bricks) { if (stepS(b.s, dt)) moving = true; draw(b, b.s.x); }
    return moving;
  });
  bag.add(B.unregister);

  // The hit test: the pointer's height against the built tower's foot and top, on screen. It never moves.
  const foot = P(LEN / 2, LEN / 2, 0)[1], head = P(LEN / 2, LEN / 2, COURSES * HGT)[1];
  const level = ([, sy]) => clamp((foot - sy) / (foot - head), 0, 1) * COURSES;

  /** Builds the tower up to height p, in courses (null takes it all apart). The course p is in settles part way. */
  function build(p) {
    let placed = 0;
    for (const b of bricks) {
      b.s.t = p === null ? 0 : clamp(p - b.c, 0, 1);
      if (b.s.t >= 1) placed++;
    }
    // the bright edge: the near brick of the course now settling; the top course's at rest and once built
    const lit = 2 * (p === null ? COURSES - 1 : Math.min(Math.floor(p), COURSES - 1)) + 1;
    bricks.forEach((b) => b.body.sil.classList.toggle("hi", b.i === lit));
    read.textContent = p === null ? "rest" : `${placed} brick${placed === 1 ? "" : "s"}`;
    B.wake();
  }
  build(null);

  bag.add(pointer(stage, { move: (pt) => build(level(pt)), leave: () => build(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { gap = v; for (const b of bricks) b.drawn = ""; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "bricks",
  means: "A tower of toy bricks, apart and staggered at rest: the pointer's height builds it, each course settling onto the studs below.",
  rules: [1, 3, 5, 8],
  range: [5, 9, 14],
  tour: [[200, 233], [200, 168], [200, 211], null],
  mount,
});
