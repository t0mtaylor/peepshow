# peepshow-sink-height

<!-- gif:sink:height -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/height.gif" alt="peepshow → height demo" width="720">
</p>
<!-- /gif:sink:height -->


Create a [Height](https://height.app) task via the REST API with the run summary in the description and every frame path listed as a code-formatted bullet. Title defaults to `video.tags.title` / `video.tags.show`, falling back to `peepshow run (N frames)`.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

No SDK required — the sink posts to `https://api.height.app/tasks` over `fetch`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `HEIGHT_API_KEY` | ✓ | — | Personal API key. Sent as `Authorization: api-key <token>`. |
| `HEIGHT_LIST_ID` | ✓ | — | UUID of the list to file tasks under. Grab it from Height's list settings URL. |
| `HEIGHT_TITLE`   |   | (from video tags) | Override the task title. Trimmed to 255 chars. |

## Usage

```bash
export HEIGHT_API_KEY="..."
export HEIGHT_LIST_ID="abc12345-..."
peepshow ./bug.mov --sink height
```

Optional flags:
- `--when` filters so the sink only fires for matching inputs (see [PLUGINS.md](../PLUGINS.md)).
- Pair with `peepshow sinks add height` for auto-invocation.

## Task body

Markdown description with:

- A one-line summary (frame count + strategy).
- A `## Metadata` section — duration, resolution, codec, container, plus every `video.tags` entry as bullets.
- A `## Frames` section — one backtick-wrapped path per emitted frame.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Task created. |
| 2 | Missing `HEIGHT_API_KEY` or `HEIGHT_LIST_ID`. |
| 4 | stdin malformed. |
| 5 | Height API returned non-2xx. |

## Caveats

- Paths in the task body are text references, not uploads. If you need frames rendered inline, tee through an object-storage sink (e.g. `s3`, `gcs`) first and replace paths with URLs in a downstream processor, or use Height's native attachment API out-of-band.
- The sink always creates a new task — no dedup against existing tasks. Use `--when` to scope which runs create tasks, rather than post-hoc dedup.
- The API key is sent as `Authorization: api-key <token>` — that's the scheme Height's personal API keys expect.

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
export HEIGHT_API_KEY="..."
export HEIGHT_LIST_ID="abc12345-..."
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add height
# Optional: only fire for matching inputs
peepshow sinks add height --when extension=mp4,mov
peepshow sinks add height --when priority=high
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
> then forwards the run to the `Height` sink.
>
> **`Height`**: creates a task on the configured list with the run summary as the description and every frame path listed.
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

> **Transcript handling**: transcript lines appear in the task body so triage has a copy-pasteable record of what was said on-screen.

*Full list + links: [docs/sinks/README.md](./README.md).*
