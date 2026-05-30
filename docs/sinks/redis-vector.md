# peepshow-sink-redis-vector

Write one [Redis](https://redis.io) hash per peepshow run into a Redis
8+ instance, plus an idempotent `FT.CREATE` so the
[RediSearch](https://redis.io/docs/latest/develop/interact/search-and-query/)
module can full-text + vector-search every run from the same datastore.

The sink shells out to the system `redis-cli` rather than pulling in a
Node Redis client — zero runtime dependencies for users who already
operate Redis. Each hash is keyed `<index>:<runId>` and contains:

| Field | Type | Source |
|-------|------|--------|
| `run_id` | TEXT | basename of `outputDir` |
| `title` | TEXT | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | NUMERIC | `frames.length` |
| `duration` | NUMERIC | `video.durationSeconds` (0 when null) |
| `transcript` | TEXT | `audio.transcript.text` when available |
| `thumbnail_url` | TEXT | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env set |
| `strategy` | TAG | `"scene"` or `"fps"` |
| `created_at` | TEXT | ISO timestamp at the moment the doc is written |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `REDIS_URL` |   | `redis://127.0.0.1:6379` | Redis connection URL (host, port, db). |
| `REDIS_INDEX` |   | `peepshow:runs` | FT index name + hash key prefix. |
| `REDIS_PASSWORD` |   | — | Sent via `AUTH` on stdin — never appears in argv (so `ps aux` is clean). |
| `REDIS_BIN` |   | `redis-cli` | Override the `redis-cli` executable path. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` hash field. |

## Exit codes

| 0 | Hash written (FT index too, when the RediSearch module is loaded). |
| 3 | `redis-cli` not found on PATH. |
| 4 | stdin malformed. |
| 5 | redis-cli exited non-zero (auth failure, connection refused). |

## Use

```bash
# Start Redis 8 with RediSearch (redis-stack ships it pre-loaded)
docker run -p 6379:6379 redis/redis-stack:latest

export REDIS_URL="redis://127.0.0.1:6379"
peepshow sinks add redis-vector
peepshow ./demo.mp4
```

Search via `redis-cli` once a few runs are indexed:

```bash
redis-cli FT.SEARCH peepshow:runs "@transcript:bug"
redis-cli FT.SEARCH peepshow:runs "@strategy:{scene}"
```

## Caveats

- **RediSearch module is optional**: if the module isn't loaded the FT
  index creation fails, but the hash is still written. The sink logs the
  skip to stderr and exits 0 — keyword `HGETALL <index>:<runId>` still
  works, you just lose full-text search.
- **Authentication is via `AUTH` on stdin**, not `-a`. This keeps your
  password out of process listings but means it's visible to anyone
  with strace on the redis-cli process. Combine with TLS and proper
  Redis ACL users for production.
- **No vector field by default.** The FT schema declares text and
  numeric fields only; if you want true vector search add a `VECTOR`
  field by re-issuing `FT.CREATE` manually with `VECTOR HNSW 6 TYPE
  FLOAT32 DIM 1536 DISTANCE_METRIC COSINE` and emit embeddings via a
  custom transform downstream.
- **Memory store**: every run lives in Redis RAM. For long archives,
  pair with `REDIS_SAVE` config (RDB / AOF) or evict older `peepshow:runs:*`
  keys with a periodic job.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out.

### 1. Set the environment

```sh
export REDIS_URL="redis://127.0.0.1:6379"
# optional, when your Redis requires AUTH
export REDIS_PASSWORD="s3cret"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add redis-vector
# Optional: only fire for matching inputs
peepshow sinks add redis-vector --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: auto-invokes `/peepshow:slides`, peepshow extracts
> frames + audio + transcript, then forwards to the `redis-vector` sink.
>
> **`redis-vector`**: issues `FT.CREATE … IF NOT EXISTS` (no-op after
> the first run), then `HSET peepshow:runs:<id> …`. Microseconds later
> the run is searchable via `FT.SEARCH`.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — only
the fields documented above are persisted. Open a PR if you need
additional fields.

> **Transcript handling**: full transcript text is written to the
> `transcript` hash field as TEXT — `FT.SEARCH peepshow:runs
> "@transcript:foo"` finds it. Redis hashes have no value-size limit
> beyond `proto-max-bulk-len` (512MB by default).
