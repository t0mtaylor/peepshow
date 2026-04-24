# peepshow-sink-zulip

<!-- gif:sink:zulip -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/zulip.gif" alt="peepshow → zulip demo" width="720">
</p>
<!-- /gif:sink:zulip -->


POST a peepshow run as a markdown message to a Zulip stream topic (or
private DM) via `/api/v1/messages`. The body is form-encoded
(`application/x-www-form-urlencoded`) and authed with Basic
`email:api_key`.

Message body shows the title, a single-line summary
(`N frames · strategy=… · codec=…`), optional metadata lines
(Duration / Resolution / Director / Studio), then either embedded
images (when `ZULIP_IMAGE_BASE` is set) or a bullet list of frame paths.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `ZULIP_SITE`       | ✓ | — | Org URL, e.g. `https://myorg.zulipchat.com`. Trailing slashes are stripped. |
| `ZULIP_EMAIL`      | ✓ | — | Bot email (Basic auth user). |
| `ZULIP_API_KEY`    | ✓ | — | Bot API key (Basic auth password). |
| `ZULIP_STREAM`     | ✓ | — | Stream name (`type=stream`) **or** comma-separated list of emails (`type=private`). |
| `ZULIP_TOPIC`      |   | `peepshow` | Topic name for stream messages. Ignored when `type=private`. |
| `ZULIP_TYPE`       |   | `stream` | `stream` or `private`. |
| `ZULIP_IMAGE_BASE` |   | — | URL prefix — each frame embeds as `![frame NNNN](<base>/<name>)` up to `ZULIP_MAX_IMAGES`. Leave unset if frames aren't served publicly. |
| `ZULIP_MAX_IMAGES` |   | `8` | Cap on embedded images. |

## Exit codes

| 0 | Message posted (`result: success`). |
| 2 | Missing required env var. |
| 4 | stdin malformed. |
| 5 | Zulip returned non-2xx, or 200 with `result: error`. |

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
export ZULIP_SITE="https://example.com"
export ZULIP_EMAIL="you@example.com"
export ZULIP_API_KEY="…"
export ZULIP_STREAM="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add zulip
# Optional: only fire for matching inputs
peepshow sinks add zulip --when extension=mp4,mov
peepshow sinks add zulip --when studio=Pixar
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
> then forwards the run to the `Zulip` sink.
>
> **`Zulip`**: sends a markdown message addressed to a stream topic or DM with optional inline frame embeds.
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

> **Transcript handling**: the transcript snippet is posted alongside the frames as a secondary message in the thread.
