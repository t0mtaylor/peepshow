# peepshow-sink-pgvector

<!-- gif:sink:pgvector -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/pgvector.gif" alt="peepshow → pgvector demo" width="720">
</p>
<!-- /gif:sink:pgvector -->


Extend the [`postgres`](./postgres.md) sink's archive with a [`pgvector`](https://github.com/pgvector/pgvector)-powered `peepshow_frame_embeddings` table so runs become searchable by semantic similarity. This sink does **not** compute embeddings — it creates the table and writes zero-vector rows, expecting a downstream embedder (OpenAI, Cohere, a local model) to fill them in.

## Install

```bash
npm i -g peepshow
npm i -g pg                        # optional dep; installed per-project works too
```

The `pg` peer dependency is required. pgvector must already be available on the target Postgres (managed providers: RDS / Supabase / Neon / Crunchy ship it — self-hosted needs `CREATE EXTENSION vector`). The sink runs `CREATE EXTENSION IF NOT EXISTS vector` on every invocation so the DB user needs permission for that, or you can create it once by hand.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `DATABASE_URL`     | ✓ | — | Postgres connection string, e.g. `postgres://user:pass@host:5432/db`. |
| `PEEPSHOW_PG_SSL`  |   | `0` | `1` / `true` to enable TLS (required by most hosted Postgres). |
| `PGVECTOR_DIM`     |   | `1536` | Vector dimension. Must match your embedder (1536 for OpenAI ada-002, 768 for BGE-base, etc.). |

## Usage

```bash
export DATABASE_URL="postgres://peepshow:secret@db.internal:5432/archive"
export PGVECTOR_DIM=1536
peepshow ./clip.mp4 --sink pgvector
```

Optional flags:
- `--when` filters so the sink only fires for matching inputs (see [PLUGINS.md](../PLUGINS.md)).
- Pair with `peepshow sinks add pgvector` for auto-invocation.

## Schema

Created automatically on first write:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE peepshow_frame_embeddings (
  id               BIGSERIAL PRIMARY KEY,
  path             TEXT NOT NULL,
  ordinal          INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  strategy         TEXT NOT NULL,
  video_codec      TEXT,
  duration_seconds DOUBLE PRECISION,
  tags             JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding        vector(<PGVECTOR_DIM>)
);

CREATE INDEX idx_peepshow_frame_embeddings_path ON peepshow_frame_embeddings(path);
```

Each frame produces one row; `embedding` is `NULL` until a downstream embedder updates it by `id` or `path`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Rows inserted. |
| 2 | Missing `DATABASE_URL`, or invalid `PGVECTOR_DIM`. |
| 3 | `pg` not installed. |
| 4 | stdin malformed. |
| 5 | Postgres runtime failure (connection, auth, extension not available). |

## Caveats

- `PGVECTOR_DIM` is baked into the table on first create — if you change it later, drop and recreate `peepshow_frame_embeddings` (or migrate with `ALTER COLUMN embedding TYPE vector(NEW_DIM)` + a re-embed pass).
- The table is intentionally separate from `peepshow_runs` / `peepshow_frames` (created by the `postgres` sink) so you can run it standalone. JOIN via `path` if you need the archive-level run/frame metadata.
- No ANN index is created by default — add `USING hnsw (embedding vector_cosine_ops)` (or `ivfflat`) yourself once you have representative data and know your query metric.

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
export DATABASE_URL="postgres://user:pass@host:5432/db"
export PGVECTOR_DIM=1536
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add pgvector
# Optional: only fire for matching inputs
peepshow sinks add pgvector --when extension=mp4,mov
peepshow sinks add pgvector --when genre=tutorial
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
> then forwards the run to the `pgvector` sink.
>
> **`pgvector`**: inserts one row per frame into `peepshow_frame_embeddings` with a null embedding, ready for a downstream embedder to fill in.
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

*Full list + links: [docs/sinks/README.md](./README.md).*
