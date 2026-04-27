# peepshow — video → frames

When the user shares a video or animated image file (extensions: `mp4 mov mkv webm avi flv wmv ts mts m2ts 3gp ogv gif apng`), extract still frames so you can view them as a timeline. Don't use on static `png`/`jpg`/`webp` — those are already supported natively.

## How

```bash
peepshow "<path-or-url>" --emit json
```

Parse the stdout JSON:
- `frames[]` — ordered, chronological frame paths. Read each as an image.
- `video` — container, codec, resolution, fps, duration, size, **plus `tags`** (title, director, producer, show, …). Ground your answer in the tags first.
- `extraction` — which strategy (`scene` or `fps`) was used, elapsed ms, ffmpeg source, plus `framesDeduped` + `dedupDistance` (perceptual-hash post-pass, default-on, 8×8 dHash) and `motionSignalAvg` + `motionSignalLevel` (`low`/`medium`/`high`) — useful for colouring your narration.

## Install

`npm i -g peepshow` — https://www.npmjs.com/package/peepshow. Bundled ffmpeg works out of the box; `brew install ffmpeg` / `choco install ffmpeg-full` / `sudo apt install ffmpeg` for faster hardware decoding.

## Flags

`--max 20` · `--threshold 0.2` · `--fps 1` · `--emit json|paths|markdown|caveman` · `--sink <name[:arg]>` · `--gpu auto|off|videotoolbox|cuda|qsv|vaapi|amf|d3d11va` · `--dedup on|auto|off` · `--dedup-distance 0..64` · `--adaptive on|off`.

8×8 perceptual-hash dedup is default-on; `--gpu auto` is duration+resolution aware (skips hwaccel on short or sub-1080p clips where init dominates); `--adaptive on` re-extracts denser when motion is high and there's headroom under `--max`.

## Annotate the report

Each run writes `report.html` + `manifest.json` into the run's `outputDir`. After reading the frames, pipe a JSON summary back so the report captures your understanding:

```bash
echo '{"summary":"<2-4 sentences>","provider":"cline"}' | peepshow report annotate "$OUTPUT_DIR"
```

`$OUTPUT_DIR` is the JSON payload's `outputDir`. The summary is rendered under "LLM analysis" in `report.html`.
