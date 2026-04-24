# peepshow-sink-discord

<!-- gif:sink:discord -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/discord.gif" alt="peepshow → discord demo" width="720">
</p>
<!-- /gif:sink:discord -->


Posts a peepshow run as a Discord message via a channel webhook. Uses embeds with title, description, fields for every `video.tags` entry, and a footer.

## Setup

1. In Discord, open your server → **Integrations → Webhooks → New Webhook**.
2. Copy the webhook URL.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `DISCORD_WEBHOOK_URL` | yes* | — | Discord channel webhook URL |
| `PEEPSHOW_WEBHOOK_URL` | yes* | — | alias — also read if `DISCORD_WEBHOOK_URL` isn't set |

\* one of the two is required.

## Use

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
peepshow sinks add discord
peepshow ./video.mp4
```

## Message shape

- **`content`** — one-line summary with title + dims + duration + codec + strategy.
- **`embeds[0]`** — embed with `title` (from `video.tags.title` or "peepshow run"), `description` (`"N frames via scene detection"`), up to 10 inline `fields` (one per tag), and a `footer` listing the output directory + ffmpeg source.

## Caveats

- Max 10 embed fields — extra tags are dropped (in insertion order).
- Each field value max 1024 chars — auto-truncated with `…`.
- Discord webhooks accept file attachments via `multipart/form-data`; today this sink only posts JSON. Pair with [`s3`](./s3.md) and link from embed fields for inline thumbnails.

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
export DISCORD_WEBHOOK_URL="https://hooks.example.com/peepshow"
export PEEPSHOW_WEBHOOK_URL="https://hooks.example.com/peepshow"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add discord
# Optional: only fire for matching inputs
peepshow sinks add discord --when extension=mp4,mov
peepshow sinks add discord --when studio=Pixar
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
> then forwards the run to the `Discord` sink.
>
> **`Discord`**: posts a channel message via webhook with embedded frame thumbnails and inline frame attachments.
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
