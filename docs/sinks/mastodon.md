# peepshow-sink-mastodon

<!-- gif:sink:mastodon -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/mastodon.gif" alt="peepshow → mastodon demo" width="720">
</p>
<!-- /gif:sink:mastodon -->


Post each peepshow run as a status to any [Mastodon](https://joinmastodon.org)
instance — `mastodon.social`, `hachyderm.io`, your team's self-hosted
instance, or any other Fediverse server speaking the same API.

The sink performs a single API call:
`POST https://<instance>/api/v1/statuses` with a form-encoded body
(`status`, `visibility`, optional `spoiler_text`). Auth is a standard
Bearer access token minted under Preferences → Development → New
application.

## Status shape

```
peepshow: The Heist — 12 frames · 87.4s
```

Composed from the run title + frame count + duration, capped at the
upstream Mastodon default of 500 characters. Instances can raise this
cap server-side; the sink uses the conservative default so the same
text reliably sends everywhere. When the title is too long for the
cap, the title is truncated with an ellipsis so the summary tail
(`— N frames · Ts`) is preserved.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MASTODON_INSTANCE` | ✓ | — | Instance hostname (e.g. `mastodon.social`). Scheme + trailing slashes stripped automatically — `https://mastodon.social/` and `mastodon.social` both work. |
| `MASTODON_ACCESS_TOKEN` | ✓ | — | OAuth2 access token (Bearer). Generate under Preferences → Development → New application. The `write:statuses` scope is required. |
| `MASTODON_VISIBILITY` |   | `unlisted` | One of `public`, `unlisted`, `private`, `direct`. Unlisted is friendly to your followers — opt up to `public` per-instance when appropriate. |
| `MASTODON_SPOILER_TEXT` |   | — | Content-warning text prepended to every status. Useful for `peepshow run` tagging or NSFW guards. |

## Exit codes

| 0 | Status posted. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Mastodon returned non-2xx, or the request failed at the network layer. |

## Use

```bash
export MASTODON_INSTANCE="mastodon.social"
export MASTODON_ACCESS_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
peepshow sinks add mastodon
peepshow ./clip.mp4
```

Against a self-hosted instance, with a content warning:

```bash
export MASTODON_INSTANCE="social.internal"
export MASTODON_SPOILER_TEXT="peepshow run"
peepshow sinks add mastodon
```

Public posts only for shared / demo clips:

```bash
export MASTODON_VISIBILITY="public"
peepshow sinks add mastodon --when path=*public*
```

## Caveats

- The Mastodon character cap defaults to 500 but is instance-configurable. The sink uses the conservative 500-char default to stay safe across all instances; if you self-host with a higher cap, the sink will still truncate to 500 (file a PR if this is a problem).
- App tokens grant whatever scopes the application was created with — pick the narrowest scope you can (`write:statuses` alone, no `read`) to limit blast radius.
- This sink does not currently upload media attachments. The status is text-only — pair with a CDN + `airtable` / `webhook` if you need clickable frame URLs in the post.
- Visibility of `direct` only delivers to mentioned users; the sink doesn't mention anyone, so `direct` effectively makes the status invisible to everyone but you — useful for a private archive on a public-facing account.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export MASTODON_INSTANCE="mastodon.social"
export MASTODON_ACCESS_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add mastodon
# Optional: only post for explicitly tagged shareable clips
peepshow sinks add mastodon --when tag=share=public
```

### 3. An LLM session, end-to-end

> **You**: drop a `demo.mov` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> then forwards the run to the `Mastodon` sink.
>
> **`Mastodon`**: posts `peepshow: <title> — N frames · Ts` to the
> configured instance with `visibility=unlisted` by default.
>
> **Claude Code**: writes the summary; the Fediverse-visible audit
> trail is already live for any downstream feed reader.

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
> Mastodon's 500-char post limit is generous, but the sink keeps the
> body short so it renders well in mobile clients and the federated
> firehose. Pair with `airtable` / `notion` / `webhook` if you also want
> the transcript persisted.
