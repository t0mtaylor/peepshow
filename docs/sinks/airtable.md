# peepshow-sink-airtable

<!-- gif:sink:airtable -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/airtable.gif" alt="peepshow → airtable demo" width="720">
</p>
<!-- /gif:sink:airtable -->


Create one record per peepshow run in an [Airtable](https://airtable.com)
base via `POST /v0/<baseId>/<tableId>`. Airtable is the
spreadsheet-as-database service teams use for lightweight CRMs, content
pipelines, and structured logs — this sink fits peepshow runs into that
same flat, queryable, stakeholder-friendly model.

Columns must exist on the table (Airtable's API doesn't auto-create
schema). The sink writes:

| Column | Type | Source |
|--------|------|--------|
| `Run ID` | Single-line text | basename of `outputDir` |
| `Title` | Single-line text | `video.tags.title` / `video.tags.show` / fallback |
| `Frames` | Number | `frames.length` |
| `Duration` | Number | `video.durationSeconds` (0 when null) |
| `Transcript` | Long text | `audio.transcript.text` when available |
| `Thumbnail URL` | URL | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when the env is set |
| `Created At` | Date / Date-time | ISO timestamp at the moment the record is created |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `AIRTABLE_API_KEY` | ✓ | — | Personal access token. Generate at [airtable.com/create/tokens](https://airtable.com/create/tokens) with `data.records:write` scope. |
| `AIRTABLE_BASE_ID` | ✓ | — | Base id (starts with `app`). Find it in the API docs URL for your base. |
| `AIRTABLE_TABLE_ID` | * | — | Table id (starts with `tbl`). Preferred — survives table renames. |
| `AIRTABLE_TABLE_NAME` | * | — | Human-readable table name. Used when `AIRTABLE_TABLE_ID` is unset. |
| `AIRTABLE_API_URL` |   | `https://api.airtable.com` | Override for self-hosted / proxied endpoints. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `Thumbnail URL` column. |

\* One of `AIRTABLE_TABLE_ID` / `AIRTABLE_TABLE_NAME` is required.

## Exit codes

| 0 | Record created. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Airtable returned non-2xx (e.g. unknown column, invalid token), or the request failed at the network layer. |

## Create the table

In Airtable, add a new table (or use an existing one) with these
columns. Type names are case-sensitive on the Airtable side:

- `Run ID` — *Single line text*
- `Title` — *Single line text*
- `Frames` — *Number* (precision 0)
- `Duration` — *Number* (precision 1)
- `Transcript` — *Long text*
- `Thumbnail URL` — *URL*
- `Created At` — *Date* (with time)

Then grab the table id (`tbl…`) from the
[Airtable API docs](https://airtable.com/developers/web/api/introduction)
for your base — it appears in the URL when you select the table.

## Use

```bash
export AIRTABLE_API_KEY="patXXXXXXXXXXXXXX"
export AIRTABLE_BASE_ID="appXXXXXXXXXXXXXX"
export AIRTABLE_TABLE_ID="tblXXXXXXXXXXXXXX"
peepshow sinks add airtable
peepshow ./demo.mp4
```

With thumbnail URLs:

```bash
export PEEPSHOW_FRAME_BASE_URL="https://cdn.example.com/runs/abc"
peepshow ./demo.mp4
```

## Caveats

- Airtable's REST quota is generous (5 req/sec per base) but not infinite — heavy peepshow loads should batch via `webhook` → Airtable Automations instead.
- The token in `AIRTABLE_API_KEY` is base-scoped; create a separate token per base if you want fine-grained revocation.

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
export AIRTABLE_API_KEY="patXXXXXXXXXXXXXX"
export AIRTABLE_BASE_ID="appXXXXXXXXXXXXXX"
export AIRTABLE_TABLE_ID="tblXXXXXXXXXXXXXX"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add airtable
# Optional: only fire for matching inputs
peepshow sinks add airtable --when extension=mp4,mov
peepshow sinks add airtable --when project=demos
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
> then forwards the run to the `Airtable` sink.
>
> **`Airtable`**: creates one record in the configured base + table with
> Run ID, Title, Frames, Duration, Transcript, Thumbnail URL, and a
> Created At timestamp. Airtable views, automations, and interfaces pick
> the row up immediately.
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

> **Transcript handling**: full transcript text lands in the `Transcript`
> long-text column. Airtable caps long-text fields at 100,000 characters —
> very long transcripts will be truncated by Airtable on the server side.
