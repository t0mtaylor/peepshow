# peepshow-sink-granola

<!-- gif:sink:granola -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/granola.gif" alt="peepshow → granola demo" width="720">
</p>
<!-- /gif:sink:granola -->


Drop every peepshow run straight into [Granola](https://granola.ai) — the
AI meeting-notes desktop app — as a self-contained markdown bundle. Each
run produces a `<run-id>/note.md` file plus a `frames/` subdir, in a
configurable import directory, ready to drag into Granola or paste
through its editor.

## How peepshow gets data into Granola

Granola's [public API](https://docs.granola.ai/introduction) is
**read-only** at the time of writing — `GET /v1/notes`,
`GET /v1/notes/:id`, and `GET /v1/folders`. No public endpoint creates a
note. The community wrapper at
[`getprobo/reverse-engineering-granola-api`](https://github.com/getprobo/reverse-engineering-granola-api)
is archived; it only ever exposed reads either.

This sink takes the practical path: it writes a markdown bundle into a
Granola **import directory** (`~/Documents/Granola Imports/` by default).
Drag the run folder into Granola, or open `note.md` and paste — the
markdown is shaped to render cleanly inside Granola's editor.

When Granola ships a write endpoint, this sink will swap the file-drop
path for an HTTP POST without touching the markdown formatter. Set
`GRANOLA_API_KEY` today and the note records its presence in the bundle
so you remember to switch over once the upstream API supports it.

## Bundle layout

```
<GRANOLA_IMPORT_DIR>/
└── <run-id>/
    ├── note.md              # heading, metadata, transcript, frame refs
    ├── frame_0001.jpg       # copies of every extracted frame
    ├── frame_0002.jpg
    └── …
```

`note.md` contains:

- `# <title>` — taken from `video.tags.title`, then `video.tags.show`,
  falling back to `peepshow run`. `GRANOLA_TITLE_PREFIX` prepends a
  marker.
- `## Meeting details` — source run id, capture timestamp, duration,
  resolution, codec, container, frame count.
- `## Container tags` — every `video.tags` entry other than `title` /
  `show` (handy for director, studio, project, custom metadata).
- `## Transcript` — one bullet per segment with `[HH:MM:SS → HH:MM:SS]`
  timestamps and the speaker label when present. Falls back to the flat
  `transcript.text` body when no segments are available.
- `## Frames` — one `### Frame N` heading per frame with an inline
  `![Frame N](frames/frame_NNNN.jpg)` image reference.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `GRANOLA_IMPORT_DIR` |   | `~/Documents/Granola Imports` | Absolute path to the import directory. Created on first write. |
| `GRANOLA_TITLE_PREFIX` |   | — | Prepended to every note title — useful for distinguishing peepshow imports from real meetings (e.g. `peepshow: `). |
| `GRANOLA_COPY_FRAMES` |   | `1` | Set `0` to embed frames by absolute path instead of copying them into the bundle. |
| `GRANOLA_API_KEY` |   | — | Reserved for the future Granola write endpoint. When set, the note records its presence; the sink still uses the file-drop path until the upstream API supports note creation. |

## Exit codes

| 0 | Bundle written. |
| 4 | stdin malformed. |
| 5 | Failed to create import dir / copy a frame / write `note.md`. |

## Use

```bash
peepshow sinks add granola
peepshow ./standup.mp4
# → ~/Documents/Granola Imports/peepshow-run-2026….: note.md + frames/
```

Custom dir + title prefix:

```bash
export GRANOLA_IMPORT_DIR="$HOME/Granola Imports"
export GRANOLA_TITLE_PREFIX="peepshow: "
peepshow ./review.mp4 --sink granola
```

Skip the frame copies (useful when the run output dir is already on
fast local storage):

```bash
GRANOLA_COPY_FRAMES=0 peepshow ./review.mp4 --sink granola
```

## Caveats

- Granola has **no public write API** yet. This sink writes a markdown
  bundle ready for manual / drag-drop import. Track upstream progress at
  [`docs.granola.ai/introduction`](https://docs.granola.ai/introduction).
- Granola's clipboard parser handles GitHub-flavoured markdown cleanly
  but does **not** reliably honour `---` YAML frontmatter. peepshow
  renders metadata as bullets so paste-from-clipboard works the same as
  drag-drop import.
- Very long titles are clamped to 200 characters before being written
  into the heading. The underlying ProseMirror schema in Granola can
  handle longer, but the in-app rendering gets cramped.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH`
and the sink's env vars in the shell it runs under.

### 1. Set the environment (optional)

The defaults work out-of-the-box on macOS — `~/Documents/Granola Imports`
is created on first write. To override:

```sh
export GRANOLA_IMPORT_DIR="$HOME/Documents/Granola Imports"
export GRANOLA_TITLE_PREFIX="peepshow: "
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add granola
# Optional: only fire for matching inputs
peepshow sinks add granola --when extension=mp4,mov,m4v
peepshow sinks add granola --when project=meetings
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a recording of yesterday's product review into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/Recordings/review.mp4`. peepshow
> extracts frames + audio, transcribes locally if `whisper.cpp` is on
> `PATH`, then forwards the run to the `Granola` sink.
>
> **`Granola`**: writes `~/Documents/Granola Imports/<run-id>/note.md`
> with the run title, container metadata, timestamped transcript
> segments, and frame thumbnails. The frames are copied into the same
> folder so the bundle is self-contained.
>
> **You**: drag the folder into Granola, or open `note.md` and paste —
> Granola renders the bundle as a fresh note, ready to enrich with
> follow-up tasks or AI summaries.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director / studio
  / project / title etc).
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence
  ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`,
  language — populated when transcription is enabled (v0.4.0+).
- `extraction` — strategy, thresholds, ffmpeg path used.

> **Transcript handling**: when `audio.transcript.segments[]` is
> populated, each segment renders as a timestamped bullet with the
> speaker label (when known). When segments are empty but `text` is
> present, the raw transcript body is rendered as a paragraph. Granola
> users can layer their AI summary on top once the note is imported.
