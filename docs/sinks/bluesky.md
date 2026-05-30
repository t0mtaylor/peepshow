# peepshow-sink-bluesky

<!-- gif:sink:bluesky -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/bluesky.gif" alt="peepshow → bluesky demo" width="720">
</p>
<!-- /gif:sink:bluesky -->


Post each peepshow run to [Bluesky](https://bsky.app) via the
[AT Protocol](https://atproto.com). The sink performs the standard
two-step XRPC dance:

1. `POST /xrpc/com.atproto.server.createSession` with `{identifier, password}`
   to mint a short-lived `accessJwt`.
2. `POST /xrpc/com.atproto.repo.createRecord` with the JWT in
   `Authorization` and a body of
   ```json
   { "repo": "<did>", "collection": "app.bsky.feed.post",
     "record": { "$type": "app.bsky.feed.post", "text": "...",
                 "createdAt": "...", "langs": ["en"] } }
   ```

Authentication uses an [app password](https://bsky.app/settings/app-passwords) —
**never your main login**. Post text is composed from the video title +
frame count + duration, capped at the 300-character Bluesky post limit.

Works against the canonical PDS (`bsky.social`) or any self-hosted PDS.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `BLUESKY_IDENTIFIER` | ✓ | — | Handle (e.g. `peepshow.bsky.social`) or email used to sign in. |
| `BLUESKY_APP_PASSWORD` | ✓ | — | App password (not your main login) — generate at [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords). |
| `BLUESKY_PDS_URL` |   | `https://bsky.social` | PDS endpoint. Override for self-hosted PDSs. Trailing slashes stripped. |
| `BLUESKY_LANG` |   | `en` | ISO language tag attached to each post (`record.langs`). |

## Exit codes

| 0 | Post created. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Bluesky returned non-2xx at either step, or the request failed at the network layer. |

## Post shape

```
peepshow: The Heist — 12 frames · 87.4s
```

When the title is too long for the 300-char cap, the title is truncated
with an ellipsis so the summary tail (`— N frames · Ts`) is preserved.

## Use

```bash
export BLUESKY_IDENTIFIER="peepshow.bsky.social"
export BLUESKY_APP_PASSWORD="abcd-efgh-ijkl-mnop"
peepshow sinks add bluesky
peepshow ./clip.mp4
```

Against a self-hosted PDS:

```bash
export BLUESKY_PDS_URL="https://pds.internal"
export BLUESKY_IDENTIFIER="peepshow.pds.internal"
export BLUESKY_APP_PASSWORD="abcd-efgh-ijkl-mnop"
peepshow sinks add bluesky
```

## Caveats

- The Bluesky API caps post text at 300 graphemes — this sink truncates by character count, which is conservative but not strictly grapheme-aware. Emoji + combining marks may push real grapheme counts lower than the character count suggests.
- Each invocation opens a fresh session; for very high run frequencies, consider a `webhook` → bot service that holds a longer-lived `refreshJwt`.
- App passwords can be revoked individually — keep one per peepshow deployment so you can rotate without disrupting other tooling.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export BLUESKY_IDENTIFIER="peepshow.bsky.social"
export BLUESKY_APP_PASSWORD="abcd-efgh-ijkl-mnop"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add bluesky
# Optional: only fire for shared / public clips
peepshow sinks add bluesky --when tag=visibility=public
```

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> then forwards the run to the `Bluesky` sink.
>
> **`Bluesky`**: opens a session with the app password, posts
> `peepshow: <title> — N frames · Ts` to the configured account.
>
> **Claude Code**: writes the summary; the social-feed audit trail is
> already live for any downstream feed / firehose consumer.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not just
the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director / studio
  / title etc).
- `frames[]` — every extracted frame path + byte size.
- `audio` — `path`, `durationSeconds`, codec, loudness peak, silence
  ratio.
- `audio.transcript` — `segments[]` with timestamps, full `text`,
  language.
- `extraction` — strategy, thresholds, ffmpeg path used.

> **Post text**: only the run title + frame count + duration are sent —
> Bluesky's 300-char post limit is the smallest target in the
> notification family. Pair with `airtable` / `notion` / `webhook` if you
> also want the transcript persisted.
