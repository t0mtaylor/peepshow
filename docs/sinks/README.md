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

## Skeletons (need community input)

See [skeletons.md](./skeletons.md) for the state of each and what a PR should add.

- `cognee` · `mempalace` · `perplexity` · `antigravity`

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
