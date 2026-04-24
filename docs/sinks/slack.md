# peepshow-sink-slack

<!-- gif:sink:slack -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/slack.gif" alt="peepshow → slack demo" width="720">
</p>
<!-- /gif:sink:slack -->


Posts a peepshow run as a formatted Slack message via an incoming webhook. Uses Block Kit with a summary, tag bullets, and a context footer.

## Setup

1. Create an [incoming webhook](https://api.slack.com/messaging/webhooks) in your Slack workspace.
2. Copy the webhook URL.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `SLACK_WEBHOOK_URL` | yes* | — | Slack incoming-webhook URL |
| `PEEPSHOW_WEBHOOK_URL` | yes* | — | alias — also read if `SLACK_WEBHOOK_URL` isn't set |

\* one of the two is required.

## Use

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T00/B00/xxx"
peepshow sinks add slack
peepshow ./video.mp4
```

## Message shape

- **Header paragraph** — `peepshow: N frames from <title> (1920×1080, 42.0s, h264) via scene`
- **Tag block** — bulleted list of up to 8 `video.tags` entries (title, director, producer, …)
- **Context footer** — output directory, byte count, elapsed ms

## Caveats

- Slack webhooks don't render arbitrary image URLs inline — pair with the [`s3`](./s3.md) sink and post Slack links for frames.
- One webhook = one channel. For routing per-run (e.g. Kubrick films → #cinema, everything else → #random) use [`--when`](../PLUGINS.md#conditional-matching---when) sink conditions with two separate auto-sinks.

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
export SLACK_WEBHOOK_URL="https://hooks.example.com/peepshow"
export PEEPSHOW_WEBHOOK_URL="https://hooks.example.com/peepshow"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add slack
# Optional: only fire for matching inputs
peepshow sinks add slack --when extension=mp4,mov
peepshow sinks add slack --when studio=Pixar
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
> then forwards the run to the `Slack` sink.
>
> **`Slack`**: posts a Block Kit summary card with the video metadata, frame count, and a thumbnail into the configured channel.
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
