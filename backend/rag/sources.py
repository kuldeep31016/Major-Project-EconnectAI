"""Source loaders + parsers. Every source becomes a ``Document``: normalised text plus either a heading structure
(markdown) or a list of self-contained records (run results, glossary, FAQ) that the chunker keeps whole.

Indexed (visibility in brackets):
    README + docs/*.md [public]          docs/ASSISTANT_FAQ.md (one record per question) [public]
    research paper (LaTeX → markdown) [public]   page help + glossary from the frontend sources [public]
    study areas [public]                 each area's LATEST run - summary, network, patches, candidates, what-if [public]
    model registry rows [public]         admin uploads (md/txt/html/json/csv/pdf) [visibility chosen at upload]
NOT indexed (answered only by permission-checked structured tools): field tasks and evidence, users, audit log,
reports, refresh tokens, chat logs, raw rasters.
"""
from __future__ import annotations

import csv
import hashlib
import html
import io
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, Optional

from ecoconnect.pipeline.config import REPO_ROOT, load_study_areas
from ecoconnect.pipeline.restoration_rules import annotate

DOCS = REPO_ROOT / "docs"
FRONTEND = REPO_ROOT / "frontend"
SKIP_DOCS = {"PRODUCT_REQUIREMENTS.md", "CHAT_EVAL.md", "EVAL_RESULTS.md", "EVALUATION.md"}   # wish-list / test reports (quote test questions)
DOC_CATEGORY = {
    "ML.md": "MODEL_DOCS", "MODEL_CARD.md": "MODEL_DOCS", "TRAINING.md": "MODEL_DOCS", "INFERENCE.md": "MODEL_DOCS",
    "EXPERIMENTS.md": "MODEL_DOCS", "RESULTS_PROVENANCE.md": "MODEL_DOCS",
    "DATA.md": "DATA_DOCS", "DATASET_SETUP.md": "DATA_DOCS", "GEOSPATIAL_PIPELINE.md": "DATA_DOCS",
    "PREPROCESSING.md": "DATA_DOCS", "GEE_SETUP.md": "DATA_DOCS", "DATA_PROVENANCE.md": "DATA_DOCS",
    "FIELD_WORKFLOW.md": "SYSTEM_HELP", "TROUBLESHOOTING.md": "SYSTEM_HELP",
}


@dataclass
class Record:
    title: str
    text: str
    object_id: Optional[str] = None
    meta: dict = field(default_factory=dict)


@dataclass
class Document:
    source_key: str
    source_type: str
    title: str
    text: str = ""                          # markdown-ish text (headings '#'), page breaks as '\f'
    records: list[Record] = field(default_factory=list)
    uri: Optional[str] = None
    visibility: str = "public"
    study_area: Optional[str] = None
    run_id: Optional[str] = None
    meta: dict = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        h = hashlib.sha256()
        h.update(f"{self.source_type}|{self.title}|{self.visibility}|".encode())
        h.update(self.text.encode())
        for r in self.records:
            h.update(f"\x1e{r.title}\x1f{r.object_id}\x1f{r.text}".encode())
        return h.hexdigest()


# --------------------------------------------------------------------------- normalisation
_CTRL = re.compile(r"[\u0000-\u0008\u000b\u000e-\u001f\u200b-\u200f\ufeff]")


def normalise(text: str) -> str:
    """Remove control/zero-width characters, collapse whitespace runs, drop boilerplate lines that repeat on most
    pages (PDF running headers/footers), keep headings, tables and page breaks."""
    text = _CTRL.sub("", text.replace("\r\n", "\n").replace("\r", "\n"))
    pages = text.split("\f")
    if len(pages) >= 3:
        counts = Counter(line.strip() for p in pages for line in set(p.splitlines()) if line.strip())
        boiler = {line for line, n in counts.items() if n >= max(3, 0.6 * len(pages)) and len(line) < 120}
        pages = ["\n".join(line for line in p.splitlines() if line.strip() not in boiler) for p in pages]
        text = "\f".join(pages)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# --------------------------------------------------------------------------- parsers
