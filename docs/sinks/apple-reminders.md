# peepshow-sink-apple-reminders

<!-- gif:sink:apple-reminders -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/apple-reminders.gif" alt="peepshow → Apple Reminders demo" width="720">
</p>
<!-- /gif:sink:apple-reminders -->

File every peepshow run as a **todo task** in **Apple Reminders** on macOS. The sink builds a plain-text body (run summary, frame paths, transcript snippet), drives `osascript -` with a generated AppleScript program, and creates a new reminder in the list of your choice — optionally with a due date.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

Register as an auto-sink so every run lands in Reminders automatically:

```bash
peepshow sinks add apple-reminders
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `APPLE_REMINDERS_LIST` | — | `Reminders` | List name inside Reminders.app to file under. |
| `PEEPSHOW_APPLE_REMINDERS_LIST` | — | — | Alias for `APPLE_REMINDERS_LIST`. Wins when both are set. |
| `APPLE_REMINDERS_TITLE` | — | — | Override the derived reminder name. |
| `APPLE_REMINDERS_DUE_HOURS` | — | — | Integer hours from "now" to set as the reminder's due date. Unset → no due date. Non-integer values fail with exit 2. |
| `APPLE_REMINDERS_ALLOW_NON_DARWIN` | — | — | Set to `1` to force-run on non-darwin platforms (CI / debug). |

## Platform behaviour

Apple Reminders is macOS-only. On Linux or Windows the sink **skips silently** (exit 0) with a stderr note, unless `APPLE_REMINDERS_ALLOW_NON_DARWIN=1` is set — useful for unit testing the script generation in CI without a real Reminders.app.

## What gets written

One new reminder per run, with:

- **Name** — from `APPLE_REMINDERS_TITLE`, else `video.tags.title`, else `video.tags.show`, else `peepshow — <UTC stamp>`.
- **Body** (plain text, no HTML — Reminders won't render markup):
  - Run summary line: strategy, frame count, duration, resolution, codec, container.
  - Tags block — every entry in `video.tags` (`director`, `studio`, any container metadata peepshow surfaces).
  - Frames block — absolute path to each extracted frame.
  - Transcript block — first 6 transcript segments (`mm:ss text`), with a `(N more)` tail when truncated.
- **Due date** — only set when `APPLE_REMINDERS_DUE_HOURS` is configured. Negative values are accepted (past-due reminders).

> **Plain text only.** Unlike Notes, Reminders bodies don't accept HTML. The sink emits raw text — `&`, `<`, `>`, `"` survive verbatim and the body reads naturally in Reminders.app and in iOS Reminders.

## AppleScript shape

The generated program looks like this:

```applescript
tell application "Reminders"
  tell list "Watch later"
    set theDueDate to (current date)
    set year of theDueDate to 2026
    set month of theDueDate to 4
    set day of theDueDate to 24
    set hours of theDueDate to 13
    set minutes of theDueDate to 30
    set seconds of theDueDate to 0
    make new reminder with properties {name:"The Heist", body:"...", due date:theDueDate}
  end tell
end tell
```

When `APPLE_REMINDERS_DUE_HOURS` is unset, the `set theDueDate` block is omitted and the reminder is created without a due date.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Wrote the reminder (or skipped silently on non-darwin). |
| 2 | Bad config (`APPLE_REMINDERS_DUE_HOURS` not an integer). |
| 3 | `osascript` not on PATH. |
| 4 | stdin malformed. |
| 5 | osascript exited non-zero. |

## Caveats

- Reminders.app must be installed and have consented to Automation access for the controlling process on first run — you'll see a macOS permission prompt the first time the sink fires. Approve it once.
- The sink **always creates a new reminder**. Updating an existing reminder by name is deferred pending a clean story for deduplication.
- Sandboxed environments (Homebrew services running under a different user, some CI runners) will fail with an Automation-denied error; in that case, either run peepshow under your GUI user or set `APPLE_REMINDERS_ALLOW_NON_DARWIN=1` on a non-macOS host.
- Frame paths are referenced as **absolute file paths** in the body — if you move the output folder after the reminder is created, the paths still display but won't resolve when clicked.
- iCloud-synced reminders propagate to iOS / iPadOS / watchOS for free — useful as a "things to revisit" inbox across devices.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

Defaults work on macOS with no config. Optional overrides:

```sh
export APPLE_REMINDERS_LIST="Watch later"
export APPLE_REMINDERS_DUE_HOURS=24      # follow-up tomorrow
```

### 2. Register as an auto-sink

```sh
peepshow sinks add apple-reminders
# Optional: only fire for matching inputs
peepshow sinks add apple-reminders --when extension=mp4,mov
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code (or ask
> "what's in ~/lectures/2026-04-24.mp4?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/lectures/2026-04-24.mp4`. peepshow
> extracts frames + audio, transcribes locally if `whisper.cpp` is on
> `PATH`, then forwards the run to the `apple-reminders` sink.
>
> **`apple-reminders`**: creates a new reminder in the configured list
> with the title, plain-text run summary, frame paths, transcript
> snippet, and (optionally) a due date.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream task.

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

> **Transcript handling**: the first 6 transcript segments are inlined
> in the body with `mm:ss` prefixes; longer transcripts are summarised
> with a `(N more)` tail so the reminder stays scannable in the
> Reminders sidebar.

*Full list + links: [docs/sinks/README.md](./README.md).*
