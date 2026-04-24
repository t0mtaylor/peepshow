# peepshow-sink-postgres

<!-- gif:sink:postgres -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/postgres.gif" alt="peepshow → postgres demo" width="720">
</p>
<!-- /gif:sink:postgres -->


Persists every peepshow run into PostgreSQL. Schema auto-creates on first write. Uses the `pg` optional dependency — users who don't need the sink pay nothing.

## Install

```bash
npm install pg           # inside the peepshow install, or your own env
```

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `DATABASE_URL` | yes | — | `postgres://user:pass@host:port/db` |
| `PEEPSHOW_PG_SSL` | no | `0` | `1` / `true` to enable TLS (needed on hosted DBs) |

## Use

```bash
export DATABASE_URL="postgres://peepshow:secret@db.internal:5432/archive"
peepshow sinks add postgres
peepshow ./video.mp4          # every run now writes into Postgres
```

## Schema

Three tables (created automatically):

- `peepshow_runs` — one row per extract: strategy, video metadata, extraction stats, ffmpeg source.
- `peepshow_frames` — one row per emitted frame: `run_id`, `ordinal`, `path`, `bytes`.
- `peepshow_tags` — one row per container tag: `run_id`, `key`, `value`.

All foreign keys cascade on `DELETE` so archiving a run is atomic.

## Example queries

```sql
-- runs ingested today
SELECT id, strategy, frames_emitted, elapsed_ms
FROM peepshow_runs
WHERE started_at >= CURRENT_DATE
ORDER BY started_at DESC;

-- all runs for a given director, joined with frame count
SELECT r.id, r.started_at, COUNT(f.id) AS frames
FROM peepshow_runs r
JOIN peepshow_tags t ON t.run_id = r.id AND t.key = 'director' AND t.value = 'Kubrick'
LEFT JOIN peepshow_frames f ON f.run_id = r.id
GROUP BY r.id ORDER BY r.started_at DESC;
```

## Pair with pgvector

Runs stored here can be upgraded to a vector-search store by adding the `pgvector` extension and an `embedding` column on `peepshow_frames`. See `docs/SINKS-MISSING.md` for the full roadmap item.

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
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add postgres
# Optional: only fire for matching inputs
peepshow sinks add postgres --when extension=mp4,mov
peepshow sinks add postgres --when director=Kubrick
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
> then forwards the run to the `Postgres` sink.
>
> **`Postgres`**: files every run into a shared Postgres archive — auto-created tables, transactional writes, joinable with your existing app tables.
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

> **Transcript handling**: segments land in a `transcripts` row linked to the run — JOIN on the run id to pull the full spoken content.
