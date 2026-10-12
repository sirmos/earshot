"""Turns your voice files into text, on your own computer, so you don't have to type them.

One-time setup (PowerShell):   pip install faster-whisper
Run from the earshot-app folder:  python transcribe-audio.py

It listens to every .mp3 in public/audio and writes:
  transcripts.txt   one block per file with the text, ready to paste into src/captions.js
  transcripts.json  the same text with start and end times for every phrase (for timed captions later)
The first run downloads a speech model of about 450 MB. After that it works offline.
Check the text against your script: the model is good, not perfect, with names like Ximena or Soo-ah.
"""
import json, os, sys
from faster_whisper import WhisperModel

root = os.path.join("public", "audio")
if not os.path.isdir(root):
    sys.exit("Run this from the earshot-app folder (public/audio not found).")

model = WhisperModel("small.en", compute_type="int8")
data, lines = {}, []
files = sorted(os.path.join(d, f) for d, _, fs in os.walk(root) for f in fs if f.lower().endswith(".mp3"))
for path in files:
    key = os.path.relpath(path, "public").replace("\\", "/")
    if os.path.basename(path).startswith("chime"):
        continue
    print("Listening to", key, "...", flush=True)
    segs, _ = model.transcribe(path, beam_size=5, vad_filter=True)
    segs = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segs]
    data[key] = segs
    lines.append(key + "\n" + " ".join(s["text"] for s in segs) + "\n")

with open("transcripts.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=1, ensure_ascii=False)
with open("transcripts.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("Done. Open transcripts.txt")
