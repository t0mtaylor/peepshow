# peepshow-sink-matrix

<!-- gif:sink:matrix -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/matrix.gif" alt="peepshow → matrix demo" width="720">
</p>
<!-- /gif:sink:matrix -->


Post a peepshow run to a Matrix room. Each frame is uploaded to the
homeserver's media repository and then attached to the room as an
`m.image` event, preceded by a single `m.text` summary.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MATRIX_HOMESERVER`   | ✓ | — | Homeserver base URL (e.g. `https://matrix.org`). Trailing slashes stripped. |
| `MATRIX_ACCESS_TOKEN` | ✓ | — | Access token for the posting user. |
| `MATRIX_ROOM_ID`      | ✓ | — | Internal room id (`!abc:matrix.org`) or alias (`#room:matrix.org`). |
| `MATRIX_MAX_IMAGES`   |   | `20` | Cap on frames uploaded (Matrix clients get spammy past ~30). |

## Behaviour

1. Each frame is uploaded via `POST /_matrix/media/v3/upload` — one
   request per frame, serialised — with `Content-Type` picked from the
   file extension (`.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`,
   `.webp` → `image/webp`, else `application/octet-stream`).
2. An `m.text` summary event is sent first (plain body + HTML
   `formatted_body`) so clients show the metadata above the frames.
3. One `m.image` event is sent per uploaded frame, with `info.mimetype`,
   `info.size`, and (when known) `info.w`/`info.h` copied from the
   video's resolution. Filenames become the event `body`.

Transaction ids are of the form `peepshow-<epoch-ms>-<ordinal>`.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Summary + image events accepted. |
| `2` | Missing required env var (`MATRIX_HOMESERVER`, `MATRIX_ACCESS_TOKEN`, `MATRIX_ROOM_ID`). |
| `4` | stdin malformed. |
| `5` | Homeserver returned non-2xx for upload or send. |

## References

- [Matrix media upload](https://spec.matrix.org/latest/client-server-api/#post_matrixmediav3upload)
- [Send event](https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3roomsroomidsendeventtypetxnid)

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

Add the sink's required env vars to your shell rc (`~/.zshrc`,
`~/.bashrc`, PowerShell profile) or a project-local `.env` that your
agent tooling loads. Example:

```sh
export MATRIX_HOMESERVER="https://example.com"
export MATRIX_ACCESS_TOKEN="…"
export MATRIX_ROOM_ID="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add matrix
# Optional: only fire for matching inputs
peepshow sinks add matrix --when extension=mp4,mov
peepshow sinks add matrix --when studio=Pixar
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code (or ask
> "what's in ~/bugs/crash.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/crash.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Matrix` sink.
>
> **`Matrix`**: uploads each frame to a Matrix homeserver and sends one `m.image` event per frame plus a summary.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream record.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director / studio
  / title etc).
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence
  ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`,
  language — populated when transcription is enabled (v0.4.0+).
- `extraction` — strategy, thresholds, ffmpeg path used.

> **Transcript handling**: the transcript snippet is posted alongside the frames as a secondary message in the thread.
