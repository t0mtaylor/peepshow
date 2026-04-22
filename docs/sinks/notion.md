# peepshow-sink-notion

Creates a Notion page per peepshow run inside a database you control. Populates common columns (Name, Duration, Strategy, Codec, Director, Genre) opportunistically — Notion ignores properties the database doesn't know about, so the sink stays compatible with any schema.

## Install

No extra npm packages needed — uses the fetch API against Notion's public REST endpoint.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `NOTION_TOKEN` | yes | — | internal integration token (`secret_...` or `ntn_...`) |
| `NOTION_DATABASE_ID` | yes | — | parent database UUID |
| `NOTION_VERSION` | no | `2022-06-28` | API version header |

## Setup

1. In Notion, create a database for peepshow runs.
2. Go to **Settings → Connections → Develop or manage integrations → New internal integration** — copy the token.
3. In the database, open **Share → Connections → add your integration**.
4. Copy the database URL; the UUID portion is `NOTION_DATABASE_ID`.

## Use

```bash
export NOTION_TOKEN=ntn_xxx
export NOTION_DATABASE_ID=abcd1234...
peepshow sinks add notion
peepshow ./video.mp4
```

## What gets written

**Page properties** — populated when the corresponding tag / metadata is present:

- `Name` ← `video.tags.title` (fallback: `video.tags.show`, then "peepshow run")
- `Duration (s)` ← `video.durationSeconds`
- `Strategy` ← `scene` | `fps`
- `Codec` ← `video.codec`
- `Director` ← `video.tags.director`
- `Genre` ← `video.tags.genre`

**Page body:**

- Summary paragraph (frame count + resolution + codec + duration)
- **Metadata** bulleted list — every `video.tags.<k>` pair
- **Frames** section — inline image blocks for `http(s)://` frame paths, paragraph with file path otherwise

## Caveats

- Local file paths can't be embedded as Notion images (the API only accepts external URLs). Pair with [`s3`](./s3.md) and Notion will render the uploaded frames inline.
- Notion rate-limits at ~3 req/s per integration — fine for peepshow's once-per-video cadence.
