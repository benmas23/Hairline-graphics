/**
 * Bricks: a tower of studded toy bricks on a studded baseplate, two to a
 * course, each course turned a quarter to the one below so they lock. The
 * pointer's height is how far the build has got: the bricks up to it are
 * placed, the next one hovers, lit, over its spot, and the rest are not there
 * yet. Moving down takes them off again. At rest the tower is five of eight,
 * with the sixth hovering.
 *
 * The pattern: a scrub over discrete items. Each brick has two tweens, its
 * size (it grows in where it will be needed) and its height over its seat,
 * staggered outwards from where the build is. The hit test reads the pointer's
 * height against the tower's rest pose, which never moves.
 */
const {
  Cam, circ, clamp, facing, fit, prism, proj, rings,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const LEN = 40, DEP = 20, HGT = 12, PITCH = 10, SR = 3.2, SH = 2.4, COURSES = 4, N = COURSES * 2;
const PX0 = -12, PX1 = 52, BT = 3, STEP = 45, REST = 5;

/** The bricks in build order: two to a course, lying along x on even courses and along y on odd ones, the far one first. */
const BRICKS = [];
for (let c = 0; c < COURSES; c++) for (let k = 0; k < 2; k++) {
  const alongX = c % 2 === 0;
  BRICKS.push({ c, alongX, x0: alongX ? 0 : k * DEP, y0: alongX ? k * DEP : 0, z0: c * HGT });
}

/** A stud's two rings, round (cx, cy), at size s. */
const STUD = circ(SR, 16), STUD_IN = circ(SR - 0.7, 16);
const at = (ring, cx, cy, s = 1) => ring.map((q) => ({ u: cx + q.u * s, v: cy + q.v * s, nu: q.nu, nv: q.nv }));
const stud = (P, front, el, x, y, z, s = 1) => put(el, prism(P, front, at(STUD, x, y, s), at(STUD_IN, x, y, s), z, z + SH * s));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let hover = value;

  // Fitted with the top brick hovering at its highest, so nothing leaves the frame at intensity 1.
  const C = Cam(45, 0.5, 2.55), top = COURSES * HGT + SH + 30;
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

  const bricks = BRICKS.map((b, i) => {
    const grp = mk("g", {}, g), body = solid(grp), studs = [];
    for (let j = 0; j < 8; j++) studs.push(solid(grp));
    const s0 = i <= REST ? 1 : 0, h0 = i < REST ? 0 : hover;
    return { ...b, grp, body, studs, s: tween(s0), h: tween(h0), drawn: "" };
  });

  for (const q of plate.filter((q) => !behind(q))) stud(P, front, solid(g), q[0], q[1], 0);

  /** Brick b at size s (about its own middle) and h over its seat. */
  function draw(b, s, h) {
    const key = s.toFixed(3) + "," + h.toFixed(2);
    if (key === b.drawn) return;
    b.drawn = key;
    if (s < 0.02) { b.grp.setAttribute("visibility", "hidden"); return; }
    b.grp.removeAttribute("visibility");
    const lx = b.alongX ? LEN : DEP, ly = b.alongX ? DEP : LEN, cx = b.x0 + lx / 2, cy = b.y0 + ly / 2;
    const z0 = b.z0 + h + (HGT * (1 - s)) / 2, z1 = z0 + HGT * s;
    const [r, inner] = rings(cx - (lx / 2) * s, cy - (ly / 2) * s, cx + (lx / 2) * s, cy + (ly / 2) * s, 2 * s, 1 * s);
    put(b.body, prism(P, front, r, inner, z0, z1));
    // eight studs, two rows of four, far ones first so the near ones cover them
    b.studs.forEach((st, j) => {
      const a = ((j % 4) - 1.5) * PITCH * s, w = (Math.floor(j / 4) - 0.5) * PITCH * s;
      stud(P, front, st, cx + (b.alongX ? a : w), cy + (b.alongX ? w : a), z1, s);
    });
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of bricks) {
      draw(b, tval(b.s, now), tval(b.h, now));
      if (!tdone(b.s, now) || !tdone(b.h, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  // The hit test: the pointer's height against the rest tower's foot and top, on screen. It never moves.
  const foot = P(LEN / 2, LEN / 2, 0)[1], head = P(LEN / 2, LEN / 2, COURSES * HGT)[1];
  const count = ([, sy]) => Math.round(clamp((foot - sy) / (foot - head), 0, 1) * N);

  let built = -1;
  /** Builds up to n bricks (-1 goes back to rest). The stagger spreads out from where the build is. */
  function setBuilt(n, force) {
    if (n === built && !force) return;
    built = n;
    const now = performance.now(), m = n < 0 ? REST : n;
    bricks.forEach((b, i) => {
      const delay = Math.abs(i - m) * STEP;
      tset(b.s, i <= m ? 1 : 0, now, delay);
      tset(b.h, i < m ? 0 : hover, now, delay);
      b.body.sil.classList.toggle("hi", i === Math.min(m, N - 1));
    });
    read.textContent = n < 0 ? "rest" : `${n} brick${n === 1 ? "" : "s"}`;
    B.wake();
  }
  setBuilt(-1, true);

  bag.add(pointer(stage, { move: (p) => setBuilt(count(p)), leave: () => setBuilt(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { hover = v; setBuilt(built, true); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "bricks",
  means: "A tower of toy bricks, built as high as the pointer: the bricks up to it are placed, and the next one hovers over its spot.",
  rules: [1, 2, 5, 9],
  range: [10, 18, 30],
  tour: [[200, 210], [200, 131], [200, 184], null],
  mount,
});
