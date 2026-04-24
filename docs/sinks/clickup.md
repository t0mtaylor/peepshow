# peepshow-sink-clickup

<!-- gif:sink:clickup -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/clickup.gif" alt="peepshow → clickup demo" width="720">
</p>
<!-- /gif:sink:clickup -->


Create a ClickUp task (or attach to an existing one) with:
- a markdown description summarising the peepshow run (strategy, frames, codec, duration, resolution, director, studio),
- one multipart attachment per extracted frame.

Uses the ClickUp v2 REST API.

## Invocation

```bash
peepshow ./bug-repro.mov --sink clickup
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `CLICKUP_TOKEN`   | ✓ | — | Personal API token (ClickUp settings → Apps) or OAuth token. Sent verbatim — **no `Bearer` prefix**. |
| `CLICKUP_LIST_ID` | ◐ | — | List id to create a new task under. Required unless `CLICKUP_TASK_ID` is set. |
| `CLICKUP_TASK_ID` | ◐ | — | Attach to this existing task; skip the create step. |
| `CLICKUP_API_URL` |   | `https://api.clickup.com/api/v2` | Override for self-hosted proxies. Trailing slashes are stripped. |

One of `CLICKUP_LIST_ID` or `CLICKUP_TASK_ID` must be set.

## Exit codes

| 0 | Task created / attachments uploaded. |
| 2 | Missing env (`CLICKUP_TOKEN`, or neither list nor task id). |
| 4 | stdin malformed. |
| 5 | ClickUp returned non-2xx on create or attachment. |

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
export CLICKUP_TOKEN="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add clickup
# Optional: only fire for matching inputs
peepshow sinks add clickup --when extension=mp4,mov
peepshow sinks add clickup --when priority=high
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
> then forwards the run to the `ClickUp` sink.
>
> **`ClickUp`**: opens a ClickUp task with a markdown description and every frame uploaded via the v2 REST API.
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
