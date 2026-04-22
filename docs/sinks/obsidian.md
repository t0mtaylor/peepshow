# peepshow-sink-obsidian

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
