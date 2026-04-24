# peepshow-sink-milvus

<!-- gif:sink:milvus -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/milvus.gif" alt="peepshow → milvus demo" width="720">
</p>
<!-- /gif:sink:milvus -->


Upsert peepshow frames into a [Milvus](https://milvus.io) or
[Zilliz Cloud](https://zilliz.com/cloud) collection. Each frame becomes one row
whose `vector` is a **zero-vector** of a configurable dimension — real
embeddings are expected to be written later by the user's own retrieval
pipeline (an embedder CRON job, streaming re-index, or update-by-primary-key
from a vector service). The value of this sink is persisting the
frame→metadata rows into the same store as the eventual vectors.

## Install

Ships built-in with peepshow. The SDK is optional — install it alongside
peepshow if you want to use this sink:

```bash
npm i @zilliz/milvus2-sdk-node
```

The sink will emit a clear `is not installed` message (exit code 3) if the
SDK is missing.

## Invocation

```bash
peepshow ./scene.mp4 --sink milvus
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MILVUS_URI`        | ✓ | — | e.g. `http://localhost:19530` (self-host) or `https://in03-xxx.api.gcp-us-west1.zillizcloud.com` (Zilliz Cloud). |
| `MILVUS_COLLECTION` | ✓ | — | Target collection name (must already exist). |
| `MILVUS_TOKEN`      |   | (none) | Zilliz Cloud API token (preferred for hosted). |
| `MILVUS_USERNAME`   |   | (none) | Basic-auth username (alternative to token, typically self-host). |
| `MILVUS_PASSWORD`   |   | (none) | Basic-auth password. |
| `MILVUS_DIMENSION`  |   | `1536` | Embedding dimension. The zero-vector written per row uses this length. Must match the collection's declared vector field (or the dimension your pipeline will upgrade to). Invalid / non-positive values fall back to `1536`. |
| `MILVUS_SSL`        |   | auto | Force `true`/`false` (`1`/`0`, `yes`/`no`, `on`/`off`). When unset, inferred from the URI scheme: `https://…` → TLS on, `http://…` → TLS off. |

## Collection schema

The sink writes these fields per row:

```
vector      FLOAT_VECTOR(MILVUS_DIMENSION)    // all zeros at write time
path        VARCHAR
ordinal     INT64
bytes       INT64
title       VARCHAR                           // video.tags.title ?? tags.show ?? "peepshow run"
strategy    VARCHAR                           // "scene" | "fps"
codec       VARCHAR (nullable)
duration_s  DOUBLE (nullable)
width       INT64  (nullable)
height      INT64  (nullable)
director    VARCHAR (nullable)
studio      VARCHAR (nullable)
output_dir  VARCHAR
```

Either declare each of these in the collection's schema (along with a primary
key) **or** create the collection with `enable_dynamic_field: true` so all
metadata fields are accepted without an explicit declaration. The simplest
path is a dynamic collection with just a primary key + `vector(DIM)` declared;
everything else is absorbed into the dynamic row.

## Example — create a Zilliz Cloud collection (Python)

```python
from pymilvus import MilvusClient, DataType

client = MilvusClient(uri=ZILLIZ_URI, token=ZILLIZ_TOKEN)

schema = client.create_schema(auto_id=True, enable_dynamic_field=True)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("vector", DataType.FLOAT_VECTOR, dim=1536)

client.create_collection(
    collection_name="peepshow_frames",
    schema=schema,
)
client.create_index(
    collection_name="peepshow_frames",
    index_params=[{"field_name": "vector", "index_type": "AUTOINDEX", "metric_type": "COSINE"}],
)
client.load_collection("peepshow_frames")
```

## Filling in real vectors later

Because this sink only writes zero-vectors, pair it with one of:

- A Zilliz pipeline that listens for row inserts and runs an embedder over
  `title` + `path` + `output_dir`, writing the resulting vector back by
  primary key.
- A scheduled job that reads rows where `vector == ZERO`, embeds the frame
  image at `path`, and updates the row.
- A tee to an embedding sink (e.g. `peepshow-sink-chroma` with a server-side
  embedder) so the same frames land in two stores with real vectors in one of
  them.

## Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Upserted N rows. |
| `2`  | Missing `MILVUS_URI` or `MILVUS_COLLECTION`. |
| `3`  | `@zilliz/milvus2-sdk-node` not installed. |
| `4`  | stdin malformed. |
| `5`  | Milvus upsert failed (network / schema / auth). |

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

Add the sink's required env vars to your shell rc (`~/.zshrc`,
`~/.bashrc`, PowerShell profile) or a project-local `.env` that your
agent tooling loads. Example:

```sh
export MILVUS_URI="https://example.com"
export MILVUS_COLLECTION="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add milvus
# Optional: only fire for matching inputs
peepshow sinks add milvus --when extension=mp4,mov
peepshow sinks add milvus --when genre=tutorial
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code (or ask
> "what's in ~/bugs/crash.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/crash.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Milvus` sink.
>
> **`Milvus`**: upserts frame rows into a Milvus or Zilliz Cloud collection with zero-vectors so a downstream embedder can fill them in by primary key.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream record.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director / studio
  / title etc).
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence
  ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`,
  language — populated when transcription is enabled (v0.4.0+).
- `extraction` — strategy, thresholds, ffmpeg path used.

> **Transcript handling**: the transcript text is a natural embedding target — indexed alongside the frames so later retrieval covers spoken content too.
