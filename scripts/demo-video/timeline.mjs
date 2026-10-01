// Builds the video timeline from the narration durations: every scene starts when its narration starts.
import fs from "node:fs";
const lines = JSON.parse(fs.readFileSync("vo/timing.json", "utf8"));
const LEAD = 1.6, GAP = 0.5, SCENE_BREATH = 0.9, EXTRA = { brand: 1.0, close: 0.6 }, TAIL = 3.4;
let t = LEAD, prev = null;
for (const l of lines) {
  if (prev && l.scene !== prev) t += (prev.startsWith("how") && l.scene.startsWith("how") ? 0.35 : SCENE_BREATH) + (EXTRA[l.scene] || 0);
  l.start = +t.toFixed(3); t += l.dur + GAP; prev = l.scene;
}
const order = [...new Set(lines.map((l) => l.scene))], scenes = {};
order.forEach((s, i) => {
  const first = lines.find((l) => l.scene === s);
  scenes[s] = { a: i === 0 ? 0 : +(first.start - 0.9).toFixed(3) };
});
const total = +(lines.at(-1).start + lines.at(-1).dur + TAIL).toFixed(3);
order.forEach((s, i) => (scenes[s].b = i + 1 < order.length ? +(scenes[order[i + 1]].a + 0.9).toFixed(3) : total));
const TL = { total, scenes, lines: lines.map(({ id, scene, text, start, dur }) => ({ id, scene, text, start, dur })) };
fs.writeFileSync("timeline.js", "window.TL = " + JSON.stringify(TL, null, 1) + ";\n");
// WebVTT captions: long lines split at sentence/comma boundaries, time shared by character count
const vtt = ["WEBVTT", ""], fmt = (s) => new Date(s * 1000).toISOString().slice(11, 23);
for (const l of TL.lines) {
  const parts = l.text.match(/[^.?!:]+[.?!:]?/g).map((p) => p.trim()).filter(Boolean).flatMap((p) => p.length > 90 ? p.split(/(?<=,)\s+/) : [p]);
  const n = parts.reduce((a, p) => a + p.length, 0); let s = l.start;
  for (const p of parts) { const d = l.dur * p.length / n; vtt.push(`${fmt(s)} --> ${fmt(s + d)}`, p, ""); s += d; }
}
fs.writeFileSync("captions.vtt", vtt.join("\n"));
console.log("total", total, JSON.stringify(scenes));
