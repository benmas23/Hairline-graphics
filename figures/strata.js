/**
 * Strata: a stack of five rounded plates, each smaller than the one below,
 * held apart on dashed guides. The pointer's x opens the stack, a spring on
 * the gap; its height picks a tier, which lifts clear of the one below on the
 * 700ms curve and takes the bright edge. At rest the middle tier sits raised.
 * The slider is the widest gap the stack opens to.
 *
 * The pattern: scrub and pick. The pick reads the gap's target, never its
 * position, so the tier under a still pointer cannot change while it moves.
 */
const {
  Cam, clamp, facing, fit, lerp, open, prism, proj, rings, rrect, seg,
  spring, stepS, tween, tset, tval, tdone, disposer, mk, pointer, register, put, solid,
} = HL;

const N = 5, T = 3.2, R = 7, B = 1.8, LIFT = 9, G0 = 5, GR = 9, PICK = 2;
const HALF = (i) => 50 - i * 7.5;
const CORN = (i) => HALF(i) - R * (1 - Math.SQRT1_2);
const SIGNS = [[-1, -1], [1, -1], [-1, 1]]; // the near corner has none: it would cross the face below

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gMax = value;
  const gap = spring(GR);
  const lifts = Array.from({ length: N }, (_, i) => tween(i === PICK ? LIFT : 0));

  const C = Cam(45, 0.5, 1.72);
  const top = N * (T + 22) + LIFT;
  fit(C, [[-50, -50, 0], [50, 50, 0], [50, -50, 0], [-50, 50, 0], [-20, -20, top], [20, 20, top]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const tiers = [];
  for (let i = 0; i < N; i++) {
    const guide = i > 0 ? mk("path", { class: "nf dash" }, g) : null;
    const s = solid(g);
    const [ring, inner] = rings(-HALF(i), -HALF(i), HALF(i), HALF(i), R, B);
    const k = Math.min(9, HALF(i) * 0.35), well = rrect(-HALF(i) + k, -HALF(i) + k, HALF(i) - k, HALF(i) - k, 4, 4);
    const recess = mk("path", { class: "nf lo" }, g);
    tiers.push({ s, guide, ring, inner, well, recess, last: "" });
  }

  /** Where each tier's foot sits, for a gap and a set of lifts. */
  function bases(gp, lf) {
    const z = [];
    let acc = 0;
    for (let i = 0; i < N; i++) { acc += lf[i]; z.push(i * (T + gp) + acc); }
    return z;
  }

  function draw(now) {
    const z = bases(gap.x, lifts.map((t) => tval(t, now)));
    tiers.forEach((t, i) => {
      const key = z[i].toFixed(3) + (i ? z[i - 1].toFixed(3) : "");
      if (key === t.last) return;
      t.last = key;
      put(t.s, prism(P, front, t.ring, t.inner, z[i], z[i] + T));
      t.recess.setAttribute("d", open(t.well.concat(t.well[0]).map((q) => P(q.u, q.v, z[i] + T))));
      if (t.guide) {
        const a = CORN(i - 1), b = CORN(i);
        t.guide.setAttribute("d", SIGNS.map(([sx, sy]) => seg(P(sx * a, sy * a, z[i - 1] + T), P(sx * b, sy * b, z[i]))).join(""));
      }
    });
  }

  const B2 = register(stage, (dt, now) => {
    let moving = stepS(gap, dt);
    draw(now);
    lifts.forEach((t) => { if (!tdone(t, now)) moving = true; });
    return moving;
  });
  bag.add(B2.unregister);

  let act = -2;
  /** Picks tier a (-1 is rest, which raises the middle tier again); the bright edge goes with it. */
  function choose(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act >= 0 ? act : PICK, lifted = a < 0 ? PICK : a;
    act = a;
    lifts.forEach((t, i) => tset(t, i === lifted ? LIFT : 0, now, Math.abs(i - from) * 40));
    tiers.forEach((t, i) => t.s.sil.classList.toggle("hi", i === lifted));
    read.textContent = a < 0 ? "rest" : `tier ${a + 1}`;
    B2.wake();
  }

  /** x sets the gap's target; y picks the tier whose target centre is nearest, on screen. */
  function aim(p) {
    if (!p) { gap.t = GR; choose(-1); return; }
    gap.t = lerp(G0, gMax, clamp((p[0] - 70) / 260, 0, 1));
    const z = bases(gap.t, lifts.map(() => 0));
    let best = 0, bd = Infinity;
    z.forEach((zi, i) => { const d = Math.abs(P(0, 0, zi + T / 2)[1] - p[1]); if (d < bd) { bd = d; best = i; } });
    choose(best);
  }

  choose(-1);
  bag.add(pointer(stage, { move: aim, leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { gMax = v; B2.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "strata",
  means: "Five tiers of capital, stacked and held apart: the pointer opens the stack and lifts the tier it is over.",
  rules: [1, 5, 6, 8],
  range: [12, 17, 22],
  tour: [[140, 230], [270, 110], [230, 170], null],
  mount,
});
