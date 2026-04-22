# peepshow-sink-discord

Posts a peepshow run as a Discord message via a channel webhook. Uses embeds with title, description, fields for every `video.tags` entry, and a footer.

## Setup

1. In Discord, open your server → **Integrations → Webhooks → New Webhook**.
2. Copy the webhook URL.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `DISCORD_WEBHOOK_URL` | yes* | — | Discord channel webhook URL |
| `PEEPSHOW_WEBHOOK_URL` | yes* | — | alias — also read if `DISCORD_WEBHOOK_URL` isn't set |

\* one of the two is required.

## Use

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
peepshow sinks add discord
peepshow ./video.mp4
```

## Message shape

- **`content`** — one-line summary with title + dims + duration + codec + strategy.
- **`embeds[0]`** — embed with `title` (from `video.tags.title` or "peepshow run"), `description` (`"N frames via scene detection"`), up to 10 inline `fields` (one per tag), and a `footer` listing the output directory + ffmpeg source.

## Caveats

- Max 10 embed fields — extra tags are dropped (in insertion order).
- Each field value max 1024 chars — auto-truncated with `…`.
- Discord webhooks accept file attachments via `multipart/form-data`; today this sink only posts JSON. Pair with [`s3`](./s3.md) and link from embed fields for inline thumbnails.
