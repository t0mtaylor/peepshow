# peepshow-sink-grafana-oncall

<!-- gif:sink:grafana-oncall -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/grafana-oncall.gif" alt="peepshow → grafana-oncall demo" width="720">
</p>
<!-- /gif:sink:grafana-oncall -->


Create a [Grafana OnCall](https://grafana.com/docs/oncall/latest/oncall-api-reference/)
alert group so a peepshow run lands on an on-call timeline. The sink POSTs a
formatted-webhook JSON body to your integration URL and exits on 200 OK.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `GRAFANA_ONCALL_URL`   | ✓ | — | Webhook/integration URL. Typically a formatted-webhook integration URL; API endpoints also work. The sink POSTs here verbatim. |
| `GRAFANA_ONCALL_TOKEN` |   | — | Optional when the URL is a direct webhook. Required if you point at the API endpoint. Sent as `Authorization: <token>` (no `Bearer` prefix per Grafana OnCall convention). |
| `GRAFANA_ONCALL_TITLE` |   | — | Override for the alert title. |
| `GRAFANA_ONCALL_STATE` |   | `alerting` | `alerting` \| `ok`. Unknown values clamp to `alerting`. |

## Payload shape

Posted to the configured URL as JSON:

```json
{
  "alert_uid": "peepshow-<run-dir>",
  "title": "peepshow run — <subject>",
  "message": "markdown body",
  "state": "alerting",
  "link_to_upstream_details": "<frame URL if available>"
}
```

- `alert_uid`: `peepshow-<run dir name>`, e.g. `peepshow-run_0123`. Stable for the lifetime of the run so retries deduplicate cleanly; falls back to a timestamp when no run dir is available.
- `title`: `peepshow run — <subject>`. `subject` is `video.tags.title`, then `video.tags.show`, then `"peepshow run"`. Fully overridable via `GRAFANA_ONCALL_TITLE`.
- `message`: Markdown body with a header line, codec/container/duration/resolution summary, every `video.tags[key]` as a bullet, the full list of frame paths, and a clamped transcript snippet when transcription is enabled (v0.4.0+).
- `state`: from `GRAFANA_ONCALL_STATE` — `alerting` (default) to open an incident, `ok` to resolve.
- `link_to_upstream_details`: best-effort URL from `video.tags.url`, `video.tags.link`, or `video.tags.source_url`. `null` when none of those tags is present.

## Exit codes

| 0 | Alert accepted (2xx). |
| 2 | Missing `GRAFANA_ONCALL_URL`. |
| 4 | stdin malformed / not a peepshow `--emit json` payload. |
| 5 | Grafana OnCall returned non-2xx or the request failed (network / DNS / TLS). |

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

Add the sink's required env vars to your shell rc (`~/.zshrc`,
`~/.bashrc`, PowerShell profile) or a project-local `.env` that your
agent tooling loads. Example:

```sh
export GRAFANA_ONCALL_URL="https://oncall-prod-us-central-0.grafana.net/integrations/v1/formatted_webhook/<integration-key>/"
# Optional: API-endpoint style URLs need a token
export GRAFANA_ONCALL_TOKEN="…"
# Optional: resolve an existing incident instead of opening a new one
export GRAFANA_ONCALL_STATE=ok
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add grafana-oncall
# Optional: only fire for matching inputs
peepshow sinks add grafana-oncall --when extension=mp4,mov
peepshow sinks add grafana-oncall --when environment=prod
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `outage.mov` into Claude Code (or ask
> "what's in ~/bugs/outage.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/outage.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Grafana OnCall` sink.
>
> **`Grafana OnCall`**: opens a new alert group titled after the clip,
> with a markdown body listing every extracted frame, the full
> transcript snippet, and a deep link back to the source URL (if the
> container exposed one).
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream alert.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director / studio
  / title etc).
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence
  ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`,
  language — populated when transcription is enabled (v0.4.0+).
- `extraction` — strategy, thresholds, ffmpeg path used.

> **Transcript handling**: when transcription is on, the first 400
> characters land directly in the alert message so the on-call pager
> carries enough signal without extra round-trips.

## Usage

```sh
GRAFANA_ONCALL_URL="https://oncall-prod-us-central-0.grafana.net/integrations/v1/formatted_webhook/<key>/" \
peepshow ./trigger.mp4 --sink grafana-oncall
```

With an API endpoint + token:

```sh
GRAFANA_ONCALL_URL="https://oncall-prod-us-central-0.grafana.net/oncall/api/v1/alert_groups/" \
GRAFANA_ONCALL_TOKEN="glc_..." \
peepshow ./trigger.mp4 --sink grafana-oncall
```

Custom title + resolve state:

```sh
GRAFANA_ONCALL_URL=... \
GRAFANA_ONCALL_TITLE="Pipeline regression on trigger.mp4" \
GRAFANA_ONCALL_STATE=ok \
peepshow ./trigger.mp4 --sink grafana-oncall
```
