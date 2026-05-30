# peepshow-sink-pushover

<!-- gif:sink:pushover -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/pushover.gif" alt="peepshow → pushover demo" width="720">
</p>
<!-- /gif:sink:pushover -->


Push a peepshow run summary to every device on your [Pushover](https://pushover.net)
account via `POST https://api.pushover.net/1/messages.json`. The
form-encoded body carries the standard Pushover fields — `token`, `user`,
`title`, `message`, optional `priority`, optional `url` — and a clickable
"Open frame" action when `PEEPSHOW_FRAME_BASE_URL` is set.

Pushover is a one-off purchase per platform (no recurring fee) and
delivers within seconds to iOS, Android, and desktop clients
([pushover.net/clients](https://pushover.net/clients)).

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `PUSHOVER_USER_KEY` | ✓ | — | User or group key from [pushover.net](https://pushover.net). |
| `PUSHOVER_API_TOKEN` | ✓ | — | Application API token. Generate one under [Your Applications](https://pushover.net/apps/build). |
| `PUSHOVER_DEVICE` |   | — | Comma-separated device names (e.g. `iphone,ipad`). Defaults to every registered device. |
| `PUSHOVER_PRIORITY` |   | `0` | `-2..2`. `-2`=lowest/silent, `0`=normal, `1`=high, `2`=emergency-bypass (requires `retry`/`expire` set server-side). Out-of-range values clamp to the default. |
| `PUSHOVER_TITLE_PREFIX` |   | `peepshow` | Prepended to the notification title. |
| `PUSHOVER_API_URL` |   | `https://api.pushover.net` | Override the base URL. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is sent as Pushover's `url` field — Pushover renders it as a clickable action under the notification. |

## Exit codes

| 0 | Notification accepted. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Pushover returned non-2xx (e.g. invalid user, rate-limited) or the request failed at the network layer. |

## Message shape

Pushover renders the title, message, and (optionally) a clickable URL:

```
Title:    peepshow: The Heist
Message:  12 frames · 87.4s · 1920×1080 · h264
          strategy=scene
          director: Kubrick
URL:      https://cdn.example.com/runs/abc/frame_0001.jpg
Priority: 1
```

## Use

```bash
export PUSHOVER_USER_KEY="uXXXXXXXXXXXXXXXXXXXXXX"
export PUSHOVER_API_TOKEN="aXXXXXXXXXXXXXXXXXXXXXX"
peepshow sinks add pushover
peepshow ./video.mp4
```

Target specific devices with priority bump:

```bash
export PUSHOVER_DEVICE="iphone,ipad"
export PUSHOVER_PRIORITY=1
peepshow sinks add pushover
```

## Caveats

- Pushover has a 10,000 message/month free quota per Application token; heavy peepshow loads should batch via `webhook` → an upstream notification fan-out.
- `PUSHOVER_PRIORITY=2` (emergency-bypass) requires `retry` and `expire` parameters set on the Pushover side — this sink doesn't send them, so requests with priority=2 may be rejected. Use 1 for "high" instead.
- Message body is capped at 1024 characters server-side; the sink truncates locally before sending.

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
export PUSHOVER_USER_KEY="uXXXXXXXXXXXXXXXXXXXXXX"
export PUSHOVER_API_TOKEN="aXXXXXXXXXXXXXXXXXXXXXX"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags:

```sh
peepshow sinks add pushover
# Optional: only fire for matching inputs
peepshow sinks add pushover --when extension=mp4,mov
peepshow sinks add pushover --when project=alerts
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code (or ask
> "what's in ~/bugs/crash.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/crash.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Pushover` sink.
>
> **`Pushover`**: pushes a notification to every device on the account
> (or just the ones in `PUSHOVER_DEVICE`) with the run title, frame
> count, duration, and a clickable URL to the first frame when
> `PEEPSHOW_FRAME_BASE_URL` is set.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary — your phone already buzzed
> by the time the LLM finishes typing.

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

> **Notification body**: only the run summary is sent (frames, duration,
> dims, codec, director / studio tags). The full transcript is not
> included to keep the body under Pushover's 1024-char cap — pair with
> `webhook` or `airtable` if you also want the transcript persisted.
