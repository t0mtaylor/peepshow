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
