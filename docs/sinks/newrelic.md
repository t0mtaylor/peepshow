# peepshow-sink-newrelic

<!-- gif:sink:newrelic -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/newrelic.gif" alt="peepshow → New Relic demo" width="720">
</p>
<!-- /gif:sink:newrelic -->


POST a peepshow run as a New Relic custom event via the Events API
(`/v1/accounts/<ACCOUNT_ID>/events`). Each run becomes a queryable
`PeepshowRun` event — scoped, attributed, NRQL-friendly:

```sql
SELECT count(*), average(extractionElapsedMs), average(framesEmitted)
FROM PeepshowRun
FACET videoCodec
SINCE 1 day ago
```

Attribute names are camelCase alphanumerics (New Relic forbids dots), so
container tags flatten with a `videoTag` prefix: `director` →
`videoTagDirector`, `release.year` → `videoTagReleaseyear`. Null,
undefined, and empty-string attributes are dropped so NRQL doesn't
surface present-but-empty fields.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `NEW_RELIC_INSERT_KEY` | ✓ | — | `Api-Key` header. The Events API **Insert Key**, not the licence key. |
| `NEW_RELIC_ACCOUNT_ID` | ✓ | — | Numeric account id in the endpoint path. |
| `NEW_RELIC_REGION`     |   | `us` | `us` \| `eu`. Unknown values clamp to `us`. |
| `NEW_RELIC_EVENT_TYPE` |   | `PeepshowRun` | Override the `eventType` attribute. |
| `NEW_RELIC_API_URL`    |   | — | Full endpoint override (proxies / tests). Used verbatim. |

- **US endpoint**: `https://insights-collector.newrelic.com/v1/accounts/<ACCOUNT_ID>/events`
- **EU endpoint**: `https://insights-collector.eu01.nr-data.net/v1/accounts/<ACCOUNT_ID>/events`

Generate the insert key from **one.newrelic.com** → *API keys* →
*Create key* → type **Ingest – License** (the UI sometimes still labels
this **Insights insert key**).

## Usage

```sh
NEW_RELIC_INSERT_KEY=... \
NEW_RELIC_ACCOUNT_ID=1234567 \
peepshow ./crash.mov --sink newrelic
```

EU-region account:

```sh
NEW_RELIC_INSERT_KEY=... \
NEW_RELIC_ACCOUNT_ID=1234567 \
NEW_RELIC_REGION=eu \
peepshow ./crash.mov --sink newrelic
```

Custom event type:

```sh
NEW_RELIC_INSERT_KEY=... \
NEW_RELIC_ACCOUNT_ID=1234567 \
NEW_RELIC_EVENT_TYPE=VideoIngest \
peepshow ./crash.mov --sink newrelic
```

## Exit codes

| 0 | Event accepted (200 OK, `{ "success": true }`). |
| 2 | Missing `NEW_RELIC_INSERT_KEY` or `NEW_RELIC_ACCOUNT_ID`. |
| 4 | stdin malformed. |
| 5 | New Relic returned non-2xx, or the request failed to connect. |

## Attributes emitted

Every non-null field in the run is sent as a top-level attribute:

- **Run**: `eventType`, `strategy`, `source=peepshow`, `outputDir`.
- **Video**: `videoDurationSeconds`, `videoWidth`, `videoHeight`,
  `videoFps`, `videoCodec`, `videoContainer`, `videoBitrateKbps`,
  `videoSizeBytes`, `videoEstimatedTotalFrames`.
- **Extraction**: `framesEmitted`, `framesPruned`, `framesBeforePrune`,
  `totalOutputBytes`, `avgFrameBytes`, `extractionElapsedMs`,
  `extractionStrategy`, `extractionThreshold`, `extractionFps`,
  `ffmpegSource`.
- **Audio (v0.4+)**: `audioCodec`, `audioDurationSeconds`,
  `audioChannels`, `audioSampleRateHz`, `audioBitrateKbps`,
  `audioPeakDbfs`, `audioSilenceRatio`, `audioSkippedReason`.
- **Transcript (v0.4+)**: `transcriptProvider`, `transcriptModel`,
  `transcriptLanguage`, `transcriptDurationSeconds`,
  `transcriptSegmentCount`, `transcriptTextLength`,
  `transcriptSkippedReason`.
- **Container tags**: every `video.tags[key]` flows through as
  `videoTag<Key>` (alnum-only).

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
export NEW_RELIC_INSERT_KEY="…"
export NEW_RELIC_ACCOUNT_ID="1234567"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add newrelic
# Optional: only fire for matching inputs
peepshow sinks add newrelic --when extension=mp4,mov
peepshow sinks add newrelic --when environment=prod
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
> then forwards the run to the `New Relic` sink.
>
> **`New Relic`**: POSTs a `PeepshowRun` custom event with the run
> summary and flattened video/audio/transcript attributes so it's
> immediately queryable via NRQL.
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

> **Transcript handling**: the transcript doesn't ship in full — only
> metadata (`transcriptProvider`, `transcriptSegmentCount`,
> `transcriptTextLength`) is attached. Keep the raw transcript on a
> storage sink if you need the words.
