# peepshow-sink-trello

<!-- gif:sink:trello -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/trello.gif" alt="peepshow → trello demo" width="720">
</p>
<!-- /gif:sink:trello -->


Create a Trello card (or attach to an existing one) with:
- a markdown description listing strategy, frames, codec, duration, resolution, director, studio,
- one multipart attachment per extracted frame.

Uses Trello's REST API with [key + token](https://trello.com/power-ups/admin) authentication (passed as query-string params on every request).

## Invocation

```bash
peepshow ./bug-repro.mov --sink trello
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `TRELLO_KEY`     | ✓ | — | Trello API key. |
| `TRELLO_TOKEN`   | ✓ | — | User token. |
| `TRELLO_LIST_ID` | ◐ | — | List GID to create the new card under (required unless `TRELLO_CARD_ID` is set). |
| `TRELLO_CARD_ID` | ◐ | — | Attach to this existing card; skip the create step. |
| `TRELLO_API_URL` |   | `https://api.trello.com/1` | Override for self-hosted / test doubles. |

## Exit codes

| 0 | Card created / attachments uploaded. |
| 2 | Missing env. |
| 4 | stdin malformed. |
| 5 | Trello returned non-2xx on create or attachment. |

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
export TRELLO_KEY="…"
export TRELLO_TOKEN="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add trello
# Optional: only fire for matching inputs
peepshow sinks add trello --when extension=mp4,mov
peepshow sinks add trello --when priority=high
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
> then forwards the run to the `Trello` sink.
>
> **`Trello`**: creates a Trello card on a configured list with every frame attached as a card attachment.
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
