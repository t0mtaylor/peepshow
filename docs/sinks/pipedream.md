# peepshow-sink-pipedream

<!-- gif:sink:pipedream -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/pipedream.gif" alt="peepshow → pipedream demo" width="720">
</p>
<!-- /gif:sink:pipedream -->

POST every peepshow run to a [Pipedream](https://pipedream.com) workflow
source URL. Drop-in for low-code automation: fire a workflow on every
extracted video, with optional HMAC signing and automatic retry on
transient failures.

## Why not just `webhook`?

The generic [`webhook`](./webhook.md) sink will hit any URL — including a
Pipedream one — but this sink bakes in Pipedream-specific conveniences:

| Feature | `webhook` | `pipedream` |
| :------ | :-------- | :---------- |
| POST JSON to URL | yes | yes |
| HMAC-SHA256 signature header | no | yes (`X-Pipedream-Signature`) |
| Retry on 429/5xx with exponential backoff | no | yes (3 retries, 250ms → 10s cap) |
| Run metadata as headers | no | yes (`X-Peepshow-Run-Id`, `X-Peepshow-Duration-Seconds`) |

Use `pipedream` when your destination is a Pipedream workflow. Keep
`webhook` for everything else.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `PIPEDREAM_URL` | yes | — | Workflow source URL, e.g. `https://eo<id>.m.pipedream.net` |
| `PIPEDREAM_SIGNING_SECRET` | no | — | HMAC-SHA256 key. When set, each POST gets an `X-Pipedream-Signature` header computed over the raw body. |
| `PIPEDREAM_RETRY_MAX` | no | `3` | Max retries after the initial request on 429/5xx (total attempts = retries + 1). |
| `PIPEDREAM_TIMEOUT_MS` | no | `15000` | Per-request timeout in milliseconds. |

## Use

```bash
export PIPEDREAM_URL="https://eoabcdef.m.pipedream.net"
peepshow sinks add pipedream
peepshow ./video.mp4
```

With signature verification:

```bash
export PIPEDREAM_URL="https://eoabcdef.m.pipedream.net"
export PIPEDREAM_SIGNING_SECRET="whatever-long-random-string"
peepshow sinks add pipedream
```

In the Pipedream workflow, verify the signature in a Node step:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export default defineComponent({
  async run({ steps, $ }) {
    const secret = process.env.PIPEDREAM_SIGNING_SECRET;
    const got = steps.trigger.event.headers["x-pipedream-signature"];
    const expected = createHmac("sha256", secret)
      .update(steps.trigger.event.body) // raw string
      .digest("hex");
    const ok =
      got &&
      got.length === expected.length &&
      timingSafeEqual(Buffer.from(got), Buffer.from(expected));
    if (!ok) return $.flow.exit("bad signature");
  },
});
```

## Convenience headers

The sink attaches two headers so Pipedream steps can branch without
parsing the JSON body:

| Header | Value |
| :----- | :---- |
| `X-Peepshow-Run-Id` | Basename of the peepshow output directory — stable per run. |
| `X-Peepshow-Duration-Seconds` | `video.durationSeconds` as a string, omitted when unknown. |

## Payload shape

The full `--emit json` payload is POSTed verbatim as the body — same shape
as the [`webhook`](./webhook.md) sink. `video`, `frames[]`, `audio`,
`audio.transcript`, `extraction`.

## Retry behaviour

- **429** and **5xx** responses trigger a retry.
- Backoff: `250ms · 500ms · 1000ms · 2000ms · …` capped at `10s`.
- Network-level errors (aborts, ECONNRESET) are also retried.
- **4xx** responses (other than 429) are treated as unrecoverable and the
  sink exits non-zero on the first failure.
- After `PIPEDREAM_RETRY_MAX + 1` total attempts the sink exits non-zero
  with the last status code in the message.

## Caveats

- TLS cert validation is on (Node default). Only point at HTTPS URLs you
  trust.
- The signature covers the JSON body string exactly as transmitted, not
  the decoded object. Verify against `event.body` (raw), not
  `event.body` after a `JSON.parse` round-trip.
- Pipedream's Connect API (`https://api.pipedream.com/v1/...`) isn't
  supported yet — file an issue if you need it.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export PIPEDREAM_URL="https://eoabcdef.m.pipedream.net"
# Optional:
export PIPEDREAM_SIGNING_SECRET="long-random-string"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add pipedream
# Optional: only fire for matching inputs
peepshow sinks add pipedream --when extension=mp4,mov
peepshow sinks add pipedream --when director=Kubrick
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
> then forwards the run to the `Pipedream` sink.
>
> **`Pipedream`**: POSTs the full peepshow JSON payload to your
> workflow source URL, with an HMAC signature and run-metadata headers.
> The workflow fans out: notify Slack, file a Linear issue, archive to
> S3, whatever you wire up.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream workflow run.
