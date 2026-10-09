/**
 * The host: mounts a figure on an element the way @lucasmarkes/hairline does,
 * and wraps it as a custom element, <hairline-NAME>, so it runs in any page or
 * framework (Framer included) without sharing a copy of React.
 *
 * A figure is a file from figures/, in the format the hairline-create skill
 * writes: it reads HL and ends with hairline({ name, means, range, tour, mount }).
 */
import HL from "./kernel.js";

/** Runs a figure's source and returns what it declared. */
export function load(source) {
  let figure = null;
  source(HL, (f) => { figure = f; });
  if (!figure) throw new Error("hairline: the figure never called hairline({ … })");
  return figure;
}

/** The figure's own number for an intensity from 0 to 1, read on its range. */
function value([lo, mid, hi], i) {
  i = Math.min(1, Math.max(0, i));
  return i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid);
}

/** Mounts a figure on el. Options: intensity (0–1), theme ("auto" | "light" | "dark"), play, label, onRead. */
export function mount(el, figure, opts = {}) {
  HL.inject(el.getRootNode());
  const had = ["data-hairline", "role", "aria-label"].filter((a) => el.hasAttribute(a));
  el.setAttribute("data-hairline", figure.name);
  if (!el.hasAttribute("role")) el.setAttribute("role", "img");
  el.setAttribute("aria-label", opts.label || el.getAttribute("aria-label") || figure.means);

  const svg = HL.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, el);
  const live = el.ownerDocument.createElement("span");
  live.setAttribute("data-hairline-live", "");
  live.setAttribute("aria-live", "polite");
  el.appendChild(live);

  let text = null, onRead = opts.onRead;
  const read = {
    get textContent() { return text; },
    set textContent(v) { text = v == null ? "" : String(v); live.textContent = text; onRead?.(text); },
  };

  let intensity = opts.intensity ?? 0.5, tour = null, handle = null;
  /* Play walks the tour; a figure that moves on its own (Slow's belt) also gets play(on), and runs only while played. */
  const setPlay = (on) => {
    if (on && !tour) tour = HL.tour(el, figure.tour || HL.LAP);
    else if (!on && tour) { tour.stop(); tour = null; }
    handle?.play?.(on);
  };
  const setTheme = (t) => (t === "light" || t === "dark" ? el.setAttribute("data-hairline-theme", t) : el.removeAttribute("data-hairline-theme"));
  setTheme(opts.theme);
  /* the tour registers before the figure, as in @lucasmarkes/hairline, so in a frame the ghost moves and then the figure answers */
  setPlay(opts.play === true);
  handle = figure.mount({ stage: el, svg, read, playing: opts.play === true }, value(figure.range, intensity));
  if (text === null) read.textContent = "rest";

  return {
    update(o) {
      if (o.intensity != null && o.intensity !== intensity) { intensity = o.intensity; handle.set(value(figure.range, intensity)); }
      if ("theme" in o) setTheme(o.theme);
      if ("play" in o) setPlay(o.play === true);
      if (o.label) el.setAttribute("aria-label", o.label);
      if ("onRead" in o) onRead = o.onRead;
    },
    destroy() {
      setPlay(false);
      handle.destroy();
      svg.remove();
      live.remove();
      el.removeAttribute("data-hairline-theme");
      for (const a of ["data-hairline", "role", "aria-label"]) if (!had.includes(a)) el.removeAttribute(a);
    },
  };
}

/**
 * Registers <hairline-NAME> for a figure. Attributes: intensity="0.5",
 * theme="auto|light|dark", play, label. It fires a "read" event with the
 * caption in event.detail. Does nothing where there is no DOM (server render).
 */
export function define(figure, tag = `hairline-${figure.name}`) {
  if (typeof window === "undefined" || !window.customElements || customElements.get(tag)) return;
  // The same box as @lucasmarkes/hairline/react's <div>: a block as wide as its
  // parent, 5:4, so a height left to fit comes out the same for every figure.
  const sheet = document.createElement("style");
  sheet.textContent = `${tag}{display:block;position:relative;aspect-ratio:5/4}`;
  document.head.appendChild(sheet);
  class HairlineElement extends HTMLElement {
    static observedAttributes = ["intensity", "theme", "play", "label"];
    connectedCallback() {
      if (!this.figure) this.figure = mount(this, figure, this.options());
    }
    disconnectedCallback() {
      this.figure?.destroy();
      this.figure = null;
    }
    attributeChangedCallback() {
      this.figure?.update(this.options());
    }
    options() {
      const i = parseFloat(this.getAttribute("intensity") ?? "");
      const play = this.getAttribute("play");
      return {
        intensity: Number.isFinite(i) ? i : 0.5,
        theme: this.getAttribute("theme") || "auto",
        play: play !== null && play !== "false",
        label: this.getAttribute("label") || undefined,
        onRead: (detail) => this.dispatchEvent(new CustomEvent("read", { detail })),
      };
    }
  }
  customElements.define(tag, HairlineElement);
}
