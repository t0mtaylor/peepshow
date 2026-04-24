# peepshow-sink-obsidian

<!-- gif:sink:obsidian -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/obsidian.gif" alt="peepshow → obsidian demo" width="720">
</p>
<!-- /gif:sink:obsidian -->


Writes a per-run markdown note into an Obsidian vault with YAML frontmatter (containing every video tag), a metadata bullet list, and frame embeds. Copies frame JPGs into the vault so they render inline without external paths.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `PEEPSHOW_OBSIDIAN_VAULT` | yes | — | absolute path to the vault root |
| `PEEPSHOW_OBSIDIAN_SUBDIR` | no | `peepshow` | folder within the vault for notes + frames |
| `PEEPSHOW_OBSIDIAN_COPY` | no | `1` | `0` to keep frames outside the vault and use absolute markdown links |

## Use

```bash
export PEEPSHOW_OBSIDIAN_VAULT=~/Documents/Obsidian/Brain
peepshow sinks add obsidian
peepshow ./video.mp4
```

## Layout

```
<vault>/
  peepshow/
    20260422-124857-the-heist.md          # note with frontmatter + embeds
    frames/
      20260422-124857-the-heist/
        frame_0001.jpg
        frame_0002.jpg
```

## Note body

```markdown
---
source: peepshow
strategy: scene
duration: 42
resolution: "1920x1080"
codec: h264
container: mov
frames: 12
title: "The Heist"
director: "Kubrick"
genre: "Thriller"
---

# The Heist

- **strategy:** scene
- **frames:** 12 emitted, 0 pruned
- **duration:** 42.00s
- **resolution:** 1920×1080
- **codec:** h264
- **ffmpeg:** system (/opt/homebrew/bin/ffmpeg)

## Frames

### Frame 1

![[peepshow/frames/20260422-124857-the-heist/frame_0001.jpg]]

### Frame 2

![[peepshow/frames/20260422-124857-the-heist/frame_0002.jpg]]
```

## Caveats

- Uses Obsidian's wiki-link embed syntax (`![[path]]`). Works in desktop, mobile, and Obsidian Publish.
- Frontmatter keys are sanitised (non-`[\w-]` becomes `_`) so even tags like `com.apple.quicktime.title` round-trip safely.
- With `PEEPSHOW_OBSIDIAN_COPY=0`, Obsidian may not reach paths outside the vault on mobile devices — use the default on shared vaults.

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
export PEEPSHOW_OBSIDIAN_VAULT="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add obsidian
# Optional: only fire for matching inputs
peepshow sinks add obsidian --when extension=mp4,mov
peepshow sinks add obsidian --when director=Kubrick
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
> then forwards the run to the `Obsidian` sink.
>
> **`Obsidian`**: writes a markdown note with YAML frontmatter into your vault and copies the frames alongside so they render inline.
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

> **Transcript handling**: the transcript is inserted into the created page body alongside the frame gallery, so the written record is searchable in the same tool.
