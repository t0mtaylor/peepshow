# peepshow-sink-weaviate

<!-- gif:sink:weaviate -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/weaviate.gif" alt="peepshow → weaviate demo" width="720">
</p>
<!-- /gif:sink:weaviate -->


Batch-insert peepshow frames into a [Weaviate](https://weaviate.io) class so
the frames are indexed as vectors (via whatever vectorizer the class was
configured with — `text2vec-openai`, `text2vec-cohere`, etc).

## Install

Ships built-in with peepshow.

## Invocation

```bash
peepshow ./scene.mp4 --sink weaviate
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `WEAVIATE_URL`    | ✓ | — | Base URL of Weaviate. Trailing slashes stripped. |
| `WEAVIATE_CLASS`  |   | `PeepshowFrame` | Class to insert into. Must exist. |
| `WEAVIATE_API_KEY`|   | (none) | Bearer API key for Weaviate Cloud / auth-enabled installs. |
| `WEAVIATE_TENANT` |   | (none) | Tenant name for multi-tenancy. |

## Object shape (per frame)

```json
{
  "class": "PeepshowFrame",
  "properties": {
    "peepshow_run": "2026-04-23T03:00:00.000Z",
    "ordinal": 3,
    "title": "Jellyfish",
    "path": "/tmp/out/frame_0003.jpg",
    "bytes": 120,
    "approx_seconds": 15.00,
    "strategy": "scene",
    "codec": "h264",
    "container": "mov",
    "duration_seconds": 30,
    "width": 1920,
    "height": 1080,
    "fps": 24,
    "director": "Kubrick",
    "studio": "Warner",
    "description": "Frame 3/3 from \"Jellyfish\" at ~15.00s — /tmp/out/frame_0003.jpg"
  },
  "tenant": "team-1"
}
```

## Exit codes

| 0 | Batch accepted. |
| 2 | Missing `WEAVIATE_URL`. |
| 4 | stdin malformed. |
| 5 | Weaviate returned non-2xx. |

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
export WEAVIATE_URL="https://example.com"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add weaviate
# Optional: only fire for matching inputs
peepshow sinks add weaviate --when extension=mp4,mov
peepshow sinks add weaviate --when genre=tutorial
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
> then forwards the run to the `Weaviate` sink.
>
> **`Weaviate`**: batch-inserts every frame as an object into a Weaviate class — the server-side vectorizer handles embeddings.
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

> **Transcript handling**: the transcript text is a natural embedding target — indexed alongside the frames so later retrieval covers spoken content too.
