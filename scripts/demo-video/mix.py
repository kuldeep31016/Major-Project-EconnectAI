"""Mixes the narration lines at their timeline positions over a quiet ambient bed (ducked under the voice)."""
import json, re, subprocess
tl = json.loads(re.search(r"window.TL = (.*);", open("timeline.js").read(), re.S).group(1))
T = tl["total"]; args = ["ffmpeg", "-v", "error", "-y"]; f = []
for i, l in enumerate(tl["lines"]):
    args += ["-i", f"vo/{l['id']}.wav"]; ms = int(l["start"] * 1000)
    f.append(f"[{i}]aresample=48000,adelay={ms}[v{i}]")
n = len(tl["lines"])
pad = ("0.055*sin(2*PI*146.83*t)*(0.6+0.4*sin(2*PI*0.05*t))+0.042*sin(2*PI*220*t)*(0.6+0.4*sin(2*PI*0.07*t+1))"
       "+0.026*sin(2*PI*329.63*t)*(0.5+0.5*sin(2*PI*0.04*t+2))+0.018*sin(2*PI*369.99*t)*(0.5+0.5*sin(2*PI*0.09*t+3))")
args += ["-f", "lavfi", "-i", f"aevalsrc='{pad}':s=48000:d={T}", "-f", "lavfi", "-i", f"anoisesrc=c=pink:a=0.05:d={T}:r=48000"]
f.append("".join(f"[v{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,apad=whole_dur={T},highpass=f=70,"
         "acompressor=threshold=-20dB:ratio=2.5:attack=5:release=150,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000[vox]")
f.append(f"[{n}]aecho=0.8:0.6:180|360:0.35|0.2,lowpass=f=2200[pad];[{n+1}]lowpass=f=420,tremolo=f=0.11:d=0.6,volume=0.5[surf];"
         f"[pad][surf]amix=inputs=2:normalize=0,volume=9dB,afade=t=in:d=2.5,afade=t=out:st={T-4}:d=4[bed]")
f.append("[vox]asplit[vx][key];[bed][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=500[duck];"
         "[vx][duck]amix=inputs=2:normalize=0,alimiter=limit=0.89,aformat=channel_layouts=stereo[out]")
args += ["-filter_complex", ";".join(f), "-map", "[out]", "-t", str(T), "mix.wav"]
subprocess.run(args, check=True)
