---
description: Use peepshow to extract frames from videos and animated images so you can view them as stills.
trigger: manual
---

# peepshow — video → frames

When the user shares a video or animated image file (`.mp4` `.mov` `.mkv` `.webm` `.gif` `.apng` etc.) — including drag-and-drop — extract frames so you can view them as a timeline of images.

## Invoke

```bash
peepshow "<path-or-url>" --emit json
```

Parse `frames[].path` (ordered, chronological) and read each as an image. Use `video.tags` (title/director/producer/show/etc) to ground your answer. Static images are already handled natively — skip peepshow for those.

## Install

`npm i -g peepshow` — https://www.npmjs.com/package/peepshow.

## Annotate the report

Each run writes `report.html` + `manifest.json` into the run's `outputDir`. After reading the frames, pipe a JSON summary back so the report captures your understanding:

```bash
echo '{"summary":"<2-4 sentences>","provider":"windsurf"}' | peepshow report annotate "$OUTPUT_DIR"
```

`$OUTPUT_DIR` is the JSON payload's `outputDir` field. The annotation is rendered under "LLM analysis" in `report.html`.

## Attach frames to the Windsurf workspace

`peepshow video.mp4 --sink ide` detects Windsurf and writes frames into `.windsurf/attachments/peepshow/<timestamp>/` for easy `@mention`.
