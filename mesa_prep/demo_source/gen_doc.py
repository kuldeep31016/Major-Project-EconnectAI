import json
from pathlib import Path
H = Path(__file__).parent
rows = json.load(open(H / "plan_rows.json"))
def mmss(t): return f"{int(t//60):02d}:{int(t%60):02d}"
total = rows[-1]["end"]
L = [f"# EcoConnectAI — product demonstration: script, click plan, panel Q&A, checklist\n",
     f"Companion to `EcoConnectAI_Product_Demo.mp4` ({total/60:.1f} min, 1080p, recorded from the running app on 25 Sept 2026, Kerala / Vembanad–Kol journey). "
     "Every number below was on screen in the recording. The narration is macOS text-to-speech; in the viva, say it in your own voice.\n",
     "\n## 1. Complete demo script (exact words, with timestamps)\n"]
last = None
for r in rows:
    if r["ch"] != last:
        L.append(f"\n### {r['ch']}\n"); last = r["ch"]
    L.append(f"**[{mmss(r['start'])}–{mmss(r['end'])}]** {r['say']}\n")
L.append("\n## 2. Click-by-click screen recording plan\n")
L.append("| Time | Page | Click / action | What appears | What to say (first line) | Technical point it proves |\n|---|---|---|---|---|---|")
for r in rows:
    first = r["say"].split(". ")[0].rstrip(".") + "."
    L.append(f"| {mmss(r['start'])}–{mmss(r['end'])} | `{r['page']}` | {r['click']} | {r['expect']} | {first} | {r['point']} |")
L.append("\nThe next action is always the following row. Between rows: move the cursor slowly to the control, pause, click, let the page finish loading, then speak.\n")
L.append((H / "extra.md").read_text())
out = Path("/Users/kuldeepraj/Major-Project-EconnectAI/mesa_prep/PRODUCT_DEMO_SCRIPT.md")
out.write_text("\n".join(L))
print(out, len(rows), "rows", f"{total/60:.1f} min")
