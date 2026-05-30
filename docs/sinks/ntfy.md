# peepshow-sink-ntfy

<!-- gif:sink:ntfy -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/ntfy.gif" alt="peepshow → ntfy demo" width="720">
</p>
<!-- /gif:sink:ntfy -->


Push a peepshow run summary to an [ntfy](https://ntfy.sh) topic via a
plain `POST <baseUrl>/<topic>` — message body holds the title +
`frames=N · duration=Ts` summary, ntfy's [custom headers](https://docs.ntfy.sh/publish/#publish-as-json)
carry the title, priority, and emoji tags. Subscribers on phones,
desktops, browsers, or the `ntfy` CLI get the alert instantly.

Works against the public `https://ntfy.sh` server or any
[self-hosted instance](https://docs.ntfy.sh/install/).

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `NTFY_TOPIC` | ✓ | — | Topic name. Anything alphanumeric works. |
| `NTFY_BASE_URL` |   | `https://ntfy.sh` | Override for self-hosted. Trailing slashes stripped. |
| `NTFY_TOKEN` |   | — | Bearer token for protected topics / authed self-hosted instances. |
| `NTFY_PRIORITY` |   | `3` | `1..5` (1=min, 5=max). Out-of-range and non-numeric values clamp to the default. |
| `NTFY_TAGS` |   | — | Comma-separated emoji shortcodes — e.g. `tada,movie_camera`. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is appended to the message body. ntfy renders the first URL as a clickable action. |

## Exit codes

| 0 | Notification accepted. |
| 2 | Missing `NTFY_TOPIC`. |
| 4 | stdin malformed. |
| 5 | ntfy returned non-2xx, or the request failed at the network layer. |

## Message shape

ntfy reads the title / priority / tags from custom headers and treats
the request body as the plain-text message:

```
Title: The Heist
Priority: 4
Tags: movie_camera,tada

The Heist
frames=12 · duration=87.4s
https://cdn.example.com/runs/abc/frame_0001.jpg
```

## Use

```bash
export NTFY_TOPIC="peepshow-prod"
export NTFY_PRIORITY=4
peepshow sinks add ntfy
peepshow ./video.mp4
```

Self-hosted with auth:

```bash
export NTFY_BASE_URL="https://ntfy.internal"
export NTFY_TOPIC="peepshow"
export NTFY_TOKEN="tk_abc123"
peepshow sinks add ntfy
```

## Caveats

- ntfy's free tier on `ntfy.sh` is rate-limited; spin up your own server with `docker run -p 80:80 binwiederhier/ntfy serve` for unlimited throughput.
- Topic names are public unless you self-host with auth — anyone who knows the topic name on `ntfy.sh` can read messages.

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
export NTFY_TOPIC="peepshow-prod"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add ntfy
# Optional: only fire for matching inputs
peepshow sinks add ntfy --when extension=mp4,mov
peepshow sinks add ntfy --when director=Kubrick
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
> then forwards the run to the `ntfy` sink.
>
> **`ntfy`**: POSTs the run summary as a notification to your topic; the
> ntfy app on your phone vibrates with the title, frame count, and a
> clickable preview link.
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

> **Transcript handling**: the transcript stays on disk — ntfy is a
> notification surface, not a database. Use a wiki / SQL / object-storage
> sink alongside ntfy if you need to retain the full text.
