"""Build the walkthrough video: HTML frames -> PNG (headless Chrome), narration -> AIFF (say), ffmpeg -> MP4 + SRT."""
import html, json, os, re, subprocess as sp, sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import scenes, narr_short, tts

FF = str(HERE.parent / "tools/venv/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1")
FR, AU, SEG = HERE / "frames", HERE / "audio", HERE / "segments"
for d in (FR, AU, SEG):
    d.mkdir(exist_ok=True)

CSS = """
*{box-sizing:border-box} body{margin:0;width:1600px;height:900px;overflow:hidden;background:#f7f7f4;color:#1c211e;
font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:21px;line-height:1.38}
.hdr{height:78px;display:flex;align-items:center;gap:18px;padding:0 44px;border-bottom:1px solid #dcdcd4;background:#fff}
.hdr .sec{font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#0f5132;font-weight:700;min-width:170px}
.hdr .ttl{font-size:29px;font-weight:650}
.main{padding:26px 44px 0 44px;height:772px;overflow:hidden}
.ftr{position:absolute;bottom:0;left:0;right:0;height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 44px;font-size:13px;color:#7a7f79;border-top:1px solid #e3e3dc;background:#fff}
h3{margin:4px 0 10px;font-size:23px;color:#0f5132} h4{margin:8px 0 6px;font-size:17px;color:#0f5132;letter-spacing:.06em}
p{margin:6px 0 12px} ul,ol{margin:4px 0 10px;padding-left:24px} li{margin:3px 0}
.compact li{margin:2px 0} .big2 li{font-size:22px;margin:7px 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:34px} .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;font-size:17px}
.three p{font-family:Menlo,monospace;font-size:13.5px;line-height:1.5;margin:0 0 8px}
.t{border-collapse:collapse;width:100%;font-size:18px;background:#fff} .t th{background:#eef2ee;text-align:left;font-size:15px;color:#33403a;text-transform:uppercase;letter-spacing:.04em}
.t td,.t th{border:1px solid #dcdcd4;padding:7px 10px;vertical-align:top} .t.small{font-size:16px} .t tr.hl td{background:#fff7d6}
.chip{display:inline-block;padding:3px 9px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:.03em;white-space:nowrap}
.chip.grey{background:#e6e6e2;color:#444} .chip.amber{background:#fdecc8;color:#8a5a00} .chip.blue{background:#dbe8fb;color:#1a4b8c} .chip.red{background:#fbdcdc;color:#9b1c1c}
.note{font-size:14px;color:#6b716c;font-family:Menlo,monospace;margin-top:12px}
.lead{font-size:23px} .muted{color:#6b716c;font-size:22px}
.warn{color:#9b1c1c;font-weight:600} .callout{background:#eaf4ee;border-left:5px solid #0f5132;padding:14px 18px;margin:10px 0;font-size:20px}
.quote{background:#fff;border:1px solid #dcdcd4;border-left:5px solid #0f5132;padding:18px 22px;font-size:20px;font-style:italic}
.quote.big{font-size:25px;line-height:1.5;font-style:normal;margin-top:18px}
pre.code{background:#15201a;color:#dff0e4;padding:16px 20px;border-radius:8px;font-family:Menlo,monospace;font-size:15px;line-height:1.5;margin:6px 0;white-space:pre}
pre.code.big{font-size:17.5px} .codehead{font-family:Menlo,monospace;font-size:16px;color:#0f5132;font-weight:700;margin-bottom:6px}
.title{display:flex;flex-direction:column;justify-content:center;height:900px;padding:0 110px;background:linear-gradient(135deg,#0f2a1d,#0f5132)}
.title *{color:#fff} .kicker{font-size:18px;letter-spacing:.16em;text-transform:uppercase;color:#9fe0bb!important}
.big{font-size:92px;margin:14px 0 6px} .sub{font-size:34px;font-weight:400;line-height:1.3}
.arch{display:flex;flex-direction:column;gap:5px} .arow{display:grid;grid-template-columns:290px 1fr 520px;align-items:center;gap:16px}
.abox{background:#0f5132;color:#fff;border-radius:6px;padding:6px 12px;font-weight:650;font-size:17px;position:relative}
.adesc{font-size:16px} .apath{font-family:Menlo,monospace;font-size:13.5px;color:#43504a}
.flow{display:flex;align-items:stretch;gap:10px} .flow .fb{flex:1;background:#fff;border:2px solid #0f5132;border-radius:8px;padding:12px;text-align:center;font-weight:600;font-size:18px}
.flow .fb small{font-weight:400;color:#56605a;font-size:14px} .flow .fa{align-self:center;font-size:30px;color:#0f5132}
.flow.v{flex-direction:column} .flow.v .fa{text-align:center}
.unet{display:flex;gap:12px;align-items:stretch;margin-top:6px} .ucol{flex:1;display:flex;flex-direction:column;gap:6px}
.ub{border-radius:8px;padding:14px 10px;text-align:center;font-weight:650;color:#fff;font-size:18px;flex:1;display:flex;flex-direction:column;justify-content:center}
.ub small{font-weight:400;font-size:13.5px;opacity:.92} .ub.in{background:#56605a}.ub.enc{background:#1a4b8c}.ub.bot{background:#3b2f7a}.ub.dec{background:#0f5132}.ub.out{background:#8a5a00}.ub.mask{background:#9b1c1c}
.ulab{font-size:13px;color:#56605a;text-align:center}
.steps{display:grid;grid-template-columns:repeat(7,1fr);gap:8px} .st{background:#fff;border:2px solid #0f5132;border-radius:8px;padding:10px;font-size:16px;text-align:center}
.st b{display:block;font-size:22px;color:#0f5132}
.svg{width:100%;height:auto} .svg .edges line{stroke:#1a4b8c;stroke-width:4} .svg .dash{stroke:#9b1c1c;stroke-width:3;stroke-dasharray:8 6}
.svg .nodes circle{fill:#bfe3cc;stroke:#0f5132;stroke-width:3} .svg circle.crit{fill:#f6b8b8;stroke:#9b1c1c} .svg circle.far{fill:#eee;stroke:#888}
.svg circle.gone{fill:none;stroke:#bbb;stroke-dasharray:5 5;stroke-width:3} .svg .lbl text{text-anchor:middle;font-weight:700;font-size:20px;fill:#0f2a1d} .svg .small{font-size:16px;fill:#9b1c1c}
.eq{font-family:'Times New Roman',serif;font-size:27px;background:#fff;border:1px solid #dcdcd4;padding:12px 16px;margin:6px 0 10px}
.col{padding:12px 14px;border-radius:8px;font-size:16px} .col.ok{background:#eaf4ee} .col.upd{background:#fff4dc} .col.no{background:#fbe6e6}
.col h4{margin-top:0}
.loop{display:grid;grid-template-columns:repeat(7,1fr);gap:10px;margin-top:40px} .lb{background:#fff;border-top:6px solid #0f5132;border-radius:6px;padding:16px 12px;font-size:17px;min-height:250px}
.lb b{font-size:20px;color:#0f5132}
.nope li{font-size:21px;margin:8px 0} .nope li::marker{content:'✗  ';color:#9b1c1c}
.imgpair{display:flex;gap:24px;justify-content:center;align-items:center;height:640px} .imgpair img{max-height:620px;max-width:48%;background:#fff;border:1px solid #ddd}
.scr{display:grid;grid-template-columns:1150px 1fr;gap:22px;padding:22px 30px 0 30px;height:772px}
.shot{width:1150px;border:1px solid #cfcfc6;box-shadow:0 4px 18px rgba(0,0,0,.12);border-radius:6px;align-self:start}
.shots2{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-content:start} .shots2 img{width:100%;border:1px solid #cfcfc6;border-radius:6px;box-shadow:0 3px 10px rgba(0,0,0,.1)}
.panel{font-size:15.5px;line-height:1.4} .panel .k{font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;color:#0f5132;font-weight:800;margin-top:12px}
.panel .v{margin-top:3px;overflow-wrap:anywhere} .panel .code{font-family:Menlo,monospace;font-size:13px;color:#33403a}
.panel .why{background:#fff4dc;border-left:4px solid #8a5a00;padding:8px 10px;margin-top:6px}
"""

