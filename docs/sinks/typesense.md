# peepshow-sink-typesense

Upsert one document per peepshow run into a
[Typesense](https://typesense.org) collection. Typesense is the
open-source typo-tolerant search engine with built-in hybrid (keyword +
vector) search — sub-50ms queries from a single binary or a managed
Typesense Cloud cluster.

On first run the sink soft-creates the collection (probes with `GET
/collections/<name>`; if 404, `POST /collections` with the schema
below). On every run it `POST .../documents?action=upsert`s a single
document keyed on `id == run_id`, so re-running the same peepshow run
replaces the existing row rather than 409ing.

| Field | Type | Source |
|-------|------|--------|
| `id` | string | basename of `outputDir` — Typesense identity field |
| `run_id` | string | same as `id`, indexed independently |
| `title` | string | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | int32 | `frames.length` |
| `duration` | float | `video.durationSeconds` (0 when null) |
| `transcript` | string | `audio.transcript.text` when available |
| `thumbnail_url` | string | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env set |
| `strategy` | string (facet) | `"scene"` or `"fps"` |
| `created_at` | int32 | epoch seconds — default sorting field |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `TYPESENSE_URL` | ✓ | — | Base URL of the Typesense node / cluster, e.g. `http://localhost:8108`. |
| `TYPESENSE_API_KEY` | ✓ | — | Admin / write key. Sent in `X-TYPESENSE-API-KEY` header. |
| `TYPESENSE_COLLECTION` |   | `peepshow_runs` | Collection name. Soft-created on first write. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to `thumbnail_url`. |

## Exit codes

| 0 | Document upserted. |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | Typesense returned non-2xx (auth failure, schema conflict), or the request failed at the network layer. |

## Use

```bash
# Start Typesense locally
docker run -p 8108:8108 -v /tmp/typesense-data:/data \
  typesense/typesense:latest \
  --data-dir /data --api-key=xyz --enable-cors

export TYPESENSE_URL="http://localhost:8108"
export TYPESENSE_API_KEY="xyz"
peepshow sinks add typesense
peepshow ./demo.mp4
```

Query the indexed runs (curl):

```bash
curl "$TYPESENSE_URL/collections/peepshow_runs/documents/search?q=heist&query_by=title,transcript" \
  -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY"
```

To enable semantic search, add a vector field to the schema after
creation — Typesense supports server-side embedding with OpenAI, Cohere,
or local models. See
[Typesense's hybrid search docs](https://typesense.org/docs/latest/api/vector-search.html).

## Caveats

- The schema is created from a small fixed shape. If you need more
  fields, edit the collection schema in Typesense directly (Typesense
  allows schema evolution on existing collections via
  `PATCH /collections/<name>`) — the sink will keep writing the same
  documents alongside any extra fields you add.
- `id` is pinned to the peepshow run id (basename of `outputDir`). If
  you generate non-unique run ids, documents will overwrite each other.
- Typesense Cloud free tier has a 64MB RAM limit — heavy peepshow loads
  on free instances may evict older documents. Use a paid tier or
  self-host for large archives.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out.

### 1. Set the environment

```sh
export TYPESENSE_URL="http://localhost:8108"
export TYPESENSE_API_KEY="xyz"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add typesense
# Optional: only fire for matching inputs
peepshow sinks add typesense --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: auto-invokes `/peepshow:slides`, peepshow extracts
> frames + audio + transcript, then forwards to the `typesense` sink.
>
> **`typesense`**: soft-creates the collection on first run, then
> upserts one document keyed on `id == run_id`. Search via
> `documents/search` for sub-50ms typo-tolerant results across run
> history.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — only
the fields documented above are persisted. Open a PR if you need
additional fields.

> **Transcript handling**: full transcript text is indexed as a single
> `string` field. Typesense limits document size to 4MB by default; for
> longer transcripts increase the `--api-server-port-max-body-size`
> server flag.
