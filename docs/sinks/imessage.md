# peepshow-sink-imessage

<!-- gif:sink:imessage -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/imessage.gif" alt="peepshow → iMessage demo" width="720">
</p>
<!-- /gif:sink:imessage -->


Send a peepshow run through macOS **Messages.app** to a named buddy or group over **iMessage** (or SMS, if your Mac is paired with an iPhone). One bubble carries a short metadata summary (title, director tag, duration, frame count, optional transcript snippet); each extracted frame follows as a separate image attachment up to `IMESSAGE_MAX_FRAMES`.

Under the hood this sink pipes an AppleScript `tell application "Messages"` block into `osascript -`. No API keys, no network config — it uses whatever Apple ID / phone number Messages.app is already signed into.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

Then register it as an auto-sink so every run pings a teammate:

```bash
IMESSAGE_BUDDY="+15551234567" peepshow sinks add imessage
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `IMESSAGE_BUDDY` | ✓ | — | Phone number (`+15551234567`) or email address of the recipient. Groups work via the group identifier. |
| `PEEPSHOW_IMESSAGE_BUDDY` | — | — | Alias for `IMESSAGE_BUDDY`. Wins when both are set. |
| `IMESSAGE_SERVICE` | — | `iMessage` | `iMessage` or `SMS`. Case-insensitive. |
| `IMESSAGE_MAX_FRAMES` | — | `4` | Cap on attached frames to avoid flooding a conversation. Negative values clamp to `0`. |
| `IMESSAGE_ALLOW_NON_DARWIN` | — | — | `1` / `true` / `yes` to attempt on non-macOS platforms (useful for CI dry-runs). |

## Platform behaviour

Messages.app is macOS-only. On non-darwin platforms the sink exits **0** with a stderr note:

```
peepshow-sink-imessage: skipping — macOS only (set IMESSAGE_ALLOW_NON_DARWIN=1 to force)
```

This keeps cross-platform CI green when the sink is registered globally.

## Permissions

On first run, macOS will prompt:

1. **Automation permission** for your shell / terminal to control Messages.
2. Possibly **Full Disk Access** for the terminal, depending on OS version.

Grant both in **System Settings → Privacy & Security → Automation** (and **Full Disk Access**). Once granted, subsequent runs are silent.

## What gets sent

1. A text bubble with the one-line summary:

   ```
   The Heist — dir. Kubrick — 4 frames · 1:12 · strategy: scene
   ```

   A short transcript snippet is appended when whisper has produced segments:

   ```
   The Heist — … — "here's the crash replay we talked about"
   ```

2. Up to `IMESSAGE_MAX_FRAMES` image bubbles, one per frame, in chronological order.

## AppleScript shape

The script is built as a pure function and piped into `osascript -`:

```applescript
tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "+15551234567" of targetService
  send "The Heist — dir. Kubrick — 4 frames · 1:12 · strategy: scene" to targetBuddy
  send (POSIX file "/abs/path/frame_0001.jpg") to targetBuddy
  send (POSIX file "/abs/path/frame_0002.jpg") to targetBuddy
end tell
```

Double-quotes inside titles / transcripts / buddy identifiers are escaped as `\"` before interpolation so AppleScript's string parser never closes early.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Summary + frames accepted by Messages.app (or skipped silently on non-darwin). |
| 2 | `IMESSAGE_BUDDY` missing, invalid `IMESSAGE_SERVICE`, or bad `IMESSAGE_MAX_FRAMES`. |
| 3 | `osascript` not found on PATH. |
| 4 | stdin malformed. |
| 5 | `osascript` exited non-zero (permission denied, buddy unreachable, Messages.app not signed in, etc). |

## Caveats

- Messages.app must be open and signed in to an iMessage / SMS account for the send to succeed.
- Group chats: pass the group's address book identifier. Apple's AppleScript dictionary exposes them as `buddy`-shaped references — list them with `tell application "Messages" to get id of every chat`.
- SMS only works when the Mac is paired with an iPhone via the "Text Message Forwarding" setting.
- Per-conversation rate limiting isn't handled — keep `IMESSAGE_MAX_FRAMES` modest (default `4`) when auto-sinking to a human.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export IMESSAGE_BUDDY="+15551234567"    # or "teammate@example.com"
# Optional overrides:
export IMESSAGE_SERVICE="iMessage"      # or "SMS"
export IMESSAGE_MAX_FRAMES="4"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add imessage
# Optional: only fire for matching inputs
peepshow sinks add imessage --when extension=mp4,mov
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `bug.mov` into Claude Code (or ask
> "what's in ~/bugs/crash.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/crash.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `iMessage` sink.
>
> **`iMessage`**: sends a summary bubble + the first four frames to
> your paired buddy. They reply from their phone with "yep looks like
> the crash we fixed in #4712".
>
> **Claude Code**: reads the frames back as images locally, combines
> them with the audio transcript, and writes the bug note into Linear.

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

> **Transcript handling**: the first transcript segment rides along as a short snippet inside the summary bubble; the full transcript stays on disk next to the frames for downstream sinks.

*Full list + links: [docs/sinks/README.md](./README.md).*
