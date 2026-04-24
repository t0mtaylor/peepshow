# peepshow-sink-logseq

<!-- gif:sink:logseq -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/logseq.gif" alt="peepshow → logseq demo" width="720">
</p>
<!-- /gif:sink:logseq -->


Writes a per-run markdown page into a [Logseq](https://logseq.com/) graph's `pages/` directory. The page has top-level `key:: value` properties (Logseq's frontmatter equivalent), a "Run summary" block tree, and a "Frames" block tree with image embeds. Frames are copied into the graph's `assets/` directory by default so Logseq can render them inline without extra configuration.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `LOGSEQ_GRAPH_DIR` | yes | — | absolute path to the Logseq graph directory (the folder containing `pages/`, `journals/`, `assets/`) |
| `LOGSEQ_SUBDIR` | no | `peepshow` | subfolder under `pages/` where the note lands |
| `LOGSEQ_COPY` | no | `1` | `0` / `no` / `false` keeps frames outside the graph and embeds absolute paths |

## Use

```bash
export LOGSEQ_GRAPH_DIR=~/logseq/brain
peepshow sinks add logseq
peepshow ./video.mp4
```

## Layout

```
<graph>/
  pages/
    peepshow/
      20260422-124857-the-heist.md       # page with frontmatter + block tree
  assets/
    peepshow/
      20260422-124857-the-heist/          # per-run folder prevents name collisions
        frame_0001.jpg
        frame_0002.jpg
```

## Page body

```markdown
title:: peepshow run — The Heist
type:: peepshow
strategy:: scene
frames:: 12
codec:: h264
duration-s:: 42
resolution:: 1920x1080
director:: Kubrick
studio:: Warner

- **Run summary**
  - Strategy: scene
  - Frames: 12
  - Codec: h264
  - Duration: 42s
  - Resolution: 1920x1080
  - Director: Kubrick
  - Studio: Warner
- **Frames**
  - ![](../assets/peepshow/20260422-124857-the-heist/frame_0001.jpg)
  - ![](../assets/peepshow/20260422-124857-the-heist/frame_0002.jpg)
```

## Caveats

- Logseq treats the initial contiguous `key:: value` lines as page properties; the bullet list below becomes the block tree.
- Property keys are sanitised (non-`[\w-]` → `-`) so tags like `com.apple.quicktime.title` round-trip safely.
- With `LOGSEQ_COPY=0`, Logseq must be able to reach the absolute `frame.path` on disk — on mobile / synced graphs the default (copy) is safer.
- Page filenames are timestamp-prefixed so repeated runs of the same video never clobber each other; the title property still carries the human-readable name.

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
export LOGSEQ_GRAPH_DIR="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add logseq
# Optional: only fire for matching inputs
peepshow sinks add logseq --when extension=mp4,mov
peepshow sinks add logseq --when director=Kubrick
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
> then forwards the run to the `Logseq` sink.
>
> **`Logseq`**: writes a Logseq page with `key:: value` properties and a Frames block tree, copying frames into the graph's `assets/`.
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
