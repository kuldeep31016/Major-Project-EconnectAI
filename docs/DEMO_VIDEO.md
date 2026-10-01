# Product story video ("Watch Demo")

A narrated video (2:43) that opens from the landing hero's **Watch Demo** button. It tells the story:

1. why mangroves matter;
2. the problem (fragmentation, and maps that only show *where*);
3. what EcoConnectAI does;
4. the real product;
5. who it is for;
6. its honest status;
7. what comes next.

It is not a tutorial. Screens appear only twice, as still shots.

## Assets

| File | What |
|---|---|
| `frontend/public/videos/ecoconnectai-demo.webm` | VP9 + Opus, 1920×1080, 30 fps, 2:43 (~8.9 MB), served first |
| `frontend/public/videos/ecoconnectai-demo.mp4` | H.264 + AAC, same timeline (~17.6 MB), `faststart`, fallback |
| `frontend/public/videos/ecoconnectai-demo.en.vtt` | English captions, on by default in the player |
| `frontend/public/images/ecoconnectai-demo-poster.webp` | poster (brand frame), 1600×900 |

To replace the video, overwrite these files with the same names, then bump `VERSION` in
`frontend/components/landing/demo-video-modal.tsx`. The URLs carry `?v=VERSION`, so browsers never mix a cached old
file with the new one. If WebM fails the player falls back to MP4, retries once, and then offers "Try again".

## Voice

- **Narration:** AI-generated, offline and free, with [Piper](https://github.com/rhasspy/piper). The voice is
  `en_US-lessac-high` (another option is `en_US-ryan-high`). The modal discloses that the narration is AI-generated.
- **Changing the voice:** `VOICE=en_US-ryan-high scripts/demo-video/build.sh` rebuilds everything, with scene timing
  driven by the new durations.
- **Your own recording or a paid voice (e.g. ElevenLabs):** record one WAV per line of `narration.json`, put them in
  `outputs/demo-video/vo/<id>.wav`, then run the steps after `tts.py`.
- **Mix:** the voice is loudness-normalised to about −16 LUFS over a quiet ambient bed that ducks under speech.

## Script and scenes

The script is written in plain, everyday words (no jargon such as "ecological connectivity" or "decision support"); section names are editing labels and are never spoken.

`scripts/demo-video/narration.json` holds the script, one entry per line. Scenes start when their line starts
(`timeline.mjs`).

| Scene | Narration (summary) | Visual |
|---|---|---|
| Coast | Mangroves soften storms, hold shorelines, store carbon, shelter young fish | project's drone clip + 4 benefit chips |
| Threat | Cleared and broken into isolated pieces | **illustration**: a continuous mangrove belt fragments |
| Gap | Maps show *where*, not which pieces hold the landscape together | same illustration: mapped outline, links, "?" on the key patch |
| Brand | EcoConnectAI is built to answer that | logo |
| How it works (5 steps) | Sense (Sentinel-1 radar, through cloud) → Map (deep learning) → Connect (network, key patch) → Simulate (what-if loss) → Restore (sites that could reconnect, field check first) | animated illustration on the same coast + step list |
| Product | One command center: maps, analysis, restoration, reports, assistant with sources | **two real screens, still**: Command Center, Restoration Planner |
| Who | Forest departments, conservation teams, researchers | three cards |
| Status | Research prototype; four Indian landscapes; compared with Global Mangrove Watch; not yet field-validated | honest checklist |
| Roadmap | Field validation, year-by-year monitoring, radar + optical, cost and land-use layers | timeline, labelled "Planned work — not yet built" |
| Close | Beyond habitat maps | drone clip + logo |

## Honesty rules applied

- **No numbers.** The video states no statistics about mangroves or about the model. The benefit claims are
  qualitative and well established.
- **Labelled diagrams.** The coastline network is schematic and labelled "Illustration" on screen. It is not a
  result.
- **Real screens are real.** They are captured from the running app, stored Kerala development run, and labelled
  as such.
- **Status and roadmap stated plainly.** Status is spoken in full ("research prototype … not yet validated in the
  field"). Roadmap items are presented as planned, not built (see `docs/context/ROADMAP.md`).
- **"What-if" is a simulation.** It is shown and labelled as simulated. There are no claims about forecasting or
  animal movement.

## Rebuild

```bash
make run                      # app on :3000 / :8000 (another terminal)
scripts/demo-video/build.sh   # ~6 min on a laptop; work files in outputs/demo-video/ (git-ignored)
```

The build needs Google Chrome, Node ≥ 22, ffmpeg (libx264, libvpx-vp9, libopus), cwebp and Python 3. Piper is
installed into `outputs/demo-video/tts/`, never into the project environment.
