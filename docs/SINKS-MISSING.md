# Sinks we haven't built yet (but probably should)

This is a scouting list of popular AI/LLM tools and developer-facing systems where a peepshow sink would obviously pay off. Grouped by category, ordered (roughly) by expected impact and API maturity.

Every entry below is "drop-in fit" — the peepshow JSON payload on stdin cleanly maps onto the system's write surface. Community PRs welcome: see `docs/sinks/skeletons.md` for the pattern.

## Vector stores & AI memory

These ingest frames + tags + extracted metadata as embeddings or graph nodes so an LLM can later recall "the scene where X happened" without re-processing the video.

- **Chroma** — local-first, SQLite-backed. API is a Node/Python client. Low friction.
- **Qdrant** — REST + gRPC; easy Node client. Self-hosted friendly (docker).
- **Weaviate** — REST + GraphQL. Batch insert of frame embeddings.
- **Pinecone** — hosted only; needs API key. Upsert by run id.
- ~~**Milvus**~~ — shipped (`peepshow-sink-milvus`).
- **pgvector** — extension on top of our existing Postgres sink. Trivial add: one extra column + an extension check.
- **Mem0** — AI memory SDK with cloud + self-hosted options. Has a clean Node SDK.
- **Zep** — long-term memory for agents. REST API, clean Node client.
- ~~**Letta**~~ (formerly MemGPT) — shipped (`peepshow-sink-letta`).

## AI coding / workspace tools (beyond Cursor/Windsurf/Zed already covered)

- **Continue** (VS Code/JetBrains extension) — has a workspace context folder; similar to our `peepshow-sink-ide`. Minor fork.
- **Cody** (Sourcegraph) — attach via `.cody/` workspace files.
- **Aider** — local `.aider.chat.history.md` plus image refs.
- **Roo Code**, **Kilo Code**, **Cline**, **RooVetGit** — all VS Code forks with workspace attachments.
- **Claude.ai Projects** — no public upload API yet; watch for when they open it.
- **ChatGPT Custom GPTs / Projects** — OpenAI Files API has `/files` endpoint; sink could pre-upload.

## Issue trackers / PM

Attach video evidence to a ticket so the LLM-assisted triage flow has frames, not just prose.

- **Linear** — GraphQL API, attachments endpoint. Highest-value sink for dev teams.
- **GitHub Issues / PRs** — REST v3 or GraphQL v4; `gh` CLI fallback.
- **Jira Cloud / Data Center** — REST with `/issue/{key}/attachments`.
- **Height** — API + webhooks.
- ~~**Asana**~~ — shipped (`peepshow-sink-asana`).
- ~~**ClickUp**~~ — shipped (`peepshow-sink-clickup`).
- ~~**Trello**~~ — shipped (`peepshow-sink-trello`).
- ~~**Shortcut**~~ — shipped (`peepshow-sink-shortcut`).
- **Raycast Script Commands** — wrap peepshow in a Raycast command; user gets a "extract and share" action menu.

## Boards & whiteboards

- ~~**Miro**~~ — shipped (`peepshow-sink-miro`).
- ~~**FigJam / Figma**~~ — shipped (`peepshow-sink-figma` — posts a file comment with run summary + frame list).
- **Whimsical** — API in beta; watch for public release.
- **Excalidraw Plus** — no public API yet; can export JSON with embedded image refs.

## Object storage (beyond the S3-compatible one we ship)

Our S3 sink covers: AWS S3, MinIO, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, Linode Object Storage, Wasabi, iDrive e2, Scaleway, Oracle OCI, IBM Cloud Object Storage. All configured via `S3_ENDPOINT`.

Separate SDKs still worth dedicated sinks:
- ~~**Google Cloud Storage**~~ — shipped (`peepshow-sink-gcs`).
- ~~**Azure Blob Storage**~~ — shipped (`peepshow-sink-azure-blob`).
- ~~**Dropbox**~~ — shipped (`peepshow-sink-dropbox`).
- ~~**Google Drive**~~ — shipped (`peepshow-sink-gdrive`).
- ~~**Box**~~ — shipped (`peepshow-sink-box`).
- ~~**Supabase Storage**~~ — shipped (`peepshow-sink-supabase`).
- **Firebase Storage** — Google SDK; good for mobile flows.

## Observability / incident tooling

Attach video of a bug as evidence.

- **Sentry** — `attach` to an issue event.
- **Datadog** — add as a note/attachment on an incident.
- ~~**PagerDuty**~~ — shipped (`peepshow-sink-pagerduty`).
- **Opsgenie**, **Grafana Oncall** — same shape.
- **Honeycomb**, **New Relic** — less natural fit; probably a webhook instead.

## Event tracking / product analytics

Log "a peepshow run happened" as a product event.

- **PostHog** — `capture` event with frames metadata.
- ~~**Plausible**~~ — shipped (`peepshow-sink-plausible`).
- ~~**Mixpanel / Amplitude / Segment**~~ — shipped as unified `peepshow-sink-event-track` with `EVENT_TRACK_PROVIDER` flag.

## Note / wiki systems (beyond Obsidian)

- **Notion** — already on our build list; keep moving it up.
- ~~**Logseq**~~ — shipped (`peepshow-sink-logseq`).
- **Roam Research** — API in flux; scrape-level workarounds exist.
- **Tana** — API private beta.
- **Craft** — no public API.
- **Bear / Apple Notes / Things 3** — macOS-only, AppleScript/x-callback-url based.
- **Outline** — self-hosted wiki; clean REST API.
- **Confluence** — REST v1/v2; page-create + attach-image.

## Chat / messaging (beyond Slack/Discord already covered)

- ~~**Microsoft Teams**~~ — shipped (`peepshow-sink-msteams`).
- ~~**Telegram Bot API**~~ — shipped (`peepshow-sink-telegram`).
- ~~**Matrix**~~ — shipped (`peepshow-sink-matrix`).
- ~~**Mattermost**~~ — shipped (`peepshow-sink-mattermost`).
- ~~**Rocket.Chat**~~ — shipped (`peepshow-sink-rocketchat`).
- ~~**Zulip**~~ — shipped (`peepshow-sink-zulip`).
- **WhatsApp Cloud API** — message templates; stricter rate limits.

## macOS-specific (AppleScript/Shortcuts)

- **iMessage** — `osascript` with Messages.app; attach frames to a conversation.
- **Apple Notes / Reminders** — `Notes.app` via AppleScript.
- **Shortcuts app** — expose peepshow runs as input to user-built Shortcuts.

## Low-code / automation platforms

Less like sinks, more like "trigger points" — each has a webhook we can POST to and the user builds the downstream flow in their platform of choice.

- **Zapier / Make (Integromat) / n8n / Activepieces / Node-RED** — covered by our generic `--sink-cmd` + webhook today. A dedicated sink could add signing/retry tuned per platform.
- **Pipedream** — REST sources + workflows; natural fit.

## Prioritisation for next wave

If we pick 5 more sinks to build next, the highest leverage are:

1. **pgvector** — extends our Postgres sink with vector embeddings. Unlocks retrieval.
2. **Linear** — huge for dev teams; well-documented GraphQL API.
3. **Chroma** (or Qdrant) — local vector memory with minimal setup.
4. **Sentry** — incident evidence is a killer use case.
5. **Zep / Mem0** — general AI memory, growing audience.

Volunteer for any — see `docs/sinks/skeletons.md` for the contribution pattern.
