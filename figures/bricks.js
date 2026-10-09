/**
 * Bricks: a tower of studded toy bricks on a studded baseplate, two to a
 * course, each course turned a quarter to the one below so they lock. At rest
 * the tower is drawn apart: every brick is there, each course hovering a
 * little over the one below. Hovering builds it: the bricks drop onto their
 * studs from the bottom up, and when the pointer leaves they lift apart again,
 * from the top down. The slider is the gap between the courses at rest.
 *
 * The pattern: one discrete change, built or not, on the 700ms lift curve,
 * staggered along the build order so the stack assembles a brick at a time.
 */
const {
  Cam, circ, facing, fit, prism, proj, rings,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const LEN = 40, DEP = 20, HGT = 12, PITCH = 10, SR = 3.2, SH = 2.4, COURSES = 4, N = COURSES * 2;
const PX0 = -12, PX1 = 52, BT = 3, STEP = 60, GAP_MAX = 12;

/** The bricks in build order: two to a course, lying along x on even courses and along y on odd ones, the far one first. */
const BRICKS = [];
for (let c = 0; c < COURSES; c++) for (let k = 0; k < 2; k++) {
  const alongX = c % 2 === 0;
  BRICKS.push({ c, alongX, x0: alongX ? 0 : k * DEP, y0: alongX ? k * DEP : 0, z0: c * HGT });
}

/** A stud's two rings, round (cx, cy). */
const STUD = circ(SR, 16), STUD_IN = circ(SR - 0.7, 16);
const at = (ring, cx, cy) => ring.map((q) => ({ u: cx + q.u, v: cy + q.v, nu: q.nu, nv: q.nv }));
const stud = (P, front, el, x, y, z) => put(el, prism(P, front, at(STUD, x, y), at(STUD_IN, x, y), z, z + SH));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value, built = false;

  // Fitted with the tower apart at the widest gap, so nothing leaves the frame at intensity 1.
  const C = Cam(45, 0.5, 2.3), top = COURSES * (HGT + GAP_MAX) + SH;
  fit(C, [[PX0, PX0, -BT], [PX1, PX1, -BT], [PX1, PX0, -BT], [PX0, PX1, -BT], [0, 0, top], [LEN, LEN, top]], 200, 162);
  const P = proj(C), front = facing(C);

  // The baseplate; its studs behind the tower; the tower, course by course; its studs in front.
  const g = mk("g", {}, svg);
  const [pr, pi] = rings(PX0, PX0, PX1, PX1, 4, 1.4);
  put(solid(g), prism(P, front, pr, pi, -BT, 0));
  const plate = [];
  for (let x = PX0 + 7; x < PX1; x += PITCH) for (let y = PX0 + 7; y < PX1; y += PITCH) if (x < 0 || y < 0 || x > LEN || y > LEN) plate.push([x, y]);
  const behind = (q) => q[0] < LEN && q[1] < LEN;
  for (const q of plate.filter(behind)) stud(P, front, solid(g), q[0], q[1], 0);

  // Apart, course c rides (c + 1) gaps over its seat: each course hovers one gap over the one below.
  const apart = (b) => (b.c + 1) * gap;
  const bricks = BRICKS.map((b) => {
    const grp = mk("g", {}, g), body = solid(grp), studs = [];
    for (let j = 0; j < 8; j++) studs.push(solid(grp));
    const brick = { ...b, body, studs, drawn: NaN };
    brick.h = tween(apart(brick));
    return brick;
  });
  // the top brick carries the bright edge: the last piece, apart or placed
  bricks[N - 1].body.sil.classList.add("hi");

  for (const q of plate.filter((q) => !behind(q))) stud(P, front, solid(g), q[0], q[1], 0);

  /** Brick b, h over its seat. */
  function draw(b, h) {
    if (h === b.drawn) return;
    b.drawn = h;
    const lx = b.alongX ? LEN : DEP, ly = b.alongX ? DEP : LEN, cx = b.x0 + lx / 2, cy = b.y0 + ly / 2, z0 = b.z0 + h, z1 = z0 + HGT;
    const [r, inner] = rings(b.x0, b.y0, b.x0 + lx, b.y0 + ly, 2, 1);
    put(b.body, prism(P, front, r, inner, z0, z1));
    // eight studs, two rows of four, far ones first so the near ones cover them
    b.studs.forEach((st, j) => {
      const a = ((j % 4) - 1.5) * PITCH, w = (Math.floor(j / 4) - 0.5) * PITCH;
      stud(P, front, st, cx + (b.alongX ? a : w), cy + (b.alongX ? w : a), z1);
    });
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of bricks) {
      draw(b, tval(b.h, now));
      if (!tdone(b.h, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  /** Builds the tower, bottom brick first, or takes it apart, top brick first. */
  function setBuilt(on, force) {
    if (on === built && !force) return;
    built = on;
    const now = performance.now();
    bricks.forEach((b, i) => tset(b.h, on ? 0 : apart(b), now, (on ? i : N - 1 - i) * STEP));
    read.textContent = on ? `${N} bricks` : "rest";
    B.wake();
  }
  read.textContent = "rest";

  bag.add(pointer(stage, { move: () => setBuilt(true), leave: () => setBuilt(false) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { gap = v; setBuilt(built, true); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "bricks",
  means: "A tower of toy bricks, drawn apart at rest: hovering builds it, each brick dropping onto the studs below, from the bottom up.",
  rules: [2, 5, 8, 9],
  range: [3, 6, 12],
  tour: [[200, 180], [205, 150], [195, 165], null],
  mount,
});
