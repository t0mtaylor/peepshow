# peepshow-sink-apprise

<!-- gif:sink:apprise -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/apprise.gif" alt="peepshow → apprise demo" width="720">
</p>
<!-- /gif:sink:apprise -->


Fan out a peepshow run to 80+ notification services through a single
[Apprise API](https://github.com/caronc/apprise-api) instance.
Apprise normalises Slack, Discord, Telegram, Matrix, email, SMS, ntfy,
Pushover, Pushbullet, Gotify, MS Teams, Mailgun, and dozens more behind
one URL syntax — this sink POSTs to its HTTP wrapper so peepshow doesn't
have to learn each service.

Two modes:

| Mode | When | How |
|------|------|-----|
| **stateless** | One-off / no shared config | `APPRISE_URLS="slack://...,mailto://..."` — POST `/notify` with the URL list inline. |
| **stateful**  | Pre-registered config on the server | `APPRISE_URLS="tag:home"` or `APPRISE_URLS="tag:home@configId"` — POST `/notify/<configId>` with `tag=<value>`. |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `APPRISE_BASE_URL` | ✓ | — | Base URL of the Apprise API instance (e.g. `http://localhost:8000`). Trailing slashes stripped. |
| `APPRISE_URLS` | ✓ | — | Comma-separated [Apprise URLs](https://github.com/caronc/apprise#supported-notifications) OR `tag:<value>` / `tag:<value>@<configId>` for stateful routing. |
| `APPRISE_TITLE_PREFIX` |   | `peepshow` | Prepended to the message title. |

## Exit codes

| 0 | Notification accepted. |
| 2 | Missing `APPRISE_BASE_URL` / `APPRISE_URLS`, or a malformed `tag:` form. |
| 4 | stdin malformed. |
| 5 | Apprise returned non-2xx, or the request failed at the network layer. |

## Running the Apprise API

```bash
docker run -p 8000:8000 caronc/apprise:latest
```

See the [official deployment guide](https://github.com/caronc/apprise-api#installation) for compose / k8s / bare-metal options.

## Use

```bash
export APPRISE_BASE_URL="http://localhost:8000"
export APPRISE_URLS="slack://TOKEN/CHANNEL,mailto://user:pass@host"
peepshow sinks add apprise
peepshow ./video.mp4
```

Stateful — re-use a saved config server-side:

```bash
export APPRISE_BASE_URL="http://localhost:8000"
export APPRISE_URLS="tag:home@peepshow"
peepshow sinks add apprise
```

## Caveats

- The Apprise API has its own auth model; if you've enabled it, terminate at a reverse proxy that adds the necessary headers. This sink doesn't currently bolt arbitrary auth onto the request.
- Apprise URLs can contain credentials — store `APPRISE_URLS` like any other secret. Stateful mode keeps URLs server-side and is generally safer.

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
export APPRISE_BASE_URL="http://localhost:8000"
export APPRISE_URLS="tag:home"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add apprise
# Optional: only fire for matching inputs
peepshow sinks add apprise --when extension=mp4,mov
peepshow sinks add apprise --when environment=prod
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
> then forwards the run to the `Apprise` sink.
>
> **`Apprise`**: POSTs the run summary to your Apprise API, which fans
> it out to every channel in your URL list / saved tag — Slack, email,
> Telegram, ntfy, anything Apprise supports.
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

> **Transcript handling**: Apprise is a notification surface — the
> message body is intentionally short. The transcript stays on disk; use
> a wiki / SQL sink alongside Apprise for full-text retention.
