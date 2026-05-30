# peepshow-sink-anytype

<!-- gif:sink:anytype -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/anytype.gif" alt="peepshow → anytype demo" width="720">
</p>
<!-- /gif:sink:anytype -->


Write each peepshow run as a local-first object in an
[Anytype](https://anytype.io) space — the encrypted, peer-to-peer
knowledge base that runs on your own device. Notion-shaped UI without
the cloud lock-in.

The Anytype desktop app exposes an HTTP API on `http://localhost:31009`
(configurable). This sink writes one object per run via:

```
POST <baseUrl>/v1/spaces/<spaceId>/objects
{ "name": "...", "body": "...", "type_key": "ot-note" }
```

Auth uses a Bearer access token the user **pre-generates inside the
Anytype app**. The two-step `display_code` / `token` bootstrap dance
(documented at [developers.anytype.io](https://developers.anytype.io))
is intentionally left out of the runtime — keeping the sink stateless,
idempotent, and free of token-persistence concerns.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ANYTYPE_ACCESS_TOKEN` | ✓ | — | Pre-generated access token. See the bootstrap section below for how to mint one. |
| `ANYTYPE_SPACE_ID` | ✓ | — | Target space id. Find it under Settings → Spaces inside the Anytype app, or via `GET /v1/spaces`. |
| `ANYTYPE_API_URL` |   | `http://localhost:31009` | Base URL of the local Anytype API. Override only if you've remapped the port. Trailing slashes stripped. |
| `ANYTYPE_TYPE_KEY` |   | `ot-note` | Object type key. Use any custom type key from your space's type catalogue (e.g. `ot-page`, `ot-bookmark`, `ot-task`). |

## Exit codes

| 0 | Object created. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Anytype returned non-2xx (e.g. expired token, unknown space), or the request failed at the network layer. |

## Object shape

```markdown
# The Heist

- Run ID: `peepshow-run-abc`
- Frames: 12
- Duration: 87.4s
- Resolution: 1920x1080
- Codec: h264
- Strategy: scene

## Tags
- director: Kubrick
- studio: A24

## Transcript

(full transcript text)
```

Body is plain markdown so Anytype's block editor renders it cleanly
(headings → heading blocks, list items → toggle / bullet blocks).

## Bootstrap an access token

The full sequence (per the
[Anytype API reference](https://developers.anytype.io)):

```bash
# 1. Trigger a 4-digit code in the desktop app
curl -X POST http://localhost:31009/v1/auth/display_code

# 2. Exchange the code for an access token
curl -X POST http://localhost:31009/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"code":"1234"}'
# → { "access_token": "..." }

# 3. Stash it where the sink can read it
echo 'export ANYTYPE_ACCESS_TOKEN="..."' >> ~/.zshrc
```

## Use

```bash
export ANYTYPE_ACCESS_TOKEN="$(< ~/.anytype-token)"
export ANYTYPE_SPACE_ID="bafyreigh2akiscaildc"
peepshow sinks add anytype
peepshow ./design-review.mp4
```

Custom object type:

```bash
export ANYTYPE_TYPE_KEY="ot-page"
peepshow sinks add anytype
```

## Caveats

- The Anytype desktop app **must be running** when the sink fires — there's no headless mode for the local API. Schedule peepshow runs around your normal Anytype usage, or wrap the sink with a `--sink-cmd` that no-ops when the API port isn't listening.
- Access tokens don't expire automatically but **revoking the app rotates them**. Re-run the bootstrap dance if every subsequent run starts returning 401.
- The HTTP API is currently considered experimental upstream; field names and endpoints may shift between Anytype releases. The sink targets the public `/v1/spaces/<id>/objects` endpoint documented at [developers.anytype.io](https://developers.anytype.io); pin your Anytype client version if you rely on this for production tracking.
- The sink writes object body as markdown via the `body` field. If your custom type uses a non-markdown body shape (e.g. structured properties), use a webhook + your own translator instead.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export ANYTYPE_ACCESS_TOKEN="$(< ~/.anytype-token)"
export ANYTYPE_SPACE_ID="bafyreigh2akiscaildc"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add anytype
# Optional: only file research / design clips, not bug repros
peepshow sinks add anytype --when path=*research*
```

### 3. An LLM session, end-to-end

> **You**: drop a `design-review.mp4` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> transcribes locally if `whisper.cpp` is on `PATH`, then forwards the
> run to the `Anytype` sink.
>
> **`Anytype`**: creates one object in your local space with the
> markdown body above. The object appears immediately in any open
> Anytype window — searchable, taggable, linkable via Anytype's native
> graph view.
>
> **Claude Code**: reads frames + transcript back, writes its summary;
> meanwhile a fully local, encrypted record of the run is sitting in
> your knowledge base.

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

> **Privacy**: nothing leaves your machine. Anytype itself is local-first
> and end-to-end encrypted; this sink talks to `localhost:31009` only.
> The full transcript is embedded under `## Transcript` in the object
> body — Anytype indexes it for native search.
