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
   peepshow "$ARGUMENTS" --emit json
   ```

   (If the path contains spaces, quote it. Use `--emit paths` if you prefer reading the human-readable list.)

2. **Parse the output**. In JSON mode, `frames[].path` is the ordered list of absolute paths. The `video` object gives you container, codec, resolution, fps, duration, and file size — useful context for the user's question without extra prompting. The `video.tags` object carries container-level metadata embedded in the file (title, artist, album_artist, director, producer, publisher, copyright, genre, description, creation_time, show, episode_id, season_number, etc.) — use it to ground your answer in what the video *says it is* before describing what you see. The `extraction` object tells you which strategy (`scene` vs `fps`) was used and how many frames were pruned.

3. **Read each frame as an image** with the `Read` tool, **in order**. They are named `frame_0001.jpg`, `frame_0002.jpg`, etc. and represent the timeline from earliest to latest.

4. **Answer the user's question** using what you saw across the frames, referencing timestamps when helpful (derive them from `video.durationSeconds` and frame ordering).

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
