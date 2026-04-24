# peepshow-sink-datadog

<!-- gif:sink:datadog -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/datadog.gif" alt="peepshow → datadog demo" width="720">
</p>
<!-- /gif:sink:datadog -->


POST a peepshow run as a Datadog event (`/api/v1/events`) so it lands
on an incident timeline / event stream. `aggregation_key` groups repeat
runs of the same clip under one event cluster.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `DATADOG_API_KEY`     | ✓ | — | `DD-API-KEY` header. |
| `DATADOG_APP_KEY`     |   | — | `DD-APPLICATION-KEY` — include when your setup requires it. |
| `DATADOG_SITE`        |   | `datadoghq.com` | `datadoghq.eu` \| `us3.datadoghq.com` \| `us5.datadoghq.com` \| `ap1.datadoghq.com`. |
| `DATADOG_EVENT_TAGS`  |   | — | Comma-separated tags appended to the event (e.g. `incident_id:IR-12,env:prod`). |
| `DATADOG_ALERT_TYPE`  |   | `info` | `info` \| `warning` \| `error` \| `success`. |

## Exit codes

| 0 | Event accepted. |
| 2 | Missing `DATADOG_API_KEY`. |
| 4 | stdin malformed. |
| 5 | Datadog returned non-2xx. |

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
export DATADOG_API_KEY="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add datadog
# Optional: only fire for matching inputs
peepshow sinks add datadog --when extension=mp4,mov
peepshow sinks add datadog --when environment=prod
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
> then forwards the run to the `Datadog` sink.
>
> **`Datadog`**: POSTs a Datadog event with the run summary, clustering retriggers via `aggregation_key`.
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

> **Transcript handling**: transcript metadata tags the event; the full text is stored as a custom attribute.
