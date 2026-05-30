# peepshow-sink-cassandra

Insert one row per peepshow run into an [Apache Cassandra](https://cassandra.apache.org)
or [DataStax Astra](https://www.datastax.com/products/datastax-astra)
table via the [Stargate REST API](https://stargate.io). Cassandra is
the distributed wide-column store that scales linearly across nodes;
Astra is the managed serverless flavour. Both speak Stargate, the
data-plane REST gateway, so this sink works against either without a
native driver.

`POST` per run lands on
`<baseUrl>/v2/keyspaces/<keyspace>/<table>` with a flat JSON body
keyed by column name. No CQL parsing client-side, no compiled
prepared statements.

## Schema

The Stargate REST data plane only exposes inserts / updates / reads —
DDL goes through CQL. Create the destination table once at setup time
(`cqlsh`, the Astra console, or the Stargate document API):

```cql
CREATE TABLE peepshow.peepshow_runs (
  run_id        text PRIMARY KEY,
  title         text,
  frames        bigint,
  duration      double,
  transcript    text,
  thumbnail_url text,
  strategy      text,
  tags          text,
  created_at    timestamp
);
```

| Column | Type | Source |
|--------|------|--------|
| `run_id` | `text` | basename of `outputDir` — primary key |
| `title` | `text` | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | `bigint` | `frames.length` |
| `duration` | `double` | `video.durationSeconds` (0 when null) |
| `transcript` | `text` | `audio.transcript.text` when available (capped at 1MB) |
| `thumbnail_url` | `text` | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env is set |
| `strategy` | `text` | `payload.strategy` (`scene` or `fps`) |
| `tags` | `text` | `JSON.stringify(video.tags)` — query with [`fromJson`](https://cassandra.apache.org/doc/latest/cassandra/cql/json.html#fromjson-function) UDFs |
| `created_at` | `timestamp` | ISO-8601 timestamp the sink generates client-side |

`run_id` is the partition key, so re-running peepshow against the same
input upserts in place — Cassandra inserts are unconditional UPSERTs.

## Authentication

Stargate uses a single `X-Cassandra-Token` header. How you mint that
token depends on the deployment:

### DataStax Astra

1. Log in to the [Astra dashboard](https://astra.datastax.com).
2. Pick the database → top right → **Generate Token**.
3. Choose a role with `INSERT` privilege on the keyspace (or
   `Database Administrator` for setup convenience).
4. Copy the `token` value from the JSON — Astra shows it once.

The token is a long-lived application token; pass it directly as
`CASSANDRA_TOKEN`.

### Self-hosted Stargate

If the cluster has [auth enabled](https://stargate.io/docs/v2/quickstart/quickstart-rest.html#authenticate),
exchange username/password for a session token:

```sh
curl -sX POST "$STARGATE_URL/v1/auth" \
  -H "content-type: application/json" \
  -d '{"username":"cassandra","password":"cassandra"}'
# {"authToken": "abc-…"}
```

Pass that `authToken` as `CASSANDRA_TOKEN`. Tokens expire after 30
minutes by default; refresh before each batch of runs.

If the cluster has auth disabled, omit `CASSANDRA_TOKEN` entirely.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `CASSANDRA_URL` | ✓ | — | Stargate base URL. Astra: `https://<id>-<region>.apps.astra.datastax.com/api/rest`. Local: `http://localhost:8082`. |
| `CASSANDRA_KEYSPACE` | ✓ | — | Target keyspace. Must already exist. |
| `CASSANDRA_TABLE` |   | `peepshow_runs` | Table name within the keyspace. Must already exist with the schema above. |
| `CASSANDRA_TOKEN` | ✓ (Astra) | — | Stargate session token sent as `X-Cassandra-Token`. Required for Astra; optional for self-hosted Stargate with auth disabled. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` column. |

## Exit codes

| 0 | Row inserted. |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | Stargate returned non-2xx (e.g. expired token, missing keyspace, schema mismatch) or the request failed at the network layer. |

## Use

Against DataStax Astra:

```bash
export CASSANDRA_URL="https://abc-region.apps.astra.datastax.com/api/rest"
export CASSANDRA_KEYSPACE="peepshow"
export CASSANDRA_TOKEN="$(< ~/.astra-token)"
peepshow sinks add cassandra
peepshow ./demo.mp4
```

Against self-hosted Stargate (no auth):

```bash
export CASSANDRA_URL="http://localhost:8082"
export CASSANDRA_KEYSPACE="peepshow"
peepshow ./demo.mp4 --sink cassandra
```

## Caveats

- The Stargate REST data plane doesn't expose DDL — you have to create
  the table yourself with the CQL above before the first run.
- Cassandra inserts are unconditional UPSERTs — re-running peepshow
  against the same input overwrites the existing row by `run_id`.
- Stargate session tokens (self-hosted) expire after ~30 minutes by
  default. Astra application tokens are long-lived. The sink fails
  fast with exit 5 and `Cassandra 401` on stderr when the token has
  expired — rotate and retry.
- `tags` is stored as a JSON-encoded `text` column. Query with
  `fromJson(tags)` UDFs or extract specific keys client-side. If
  you'd rather have a Cassandra `map<text,text>`, alter the schema
  and adapt the sink upstream.
- Transcripts are capped at 1MB before insert to keep the JSON body
  well under the Stargate REST gateway's request size limit.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export CASSANDRA_URL="https://abc-region.apps.astra.datastax.com/api/rest"
export CASSANDRA_KEYSPACE="peepshow"
export CASSANDRA_TOKEN="$(< ~/.astra-token)"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add cassandra
# Optional: only fire for matching inputs
peepshow sinks add cassandra --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards the
> run to the `cassandra` sink.
>
> **`cassandra`**: writes one row into `peepshow.peepshow_runs` with
> the full transcript, duration, frame count, and JSON-encoded
> container tags. Available immediately via any CQL client or the
> Stargate document API.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin. Only the
columns documented above are persisted — the rest of the payload is
ignored. Open a PR if you need additional columns.
