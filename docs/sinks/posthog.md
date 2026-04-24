# peepshow-sink-posthog

<!-- gif:sink:posthog -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/posthog.gif" alt="peepshow → posthog demo" width="720">
</p>
<!-- /gif:sink:posthog -->


Capture a peepshow run as a [PostHog](https://posthog.com) product-analytics
event (plus optional per-frame events) so you can chart CLI usage,
popular sinks, average run duration, etc.

## Invocation

```bash
peepshow ./bug.mov --sink posthog
POSTHOG_PROJECT_API_KEY=phc_… \
  peepshow ./clip.mp4 --sink posthog
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `POSTHOG_PROJECT_API_KEY` | ✓ | — | Project API key (`phc_…`). |
| `POSTHOG_HOST`            |   | `https://us.posthog.com` | Override for EU / self-hosted. |
| `POSTHOG_DISTINCT_ID`     |   | `peepshow` | distinct_id used on every event. |
| `POSTHOG_PER_FRAME`       |   | — | `1` fires one additional `peepshow_frame` event per extracted frame. |

## Events

**peepshow_run** — one per run, properties: `strategy`, `frame_count`,
`output_bytes_total`, `avg_frame_bytes`, `elapsed_ms`, `ffmpeg_source`,
`codec`, `container`, `duration_seconds`, `width`, `height`, `fps`,
`title`, `director`, `studio`.

**peepshow_frame** (only when `POSTHOG_PER_FRAME=1`) — one per frame with
`ordinal`, `path`, `bytes`, `approx_seconds`, `strategy`.

Events hit `POSTHOG_HOST/batch/` in a single request.

## Exit codes

| 0 | Events accepted. |
| 2 | Missing `POSTHOG_PROJECT_API_KEY`. |
| 4 | stdin malformed. |
| 5 | PostHog returned non-2xx. |

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
export POSTHOG_PROJECT_API_KEY="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add posthog
# Optional: only fire for matching inputs
peepshow sinks add posthog --when extension=mp4,mov
peepshow sinks add posthog --when source=production
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
> then forwards the run to the `PostHog` sink.
>
> **`PostHog`**: captures a single `peepshow_run` event per run with strategy, frame count, codec, duration, and container tags as properties.
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
