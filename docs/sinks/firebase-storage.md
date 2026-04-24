# peepshow-sink-firebase-storage

<!-- gif:sink:firebase-storage -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/firebase-storage.gif" alt="peepshow → firebase-storage demo" width="720">
</p>
<!-- /gif:sink:firebase-storage -->


Uploads every frame plus a `manifest.json` to a Firebase Storage bucket via the Firebase REST upload endpoint (`firebasestorage.googleapis.com/v0/b/<BUCKET>/o`). Two auth modes: a pre-issued Firebase ID token / OAuth access token (simplest) or a service-account JSON key (the sink signs a JWT and trades it for a 1-hour access token). No SDK, no runtime dependencies beyond `node:crypto` + `fetch`.

> Firebase Storage sits on top of Google Cloud Storage. Use this sink when you want the Firebase console + Security Rules + client SDKs over the same bucket. If you're purely server-side, [`peepshow-sink-gcs`](./gcs.md) is a thinner path.

## Install

```bash
npm install -g peepshow
```

No extra packages — the sink uses the Firebase REST endpoint over `fetch`.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `FIREBASE_STORAGE_BUCKET` | yes | — | Target bucket name, e.g. `my-project.appspot.com` |
| `GOOGLE_APPLICATION_CREDENTIALS` | yes* | — | Path to a Google service-account JSON key (*unless `FIREBASE_STORAGE_TOKEN` is set) |
| `FIREBASE_STORAGE_PATH_PREFIX` | no | `peepshow/` | Object key prefix for every upload |
| `FIREBASE_STORAGE_TOKEN` | no | — | Pre-issued Firebase ID token or Google OAuth access token. Skips JWT minting |
| `FIREBASE_STORAGE_API_URL` | no | `https://firebasestorage.googleapis.com` | Override the REST base (mocks / regional endpoints) |
| `GOOGLE_TOKEN_URL` | no | `https://oauth2.googleapis.com/token` | Override the OAuth2 token endpoint |

## Auth cheatsheet

| Scenario | Setup |
| :------- | :---- |
| Short-lived server job with a token minted out-of-band | `export FIREBASE_STORAGE_TOKEN=$(gcloud auth print-access-token)` |
| Long-running service / CI with an SA key | `export GOOGLE_APPLICATION_CREDENTIALS=/etc/peepshow/sa.json` |
| Admin SDK users with a Firebase ID token | `export FIREBASE_STORAGE_TOKEN=<id-token>` |

The service-account must have the `storage.objects.create` permission on the bucket (the default `roles/storage.objectAdmin` covers it).

## Use

```bash
export FIREBASE_STORAGE_BUCKET=my-project.appspot.com
export GOOGLE_APPLICATION_CREDENTIALS=/etc/peepshow/sa.json
peepshow sinks add firebase-storage
peepshow ./video.mp4
```

## Layout in bucket

```
<FIREBASE_STORAGE_PATH_PREFIX><YYYYMMDD>-<HHMMSS>-<strategy>/
    frame_0001.jpg
    frame_0002.jpg
    ...
    manifest.json
```

`manifest.json` bundles the full peepshow extraction payload — `video`, `extraction`, `frames`, `strategy`, `outputDir`, plus `audio` when transcription is enabled — so a downstream job can reconstruct context from the bucket alone.

## Caveats

- Frames are uploaded sequentially (one object per request). Large timelines can be batched or parallelised in a future revision.
- `Content-Type` is inferred from extension: `.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`, `.webp` → `image/webp`, else `application/octet-stream`.
- When minting tokens from an SA key, the sink requests the `devstorage.read_write` + `firebase` scopes. The access token is cached in memory for a single peepshow run.
- No lifecycle / retention management — configure bucket-level rules in the Firebase console.
- Firebase Storage bucket names typically end with `.appspot.com` (default bucket) or `.firebasestorage.app` (newer projects). Use the bucket name shown in the Firebase console under **Storage → Files**.

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
export FIREBASE_STORAGE_BUCKET="my-project.appspot.com"
export GOOGLE_APPLICATION_CREDENTIALS="/etc/peepshow/sa.json"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add firebase-storage
# Optional: only fire for matching inputs
peepshow sinks add firebase-storage --when extension=mp4,mov
peepshow sinks add firebase-storage --when retention=long
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
> then forwards the run to the `Firebase Storage` sink.
>
> **`Firebase Storage`**: uploads every frame plus a `manifest.json` to a Firebase Storage bucket under a timestamped prefix.
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
