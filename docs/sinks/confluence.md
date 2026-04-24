# peepshow-sink-confluence

<!-- gif:sink:confluence -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/confluence.gif" alt="peepshow → confluence demo" width="720">
</p>
<!-- /gif:sink:confluence -->


Create a Confluence Cloud page per peepshow run. Body is storage-format
XHTML with a Metadata list + a numbered Frames list. Uses basic auth
(email + API token) + `/wiki/api/v2/pages`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `CONFLUENCE_BASE_URL`       | ✓ | — | `https://<you>.atlassian.net`. |
| `CONFLUENCE_USER`           | ✓ | — | Email for basic auth. |
| `CONFLUENCE_API_TOKEN`      | ✓ | — | API token. |
| `CONFLUENCE_SPACE_ID`       | ◐ | — | Numeric space id (preferred by v2). |
| `CONFLUENCE_SPACE_KEY`      | ◐ | — | Alphanumeric space key — fallback if no id. |
| `CONFLUENCE_PARENT_PAGE_ID` |   | — | Nest under an existing page. |

Either `CONFLUENCE_SPACE_ID` or `CONFLUENCE_SPACE_KEY` is required.

## Exit codes

| 0 | Page created. |
| 2 | Missing env / space identifier. |
| 4 | stdin malformed. |
| 5 | Confluence returned non-2xx. |

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
export CONFLUENCE_BASE_URL="https://example.com"
export CONFLUENCE_USER="you@example.com"
export CONFLUENCE_API_TOKEN="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add confluence
# Optional: only fire for matching inputs
peepshow sinks add confluence --when extension=mp4,mov
peepshow sinks add confluence --when director=Kubrick
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
> then forwards the run to the `Confluence` sink.
>
> **`Confluence`**: creates a Confluence page under a space with a Metadata section and a Frames list.
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
