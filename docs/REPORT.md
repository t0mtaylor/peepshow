# Reports & runs

Every successful `peepshow` extract writes three things into the run's `outputDir` (alongside the frames + audio):

| File | Purpose |
| :--- | :------ |
| `manifest.json` | Locked-shape JSON record of the run — schema version, video metadata, frame paths, sink fan-out, host info, and any LLM analysis. |
| `report.html` | Self-contained HTML dashboard. Inlined CSS + JS, opens offline. Shows summary, frames grid w/ lightbox, transcript, sink fan-out, raw manifest tree. |
| ndjson append | One line in `~/.peepshow/runs/index.ndjson` — runId + outputDir + filename + duration + sink count. The `peepshow runs` subcommand reads this; the future `peepshow serve` server will too. |

<!-- gif:report -->

All three are **on by default** and opt-out via flags + env vars (see below).

---

## Flag reference

| Flag | Env var | Effect |
| :--- | :------ | :----- |
| `--no-report` | `PEEPSHOW_NO_REPORT=1` | Skip writing `report.html`. Manifest + ndjson still write. |
| `--no-manifest` | `PEEPSHOW_NO_MANIFEST=1` | Skip both `manifest.json` AND ndjson append. Report still writes if not also `--no-report`. |
| `--no-index` | `PEEPSHOW_NO_INDEX=1` | Skip ndjson append only. Manifest + report still write. |
| `--report-dir <path>` | — | Override `report.html` location (default: `outputDir`). |
| `--report-open` | — | Spawn the OS default opener (`open` / `xdg-open` / `start`) on the rendered report. |
| — | `PEEPSHOW_RUNS_INDEX=<path>` | Override ndjson location (default: `~/.peepshow/runs/index.ndjson`). |

---

## Manifest schema (v1)

`manifest.json` is locked by `tests/contract.test.ts` so phase-2 consumers can rely on it:

```json
{
  "schemaVersion": 1,
  "runId": "20260425T194212123-abc123",
  "createdAt": "2026-04-25T19:42:12.123Z",
  "peepshowVersion": "0.7.0",
  "command": "peepshow ./demo.mp4 --emit json",
  "input": {
    "kind": "path",
    "originalPath": "./demo.mp4",
    "filename": "demo.mp4",
    "sizeBytes": 7030272
  },
  "outputDir": "/tmp/peepshow-abc",
  "strategy": "scene",
  "video": { "...": "same shape as --emit json `video` block" },
  "extraction": { "...": "same as --emit json `extraction`" },
  "frames": [ { "path": "...", "bytes": 12345 } ],
  "audio": { "...": "AudioInfo + transcript" },
  "sinks": [
    {
      "sink": { "kind": "name", "value": "slack" },
      "name": "slack",
      "status": "ok",
      "ok": true,
      "exitCode": 0,
      "stderr": "",
      "durationMs": 12.4,
      "when": { "...": "optional --when clause" },
      "skipReason": "..."
    }
  ],
  "host": {
    "platform": "darwin",
    "node": "v22.22.1",
    "ffmpeg": { "source": "system", "path": "/opt/homebrew/bin/ffmpeg" }
  },
  "exitCode": 0,
  "elapsedMs": 1234,
  "analysis": {
    "summary": "...",
    "perFrame": [ { "idx": 0, "text": "..." } ],
    "provider": "claude-code",
    "model": "claude-opus-4-7",
    "generatedAt": "2026-04-25T19:43:00.000Z",
    "source": "stdin-annotate"
  }
}
```

`analysis` is the only optional field; everything else is always present. Schema is forward-compatible — additive optional fields stay at version 1; breaking changes will bump it and ship a migration in `peepshow serve`.

---

## Closing the loop — LLM analysis

The point: when `peepshow` is invoked from inside an LLM-driven workflow (Claude Code, Cursor, Windsurf, Cline, Codex, Gemini), the LLM is the consumer that *understands* the frames. Have it write that understanding back into the report so the next viewer doesn't have to rerun the model.

```bash
echo '{
  "summary":"<2-4 sentences describing the timeline>",
  "perFrame":[{"idx":0,"text":"<frame 1 caption>"}, ...],
  "provider":"claude-code",
  "model":"claude-opus-4-7"
}' | peepshow report annotate "<outputDir>"
```

`<outputDir>` is the `outputDir` field from the run's JSON output. The annotate subcommand:

1. Reads `manifest.json` from the directory.
2. Parses stdin as JSON (or plain text → treated as `summary`).
3. Merges into `manifest.analysis` (atomic write via tmp + rename).
4. Re-renders `report.html`.

The "LLM analysis" section appears at the top of the report with provider/model badges and collapsible per-frame captions.

<!-- gif:report-outro -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/report-outro.gif" alt="peepshow report — Summary, LLM analysis, sink fan-out, then the annotate command closes the loop" width="720">
</p>
<!-- /gif:report-outro -->

Every supported agent has the annotate instruction wired in:

- `skills/slides/SKILL.md` (Claude Code plugin)
- `.cursor/rules/peepshow.mdc`
- `.windsurf/rules/peepshow.md`
- `.clinerules/peepshow.md`
- `.codex/hooks.json`
- `AGENTS.md` (also sourced by `GEMINI.md`)
- `docs/INTEGRATIONS.md` per-tool sections

