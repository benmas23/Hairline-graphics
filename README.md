# Hairline graphics

Hairline figures of my own, drawn in the style and on the engine of
[`@lucasmarkes/hairline`](https://www.npmjs.com/package/@lucasmarkes/hairline).
Each one is a custom element, so it works in Framer or any web page with no
install and no copy of React of its own.

| Figure | Element | What it does |
| --- | --- | --- |
| Contours | `<hairline-contours>` | A layered contour model: the land swells up around the pointer, and the contours re-form round it. |
| Levelling | `<hairline-levelling>` | A layered contour model with a site graded into it: the land under the pointer is levelled into a flat pad, ready to build on. |
| Rack | `<hairline-rack>` | A wine rack, bottles lying necks-out: the one under the pointer slides out, and its neighbours follow a little, in turn. |
| Bricks | `<hairline-bricks>` | A tower of toy bricks, built as high as the pointer: the bricks up to it are placed, and the next one hovers over its spot. |
| Slow | `<hairline-slow>` | Lucas's Slow, with one change: the belt runs only while `play` is on. Off, it stands still until hovered. |

## Use it in Framer

Make a new code file (Assets → Code → New code file), replace everything in it
with this, and drop the component on the canvas:

```tsx
import "https://cdn.jsdelivr.net/gh/benmas23/hairline-graphics@v0.2.0/dist/hairline.js"

export default function Rack() {
    return (
        <div style={{ position: "relative", aspectRatio: "5 / 4" }}>
            {/* @ts-ignore: <hairline-rack> is a custom element */}
            <hairline-rack style={{ position: "absolute", inset: 0 }} />
        </div>
    )
}
```

The outer `<div>` is the same box `@lucasmarkes/hairline/react` renders (as
wide as its parent, 5:4), so with the height set to fit, the rack lines up with
Lucas's figures, even before the script has loaded.

### With controls in Framer's panel

```tsx
import { addPropertyControls, ControlType } from "framer"
import "https://cdn.jsdelivr.net/gh/benmas23/hairline-graphics@v0.2.0/dist/hairline.js"

export default function Rack({ intensity = 0.5, play = false, theme = "auto" }) {
    return (
        <div style={{ position: "relative", aspectRatio: "5 / 4" }}>
            {/* @ts-ignore: <hairline-rack> is a custom element */}
            <hairline-rack intensity={intensity} play={play ? "" : undefined} theme={theme} style={{ position: "absolute", inset: 0 }} />
        </div>
    )
}

addPropertyControls(Rack, {
    intensity: { type: ControlType.Number, min: 0, max: 1, step: 0.05, defaultValue: 0.5 },
    play: { type: ControlType.Boolean, defaultValue: false },
    theme: { type: ControlType.Enum, options: ["auto", "light", "dark"], defaultValue: "auto" },
})
```

## Options

Attributes on the element:

- `intensity="0.5"`: how strongly it answers the pointer, 0 to 1. For the rack, how far the bottle comes out.
- `play`: walks the figure through its answer on its own until the pointer arrives.
- `theme="auto | light | dark"`: `auto` follows the page (a `dark` class or `data-theme="dark"` on an ancestor, then `color-scheme`).
- `label="…"`: the accessible name.

Colours are CSS variables, so a style can change them: `--hairline-plate` (the
fill of the solids, which should match your background), `--hairline-hi`,
`--hairline-edge`, `--hairline-mid`, `--hairline-lo` and `--hairline-stroke`
(the line width, default 0.9).

The element fires a `read` event whose `detail` is the caption under the
pointer (`row 2·4`, `rest`).

## Lucas's figures, changed

`ported/` holds figures copied from `@lucasmarkes/hairline` to change how they
behave; the rest of his figures are best used from his package as they are.

- `ported/slow.js`: his Slow belt moves all the time, and `play` only walks its
  tour. Here the belt runs only while the figure plays; not played, it rests as
  his does under reduced motion.

A figure that moves on its own can return `play(on)` from `mount` and read
`playing` from the object `mount` is given; the host calls it when `play`
changes.

## Adding a figure

1. Make it with the `hairline-create` skill in `.claude/skills/` (`/hairline-create <idea>` in Claude Code), and save the figure as `figures/<name>.js`.
2. `npm install`, then `npm run check` and `npm run build`.
3. Commit, push, and tag a new version on GitHub (Releases → Draft a new release, `v0.3.0`); change the version in the Framer import to match.

`figures/<name>.js` becomes `<hairline-<name>>` in `dist/hairline.js`; the one
import gives you every figure. Open `demo.html` through a local server
(`npx serve .`) to try them.

## Versions and caching

jsDelivr caches a tag forever, and a branch (`@main`) for up to a day, so point
Framer at a tag and bump it when you change something. A full commit hash
(`@<40-character sha>`) works the same way as a tag, if you'd rather not make a
release.

## Credits

The engine in `src/kernel.js` and the skill in `.claude/skills/hairline-create`
are from [@lucasmarkes/hairline](https://github.com/lucasmarkes/hairline) by
Lucas Marques, under the MIT licence in `LICENSE-hairline`.
