// Renders composer.html frame by frame (deterministic timeline: window.render(t)). Run from the work directory.
import { launch } from "./cdp.mjs";
import fs from "node:fs";
const [mode, ...rest] = process.argv.slice(2);
const b = await launch({ w: 1920, h: 1080, dsf: 1, port: 9334 });
await b.nav("file://" + process.cwd() + "/composer.html", 1500);
await b.eval("window.ready");
if (mode === "stills") {
  for (const t of rest.map(Number)) { await b.eval(`render(${t})`); await b.sleep(60); await b.shot(`stills/t${t}.jpg`, { format: "jpeg", quality: 85 }); }
} else {
  const fps = 30, dur = Number(rest[0] || 62.4); fs.mkdirSync("frames", { recursive: true });
  const t0 = Date.now();
  for (let f = 0; f < Math.round(dur * fps); f++) {
    await b.eval(`render(${f / fps})`);
    await b.shot(`frames/f${String(f).padStart(5, "0")}.jpg`, { format: "jpeg", quality: 93 });
    if (f % 150 === 0) console.log(f, ((Date.now() - t0) / 1000).toFixed(0) + "s");
  }
}
await b.close();