---

## Subcommands

### `peepshow report <run-dir>`

Re-render `report.html` from an existing `manifest.json`. Useful when:

- You ran `--no-report` initially and want the dashboard now.
- Peepshow upgraded — regenerate with the newer template.
- The bundled `report.html` was deleted but `manifest.json` is intact.

### `peepshow report annotate <run-dir>`

Read JSON or text from stdin, merge into `manifest.analysis`, re-render report. See the closing-the-loop section above.

### `peepshow runs list`

Show every run from the ndjson index, newest-first:

```
✗ 20260425T210000000-xyz  2026-04-25T21:00:00.000Z  big.mp4   60.5s  3 sinks  v0.7.0
✓ 20260425T194212123-abc  2026-04-25T19:42:12.123Z  demo.mp4  12.5s  0 sinks  v0.7.0

2 runs (~/.peepshow/runs/index.ndjson)
```

### `peepshow runs show <runId>`

Dump that run's `manifest.json` to stdout. Pipe through `jq` for slicing.

### `peepshow runs prune`

Drop entries whose `outputDir` no longer exists on disk. Useful after `/tmp` gets wiped on reboot.

### `peepshow runs clear`

Truncate the index file (no confirmation prompt — fast for scripts).

---

## User preferences (`peepshow config`)

Per-machine prefs at `~/.peepshow/config.json` (override via `PEEPSHOW_CONFIG_FILE`). First-run hint on stderr the first time peepshow runs in a TTY suggests `peepshow config init` — a one-shot wizard that sets the report defaults so you don't have to pass `--report-open` etc. every time.

| Key | Type | Default | Meaning |
| :-- | :--- | :------ | :------ |
| `report.enabled` | bool | `true` | Write `report.html` on every run. (Set `false` for the same effect as `--no-report`.) |
| `report.autoOpen` | bool | `false` | Open the report in your browser after each run (no need to pass `--report-open`). |
| `report.browser` | enum | `default` | `default \| chrome \| firefox \| safari \| edge \| brave \| arc`. The cross-platform launcher resolves to `open -a "<App>"` on macOS, the browser binary on Linux, `start <alias>` on Windows. |

### CLI

```bash
peepshow config init                  # interactive wizard (first-run UX)
peepshow config list                  # JSON dump of the full config
peepshow config get report.browser    # print one value
peepshow config set <key> <value>     # set + persist
peepshow config export [path]         # write to <path> or stdout (when omitted)
peepshow config import <path>         # atomically replace from <path>
peepshow config reset                 # delete the config file
```

`export` / `import` are how you copy prefs between machines or back them up before a `reset`. Import is strict on `schemaVersion` — unknown versions are rejected with a clear error so a future format change can't quietly corrupt prefs.

### Env-var overrides (precedence: env > config > defaults)

- `PEEPSHOW_BROWSER=chrome` — force a specific browser for one invocation
- `PEEPSHOW_REPORT_OPEN=1` — force `--report-open` for one invocation
- `PEEPSHOW_CONFIG_FILE=/path/to/config.json` — alt config location

---

## File layout

After a run with all defaults:

```
/tmp/peepshow-abc/
├── audio.m4a                # extracted audio (when present)
├── frame_0001.jpg
├── frame_0002.jpg
├── ...
├── manifest.json            # full run record
└── report.html              # self-contained HTML dashboard

~/.peepshow/runs/
└── index.ndjson             # append-only run history (one line per run)
```

`report.html` is `~18KB` minified — CSS, JS, and HTML scaffold are all pre-minified at build time and baked into the bundled `dist/report.js`. Source files (`src/report/style.css`, `template.html`, `app.js`) never ship to npm; only the bundled output does.

---

## Local server — `peepshow serve` (shipped in 0.8.0)

`peepshow serve` spawns a local HTTP server that:

- Indexes `~/.peepshow/runs/index.ndjson` for a homepage of every run.
- Serves per-run detail pages reusing the `report.html` shell with served frame URLs (no `file://` quirks).
- Streams frames + audio so the report works in browsers that block local file paths.
- Exposes a tiny sink-management GUI at `/sinks`: list, add, remove auto-sinks.
- Lets external agents pipe LLM analysis over HTTP via `POST /runs/:runId/annotate` — same shape as the CLI's `peepshow report annotate`.
- Loopback by default; non-loopback bind requires a token.

```bash
peepshow serve                       # http://127.0.0.1:7331/
peepshow serve --port 8080 --open    # custom port + auto-open
```

Defaults seed from `peepshow config init` (`serve.port`, `serve.host`, `serve.autoOpen`). The ndjson + manifest format stays the source of truth — the server is a UI on top, not a rewrite.

Full reference: [`docs/SERVE.md`](./SERVE.md). Original design notes: [`docs/SERVER-ROADMAP.md`](./SERVER-ROADMAP.md).

### Phase 2.1 (deferred)

SQLite mirror for >10K runs (opt-in) — ndjson stays source of truth, SQLite is a derived index. Not blocking for the current ship.
