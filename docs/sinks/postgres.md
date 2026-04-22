# peepshow-sink-postgres

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
