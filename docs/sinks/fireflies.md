# peepshow-sink-fireflies

Submit each peepshow run to [Fireflies.ai](https://fireflies.ai) for
transcription + meeting-style indexing. The sink calls the
`uploadAudio` GraphQL mutation, handing Fireflies a publicly reachable
URL to the audio extracted by peepshow's second ffmpeg pass. Fireflies
fetches the audio asynchronously, transcribes it with its own engine,
and stores it as a fully-searchable "meeting" in your account — visible
in the dashboard, the search API, the Notetaker integrations, and
every downstream Zapier / webhook surface you have configured.

```graphql
mutation UploadAudio($input: AudioUploadInput!) {
  uploadAudio(input: $input) {
    success
    title
    message
  }
}
```

Endpoint: `POST https://api.fireflies.ai/graphql` with
`Authorization: Bearer <FIREFLIES_API_KEY>`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `FIREFLIES_API_KEY` | ✓ | — | Personal API key (Bearer auth). Generate in the Fireflies dashboard → Integrations → Fireflies API. |
| `FIREFLIES_API_URL` |   | `https://api.fireflies.ai/graphql` | Override the GraphQL endpoint. Useful for proxies or enterprise gateways. Trailing slashes stripped. |
| `FIREFLIES_TITLE` |   | `video.tags.title` / `.show` / `peepshow run` | Override the transcript title shown in the Fireflies dashboard. |
| `FIREFLIES_AUDIO_BASE_URL` | ✓ (when no `FIREFLIES_AUDIO_URL`) | — | Public base URL that mirrors `payload.outputDir`. The sink joins it with `basename(audio.path)` to produce the URL Fireflies pulls from. Required when peepshow stored audio locally — Fireflies needs a reachable URL. |
| `FIREFLIES_AUDIO_URL` |   | — | Explicit override of the audio URL sent to `uploadAudio`. Wins over the derived URL. |
| `FIREFLIES_ATTENDEES` |   | — | Comma-separated list of attendee emails to pre-populate on the meeting record. |
| `FIREFLIES_LANGUAGE` |   | — | BCP-47 language hint for the transcription engine, e.g. `en`, `es`, `de`. |

## Exit codes

| 0 | `uploadAudio` reported `success: true`. |
| 2 | Missing required env var (`FIREFLIES_API_KEY`, or no resolvable audio URL). |
| 4 | stdin malformed. |
| 5 | Fireflies returned non-2xx, the request failed at the network layer, or the GraphQL response contained `errors` / `uploadAudio.success: false`. |

## Use

### 1. Mirror frames + audio somewhere public

Fireflies can only ingest audio it can `GET`. Pair this sink with a
storage sink that publishes peepshow's `outputDir` to a public bucket:

```bash
export AWS_S3_BUCKET="peepshow-public"
export AWS_S3_PREFIX="runs"
peepshow sinks add s3
peepshow sinks add s3 --when extension=mp3,m4a,aac

# Tell Fireflies where to find the mirrored audio:
export FIREFLIES_API_KEY="ff_pat_xxx"
export FIREFLIES_AUDIO_BASE_URL="https://peepshow-public.s3.amazonaws.com/runs/<run-id>"
peepshow sinks add fireflies
```

### 2. Single-call mode

If the audio is already at a known URL (or you've uploaded it manually
elsewhere), skip the base-URL machinery and point Fireflies at the
exact file:

```bash
export FIREFLIES_API_KEY="ff_pat_xxx"
export FIREFLIES_AUDIO_URL="https://example.com/recordings/sprint-demo.mp3"
peepshow ./demo.mp4 --sink fireflies
```

### 3. With attendees + language hint

```bash
export FIREFLIES_API_KEY="ff_pat_xxx"
export FIREFLIES_AUDIO_BASE_URL="https://peepshow-public.s3.amazonaws.com/runs/abc"
export FIREFLIES_ATTENDEES="alice@example.com,bob@example.com"
export FIREFLIES_LANGUAGE="en"
peepshow ./standup.mp4 --sink fireflies
```

## Caveats

- **Fireflies needs a reachable URL.** It does not accept multipart
  uploads through `uploadAudio` — only URL-based ingestion. The
  practical pattern is a `peepshow → s3 (or gcs / dropbox) → fireflies`
  chain where the first sink publishes the audio file and the second
  hands the URL to Fireflies. Without that, the sink errors at exit 2
  with a clear hint.
- The mutation is **asynchronous**. A `success: true` response means
  Fireflies has queued the transcription, not that it has finished. The
  dashboard polls the same record over the next 1-10 minutes (depends
  on duration + queue length) and surfaces the transcript once ready.
- Each run becomes a **separate meeting** in Fireflies. There is no
  built-in dedup; re-running peepshow against the same input creates a
  second meeting. Pair with an `--when` condition on `path` / `tag` to
  avoid double-processing in CI loops.
- The public Fireflies API is **read-mostly** for transcript / soundbite
  management — `uploadAudio` is the one write surface that fits a
  generic "post the video here" pipeline. Comment-on-transcript and
  related mutations require an existing Fireflies `transcript_id`,
  which peepshow doesn't have.

## Use with an LLM agent

Every peepshow sink is a zero-config extension point for any LLM CLI —
Claude Code, Cursor, Windsurf, Codex, Gemini, or any agent that can
shell out. The LLM doesn't need a plugin; it just needs `peepshow` on
`PATH` and the sink's env vars in the shell it runs under.

### 1. Set the environment

```sh
export FIREFLIES_API_KEY="ff_pat_xxx"
export FIREFLIES_AUDIO_BASE_URL="https://peepshow-public.s3.amazonaws.com/runs/<run-id>"
# Optional: language hint + attendees
export FIREFLIES_LANGUAGE="en"
export FIREFLIES_ATTENDEES="alice@example.com,bob@example.com"
```

### 2. Register as an auto-sink

```sh
peepshow sinks add s3                           # mirror audio publicly
peepshow sinks add fireflies                    # then upload to Fireflies
# Optional: only ingest meeting-shaped clips
peepshow sinks add fireflies --when extension=mp4,mov,m4a
```

### 3. An LLM session, end-to-end

> **You**: drop a `standup.mp4` into Claude Code.
>
> **Claude Code**: the `UserPromptSubmit` hook detects the video and
> auto-invokes `/peepshow:slides`. peepshow extracts frames + audio.
>
> **`s3`**: uploads the extracted `audio.m4a` to
> `s3://peepshow-public/runs/<run-id>/audio.m4a`.
>
> **`fireflies`**: posts `uploadAudio(url: "https://peepshow-public.s3.amazonaws.com/runs/<run-id>/audio.m4a", title: "Daily Standup")` — Fireflies queues the transcription and emails you when it's ready.
>
> **You**: a few minutes later, search the Fireflies dashboard for
> "standup" and the run is right there with a full transcript +
> speaker labels.

### 4. What the sink sees

The sink receives the complete `--emit json` payload on stdin — not
just the frame paths. That includes:

- `video` — codec, duration, resolution, container tags (director /
  studio / title etc).
- `frames[]` — every extracted frame path + byte size (used only to
  count for the description line; Fireflies ingests audio).
- `audio` — `path`, `durationSeconds`, codec — used to derive the
  uploaded URL via `FIREFLIES_AUDIO_BASE_URL` when no override is set.

Only the `audio` path and the run title are sent to Fireflies — frames
are not uploaded, because Fireflies is an audio-first product.
