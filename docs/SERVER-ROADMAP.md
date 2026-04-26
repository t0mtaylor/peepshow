# Phase 2 — `peepshow serve`

Phase 1 ([`docs/REPORT.md`](./REPORT.md)) writes a per-run `manifest.json` + `report.html` + appends to a global `~/.peepshow/runs/index.ndjson`. Phase 2 turns that pile of files into a local-first dashboard you can leave running.

This doc is the in-flight design — open to feedback before we start building.

---

## Goal

Spawn a local HTTP server that:

- Indexes the ndjson + every per-run `manifest.json` for a homepage of all runs.
- Serves per-run detail pages reusing the `report.html` shell + components.
- Exposes a sink-management GUI: list auto-sinks, add/remove, edit `--when` rules, fire test runs against existing payloads.
- Optionally migrates the index to SQLite when run count crosses ~10K (ndjson stays the source of truth; SQLite becomes a derived read index).

Local first. No cloud. No telemetry beyond what already ships.

---

## CLI surface

```bash
peepshow serve                      # default :7331, ~/.peepshow/runs/
peepshow serve --port 8080          # override port
peepshow serve --root <path>        # override scan root (defaults to PEEPSHOW_RUNS_INDEX dir)
peepshow serve --open               # spawn the OS opener on the homepage
peepshow serve --bind 127.0.0.1     # bind interface (default loopback only)
peepshow serve --no-watch           # disable filesystem watch (just serve current snapshot)
```

`--bind 0.0.0.0` is allowed but prints a warning — there's no auth, runs may contain sensitive frames + transcripts, and the server should never face the open internet.

---

## Routes

| Method | Path | Purpose |
| :----- | :--- | :------ |
| `GET`  | `/` | Homepage: table of all runs (newest first, search + filter). |
| `GET`  | `/runs/:runId` | Detail page reusing the `report.html` shell. |
| `GET`  | `/runs/:runId/manifest.json` | Raw manifest. |
| `GET`  | `/runs/:runId/frames/:idx` | Stream a frame (proxies the local file). |
| `GET`  | `/runs/:runId/audio.m4a` | Stream the audio (when present). |
| `POST` | `/runs/:runId/annotate` | Same shape as `peepshow report annotate` (JSON body → `manifest.analysis`). |
| `POST` | `/runs/:runId/sink/:name/test` | Re-fire a single sink against the existing payload. |
| `GET`  | `/sinks` | Auto-sink management page. |
| `POST` | `/sinks` | Add an auto-sink. |
| `DELETE` | `/sinks/:idx` | Remove. |
| `PATCH` | `/sinks/:idx` | Edit `--when` clause. |
| `GET`  | `/api/runs.json` | Cursor-paginated run list (for the future Mac status-bar app, etc). |
| `GET`  | `/healthz` | `{"ok":true,"version":"0.x.x"}` |

---

## Architecture

- **No new runtime deps.** Phase 2 sticks to native `node:http`, `fs/promises`, and the existing report bundle. Any HTML the server produces shares the same `dist/report.js` asset constants the standalone report uses.
- **Single binary.** `dist/serve.js` is a new entry alongside `dist/cli.js` — esbuild bundles it the same way. `peepshow-serve` shell wrapper added under `bin/`.
- **No background process.** Server runs in the foreground when invoked. No daemon, no `launchd`/`systemd` glue (out of scope for phase 2).
- **Watcher.** `chokidar` is too heavy — phase 2 polls the ndjson size + per-run dirs every 2s. Cheap, no deps, perfectly adequate for a single user.

### Storage modes

1. **Phase 2.0 — pure ndjson.** Read the index lazily. Each detail request reads the per-run `manifest.json` from disk. Suitable for ≤ 1K runs.
2. **Phase 2.1 — SQLite mirror (opt-in).** When `peepshow serve --sqlite` is set or run count > 10K, mirror the ndjson into `~/.peepshow/runs/index.sqlite` for fast filter/sort. ndjson is still the source of truth — SQLite is rebuilt from it on startup if missing or stale.

### Auth

Phase 2.0: none. Loopback bind by default. The server is for the user who started it.

If `--bind 0.0.0.0` is passed, require `--token <hex>` (random per-process token, set in URL: `?token=…`). No accounts, no sessions — single-user model. Anything more is out of scope for phase 2.

---

## Out of scope for phase 2

- Multi-user / RBAC.
- Cloud-hosted version.
- Run mutation (only annotate + sink test). No edit/delete of historical runs from the UI — those should remain immutable.
- New transcription providers (handled by phase 1).
- LLM vision auto-captioning (`--describe` flag) — separate proposal.

---

## Open questions

- **Frame streaming over HTTP**: the current report uses `file://` URLs which only work locally. Phase 2 swaps those for `/runs/:id/frames/:idx` URLs when serving via HTTP. Need a render-time toggle: `renderReport({ manifest, baseUrl: '/runs/abc/' })`. Backward-compatible — defaults to `file://` paths.
- **Watcher cost**: 2s poll across many runs scales poorly past O(1K). Either bump to a longer interval at scale or migrate to platform-specific watchers (`fs.watch`).
- **Sink test isolation**: re-firing a sink against an old payload could collide with the original (e.g. webhook deduplication). Probably need a `?dry-run=1` mode that pipes payload to stderr instead of stdout.

---

## Migration

Phase 2 is purely additive. Phase 1 users keep their existing manifests + ndjson. Running `peepshow serve` once mirrors the data into the SQLite cache (if enabled) but never modifies the source files.

Schema bump only happens if breaking changes land — `MANIFEST_SCHEMA_VERSION` jumps to 2 + ships a migration in the same release. Unknown future versions cause `peepshow serve` to refuse to start with a clear error message.

---

## Timeline

Phase 2 starts after phase 1 is shipped + the user has lived with it for a release cycle. The ndjson + manifest format is the contract — phase 2 is a UI on top, not a rewrite.
