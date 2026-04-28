---
description: Extract relevant frames from a video or animated image (GIF, APNG, animated WebP) so the model can view them as a timeline. Use when the user shares a video or an animated image. DO NOT use for static images — the model can already read those natively.
---

# Slides

Static images (JPG/PNG/static WebP) can be read natively. **This skill is only for video and animated images** — anything that has multiple frames across time. It uses `peepshow` (ffmpeg under the hood) to extract a sequence of relevant still frames so they can be viewed as a timeline.

## Input

The user may provide the video (or animated image — GIF, APNG, animated WebP) in any of these forms:

- A local file path (absolute, relative, or a network mount like `/Volumes/share/...`)
- An `http://` or `https://` URL
- A `data:video/...;base64,...` or `data:image/(gif|apng|webp|png);base64,...` URI pasted into the prompt
- The literal `-` to read bytes from stdin (you would pipe via `Bash`)

If `$ARGUMENTS` contains the video reference, use it directly. Otherwise ask the user to share one of the above.

## Steps

1. **Run the CLI** with the `Bash` tool. JSON is the most reliable output for parsing:

   ```
   PEEPSHOW_CLIENT=claude-code PEEPSHOW_SESSION="${CLAUDE_SESSION_ID:-}" peepshow "$ARGUMENTS" --emit json
   ```

   The `PEEPSHOW_CLIENT` + `PEEPSHOW_SESSION` env vars tag the run in the manifest and the access log so a shared `peepshow serve` instance can attribute every run + HTTP call back to the right Claude Code session. Both are optional — peepshow runs fine without them — but setting them costs nothing.

   (If the path contains spaces, quote it. Use `--emit paths` if you prefer reading the human-readable list.)

2. **Parse the output**. In JSON mode, `frames[].path` is the ordered list of absolute paths. The `video` object gives you container, codec, resolution, fps, duration, and file size — useful context for the user's question without extra prompting. The `video.tags` object carries container-level metadata embedded in the file (title, artist, album_artist, director, producer, publisher, copyright, genre, description, creation_time, show, episode_id, season_number, etc.) — use it to ground your answer in what the video *says it is* before describing what you see. The `extraction` object tells you which strategy (`scene` vs `fps`) was used, how many frames were pruned, how many were dropped by the perceptual-hash dedup pass (`framesDeduped` + `dedupDistance`), and a coarse motion signal across the kept frames (`motionSignalAvg` numeric + `motionSignalLevel` `low`/`medium`/`high`). Use the motion signal to colour your narration (e.g. "rapid action segment" vs "near-static timelapse"); combine with `framesDeduped == 0` + `motionSignalLevel == "high"` to recognise a high-information clip where the LLM should pay close attention to every frame.

3. **Read the audio transcript**, if present. When the input had an audio track, the JSON payload's `audio` object has:
   - `audio.path` — the extracted `audio.m4a` on disk.
   - `audio.durationSeconds`, `audio.codec`, `audio.peakDbfs`, `audio.silenceRatio` — audio metadata.
   - `audio.transcript` — when transcription ran (whisper.cpp or a cloud provider), this contains `text` (full concatenated transcript) and `segments[]` (each with `start` / `end` / `text` in seconds). Use the transcript to understand **what was said** in addition to what was shown. For conversational or narration-heavy videos the transcript is often more informative than the frames alone. Cross-reference segment timestamps against frame indices so you can quote who said what when.

   If `audio.path === null` the input had no audio track (GIF, APNG, animated WebP, silent video). Skip the audio step cleanly.

   If `audio.transcript === null` or `audio.transcript.skippedReason` is set, transcription didn't run — just work with the frames.

4. **Read each frame as an image** with the `Read` tool, **in order**. They are named `frame_0001.jpg`, `frame_0002.jpg`, etc. and represent the timeline from earliest to latest.

5. **Answer the user's question** using both the frames and the transcript together. Reference timestamps when helpful (derive from `video.durationSeconds`, frame ordering, and transcript `segments[].start`). A useful pattern for longer clips: summarise the visual timeline in 2-3 beats, then weave in direct quotes from the transcript to ground what was said at those moments.

6. **Annotate the report — MANDATORY.** The JSON payload from step 1 includes an `annotate` block with the exact command. Without this step the manifest stays empty and the run shows up as `no-analysis` on the /runs page. Pipe a JSON object with your `summary` and **`perFrame` covering every frame** back into peepshow:

   ```bash
   echo '{"summary":"<2-4 sentences describing the timeline>","perFrame":[{"idx":0,"text":"<frame 0 caption>"},{"idx":1,"text":"<frame 1 caption>"},{"idx":2,"text":"<frame 2 caption>"},…,{"idx":N-1,"text":"<frame N-1 caption>"}],"provider":"claude-code","model":"claude-opus-4-7"}' \
     | peepshow report annotate "$OUTPUT_DIR"
   ```

   `$OUTPUT_DIR` is the run's `outputDir` (the JSON payload's `outputDir` field — typically a `/tmp/peepshow-...` path). The annotate step rewrites `manifest.json` and `report.html` atomically; users opening the HTML now see your synthesis under the "LLM analysis" section.

   **`perFrame.length` MUST equal `frames.length`.** Every extracted frame gets its own caption — no skipping, no key-beats-only summaries. The /runs page surfaces sparse coverage as `partial-captions`; agents that ship sparse perFrame are doing it wrong. peepshow logs a warning to stderr when sparse uploads are detected (and rejects them with `--strict`).

   Run this for **every** invocation, including ones that didn't end with a question — the manifest is the durable record of what you understood. Only skip when the user explicitly asks for raw frames with no synthesis.

## Useful flags

Pass these after the input when the defaults are not right:

- `--max 20` — cap the number of frames returned (default 40)
- `--min 6` — ensure at least this many (falls back from scene detection to fps sampling)
- `--threshold 0.2` — more sensitive scene detection (default 0.3; lower = more frames)
- `--fps 0.5` — skip scene detection and sample at a fixed rate
- `--width 960` — max output width in pixels (default 1280)
- `--format png` — output PNG instead of JPG
- `--stats full` — include the full stats block (video + extraction details)
- `--stats off` — suppress stats entirely if context is tight

## Troubleshooting

- **`ffmpeg not found`**: run `npm install` inside the plugin directory once to fetch the bundled ffmpeg binary.
- **Zero frames returned**: lower `--threshold` or force `--fps 1`.
- **Too many frames**: raise `--threshold` or lower `--max`.
