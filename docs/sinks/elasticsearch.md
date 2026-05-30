# peepshow-sink-elasticsearch

Index one document per peepshow run into an
[Elasticsearch](https://www.elastic.co/elasticsearch/) (or
API-compatible [OpenSearch](https://opensearch.org)) cluster. Once
indexed, run transcripts, titles, and container tags become queryable
via Kibana / OpenSearch Dashboards or any Elastic SDK.

The sink POSTs to `<url>/<index>/_doc` and lets the server assign the
document id. The index is auto-created on first write per Elastic's
default behaviour. Each document looks like:

| Field | Type | Source |
|-------|------|--------|
| `run_id` | text | basename of `outputDir` |
| `title` | text | `video.tags.title` / `video.tags.show` / fallback |
| `frames` | integer | `frames.length` |
| `duration` | float | `video.durationSeconds` (0 when null) |
| `transcript` | text | `audio.transcript.text` when available |
| `thumbnail_url` | keyword | `${PEEPSHOW_FRAME_BASE_URL}/<first-frame-name>` when env set |
| `strategy` | keyword | `"scene"` or `"fps"` |
| `tags` | object | the verbatim `video.tags` container metadata |
| `created_at` | date | ISO timestamp at the moment the doc is indexed |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ELASTICSEARCH_URL` | ✓ | — | Base URL of the cluster, e.g. `https://es.example.com:9200`. |
| `ELASTICSEARCH_INDEX` |   | `peepshow-runs` | Index name. Auto-created on first write. |
| `ELASTICSEARCH_API_KEY` | * | — | Encoded API key (sent as `Authorization: ApiKey <k>`). |
| `ELASTICSEARCH_USERNAME` | * | — | Basic auth user. Mutually exclusive with API key. |
| `ELASTICSEARCH_PASSWORD` | * | — | Basic auth password. Required when username is set. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` field. |

\* Auth is optional — local single-node dev clusters often run without
it. In production, pick **one** of API key or Basic auth.

## Exit codes

| 0 | Document indexed. |
| 2 | Invalid auth combination (e.g. both API key and Basic, or username without password). |
| 4 | stdin malformed. |
| 5 | Elasticsearch returned non-2xx (e.g. invalid index name, auth failure), or the request failed at the network layer. |

## Use

```bash
export ELASTICSEARCH_URL="http://localhost:9200"
peepshow sinks add elasticsearch
peepshow ./demo.mp4
```

With an API key (Elastic Cloud / managed):

```bash
export ELASTICSEARCH_URL="https://my-deployment.es.us-east-1.aws.elastic.cloud:9243"
export ELASTICSEARCH_API_KEY="VnVhQ2ZHY0JDZGJrUW..."
peepshow ./demo.mp4 --sink elasticsearch
```

With Basic auth (self-hosted, dev clusters):

```bash
export ELASTICSEARCH_URL="http://localhost:9200"
export ELASTICSEARCH_USERNAME="elastic"
export ELASTICSEARCH_PASSWORD="changeme"
peepshow ./demo.mp4 --sink elasticsearch
```

OpenSearch works with the exact same env vars — just point
`ELASTICSEARCH_URL` at your OpenSearch endpoint.

## Caveats

- Auto-mapping infers field types from the first document. If your
  transcripts contain numeric-looking text, Elasticsearch may guess
  `long` instead of `text` and reject subsequent docs. Pre-create the
  index with an explicit mapping if you hit this.
- This sink writes the run row only — it does not store every frame.
  Pair with `s3` (frame storage) or `chroma` (frame vectors) when you
  need both metadata and frame retrieval.
- The default Elastic Cloud free tier has document quotas — heavy
  peepshow loads may exhaust them; batch via `webhook` → Logstash for
  high-volume archives.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export ELASTICSEARCH_URL="https://es.example.com:9200"
export ELASTICSEARCH_API_KEY="VnVhQ2ZHY0..."
```

### 2. Register as an auto-sink

```sh
peepshow sinks add elasticsearch
# Optional: only fire for matching inputs
peepshow sinks add elasticsearch --when extension=mp4,mov
```

See [`peepshow sinks`](../PLUGINS.md) for the full matching vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: auto-invokes `/peepshow:slides`, peepshow extracts
> frames + audio + transcript, then forwards to the `elasticsearch`
> sink.
>
> **`elasticsearch`**: indexes one document into the `peepshow-runs`
> index. Within seconds it's full-text-searchable via Kibana — type
> `transcript:"the bug"` and find every video where that phrase
> appears.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — only
the fields documented above are persisted. Open a PR if you need
additional fields.

> **Transcript handling**: full transcript text is indexed as a single
> `text` field. For very long transcripts, consider increasing your
> cluster's `index.mapping.total_fields.limit` or pre-creating the index
> with a custom analyzer.
