# peepshow-sink-webhook

Generic POST of the peepshow JSON payload to any URL. Foundation for the Slack and Discord sinks, useful on its own for automation platforms (Zapier, Make, n8n, custom APIs).

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `PEEPSHOW_WEBHOOK_URL` | yes | — | destination URL |
| `PEEPSHOW_WEBHOOK_AUTH` | no | — | full `Authorization` header value, verbatim (e.g. `Bearer xxx`) |
| `PEEPSHOW_WEBHOOK_FORMAT` | no | `peepshow` | `peepshow` \| `slack` \| `discord` |

## Use

```bash
export PEEPSHOW_WEBHOOK_URL="https://hooks.example.com/peepshow"
peepshow sinks add webhook
peepshow ./video.mp4
```

With auth header:

```bash
export PEEPSHOW_WEBHOOK_URL="https://api.example.com/ingest"
export PEEPSHOW_WEBHOOK_AUTH="Bearer sk-live-xxx"
peepshow sinks add webhook
```

## Payload shape

With `PEEPSHOW_WEBHOOK_FORMAT=peepshow` (default), the full [`--emit json`](../../tests/contract.test.ts) shape is POSTed verbatim. Switch format for Slack / Discord-specific rendering.

## Caveats

- No retry yet. If the target returns non-2xx the sink exits non-zero; peepshow logs the failure but the run itself still succeeds.
- TLS cert validation is on (Node's default). Use the `webhook` sink only with trusted HTTPS endpoints.
