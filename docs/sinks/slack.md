# peepshow-sink-slack

Posts a peepshow run as a formatted Slack message via an incoming webhook. Uses Block Kit with a summary, tag bullets, and a context footer.

## Setup

1. Create an [incoming webhook](https://api.slack.com/messaging/webhooks) in your Slack workspace.
2. Copy the webhook URL.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `SLACK_WEBHOOK_URL` | yes* | — | Slack incoming-webhook URL |
| `PEEPSHOW_WEBHOOK_URL` | yes* | — | alias — also read if `SLACK_WEBHOOK_URL` isn't set |

\* one of the two is required.

## Use

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T00/B00/xxx"
peepshow sinks add slack
peepshow ./video.mp4
```

## Message shape

- **Header paragraph** — `peepshow: N frames from <title> (1920×1080, 42.0s, h264) via scene`
- **Tag block** — bulleted list of up to 8 `video.tags` entries (title, director, producer, …)
- **Context footer** — output directory, byte count, elapsed ms

## Caveats

- Slack webhooks don't render arbitrary image URLs inline — pair with the [`s3`](./s3.md) sink and post Slack links for frames.
- One webhook = one channel. For routing per-run (e.g. Kubrick films → #cinema, everything else → #random) use [`--when`](../PLUGINS.md#conditional-matching---when) sink conditions with two separate auto-sinks.
