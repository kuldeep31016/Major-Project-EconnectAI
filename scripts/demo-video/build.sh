#!/usr/bin/env bash
# Rebuilds the narrated "Watch Demo" story video. See docs/DEMO_VIDEO.md.
# Requires: Google Chrome, Node >= 22, ffmpeg (libx264, libvpx-vp9, libopus), cwebp, Python 3.
# Usage: start the app (make run), then: scripts/demo-video/build.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$ROOT/outputs/demo-video"; PUB="$ROOT/frontend/public"
mkdir -p "$WORK" && cd "$WORK"
cp "$HERE"/{cdp.mjs,capture.mjs,render.mjs,composer.html,narration.json,tts.py,timeline.mjs,mix.py,icons.mjs} .

# 1) offline neural voice (Piper, MIT/GPL) in its own venv — never added to the project's requirements
VOICE="${VOICE:-en_US-lessac-high}"; SPK="$(echo "$VOICE" | cut -d- -f2)"
[ -d tts ] || { python3 -m venv tts && tts/bin/pip install -q piper-tts; }
mkdir -p voices
for ext in onnx onnx.json; do [ -f "voices/$VOICE.$ext" ] || curl -sSfL -o "voices/$VOICE.$ext" \
  "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/$SPK/high/$VOICE.$ext"; done
mkdir -p "$HOME/.cache/piper" && [ -d "$HOME/.cache/piper/espeak-ng-data" ] || cp -R tts/lib/python3*/site-packages/piper/espeak-ng-data "$HOME/.cache/piper/"
rm -rf vo && VOICES=voices tts/bin/python tts.py "$VOICE" vo

# 2) timeline from narration durations (+ WebVTT captions), icons, real screens, drone clip
node timeline.mjs
node icons.mjs "$ROOT/frontend/node_modules/lucide-react/dist/esm/icons" waves shield leaf fish cloud satellite clipboard-check scan-search network flask-conical sprout map file-text message-square-text trees users microscope layers triangle-alert calendar-range coins
node capture.mjs
cp "$PUB/videos/coastal-mangrove-hero.mp4" drone.mp4

# 3) frames, audio, encode
TOTAL="$(node -e "console.log(require('fs').readFileSync('timeline.js','utf8').match(/\"total\": ([\d.]+)/)[1])")"
rm -rf frames && node render.mjs full "$TOTAL"
python3 mix.py
ffmpeg -v error -y -framerate 30 -i frames/f%05d.jpg -i mix.wav -c:v libx264 -preset slower -crf 24 -profile:v high -pix_fmt yuv420p -tune animation -x264-params keyint=60 -c:a aac -b:a 128k -movflags +faststart -shortest "$PUB/videos/ecoconnectai-demo.mp4"
ffmpeg -v error -y -framerate 30 -i frames/f%05d.jpg -i mix.wav -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -c:a libopus -b:a 96k -shortest "$PUB/videos/ecoconnectai-demo.webm"
cp captions.vtt "$PUB/videos/ecoconnectai-demo.en.vtt"
POSTER_FRAME="$(node -e "const s=require('fs').readFileSync('timeline.js','utf8');const tl=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));console.log(String(Math.round((tl.scenes.brand.a+3.4)*30)).padStart(5,'0'))")"
cwebp -quiet -q 82 -resize 1600 900 "frames/f$POSTER_FRAME.jpg" -o "$PUB/images/ecoconnectai-demo-poster.webp"
ls -la "$PUB/videos/ecoconnectai-demo."* "$PUB/images/ecoconnectai-demo-poster.webp"
