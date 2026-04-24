# peepshow-sink-msteams

<!-- gif:sink:msteams -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/msteams.gif" alt="peepshow → msteams demo" width="720">
</p>
<!-- /gif:sink:msteams -->


POST a peepshow run as an Adaptive Card to a Microsoft Teams Incoming
Webhook. Card renders title + subtle summary + FactSet (Strategy /
Frames / Codec / Duration / Resolution / Director / Studio). If
`MSTEAMS_IMAGE_BASE` is set, the first N frames (up to `MSTEAMS_MAX_IMAGES`)
are embedded as images; otherwise a TextBlock lists the frame paths.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MSTEAMS_WEBHOOK_URL` | ✓ | — | Incoming-webhook URL (classic or Workflows). |
| `MSTEAMS_IMAGE_BASE`  |   | — | URL prefix — Teams fetches images from `<base>/<frame-basename>`. Leave unset if frames aren't served publicly. |
| `MSTEAMS_MAX_IMAGES`  |   | `8` | Max image blocks in the card. |

## Exit codes

| 0 | Card posted. |
| 2 | Missing `MSTEAMS_WEBHOOK_URL`. |
| 4 | stdin malformed. |
| 5 | Teams returned non-2xx. |

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
export MSTEAMS_WEBHOOK_URL="https://hooks.example.com/peepshow"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add msteams
# Optional: only fire for matching inputs
peepshow sinks add msteams --when extension=mp4,mov
peepshow sinks add msteams --when studio=Pixar
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
> then forwards the run to the `Microsoft Teams` sink.
>
> **`Microsoft Teams`**: delivers the run as an Adaptive Card to a Teams channel, optionally embedding frames inline.
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
