# peepshow-sink-meilisearch

Index one document per peepshow run into a
[Meilisearch](https://www.meilisearch.com) instance. Once indexed, run
transcripts, titles, and container tags become queryable by either
keyword or, when an embedder is configured server-side, semantic vector
similarity — all from the same query.

The sink POSTs to `<url>/indexes/<index>/documents` with a single-element
JSON array. Meilisearch auto-creates the index on first write and uses
`run_id` as the primary key, so re-running the same peepshow run upserts
in place rather than duplicating. Each document looks like:

| Field | Type | Source |
|-------|------|--------|
| `run_id` | string | basename of `outputDir` — pinned as the primary key |
| `title` | string | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | integer | `frames.length` |
| `duration` | float | `video.durationSeconds` (0 when null) |
| `transcript` | string | `audio.transcript.text` when available |
| `thumbnail_url` | string | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env set |
| `strategy` | string | `"scene"` or `"fps"` |
| `tags` | object | the verbatim `video.tags` container metadata |
| `created_at` | string | ISO timestamp at the moment the doc is indexed |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MEILISEARCH_URL` | ✓ | — | Base URL of the Meilisearch instance, e.g. `http://localhost:7700`. |
| `MEILISEARCH_INDEX` |   | `peepshow-runs` | Index name. Auto-created on first write. |
| `MEILISEARCH_API_KEY` |   | — | Master / admin key. Sent as `Authorization: Bearer …`. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to `thumbnail_url`. |

## Exit codes

| 0 | Document indexed. |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | Meilisearch returned non-2xx (auth failure, malformed doc), or the request failed at the network layer. |

## Use

```bash
# Start Meilisearch locally
docker run -p 7700:7700 -e MEILI_MASTER_KEY=masterKey getmeili/meilisearch:latest

export MEILISEARCH_URL="http://localhost:7700"
export MEILISEARCH_API_KEY="masterKey"
peepshow sinks add meilisearch
peepshow ./demo.mp4
```

To get semantic / hybrid search, configure an embedder server-side once:

```bash
curl -X PATCH "$MEILISEARCH_URL/indexes/peepshow-runs/settings" \
  -H "Authorization: Bearer $MEILISEARCH_API_KEY" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "embedders": {
      "default": { "source": "openAi", "apiKey": "sk-..." }
    },
    "searchableAttributes": ["title", "transcript"]
  }'
```

Subsequent peepshow runs are automatically indexed by both keyword and
vector — query via `POST /indexes/peepshow-runs/search` with `hybrid`.

## Caveats

- Meilisearch returns `202 Accepted` immediately — the document is queued
  for indexing. Poll `/tasks/<taskUid>` if you need to wait for the index
  to settle before querying.
- Without an embedder configured, search is keyword-only. The sink is
  agnostic — it just writes the data and lets the server handle vectors.
- The free Meilisearch Cloud tier has document quotas — heavy peepshow
  loads may exhaust them; self-host on a $5 VPS instead.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out.

### 1. Set the environment

```sh
export MEILISEARCH_URL="http://localhost:7700"
export MEILISEARCH_API_KEY="masterKey"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add meilisearch
# Optional: only fire for matching inputs
peepshow sinks add meilisearch --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: auto-invokes `/peepshow:slides`, peepshow extracts
> frames + audio + transcript, then forwards to the `meilisearch` sink.
>
> **`meilisearch`**: indexes one document into the `peepshow-runs`
> index. Within milliseconds it's searchable — query
> `transcript:"the bug"` or use hybrid search for semantic matches.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — only
the fields documented above are persisted. Open a PR if you need
additional fields.

> **Transcript handling**: the full transcript is indexed as a single
> string. Meilisearch's max document size is 100MB by default —
> exceptionally long transcripts may need server-side limits raised.
