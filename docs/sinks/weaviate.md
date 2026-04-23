# peepshow-sink-weaviate

Batch-insert peepshow frames into a [Weaviate](https://weaviate.io) class so
the frames are indexed as vectors (via whatever vectorizer the class was
configured with — `text2vec-openai`, `text2vec-cohere`, etc).

## Install

Ships built-in with peepshow.

## Invocation

```bash
peepshow ./scene.mp4 --sink weaviate
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `WEAVIATE_URL`    | ✓ | — | Base URL of Weaviate. Trailing slashes stripped. |
| `WEAVIATE_CLASS`  |   | `PeepshowFrame` | Class to insert into. Must exist. |
| `WEAVIATE_API_KEY`|   | (none) | Bearer API key for Weaviate Cloud / auth-enabled installs. |
| `WEAVIATE_TENANT` |   | (none) | Tenant name for multi-tenancy. |

## Object shape (per frame)

```json
{
  "class": "PeepshowFrame",
  "properties": {
    "peepshow_run": "2026-04-23T03:00:00.000Z",
    "ordinal": 3,
    "title": "Jellyfish",
    "path": "/tmp/out/frame_0003.jpg",
    "bytes": 120,
    "approx_seconds": 15.00,
    "strategy": "scene",
    "codec": "h264",
    "container": "mov",
    "duration_seconds": 30,
    "width": 1920,
    "height": 1080,
    "fps": 24,
    "director": "Kubrick",
    "studio": "Warner",
    "description": "Frame 3/3 from \"Jellyfish\" at ~15.00s — /tmp/out/frame_0003.jpg"
  },
  "tenant": "team-1"
}
```

## Exit codes

| 0 | Batch accepted. |
| 2 | Missing `WEAVIATE_URL`. |
| 4 | stdin malformed. |
| 5 | Weaviate returned non-2xx. |
