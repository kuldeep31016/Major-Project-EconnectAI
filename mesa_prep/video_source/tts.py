"""Narration text -> speech-friendly text for macOS `say`."""
import re

SUBS = [
    (r"\bIoU\b", "I O U"), (r"\bI O U\b", "I O U"), (r"\bIIC\b", "I I C"), (r"\bECA\b", "E C A"), (r"\bP C\b", "P C"),
    (r"\bGMW\b", "G M W"), (r"\bUNB7\b", "U N B 7"), (r"\bUNB0\b", "U N B zero"), (r"\bE 1\b", "E 1"),
    (r"\bP(\d{2})\b", lambda m: "P " + str(int(m.group(1)))), (r"\bC(\d)\b", r"C \1"),
    (r"\bB0\b", "B zero"), (r"\bB7\b", "B 7"), (r"\bSAR\b", "sar"),
    (r"\bJ S\b", "J S"), (r"\bdot py\b", "dot pie"), (r"\bdot json\b", "dot jason"), (r"\bjson\b", "jason"),
    (r"\bsmp\b", "S M P"), (r"\bVembanad Kol\b", "Vembanaad Kole"), (r"\bBhitarkanika\b", "Bhitar-kanika"),
    (r"\bGhorbanian\b", "Ghor-banian"), (r"\bMannar\b", "Mannaar"), (r"\bSundarbans\b", "Sunder-bunns"),
    (r"\bOdisha\b", "Oh-disha"), (r"\bKerala\b", "Kay-rala"), (r"\bUTM\b", "U T M"), (r"\bSTAC\b", "stack"),
    (r"\bYAML\b", "yammel"), (r"\bAWS\b", "A W S"), (r"\bAdamW\b", "Adam W"), (r"\bpytorch\b", "pie torch"),
    (r"\bPyTorch\b", "Pie Torch"), (r"\bNetworkX\b", "Network X"), (r"\bscipy\b", "sci pie"), (r"\bpyproj\b", "pie proj"),
    (r"\brasterio\b", "raster I O"), (r"\bSQLite\b", "S Q Lite"), (r"\bSQLAlchemy\b", "S Q L Alchemy"),
    (r"\bColab\b", "Co-lab"), (r"\bZenodo\b", "Zenodo"), (r"\bLeaflet\b", "Leaflet"), (r"\bS1\b", "Sentinel 1"),
    (r"\btau\b", "taw"), (r"\bNIR\b", "near infrared"),
]

def speechify(text: str) -> str:
    t = text
    for pat, rep in SUBS:
        t = re.sub(pat, rep, t)
    return t
