# peepshow-sink-dropbox

<!-- gif:sink:dropbox -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/dropbox.gif" alt="peepshow → dropbox demo" width="720">
</p>
<!-- /gif:sink:dropbox -->


Upload every extracted frame plus a `manifest.json` to a Dropbox folder
under a timestamped per-run prefix. Each upload is a single call to
Dropbox's content endpoint `POST /2/files/upload`.

## Invocation

```bash
peepshow ./scene.mov --sink dropbox
```

Output layout in Dropbox (for `DROPBOX_PREFIX=/peepshow`):

```
/peepshow/
  20260101-123000-scene/
    frame_0001.jpg
    frame_0002.jpg
    ...
    manifest.json
```

The timestamp is UTC `YYYYMMDD-HHMMSS`; the suffix is the peepshow
extraction strategy (`scene` or `fps`). `manifest.json` contains the full
`--emit json` payload (video metadata, extraction stats, frame paths).

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `DROPBOX_ACCESS_TOKEN` | ✓ | — | OAuth 2 access token for the target Dropbox account / team. |
| `DROPBOX_PREFIX`       |   | `/peepshow` | Root folder for all peepshow runs. Leading `/` is enforced; trailing `/` is stripped. Empty string uploads at the Dropbox root. |
| `DROPBOX_API_URL`      |   | `https://content.dropboxapi.com/2` | Dropbox content API base URL. Override for regional or mock endpoints. |

### Obtaining an access token

1. Create an app at <https://www.dropbox.com/developers/apps>.
2. Give it at least the `files.content.write` scope.
3. Generate an access token from the app's settings page (or run the
   OAuth flow and store the refresh-token-derived access token).

The sink uses the token verbatim as `Authorization: Bearer <token>`.

## How it works

Each upload posts raw file bytes to
`https://content.dropboxapi.com/2/files/upload` with:

- `Authorization: Bearer <token>`
- `Content-Type: application/octet-stream`
- `Dropbox-API-Arg: <ASCII-safe JSON>`

The `Dropbox-API-Arg` header carries the upload params:

```json
{ "path": "/peepshow/<run>/frame_0001.jpg", "mode": "overwrite", "autorename": false, "mute": true }
```

Non-ASCII characters in the header JSON are escaped as `\uXXXX` — this
is required by Dropbox; HTTP header values are not allowed to carry raw
UTF-8.

`mode: overwrite` means re-running peepshow against the same timestamped
folder (by pinning the clock) will replace prior uploads rather than
erroring. In practice every run produces a fresh timestamped folder.

## Exit codes

| 0 | Frames + manifest uploaded successfully. |
| 2 | Missing `DROPBOX_ACCESS_TOKEN`. |
| 4 | stdin malformed. |
| 5 | Dropbox returned non-2xx on any upload. |

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
export DROPBOX_ACCESS_TOKEN="…"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add dropbox
# Optional: only fire for matching inputs
peepshow sinks add dropbox --when extension=mp4,mov
peepshow sinks add dropbox --when retention=long
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
> then forwards the run to the `Dropbox` sink.
>
> **`Dropbox`**: uploads every frame plus a `manifest.json` to a Dropbox folder under a timestamped per-run subfolder.
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
