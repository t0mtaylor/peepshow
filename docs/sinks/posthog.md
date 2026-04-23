# peepshow-sink-posthog

Capture a peepshow run as a [PostHog](https://posthog.com) product-analytics
event (plus optional per-frame events) so you can chart CLI usage,
popular sinks, average run duration, etc.

## Invocation

```bash
peepshow ./bug.mov --sink posthog
POSTHOG_PROJECT_API_KEY=phc_… \
  peepshow ./clip.mp4 --sink posthog
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `POSTHOG_PROJECT_API_KEY` | ✓ | — | Project API key (`phc_…`). |
| `POSTHOG_HOST`            |   | `https://us.posthog.com` | Override for EU / self-hosted. |
| `POSTHOG_DISTINCT_ID`     |   | `peepshow` | distinct_id used on every event. |
| `POSTHOG_PER_FRAME`       |   | — | `1` fires one additional `peepshow_frame` event per extracted frame. |

## Events

**peepshow_run** — one per run, properties: `strategy`, `frame_count`,
`output_bytes_total`, `avg_frame_bytes`, `elapsed_ms`, `ffmpeg_source`,
`codec`, `container`, `duration_seconds`, `width`, `height`, `fps`,
`title`, `director`, `studio`.

**peepshow_frame** (only when `POSTHOG_PER_FRAME=1`) — one per frame with
`ordinal`, `path`, `bytes`, `approx_seconds`, `strategy`.

Events hit `POSTHOG_HOST/batch/` in a single request.

## Exit codes

| 0 | Events accepted. |
| 2 | Missing `POSTHOG_PROJECT_API_KEY`. |
| 4 | stdin malformed. |
| 5 | PostHog returned non-2xx. |
