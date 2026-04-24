# peepshow-sink-outline

<!-- gif:sink:outline -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/outline.gif" alt="peepshow → outline demo" width="720">
</p>
<!-- /gif:sink:outline -->


Create a document in [Outline](https://www.getoutline.com) per peepshow
run. Title is `peepshow · <video title> · <date>`. Body is markdown with
a Metadata section + a numbered Frames list.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `OUTLINE_BASE_URL`      | ✓ | — | `https://your.outline/` or `https://app.getoutline.com`. |
| `OUTLINE_API_TOKEN`     | ✓ | — | Bearer API token. |
| `OUTLINE_COLLECTION_ID` | ✓ | — | Collection to create the doc under. |
| `OUTLINE_PARENT_DOC_ID` |   | — | Create as a child of this doc. |
| `OUTLINE_PUBLISH`       |   | — | `1` publishes immediately; default leaves it as a draft. |

## Exit codes

| 0 | Document created. |
| 2 | Missing required env. |
| 4 | stdin malformed. |
| 5 | Outline returned non-2xx. |

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
export OUTLINE_BASE_URL="https://example.com"
export OUTLINE_API_TOKEN="…"
export OUTLINE_COLLECTION_ID="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add outline
# Optional: only fire for matching inputs
peepshow sinks add outline --when extension=mp4,mov
peepshow sinks add outline --when director=Kubrick
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
> then forwards the run to the `Outline` sink.
>
> **`Outline`**: files the run as an Outline document under a configured collection, as a draft or published.
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

> **Transcript handling**: the transcript is inserted into the created page body alongside the frame gallery, so the written record is searchable in the same tool.
