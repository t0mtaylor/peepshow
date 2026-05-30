# peepshow-sink-algolia

<!-- gif:sink:algolia -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/algolia.gif" alt="peepshow → algolia demo" width="720">
</p>
<!-- /gif:sink:algolia -->


Index one record per peepshow run into an [Algolia](https://www.algolia.com)
index via `POST https://<appId>-dsn.algolia.net/1/indexes/<index>`. Algolia is
the hosted typo-tolerant search service most consumer dashboards run on — this
sink fits peepshow runs into the same instant-search experience your product
content already has.

The `objectID` is pinned to the peepshow run id, so re-running the same
extraction overwrites the existing record rather than appending a duplicate.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

No SDK required — the sink posts to Algolia's REST API over `fetch`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ALGOLIA_APP_ID` | ✓ | — | Application id (10 chars, e.g. `ABCD1234EF`). Find it under **API Keys** in the Algolia dashboard. |
| `ALGOLIA_API_KEY` | ✓ | — | Admin (or write-scoped) API key. Sent as `X-Algolia-API-Key`. Never use the public search-only key. |
| `ALGOLIA_INDEX` |   | `peepshow_runs` | Index name. Auto-created on first write. |
| `ALGOLIA_HOST` |   | `<appId>-dsn.algolia.net` | Override the host. Useful for regional or analytics clusters. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` field. |

## Record shape

Each peepshow run becomes one Algolia record with this stable shape:

```json
{
  "objectID":       "peepshow-run-abc",
  "run_id":         "peepshow-run-abc",
  "title":          "The Heist",
  "frames":         2,
  "duration":       12.5,
  "transcript":     "…full whisper transcript…",
  "thumbnail_url":  "https://cdn.example.com/runs/abc/frame_0001.jpg",
  "strategy":       "scene",
  "tags":           { "director": "Kubrick", "title": "The Heist" },
  "created_at":     "2026-05-27T10:32:00.000Z"
}
```

## Usage

```bash
export ALGOLIA_APP_ID="ABCD1234EF"
export ALGOLIA_API_KEY="$(< ~/.algolia-admin-key)"
peepshow ./demo.mp4 --sink algolia
```

With thumbnails:

```bash
export PEEPSHOW_FRAME_BASE_URL="https://cdn.example.com/runs/abc"
peepshow ./demo.mp4 --sink algolia
```

Register as an auto-sink so every extract indexes itself:

```bash
peepshow sinks add algolia
peepshow ./standup.mov
```

## Exit codes

| 0 | Record indexed. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Algolia returned non-2xx (e.g. invalid key, forbidden index), or the request failed at the network layer. |

## Searchable attributes

Algolia indexes every field by default. For better relevance, mark these as
**searchable attributes** in the Algolia dashboard (Index → Configuration →
Searchable attributes):

- `title` — highest weight, what users will most often search by.
- `transcript` — full-text transcript, populated when whisper is enabled.
- `tags.title`, `tags.show`, `tags.director` — container-tag metadata.

Mark `frames`, `duration`, `created_at` as **unretrievable** if you only
display them in the UI and don't want them to count for search ranking.

## Caveats

- Algolia's write quota varies by plan — bulk peepshow loads should batch via
  the `webhook` sink → an Algolia function rather than POSTing one record at a
  time.
- The admin API key is base-scoped; rotate it from the dashboard if it ever
  leaks. Prefer a dedicated write-only key (created under **All API Keys** →
  *Add API Key*) over the master admin key for CI jobs.
- This sink uses the standard saveObject endpoint (single record per request).
  For very large indexes consider Algolia's `/batch` endpoint instead — file a
  PR if your workflow needs it.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI — Claude
Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell out. The
LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and the sink's
env vars in the shell it runs under.

### 1. Set the environment

```sh
export ALGOLIA_APP_ID="ABCD1234EF"
export ALGOLIA_API_KEY="$(< ~/.algolia-admin-key)"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add algolia
# Optional: only fire for matching inputs
peepshow sinks add algolia --when extension=mp4,mov
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `bug.mov` into Claude Code (or ask "what's in
> `~/bugs/crash.mov`?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/crash.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Algolia` sink.
>
> **`Algolia`**: indexes one record into your configured index with
> `objectID = <run id>`. Re-running the same clip overwrites in place
> instead of duplicating.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary. The bug is now searchable
> alongside every other peepshow run in the Algolia dashboard.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags.
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`, language —
  populated when transcription is enabled (v0.4.0+).
- `extraction` — strategy, thresholds, ffmpeg path used.

> **Transcript handling**: full transcript text lands in the `transcript`
> field. Algolia caps individual record size at 10 KB by default (1 MB on
> request) — very long transcripts may need to be split or stored elsewhere
> with a pointer in `thumbnail_url`.
