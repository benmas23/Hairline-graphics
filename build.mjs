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

const files = readdirSync("figures").filter((f) => f.endsWith(".js")).sort();
const entry = [
  'import { define, load, mount } from "./host.js";',
  "export const figures = {};",
  ...files.map((f) => {
    const src = readFileSync(`figures/${f}`, "utf8");
    return `figures[${JSON.stringify(f.slice(0, -3))}] = load((HL, hairline) => {\n${src}\n});`;
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
console.log(`dist/hairline.js: ${files.map((f) => `<hairline-${f.slice(0, -3)}>`).join(" ")}`);
