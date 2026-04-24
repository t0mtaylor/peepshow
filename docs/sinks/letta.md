# peepshow-sink-letta

<!-- gif:sink:letta -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/letta.gif" alt="peepshow → letta demo" width="720">
</p>
<!-- /gif:sink:letta -->


Post a peepshow run summary to a [Letta](https://letta.com) (formerly MemGPT)
agent's inbox as a single user message. The agent's built-in memory pipeline
distils the message into recall memory so it can answer questions about the
run later.

Works with Letta Cloud and self-hosted deployments.

## Install

Ships built-in — the bin lands on PATH after `npm i -g peepshow`.

## Invocation

```bash
peepshow ./bug-repro.mov --sink letta
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `LETTA_BASE_URL` | ✓ | — | Base URL, e.g. `https://app.letta.com` (cloud) or `http://localhost:8283` (self-hosted). Trailing slashes are stripped. |
| `LETTA_AGENT_ID` | ✓ | — | Target agent id the message is posted to. |
| `LETTA_API_KEY`  |   | (none) | Bearer token. **Required for Letta Cloud**; optional for self-hosted. |

## Message shape

The sink posts a single user-role message to
`POST <LETTA_BASE_URL>/v1/agents/<LETTA_AGENT_ID>/messages`:

```
peepshow run: <title>

Summary:
- <N> frames extracted (<strategy> strategy)
- Codec: <codec>
- Duration: <N>s         (when known)
- Resolution: <WxH>      (when known)
- Director: <director>   (when tag present)
- Studio: <studio>       (when tag present)

Frames (first <up to 10>):
- <frame_path_1>
- <frame_path_2>
…
(+N more)                (only when total > 10)

Output directory: <output_dir>
```

Title falls back to `video.tags.title` → `video.tags.show` → `"peepshow run"`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Message accepted. |
| 2 | Missing `LETTA_BASE_URL` / `LETTA_AGENT_ID`. |
| 4 | stdin malformed / empty. |
| 5 | Letta returned non-2xx. |

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
export LETTA_BASE_URL="https://example.com"
export LETTA_AGENT_ID="your-value"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add letta
# Optional: only fire for matching inputs
peepshow sinks add letta --when extension=mp4,mov
peepshow sinks add letta --when genre=tutorial
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
> then forwards the run to the `Letta` sink.
>
> **`Letta`**: posts a concise run summary as one user message to a Letta (MemGPT) agent so its memory pipeline distils it into recall memory.
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

> **Transcript handling**: the transcript text is a natural embedding target — indexed alongside the frames so later retrieval covers spoken content too.
