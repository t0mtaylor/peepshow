# peepshow-sink-gdrive

<!-- gif:sink:gdrive -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/gdrive.gif" alt="peepshow → gdrive demo" width="720">
</p>
<!-- /gif:sink:gdrive -->


Upload every extracted frame plus a `manifest.json` to a Google Drive folder
via the Drive v3 **multipart** upload endpoint. One run folder per peepshow
run (`<YYYYMMDD>-<HHMMSS>-<strategy>`), holding all frames + the manifest.

Uses raw `fetch` with a Bearer access token — no `googleapis` SDK, no OAuth
flow embedded. You mint the token (service account, `gcloud auth
print-access-token`, or your own OAuth dance) and pass it in via env.

## Invocation

```bash
peepshow ./clip.mp4 --sink gdrive
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `GDRIVE_ACCESS_TOKEN`    | ✓ | — | OAuth access token (Bearer). Service-account or user. |
| `GDRIVE_FOLDER_ID`       | ✓ | — | Parent Drive folder id to upload into. |
| `GDRIVE_API_URL`         |   | `https://www.googleapis.com` | Override for Drive API endpoint. |
| `GDRIVE_RUN_FOLDER_NAME` |   | `<YYYYMMDD>-<HHMMSS>-<strategy>` | Override the per-run subfolder name. |

### Minting an access token

Simplest on a workstation:

```bash
export GDRIVE_ACCESS_TOKEN=$(gcloud auth print-access-token)
export GDRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUv
```

For service accounts with a key file, use your preferred OAuth tool to mint
a token with the `https://www.googleapis.com/auth/drive.file` scope (narrow)
or `https://www.googleapis.com/auth/drive` (broad), then export it.

## Layout

```
<parent folder>/
  20250102-030405-scene/
    frame_0001.jpg
    frame_0002.jpg
    ...
    manifest.json
```

The `manifest.json` contains `video`, `extraction`, and `frames` — the same
shape as other peepshow sinks.

## Exit codes

| 0 | Run folder created, frames + manifest uploaded. |
| 2 | Missing env (`GDRIVE_ACCESS_TOKEN` / `GDRIVE_FOLDER_ID`). |
| 4 | stdin malformed. |
| 5 | Drive returned non-2xx (token expired, quota, permissions). |

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
export GDRIVE_ACCESS_TOKEN="…"
export GDRIVE_FOLDER_ID="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add gdrive
# Optional: only fire for matching inputs
peepshow sinks add gdrive --when extension=mp4,mov
peepshow sinks add gdrive --when retention=long
```

See [`peepshow sinks`](../../docs/PLUGINS.md) for the full matching
vocabulary.

### 3. An LLM session, end-to-end

> **You**: drop a `clip.mov` into Claude Code (or ask
> "what's in ~/bugs/crash.mov?")
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides ~/bugs/crash.mov`. peepshow extracts
> frames + audio, transcribes locally if `whisper.cpp` is on `PATH`,
> then forwards the run to the `Google Drive` sink.
>
> **`Google Drive`**: creates a per-run subfolder under a Google Drive parent and uploads every frame plus a `manifest.json`.
>
> **Claude Code**: reads the frames back as images, combines them with
> the audio transcript, and writes a summary that references the
> downstream record.

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

> **Transcript handling**: the full transcript JSON is saved next to the frames in the per-run manifest.
