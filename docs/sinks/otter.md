# peepshow-sink-otter

<!-- gif:sink:otter -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/otter.gif" alt="peepshow → otter demo" width="720">
</p>
<!-- /gif:sink:otter -->


POST a meeting-note summary to a user-configured webhook intended to be wired
through [Zapier](https://zapier.com) / [Make](https://make.com) /
[n8n](https://n8n.io) into an [Otter.ai](https://otter.ai) workspace.

## Why a webhook, not a direct API call?

Otter.ai does **not** expose a public write API as of 2026. The investigation:

- [otter.ai/developers](https://otter.ai/developers) — does not exist (returns
  a marketing page; no API docs).
- [help.otter.ai](https://help.otter.ai/hc/en-us) — the integrations section
  documents Zoom, Google Meet, MS Teams, Slack, and the official Zapier app.
  No mention of a REST API.
- There is no `github.com/otter-api` org or first-party SDK.
- The only documented programmatic write surface is the official **Otter for
  Zapier** integration, which supports:
  - **Trigger**: New Note
  - **Action**: Create Note (in a specific Otter folder)

So peepshow ships the upstream half of the pipeline:

```
peepshow → webhook (Zapier Catch Hook / Make Webhook / n8n Webhook)
                            │
                            ▼
                  Otter "Create Note" action
```

You wire the downstream half once in the Zapier / Make / n8n visual editor.
peepshow's webhook body is a flat JSON object so the field-mapper picks every
field up without parsing nested data.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

No SDK required — the sink posts to your webhook over `fetch`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `OTTER_WEBHOOK_URL` | ✓ | — | Destination webhook URL — typically a Zapier `Catch Hook`, Make webhook, or n8n webhook trigger. |
| `OTTER_TITLE_PREFIX` |   | `peepshow` | Prefix prepended to the note title. Set to empty string to omit. |
| `OTTER_AUTH` |   | — | Optional verbatim `Authorization` header (e.g. `Bearer …`). Useful for Make scenarios with custom auth or self-hosted glue. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is written to the `thumbnail_url` field. |

## Webhook body

Flat JSON — every field is a primitive or a one-level object, so Zapier /
Make / n8n field-mappers can wire it directly into Otter's "Create Note"
action without expression-language gymnastics.

```json
{
  "run_id":         "peepshow-run-abc",
  "meeting_title":  "peepshow: Standup",
  "note":           "Captured by peepshow — 2 frames via scene detection.\n\nDuration: 12.5s\nResolution: 1920×1080\n…",
  "transcript":     "…full whisper transcript when audio + transcription are enabled…",
  "strategy":       "scene",
  "duration":       12.5,
  "frames":         2,
  "thumbnail_url":  "https://cdn.example.com/runs/abc/frame_0001.jpg",
  "tags":           { "title": "Standup", "project": "Demo" },
  "created_at":     "2026-05-27T10:32:00.000Z"
}
```

## Wire it through Zapier (3 steps)

1. **In Zapier**: create a new Zap, pick **Webhooks by Zapier** → trigger
   **Catch Hook**. Copy the catch-hook URL.
2. **Action**: pick **Otter.ai** → **Create Note**. Map `meeting_title` →
   *Title*, `note` → *Note Body*, `transcript` → *Transcript* (or whichever
   Otter fields your workspace exposes). The flat shape means every field
   appears directly in the dropdown.
3. **Locally**:

   ```bash
   export OTTER_WEBHOOK_URL="https://hooks.zapier.com/hooks/catch/123/abc/"
   peepshow ./standup.mov --sink otter
   ```

   Or as an auto-sink so every extract fires:

   ```bash
   peepshow sinks add otter --when extension=mov,mp4
   ```

## Wire it through Make (alternative)

1. **In Make**: create a scenario with a **Webhooks → Custom Webhook**
   module. Copy the address.
2. **Run** `peepshow ./video.mov --sink otter` once with
   `OTTER_WEBHOOK_URL` set to the Make address — Make captures the JSON
   structure so subsequent steps can pick fields from a dropdown.
3. Add an HTTP module that calls Otter (or chain a Slack / Notion /
   Linear step in addition).

## Wire it through n8n (self-hosted)

1. Add a **Webhook** trigger node, copy the test URL.
2. Add an Otter-adjacent node (e.g. an **HTTP Request** node to your
   internal Otter glue, or a **Slack** node if you want a Slack message in
   addition).
3. Activate the workflow so the production URL becomes live, then point
   `OTTER_WEBHOOK_URL` at it.

## Usage

```bash
export OTTER_WEBHOOK_URL="https://hooks.zapier.com/hooks/catch/123/abc/"
peepshow ./standup.mov --sink otter
```

Override the title prefix:

```bash
OTTER_TITLE_PREFIX="QA" peepshow ./bug.mov --sink otter
# → meeting_title = "QA: <video title>"
```

Add an auth header for a self-hosted glue:

```bash
OTTER_AUTH="Bearer my-internal-token" peepshow ./demo.mp4 --sink otter
```

## Exit codes

| 0 | Webhook accepted the POST. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Webhook returned non-2xx (e.g. paused Zap, scenario error), or the request failed at the network layer. |

## Caveats

- The downstream Zap / scenario is **your** responsibility — peepshow can
  only see the webhook response (200 / 4xx / 5xx), not whether Otter
  actually created the note. Test the full chain in Zapier's history view
  before pointing production traffic at it.
- Zapier free-tier scenarios have a 100-task/month cap. Bulk peepshow loads
  can exhaust that quickly; consider Make (free-tier 1000 ops/month) or n8n
  (self-hosted, unlimited) for high-volume use.
- Otter's "Create Note" action does not currently accept audio file uploads
  via Zapier — only text. The full transcript lands in the `transcript`
  field; map it into Otter's transcript area or note body depending on
  preference.
- If Otter ever ships a public write API, this sink will gain a direct
  `OTTER_API_KEY` mode in addition to the webhook fallback.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI — Claude
Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell out. The
LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
`OTTER_WEBHOOK_URL` in the shell it runs under.

### 1. Set the environment

```sh
export OTTER_WEBHOOK_URL="https://hooks.zapier.com/hooks/catch/123/abc/"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add otter
# Optional: only fire on meeting-style recordings
peepshow sinks add otter --when extension=mov,mp4,m4v
peepshow sinks add otter --when project=standups
```

### 3. An LLM session, end-to-end

> **You**: drop today's `~/standup.mov` into Claude Code (or ask
> "summarise this standup")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/standup.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Otter` sink.
>
> **`Otter` sink**: POSTs the flat note + transcript body to your Zapier
> webhook. Zapier's "Create Note" action lands the summary in Otter.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a meeting summary. The note is now
> also searchable in Otter alongside actual meetings, with the same
> transcript text the LLM had.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags.
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`, language —
  populated when transcription is enabled (v0.4.0+).
- `extraction` — strategy, thresholds, ffmpeg path used.
