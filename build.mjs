#!/usr/bin/env node
/**
 * Builds dist/hairline.js: one file with no imports, which registers a custom
 * element for every figure in figures/ — figures/rack.js becomes <hairline-rack>.
 *
 * Each figure file stays exactly as the hairline-create skill writes it; it is
 * wrapped in a function here so it can read HL and declare itself.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";

// figures/ holds my own figures; ported/ holds Lucas's, copied to change how they behave.
const files = ["figures", "ported"].flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".js")).map((f) => `${d}/${f}`)).sort((a, b) => a.split("/")[1].localeCompare(b.split("/")[1]));
const entry = [
  'import { define, load, mount } from "./host.js";',
  "export const figures = {};",
  ...files.map((f) => {
    const src = readFileSync(f, "utf8"), name = f.split("/")[1].slice(0, -3);
    return `figures[${JSON.stringify(name)}] = load((HL, hairline) => {\n${src}\n});`;
  }),
  "for (const f of Object.values(figures)) define(f);",
  "export { define, mount };",
].join("\n");

mkdirSync("dist", { recursive: true });
writeFileSync("src/figures.gen.js", entry);
await build({
  entryPoints: ["src/figures.gen.js"],
  outfile: "dist/hairline.js",
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2020",
  legalComments: "none",
  banner: { js: "/* hairline-graphics · figures on the engine of @lucasmarkes/hairline (MIT, Lucas Marques) */" },
});
console.log(`dist/hairline.js: ${files.map((f) => `<hairline-${f.split("/")[1].slice(0, -3)}>`).join(" ")}`);
