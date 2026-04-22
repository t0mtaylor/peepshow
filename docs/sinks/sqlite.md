# peepshow-sink-sqlite

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
