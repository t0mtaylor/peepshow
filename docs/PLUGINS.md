# peepshow sink plugins

Peepshow ships a **sink plugin** system so the extracted frames and metadata can fan out to anywhere — shared folders, databases, HTTP endpoints, GraphQL mutations, LLM memory stores, notebook systems.

A **sink** is just an executable that reads a JSON payload on stdin. Any language. Any system. If it can be invoked from a shell and read stdin, it can be a peepshow sink.

> **Naming note.** "Plugin" in this doc means a peepshow sink plugin — an output/storage backend for peepshow runs. This is unrelated to the Claude Code plugin format that peepshow itself ships as.

> **Reports cross-link.** Each sink's status (✅ ok / ❌ failed / ⏭ skipped, exit code, stderr, `--when` clause) lands in the per-run [HTML report](./REPORT.md)'s "Sinks" section, so users can see at a glance which sinks fired vs failed vs were filtered out. The same `SinkResult` shape is part of the locked `manifest.json` schema (v1) — phase 2's `peepshow serve` will surface the same data over HTTP.

---

## Contract

Peepshow invokes sinks once extraction succeeds (exit 0, ≥1 frame on disk) and before the formatted stdout is written.

### Invocation

Two invocation forms:

| Flag | Example | Resolves to |
| :--- | :------ | :---------- |
| `--sink <name>` | `--sink folder` | `peepshow-sink-folder` on `$PATH` |
| `--sink <name:arg1:arg2>` | `--sink folder:/tmp/shared` | `peepshow-sink-folder /tmp/shared` |
| `--sink-cmd <shell>` | `--sink-cmd 'node /opt/my-sink.js'` | executed in a shell |

Both flags are repeatable — you can fan out to any number of sinks in one run.

Name validation rejects anything outside `[a-zA-Z0-9._-]` to avoid shell injection via `--sink`. Use `--sink-cmd` for arbitrary commands.

### Persistent auto-sinks

`peepshow sinks add <name[:arg]> [--when key=value ...]` persists a sink into `~/.peepshow/sinks.json` (override with `PEEPSHOW_AUTO_SINKS_FILE`). Auto-sinks fire on every extract unless `--no-auto-sinks` is passed. Manage with:

```bash
peepshow sinks list
peepshow sinks add folder:/Volumes/Shared --when extension=mp4,mov
peepshow sinks add-cmd 'node /opt/x.js' --when path=/Volumes/Work/
peepshow sinks remove 2
peepshow sinks clear
```

The statusline badge shows the armed count: `[PEEPSHOW|3s]`.

### Conditional matching (`--when`)

Sinks can declare match rules so they only fire on compatible inputs. Supported keys:

| Key | Matches against | Form |
| :-- | :-------------- | :--- |
| `extension` (alias `ext`) | input file's extension | `mp4`, `.mov`, `mp4,mov` |
| `filename` | input's basename | glob pattern (`*`, `?`) |
| `path` | full input path | substring OR glob |
| `container` | `video.container` from ffmpeg probe | `mov`, `mp4`, `matroska`, ... |
| `codec` | `video.codec` | `h264`, `hevc`, `vp9`, ... |
| `<any video tag>` | `video.tags[key]` exact equality | `director=Kubrick`, `genre=Thriller` |

Rules compose: multiple `--when` flags AND together, comma-separated values inside one clause OR. Skipped sinks are logged with a one-liner on stderr. Sink authors don't need to do anything — filtering happens in peepshow before your binary is invoked.

### Input

Peepshow pipes a UTF-8 JSON document to the sink's stdin. Shape matches the `--emit json` contract (locked down by `tests/contract.test.ts`):

```json
{
  "outputDir": "/tmp/peepshow-abc",
  "strategy": "scene",
  "frames": [
    { "path": "/tmp/peepshow-abc/frame_0001.jpg", "bytes": 42321 },
    { "path": "/tmp/peepshow-abc/frame_0002.jpg", "bytes": 38104 }
  ],
  "video": {
    "durationSeconds": 12.5,
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "codec": "h264",
    "bitrateKbps": 4500,
    "container": "mov",
    "sizeBytes": 7030272,
    "estimatedTotalFrames": 375
  },
  "extraction": {
    "strategy": "scene",
    "threshold": 0.3,
    "fps": null,
    "framesEmitted": 2,
    "framesBeforePrune": 2,
    "framesPruned": 0,
    "totalOutputBytes": 80425,
    "avgFrameBytes": 40212,
    "elapsedMs": 187.24,
    "ffmpegSource": "system",
    "ffmpegPath": "/opt/homebrew/bin/ffmpeg"
  }
}
```

Frame paths in `frames[].path` point to JPEG/PNG files on disk. Sinks decide whether to read, copy, upload, hash, embed, etc.

### Output

| Stream | Peepshow's treatment |
| :----- | :------------------- |
| stdout | Ignored. Sink can log freely. |
| stderr | Captured. Echoed on peepshow's stderr only if the sink fails. |
| exit 0 | Success. Silent. |
| exit non-zero | Warning on peepshow's stderr; peepshow itself still exits 0 if extraction worked. |

Sinks are fire-and-forget from peepshow's perspective — a broken sink never rolls back a successful extraction.

