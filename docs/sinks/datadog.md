# peepshow-sink-datadog

POST a peepshow run as a Datadog event (`/api/v1/events`) so it lands
on an incident timeline / event stream. `aggregation_key` groups repeat
runs of the same clip under one event cluster.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `DATADOG_API_KEY`     | ✓ | — | `DD-API-KEY` header. |
| `DATADOG_APP_KEY`     |   | — | `DD-APPLICATION-KEY` — include when your setup requires it. |
| `DATADOG_SITE`        |   | `datadoghq.com` | `datadoghq.eu` \| `us3.datadoghq.com` \| `us5.datadoghq.com` \| `ap1.datadoghq.com`. |
| `DATADOG_EVENT_TAGS`  |   | — | Comma-separated tags appended to the event (e.g. `incident_id:IR-12,env:prod`). |
| `DATADOG_ALERT_TYPE`  |   | `info` | `info` \| `warning` \| `error` \| `success`. |

## Exit codes

| 0 | Event accepted. |
| 2 | Missing `DATADOG_API_KEY`. |
| 4 | stdin malformed. |
| 5 | Datadog returned non-2xx. |
