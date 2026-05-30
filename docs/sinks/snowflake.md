# peepshow-sink-snowflake

Insert one row per peepshow run into a [Snowflake](https://www.snowflake.com)
table via the [SQL API v2](https://docs.snowflake.com/en/developer-guide/sql-api/intro).
Snowflake is the cloud data warehouse most enterprises run their analytics
on — this sink writes peepshow runs into it without any driver dependency,
key-pair JWT signing, or clock-skew headaches. The first write
auto-creates the table; subsequent runs append.

The default schema (created on first write — DDL is idempotent
`CREATE TABLE IF NOT EXISTS`):

| Column | Type | Source |
|--------|------|--------|
| `run_id` | `STRING` | basename of `outputDir` |
| `title` | `STRING` | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | `NUMBER` | `frames.length` |
| `duration` | `FLOAT` | `video.durationSeconds` (0 when null) |
| `transcript` | `STRING` | `audio.transcript.text` when available (capped at 1MB) |
| `thumbnail_url` | `STRING` | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env is set |
| `strategy` | `STRING` | `payload.strategy` (`scene` or `fps`) |
| `tags` | `VARIANT` | `video.tags` as JSON (queryable with native VARIANT operators) |
| `created_at` | `TIMESTAMP_NTZ` | `DEFAULT CURRENT_TIMESTAMP()` — server-side timestamp |

`VARIANT` lets you query container tags with the standard
`tags:director::STRING = 'Kubrick'` syntax without unpacking JSON
client-side.

## Authentication

Snowflake supports several auth methods; this sink uses a
**programmatic access token (PAT)** — the modern, password-replacement
flow that doesn't require key-pair JWT signing.

1. Sign in to the Snowflake console as the user the sink should
   run as.
2. Top right → User → My profile → **Authentication** →
   **Programmatic access tokens** → **Generate new token**.
3. Give the token a name (e.g. `peepshow-runs`), pick a role with
   `INSERT` privilege on the target table (or `CREATE TABLE` on the
   schema if you want auto-creation), and set the validity window.
4. Copy the token immediately — Snowflake displays it once.

The token is sent as a Bearer header along with
`X-Snowflake-Authorization-Token-Type: PROGRAMMATIC_ACCESS_TOKEN`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `SNOWFLAKE_ACCOUNT` | ✓ | — | Account identifier including region, e.g. `xy12345.us-east-1`. Also supports `xy12345.privatelink` for PrivateLink customers. |
| `SNOWFLAKE_TOKEN` | ✓ | — | Programmatic access token (PAT). |
| `SNOWFLAKE_DATABASE` | ✓ | — | Target database (case-sensitive when quoted; the sink quotes identifiers). |
| `SNOWFLAKE_SCHEMA` |   | `PUBLIC` | Schema name. |
| `SNOWFLAKE_TABLE` |   | `PEEPSHOW_RUNS` | Table name. Auto-created on first write. |
| `SNOWFLAKE_WAREHOUSE` |   | — | Compute warehouse to bill the query to. Required if the user has no `DEFAULT_WAREHOUSE`. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` column. |

## Exit codes

| 0 | Row inserted. |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | Snowflake returned non-2xx (e.g. expired PAT, missing role, syntax error) or the request failed at the network layer. |

## Use

```bash
export SNOWFLAKE_ACCOUNT="xy12345.us-east-1"
export SNOWFLAKE_TOKEN="$(< ~/.snowflake-pat)"
export SNOWFLAKE_DATABASE="ANALYTICS"
peepshow sinks add snowflake
peepshow ./demo.mp4
```

With a dedicated warehouse and schema:

```bash
export SNOWFLAKE_ACCOUNT="xy12345.us-east-1"
export SNOWFLAKE_TOKEN="$(< ~/.snowflake-pat)"
export SNOWFLAKE_DATABASE="ANALYTICS"
export SNOWFLAKE_SCHEMA="RAW"
export SNOWFLAKE_TABLE="PEEPSHOW_RUNS"
export SNOWFLAKE_WAREHOUSE="COMPUTE_WH"
peepshow ./demo.mp4 --sink snowflake
```

## Caveats

- The sink writes one row per run — it does not store every frame. Pair
  with the `s3` sink (or `gcs`/`azure-blob`) if you want the actual
  JPEGs alongside the warehouse rows.
- Transcripts are capped at 1MB before insert to stay safely under the
  SQL API's 16MB request ceiling. If you need full-length transcripts,
  split them across multiple rows upstream.
- Auto-creation runs `CREATE TABLE IF NOT EXISTS` on every invocation —
  cheap (parsed, then no-op on the server) but if you'd rather skip it,
  create the table yourself with the schema above and the DDL becomes a
  no-op.
- PATs have a fixed validity. When yours expires the sink fails with
  exit 5 and `Snowflake … 401` on stderr — rotate the token and retry.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export SNOWFLAKE_ACCOUNT="xy12345.us-east-1"
export SNOWFLAKE_TOKEN="$(< ~/.snowflake-pat)"
export SNOWFLAKE_DATABASE="ANALYTICS"
export SNOWFLAKE_WAREHOUSE="COMPUTE_WH"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add snowflake
# Optional: only fire for matching inputs
peepshow sinks add snowflake --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards the
> run to the `snowflake` sink.
>
> **`snowflake`**: inserts one row into
> `ANALYTICS.PUBLIC.PEEPSHOW_RUNS` with the full transcript, duration,
> frame count, and container tags as a queryable `VARIANT` column.
> Available immediately for `SELECT … WHERE tags:director::STRING =
> 'Kubrick'`-style queries.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin. Only the
columns documented above are persisted — the rest of the payload is
ignored. Open a PR if you need additional columns.
