# peepshow-sink-shortcut

<!-- gif:sink:shortcut -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/shortcut.gif" alt="peepshow → shortcut demo" width="720">
</p>
<!-- /gif:sink:shortcut -->


Create a [Shortcut](https://shortcut.com) (formerly Clubhouse) story (or
attach to an existing one) with:
- a markdown description summarising the peepshow run (strategy, frames,
  codec, duration, resolution, director, studio, when those are known),
- one file upload per extracted frame via `POST /files`,
- the uploaded files linked back onto the story via `PUT /stories/{id}`
  with `file_ids`.

## Invocation

```bash
peepshow ./bug-repro.mov --sink shortcut
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `SHORTCUT_TOKEN`            | ✓ | — | API token, sent as `Shortcut-Token` header. |
| `SHORTCUT_PROJECT_ID`       | ◐ | — | Numeric project id to create a new story under (required unless `SHORTCUT_STORY_PUBLIC_ID` is set). |
| `SHORTCUT_STORY_PUBLIC_ID`  | ◐ | — | Attach to this existing story; skip the create step. |
| `SHORTCUT_STORY_TYPE`       |   | `bug` | `"feature" \| "chore" \| "bug"`. Unknown values fall back to `bug`. |
| `SHORTCUT_API_URL`          |   | `https://api.app.shortcut.com/api/v3` | Override for self-hosted / staging. |

Both `SHORTCUT_PROJECT_ID` and `SHORTCUT_STORY_PUBLIC_ID` must be positive integers.

## Exit codes

| Code | Meaning |
|-----:|---------|
| 0 | Story created / files uploaded + linked. |
| 2 | Missing env / bad numeric id / bad env combo. |
| 4 | stdin malformed. |
| 5 | Shortcut returned non-2xx on create, upload, or link. |

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
export SHORTCUT_TOKEN="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add shortcut
# Optional: only fire for matching inputs
peepshow sinks add shortcut --when extension=mp4,mov
peepshow sinks add shortcut --when priority=high
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
> then forwards the run to the `Shortcut` sink.
>
> **`Shortcut`**: creates a Shortcut story, uploads each frame via `/files`, and links the file ids back onto the story.
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

> **Transcript handling**: transcript lines appear in the issue body so triage has a copy-pasteable record of what was said on-screen.
