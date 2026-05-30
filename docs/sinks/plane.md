# peepshow-sink-plane

<!-- gif:sink:plane -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/plane.gif" alt="peepshow → plane demo" width="720">
</p>
<!-- /gif:sink:plane -->


File one work item per peepshow run in a [Plane](https://plane.so)
workspace project via `POST /api/v1/workspaces/<workspaceSlug>/projects/<projectId>/issues/`.
Plane is the open-source Linear / Jira alternative — same workflow, no
SaaS lock-in. Works against [plane.so](https://plane.so) cloud or a
self-hosted instance.

The work item written:

| Field | Source |
|-------|--------|
| `name` | `peepshow: <video.tags.title \| video.tags.show \| "peepshow run">` (capped at Plane's 255-char limit) |
| `description` | Flat metadata block: Run ID, frames, duration, resolution, codec, strategy, container tags. Transcript appended when present. |
| `priority` | `PLANE_PRIORITY` (default `medium`) — one of `none|urgent|high|medium|low|null`. |

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `PLANE_API_TOKEN` | ✓ | — | Personal API token. Sent as both `x-api-key` (Plane's primary header) and `Authorization: Bearer`. Generate at Workspace Settings → API tokens. |
| `PLANE_WORKSPACE_SLUG` | ✓ | — | Workspace slug — the path segment in your Plane URL (e.g. `acme`). |
| `PLANE_PROJECT_ID` | ✓ | — | Project UUID — find it under Project Settings → General. |
| `PLANE_API_URL` |   | `https://api.plane.so` | Base URL of the Plane API. Override for self-hosted instances. Trailing slashes stripped. |
| `PLANE_PRIORITY` |   | `medium` | Issue priority. Unknown values fall back to `medium`. |

## Exit codes

| 0 | Issue created. |
| 2 | Missing required env var(s). |
| 4 | stdin malformed. |
| 5 | Plane returned non-2xx (e.g. invalid token, unknown project), or the request failed at the network layer. |

## Use

```bash
export PLANE_API_TOKEN="plane_api_xxxxxxxxxxxxx"
export PLANE_WORKSPACE_SLUG="acme"
export PLANE_PROJECT_ID="11111111-2222-3333-4444-555555555555"
peepshow sinks add plane
peepshow ./bug-repro.mp4
```

Self-hosted Plane:

```bash
export PLANE_API_URL="https://plane.internal"
peepshow sinks add plane
```

Override priority for QA-flagged regressions:

```bash
export PLANE_PRIORITY="urgent"
peepshow sinks add plane --when filename=*regression*
```

## Caveats

- Plane caps work-item `name` at 255 characters — long video titles are truncated with an ellipsis so the `peepshow: ` prefix stays visible.
- The sink writes the description as plain text (newline-separated). Plane's editor will render it inside a block; if you want rich markdown / HTML formatting, post-process via a webhook + Plane's `description_html` field.
- `PLANE_PRIORITY=null` (string) maps to Plane's "no priority" state — distinct from `none`.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can shell
out. The LLM doesn't need a plugin; it just needs `peepshow` on `PATH` and
the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export PLANE_API_TOKEN="plane_api_xxxxxxxxxxxxx"
export PLANE_WORKSPACE_SLUG="acme"
export PLANE_PROJECT_ID="11111111-2222-3333-4444-555555555555"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add plane
# Optional: only file issues for QA recordings
peepshow sinks add plane --when filename=*qa*
peepshow sinks add plane --when path=*regression*
```

### 3. An LLM session, end-to-end

> **You**: drop a `crash.mov` into Claude Code (or ask
> "what's in ~/bugs/crash.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio,
> then forwards the run to the `Plane` sink.
>
> **`Plane`**: creates one work item in the configured workspace +
> project with `peepshow: <title>` as the name and the full run
> metadata + transcript in the description. The item is immediately
> visible in Plane's board / list / spreadsheet view.
>
> **Claude Code**: reads the frames + transcript back, writes a summary
> that references the downstream work-item link.

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

> **Transcript handling**: full transcript text lands at the end of the
> work-item description under a `Transcript:` header. Plane itself
> imposes no character cap on description content, but very long
> transcripts can slow page render — pair with `airtable` / `webhook`
> for higher-volume archives.
