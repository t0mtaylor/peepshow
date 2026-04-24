# peepshow-sink-ide

Drops peepshow frames into your IDE's workspace attachments folder so you can `@mention` them in the AI chat without leaving the editor. Auto-detects Cursor, Windsurf, Zed, and VS Code / VS Code forks from the environment.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `PEEPSHOW_IDE_DIR` | no | — | explicit target directory; skips detection |
| `PEEPSHOW_IDE_KIND` | no | `auto` | `auto` \| `cursor` \| `windsurf` \| `zed` \| `vscode` |
| `PEEPSHOW_IDE_WORKSPACE` | no | cwd | workspace root to place the attachments folder under |

## Detection rules

Detection uses environment variables the IDE's integrated terminal sets:

| Detected | Env clue |
| :------- | :------- |
| `cursor` | `CURSOR_SESSION` |
| `windsurf` | `WINDSURF_SESSION` |
| `zed` | `ZED_SESSION` or `ZED_HTTP_PORT` |
| `vscode` | `TERM_PROGRAM=vscode` or `VSCODE_IPC_HOOK*` |
| `unknown` | nothing above matched |

Detection is deliberately permissive — `cursor` and `windsurf` take priority over `vscode` since both forks inherit the VS Code env vars.

## Attachment folders

| IDE | Target subdir (under workspace root) |
| :-- | :----------------------------------- |
| `cursor` | `.cursor/attachments/peepshow/` |
| `windsurf` | `.windsurf/attachments/peepshow/` |
| `zed` | `.zed/attachments/peepshow/` |
| `vscode` | `.vscode/attachments/peepshow/` |
| `unknown` | `.peepshow/attachments/` |

## Use

```bash
peepshow sinks add ide         # auto-detect on every run
peepshow ./video.mp4           # in Cursor's integrated terminal
# → .cursor/attachments/peepshow/20260422-124857/frame_0001.jpg
```

Force a specific target:

```bash
peepshow sinks add ide --when PEEPSHOW_IDE_WORKSPACE=$PWD   # won't work, use env instead:
export PEEPSHOW_IDE_DIR="$PWD/.peepshow/clips"
```

## Manifest

Each run also writes `peepshow.json` alongside the frames — full `--emit json` payload so the AI assistant can read video metadata, tags, and extraction stats without re-running peepshow.

## Caveats

- IDE detection is env-based. If your shell doesn't inherit the IDE's env (e.g. `tmux` started outside the IDE), set `PEEPSHOW_IDE_KIND` explicitly.
- VS Code / Cursor / Windsurf don't auto-pick up new attachments today — you may need to reload the workspace or reference the file path directly in chat.

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
# ide has no required env vars — it writes into the editor's attachment folder.
peepshow --sink ide
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add ide
# Optional: only fire for matching inputs
peepshow sinks add ide --when extension=mp4,mov
peepshow sinks add ide --when director=Kubrick
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
> then forwards the run to the `IDE attachments` sink.
>
> **`IDE attachments`**: copies frames into your editor's attachment directory (Cursor · Windsurf · Zed · VS Code) so you can drag them into a chat without uploads.
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
