"""Server-side PDF rendering of an official report (Phase 8).

Input is the stored report JSON (insight.official_report) plus live context read from the run and the database:
the provenance lineage, the network geometry for a map figure and the restoration decisions. Every number comes
from those stored objects; the renderer only lays them out. Core PDF fonts are Latin-1, so text is transliterated
(τ -> tau, − -> -, ...) rather than bundling a font.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fpdf import FPDF
from fpdf.fonts import FontFace

GREEN, DARK, MUTED, AMBER, RED = (21, 128, 61), (15, 23, 42), (100, 116, 139), (180, 83, 9), (185, 28, 28)
_MAP = {"—": "-", "–": "-", "−": "-", "→": "->", "←": "<-", "τ": "tau", "Δ": "d", "≥": ">=", "≤": "<=", "·": "|", "×": "x",
        "≈": "~", "±": "+/-", "₀": "0", "ᵢ": "i", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "²": "2", "κ": "kappa",
        "ρ": "rho", "α": "alpha", "√": "sqrt", "∈": "in", "•": "-", "✓": "ok", "°": " deg", "µ": "u"}


def latin(text: object) -> str:
    s = "" if text is None else str(text)
    for k, v in _MAP.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


class ReportPDF(FPDF):
    def __init__(self, title: str, status_line: str, footer_line: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.title_text, self.status_line, self.footer_line = latin(title), latin(status_line), latin(footer_line)
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(16, 16, 16)
        self.alias_nb_pages()

    def header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*GREEN)
        self.cell(0, 5, "EcoConnectAI", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*AMBER)
        self.cell(0, 4, self.status_line, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(226, 232, 240)
        self.line(16, self.get_y() + 1, 194, self.get_y() + 1)
        self.ln(4)

    def footer(self):
        self.set_y(-13)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*MUTED)
        self.cell(0, 4, f"{self.footer_line}   |   page {self.page_no()}/{{nb}}", align="C")

    # ---- building blocks
    def h1(self, text: str):
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*DARK)
        self.multi_cell(0, 7, latin(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def h2(self, text: str):
        if self.get_y() > 250:
            self.add_page()
        self.ln(2)
        self.set_font("Helvetica", "B", 11.5)
        self.set_text_color(*GREEN)
        self.multi_cell(0, 6, latin(text), new_x="LMARGIN", new_y="NEXT")

    def para(self, text: str, color=DARK, size=9.5, style=""):
        self.set_font("Helvetica", style, size)
        self.set_text_color(*color)
        self.multi_cell(0, 4.6, latin(text), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def bullets(self, items: list[str]):
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(*DARK)
        for b in items:
            self.set_x(20)
            self.multi_cell(0, 4.6, latin(f"- {b}"), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def banner(self, text: str, color=AMBER):
        self.set_fill_color(*[min(255, c + (255 - c) * 0.85) for c in color])
        self.set_draw_color(*color)
        self.set_text_color(*color)
        self.set_font("Helvetica", "B", 9.5)
        self.multi_cell(0, 5.5, latin(text), border=1, fill=True, new_x="LMARGIN", new_y="NEXT", padding=2)
        self.ln(2)

    def table(self, columns: list[str], rows: list[list], max_rows: int = 30, col_widths: Optional[tuple] = None):
        rows = rows[:max_rows]
        self.set_font("Helvetica", "", 7.8)
        self.set_text_color(*DARK)
        self.set_draw_color(226, 232, 240)
        self.set_fill_color(255, 255, 255)
        heading = FontFace(emphasis="BOLD", color=GREEN, fill_color=(240, 253, 244))
        with super().table(width=178, col_widths=col_widths, text_align="LEFT", line_height=4.2, borders_layout="HORIZONTAL_LINES",
                           headings_style=heading, first_row_as_headings=True,
                           cell_fill_color=(248, 250, 252), cell_fill_mode="ROWS") as t:
            head = t.row()
            for c in columns:
                head.cell(latin(c))
            for r in rows:
                row = t.row()
                for v in r:
                    row.cell(latin(f"{v:.4g}" if isinstance(v, float) else v))
        self.ln(2)

    def network_figure(self, nodes: list[dict], edges: list[dict], focus: Optional[str], caption: str):
        """Patch centroids (circle area ~ habitat area) and graph links, equirectangular around the cluster."""
        if not nodes:
            return
        if self.get_y() > 180:
            self.add_page()
        x0, y0, w, h = 16, self.get_y() + 1, 178, 88
        lats = [n["centroid"][0] for n in nodes]; lons = [n["centroid"][1] for n in nodes]
        kx = math.cos(math.radians(sum(lats) / len(lats)))
        spanx, spany = max((max(lons) - min(lons)) * kx, 1e-6), max(max(lats) - min(lats), 1e-6)
        s = min((w - 12) / spanx, (h - 12) / spany)
        ox, oy = x0 + (w - spanx * s) / 2, y0 + (h - spany * s) / 2
        pt = {n["id"]: (ox + (n["centroid"][1] - min(lons)) * kx * s, oy + (max(lats) - n["centroid"][0]) * s) for n in nodes}
        self.set_draw_color(226, 232, 240); self.set_fill_color(248, 250, 252)
        self.rect(x0, y0, w, h, style="DF")
        self.set_draw_color(148, 163, 184); self.set_line_width(0.2)
        for e in edges:
            if e["source"] in pt and e["target"] in pt:
                self.line(*pt[e["source"]], *pt[e["target"]])
        amax = max(n["area_ha"] for n in nodes)
        for n in nodes:
            r = 0.8 + 3.2 * math.sqrt(n["area_ha"] / amax)
            is_f = n["id"] == focus
            self.set_fill_color(*(AMBER if is_f else GREEN)); self.set_draw_color(*(AMBER if is_f else GREEN))
            x, y = pt[n["id"]]
            self.ellipse(x - r, y - r, 2 * r, 2 * r, style="F")
            if is_f:
                self.set_font("Helvetica", "B", 7); self.set_text_color(*AMBER)
                self.text(x + r + 1, y - r, latin(n["id"]))
        self.set_line_width(0.2)
        self.set_y(y0 + h + 1)
        self.para(caption, color=MUTED, size=7.8)


def render_official_pdf(rep: dict, *, lineage: Optional[dict], run_dir: Path, reviews: list[dict], generated_by: str,
                        report_id: str) -> bytes:
    prov = rep.get("provenance") or {}
    is_final = rep.get("status") == "final"
    status = ("FINAL REPORT" if is_final else "DRAFT - DEVELOPMENT RESULT") + " | NOT FIELD VALIDATED | scenarios are simulations"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    pdf = ReportPDF(rep.get("title", "EcoConnectAI report"), status, f"report {report_id} | generated {now} by {generated_by}")
    pdf.add_page()
    pdf.h1(rep.get("title", "EcoConnectAI report"))
    pdf.para(f"{rep.get('region') or ''}  |  {rep.get('organisation') or ''}  |  {rep.get('author') or ''}", color=MUTED, size=8.5)
    pdf.banner("Not field validated. Habitat maps are model outputs scored against Global Mangrove Watch reference labels, "
               "not field surveys; what-if and restoration results are simulations, not forecasts. "
               + ("" if is_final else "This run uses a development model, so the report is a DRAFT."))
    if rep.get("abstract"):
        pdf.h2("Summary")
        pdf.para(rep["abstract"])

    graph = json.loads((run_dir / "graph.json").read_text()) if (run_dir / "graph.json").exists() else {}
    crit = json.loads((run_dir / "criticality.json").read_text()) if (run_dir / "criticality.json").exists() else []
    focus = None
    cuts = [r for r in crit if r.get("is_cut_vertex")]
    if cuts:
        focus = max(cuts, key=lambda r: r["rank_by_area"] - r["rank"])["patch_id"]
    pdf.network_figure(graph.get("nodes", []), graph.get("edges", []), focus,
                       f"Figure 1. Modelled habitat network: {len(graph.get('nodes', []))} patches (circle size ~ area), "
                       f"{len(graph.get('edges', []))} links. Highlighted: {focus or '-'} (cut vertex with the largest gap "
                       "between criticality rank and size rank).")

    for sec in rep.get("sections", []):
        pdf.h2(sec.get("heading", ""))
        for b in sec.get("body") or []:
            pdf.para(b)
        if sec.get("bullets"):
            pdf.bullets(sec["bullets"])
        t = sec.get("table")
        if t and t.get("rows"):
            pdf.table(t["columns"], t["rows"])

    pdf.h2("Restoration decisions (human workflow)")
    if reviews:
        pdf.table(["Candidate", "Stage", "Model gain (sim.)", "Decision", "Reason", "Not assessed"],
                  [[r["candidate_id"], r["stage"], f"+{(r.get('model_recommendation') or {}).get('gain_pct', 0):.2f} %",
                    r.get("decision") or "-", (r.get("decision_reason") or "-")[:60], ", ".join(r.get("not_assessed") or []) or "-"]
                   for r in reviews])
    else:
        pdf.para("No restoration candidate from this run has entered the review workflow. Model rankings are recommendations only.", color=MUTED)

    pdf.h2("Provenance")
    pdf.para(f"Run {prov.get('runId', '-')} | {prov.get('resultLabel', '-')} | {prov.get('note', '')}", color=MUTED, size=8)
    if lineage:
        def val(v):
            return f"{v:.4g}" if isinstance(v, float) else str(v)
        rows = []
        for st in lineage["steps"]:
            d = st["detail"]
            parts = [f"{k}={val(v)}" for k, v in d.items() if v not in (None, "", [], {}) and not isinstance(v, (dict, list))]
            key = ""
            for part in parts:                       # whole key=value pairs only, never cut mid-word
                if len(key) + len(part) > 150:
                    key += " ..."
                    break
                key = f"{key}, {part}" if key else part
            h = ", ".join(f"{a['kind']}:{(a['sha256'] or '')[:12]}" for a in st["artifacts"][:3])
            rows.append([st["title"], st["status"], key or "-", h or "-"])
        pdf.table(["Step", "Status", "Recorded values", "Artefact hashes (sha256, first 12)"], rows, max_rows=20,
                  col_widths=(30, 17, 88, 43))
    return bytes(pdf.output())
