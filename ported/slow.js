/**
 * Slow, from @lucasmarkes/hairline 0.5.0 (src/figures/slow.ts, MIT, Lucas
 * Marques), ported to plain JavaScript on the same engine. One change: the belt
 * runs only while the figure plays. Played, it is Lucas's figure as it ships.
 * Not played, it rests as his does under reduced motion: the belt stands still
 * until hovered, and then creeps at the slider's rate.
 *
 * Crates ride a belt through a gate, growing in at one end and out at the
 * other, each lid carrying its serial as a 3 × 3 dot code. Hovering never stops
 * the world: it springs the clock's rate down to the slider's value. The crate
 * nearest the pointer lifts and its serial goes to the read-out. The gate's two
 * posts and lintel are depth-sorted with the crates, and brighten as a crate
 * passes under them.
 */
const {
  Cam, fit, proj, unproj, facing, rings, prism, clamp, r2, seg,
  spring, stepS, reducedMotion, mk, solid, put, flatDot, place, register, pointer, disposer,
} = HL;

const L = 210, BW = 26, BT = 5, CUBE = 15, NC = 6, SPEED = 1 / 9, GATE = L * 0.62, GH = 38;

/** How big a crate is at belt position u (0..1): smoothstep in over the first 8%, out over the last. */
const size = (u) => { const a = clamp(Math.min(u, 1 - u) / 0.08, 0, 1); return a * a * (3 - 2 * a); };

/** How lit the gate is by a crate at x: a cos² swell, full under the lintel, read off the belt so it slows with the clock. */
const RISE = L / NC / 2, FALL = RISE / 2;
const glow = (x) => {
  const d = x - GATE, w = d < 0 ? RISE : FALL;
  return Math.abs(d) >= w ? 0 : Math.cos((Math.PI / 2) * (Math.abs(d) / w)) ** 2;
};

