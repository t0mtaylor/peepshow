# peepshow-sink-honeycomb

<!-- gif:sink:honeycomb -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/honeycomb.gif" alt="peepshow → honeycomb demo" width="720">
</p>
<!-- /gif:sink:honeycomb -->


POST a peepshow run as a single structured event to a Honeycomb dataset
(`/1/events/<DATASET>`). Every interesting field on the run — video
metadata, container tags, frame counts, audio + transcript summary — is
flattened into dotted keys so Honeycomb's wide-event model can group and
query it without any dataset-side schema work.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `HONEYCOMB_API_KEY` | ✓ | — | Sent as the `X-Honeycomb-Team` header. |
| `HONEYCOMB_DATASET` | ✓ | — | Dataset name; URL-encoded into the path. |
| `HONEYCOMB_REGION`  |   | `us` | `us` \| `eu`. Unknown values clamp to `us`. |
| `HONEYCOMB_API_URL` |   | — | Full API base override (e.g. on-prem / proxy). Strips trailing slashes. |

Region routing:

- `us` → `https://api.honeycomb.io`
- `eu` → `https://api.eu1.honeycomb.io`
- `HONEYCOMB_API_URL` override wins over region.

## Exit codes

| 0 | Event accepted. |
| 2 | Missing `HONEYCOMB_API_KEY` or `HONEYCOMB_DATASET`. |
| 4 | stdin malformed. |
| 5 | Honeycomb returned non-2xx, or the request failed at the network layer. |

## Event shape

One flat JSON event per peepshow run. Null fields drop; present fields
use dotted keys Honeycomb renders as grouped columns. Example:

```json
{
  "run_id": "peepshow-run-abc",
  "strategy": "scene",
  "frames.emitted": 4,
  "frames.pruned": 0,
  "extraction.elapsed_ms": 187.5,
  "extraction.ffmpeg_source": "system",
  "video.duration_seconds": 12.0,
  "video.resolution": "1920x1080",
  "video.codec": "h264",
  "video.container": "mov",
  "video.tags.director": "Kubrick",
  "audio.codec": "aac",
  "audio.duration_seconds": 12.0,
  "audio.transcript_provider": "whisper-cpp",
  "audio.transcript_segment_count": 4
}
```

Container tags on the source video pass through as
`video.tags.<key>` — unknown tag keys come along for free, no code
changes needed.

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
export HONEYCOMB_API_KEY="…"
export HONEYCOMB_DATASET="peepshow"
# Optional — EU tenants:
export HONEYCOMB_REGION="eu"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add honeycomb
# Optional: only fire for matching inputs
peepshow sinks add honeycomb --when extension=mp4,mov
peepshow sinks add honeycomb --when environment=prod
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
> then forwards the run to the `Honeycomb` sink.
>
> **`Honeycomb`**: POSTs a single structured event into the configured
> dataset. Columns populate themselves; no dataset schema to maintain.
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

> **Transcript handling**: the transcript provider, model, language and
> segment count tag the event as dotted keys; Honeycomb is optimised for
> wide structured events so the metadata slots in cleanly. Full
> transcript text is deliberately not included in the event body — use a
> database or object-storage sink alongside Honeycomb for the long-form
> payload.