class _HTMLText(HTMLParser):
    SKIP = {"script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "form"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.skip = 0
        self.row: list[str] = []
        self.cell: Optional[list[str]] = None

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif not self.skip:
            if re.fullmatch(r"h[1-4]", tag):
                self.out.append("\n\n" + "#" * int(tag[1]) + " ")
            elif tag in ("p", "div", "section", "article", "br"):
                self.out.append("\n")
            elif tag == "li":
                self.out.append("\n- ")
            elif tag == "tr":
                self.row = []
            elif tag in ("td", "th"):
                self.cell = []

    def handle_endtag(self, tag):
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif not self.skip:
            if tag in ("td", "th") and self.cell is not None:
                self.row.append(" ".join("".join(self.cell).split()))
                self.cell = None
            elif tag == "tr" and self.row:
                self.out.append("\n| " + " | ".join(self.row) + " |")
            elif re.fullmatch(r"h[1-4]", tag) or tag == "p":
                self.out.append("\n")

    def handle_data(self, data):
        if self.skip:
            return
        (self.cell if self.cell is not None else self.out).append(data)


def parse_bytes(name: str, data: bytes) -> tuple[str, list[Record]]:
    """Return (markdown text, records) for an uploaded or on-disk file. Raises ValueError for unsupported types."""
    ext = Path(name).suffix.lower()
    if ext in (".md", ".markdown", ".txt"):
        return normalise(data.decode("utf-8", errors="replace")), []
    if ext in (".html", ".htm"):
        p = _HTMLText()
        p.feed(data.decode("utf-8", errors="replace"))
        return normalise(html.unescape("".join(p.out))), []
    if ext == ".json":
        obj = json.loads(data.decode("utf-8"))
        items = obj if isinstance(obj, list) else [obj]
        recs = []
        for i, it in enumerate(items[:5000]):
            lines = [f"{k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v}" for k, v in (it.items() if isinstance(it, dict) else [("value", it)])]
            title = str((it.get("name") or it.get("title") or it.get("id")) if isinstance(it, dict) else "") or f"item {i + 1}"
            recs.append(Record(title, "\n".join(lines)))
        return "", recs
    if ext == ".csv":
        rows = list(csv.reader(io.StringIO(data.decode("utf-8", errors="replace"))))
        if not rows:
            return "", []
        head, body = rows[0], rows[1:20001]
        recs = []
        for i in range(0, len(body), 25):                         # 25 rows per record, header repeated in each
            block = body[i:i + 25]
            table = "| " + " | ".join(head) + " |\n" + "\n".join("| " + " | ".join(r) + " |" for r in block)
            recs.append(Record(f"rows {i + 1}–{i + len(block)}", table))
        return "", recs
    if ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as e:                                  # pragma: no cover - dependency is in requirements
            raise ValueError("PDF support needs the pypdf package") from e
        reader = PdfReader(io.BytesIO(data))
        return normalise("\f".join((pg.extract_text() or "") for pg in reader.pages)), []
    if ext == ".tex":
        return latex_to_markdown(data.decode("utf-8", errors="replace")), []
    raise ValueError(f"unsupported document type {ext or '(none)'}; use md, txt, html, json, csv or pdf")


def latex_to_markdown(raw: str) -> str:
    s = re.sub(r"(?<!\\)%.*", "", raw).replace("\\%", "%").replace("\\&", "&").replace("\\_", "_")
    abstract = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", s, flags=re.S)
    s = re.sub(r"\\begin\{(figure|table)\*?\}.*?\\end\{\1\*?\}", " ", s, flags=re.S)
    s = re.sub(r"\\section\*?\{([^}]*)\}", r"\n\n## \1\n", s)
    s = re.sub(r"\\subsection\*?\{([^}]*)\}", r"\n\n### \1\n", s)
    s = re.sub(r"\\subsubsection\*?\{([^}]*)\}", r"\n\n#### \1\n", s)
    s = re.sub(r"\\(cite|ref|label|eqref)\{[^}]*\}", "", s)
    s = re.sub(r"\\(begin|end)\{(equation|align|eqnarray|itemize|enumerate|center)\*?\}", " ", s)
    s = re.sub(r"\\frac\{([^{}]*)\}\{([^{}]*)\}", r"(\1)/(\2)", s)
    s = re.sub(r"\\(textbf|emph|textit|texttt|mathrm|text)\{([^}]*)\}", r"\2", s)
    s = re.sub(r"\\item\s*", "\n- ", s)
    s = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?", " ", s)
    s = s.replace("{", "").replace("}", "").replace("~", " ").replace("$", "")
    body = s.split("## ", 1)
    text = ("## Abstract\n" + latex_to_markdown_inline(abstract.group(1)) + "\n\n" if abstract else "") + ("## " + body[1] if len(body) > 1 else s)
    return normalise(text)


def latex_to_markdown_inline(s: str) -> str:
    s = re.sub(r"\\(textbf|emph|textit)\{([^}]*)\}", r"\2", s)
    return re.sub(r"\\[a-zA-Z]+\*?", " ", s).replace("{", "").replace("}", "")


# --------------------------------------------------------------------------- loaders
def _doc_files() -> Iterable[Document]:
    files = [REPO_ROOT / "README.md"] + sorted(DOCS.glob("*.md")) + sorted((DOCS / "rag").glob("*.md"))
    for f in files:
        if f.name in SKIP_DOCS or not f.exists():
            continue
        text = f.read_text(errors="ignore")
        if "**Superseded (" in text[:600]:
            continue
        rel = f.relative_to(REPO_ROOT).as_posix()
        if f.name == "ASSISTANT_FAQ.md":
            recs = []
            for block in re.split(r"\n(?=### )", text):
                m = re.match(r"### (.+?\?)\s*\n(.*)", block, flags=re.S)
                if m:
                    recs.append(Record(m.group(1).strip(), " ".join(m.group(2).split()), meta={"faq": True}))
            yield Document(f"doc:{rel}", "PROJECT_DOCS", "Project FAQ", records=recs, uri=rel, meta={"faq": True})
            continue
        title = next((ln.lstrip("# ").strip() for ln in text.splitlines() if ln.startswith("# ")), f.stem)
        cat = "RAG_DOCS" if "/rag/" in rel else DOC_CATEGORY.get(f.name, "PROJECT_DOCS")
        yield Document(f"doc:{rel}", cat, title, text=normalise(text), uri=rel)


def _paper() -> Iterable[Document]:
    tex = DOCS / "paper_source_main.tex"
    if tex.exists():
        yield Document("paper:main", "PAPER", "Research paper", text=latex_to_markdown(tex.read_text(errors="ignore")),
                       uri="docs/EcoConnectAI_IEEE_paper.pdf")


def _help() -> Iterable[Document]:
    pl = FRONTEND / "lib" / "plain-language.ts"
    if pl.exists():
        recs = [Record(f"/{page} page", txt, meta={"page": page}) for page, txt in re.findall(r'^\s*(\w+):\s*"([^"]+)",', pl.read_text(), flags=re.M)]
        yield Document("help:pages", "SYSTEM_HELP", "Page help", records=recs, uri="frontend/lib/plain-language.ts")
    term = FRONTEND / "components" / "shared" / "term.tsx"
    if term.exists():
        recs = [Record(f"Glossary: {k}", f"{k}: {t}", meta={"term": k}) for k, t in re.findall(r'^\s*"?([^":\n]+?)"?:\s*"([^"]{40,})",', term.read_text(), flags=re.M)]
        yield Document("help:glossary", "SYSTEM_HELP", "Glossary", records=recs, uri="frontend/components/shared/term.tsx")


def _study_areas(runs_dir: Path) -> Iterable[Document]:
    recs = []
    for sid, a in load_study_areas().items():
        ptr = runs_dir / sid / "LATEST"
        latest = ptr.read_text().strip() if ptr.exists() else "none"
        recs.append(Record(a.get("name", sid), f"Study area {a.get('name', sid)} (id {sid}), state {a.get('state', '—')}, protection "
                                              f"{a.get('protection', '—')}, footprint {a.get('footprint_km2', '—')} km², primary habitat "
                                              f"{a.get('primary_habitat', '—')}. Latest analysis run: {latest}.", object_id=None, meta={"study_area": sid}))
    yield Document("config:study_areas", "STUDY_AREA_DOCS", "Study areas", records=recs, uri="configs")


def _runs(runs_dir: Path) -> Iterable[Document]:
    for ptr in sorted(runs_dir.glob("*/LATEST")) if runs_dir.exists() else []:
        sid, rd = ptr.parent.name, ptr.parent / ptr.read_text().strip()
        try:
            m = json.loads((rd / "manifest.json").read_text())
            rm = json.loads((rd / "metrics.json").read_text())["research_metrics"]
            crit = json.loads((rd / "criticality.json").read_text())
            expl = {e["patch_id"]: e["text"] for e in json.loads((rd / "explanations.json").read_text())}
            rest = json.loads((rd / "restoration.json").read_text())
        except (OSError, KeyError, ValueError):
            continue
        ds, g, rid = m.get("data_source") or {}, m["config"]["graph"], m["run_id"]
        name = (m.get("study_area") or {}).get("short_name") or sid
        cuts = [r["patch_id"] for r in crit if r["is_cut_vertex"]]
        tau = json.loads((rd / "tau_sensitivity.json").read_text()).get("results", {}) if (rd / "tau_sensitivity.json").exists() else {}
        recs = [Record(f"{name} run summary",
                       f"{name} latest run {rid} ({m.get('result_label', '')}). Scene year {ds.get('scene_year')}, model "
                       f"{Path(str(ds.get('model', ''))).parent.name}, threshold {ds.get('threshold')}, minimum patch {ds.get('mmu_ha')} ha. "
                       f"{rm['n_patches']} habitat patches, {rm['habitat_area_ha']:.1f} ha mapped, {rm['n_edges']} links, {rm['n_components']} "
                       f"components. IIC {rm['iic']:.3e}; ECA {rm['eca_ha']:.0f} ha ({rm['eca_pct_of_habitat']:.1f} % of habitat). Graph: k = "
                       f"{g['k_neighbors']} nearest neighbours within τ = {g['tau_km']} km.", meta={"kind": "summary"}),
                Record(f"{name} connectivity network",
                       f"Network of run {rid}: {rm['n_patches']} patches, {rm['n_edges']} links, {rm['n_components']} components. Cut vertices "
                       f"(patches whose removal splits the network): {', '.join(cuts) or 'none'}. Top-5 by criticality: "
                       f"{', '.join(r['patch_id'] for r in crit[:5])}. Largest patch: {min(crit, key=lambda r: r['rank_by_area'])['patch_id']}. "
                       "Sensitivity to τ: " + ("; ".join(f"τ {v['tau_km']:g} km: {v['edges']} links, {v['components']} components, top-5 "
                                                        f"{', '.join(v['top5'])}, Spearman ρ vs 5 km {v['spearman_vs_reference']:.2f}" for v in tau.values()) or "not stored") + ".",
                       meta={"kind": "network"})]
        for r in crit:
            recs.append(Record(f"{r['patch_id']} criticality ({name})",
                               expl.get(r["patch_id"], "") + f" Criticality rank #{r['rank']} of {len(crit)}, area rank #{r['rank_by_area']}, degree "
                               f"{r['degree']}, components {r['component_count_before']} → {r['component_count_after']} if removed"
                               + (", cut vertex (its removal splits the network)." if r["is_cut_vertex"] else "."),
                               object_id=r["patch_id"], meta={"kind": "patch"}))
        for c in annotate(rest.get("candidates", []), rm["habitat_area_ha"]):
            unc = c["category"] == "uncertain_habitat"
            recs.append(Record(f"{c['candidate_id']} restoration candidate ({name})",
                               f"Candidate {c['candidate_id']} in run {rid}: {c['area_ha']:.1f} ha, rank #{c['rank']} by connectivity gain, "
                               + ("classed as uncertain habitat (larger than 5 ha and 10 % of mapped habitat): likely existing mangrove the model "
                                  "was unsure about; requires a field check, not a restoration site." if unc else
                                  f"restoring it would add {c['new_links']} link(s) to {', '.join(c['linked_patch_ids'])} and raise IIC by "
                                  f"{c['gain_pct']:.2f} % (simulation). Potential candidate only - requires field and legal assessment; "
                                  "ownership, legal status, water, salinity and cost are not assessed."),
                               object_id=c["candidate_id"], meta={"kind": "candidate"}))
        wi = rd / "what_if_top1.json"
        if wi.exists():
            w = json.loads(wi.read_text())
            recs.append(Record(f"{name} stored what-if", f"Stored what-if (simulation) for run {rid}: removing {', '.join(w['removed_patch_ids'])} "
                               f"lowers IIC by {w['loss_pct']:.1f} % and removes {w['habitat_area_removed_ha']:.1f} ha "
                               f"({w['habitat_area_removed_pct']:.1f} % of habitat). Scenario results are simulations, not forecasts.", meta={"kind": "what_if"}))
        yield Document(f"run:{sid}", "RUN_RESULTS", f"{name} latest run", records=recs, uri=f"outputs/runs/{sid}/{rid}",
                       study_area=sid, run_id=rid, meta={"model_id": Path(str(ds.get('model', ''))).parent.name or None})


def _models(db) -> Iterable[Document]:
    if db is None:
        return
    from ..db import Model
    recs = []
    for mdl in db.query(Model).order_by(Model.id).all():
        t = (mdl.metrics or {}).get("test") or {}
        recs.append(Record(f"Model {mdl.id}", f"Model {mdl.id}: {mdl.architecture} with {mdl.encoder} encoder, input bands {mdl.input_bands}, status "
                           f"{getattr(mdl, 'status', None) or mdl.result_label}. " + (f"Held-out test agreement with Global Mangrove Watch weak labels: IoU "
                           f"{t.get('iou', float('nan')):.3f}, F1/Dice {t.get('dice', float('nan')):.3f}. " if t else "No stored test metrics. ")
                           + "Agreement with a reference map, not field-truth accuracy. The 95.56 % accuracy often quoted is the foundation study's, not ours.",
                           object_id=None, meta={"model_id": mdl.id}))
    if recs:
        yield Document("registry:models", "MODEL_DOCS", "Model registry", records=recs, uri="models table")


def _uploads(db) -> Iterable[Document]:
    """Admin uploads are registered in rag_documents (source_type UPLOAD) and their bytes live in object storage."""
    if db is None:
        return
    from ..db import RagDocument
    from ..storage import get_storage
    st = get_storage()
    for d in db.query(RagDocument).filter(RagDocument.source_type == "UPLOAD", RagDocument.status != "DELETED").all():
        key = (d.meta or {}).get("storage_key")
        if not key or not st.exists(key):
            continue
        try:
            text, recs = parse_bytes(key, st.get_bytes(key))
        except ValueError:
            continue
        yield Document(d.source_key, "UPLOAD", d.title or key, text=text, records=recs, uri=d.uri, visibility=d.visibility or "staff",
                       meta={"storage_key": key})


def collect(db=None, runs_dir: Optional[Path] = None) -> list[Document]:
    from ..paths import RUNS_DIR
    rd = runs_dir or RUNS_DIR
    return [*_doc_files(), *_paper(), *_help(), *_study_areas(rd), *_runs(rd), *_models(db), *_uploads(db)]
