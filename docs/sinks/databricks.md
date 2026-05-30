# peepshow-sink-databricks

Insert one row per peepshow run into a [Databricks](https://www.databricks.com)
Delta table via the [SQL Statement Execution API](https://docs.databricks.com/api/workspace/statementexecution).
Databricks is the unified lakehouse platform — Delta Lake storage plus
a SQL warehouse on top. This sink writes peepshow runs into it without
any JDBC driver, key-pair signing, or Python SQL Connector — just the
REST API and a personal access token. The first write auto-creates the
Delta table; subsequent runs append.

The default schema (created on first write — DDL is idempotent
`CREATE TABLE IF NOT EXISTS ... USING DELTA`):

| Column | Type | Source |
|--------|------|--------|
| `run_id` | `STRING` | basename of `outputDir` |
| `title` | `STRING` | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | `BIGINT` | `frames.length` |
| `duration` | `DOUBLE` | `video.durationSeconds` (0 when null) |
| `transcript` | `STRING` | `audio.transcript.text` when available (capped at 1MB) |
| `thumbnail_url` | `STRING` | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env is set |
| `strategy` | `STRING` | `payload.strategy` (`scene` or `fps`) |
| `tags` | `STRING` | `JSON.stringify(video.tags)` — query with `from_json()` or `get_json_object()` |
| `created_at` | `TIMESTAMP` | ISO-8601 timestamp the sink generates client-side |

Tags are stored as a JSON-encoded `STRING` so they're portable across
classic Hive and Unity Catalog tables. Query them with
`get_json_object(tags, '$.director') = 'Kubrick'` or alter the column
to a native `VARIANT` post-create if you want richer indexing.

## Authentication

The sink uses a **personal access token (PAT)** sent as a Bearer
header — the modern path that doesn't require OAuth2 token exchange.

1. Sign in to the Databricks workspace as the user (or service
   principal) the sink should run as.
2. Top right → User Settings → Developer → **Access tokens** →
   **Generate new token**.
3. Give the token a comment (e.g. `peepshow-runs`) and a lifetime.
4. Copy the token immediately — Databricks displays it once.

For production use a [service-principal PAT](https://docs.databricks.com/en/dev-tools/auth/oauth-m2m.html)
instead of a user PAT so the integration doesn't break when an
individual leaves the workspace.

The principal needs `USE CATALOG`, `USE SCHEMA`, `CREATE TABLE`, and
`MODIFY` on the target table (or just `MODIFY` if the table is
pre-created). Plus `CAN USE` on the SQL warehouse.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `DATABRICKS_URL` | ✓ | — | Workspace URL, e.g. `https://abc-123.cloud.databricks.com` (AWS), `https://adb-….azuredatabricks.net` (Azure), or your GCP workspace host. |
| `DATABRICKS_TOKEN` | ✓ | — | Personal access token (Bearer). |
| `DATABRICKS_WAREHOUSE_ID` | ✓ | — | SQL warehouse id — the compute that runs the statement. Copy from the SQL warehouse details page. |
| `DATABRICKS_CATALOG` |   | `main` | Unity Catalog catalog. |
| `DATABRICKS_SCHEMA` |   | `default` | Schema within the catalog. |
| `DATABRICKS_TABLE` |   | `peepshow_runs` | Table name. Auto-created on first write. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` column. |

## Exit codes

| 0 | Row inserted. |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | Databricks returned non-2xx, the statement entered a `FAILED` / `CANCELED` state (e.g. expired PAT, missing permission, warehouse paused), or the request failed at the network layer. |

## Use

```bash
export DATABRICKS_URL="https://abc-123.cloud.databricks.com"
export DATABRICKS_TOKEN="$(< ~/.databricks-pat)"
export DATABRICKS_WAREHOUSE_ID="abcd1234efgh5678"
peepshow sinks add databricks
peepshow ./demo.mp4
```

With a dedicated catalog + schema:

```bash
export DATABRICKS_URL="https://abc-123.cloud.databricks.com"
export DATABRICKS_TOKEN="$(< ~/.databricks-pat)"
export DATABRICKS_WAREHOUSE_ID="abcd1234efgh5678"
export DATABRICKS_CATALOG="analytics"
export DATABRICKS_SCHEMA="raw"
export DATABRICKS_TABLE="peepshow_runs"
peepshow ./demo.mp4 --sink databricks
```

## Caveats

- The sink writes one row per run — it does not store every frame.
  Pair with the `s3` / `gcs` / `azure-blob` sink (matching your cloud)
  if you want the actual JPEGs alongside the warehouse rows.
- The SQL warehouse must be running (or set to auto-start) for the
  statement to execute. A paused warehouse will fail the statement
  with a clear error.
- Auto-creation runs `CREATE TABLE IF NOT EXISTS ... USING DELTA` on
  every invocation — cheap (no-op when the table exists) but if you'd
  rather skip it, create the table yourself with the schema above and
  the DDL becomes a no-op.
- Transcripts are capped at 1MB before insert to stay safely under the
  Statement Execution API's request size ceiling. If you need
  full-length transcripts, split them across multiple rows upstream.
- PATs have a fixed validity. When yours expires the sink fails with
  exit 5 and `Databricks DDL 401` (or similar) on stderr — rotate the
  token and retry.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export DATABRICKS_URL="https://abc-123.cloud.databricks.com"
export DATABRICKS_TOKEN="$(< ~/.databricks-pat)"
export DATABRICKS_WAREHOUSE_ID="abcd1234efgh5678"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add databricks
# Optional: only fire for matching inputs
peepshow sinks add databricks --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards the
> run to the `databricks` sink.
>
> **`databricks`**: inserts one row into
> `main.default.peepshow_runs` with the full transcript, duration,
> frame count, and JSON-encoded container tags. Queryable immediately
> from Databricks SQL, a notebook, or any external BI tool wired into
> the lakehouse.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin. Only the
columns documented above are persisted — the rest of the payload is
ignored. Open a PR if you need additional columns.
