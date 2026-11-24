/**
 * Groundwork: an empty site plate, a bordered grid on its top; its edge is the
 * rest mark. Bring the pointer onto the plate and the campus builds: the wind
 * turbine, the substation pad with its poles and lines, the power block with
 * its annex and hollow stacks, two data halls on their lot, and a tank, each
 * rising after a delay set by its distance from where the pointer came in. The part nearest the pointer takes the
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
  fit(C, [[-8, -8, -PB], [EXT + 8, EXT + 8, -PB], [EXT + 8, -8, -PB], [-8, EXT + 8, -PB], [-8, -8, 0]], 200, 172);
  const P = proj(C), front = facing(C);
  let step = value, over = null;

  const g = mk("g", {}, svg);
  const plate = solid(g);
  put(plate, prism(P, front, ...rings(-8, -8, EXT + 8, EXT + 8, 10, 2), -PB, 0));
  // An inset border on the plate's top, and six even cells inside it.
  const B0 = -1, B1 = EXT + 1, GW = (B1 - B0) / 6;
  mk("path", { class: "lo nf", d: poly(ringAt(P, rrect(B0, B0, B1, B1, 5, 6), 0)) }, g);
  for (let i = 1; i < 6; i++) {
    const c = B0 + i * GW;
    mk("path", { class: "lo nf", d: seg(P(c, B0, 0), P(c, B1, 0)) }, g);
    mk("path", { class: "lo nf", d: seg(P(B0, c, 0), P(B1, c, 0)) }, g);
  }
  const lot = mk("path", { class: "dash nf" }, g);

  const path = (cls) => mk("path", cls ? { class: cls } : {}, g);
  const clear = (...els) => els.forEach((e) => (e.sil ? [e.sil, e.cr] : [e]).forEach((p) => p.setAttribute("d", "")));
  const box = (el, rp, z0, h) => (h < 0.2 ? clear(el) : put(el, prism(P, front, rp[0], rp[1], z0, z0 + h)));
  // A flat roof with a parapet: the box, then a dim inset outline on its top.
  const roofed = (x0, y0, x1, y1) => ({ el: solid(g), roof: path("lo nf"), rp: rings(x0, y0, x1, y1, 1.5, 1), inset: rrect(x0 + 3.5, y0 + 3.5, x1 - 3.5, y1 - 3.5, 1, 4) });
  function drawRoofed(o, h) {
    box(o.el, o.rp, 0, h);
    o.roof.setAttribute("d", h < 1 ? "" : poly(ringAt(P, o.inset, h)));
  }
  // A hollow cylinder: the solid, then its mouth.
  const hollow = (cx, cy, r) => ({ el: solid(g), mouth: path("nf"), rp: pair(cx, cy, r), m: disc(cx, cy, r * 0.72) });
  function drawHollow(o, h) {
    box(o.el, o.rp, 0, h);
    o.mouth.setAttribute("d", h < 0.3 ? "" : poly(ringAt(P, o.m, h)));
  }
  function sag(a, b, f, d = 6) {
    const pts = [];
    for (let k = 0; k <= 16 * f; k++) { const t = k / 16; pts.push(P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - 4 * d * t * (1 - t))); }
    return pts.length > 1 ? open(pts) : "";
  }

  // The turbine: a base pad, a tapered tower, a nacelle along y, three blades in the x–z plane that spin up as they grow.
  const T = [36, 30];
  const tBase = solid(g), tower = solid(g), nac = solid(g);
  const tFoot = disc(T[0], T[1], 1.9), tTop = disc(T[0], T[1], 0.9), tIn = disc(T[0], T[1], 0.5);
  const blades = [0, 1, 2].map(() => path());
  const hubEl = mk("ellipse", { rx: 0, ry: 0 }, g);
  const turb = { name: "turbine", c: [36, 32], lit: tower, tw: tween(0), draw(t) {
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

  // Substation: a thin pad, four poles at its corners, two transformers and a bushing between them, lines pole to pole.
  const pad = solid(g);
  const poleAt = [[15, 55], [47, 55], [15, 93], [47, 93]];
  const pl = poleAt.map(() => null);
  pl[0] = solid(g);
  const trA = solid(g);
  pl[1] = solid(g);
  const trB = solid(g);
  pl[2] = solid(g);
  const bush = solid(g);
  pl[3] = solid(g);
  const wires = [path("nf"), path("nf")];
  let poleH = 0, lineF = 0;
  const PADH = 1.6;
  const tp = (k) => [poleAt[k][0], poleAt[k][1], PADH + poleH - 0.8];
  const sub = { name: "substation", c: [31, 74], lit: pad, tw: tween(0), draw(t) {
    box(pad, rings(11, 51, 51, 97, 1.5, 1.2), 0, PADH * ss(0, 0.25, t));
    box(trA, rings(21, 60, 37, 71, 1, 0.6), PADH, 8 * ss(0.2, 0.65, t));
    box(trB, rings(19, 75, 32, 87, 1, 0.6), PADH, 6 * ss(0.3, 0.75, t));
    box(bush, pair(40, 80, 2.4), PADH, 12 * ss(0.35, 0.8, t));
    poleH = 26 * ss(0.4, 0.9, t);
    poleAt.forEach((q, k) => box(pl[k], pair(q[0], q[1], 0.9), PADH, poleH));
    lineF = ss(0.75, 1, t);
    wires[0].setAttribute("d", lineF < 0.02 ? "" : sag(tp(2), tp(0), lineF));
    wires[1].setAttribute("d", lineF < 0.02 ? "" : sag(tp(0), tp(1), lineF));
  } };

  // Power: the tall roofed block, a small and a big hollow stack beside it, a line in from the substation, a low annex.
  const block = roofed(84, 18, 118, 54), stS = hollow(122, 17, 3.6), stB = hollow(144, 27, 5.6);
  const feed = path("nf");
  const annex = roofed(64, 60, 104, 76);
  const power = { name: "power", c: [100, 40], lit: block.el, tw: tween(0), draw(t) {
    drawRoofed(block, 34 * ss(0, 0.65, t));
    drawHollow(stS, 44 * ss(0.25, 0.9, t));
    drawHollow(stB, 54 * ss(0.35, 1, t));
    drawRoofed(annex, 8 * ss(0.15, 0.7, t));
  } };

  const h1 = roofed(28, 98, 68, 138), h2 = roofed(88, 82, 134, 130);
  const hA = { name: "hall 1", c: [48, 118], lit: h1.el, tw: tween(0), draw(t) {
    lot.setAttribute("d", t < 0.05 ? "" : poly(ringAt(P, rrect(20, 90, 20 + 56 * ss(0, 0.5, t), 90 + 56 * ss(0, 0.5, t), 3, 4), 0)));
    drawRoofed(h1, 14 * t);
  } };
  const hB = { name: "hall 2", c: [111, 106], lit: h2.el, tw: tween(0), draw(t) { drawRoofed(h2, 14 * t); } };
  const tank = hollow(118, 142, 6.5);
  const tk = { name: "tank", c: [118, 142], lit: tank.el, tw: tween(0), draw(t) { drawHollow(tank, 8 * t); } };

  const units = [turb, sub, power, hA, hB, tk];
  const lits = [plate, ...units.map((u) => u.lit)];

  function draw(now) {
    for (const u of units) u.draw(tval(u.tw, now));
    const f = Math.min(lineF, ss(0.6, 1, tval(power.tw, now)));
    feed.setAttribute("d", f < 0.02 || poleH < 1 ? "" : sag(tp(1), [84.3, 54, 24], f, 7));
  }
  function mark() {
    let pick = { lit: plate };
    if (over) {
      let best = Infinity;
      for (const u of [turb, ...units]) { const d = Math.hypot(u.c[0] - over[0], u.c[1] - over[1]); if (d < best) { best = d; pick = u; } }
    }
    read.textContent = over ? pick.name : "rest";
    for (const s of lits) s.sil.classList.toggle("hi", s === pick.lit);
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
  tour: [[157, 144], [260, 162], [205, 201], null],
  mount,
});
