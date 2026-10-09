# Hairline graphics

Hairline figures of my own, drawn in the style and on the engine of
[`@lucasmarkes/hairline`](https://www.npmjs.com/package/@lucasmarkes/hairline).
Each one is a custom element, so it works in Framer or any web page with no
install and no copy of React of its own.

| Figure | Element | What it does |
| --- | --- | --- |
| Rack | `<hairline-rack>` | A wine rack, bottles lying necks-out: the one under the pointer slides out, and its neighbours follow a little, in turn. |

## Use it in Framer

Make a new code file (Assets → Code → New code file), replace everything in it
with this, and drop the component on the canvas:

```tsx
import "https://cdn.jsdelivr.net/gh/benmas23/hairline-graphics@v0.1.0/dist/hairline.js"

export default function Rack() {
    // @ts-ignore: <hairline-rack> is a custom element
    return <hairline-rack style={{ width: "100%", height: "100%" }} />
}
```

Give the frame a 5:4 shape (600 × 480, say).

### With controls in Framer's panel

```tsx
import { addPropertyControls, ControlType } from "framer"
import "https://cdn.jsdelivr.net/gh/benmas23/hairline-graphics@v0.1.0/dist/hairline.js"

export default function Rack({ intensity = 0.5, play = false, theme = "auto" }) {
    return (
        // @ts-ignore: <hairline-rack> is a custom element
        <hairline-rack intensity={intensity} play={play ? "" : undefined} theme={theme} style={{ width: "100%", height: "100%" }} />
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

## Adding a figure

1. Make it with the `hairline-create` skill in `.claude/skills/` (`/hairline-create <idea>` in Claude Code), and save the figure as `figures/<name>.js`.
2. `npm install`, then `npm run check` and `npm run build`.
3. Commit, push, and tag a new version (`v0.2.0`); change the version in the Framer import to match.

`figures/<name>.js` becomes `<hairline-<name>>` in `dist/hairline.js`; the one
import gives you every figure. Open `demo.html` through a local server
(`npx serve .`) to try them.

## Versions and caching

jsDelivr caches a tag forever, and a branch (`@main`) for up to a day, so point
Framer at a tag and bump it when you change something.

## Credits

The engine in `src/kernel.js` and the skill in `.claude/skills/hairline-create`
are from [@lucasmarkes/hairline](https://github.com/lucasmarkes/hairline) by
Lucas Marques, under the MIT licence in `LICENSE-hairline`.
