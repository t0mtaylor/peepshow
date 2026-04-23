# peepshow-sink-zep

Append a peepshow run to a [Zep](https://www.getzep.com/) long-term-memory
session. Each run becomes one `system` message summarising the video plus
one `user` message per extracted frame (ordinal, approximate timestamp,
path, byte size). The Zep graph can then recall what was in the clip
without re-processing it.

## Install

Ships built-in with peepshow — the bin lands on PATH after `npm i -g peepshow`.

## Invocation

```bash
peepshow ./cctv-night.mp4 --sink zep
```

Or through `--sink-cmd` with the raw binary:

```bash
peepshow ./cctv-night.mp4 --emit json | peepshow-sink-zep
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ZEP_API_KEY`    | ✓ | — | Zep cloud / self-hosted API key (sent as `Authorization: Api-Key …`). |
| `ZEP_SESSION_ID` | ✓ | — | Session to append messages to. Create it up-front via the Zep dashboard or SDK. |
| `ZEP_API_URL`    |   | `https://api.getzep.com` | Override for self-hosted Zep instances. Trailing slashes stripped. |
| `ZEP_USER_ID`    |   | (none) | Optional user id to associate with the session metadata. |

## Message shape

The sink POSTs to `POST /api/v2/sessions/{session_id}/messages` with:

```json
{
  "messages": [
    {
      "role": "system",
      "role_type": "system",
      "content": "peepshow run — \"The Heist\" · 6 frames · strategy=scene · codec=h264 · duration=42.0s · res=1920x1080 · director=Kubrick",
      "metadata": {
        "peepshow_run": "2026-04-23T03:00:00.000Z",
        "source": "peepshow-sink-zep",
        "strategy": "scene",
        "ffmpeg_source": "system"
      }
    },
    {
      "role": "user",
      "role_type": "user",
      "content": "Frame 1/6 · ~0.00s · path=/tmp/out/frame_0001.jpg",
      "metadata": { "peepshow_run": "…", "ordinal": 1, "path": "…", "bytes": 100 }
    }
    // …one user message per frame…
  ]
}
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Messages accepted by Zep. |
| 2 | Missing/invalid env var (see `ZEP_API_KEY`, `ZEP_SESSION_ID`). |
| 4 | stdin was empty or malformed. |
| 5 | Zep returned a non-2xx response (details in stderr, body truncated to 200 chars). |

## Tips

- Zep sessions are scoped to a user — if you want "one user, many clips",
  set `ZEP_USER_ID` consistently and rotate `ZEP_SESSION_ID` per clip.
- Self-hosted Zep: set `ZEP_API_URL` to your instance (e.g. `http://localhost:8000`).
  Auth is still `Api-Key …`.