function mount({ stage, svg, read, playing }, value) {
  const bag = disposer();
  let slow = value, over = null, clock = 2.4, running = playing !== false;
  const rate = spring(running ? 1 : 0, { eps: 0.002 });
  const C = Cam(45, 0.5, 1.8);
  fit(C, [[0, 0, 0], [L, BW, 0], [L, 0, 0], [0, BW, 0], [0, 0, GH], [GATE, -8, GH]], 200, 168);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const [bR, bI] = rings(0, 0, L, BW, 5, 1.3);
  put(solid(g), prism(P, front, bR, bI, 0, BT));
  const slats = mk("path", { class: "nf lo" }, g);
  // crates and the gate share one layer, re-sorted by depth (x + y at 45°) every frame
  const layer = mk("g", {}, g);
  const pool = [];
  for (let j = 0; j < NC; j++) {
    const el = { ...solid(layer), dots: [] };
    for (let k = 0; k < 9; k++) el.dots.push(flatDot(el.g, C, 1, "dot off"));
    pool.push(el);
  }
  // the lintel's key is past both posts and every crate under it, so it paints last among its neighbours
  const gate = [[-8, -3, 0, GH - 4, GATE - 5.5], [BW + 3, BW + 8, 0, GH - 4, GATE + BW + 5.5], [-8, BW + 8, GH - 4, GH, GATE + BW + 8.5]]
    .map(([y0, y1, z0, z1, key]) => {
      const el = solid(layer), [rg, ig] = rings(GATE - 1.6, y0, GATE + 1.6, y1, 1.4, 0.6);
      put(el, prism(P, front, rg, ig, z0, z1));
      // the glow is driven every frame from the belt; the stroke's CSS transition would only lag it
      el.sil.style.transition = "none";
      return { el, key };
    });
  const lifts = Array.from({ length: NC }, () => spring(0, { eps: 0.03 }));
  let hot = -1, order = "", gatePct = 0;

  const B = register(stage, (dt) => {
    let m = stepS(rate, dt);
    const base = running && !reducedMotion() ? 1 : 0;
    if (!over) rate.t = base;
    clock += dt * rate.x;
    const items = [];
    for (let j = 0; j < NC; j++) {
      const q = j / NC + clock * SPEED, u = q - Math.floor(q), lap = Math.floor(q);
      items.push({ j, x: u * L, s: size(u), serial: 141 + lap * NC + j });
    }
    // nearest crate to the pointer, on the belt plane
    let want = -1;
    if (over) {
      let best = 34;
      for (const it of items) if (it.s > 0.6 && Math.abs(it.x - over[0]) < best) { best = Math.abs(it.x - over[0]); want = it.j; }
    }
    hot = want;
    lifts.forEach((sp, j) => { sp.t = j === hot ? 11 : 0; if (stepS(sp, dt)) m = true; });
    items.sort((a, b) => a.x - b.x);
    let gateGlow = 0, hotSerial = 0;
    // stable ids, so the layer is only re-appended when the order actually changes
    const draw = gate.map((p, i) => ({ id: "g" + i, key: p.key, g: p.el.g }));
    items.forEach((it, k) => {
      const el = pool[k], sz = CUBE * it.s, x0 = it.x - sz / 2, x1 = it.x + sz / 2, y0 = BW / 2 - sz / 2, y1 = BW / 2 + sz / 2;
      const z0 = BT + lifts[it.j].x, z1 = z0 + sz;
      draw.push({ id: k, key: it.x + BW / 2, g: el.g });
      if (sz < 0.3) { el.g.setAttribute("visibility", "hidden"); return; }
      el.g.removeAttribute("visibility");
      const [rg, ig] = rings(x0, y0, x1, y1, 2.6 * it.s, 0.9 * it.s);
      put(el, prism(P, front, rg, ig, z0, z1));
      const isHot = it.j === hot;
      el.sil.classList.toggle("hi", isHot);
      // the serial, as a 3 × 3 code on the lid (bit 0 top-left)
      const pitch = sz * 0.2, rr = r2(0.55 * it.s * C.S);
      el.dots.forEach((d, b) => {
        place(d, P(it.x + ((b % 3) - 1) * pitch, BW / 2 + (Math.floor(b / 3) - 1) * pitch, z1));
        d.setAttribute("rx", String(rr)); d.setAttribute("ry", String(r2(rr * C.k)));
        d.setAttribute("class", (it.serial >> b) & 1 ? (isHot ? "dot" : "dot m") : "dot off");
      });
      if (isHot) hotSerial = it.serial;
      gateGlow = Math.max(gateGlow, glow(it.x) * it.s);
    });
    draw.sort((a, b) => a.key - b.key);
    const sig = draw.map((d) => d.id).join();
    if (sig !== order) { order = sig; draw.forEach((d) => layer.appendChild(d.g)); }
    // the edge colour mixed toward the lit one; written only when the percent changes
    const pct = Math.round(gateGlow * 100);
    if (pct !== gatePct) {
      gatePct = pct;
      const stroke = pct ? `color-mix(in srgb, var(--hl-hi) ${pct}%, var(--hl-edge))` : "";
      gate.forEach((p) => { p.el.sil.style.stroke = stroke; });
    }
    const off = (((clock * SPEED * L) % 21) + 21) % 21, sl = [];
    for (let x = off; x < L; x += 21) if (x > 5 && x < L - 5) sl.push(seg(P(x, 4, BT), P(x, BW - 4, BT)));
    slats.setAttribute("d", sl.join(""));
    read.textContent = `rate ${rate.x.toFixed(2)}×` + (hot >= 0 ? ` · #${String(hotSerial).padStart(4, "0")}` : "");
    // At rest with the belt stopped the frame would repeat itself: sleep until input or a change wakes it.
    if (!over && rate.x === 0 && rate.t === 0) return m;
    return true;
  });
  bag.add(B.unregister);
  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], BT); rate.t = slow; B.wake(); },
    leave: () => { over = null; B.wake(); },
  }));
  bag.add(() => svg.replaceChildren());
  return {
    set: (v) => { slow = v; if (over) rate.t = v; B.wake(); },
    play: (on) => { running = on; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "slow",
  means: "Crates riding a belt through a gate. Hovering slows the clock without stopping it.",
  rules: [7, 8],
  range: [0.6, 0.2, 0.05],
  tour: null,
  mount,
});
