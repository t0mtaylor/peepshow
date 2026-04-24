# peepshow-sink-supabase

<!-- gif:sink:supabase -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/supabase.gif" alt="peepshow → supabase demo" width="720">
</p>
<!-- /gif:sink:supabase -->


Uploads every frame plus a `manifest.json` to a [Supabase Storage](https://supabase.com/docs/guides/storage) bucket via its REST endpoint. No SDK, no runtime dependencies — works against hosted Supabase projects and self-hosted Supabase just as happily.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `SUPABASE_URL` | yes | — | project URL, e.g. `https://abc.supabase.co` (trailing slash stripped) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — | service role key (needs write perms on the bucket) |
| `SUPABASE_BUCKET` | yes | — | target bucket name |
| `SUPABASE_PREFIX` | no | `peepshow/` | key prefix applied to every upload |

## Use

```bash
export SUPABASE_URL=https://abc.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
export SUPABASE_BUCKET=peepshow-archive
peepshow sinks add supabase
peepshow ./video.mp4
```

## Layout in bucket

```
<SUPABASE_PREFIX><YYYYMMDD>-<HHMMSS>-<strategy>/
    frame_0001.jpg
    frame_0002.jpg
    ...
    manifest.json
```

`manifest.json` contains the full peepshow payload: `outputDir`, `strategy`, `frames[]`, `video` (codec, dimensions, duration, container tags), and `extraction` stats.

## API

Each upload is a single `POST` against:

```
<SUPABASE_URL>/storage/v1/object/<bucket>/<path>
```

with headers:

- `Authorization: Bearer <service role key>`
- `apikey: <service role key>`
- `Content-Type: <mime>` (inferred from extension — jpg/png/webp/json)
- `x-upsert: true` (overwrites if the key already exists)

## Caveats

- The sink uses the service role key, which bypasses Row Level Security. Keep it on the server side — don't ship it to browsers or commit it to source control.
- Make sure the bucket exists before the first run; Supabase does not auto-create buckets on upload.
- Supabase has per-project upload size limits (default 50 MB per object on the hosted plan). Frames are well under this, but adjust if you change peepshow's output format or width.
- No lifecycle / retention policy is configured — set one at the bucket level in the Supabase dashboard if you want automatic cleanup.

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
export SUPABASE_URL="https://example.com"
export SUPABASE_SERVICE_ROLE_KEY="…"
export SUPABASE_BUCKET="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add supabase
# Optional: only fire for matching inputs
peepshow sinks add supabase --when extension=mp4,mov
peepshow sinks add supabase --when retention=long
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
> then forwards the run to the `Supabase Storage` sink.
>
> **`Supabase Storage`**: pushes every frame plus a `manifest.json` to a Supabase Storage bucket via its REST endpoint.
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
