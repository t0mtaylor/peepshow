# peepshow-sink-coda

<!-- gif:sink:coda -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/coda.gif" alt="peepshow → coda demo" width="720">
</p>
<!-- /gif:sink:coda -->


Create one row per peepshow run in a [Coda](https://coda.io) doc table
via `POST /apis/v1/docs/<docId>/tables/<tableId>/rows`. Coda blends a
doc, spreadsheet, and database into one canvas — this sink fits peepshow
runs into that same flat, queryable, stakeholder-friendly model.

Columns must exist on the table (Coda's API doesn't auto-create schema).
The sink writes:

| Column | Type | Source |
|--------|------|--------|
| `Run ID` | Text | basename of `outputDir` |
| `Title` | Text | `video.tags.title` / `video.tags.show` / fallback |
| `Frames` | Number | `frames.length` |
| `Duration` | Number | `video.durationSeconds` (0 when null) |
| `Transcript` | Text | `audio.transcript.text` when available |
| `Thumbnail URL` | URL | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when the env is set |
| `Created At` | Date / Date-time | ISO timestamp at the moment the row is created |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `CODA_API_KEY` | ✓ | — | Coda API token. Generate at [coda.io/account](https://coda.io/account). |
| `CODA_DOC_ID` | ✓ | — | Doc id — the segment after `_d` in the doc URL. For `https://coda.io/d/My-Doc_dXYZ123` use `XYZ123`. |
| `CODA_TABLE_ID` | * | — | Table id (preferred — survives renames). Find via `GET /docs/<doc>/tables`. |
| `CODA_TABLE_NAME` | * | — | Human-readable table name. Used when `CODA_TABLE_ID` is unset. |
| `CODA_API_URL` |   | `https://coda.io` | Override for self-hosted / proxied endpoints. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `Thumbnail URL` column. |

\* One of `CODA_TABLE_ID` / `CODA_TABLE_NAME` is required.

## Exit codes

| 0 | Row created (Coda returns `202` — the row is enqueued and will appear within seconds). |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Coda returned non-2xx (e.g. unknown column, invalid token), or the request failed at the network layer. |

## Create the table

In your Coda doc, add a new table (or use an existing one) with these
columns. Type names are case-sensitive on the Coda side:

- `Run ID` — *Text*
- `Title` — *Text*
- `Frames` — *Number*
- `Duration` — *Number* (2 decimals is fine — Coda formats per-column)
- `Transcript` — *Text* (or *Markdown* if you want rendered formatting)
- `Thumbnail URL` — *Link* (or *Image* if you want Coda to render it)
- `Created At` — *Date/Time*

Grab the table id by calling `GET /apis/v1/docs/<docId>/tables` with
your API key — the response includes each table's `id`.

## Use

```bash
export CODA_API_KEY="codaKEYxxxxxxxxxxxxxxxxxxxxxxxx"
export CODA_DOC_ID="abc123XYZ"
export CODA_TABLE_ID="grid-xxxxxxxx"
peepshow sinks add coda
peepshow ./demo.mp4
```

With thumbnail URLs:

```bash
export PEEPSHOW_FRAME_BASE_URL="https://cdn.example.com/runs/abc"
peepshow ./demo.mp4
```

## Caveats

- Coda's row-insert is async — the API returns `202 Accepted` and the
  row materialises a few seconds later. Don't expect it to be queryable
  immediately after the sink exits.
- API tokens are doc-scoped or workspace-scoped depending on how they're
  generated; for least-privilege, create a separate token per doc.
- The `Transcript` text column has no hard cap on the Coda side, but
  very long transcripts may slow down doc rendering — pair with
  `airtable` / `notion` / a `webhook` if you want a separate long-form
  archive.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export CODA_API_KEY="codaKEYxxxxxxxxxxxxxxxxxxxxxxxx"
export CODA_DOC_ID="abc123XYZ"
export CODA_TABLE_ID="grid-xxxxxxxx"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add coda
# Optional: only fire for matching inputs
peepshow sinks add coda --when extension=mp4,mov
```

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards
> the run to the `Coda` sink.
>
> **`Coda`**: appends one row to the configured doc + table with
> Run ID, Title, Frames, Duration, Transcript, Thumbnail URL, and a
> Created At timestamp. Coda automations + packs pick the row up
> immediately.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream row.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director / studio
  / title etc).
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence
  ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`,
  language.
- `extraction` — strategy, thresholds, ffmpeg path used.

> **Transcript handling**: full transcript text lands in the `Transcript`
> column. Coda has no hard cap on text columns server-side, but very
> long transcripts will slow down doc rendering — consider an `airtable`
> / `webhook` mirror for long-form retention.
