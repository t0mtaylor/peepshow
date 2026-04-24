# peepshow-sink-pinecone

<!-- gif:sink:pinecone -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/pinecone.gif" alt="peepshow → pinecone demo" width="720">
</p>
<!-- /gif:sink:pinecone -->


Upsert peepshow frames as metadata-only records into a [Pinecone](https://www.pinecone.io) serverless index. The index must already exist and accept sparse/zero vectors; supply real embeddings by pre-processing the payload or running this sink downstream of an embedder. Each frame becomes one vector whose id maps back to the peepshow run + frame ordinal.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

No SDK required — the sink uses Pinecone's REST API over `fetch`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `PINECONE_API_KEY`   | ✓ | — | Pinecone API key. |
| `PINECONE_HOST`      | ✓ | — | Full index host, e.g. `my-index-abc.svc.gcp-starter.pinecone.io` (or with `https://` prefix). |
| `PINECONE_NAMESPACE` |   | `""` | Vector namespace. Omit for the default namespace. |

## Usage

```bash
export PINECONE_API_KEY="..."
export PINECONE_HOST="my-index-abc.svc.gcp-starter.pinecone.io"
peepshow ./movie.mp4 --sink pinecone
```

Optional flags:
- `--when` filters so the sink only fires for matching inputs (see [PLUGINS.md](../PLUGINS.md)).
- Pair with `peepshow sinks add pinecone` for auto-invocation.

## Vector shape (per frame)

- `id` — `peepshow-<epoch-ms>-<ordinal>`.
- `values` — placeholder `[0]`. Replace with a real embedding by updating the record by id after ingest.
- `metadata` — `{ path, bytes, ordinal, strategy, codec, duration, width, height, title, director }`.

The request sends `x-pinecone-api-version: 2025-01`. Pinecone returns `{ upsertedCount }` on success; the sink reports it back on stdout.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Vectors upserted. |
| 2 | Missing `PINECONE_API_KEY` or `PINECONE_HOST`. |
| 4 | stdin malformed. |
| 5 | Pinecone returned non-2xx (invalid host, auth failure, namespace / dimension mismatch). |

## Caveats

- Pinecone serverless indexes require a declared vector dimension. The placeholder `[0]` is 1-dim — if your index is anything else, upsert will fail at the API with a dimension mismatch. Either declare a 1-dim index for path-only lookups, or run this sink downstream of an embedder that rewrites `values` to the expected size.
- The sink does not create the index. Use Pinecone's control-plane API or dashboard first.
- `PINECONE_HOST` is the *index host*, not the project host. Grab it from the Pinecone console after creating the index.

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
export PINECONE_API_KEY="..."
export PINECONE_HOST="my-index-abc.svc.gcp-starter.pinecone.io"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add pinecone
# Optional: only fire for matching inputs
peepshow sinks add pinecone --when extension=mp4,mov
peepshow sinks add pinecone --when genre=tutorial
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
> then forwards the run to the `Pinecone` sink.
>
> **`Pinecone`**: upserts one metadata-only vector per frame into the configured serverless index and namespace.
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
