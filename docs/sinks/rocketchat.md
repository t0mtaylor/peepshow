# peepshow-sink-rocketchat

<!-- gif:sink:rocketchat -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/rocketchat.gif" alt="peepshow → rocketchat demo" width="720">
</p>
<!-- /gif:sink:rocketchat -->


POST a peepshow run to a [Rocket.Chat incoming webhook][wh]. The body is
Slack-compatible (`text` + `attachments[]`), so the run renders as a
summary attachment (coloured bar + title + fields for Strategy / Frames
/ Codec / Duration / Resolution / Director / Studio) plus — if
`ROCKETCHAT_IMAGE_BASE` is set — one image attachment per frame (capped
by `ROCKETCHAT_MAX_IMAGES`). Without `ROCKETCHAT_IMAGE_BASE`, the
summary attachment lists the frame paths as a markdown bullet list
(first 20, with a `+N more` note).

[wh]: https://developer.rocket.chat/apidocs/create-integration

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ROCKETCHAT_WEBHOOK_URL` | ✓ | — | Incoming-webhook URL. |
| `ROCKETCHAT_CHANNEL`     |   | — | Override target channel (`#room` or `@user`). Requires the integration to allow channel overrides. |
| `ROCKETCHAT_ALIAS`       |   | — | Bot display name. |
| `ROCKETCHAT_EMOJI`       |   | — | Bot avatar emoji, e.g. `:ghost:`. |
| `ROCKETCHAT_AVATAR`      |   | — | Bot avatar URL. |
| `ROCKETCHAT_IMAGE_BASE`  |   | — | URL prefix — Rocket.Chat fetches images from `<base>/<frame-basename>`. Leave unset if frames aren't served publicly. |
| `ROCKETCHAT_MAX_IMAGES`  |   | `4` | Max image attachments posted. |

## Exit codes

| 0 | Webhook accepted the post. |
| 2 | Missing `ROCKETCHAT_WEBHOOK_URL`. |
| 4 | stdin malformed. |
| 5 | Rocket.Chat returned non-2xx. |

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
export ROCKETCHAT_WEBHOOK_URL="https://hooks.example.com/peepshow"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add rocketchat
# Optional: only fire for matching inputs
peepshow sinks add rocketchat --when extension=mp4,mov
peepshow sinks add rocketchat --when studio=Pixar
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
> then forwards the run to the `Rocket.Chat` sink.
>
> **`Rocket.Chat`**: POSTs a coloured attachment with the run metadata fields to a Rocket.Chat incoming webhook.
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
