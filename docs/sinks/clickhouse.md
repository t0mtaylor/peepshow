# peepshow-sink-clickhouse

Insert one row per peepshow run into a [ClickHouse](https://clickhouse.com)
table via the HTTP interface. ClickHouse is the columnar OLAP database
of choice for petabyte-scale event analytics — this sink makes peepshow
runs queryable at interactive latencies even after tens of thousands of
extractions.

The first write auto-creates the table with this schema (idempotent —
the DDL is `CREATE TABLE IF NOT EXISTS`):

| Column | Type | Source |
|--------|------|--------|
| `run_id` | `String` | basename of `outputDir` |
| `title` | `String` | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | `UInt32` | `frames.length` |
| `duration` | `Float32` | `video.durationSeconds` (0 when null) |
| `transcript` | `String` | `audio.transcript.text` when available |
| `thumbnail_url` | `String` | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env is set |
| `created_at` | `DateTime DEFAULT now()` | server-side insertion timestamp |

The default `ENGINE = MergeTree ORDER BY created_at` keeps newer runs
co-located in storage — good for typical "show me recent peepshow runs"
queries.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `CLICKHOUSE_URL` | ✓ | — | Base URL of the ClickHouse HTTP interface, e.g. `http://localhost:8123`. |
| `CLICKHOUSE_USER` |   | `default` | Username. Sent via the `X-ClickHouse-User` header. |
| `CLICKHOUSE_PASSWORD` |   | — | Password. Sent via the `X-ClickHouse-Key` header. |
| `CLICKHOUSE_DATABASE` |   | `default` | Database name. Passed in the `database` query-string param. |
| `CLICKHOUSE_TABLE` |   | `peepshow_runs` | Table name. Auto-created on first write. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` column. |

## Exit codes

| 0 | Row inserted. |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | ClickHouse returned non-2xx (e.g. bad SQL, auth failure), or the request failed at the network layer. |

## Use

```bash
export CLICKHOUSE_URL="http://localhost:8123"
export CLICKHOUSE_DATABASE="analytics"
peepshow sinks add clickhouse
peepshow ./demo.mp4
```

With auth:

```bash
export CLICKHOUSE_URL="https://ch.example.com:8443"
export CLICKHOUSE_USER="writer"
export CLICKHOUSE_PASSWORD="secret"
peepshow ./demo.mp4 --sink clickhouse
```

## Caveats

- This sink writes the run row only — it does not store every frame.
  Pair with the `s3` sink (object storage of frames) if you need to
  retrieve the actual JPEGs later.
- `MergeTree` is the recommended engine for analytics. If you want a
  different engine (`ReplicatedMergeTree`, etc.), create the table
  yourself before the first peepshow run; the sink's
  `CREATE TABLE IF NOT EXISTS` will then be a no-op.
- Long transcripts are stored verbatim. ClickHouse has no inherent
  string-length cap but very long values (> a few MB) hurt query
  performance — truncate upstream if needed.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

Add the sink's required env vars to your shell rc (`~/.zshrc`,
`~/.bashrc`, PowerShell profile) or a project-local `.env` your agent
tooling loads:

```sh
export CLICKHOUSE_URL="http://localhost:8123"
export CLICKHOUSE_DATABASE="analytics"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add clickhouse
# Optional: only fire for matching inputs
peepshow sinks add clickhouse --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards the
> run to the `clickhouse` sink.
>
> **`clickhouse`**: inserts one row into `analytics.peepshow_runs` with
> the full transcript, duration, frame count, and timestamp. Available
> immediately for `SELECT ... WHERE transcript LIKE '%crash%'` queries.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin. Only the
columns documented above are persisted — the rest of the payload is
ignored. Open a PR if you need additional columns.