def page(inner, sec, title, idx, total, bare=False):
    head = f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>'
    if bare:
        return head + inner + "</body></html>"
    return (head + f'<div class="hdr"><div class="sec">{html.escape(sec)}</div><div class="ttl">{title}</div></div>'
            f'{inner}<div class="ftr"><span>EcoConnectAI · technical walkthrough of the current repository · audited 25 Sept 2026</span>'
            f'<span>{idx}/{total}</span></div></body></html>')

def panel(d):
    return (f'<div class="panel"><div class="k">What you see</div><div class="v">{html.escape(d["see"])}</div>'
            f'<div class="k">Data powering it</div><div class="v code">{html.escape(d["data"])}</div>'
            f'<div class="k">Code</div><div class="v code">{html.escape(d["code"])}</div>'
            f'<div class="k">Why it matters / caveat</div><div class="v why">{html.escape(d["why"])}</div></div>')

def render_html(s, i, total):
    k, sec, title = s["kind"], s["section"], s["title"]
    if k == "title":
        return page(f'<div class="title">{s["body"]}</div>', sec, title, i, total, bare=True)
    if k in ("slide", "code", "image"):
        return page(f'<div class="main">{s["body"]}</div>', sec, title, i, total)
    d, shots = s["body"], scenes.SHOTS
    if k == "screen":
        left = f'<img class="shot" src="file://{shots}/{d["img"]}">'
    elif k == "screen2":
        left = f'<div class="shots2"><img src="file://{shots}/{d["img"]}"><img src="file://{shots}/{d["img2"]}"></div>'
    elif k == "screen4":
        left = '<div class="shots2">' + "".join(f'<img src="file://{shots}/{x}">' for x in d["imgs"]) + "</div>"
    return page(f'<div class="scr">{left}{panel(d)}</div>', sec, title, i, total)

