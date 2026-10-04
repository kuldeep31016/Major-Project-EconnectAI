"""Synthesizes each narration line with Piper (offline neural TTS) and records its duration."""
import json, os, sys, wave
from piper import PiperVoice, SynthesisConfig
voice_name, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
import piper as _p  # noqa: F401 - espeak expects the PARENT of espeak-ng-data (packaged default path is wrong on macOS)
voice = PiperVoice.load(os.path.join(os.environ.get("VOICES", "voices"), voice_name + ".onnx"), espeak_data_dir=os.path.expanduser("~/.cache/piper/espeak-ng-data"))  # short path: espeak truncates long data paths
cfg = SynthesisConfig(length_scale=1.03, noise_scale=0.6, noise_w_scale=0.75)
lines = json.load(open("narration.json")); total = 0
for l in lines:
    p = f"{out}/{l['id']}.wav"
    with wave.open(p, "wb") as w: voice.synthesize_wav(l.get("say", l["text"]), w, syn_config=cfg)
    with wave.open(p) as w: l["dur"] = round(w.getnframes() / w.getframerate(), 3)
    total += l["dur"]
json.dump(lines, open(f"{out}/timing.json", "w"), indent=1)
print(voice_name, "speech total", round(total, 1), "s")
