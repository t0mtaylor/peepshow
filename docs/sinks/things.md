# peepshow-sink-things

<!-- gif:sink:things -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/things.gif" alt="peepshow → Things 3 demo" width="720">
</p>
<!-- /gif:sink:things -->

File every peepshow run as a todo in **[Things 3](https://culturedcode.com/things/)** — Cultured Code's macOS / iOS task manager. The sink builds a `things:///add?...` x-callback-url, then `open`s it via the macOS `open` command. Things picks the URL up automatically through its registered scheme handler — no AppleScript, no REST API, no auth tokens.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

Register as an auto-sink so every run lands in Things automatically:

```bash
peepshow sinks add things
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `THINGS_TITLE` | — | — | Override the derived title. |
| `PEEPSHOW_THINGS_TITLE` | — | — | Alias for `THINGS_TITLE`. Wins when both are set. |
| `THINGS_NOTES_PREFIX` | — | — | Prepended to the notes body, separated by a blank line. |
| `THINGS_TAGS` | — | — | Comma-separated extra tags. Always merged with the default `peepshow` tag — duplicates collapse. |
| `THINGS_LIST` | — | — | Project / area name in Things to file the todo under. |
| `THINGS_WHEN` | — | — | Schedule: `today` · `tomorrow` · `evening` · `anytime` · `someday` · or an ISO-date `YYYY-MM-DD`. |
| `THINGS_ALLOW_NON_DARWIN` | — | — | Set to `1` / `true` / `yes` to attempt anyway on non-darwin (CI dry-runs). |

## Platform behaviour

Things 3 is macOS- / iOS-only. On Linux or Windows the sink **skips silently** (exit 0) with a stderr note, unless `THINGS_ALLOW_NON_DARWIN=1` is set — useful for CI where a stub `open` binary is injected on `PATH`.

## What gets written

One new todo per run, with:

- **Title** — from `THINGS_TITLE`, else `video.tags.title`, else `video.tags.show`, else `peepshow run (N frames)`.
- **Notes** — markdown-flavoured plain-text body with the optional notes prefix, frame count, strategy, duration, resolution, codec, container tags, and a transcript snippet from the first segment when peepshow's audio pass produces one.
- **Tags** — `peepshow` plus anything in `THINGS_TAGS`.
- **List** — when `THINGS_LIST` is set, Things files the todo under that project / area.
- **Schedule** — when `THINGS_WHEN` is set, Things schedules accordingly.

## URL scheme shape

The generated URL looks roughly like this (everything URL-encoded via `encodeURIComponent`):

```
things:///add?title=The%20Heist&notes=frames%3A%202%20(scene)%0Aduration%3A%2042.00s&tags=peepshow%2Cbug&list=Inbox&when=today
```

The full reference for the `things:///add` x-callback-url scheme lives in [Cultured Code's docs](https://culturedcode.com/things/help/url-scheme/).

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Dispatched the URL (or skipped silently on non-darwin). |
| 2 | Invalid `THINGS_WHEN` value. |
| 3 | `open` not on `PATH` (extremely rare on macOS). |
| 4 | stdin malformed. |
| 5 | `open` exited non-zero (no handler registered for `things://`, etc). |

## Caveats

- Things 3 must be installed and have run at least once on the Mac before the URL scheme is registered. Without the app, macOS prompts to choose a handler for `things://` and the `open` call fails non-zero.
- The sink **always creates a new todo**. Things' URL scheme has no native deduplication; if you re-extract the same clip, you get a second todo. Use `THINGS_TITLE` plus a script-side check if you need single-todo behaviour.
- Frames are *not* attached to the todo — Things doesn't accept attachments via URL. The notes body references frame counts + the first transcript segment so the todo is meaningful at a glance; cross-reference the underlying frame folder via your own conventions if you need inline review.
- `THINGS_LIST` matches Things' project / area names exactly (case-sensitive). If the list doesn't exist, Things falls back to the Inbox silently.
- `things:///` is a one-way pipe — there's no callback / completion event, so the sink considers the URL dispatched as soon as `open` exits 0. That happens immediately; Things processes the URL asynchronously.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

Defaults work on macOS with no config — every run becomes a todo in the Inbox tagged `peepshow`. Optional overrides:

```sh
export THINGS_LIST="Bug Triage"
export THINGS_TAGS="bug,clip"
export THINGS_WHEN="today"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add things
# Optional: only fire for matching inputs
peepshow sinks add things --when extension=mp4,mov
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `bug.mov` into Claude Code (or ask
> "what's wrong in ~/recordings/crash.mp4?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/recordings/crash.mp4`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`, then
> forwards the run to the `things` sink.
>
> **`things`**: builds `things:///add?title=...&notes=...&list=Bug%20Triage&when=today`
> and `open`s it. Things 3 picks up the URL and creates a new todo in
> "Bug Triage" scheduled for today, tagged `peepshow,bug,clip`.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the new
> todo so the user can pick it up later.

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

> **Transcript handling**: only the first transcript segment becomes a snippet in the notes body, capped at 280 chars. Things' notes field is plain text and not great for long bodies — keep the prefix concise and use the underlying frame folder for full review.

*Full list + links: [docs/sinks/README.md](./README.md).*
