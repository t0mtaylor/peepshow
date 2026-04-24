# peepshow-sink-zapier

<!-- gif:sink:zapier -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/zapier.gif" alt="peepshow → zapier demo" width="720">
</p>
<!-- /gif:sink:zapier -->

POST every peepshow run to a [Zapier](https://zapier.com) Catch Hook
URL. Drop-in for no-code automation: fire a Zap on every extracted
video, with a **flat** event shape tuned to Zapier's variable picker
— each field hoists to its own Zap step variable, so non-developer
Zap builders don't have to parse nested JSON.

## Why not just `webhook`?

The generic [`webhook`](./webhook.md) sink POSTs the full nested
peepshow payload — fine for engineer-owned endpoints, but Zapier's UI
wants **shallow top-level fields** it can expose in the variable
picker. This sink flattens `video.*` + `audio.*` + `audio.transcript.*`
to top-level keys (`video_codec`, `audio_duration_seconds`,
`transcript_text`, …) and hoists every `video.tags[key]` to
`tag_<key>`, so a Zap step can pick them without a Code step.

| Feature | `webhook` | `zapier` |
| :------ | :-------- | :------- |
| POST JSON to URL | yes | yes |
| Flat field names Zapier can auto-discover | no | yes |
| `tag_<key>` hoisting from `video.tags` | no | yes |
| HMAC-SHA256 signature header | no | yes (`X-Zapier-Signature`) |
| Retry on 429/5xx with exponential backoff | no | yes (3 retries, 250ms → 10s cap) |
| Run metadata as headers | no | yes (`X-Peepshow-Run-Id`, `X-Peepshow-Duration-Seconds`) |

Use `zapier` when your destination is a Zapier Catch Hook Zap. Keep
`webhook` for everything else.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `ZAPIER_HOOK_URL` | yes | — | Catch Hook URL, e.g. `https://hooks.zapier.com/hooks/catch/<user_id>/<hook_id>/` |
| `ZAPIER_SIGNING_SECRET` | no | — | HMAC-SHA256 key. When set, each POST gets an `X-Zapier-Signature` header computed over the raw body. Zapier itself doesn't validate this — a Zap's Code step does. |
| `ZAPIER_RETRY_MAX` | no | `3` | Max retries after the initial request on 429/5xx (total attempts = retries + 1). |
| `ZAPIER_TIMEOUT_MS` | no | `15000` | Per-request timeout in milliseconds. |

## Use

1. In Zapier, create a new Zap whose trigger is **Webhooks by Zapier
   → Catch Hook**.
2. Copy the `https://hooks.zapier.com/hooks/catch/<user>/<hook>/` URL.
3. Wire it up:

```bash
export ZAPIER_HOOK_URL="https://hooks.zapier.com/hooks/catch/1234567/abcdef/"
peepshow sinks add zapier
peepshow ./video.mp4
```

4. Click **Test trigger** in Zapier — your test peepshow run should
   appear, with every top-level field (`video_codec`,
   `video_duration_seconds`, `transcript_text`, `tag_director`, …)
   selectable in downstream steps.

With signature verification (Code step inside the Zap):

```bash
export ZAPIER_HOOK_URL="https://hooks.zapier.com/hooks/catch/1234567/abcdef/"
export ZAPIER_SIGNING_SECRET="long-random-string"
peepshow sinks add zapier
```

In a **Code by Zapier** step, verify the signature:

```js
// inputData: { body: <raw JSON string>, signature: <header value>, secret: <from Zap env> }
const crypto = require("crypto");
const expected = crypto
  .createHmac("sha256", inputData.secret)
  .update(inputData.body)
  .digest("hex");
const ok =
  inputData.signature &&
  inputData.signature.length === expected.length &&
  crypto.timingSafeEqual(
    Buffer.from(inputData.signature),
    Buffer.from(expected),
  );
return { ok };
```

## Convenience headers

The sink attaches two headers so Zap filter steps can branch without
parsing the body:

| Header | Value |
| :----- | :---- |
| `X-Peepshow-Run-Id` | Basename of the peepshow output directory — stable per run. |
| `X-Peepshow-Duration-Seconds` | `video.durationSeconds` as a string, omitted when unknown. |

## Body shape (flat)

Every field is top-level. `tag_*` keys are hoisted from
`video.tags`; missing audio/transcript resolve to `null` rather than
being dropped, so Zapier's variable picker still surfaces the slot.

```json
{
  "peepshow_version": "0.5.0",
  "run_id": "peepshow-abc123",
  "strategy": "scene",
  "output_dir": "/tmp/peepshow-abc123",
  "video_duration_seconds": 12.0,
  "video_width": 1920,
  "video_height": 1080,
  "video_codec": "h264",
  "video_container": "mov",
  "frames_emitted": 4,
  "frames_pruned": 0,
  "audio_codec": "aac",
  "audio_duration_seconds": 12.0,
  "transcript_text": "hello world foo bar",
  "transcript_segment_count": 4,
  "tag_director": "Kubrick",
  "tag_genre": "Thriller",
  "frames_urls": [],
  "frames_paths": [
    "/tmp/peepshow-abc123/frame_0001.jpg",
    "/tmp/peepshow-abc123/frame_0002.jpg"
  ]
}
```

`frames_urls` is reserved for future use (e.g. signed URLs once a
storage sink has uploaded the frames) — it's always an empty array
today, but the key is stable so a Zap step can pre-wire to it.

## Retry behaviour

- **429** and **5xx** responses trigger a retry. Zapier hook quotas
  (per-plan burst limits) commonly surface as 429 during spikes.
- Backoff: `250ms · 500ms · 1000ms · 2000ms · …` capped at `10s`.
- Network-level errors (aborts, ECONNRESET) are also retried.
- **4xx** responses (other than 429) are treated as unrecoverable and
  the sink exits non-zero on the first failure.
- After `ZAPIER_RETRY_MAX + 1` total attempts the sink exits non-zero
  with the last status code in the message.

## Caveats

- TLS cert validation is on (Node default). Only point at HTTPS URLs
  you trust.
- Zapier's Catch Hook URL is the auth. Treat it as a secret — rotate
  the Zap if the URL leaks.
- Zapier only auto-discovers top-level fields. Add keys via tags
  (`--when director=Kubrick` already propagates; new tags appear as
  `tag_<key>` automatically), not by nesting.
- The signature is for **your** verification. Zapier's platform
  ignores it — only a Code-by-Zapier step (or a downstream consumer)
  enforces it.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export ZAPIER_HOOK_URL="https://hooks.zapier.com/hooks/catch/1234567/abcdef/"
# Optional:
export ZAPIER_SIGNING_SECRET="long-random-string"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add zapier
# Optional: only fire for matching inputs
peepshow sinks add zapier --when extension=mp4,mov
peepshow sinks add zapier --when director=Kubrick
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code (or ask "what's in
> ~/bugs/crash.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/crash.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Zapier` sink.
>
> **`Zapier`**: POSTs the flat peepshow event to your Catch Hook,
> with an HMAC signature and run-metadata headers. Your Zap fans out:
> post to Slack, add a Trello card with the transcript, archive the
> frame paths to Google Sheets — all selectable from the Zap picker,
> no Code step required.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream Zap run.
