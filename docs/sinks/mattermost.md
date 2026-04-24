# peepshow-sink-mattermost

<!-- gif:sink:mattermost -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/mattermost.gif" alt="peepshow → mattermost demo" width="720">
</p>
<!-- /gif:sink:mattermost -->


POST a peepshow run to a Mattermost Incoming Webhook. The body is
Slack-compatible — a top-level `text` plus a primary `attachment`
(peepshow purple) with fields for Strategy / Frames / Codec / Duration /
Resolution, plus Director / Studio when the video carries those tags.
If `MATTERMOST_IMAGE_BASE` is set, the first N frames (up to
`MATTERMOST_MAX_IMAGES`) are appended as image attachments; otherwise the
primary attachment's `text` lists the frame paths.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MATTERMOST_WEBHOOK_URL` | ✓ | — | Incoming-webhook URL. |
| `MATTERMOST_CHANNEL`     |   | — | Override target channel (`town-square`, `@alice`, `~announcements`). |
| `MATTERMOST_USERNAME`    |   | — | Override bot display name. |
| `MATTERMOST_ICON_URL`    |   | — | Override bot avatar URL. |
| `MATTERMOST_IMAGE_BASE`  |   | — | URL prefix — Mattermost fetches images from `<base>/<frame-basename>`. Leave unset if frames aren't served publicly. |
| `MATTERMOST_MAX_IMAGES`  |   | `4` | Max image attachments (Mattermost clients get sluggish past ~5). |

## Exit codes

| 0 | Message posted. |
| 2 | Missing `MATTERMOST_WEBHOOK_URL`. |
| 4 | stdin malformed. |
| 5 | Mattermost returned non-2xx. |

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
export MATTERMOST_WEBHOOK_URL="https://hooks.example.com/peepshow"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add mattermost
# Optional: only fire for matching inputs
peepshow sinks add mattermost --when extension=mp4,mov
peepshow sinks add mattermost --when studio=Pixar
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
> then forwards the run to the `Mattermost` sink.
>
> **`Mattermost`**: POSTs a Slack-compatible attachment to a Mattermost incoming webhook with the run metadata fields.
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
