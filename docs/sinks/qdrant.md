# peepshow-sink-qdrant

<!-- gif:sink:qdrant -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/qdrant.gif" alt="peepshow → qdrant demo" width="720">
</p>
<!-- /gif:sink:qdrant -->


Upsert peepshow frames as points in a [Qdrant](https://qdrant.tech) collection. Vectors are not computed client-side; the sink writes the metadata payload and expects callers who need real embeddings to run an embedder upstream or use a collection with a server-side inference config. Works against Qdrant Cloud or a self-hosted cluster.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

No SDK required — the sink uses Qdrant's REST API over `fetch`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `QDRANT_URL`        | ✓ | — | Base URL, e.g. `http://localhost:6333` or `https://your-cluster.qdrant.io`. Trailing slashes stripped. |
| `QDRANT_COLLECTION` | ✓ | — | Collection name (must already exist). |
| `QDRANT_API_KEY`    |   | (none) | API key for Qdrant Cloud / auth-enabled installs. |

## Usage

```bash
export QDRANT_URL="https://your-cluster.qdrant.io"
export QDRANT_COLLECTION="peepshow"
export QDRANT_API_KEY="..."
peepshow ./doc.mp4 --sink qdrant
```

Optional flags:
- `--when` filters so the sink only fires for matching inputs (see [PLUGINS.md](../PLUGINS.md)).
- Pair with `peepshow sinks add qdrant` for auto-invocation.

## Point shape (per frame)

Each point has:
- `id` — `<run-epoch-ms>-<ordinal>`.
- `payload` — `{ run_id, ordinal, path, bytes, strategy, video, extraction }`. The full `video` (including `tags`) and `extraction` blocks are preserved so filtering by container metadata works out of the box.

The upsert uses `?wait=true` so the call is synchronous — callers see a `5xx` immediately if the write fails rather than silently queueing.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Points upserted. |
| 2 | Missing `QDRANT_URL` or `QDRANT_COLLECTION`. |
| 4 | stdin malformed. |
| 5 | Qdrant returned non-2xx (missing collection, auth failure, schema mismatch). |

## Caveats

- The collection must already exist with a vector config compatible with however your downstream embedder writes vectors. This sink does not create collections.
- No vector is supplied — if your collection requires a dense vector on upsert you'll need to tee through an embedder first, or run a two-stage pipeline that fills in vectors by id.
- The point id is epoch-ms + ordinal: unique per run, but not globally content-addressable. Re-running on the same video creates fresh points rather than upserting over the previous ones.

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
export QDRANT_URL="https://your-cluster.qdrant.io"
export QDRANT_COLLECTION="peepshow"
export QDRANT_API_KEY="..."
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add qdrant
# Optional: only fire for matching inputs
peepshow sinks add qdrant --when extension=mp4,mov
peepshow sinks add qdrant --when director=Kubrick
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
> then forwards the run to the `Qdrant` sink.
>
> **`Qdrant`**: upserts one point per frame into the configured collection with the full video payload as filterable metadata.
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