### Environment

Sinks inherit peepshow's environment. Conventions:

- Store credentials in env vars (`DATABASE_URL`, `OBSIDIAN_VAULT`, `COGNEE_API_KEY`, …) — **never** hard-code.
- Use `PEEPSHOW_SINK_<NAME>_*` prefix for sink-specific config so users can tell at a glance which sink owns which var.

### Timing and backpressure

Sinks run **sequentially** in the order they were listed on the command line. This keeps stdout deterministic and avoids surprising the user with parallel DB writes. If you need parallelism, run peepshow once per sink or write your own dispatcher.

---

## Writing a sink

Any language works. Three complete starter patterns:

### Bash

```bash
#!/bin/bash
set -euo pipefail
PAYLOAD=$(cat)
RUN_ID=$(date +%s)
# …do something with $PAYLOAD
printf 'wrote run %s\n' "$RUN_ID"
```

### Node

```js
#!/usr/bin/env node
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', async () => {
  const payload = JSON.parse(raw);
  // …do something with payload
});
```

### Python

```python
#!/usr/bin/env python3
import json, sys
payload = json.load(sys.stdin)
# …do something with payload
```

### Make it discoverable

Name your executable `peepshow-sink-<yourname>` and put it on `$PATH`. Users then invoke it with `--sink yourname`.

Ship a README explaining:
- install/deps
- required env vars
- what it writes where
- any schema it creates on first run

---

## Built-in examples

Two reference sinks live under [`examples/sinks/`](../examples/sinks/):

| Sink | Language | Purpose |
| :--- | :------- | :------ |
| [`folder/`](../examples/sinks/folder/) | bash + jq | Copies frames + metadata.json into `<target>/<timestamp>-<strategy>/`. Ideal for Syncthing / Dropbox / NAS / Obsidian attachments. |
| [`mysql/`](../examples/sinks/mysql/) | Node + mysql2 | Upserts run into `peepshow_runs` + `peepshow_frames` tables. Creates schema on first call. |

Both have self-contained READMEs and install instructions.

---

## Integration ideas for community sinks

These are all feasible as small sinks — the JSON contract is stable, frames are on disk, the rest is just that system's API.

### Knowledge / memory systems (all shipped)

- **Obsidian** (`peepshow-sink-obsidian`) — Markdown note per run with embedded frame refs.
- **MemPalace** (`peepshow-sink-mempalace`) — spatial memory node with timeline metadata.
- **Zep / Mem0 / Letta** (`peepshow-sink-zep`, `peepshow-sink-mem0`, `peepshow-sink-letta`) — long-term agent memory.
- **Aider / Continue / Cody** (`peepshow-sink-aider`, `-continue`, `-cody`) — drop into the AI coding assistant's workspace context dir.
- **Notion / Logseq / Outline / Confluence / Apple Notes / Bear** — wiki/notes writeback.
- **OpenAI Files** (`peepshow-sink-openai-files`) — pre-upload frames for Custom GPTs / Assistants file-search.
- **IDE attachments** (`peepshow-sink-ide`) — auto-detects Cursor / Windsurf / Zed / VS Code project dirs.

### Storage / databases

- **PostgreSQL** — same shape as the MySQL example, swap `mysql2` for `pg`.
- **SQLite** — one-file archive of every run. Great for personal use.
- **MongoDB** — document-per-run with GridFS for the frame bytes.
- **S3 / R2 / GCS** — upload frames + metadata.json to an object bucket; bucket prefix = run ID.
- **Redis / Upstash** — push run metadata into a sorted set keyed by timestamp.
- **Algolia / Meilisearch** — index `video.*` metadata + frame paths for search.

### APIs & webhooks

- **REST webhook** — `POST` the JSON to any URL (Slack, Discord, Zapier, Make).
- **GraphQL** — issue a `mutation createPeepshowRun(payload: PeepshowRunInput!)`.
- **Cloud functions** — AWS Lambda / Cloudflare Workers / Vercel functions via HTTP.
- **Kafka / NATS / RabbitMQ** — publish the run to a topic for downstream consumers.

### Notebooks / docs

- **Notion** — create a page per run with a gallery block.
- **Confluence / Jira** — attach frames to an issue / page.
- **Logseq** — same pattern as Obsidian, different vault layout.

---

## Contributing a sink

We accept community sinks as PRs under [`examples/sinks/<name>/`](../examples/sinks/). Requirements:

1. **Self-contained.** Own `README.md` with install + env vars. Own `package.json` if it has Node deps. No changes to the peepshow core for a new sink.
2. **Stdin contract.** Reads the documented JSON shape. Doesn't assume extra fields beyond the contract (those may not exist).
3. **Graceful failure.** Clear error to stderr, meaningful exit code. Don't hang on a missing env var — fail fast.
4. **No network at install.** `npm install` should fetch deps; **do not** probe the target system or create schema at install time.
5. **Security.** Whitelist/sanitize anything derived from the payload before building SQL / shell commands / filesystem paths.
6. **Docs.** Explain what gets stored, where, and how to query or clean it up.

Open a PR against `main`. Name the sink `peepshow-sink-<thing>` and drop it under `examples/sinks/<thing>/`. One sink per PR keeps review easy.
