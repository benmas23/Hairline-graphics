/**
 * Groundwork: an empty, gridded site plate; its edge is the rest mark.
 * Bring the pointer onto the plate and the campus builds: the wind turbine, the walled
 * substation yard with its transformers, poles and lines, the power block and
 * stacks, and two data halls, each rising after a delay set by its distance
 * from where the pointer came in. The part nearest the pointer takes the
 * bright edge. Leaving sinks the campus the same way, and the site is empty
 * again. The slider is the stagger, in ms per 20 world units.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, rrect, circ, ringAt, run, hull, poly, open, seg, fillet, rad,
  unproj, tween, tset, tval, tdone, mk, pointer, put, register, disposer, solid,
} = HL;

const EXT = 150, PB = 8, UNIT = 20;
const ss = (a, b, p) => { const t = clamp((p - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const disc = (cx, cy, r) => circ(r, 32).map((s) => ({ ...s, u: s.u + cx, v: s.v + cy }));
const pair = (cx, cy, r) => [disc(cx, cy, r), disc(cx, cy, r * 0.6)];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.42);
  // Centred on the empty plate (the rest pose); the built campus still fits above it.
  fit(C, [[-8, -8, -PB], [EXT + 8, EXT + 8, -PB], [EXT + 8, -8, -PB], [-8, EXT + 8, -PB], [-8, -8, 0]], 200, 166);
  const P = proj(C), front = facing(C);
  let step = value, over = null;

  const g = mk("g", {}, svg);
  const plate = solid(g);
  put(plate, prism(P, front, ...rings(-8, -8, EXT + 8, EXT + 8, 5, 2.5), -PB, 0));
  // Six even cells edge to edge; lines stop at the crease so they never run onto the rim.
  const G0 = -8, GW = (EXT + 16) / 6, IN0 = -5.5, IN1 = EXT + 5.5;
  for (let i = 1; i < 6; i++) {
    const c = G0 + i * GW;
    mk("path", { class: "lo nf", d: seg(P(c, IN0, 0), P(c, IN1, 0)) }, g);
    mk("path", { class: "lo nf", d: seg(P(IN0, c, 0), P(IN1, c, 0)) }, g);
  }

  const path = (cls) => mk("path", cls ? { class: cls } : {}, g);
  const clear = (...els) => els.forEach((e) => (e.sil ? [e.sil, e.cr] : [e]).forEach((p) => p.setAttribute("d", "")));
  const box = (el, rp, z0, h) => (h < 0.2 ? clear(el) : put(el, prism(P, front, rp[0], rp[1], z0, z0 + h)));
  function sag(a, b, f) {
    const pts = [];
    for (let k = 0; k <= 16 * f; k++) { const t = k / 16; pts.push(P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - 24 * t * (1 - t))); }
    return pts.length > 1 ? open(pts) : "";
  }

  // The turbine: a base pad, a tapered tower, a nacelle along y, three blades in the x–z plane that spin up as they grow.
  const T = [16, 50];
  const tBase = solid(g), tower = solid(g), nac = solid(g);
  const tFoot = disc(T[0], T[1], 1.9), tTop = disc(T[0], T[1], 0.9), tIn = disc(T[0], T[1], 0.5);
  const blades = [0, 1, 2].map(() => path());
  const hubEl = mk("ellipse", { rx: 0, ry: 0 }, g);
  const turb = { name: "turbine", c: [16, 52], lit: tower, tw: tween(0), draw(t) {
    box(tBase, rings(T[0] - 3.5, T[1] - 3.5, T[0] + 3.5, T[1] + 3.5, 3.5, 1), 0, 1.5 * ss(0, 0.15, t));
    const th = 50 * ss(0.05, 0.65, t);
    if (th < 0.5) clear(tower);
    else {
      tower.sil.setAttribute("d", poly(hull(ringAt(P, tFoot, 1.5).concat(ringAt(P, tTop, 1.5 + th)))));
      tower.cr.setAttribute("d", open(ringAt(P, run(tIn, front), 1.5 + th)));
    }
    const top = 1.5 + th, nh = ss(0.55, 0.75, t);
    box(nac, rings(T[0] - 1.6, T[1] - 3, T[0] + 1.6, T[1] + 6.2, 1.2, 0.5), top - 1.3, 3.6 * nh);
    const bl = ss(0.65, 1, t), hub = [T[0], T[1] + 6.2, top + 0.5], base = 90 + 360 * bl;
    blades.forEach((el, k) => {
      if (bl < 0.02) return el.setAttribute("d", "");
      const a = rad(base + k * 120), ca = Math.cos(a), sa = Math.sin(a);
      const pt = (r, w) => P(hub[0] + r * bl * ca - w * sa, hub[1], hub[2] + r * bl * sa + w * ca);
      const pts = [pt(1.4, 1), pt(6, 1.9), pt(19, 0.4), pt(19, -0.2), pt(6, -0.8), pt(1.4, -1)];
      el.setAttribute("d", poly(fillet(pts, pts.map(() => 0.7), 2)));
    });
    const h = P(...hub), r = nh > 0.5 ? 2 : 0;
    hubEl.setAttribute("cx", h[0]); hubEl.setAttribute("cy", h[1]); hubEl.setAttribute("rx", r); hubEl.setAttribute("ry", r);
  } };

  // Power: two stacks (the big one hollow), the tall block and its low annex.
  const st1 = solid(g), st2 = solid(g), mouth = path("nf"), block = solid(g), annex = solid(g);
  const blockR = rings(66, 18, 96, 44, 1.5, 1), annexR = rings(74, 44, 106, 57, 1.5, 1);
  const power = { name: "power", c: [84, 34], lit: block, tw: tween(0), draw(t) {
    box(st1, pair(70, 10, 2.8), 0, 46 * ss(0.25, 0.9, t));
    const h2 = 60 * ss(0.35, 1, t);
    box(st2, pair(84, 8, 4.4), 0, h2);
    mouth.setAttribute("d", h2 < 0.2 ? "" : poly(ringAt(P, disc(84, 8, 3.3), h2)));
    box(block, blockR, 0, 30 * ss(0, 0.65, t));
    box(annex, annexR, 0, 10 * ss(0.15, 0.7, t));
  } };

  // Substation: a walled yard, two transformers inside, four poles on the wall, lines between them.
  const outer = rrect(10, 66, 56, 114, 1.2, 4), inner = rrect(12.5, 68.5, 53.5, 111.5, 0.6, 4);
  const yard = solid(g), opening = path(), floor = path("lo nf");
  const poleAt = [[11.2, 67.2], [54.8, 67.2], [11.2, 112.8], [54.8, 112.8]];
  const poleEls = [solid(g)];
  const tr1 = solid(g), tr2 = solid(g), lip = path("fo"), rim = path("nf"), lipIn = path("lo nf"), foot = path("sil nf");
  for (let k = 1; k < 4; k++) poleEls.push(solid(g));
  const wireEls = [path("nf"), path("nf")];
  let wallH = 0, poleH = 0, lineF = 0;
  const sub = { name: "substation", c: [33, 90], lit: yard, tw: tween(0), draw(t) {
    wallH = 6 * ss(0, 0.45, t);
    if (wallH < 0.3) clear(yard, opening, floor, lip, rim, lipIn, foot);
    else {
      yard.sil.setAttribute("d", poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, wallH)))));
      opening.setAttribute("d", poly(ringAt(P, inner, wallH)));
      floor.setAttribute("d", open(ringAt(P, run(inner, (s) => !front(s)), 0.5)));
      lip.setAttribute("d", poly(ringAt(P, run(outer, front), 0).concat(ringAt(P, run(inner, front), wallH).reverse())));
      rim.setAttribute("d", open(ringAt(P, run(outer, front), wallH)));
      lipIn.setAttribute("d", open(ringAt(P, run(inner, front), wallH)));
      foot.setAttribute("d", open(ringAt(P, run(outer, front), 0)));
    }
    box(tr1, rings(18, 75, 31, 88, 1, 0.6), 0.5, 8 * ss(0.3, 0.75, t));
    box(tr2, rings(34, 92, 48, 104, 1, 0.6), 0.5, 7 * ss(0.4, 0.85, t));
    poleH = 22 * ss(0.5, 0.95, t);
    poleAt.forEach((q, k) => box(poleEls[k], pair(q[0], q[1], 0.9), wallH, poleH));
    lineF = ss(0.75, 1, t);
    const tp = (k) => [poleAt[k][0], poleAt[k][1], wallH + poleH - 1];
    wireEls[0].setAttribute("d", lineF < 0.02 ? "" : sag(tp(2), tp(0), lineF));
    wireEls[1].setAttribute("d", lineF < 0.02 ? "" : sag(tp(0), tp(1), lineF));
  } };
  const feed = path("nf");

  const hallA = solid(g), hallB = solid(g);
  const hA = { name: "hall 1", c: [131, 85], lit: hallA, tw: tween(0), draw(t) { box(hallA, rings(114, 52, 148, 118, 1.5, 1), 0, 18 * t); } };
  const hB = { name: "hall 2", c: [75, 121], lit: hallB, tw: tween(0), draw(t) { box(hallB, rings(58, 92, 92, 150, 1.5, 1), 0, 18 * t); } };
  const units = [turb, power, sub, hA, hB];
  const lits = [plate, ...units.map((u) => u.lit)];

  function draw(now) {
    for (const u of units) u.draw(tval(u.tw, now));
    const f = Math.min(lineF, ss(0.6, 1, tval(power.tw, now)));
    feed.setAttribute("d", f < 0.02 || poleH < 1 ? "" : sag([54.8, 67.2, wallH + poleH - 1], [67, 44.5, 28.5], f));
  }
  function mark() {
    let pick = { lit: plate };
    if (over) {
      let best = Infinity;
      for (const u of [turb, ...units]) { const d = Math.hypot(u.c[0] - over[0], u.c[1] - over[1]); if (d < best) { best = d; pick = u; } }
    }
    read.textContent = over ? pick.name : "rest";
    for (const s of lits) s.sil.classList.toggle("hi", s === pick.lit);
    foot.classList.toggle("hi", pick === sub);
  }

  const B = register(stage, (dt, now) => {
    draw(now);
    return !units.every((u) => tdone(u.tw, now));
  });
  bag.add(B.unregister);

  function retarget(to, from) {
    const now = performance.now();
    for (const u of units) tset(u.tw, to, now, (Math.hypot(u.c[0] - from[0], u.c[1] - from[1]) / UNIT) * step);
  }
  const onPlate = (w) => w[0] > -8 && w[0] < EXT + 8 && w[1] > -8 && w[1] < EXT + 8;
  function leave() { if (over) { const from = over; over = null; retarget(0, from); } mark(); B.wake(); }

  bag.add(pointer(stage, {
    move: (p) => {
      const w = unproj(C, p[0], p[1], 0);
      if (!onPlate(w)) return leave();
      if (!over) retarget(1, w);
      over = w; mark(); B.wake();
    },
    leave,
  }));
  bag.add(() => svg.replaceChildren());
  draw(performance.now());
  mark();

  return {
    set: (v) => { step = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "groundwork",
  means: "An empty site plate; hover it and a turbine-powered datacenter campus rises, staggered out from the pointer.",
  rules: [1, 2, 5, 6],
  range: [25, 45, 70],
  tour: [[143, 148], [250, 145], [246, 194], null],
  mount,
});
