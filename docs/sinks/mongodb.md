# peepshow-sink-mongodb

<!-- gif:sink:mongodb -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/mongodb.gif" alt="peepshow → mongodb demo" width="720">
</p>
<!-- /gif:sink:mongodb -->


Persist a peepshow run into MongoDB — one document per run in a `runs` collection, one document per frame in a `frames` collection, linked by `run_id`. Works against Atlas or self-hosted. Uses the `mongodb` optional dependency.

## Install

```bash
npm i -g peepshow
npm i -g mongodb                   # optional dep; installed per-project works too
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MONGO_URL`    | ✓ | — | Connection string, e.g. `mongodb://localhost:27017` or `mongodb+srv://user:pass@cluster.mongodb.net`. |
| `MONGO_DB`     | ✓ | — | Target database name. |
| `MONGO_RUNS`   |   | `peepshow_runs`   | Runs collection name. |
| `MONGO_FRAMES` |   | `peepshow_frames` | Frames collection name. |

## Usage

```bash
export MONGO_URL="mongodb://localhost:27017"
export MONGO_DB="peepshow"
peepshow ./clip.mp4 --sink mongodb
```

Optional flags:
- `--when` filters so the sink only fires for matching inputs (see [PLUGINS.md](../PLUGINS.md)).
- Pair with `peepshow sinks add mongodb` for auto-invocation.

## Document shape

Run document:

```js
{
  _id: ObjectId("..."),
  created_at: ISODate("..."),
  strategy: "scene",
  output_dir: "/tmp/peepshow-...",
  video: { codec, durationSeconds, width, height, tags: { … }, … },
  extraction: { ffmpegSource, … }
}
```

Frame document (one per emitted frame, foreign-keyed by `run_id`):

```js
{ run_id: ObjectId("..."), ordinal: 1, path: "…/frame_0001.jpg", bytes: 120345 }
```

JOIN with `db.peepshow_frames.aggregate([{ $lookup: { from: "peepshow_runs", ... } }])` for the full timeline.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Run + frames inserted. |
| 2 | Missing `MONGO_URL` or `MONGO_DB`. |
| 3 | `mongodb` not installed. |
| 4 | stdin malformed. |
| 5 | Runtime failure (connection, auth, write concern rejection). |

## Caveats

- No indexes are created automatically — add `{ run_id: 1 }` on the frames collection and `{ "video.tags.title": 1 }` etc. on the runs collection if your queries need them.
- The frames collection is written with `insertMany`, not a bulk op: a single malformed document fails the whole batch for that run, but the run document was already inserted. If that matters, wrap in a transaction on your side.
- Atlas users: make sure your IP is allow-listed and the connection string includes `retryWrites=true&w=majority` (Atlas defaults — confirm in the cluster UI).

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
export MONGO_URL="mongodb://localhost:27017"
export MONGO_DB="peepshow"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add mongodb
# Optional: only fire for matching inputs
peepshow sinks add mongodb --when extension=mp4,mov
peepshow sinks add mongodb --when director=Kubrick
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
> then forwards the run to the `MongoDB` sink.
>
> **`MongoDB`**: inserts one run document plus one frame document per emitted frame, linked by `run_id`.
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

> **Transcript handling**: segments land in a `transcripts` collection linked to the run — lookup the run id to pull the full spoken content.

*Full list + links: [docs/sinks/README.md](./README.md).*
