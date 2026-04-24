# peepshow-sink-sentry

<!-- gif:sink:sentry -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/sentry.gif" alt="peepshow → sentry demo" width="720">
</p>
<!-- /gif:sink:sentry -->


Send a peepshow run as a [Sentry](https://sentry.io) event (message-level) so video evidence can attach to an incident timeline. Tags are populated from video metadata (strategy, codec, container, ffmpeg source); the full `video`, `frames[]`, `extraction` payload lands in the `extra` block. Uses Sentry's store endpoint — no SDK required.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `SENTRY_DSN`         | ✓ | — | Project DSN, e.g. `https://<key>@<host>/<project>`. |
| `SENTRY_LEVEL`       |   | `info`  | `info` / `warning` / `error`. Unknown values fall back to `info`. |
| `SENTRY_RELEASE`     |   | (none) | Release identifier, added to the event. |
| `SENTRY_ENVIRONMENT` |   | (none) | Environment slug, e.g. `production`. |

## Usage

```bash
export SENTRY_DSN="https://<key>@o123.ingest.sentry.io/456"
export SENTRY_ENVIRONMENT="production"
peepshow ./trigger.mp4 --sink sentry
```

Optional flags:
- `--when` filters so the sink only fires for matching inputs (see [PLUGINS.md](../PLUGINS.md)).
- Pair with `peepshow sinks add sentry` for auto-invocation.

## Event shape

- `event_id` — random 128-bit hex (32 chars), what Sentry expects.
- `timestamp` — ISO-8601 from peepshow's run.
- `level` — `SENTRY_LEVEL` (default `info`).
- `logger: "peepshow"`, `platform: "javascript"`.
- `message.formatted` — `peepshow: N frames from "<title>" (<codec>, <duration>s)`.
- `tags` — `{ strategy, codec, container, ffmpeg_source }`.
- `extra` — `{ video, extraction, frames, outputDir }`.
- `release` / `environment` — included when set.

The request is authed via `x-sentry-auth: Sentry sentry_version=7, sentry_client=peepshow-sink-sentry/…, sentry_timestamp=…, sentry_key=<DSN key>`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Event dispatched. |
| 2 | Missing `SENTRY_DSN`, or DSN malformed. |
| 4 | stdin malformed. |
| 5 | Sentry returned non-2xx (rate limit, invalid project, network). |

## Caveats

- Frames are listed in `extra.frames[]` as paths, not attached as screenshots. To get them rendered in the Sentry UI, pre-upload via an object-storage sink and include URLs in your own enrichment layer.
- Sentry's store endpoint is deprecated in favour of `/envelope/` for the newer SDKs, but remains supported and is the zero-dep option — no Sentry SDK required. If your org enforces envelope-only ingest, use `webhook` + a small shim instead.
- Unknown `SENTRY_LEVEL` values silently degrade to `info` rather than failing; check the value if events aren't surfacing at the severity you expected.

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
export SENTRY_DSN="https://<key>@o123.ingest.sentry.io/456"
export SENTRY_ENVIRONMENT="production"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add sentry
# Optional: only fire for matching inputs
peepshow sinks add sentry --when extension=mp4,mov
peepshow sinks add sentry --when severity=critical
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
> then forwards the run to the `Sentry` sink.
>
> **`Sentry`**: dispatches a message-level event tagged with the video codec/container and the full run payload in `extra`.
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

> **Transcript handling**: transcript metadata tags the event; the full text is stored as a custom attribute.

*Full list + links: [docs/sinks/README.md](./README.md).*
