# peepshow-sink-notion

<!-- gif:sink:notion -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/notion.gif" alt="peepshow → notion demo" width="720">
</p>
<!-- /gif:sink:notion -->


Creates a Notion page per peepshow run inside a database you control. Populates common columns (Name, Duration, Strategy, Codec, Director, Genre) opportunistically — Notion ignores properties the database doesn't know about, so the sink stays compatible with any schema.

## Install

No extra npm packages needed — uses the fetch API against Notion's public REST endpoint.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `NOTION_TOKEN` | yes | — | internal integration token (`secret_...` or `ntn_...`) |
| `NOTION_DATABASE_ID` | yes | — | parent database UUID |
| `NOTION_VERSION` | no | `2022-06-28` | API version header |

## Setup

1. In Notion, create a database for peepshow runs.
2. Go to **Settings → Connections → Develop or manage integrations → New internal integration** — copy the token.
3. In the database, open **Share → Connections → add your integration**.
4. Copy the database URL; the UUID portion is `NOTION_DATABASE_ID`.

## Use

```bash
export NOTION_TOKEN=ntn_xxx
export NOTION_DATABASE_ID=abcd1234...
peepshow sinks add notion
peepshow ./video.mp4
```

## What gets written

**Page properties** — populated when the corresponding tag / metadata is present:

- `Name` ← `video.tags.title` (fallback: `video.tags.show`, then "peepshow run")
- `Duration (s)` ← `video.durationSeconds`
- `Strategy` ← `scene` | `fps`
- `Codec` ← `video.codec`
- `Director` ← `video.tags.director`
- `Genre` ← `video.tags.genre`

**Page body:**

- Summary paragraph (frame count + resolution + codec + duration)
- **Metadata** bulleted list — every `video.tags.<k>` pair
- **Frames** section — inline image blocks for `http(s)://` frame paths, paragraph with file path otherwise

## Caveats

- Local file paths can't be embedded as Notion images (the API only accepts external URLs). Pair with [`s3`](./s3.md) and Notion will render the uploaded frames inline.
- Notion rate-limits at ~3 req/s per integration — fine for peepshow's once-per-video cadence.

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
export NOTION_TOKEN="…"
export NOTION_DATABASE_ID="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add notion
# Optional: only fire for matching inputs
peepshow sinks add notion --when extension=mp4,mov
peepshow sinks add notion --when director=Kubrick
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
> then forwards the run to the `Notion` sink.
>
> **`Notion`**: creates one rich Notion page per run inside a database — metadata as properties, frames embedded inline.
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
