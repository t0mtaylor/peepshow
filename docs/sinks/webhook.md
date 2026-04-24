# peepshow-sink-webhook

<!-- gif:sink:webhook -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/webhook.gif" alt="peepshow → webhook demo" width="720">
</p>
<!-- /gif:sink:webhook -->


Generic POST of the peepshow JSON payload to any URL. Foundation for the Slack and Discord sinks, useful on its own for automation platforms (Zapier, Make, n8n, custom APIs).

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `PEEPSHOW_WEBHOOK_URL` | yes | — | destination URL |
| `PEEPSHOW_WEBHOOK_AUTH` | no | — | full `Authorization` header value, verbatim (e.g. `Bearer xxx`) |
| `PEEPSHOW_WEBHOOK_FORMAT` | no | `peepshow` | `peepshow` \| `slack` \| `discord` |

## Use

```bash
export PEEPSHOW_WEBHOOK_URL="https://hooks.example.com/peepshow"
peepshow sinks add webhook
peepshow ./video.mp4
```

With auth header:

```bash
export PEEPSHOW_WEBHOOK_URL="https://api.example.com/ingest"
export PEEPSHOW_WEBHOOK_AUTH="Bearer sk-live-xxx"
peepshow sinks add webhook
```

## Payload shape

With `PEEPSHOW_WEBHOOK_FORMAT=peepshow` (default), the full [`--emit json`](../../tests/contract.test.ts) shape is POSTed verbatim. Switch format for Slack / Discord-specific rendering.

## Caveats

- No retry yet. If the target returns non-2xx the sink exits non-zero; peepshow logs the failure but the run itself still succeeds.
- TLS cert validation is on (Node's default). Use the `webhook` sink only with trusted HTTPS endpoints.

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
export PEEPSHOW_WEBHOOK_URL="https://hooks.example.com/peepshow"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add webhook
# Optional: only fire for matching inputs
peepshow sinks add webhook --when extension=mp4,mov
peepshow sinks add webhook --when director=Kubrick
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
> then forwards the run to the `Webhook` sink.
>
> **`Webhook`**: POSTs the full peepshow JSON payload to any URL — the universal escape hatch for automation platforms (Zapier, n8n, custom APIs).
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

> **Transcript handling**: the transcript rides along inside the JSON payload your downstream consumer receives.
