# peepshow-sink-duckdb

Append one row per peepshow run to a local [DuckDB](https://duckdb.org)
file by shelling out to the `duckdb` CLI. Sibling to the SQLite sink —
same single-file simplicity, but DuckDB's columnar engine makes
aggregate queries (`AVG`, `GROUP BY`, percentile rollups) over a long
run history dramatically faster.

The first write auto-creates the table with this schema (idempotent —
the DDL is `CREATE TABLE IF NOT EXISTS`):

| Column | Type | Source |
|--------|------|--------|
| `run_id` | `TEXT` | basename of `outputDir` |
| `title` | `TEXT` | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | `INTEGER` | `frames.length` |
| `duration` | `DOUBLE` | `video.durationSeconds` (0 when null) |
| `transcript` | `TEXT` | `audio.transcript.text` when available |
| `thumbnail_url` | `TEXT` | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env is set |
| `created_at` | `TIMESTAMP DEFAULT now()` | insertion timestamp |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `DUCKDB_PATH` |   | `~/.peepshow/sinks/duckdb/peepshow.duckdb` | Database file path. Parent dir auto-created. |
| `DUCKDB_TABLE` |   | `peepshow_runs` | Table name. Auto-created on first write. |
| `DUCKDB_BIN` |   | `duckdb` | Override the `duckdb` executable path. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` column. |

## Install

DuckDB is a single-binary CLI:

```bash
# macOS
brew install duckdb

# linux / windows: https://duckdb.org/docs/installation/
```

## Exit codes

| 0 | Row inserted. |
| 3 | `duckdb` CLI not found on `PATH`. |
| 4 | stdin malformed. |
| 5 | The `duckdb` CLI exited non-zero (e.g. bad SQL, locked file). |

## Use

```bash
peepshow sinks add duckdb
peepshow ./demo.mp4
```

Query the file with the CLI:

```bash
duckdb ~/.peepshow/sinks/duckdb/peepshow.duckdb \
  -c "SELECT title, frames, duration FROM peepshow_runs ORDER BY created_at DESC LIMIT 10"
```

Or open it from Python:

```python
import duckdb
con = duckdb.connect("~/.peepshow/sinks/duckdb/peepshow.duckdb")
con.sql("SELECT AVG(duration), AVG(frames) FROM peepshow_runs").show()
```

## Caveats

- DuckDB has [no native concurrent-writer support](https://duckdb.org/docs/connect/concurrency.html)
  — only one process can open the file in write mode at a time. If
  another tool already has the file open, this sink fails with a runtime
  error; close the other connection and retry.
- This sink writes the run row only — it does not store every frame.
- Soft-fails with exit code 3 when the `duckdb` CLI is not installed,
  so multi-sink runs continue with a clear hint in stderr.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` and
`duckdb` on `PATH`.

### 1. Set the environment

DuckDB needs no API keys. You may want to override the default DB path:

```sh
export DUCKDB_PATH="$HOME/work/peepshow-archive.duckdb"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add duckdb
# Optional: only fire for matching inputs
peepshow sinks add duckdb --when extension=mp4,mov,mkv
```

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: auto-invokes `/peepshow:slides`, peepshow extracts
> frames + audio + transcript, then forwards to the `duckdb` sink.
>
> **`duckdb`**: appends one row to `peepshow_runs`. Claude can now
> answer "how many videos have I processed in the last week?" with a
> single SQL query against the local file.

### 4. What the sink sees

The sink receives the full `--emit json` payload on stdin. Only the
columns documented above are persisted — open a PR if you need
additional ones.