def duration(f):
    out = sp.run(["afinfo", str(f)], capture_output=True, text=True).stdout
    return float(re.search(r"estimated duration: ([\d.]+)", out).group(1))

def srt_time(t):
    h, m = int(t // 3600), int(t % 3600 // 60)
    s = t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}"

def main(stage="all"):
    S = scenes.SCENES
    N = narr_short.N
    assert len(S) == len(N)
    total = len(S)
    jobs = []
    for i, s in enumerate(S):
        h = FR / f"f{i:02d}.html"
        h.write_text(render_html(s, i + 1, total))
        jobs.append({"html": str(h), "png": str(FR / f"f{i:02d}.png")})
    (FR / "jobs.json").write_text(json.dumps(jobs))
    if stage in ("all", "frames"):
        sp.run(["node", str(HERE.parent / "tools/render.js"), str(FR / "jobs.json")], check=True, cwd=HERE.parent / "tools")
    if stage == "frames":
        return
    PAD = 0.9
    segs, t0, srt, tr = [], 0.0, [], []
    for i, s in enumerate(S):
        a = AU / f"a{i:02d}.aiff"
        if not a.exists() or stage == "all":
            sp.run(["say", "-v", "Daniel", "-r", "178", "-o", str(a), tts.speechify(N[i])], check=True)
        d = duration(a)
        seg = SEG / f"s{i:02d}.mp4"
        sp.run([FF, "-y", "-loglevel", "error", "-loop", "1", "-framerate", "5", "-i", FR / f"f{i:02d}.png", "-i", a,
                "-af", f"apad=pad_dur={PAD}", "-t", f"{d + PAD:.3f}", "-c:v", "libx264", "-tune", "stillimage", "-preset", "medium",
                "-crf", "20", "-pix_fmt", "yuv420p", "-r", "5", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "1",
                "-shortest", str(seg)], check=True)
        segs.append(seg)
        # subtitles: split into sentences, time proportional to length
        sents = [x.strip() for x in re.split(r"(?<=[.!?:])\s+", N[i]) if x.strip()]
        L = sum(len(x) for x in sents)
        t = t0
        for x in sents:
            dt = d * len(x) / L
            srt.append((t, t + dt, x))
            t += dt
        tr.append((t0, s["section"], s["title"], N[i]))
        t0 += d + PAD
        print(f"scene {i:02d} {d:5.1f}s  total {t0/60:5.2f} min", flush=True)
    lst = SEG / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in segs))
    out = HERE / "EcoConnectAI_Technical_Walkthrough.mp4"
    sp.run([FF, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", out], check=True)
    (HERE / "EcoConnectAI_Technical_Walkthrough.srt").write_text(
        "\n".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{x}\n" for n, (a, b, x) in enumerate(srt, 1)))
    md = ["# EcoConnectAI — technical walkthrough: full video transcript\n",
          f"Duration {t0/60:.1f} min · {total} scenes · narration voice: macOS 'Daniel' (TTS) · audited against commit 6444dcb on 2026-09-25\n"]
    last = None
    for t, sec, title, text in tr:
        if sec != last:
            md.append(f"\n## {sec}\n")
            last = sec
        md.append(f"**[{int(t//60):02d}:{int(t%60):02d}] {re.sub('<[^>]+>', '', title)}**\n\n{text}\n")
    (HERE / "VIDEO_TRANSCRIPT.md").write_text("\n".join(md))
    print("done", out, f"{t0/60:.2f} min")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "all")
