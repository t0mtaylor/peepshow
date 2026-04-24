# peepshow-sink-plausible

<!-- gif:sink:plausible -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/plausible.gif" alt="peepshow → plausible demo" width="720">
</p>
<!-- /gif:sink:plausible -->


Fire a custom event against a [Plausible Analytics](https://plausible.io)
site so peepshow runs show up on the dashboard alongside regular
pageviews. Works with Plausible Cloud and self-hosted Plausible.

## Invocation

```bash
PLAUSIBLE_DOMAIN=peepshow.dev \
  peepshow ./clip.mov --sink plausible

# self-hosted
PLAUSIBLE_DOMAIN=analytics.internal \
PLAUSIBLE_HOST=https://analytics.example.com \
  peepshow ./clip.mov --sink plausible
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `PLAUSIBLE_DOMAIN`     | ✓ | — | Site domain as registered in Plausible. |
| `PLAUSIBLE_HOST`       |   | `https://plausible.io` | Base URL for Plausible Cloud / self-hosted. Trailing slashes stripped. |
| `PLAUSIBLE_EVENT_NAME` |   | `peepshow_run` | Custom-event name recorded in Plausible. |
| `PLAUSIBLE_URL`        |   | `https://<domain>/peepshow` | Absolute URL recorded against the event. |
| `PLAUSIBLE_USER_AGENT` |   | `peepshow/0.3 (+https://www.peepshow.dev)` | UA header — Plausible rejects requests without one. |

## Event shape

`POST <host>/api/event` with body:

```json
{
  "name": "peepshow_run",
  "domain": "peepshow.dev",
  "url": "https://peepshow.dev/peepshow",
  "props": {
    "strategy": "scene",
    "frames": 12,
    "codec": "h264",
    "duration_s": 42.5,
    "width": 1280,
    "height": 720,
    "director": "Sacha",
    "studio": "Blender",
    "output_dir": "/tmp/peepshow",
    "tags": "{\"title\":\"Big Buck Bunny\"}"
  }
}
```

Optional props (`duration_s`, `width`, `height`, `director`, `studio`)
are omitted when the underlying metadata is missing. `tags` is the
full `video.tags` object stringified as JSON, since Plausible props
values must be scalar.

Plausible responds `202 Accepted` on success.

## Exit codes

| 0 | Event accepted. |
| 2 | `PLAUSIBLE_DOMAIN` missing. |
| 4 | stdin malformed. |
| 5 | Plausible returned non-2xx. |

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
export PLAUSIBLE_DOMAIN="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add plausible
# Optional: only fire for matching inputs
peepshow sinks add plausible --when extension=mp4,mov
peepshow sinks add plausible --when source=production
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
> then forwards the run to the `Plausible` sink.
>
> **`Plausible`**: fires a custom Plausible event per run with strategy, frames, codec, duration, and container tags as props.
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

> **Transcript handling**: transcript metadata (language, duration, silence ratio) is sent as event properties.
