# peepshow-sink-azure-blob

<!-- gif:sink:azure-blob -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/azure-blob.gif" alt="peepshow → azure-blob demo" width="720">
</p>
<!-- /gif:sink:azure-blob -->


Uploads every frame plus a `manifest.json` to an Azure Blob Storage container under a timestamped prefix — same layout scheme as the `s3` sink, but talking to the native Azure REST API via `@azure/storage-blob` (no S3-compat layer required).

## Install

```bash
npm install @azure/storage-blob
```

## Auth

Pick **one** of the two modes — the connection string wins if both are set.

| Mode | Env vars | Notes |
| :--- | :------- | :---- |
| Connection string | `AZURE_STORAGE_CONNECTION_STRING` | Full string from the Azure portal. SDK parses endpoint, account, key. |
| Account + key | `AZURE_STORAGE_ACCOUNT` + `AZURE_STORAGE_KEY` | Bare pair — peepshow builds `https://<account>.blob.core.windows.net` itself. |

If neither is provided, the sink exits with code 2 and a clear message.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `AZURE_CONTAINER` | yes | — | Target container name. Must already exist. |
| `AZURE_PREFIX` | no | `peepshow/` | Prefix for every uploaded blob (leading/trailing slashes are normalised). |
| `AZURE_STORAGE_CONNECTION_STRING` | one of | — | Preferred: full connection string. |
| `AZURE_STORAGE_ACCOUNT` | one of | — | Storage account name. |
| `AZURE_STORAGE_KEY` | one of | — | Storage account key. |

## Use

```bash
# 1. connection string mode (easiest — copy from portal → Access keys)
export AZURE_CONTAINER=peepshow-archive
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net"
peepshow sinks add azure-blob
peepshow ./video.mp4

# 2. account + key mode
export AZURE_CONTAINER=peepshow-archive
export AZURE_STORAGE_ACCOUNT=myacct
export AZURE_STORAGE_KEY=abcd==
peepshow sinks add azure-blob
peepshow ./video.mp4
```

## Layout in container

```
<AZURE_PREFIX><YYYYMMDD>-<HHMMSS>-<strategy>/
    frame_0001.jpg
    frame_0002.jpg
    ...
    manifest.json
```

- `Content-Type` is set per frame (`image/jpeg`, `image/png`, `image/webp`).
- `manifest.json` contains `outputDir`, `strategy`, `frames`, `video`, `extraction` — the full peepshow `--emit json` payload.

## Caveats

- Container must already exist. Create it once with `az storage container create --name peepshow-archive`.
- No server-side lifecycle rules — configure retention / tiering on the container at the Azure side.
- Shared-key auth only. SAS / AAD / managed identity aren't wired up — use a connection string with a SAS embedded if you need scoped access.

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
export AZURE_CONTAINER="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add azure-blob
# Optional: only fire for matching inputs
peepshow sinks add azure-blob --when extension=mp4,mov
peepshow sinks add azure-blob --when retention=long
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
> then forwards the run to the `Azure Blob Storage` sink.
>
> **`Azure Blob Storage`**: uploads every frame plus a `manifest.json` to an Azure Blob Storage container under a timestamped prefix.
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
