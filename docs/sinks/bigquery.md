# peepshow-sink-bigquery

Stream one row per peepshow run into a [Google BigQuery](https://cloud.google.com/bigquery)
table via the [`tabledata.insertAll`](https://cloud.google.com/bigquery/docs/reference/rest/v2/tabledata/insertAll)
REST endpoint. BigQuery is Google's petabyte-scale serverless data
warehouse — this sink writes peepshow runs into it via the streaming-
insert API, so rows are queryable within seconds of arrival.

`insertAll` does not auto-create tables, by design (DDL goes through
`jobs.insert`). Create the destination table once with this schema, then
the sink streams rows into it forever:

```sql
CREATE TABLE `my-project.peepshow.peepshow_runs` (
  run_id        STRING,
  title         STRING,
  frames        INT64,
  duration      FLOAT64,
  transcript    STRING,
  thumbnail_url STRING,
  strategy      STRING,
  tags          STRING,        -- JSON-encoded video.tags
  created_at    TIMESTAMP
);
```

| Column | Type | Source |
|--------|------|--------|
| `run_id` | `STRING` | basename of `outputDir` (also used as the `insertId` for dedup) |
| `title` | `STRING` | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | `INT64` | `frames.length` |
| `duration` | `FLOAT64` | `video.durationSeconds` (0 when null) |
| `transcript` | `STRING` | `audio.transcript.text` when available (capped at 1MB) |
| `thumbnail_url` | `STRING` | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env is set |
| `strategy` | `STRING` | `payload.strategy` (`scene` or `fps`) |
| `tags` | `STRING` | `JSON.stringify(video.tags)` — wrap in `JSON_VALUE`/`JSON_EXTRACT` to query |
| `created_at` | `TIMESTAMP` | ISO-8601 timestamp the sink generates client-side |

The `run_id` doubles as the `insertId` of the streaming insert, so
re-running peepshow against the same input is idempotent — BigQuery
de-duplicates within a ~1-minute window.

## Authentication

The sink uses an **OAuth2 access token** sent as a Bearer header. Either
user credentials or a service account work:

```sh
# User credentials (interactive)
export BIGQUERY_ACCESS_TOKEN="$(gcloud auth print-access-token)"

# Service account (recommended for CI)
export BIGQUERY_ACCESS_TOKEN="$(gcloud auth print-access-token \
  --impersonate-service-account=peepshow@my-project.iam.gserviceaccount.com)"
```

Token refresh is the **caller's** responsibility — the sink fails fast
with exit 5 and `BigQuery 401` on stderr when the token expires. In a
recurring job, refresh before each `peepshow` invocation. For
long-running agents, refresh on demand and re-export
`BIGQUERY_ACCESS_TOKEN` before piping the next run.

The service account needs `bigquery.dataEditor` on the dataset (or
`bigquery.tables.updateData` on the specific table) plus
`bigquery.user` on the project.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `BIGQUERY_PROJECT` | ✓ | — | GCP project id that owns the BigQuery dataset. |
| `BIGQUERY_DATASET` | ✓ | — | BigQuery dataset id (case-sensitive). |
| `BIGQUERY_TABLE` |   | `peepshow_runs` | Table name within the dataset. Must already exist with a compatible schema. |
| `BIGQUERY_ACCESS_TOKEN` | ✓ | — | OAuth2 access token (Bearer). Refresh before invocation. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` field. |

## Exit codes

| 0 | Row inserted. |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | BigQuery returned non-2xx (expired token, missing permission, schema mismatch) or `insertErrors` was non-empty on a 200 response, or the request failed at the network layer. |

## Use

```bash
export BIGQUERY_PROJECT="my-project"
export BIGQUERY_DATASET="peepshow"
export BIGQUERY_ACCESS_TOKEN="$(gcloud auth print-access-token)"
peepshow sinks add bigquery
peepshow ./demo.mp4
```

Custom table:

```bash
export BIGQUERY_PROJECT="my-project"
export BIGQUERY_DATASET="analytics"
export BIGQUERY_TABLE="ml_video_runs"
export BIGQUERY_ACCESS_TOKEN="$(gcloud auth print-access-token)"
peepshow ./demo.mp4 --sink bigquery
```

## Caveats

- The sink writes one row per run — it does not store every frame. Pair
  with the `gcs` sink (Google Cloud Storage of frames) for the actual
  JPEGs.
- `tags` is stored as a JSON-encoded `STRING`. Query with
  `JSON_VALUE(tags, '$.director')` etc. If you'd rather have a native
  `JSON` column, alter the table — the sink writes valid JSON either
  way.
- Streaming inserts are billed by the bytes of streamed data (separate
  from the per-query/storage prices). Peepshow rows are tiny so this is
  negligible at typical run rates.
- Transcripts are capped at 1MB before insert to stay safely under
  BigQuery's 10MB-per-request streaming ceiling.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export BIGQUERY_PROJECT="my-project"
export BIGQUERY_DATASET="peepshow"
export BIGQUERY_ACCESS_TOKEN="$(gcloud auth print-access-token)"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add bigquery
# Optional: only fire for matching inputs
peepshow sinks add bigquery --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards the
> run to the `bigquery` sink.
>
> **`bigquery`**: streams one row into
> `my-project.peepshow.peepshow_runs` with the full transcript,
> duration, frame count, and JSON-encoded container tags. Available in
> Looker Studio / a `bq query` dashboard within seconds.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin. Only the
columns documented above are persisted — the rest of the payload is
ignored. Open a PR if you need additional columns.
