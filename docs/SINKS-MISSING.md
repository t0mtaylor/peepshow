# Sinks we haven't built yet (but probably should)

This is a scouting list of popular AI/LLM tools and developer-facing systems where a peepshow sink would obviously pay off. Grouped by category, ordered (roughly) by expected impact and API maturity.

Every entry below is "drop-in fit" — the peepshow JSON payload on stdin cleanly maps onto the system's write surface. Community PRs welcome: see `docs/sinks/skeletons.md` for the pattern.

Last audit: 2026-04-24. **58 sinks shipping**; items crossed out are live.

## Vector stores & AI memory

These ingest frames + tags + extracted metadata as embeddings or graph nodes so an LLM can later recall "the scene where X happened" without re-processing the video.

- ~~**Chroma**~~ — shipped (`peepshow-sink-chroma`).
- ~~**Qdrant**~~ — shipped (`peepshow-sink-qdrant`).
- ~~**Weaviate**~~ — shipped (`peepshow-sink-weaviate`).
- ~~**Pinecone**~~ — shipped (`peepshow-sink-pinecone`).
- ~~**Milvus**~~ — shipped (`peepshow-sink-milvus`).
- ~~**pgvector**~~ — shipped (`peepshow-sink-pgvector`).
- ~~**Mem0**~~ — shipped (`peepshow-sink-mem0`).
- ~~**Zep**~~ — shipped (`peepshow-sink-zep`).
- ~~**Letta**~~ — shipped (`peepshow-sink-letta`).
- ~~**MemPalace**~~ — shipped (`peepshow-sink-mempalace`).

## AI coding / workspace tools (beyond Cursor/Windsurf/Zed already covered)

- ~~**Continue**~~ — shipped (`peepshow-sink-continue`).
- ~~**Aider**~~ — shipped (`peepshow-sink-aider`).
- **Cody** (Sourcegraph) — attach via `.cody/` workspace files. Not shipped.
- **Roo Code / Kilo Code / RooVetGit** — VS Code forks; `peepshow-sink-ide` + `peepshow-sink-continue` cover the workspace-drop pattern for these.
- **Claude.ai Projects** — no public upload API yet; watch for when they open it.
- **ChatGPT Custom GPTs / Projects** — OpenAI Files API has `/files` endpoint; sink could pre-upload. Not shipped.

## Issue trackers / PM

Attach video evidence to a ticket so the LLM-assisted triage flow has frames, not just prose.

- ~~**Linear**~~ — shipped (`peepshow-sink-linear`).
- ~~**GitHub Issues / PRs**~~ — shipped (`peepshow-sink-github-issues`).
- ~~**Jira Cloud / Data Center**~~ — shipped (`peepshow-sink-jira`).
- ~~**Height**~~ — shipped (`peepshow-sink-height`).
- ~~**Asana**~~ — shipped (`peepshow-sink-asana`).
- ~~**ClickUp**~~ — shipped (`peepshow-sink-clickup`).
- ~~**Trello**~~ — shipped (`peepshow-sink-trello`).
- ~~**Shortcut**~~ — shipped (`peepshow-sink-shortcut`).
- ~~**Raycast Script Commands**~~ — shipped (`peepshow-sink-raycast`).

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
- ~~**Firebase Storage**~~ — shipped (`peepshow-sink-firebase-storage`).

## Observability / incident tooling

Attach video of a bug as evidence.

- ~~**Sentry**~~ — shipped (`peepshow-sink-sentry`).
- ~~**Datadog**~~ — shipped (`peepshow-sink-datadog`).
- ~~**PagerDuty**~~ — shipped (`peepshow-sink-pagerduty`).
- ~~**Opsgenie**~~ — shipped (`peepshow-sink-opsgenie`).
- **Grafana Oncall** — same shape as Opsgenie. Not shipped.
- **Honeycomb**, **New Relic** — less natural fit; users can reach these via our generic `peepshow-sink-webhook`.

## Event tracking / product analytics

Log "a peepshow run happened" as a product event.

- ~~**PostHog**~~ — shipped (`peepshow-sink-posthog`).
- ~~**Plausible**~~ — shipped (`peepshow-sink-plausible`).
- ~~**Mixpanel / Amplitude / Segment**~~ — shipped as unified `peepshow-sink-event-track` with `EVENT_TRACK_PROVIDER` flag.

## Note / wiki systems (beyond Obsidian)

- ~~**Obsidian**~~ — shipped (`peepshow-sink-obsidian`).
- ~~**Notion**~~ — shipped (`peepshow-sink-notion`).
- ~~**Logseq**~~ — shipped (`peepshow-sink-logseq`).
- ~~**Outline**~~ — shipped (`peepshow-sink-outline`).
- ~~**Confluence**~~ — shipped (`peepshow-sink-confluence`).
- **Roam Research** — API in flux; scrape-level workarounds exist.
- **Tana** — API private beta.
- **Craft** — no public API.
- **Bear / Apple Notes / Things 3** — macOS-only, AppleScript/x-callback-url based.

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

- **Zapier / Make (Integromat) / n8n / Activepieces / Node-RED** — covered by our generic `--sink-cmd` + `peepshow-sink-webhook` today. Dedicated sinks could add signing/retry tuned per platform. Not shipped.
- ~~**Pipedream**~~ — shipped (`peepshow-sink-pipedream`).

## Prioritisation for next wave

All 7 of the previous next-wave items (Height · Opsgenie · Firebase Storage · Aider · Continue · Raycast · Pipedream) shipped in v0.5.0. Remaining gaps, ordered by leverage:

1. **Cody** (Sourcegraph) — `.cody/` workspace context; same shape as `continue`/`ide`.
2. **Grafana Oncall** — incident routing; REST API, similar to Opsgenie.
3. **ChatGPT Files API** — pre-upload frames for Custom GPTs / Projects.
4. **Whimsical** / **Excalidraw Plus** — whiteboards, pending API maturity.
5. **iMessage / Apple Notes / Things 3** — macOS-only via AppleScript. Niche but possible.
6. **WhatsApp Cloud API** — stricter rate limits; possible if there's demand.

Everything else on this page is either blocked on upstream API availability (Roam, Tana, Craft, Claude.ai Projects) or covered by the generic webhook/command sinks.

Volunteer for any — see `docs/sinks/skeletons.md` for the contribution pattern.
