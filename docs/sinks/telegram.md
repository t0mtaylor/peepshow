# peepshow-sink-telegram

Post a peepshow run to a Telegram chat: one `sendMessage` with the
metadata summary, then one or more `sendMediaGroup` album posts with the
frames attached (max 10 photos per album — larger runs chunk
automatically).

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `TELEGRAM_BOT_TOKEN` | ✓ | — | Bot token from `@BotFather`. |
| `TELEGRAM_CHAT_ID`   | ✓ | — | `-100…` group id, `@username`, or numeric user id. |
| `TELEGRAM_API_URL`   |   | `https://api.telegram.org` | Override for local Bot API servers. |
| `TELEGRAM_PARSE_MODE`|   | `MarkdownV2` | `MarkdownV2` \| `HTML`. |

## Exit codes

| 0 | Summary + album(s) accepted. |
| 2 | Missing bot token or chat id. |
| 4 | stdin malformed. |
| 5 | Telegram returned non-2xx (sendMessage or sendMediaGroup). |

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
export TELEGRAM_BOT_TOKEN="…"
export TELEGRAM_CHAT_ID="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add telegram
# Optional: only fire for matching inputs
peepshow sinks add telegram --when extension=mp4,mov
peepshow sinks add telegram --when studio=Pixar
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
> then forwards the run to the `Telegram` sink.
>
> **`Telegram`**: posts a summary message plus one or more 10-photo albums to the configured chat.
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

> **Transcript handling**: the transcript snippet is posted alongside the frames as a secondary message in the thread.
