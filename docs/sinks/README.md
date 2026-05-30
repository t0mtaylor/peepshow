# Sink docs index

Every sink documented here reads the peepshow `--emit json` payload on stdin and persists / forwards it somewhere useful. Shape is locked down by [`tests/contract.test.ts`](../../tests/contract.test.ts) — it won't silently change.

## Built-in sinks (ship with peepshow)

Install once with `npm install -g peepshow`, then run from any shell or register as an auto-sink (`peepshow sinks add <name>`).

| Sink | Purpose | Docs |
| :--- | :------ | :--- |
| `sqlite` | Local archive, queryable with any SQLite tool | [sqlite.md](./sqlite.md) |
| `postgres` | Full-blown SQL archive | [postgres.md](./postgres.md) |
| `s3` | Any S3-compatible bucket (AWS, MinIO, R2, GCS, DO Spaces, B2, Wasabi, Azure-S3) | [s3.md](./s3.md) |
| `webhook` | Generic POST of payload to any URL | [webhook.md](./webhook.md) |
| `slack` | Slack incoming webhook with Block Kit | [slack.md](./slack.md) |
| `discord` | Discord webhook with embeds | [discord.md](./discord.md) |
| `graphql` | POST a mutation to any GraphQL endpoint | [graphql.md](./graphql.md) |
| `notion` | Create a Notion page per run | [notion.md](./notion.md) |
| `obsidian` | Write a markdown note + frame embeds into an Obsidian vault | [obsidian.md](./obsidian.md) |
| `ide` | Drop frames into Cursor/Windsurf/Zed/VS Code attachment folders | [ide.md](./ide.md) |
| `mempalace` | Write a mineable markdown note into a [MemPalace](https://github.com/MemPalace/mempalace) palace | [mempalace.md](./mempalace.md) |
| `zep` | Append a run summary + per-frame user messages to a [Zep](https://www.getzep.com/) memory session | [zep.md](./zep.md) |
| `mem0` | Write a run into [Mem0](https://mem0.ai) long-term memory scoped to a user | [mem0.md](./mem0.md) |
| `weaviate` | Batch-insert frames as objects into a [Weaviate](https://weaviate.io) class (server-side vectorizer) | [weaviate.md](./weaviate.md) |
| `jira` | Create a Jira issue (or attach to one) with an ADF body + one attachment per frame | [jira.md](./jira.md) |
| `posthog` | Capture a PostHog `peepshow_run` product event (+ optional per-frame events) | [posthog.md](./posthog.md) |
| `telegram` | Post a run to a Telegram chat via Bot API (summary + `sendMediaGroup` albums) | [telegram.md](./telegram.md) |
| `ntfy` | Push the run summary to an [ntfy.sh](https://ntfy.sh) topic (cloud or self-hosted) for instant phone / desktop alerts | [ntfy.md](./ntfy.md) |
| `apprise` | Fan out to 80+ services (Slack, Discord, Telegram, email, SMS, …) via an [Apprise API](https://github.com/caronc/apprise-api) instance | [apprise.md](./apprise.md) |
| `msteams` | Microsoft Teams Incoming Webhook — Adaptive Card with metadata + optional image embeds | [msteams.md](./msteams.md) |
| `datadog` | Datadog `/api/v1/events` — attach a peepshow run to an incident timeline or event stream | [datadog.md](./datadog.md) |
| `outline` | Create a markdown doc per run in [Outline](https://www.getoutline.com) (draft or published) | [outline.md](./outline.md) |
| `confluence` | Create a Confluence Cloud page per run (`/wiki/api/v2/pages`, storage-format body) | [confluence.md](./confluence.md) |
| `mattermost` | Mattermost Incoming Webhook — Slack-compatible attachment with metadata + optional image embeds | [mattermost.md](./mattermost.md) |
| `rocketchat` | Rocket.Chat Incoming Webhook — Slack-compatible attachments with metadata + optional image embeds | [rocketchat.md](./rocketchat.md) |
| `zulip` | Post a markdown message to a Zulip stream/topic via `/api/v1/messages` | [zulip.md](./zulip.md) |
| `matrix` | Upload frames to a Matrix homeserver media repo, then send summary + `m.image` events | [matrix.md](./matrix.md) |
| `asana` | Create an Asana task (or attach to one) with one multipart attachment per frame | [asana.md](./asana.md) |
| `clickup` | Create a ClickUp task (or attach to one) with one attachment per frame | [clickup.md](./clickup.md) |
| `shortcut` | Create a Shortcut story (or attach to one) and link one file per frame | [shortcut.md](./shortcut.md) |
| `trello` | Create a Trello card (or attach to one) with one attachment per frame | [trello.md](./trello.md) |
| `pagerduty` | Fire a PagerDuty Events API v2 `trigger` event with run metadata | [pagerduty.md](./pagerduty.md) |
| `opsgenie` | Create an Opsgenie v2 alert per run with priority, tags, and the full frame list | [opsgenie.md](./opsgenie.md) |
| `event-track` | Unified sink for Mixpanel / Amplitude / Segment — one event per run | [event-track.md](./event-track.md) |
| `plausible` | Custom event to a Plausible Analytics site via `/api/event` | [plausible.md](./plausible.md) |
| `milvus` | Upsert one row per frame into a Milvus collection (zero-vector placeholder) | [milvus.md](./milvus.md) |
| `letta` | Post a peepshow run summary as a message to a Letta agent | [letta.md](./letta.md) |
| `miro` | Upload each frame to a Miro board as an image item, arranged on a grid | [miro.md](./miro.md) |
| `figma` | Post a single file comment on a Figma file with run summary + frame list | [figma.md](./figma.md) |
| `gcs` | Upload frames + `manifest.json` to a Google Cloud Storage bucket (ADC auth) | [gcs.md](./gcs.md) |
| `azure-blob` | Upload frames + `manifest.json` to an Azure Blob container (conn string or account+key) | [azure-blob.md](./azure-blob.md) |
| `supabase` | Upload frames + `manifest.json` to a Supabase Storage bucket | [supabase.md](./supabase.md) |
| `dropbox` | Upload frames + `manifest.json` to a Dropbox folder via `/2/files/upload` | [dropbox.md](./dropbox.md) |
| `gdrive` | Upload frames + `manifest.json` to a Google Drive folder via multipart | [gdrive.md](./gdrive.md) |
| `box` | Upload frames + `manifest.json` to a Box folder via simple upload | [box.md](./box.md) |
| `logseq` | Write a markdown page into a Logseq graph's `pages/` dir with frame embeds in `assets/` | [logseq.md](./logseq.md) |
| `raycast` | Expose peepshow runs as Raycast script commands on macOS — manifest + frames + companion "Show last run" script | [raycast.md](./raycast.md) |
| `apple-notes` | File a new note in Apple Notes.app on macOS with HTML body (metadata + inline frames + transcript) | [apple-notes.md](./apple-notes.md) |
| `apple-reminders` | Create a new reminder (todo task) in Apple Reminders.app on macOS with plain-text body + optional due date | [apple-reminders.md](./apple-reminders.md) |
| `bear` | File a markdown note in Bear (macOS / iOS) via `bear://x-callback-url/create` — supports `create` and `append` modes | [bear.md](./bear.md) |
| `things` | Create a todo in Things 3 (Cultured Code) on macOS / iOS via the `things:///add` x-callback-url scheme | [things.md](./things.md) |
| `shortcuts` | Invoke a user-created macOS Shortcut via the `shortcuts` CLI — pass the peepshow JSON payload or each frame image | [shortcuts.md](./shortcuts.md) |
| `airtable` | Create one record per run in an [Airtable](https://airtable.com) base — `Run ID` · `Title` · `Frames` · `Duration` · `Transcript` · `Thumbnail URL` · `Created At` | [airtable.md](./airtable.md) |
| `clickhouse` | Insert one row per run into a [ClickHouse](https://clickhouse.com) table via the HTTP interface (`FORMAT JSONEachRow`); auto-creates a `MergeTree` schema on first write | [clickhouse.md](./clickhouse.md) |
| `duckdb` | Append one row per run to a local [DuckDB](https://duckdb.org) file via the `duckdb` CLI — embedded columnar analytics, no server | [duckdb.md](./duckdb.md) |
| `elasticsearch` | Index one document per run into [Elasticsearch / OpenSearch](https://www.elastic.co/elasticsearch/) — full-text search over transcripts, titles, and container tags | [elasticsearch.md](./elasticsearch.md) |
| `granola` | Write a markdown bundle (`note.md` + `frames/`) per run into a [Granola](https://granola.ai) import directory — Granola's public API is read-only, so this is a drag-drop / paste bundle | [granola.md](./granola.md) |
| `meilisearch` | Index one document per run into a [Meilisearch](https://www.meilisearch.com) index — hybrid keyword + auto-embedding search; auto-creates the index on first write | [meilisearch.md](./meilisearch.md) |
| `typesense` | Upsert one document per run into a [Typesense](https://typesense.org) collection — soft-creates schema on first write, keyed on `id == run_id` | [typesense.md](./typesense.md) |
| `redis-vector` | Write one hash per run into Redis 8+ via `redis-cli` and issue `FT.CREATE` for [RediSearch](https://redis.io/docs/latest/develop/interact/search-and-query/) full-text + vector search | [redis-vector.md](./redis-vector.md) |
| `pushover` | Push the run summary to every device on a [Pushover](https://pushover.net) account — title · summary · priority · clickable frame URL | [pushover.md](./pushover.md) |
| `bluesky` | Post the run summary (title + frame count + duration, capped at 300 chars) to a [Bluesky](https://bsky.app) / AT Protocol account via app-password session | [bluesky.md](./bluesky.md) |
| `coda` | Append one row per run to a [Coda](https://coda.io) doc table — `Run ID` · `Title` · `Frames` · `Duration` · `Transcript` · `Thumbnail URL` · `Created At` | [coda.md](./coda.md) |
| `snowflake` | Insert one row per run into a [Snowflake](https://www.snowflake.com) table via the SQL API v2 (`POST /api/v2/statements`); auto-creates the table on first write; tags stored as `VARIANT` | [snowflake.md](./snowflake.md) |
| `bigquery` | Stream one row per run into a [Google BigQuery](https://cloud.google.com/bigquery) table via the `tabledata.insertAll` REST endpoint — OAuth2 access token, `run_id` doubles as the `insertId` for streaming dedup | [bigquery.md](./bigquery.md) |
| `fireflies` | Hand the extracted audio URL to [Fireflies.ai](https://fireflies.ai) via the `uploadAudio` GraphQL mutation — meeting-style transcription + indexing in the Fireflies dashboard | [fireflies.md](./fireflies.md) |
| `zoom` | Post the run summary as a [Zoom Team Chat](https://developers.zoom.us/docs/api/chat/) message to a user (by email) or channel (by JID) — title · metadata · transcript preview | [zoom.md](./zoom.md) |
| `plane` | File a work item per peepshow run on [Plane](https://plane.so) (open-source Linear/Jira alt) — cloud or self-hosted via REST API | [plane.md](./plane.md) |
| `mastodon` | Post a status to any Mastodon / Fediverse instance — auto-truncated to 500 chars, configurable visibility | [mastodon.md](./mastodon.md) |
| `anytype` | Create an object in a local-first [Anytype](https://anytype.io) vault via the desktop app's HTTP API | [anytype.md](./anytype.md) |
| `algolia` | Index each run into an [Algolia](https://www.algolia.com) index — `objectID = run_id` so re-runs upsert cleanly | [algolia.md](./algolia.md) |
| `otter` | Webhook fan-out intended for Zapier / Make / n8n → [Otter.ai](https://otter.ai) Create Note (Otter has no public write API) | [otter.md](./otter.md) |
| `databricks` | Insert one row per run into a [Databricks](https://www.databricks.com) Delta table via the [Statement Execution API](https://docs.databricks.com/api/workspace/statementexecution) (`POST /api/2.0/sql/statements/`); auto-creates the table on first write | [databricks.md](./databricks.md) |
| `cassandra` | Insert one row per run into a [Cassandra](https://cassandra.apache.org) / [DataStax Astra](https://www.datastax.com/products/datastax-astra) table via the [Stargate REST API](https://stargate.io) (`POST /v2/keyspaces/<ks>/<table>`); table must pre-exist | [cassandra.md](./cassandra.md) |

## Skeletons (need community input)

See [skeletons.md](./skeletons.md) for the state of each and what a PR should add.

- `cognee` · `perplexity` · `antigravity`

## Community examples

Under [`examples/sinks/`](../../examples/sinks/) — written in any language, invoked via `--sink-cmd`:

- [`folder`](../../examples/sinks/folder/) — bash + jq archive to a shared folder
- [`mysql`](../../examples/sinks/mysql/) — Node + mysql2 replica of the postgres sink

## Contributing a new sink

1. Copy `src/builtin-sinks/graphql.ts` (for HTTP-based) or `obsidian.ts` (for filesystem-based) as a template.
2. Keep all logic in pure functions; only the `main()` at the bottom does I/O.
3. Add tests under `tests/builtin-sinks/<name>.test.ts`. Integration tests go in `<name>.integration.test.ts` gated on `PEEPSHOW_SINK_DOCKER_TESTS=1`.
4. Add a doc in this directory following the template: **What / Install / Env / Use / Examples / Caveats**.
5. Register the bin in `package.json` `bin` map.
6. Open a PR. Full list of wanted sinks: [`../SINKS-MISSING.md`](../SINKS-MISSING.md).
