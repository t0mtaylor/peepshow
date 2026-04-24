# peepshow-sink-github-issues

<!-- gif:sink:github-issues -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/github-issues.gif" alt="peepshow → github-issues demo" width="720">
</p>
<!-- /gif:sink:github-issues -->


Open a GitHub issue on a target repository with the run summary, metadata, and every frame path in the body. Uses the REST API; title defaults to `video.tags.title` / `video.tags.show`, falling back to `peepshow run — N frames`.

## Install

Ships built-in with peepshow:

```bash
npm i -g peepshow
```

No SDK required — the sink posts to `https://api.github.com/repos/<owner>/<repo>/issues` over `fetch`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `GITHUB_TOKEN`  | ✓ | — | PAT or fine-grained token with `issues: write` on the target repo. |
| `GITHUB_REPO`   | ✓ | — | `owner/repo` form, e.g. `myorg/myrepo`. |
| `GITHUB_TITLE`  |   | (from video tags) | Override the issue title. Trimmed to 256 chars. |
| `GITHUB_LABELS` |   | (none) | Comma-separated label names; the repo must already have them. |

## Usage

```bash
export GITHUB_TOKEN="ghp_..."
export GITHUB_REPO="myorg/myrepo"
export GITHUB_LABELS="bug,video"
peepshow ./repro.mov --sink github-issues
```

Optional flags:
- `--when` filters so the sink only fires for matching inputs (see [PLUGINS.md](../PLUGINS.md)).
- Pair with `peepshow sinks add github-issues` for auto-invocation.

## Issue body

Markdown body with:

- `## peepshow run` header and a one-line summary (frame count + strategy).
- Bulleted metadata (duration, resolution, codec).
- `### Tags` — every `video.tags` entry.
- `### Frames` — backtick-wrapped path per frame.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Issue opened. |
| 2 | Missing `GITHUB_TOKEN` or `GITHUB_REPO`. |
| 4 | stdin malformed. |
| 5 | GitHub API returned non-2xx (auth failure, repo not found, labels unknown, rate-limited). |

## Caveats

- Frames are paths, not uploads. GitHub doesn't accept multipart attachments on issues; to render frames inline, pair with an object-storage sink (e.g. `s3`, `gcs`) and post URLs in a downstream processor.
- Unknown label names return `422` — make sure every label in `GITHUB_LABELS` already exists on the repo.
- The request uses `x-github-api-version: 2022-11-28`. Fine-grained tokens need repo-level access explicitly granted; classic PATs need the `repo` scope for private repos.
- No dedup — every run opens a new issue. Use `--when` to scope which runs file issues.

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
export GITHUB_TOKEN="ghp_..."
export GITHUB_REPO="myorg/myrepo"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add github-issues
# Optional: only fire for matching inputs
peepshow sinks add github-issues --when extension=mp4,mov
peepshow sinks add github-issues --when priority=high
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
> then forwards the run to the `GitHub Issues` sink.
>
> **`GitHub Issues`**: files an issue against the configured repo with the run metadata in the body and every frame path listed.
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

*Full list + links: [docs/sinks/README.md](./README.md).*
