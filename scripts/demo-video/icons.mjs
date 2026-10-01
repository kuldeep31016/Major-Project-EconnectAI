// Extracts lucide icon nodes (MIT) into static SVG markup for the composer.
import fs from "node:fs";
const dir = process.argv[2], names = process.argv.slice(3), out = {};
for (const n of names) {
  let src = fs.readFileSync(`${dir}/${n}.mjs`, "utf8");
  for (let r; (r = /export \{ default \} from '\.\/(.+?)\.mjs'/.exec(src)) && !src.includes("__iconNode"); ) src = fs.readFileSync(`${dir}/${r[1]}.mjs`, "utf8");
  const m = /const __iconNode = (\[[\s\S]*?\]);\s*\n/.exec(src);
  const nodes = eval(m[1]);
  out[n] = nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
}
fs.writeFileSync("icons.js", "window.ICONS = " + JSON.stringify(out, null, 1) + ";\n");
console.log(Object.keys(out).join(", "));
