# peepshow-sink-jira

<!-- gif:sink:jira -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/jira.gif" alt="peepshow → jira demo" width="720">
</p>
<!-- /gif:sink:jira -->


Create a Jira issue (or attach to an existing one) with:
- a heading + bullet list (strategy, frames, codec, duration, resolution, director, studio) in the issue description as ADF,
- one multipart attachment per extracted frame.

Works with Jira Cloud + Data Center / Server via basic auth (email + API
token) or a Personal Access Token.

## Invocation

```bash
peepshow ./bug-repro.mov --sink jira
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `JIRA_BASE_URL`      | ✓ | — | `https://<you>.atlassian.net` (Cloud) or DC/Server URL. |
| `JIRA_USER`          | ○ | — | Email for basic auth. Required with `JIRA_API_TOKEN`. |
| `JIRA_API_TOKEN`     | ○ | — | API token for basic auth. |
| `JIRA_BEARER_TOKEN`  | ○ | — | PAT — use this **or** `JIRA_USER + JIRA_API_TOKEN`. |
| `JIRA_PROJECT_KEY`   | ◐ | — | Project key to create a new issue in (required unless `JIRA_ISSUE_KEY` is set). |
| `JIRA_ISSUE_KEY`     | ◐ | — | Attach to this existing key; skip the create step. |
| `JIRA_ISSUE_TYPE`    |   | `Task` | Issue type on create. |

## Exit codes

| 0 | Issue created / attachments uploaded. |
| 2 | Missing env / auth combo. |
| 4 | stdin malformed. |
| 5 | Jira returned non-2xx on create or attachment. |

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
export JIRA_BASE_URL="https://example.com"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add jira
# Optional: only fire for matching inputs
peepshow sinks add jira --when extension=mp4,mov
peepshow sinks add jira --when priority=high
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
> then forwards the run to the `Jira` sink.
>
> **`Jira`**: opens a Jira issue with the run summary as the description and every frame uploaded as an attachment.
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

> **Transcript handling**: transcript lines appear in the issue body so triage has a copy-pasteable record of what was said on-screen.
