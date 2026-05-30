# peepshow-sink-zoom

Post each peepshow run as a [Zoom Team Chat](https://developers.zoom.us/docs/api/chat/)
message via `POST https://api.zoom.us/v2/chat/users/me/messages`. The
message is sent as the authenticated Zoom user — to another user (by
email) for a DM, or to a channel (by channel JID) for a group post.

```
peepshow: Sprint Demo

Run: peepshow-run-zoom
Frames: 12
Duration: 600.0s
Resolution: 1280×720
Codec: h264

Transcript:
<truncated to ZOOM_TRANSCRIPT_MAX chars>
```

## Why chat instead of recordings / notes?

Zoom's [Cloud Recording API](https://developers.zoom.us/docs/api/recordings/)
only *retrieves* recordings hosted by Zoom — there is no public upload
endpoint for arbitrary media. Zoom Meeting Notes are read-only outside
the live meeting. The pragmatic integration that works against any Zoom
account today is **Team Chat**: post a markdown-flavoured summary to a
user or channel, which threads naturally into the recipient's normal
notifications.

If your team prefers a different surface (Webhook → Zoom App, Zoom Apps
SDK, custom Marketplace app), the sink is a drop-in template — replace
the chat URL with whatever endpoint your app exposes.

## Authentication

The sink uses an **OAuth2 access token** sent as a Bearer header.
Zoom's recommended path for unattended automation is the [Server-to-
Server OAuth](https://developers.zoom.us/docs/internal-apps/s2s-oauth/)
flow:

1. Create a Server-to-Server OAuth app in the Zoom Marketplace.
2. Grant the `chat_message:write:user` scope (and `chat_channel:write`
   if posting to a channel).
3. Exchange your account credentials for an access token:
   ```sh
   curl -X POST "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=$ZOOM_ACCOUNT_ID" \
     -u "$ZOOM_CLIENT_ID:$ZOOM_CLIENT_SECRET"
   ```
4. Export the resulting `access_token` as `ZOOM_ACCESS_TOKEN` before
   running peepshow.

Access tokens expire in 1 hour. Refresh them before each peepshow
invocation in a long-running pipeline; the sink fails fast with exit 5
and `Zoom 401` on stderr when the token expires.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ZOOM_ACCESS_TOKEN` | ✓ | — | OAuth2 access token (Bearer header). Refresh before each invocation. |
| `ZOOM_TO_USER` | ✓ (or `ZOOM_TO_CHANNEL`) | — | Recipient email for a user DM. Mutually exclusive with `ZOOM_TO_CHANNEL`. |
| `ZOOM_TO_CHANNEL` | ✓ (or `ZOOM_TO_USER`) | — | Channel JID for a channel post. Mutually exclusive with `ZOOM_TO_USER`. |
| `ZOOM_TITLE_PREFIX` |   | `peepshow` | Prefix prepended to the message title. Set empty (`""`) to disable. |
| `ZOOM_API_URL` |   | `https://api.zoom.us` | Override the API base — useful for proxies / enterprise gateways. Trailing slashes stripped. |
| `ZOOM_TRANSCRIPT_MAX` |   | `2000` | Max transcript characters included in the message. Falls back to default for garbage or non-positive values. |
| `PEEPSHOW_FRAME_BASE_URL` |   | — | When set, the first frame URL is appended as a `First frame:` link below the summary. |

## Exit codes

| 0 | Message posted (Zoom returned 2xx). |
| 2 | Missing required env var, or both `ZOOM_TO_USER` and `ZOOM_TO_CHANNEL` set. |
| 4 | stdin malformed. |
| 5 | Zoom returned non-2xx (expired token, missing scope, recipient not found) or the request failed at the network layer. |

## Use

### DM a teammate

```bash
export ZOOM_ACCESS_TOKEN="$(./refresh-zoom-token.sh)"
export ZOOM_TO_USER="alice@example.com"
peepshow sinks add zoom
peepshow ./standup.mp4
```

### Post to a channel

```bash
export ZOOM_ACCESS_TOKEN="$(./refresh-zoom-token.sh)"
export ZOOM_TO_CHANNEL="channel_jid_abc123"
peepshow ./demo.mp4 --sink zoom
```

Find a channel JID by listing channels via the API:

```sh
curl -H "Authorization: Bearer $ZOOM_ACCESS_TOKEN" \
  https://api.zoom.us/v2/chat/users/me/channels
```

### With a shorter transcript cap

```bash
export ZOOM_TRANSCRIPT_MAX=500
peepshow ./call.mp4 --sink zoom
```

## Caveats

- The sink posts **as the authenticated user**. The recipient sees the
  message coming from whoever owns `ZOOM_ACCESS_TOKEN`. For a true bot
  identity, register a Zoom Chatbot in the Marketplace and swap the
  endpoint to that bot's `/v2/im/chat/messages` surface.
- Zoom Team Chat **flattens markdown** in most clients — the message is
  formatted with plain-text separators (blank lines, label lines) so
  the structure survives. A full Adaptive-Cards-style rendering would
  require a Zoom Chatbot rather than a user message.
- Transcripts are capped at `ZOOM_TRANSCRIPT_MAX` chars (default 2000)
  before posting. The cap exists to keep the message readable; long
  transcripts also risk Zoom's per-message size limits.
- Frames are **not uploaded**. The sink posts a single link to the
  first frame via `PEEPSHOW_FRAME_BASE_URL` if set. Pair with a
  storage sink (`s3`, `gcs`, `dropbox`) if you want frame thumbnails
  hosted somewhere reachable from the Zoom client.
- The Zoom Chat API does not support **scheduled** messages — posts
  appear immediately. Use a `webhook` → cron service if you need
  delayed delivery.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export ZOOM_ACCESS_TOKEN="$(./refresh-zoom-token.sh)"
export ZOOM_TO_USER="alice@example.com"
# or: export ZOOM_TO_CHANNEL="channel_jid_abc123"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add zoom
# Optional: only post for shared / demo clips
peepshow sinks add zoom --when path=demo,standup
```

### 3. An LLM session, end-to-end

> **You**: drop a `sprint-demo.mp4` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames, audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards the
> run to the `zoom` sink.
>
> **`zoom`**: POSTs `{message: "peepshow: Sprint Demo\n\nRun: ...\nFrames: 12\nDuration: ...\nTranscript: ...", to_contact: "alice@example.com"}` — Alice sees the chat message in Zoom within seconds.
>
> **Claude Code**: writes the analysis to a separate file; the meeting
> notes are already in Alice's Zoom client.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not
just the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director /
  studio / title etc).
- `frames[]` — every extracted frame path + byte size (used only for
  the frame count line).
- `audio.transcript.text` — included verbatim in the message, truncated
  to `ZOOM_TRANSCRIPT_MAX` characters.

Only summary text is sent — no frames, no audio. Pair with a `s3` /
`gcs` / `dropbox` sink if you want hosted assets the Zoom recipient can
click through to.
