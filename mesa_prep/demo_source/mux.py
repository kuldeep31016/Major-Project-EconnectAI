"""Mux recorded steps (frames + narration) into the final demo MP4, SRT and plan rows."""
import json, re, subprocess as sp, glob
from pathlib import Path
H = Path(__file__).parent; OUT = H / "out"; SEG = OUT / "segs"; SEG.mkdir(exist_ok=True)
FF = str(H.parent / "tools/bin/ffmpeg")
metas = sorted(glob.glob(str(OUT / "meta_*.json")))
steps = json.loads(sp.run(["node", "-e", "const s=require('./steps.js');console.log(JSON.stringify(s.map(x=>({ch:x.ch,page:x.page,click:x.click,expect:x.expect,point:x.point,say:x.say}))))"], cwd=H, capture_output=True, text=True).stdout)
segs, t0, srt, rows = [], 0.0, [], []
def ts(t): h=int(t//3600); m=int(t%3600//60); s=t%60; return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s-int(s))*1000))%1000:03d}"
for mf in metas:
    m = json.load(open(mf)); i = m["i"]; dur = m["dur"]
    seg = SEG / f"s{i:02d}.mp4"
    sp.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", m["list"], "-i", m["audio"],
            "-vf", "fps=25,scale=1920:1080:flags=lanczos,format=yuv420p,tpad=stop_mode=clone:stop_duration=3",
            "-af", "apad", "-t", f"{dur:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "21",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "1", str(seg)], check=True)
    segs.append(seg)
    s = steps[i]; sents = [x for x in re.split(r"(?<=[.!?])\s+", s["say"]) if x.strip()]; L = sum(map(len, sents)); t = t0
    for x in sents:
        dt = m["adur"] * len(x) / L; srt.append((t, t + dt, x)); t += dt
    rows.append(dict(i=i, start=t0, end=t0 + dur, **s))
    t0 += dur
    print(f"seg {i:02d} {dur:5.1f}s total {t0/60:5.2f} min", flush=True)
lst = SEG / "list.txt"; lst.write_text("".join(f"file '{p}'\n" for p in segs))
out = H / "EcoConnectAI_Product_Demo.mp4"
sp.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(out)], check=True)
(H / "EcoConnectAI_Product_Demo.srt").write_text("\n".join(f"{n}\n{ts(a)} --> {ts(b)}\n{x}\n" for n, (a, b, x) in enumerate(srt, 1)))
json.dump(rows, open(H / "plan_rows.json", "w"), indent=1)
print("done", out, f"{t0/60:.2f} min")
