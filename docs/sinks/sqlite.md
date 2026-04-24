# peepshow-sink-sqlite

<!-- gif:sink:sqlite -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/sqlite.gif" alt="peepshow → sqlite demo" width="720">
</p>
<!-- /gif:sink:sqlite -->


Built-in. Persists every peepshow run into a SQLite file — ideal for a personal, offline-first archive that can be queried with any SQLite tool (DB Browser, Datasette, `sqlite3`).

## Install

The sink ships with peepshow. The SQLite driver is an optional dependency:

```bash
npm install better-sqlite3          # inside the peepshow install
# or: npm install -g peepshow        # installs bin; you may also need:
npm install --prefix /path/to/peepshow better-sqlite3
```

## Config

| Env var | Default | Purpose |
| :------ | :------ | :------ |
| `PEEPSHOW_SQLITE_PATH` | `~/.peepshow/peepshow.db` | file location |

## Use

```bash
peepshow sinks add sqlite
peepshow ./video.mp4         # every run writes into the db
```

## Schema

Three tables are auto-created on first write:

- `peepshow_runs` — one row per extract: strategy, full video metadata, extraction stats, ffmpeg source.
- `peepshow_frames` — one row per frame: `run_id`, `ordinal`, `path`, `bytes`.
- `peepshow_tags` — one row per container tag: `run_id`, `key`, `value`.

## Example queries

```sql
-- latest 10 runs
SELECT id, started_at, strategy, frames_emitted, elapsed_ms
FROM peepshow_runs ORDER BY started_at DESC LIMIT 10;

-- all runs for a given director
SELECT r.id, r.started_at
FROM peepshow_runs r
JOIN peepshow_tags t ON t.run_id = r.id
WHERE t.key = 'director' AND t.value = 'Kubrick';

-- frame gallery for run #42
SELECT ordinal, path FROM peepshow_frames WHERE run_id = 42 ORDER BY ordinal;
```

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
# sqlite has no required env vars — it writes to a local path.
peepshow --sink sqlite:~/peepshow.sqlite
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add sqlite
# Optional: only fire for matching inputs
peepshow sinks add sqlite --when extension=mp4,mov
peepshow sinks add sqlite --when director=Kubrick
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
> then forwards the run to the `SQLite` sink.
>
> **`SQLite`**: writes video metadata, frames, and container tags into a local SQLite file so the agent (or any downstream tool) can query prior runs with plain SQL.
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
