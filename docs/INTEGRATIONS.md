# Integrations

`peepshow` is fundamentally a CLI that prints frame paths to stdout. Any LLM tool that can run a shell command and read image files can use it. This guide shows concrete wiring for the main ones.

The four output formats matter here:

- `--emit paths` (default) — human-readable summary + one absolute frame path per line.
- `--emit json` — a single JSON object with `frames`, `video`, and `extraction`. Best for programmatic consumers. The schema is locked down by `tests/contract.test.ts` — breakage blocks CI.
- `--emit markdown` — a markdown doc with `![](path)` image refs. Best for LLM tools that auto-render markdown images.
- `--emit caveman` — ultra-terse one-line summary + paths. Pairs with [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) for token-budget setups.

Add `--stats off` to strip all stats if you're token-budget-sensitive, `--stats full` for detailed telemetry. Hardware-accelerated decoding is on by default — `--no-gpu` to force CPU. **Perceptual frame dedup is on by default** (`--dedup on`) — every run runs an 8×8 dHash post-pass, so a static talking-head clip emits a handful of frames covering actual visual changes rather than 600 near-identical thumbnails. Tweak with `--dedup-distance N` (default 5; lower = stricter), or disable with `--no-dedup`.

## Annotate the report (close the loop)

Every successful run writes `report.html` + `manifest.json` into the run's `outputDir`. After your LLM has read the frames + transcript, pipe a JSON summary back so the report captures the model's understanding for whoever opens the HTML next:

```bash
echo '{"summary":"<2-4 sentences>","provider":"<your-tool>","model":"<model-id>"}' \
  | peepshow report annotate "<outputDir>"
```

`<outputDir>` is the JSON payload's `outputDir` field. Optional fields: `perFrame: [{idx, text}]` for per-frame captions, `generatedAt` for explicit ISO timestamp, `source` for provenance. The annotation appears under the "LLM analysis" section in `report.html`.

<!-- gif:report-outro -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/report-outro.gif" alt="peepshow report — Summary, LLM analysis, sink fan-out, then the annotate command closes the loop" width="720">
</p>
<!-- /gif:report-outro -->

This is the loop the per-tool sections below all wire up — the snippets show the tool-specific glue.

## Caller attribution (multi-agent setups)

A single `peepshow serve` instance is shared across every Claude Code, Copilot, Cursor, Codex, etc. session on the machine. To attribute each run + each HTTP call back to the right agent, set three optional env vars before invoking peepshow:

```bash
export PEEPSHOW_CLIENT=claude-code     # short slug; appears as a badge in /access + run history
export PEEPSHOW_SESSION="$SESSION_ID"  # any per-conversation id; Claude Code: $CLAUDE_SESSION_ID
export PEEPSHOW_AGENT=claude-opus-4-7  # model id (informational)
```

These end up in two places:

1. **`manifest.json` → `invoker`** — captured at extract time, surfaced as the `caller` column on the run history homepage.
2. **`~/.peepshow/serve-access.ndjson`** — every served HTTP request is tagged with `client` / `session` / `agent` (set via `X-Peepshow-Client` / `X-Peepshow-Session` / `X-Peepshow-Agent` headers, or sniffed from the User-Agent). Visible at `http://127.0.0.1:7331/access`.

Per-tool snippets below set them where applicable. They're never required — peepshow runs fine without — but with multiple agents on one machine they're how you tell who's doing what.

---

## Claude Code


<!-- gif:agent:claude-code -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/agent-gifs/claude-code.gif" alt="peepshow in Claude Code" width="720">
</p>
<!-- /gif:agent:claude-code -->

This repo **is** a Claude Code plugin. After `npm install`, load it:

```bash
claude --plugin-dir /path/to/peepshow
```

Then use the skill:

```
/peepshow:slides ./video.mp4
```

Or just describe the task — Claude auto-invokes the skill based on the description in `skills/slides/SKILL.md`. The skill exports `PEEPSHOW_CLIENT=claude-code` + `PEEPSHOW_SESSION=$CLAUDE_SESSION_ID` automatically, so a shared `peepshow serve` knows which Claude Code session each run came from.

---

## OpenAI Codex CLI


<!-- gif:agent:codex -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/agent-gifs/codex.gif" alt="peepshow in OpenAI Codex CLI" width="720">
</p>
<!-- /gif:agent:codex -->

Codex supports custom prompts/agents with shell access. Drop this into `~/.codex/prompts/slides.md` (adjust path to match your Codex install):

```markdown
---
description: Extract and view a video's timeline as still frames
---

Run `PEEPSHOW_CLIENT=codex peepshow "$ARGUMENTS" --emit json` in the shell. Parse the resulting JSON
for `frames[].path`. Read each frame path as an image and describe what you see.
If the user's question needs timestamps, use `video.durationSeconds` together
with frame ordering to estimate when each frame occurs.

After you've understood the timeline, annotate the auto-generated report so
the next viewer sees your synthesis:

    echo '{"summary":"<your summary>","provider":"codex"}' \
      | peepshow report annotate "$outputDir"

`$outputDir` is the JSON payload's `outputDir` field.
```

Invoke with `/slides ./video.mp4`.

---

## Google Gemini CLI


<!-- gif:agent:gemini -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/agent-gifs/gemini.gif" alt="peepshow in Google Gemini CLI" width="720">
</p>
<!-- /gif:agent:gemini -->

Gemini CLI allows defining custom commands via TOML config. Add to `~/.gemini/commands/slides.toml`:

```toml
name = "slides"
description = "Extract relevant frames from a video for review"
command = "peepshow \"{{args}}\" --emit markdown"
```

The markdown output contains `![](path)` image refs which Gemini CLI reads as attachments.

After you've reviewed the frames, annotate the auto-generated `report.html` so the next viewer sees your synthesis:

```toml
name = "slides-annotate"
description = "Attach a summary to the latest peepshow report"
command = "echo '{\"summary\":\"{{args}}\",\"provider\":\"gemini\"}' | peepshow report annotate \"$outputDir\""
```

(Replace `$outputDir` with the actual path printed in the previous run's `outputDir` field.)

---

## Aider

> **There's a native sink: `peepshow-sink-aider`** — appends a markdown block (frames + transcript) into `.aider.chat.history.md` after each run. See [`docs/sinks/aider.md`](./sinks/aider.md) for the env vars.

Aider can also run shell commands inline with `/run`. Easiest wiring: a shell alias.

```bash
alias slides='peepshow --emit paths --stats short'
```

Then in aider:

```
/run slides ./video.mp4
/add /tmp/peepshow-.../frame_0001.jpg
/add /tmp/peepshow-.../frame_0002.jpg
```

Or script it:

```bash
# ~/.local/bin/aider-slides
#!/usr/bin/env bash
peepshow "$1" --emit json | jq -r '.frames[].path' | xargs -I{} echo "/add {}"
```

Pipe the stdout back into aider's input.

---

## Simon Willison's `llm`

`llm` accepts image attachments via the `-a` flag. One-liner:

```bash
peepshow ./video.mp4 --emit json \
  | jq -r '.frames[].path' \
  | xargs -I{} printf ' -a %s' {} \
  | xargs -I ARGS llm ARGS 'summarise what happens in this video'
```

Or wrap it as an `llm` alias script at `~/.local/bin/llm-video`:

```bash
#!/usr/bin/env bash
# Usage: llm-video <video> <prompt>
set -euo pipefail
video="$1"; shift
frames=$(peepshow "$video" --emit json | jq -r '.frames[].path')
attachments=""
for f in $frames; do attachments+=" -a $f"; done
# shellcheck disable=SC2086
llm $attachments "$*"
```

---

## GitHub Copilot CLI

Copilot CLI (`gh copilot`) supports shell execution. Ask Copilot with a shell prompt:

```
gh copilot suggest "extract frames from ./video.mp4 and list them"
```

Copilot will suggest running `peepshow ./video.mp4`. For its in-VS-Code chat, install Copilot Chat and point the assistant at the output with:

```
I ran: PEEPSHOW_CLIENT=copilot peepshow ./video.mp4 --emit json
Here is the result: <paste stdout>
```

(`PEEPSHOW_CLIENT=copilot` is optional — only matters if a `peepshow serve` instance is also tracking other agents on the same machine.)

## ChatGPT (Custom GPTs / Projects / Code Interpreter)

> **There's a native sink: `peepshow-sink-openai-files`** — pre-uploads frames + a manifest to OpenAI's `/v1/files` endpoint (`purpose=vision`) so Custom GPTs and Assistants file-search can ground against them. See [`docs/sinks/openai-files.md`](./sinks/openai-files.md).

Inside a Code Interpreter sandbox, upload the video and run:

```python
import subprocess, json
result = json.loads(
    subprocess.check_output(["peepshow", "/mnt/data/video.mp4", "--emit", "json"])
)
for frame in result["frames"]:
    display(Image(frame["path"]))
```

(Code Interpreter needs `peepshow` pre-installed on the sandbox image. When that isn't possible, run locally and upload the frames.)

## Sourcegraph Cody

> **There's a native sink: `peepshow-sink-cody`** — drops frames + manifest + transcript into `.cody/context/peepshow/` so Cody surfaces them automatically. See [`docs/sinks/cody.md`](./sinks/cody.md).

Cody's "shell context" also lets you run a command inline and hand its stdout to the model:

```
@sh peepshow ./video.mp4 --emit markdown
```

Cody renders the markdown images inline.

## Zed AI

Zed's assistant supports `/` commands including `/shell`. Run:

```
/shell peepshow ./video.mp4 --emit json
```

then ask "read each frame under `frames[].path` and describe the scene changes".

## Cursor / Continue / Cline


<!-- gif:agent:cursor -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/agent-gifs/cursor.gif" alt="peepshow in Cursor / Continue / Cline" width="720">
</p>
<!-- /gif:agent:cursor -->

> **Native sinks ship for both Continue (`peepshow-sink-continue`) and Cline (the agent rule at `.clinerules/peepshow.md`).** Continue's sink drops frames + manifest + transcript into `.continue/context/peepshow/` so the agent has them on the next prompt. See [`docs/sinks/continue.md`](./sinks/continue.md). Cursor uses the rule at `.cursor/rules/peepshow.mdc` and the standalone CLI.
>
> Windsurf has its own rule at `.windsurf/rules/peepshow.md` — Cascade auto-picks it up.

These tools run in VS Code with shell access via their own terminal or a built-in "run command" capability. Without the dedicated sinks, the manual approach is:

1. Invoke `PEEPSHOW_CLIENT=cursor peepshow ./video.mp4 --emit paths` (use `continue`, `cline`, or `windsurf` as the slug for the matching tool).
2. The assistant sees the paths in stdout.
3. Drag the temp directory into the chat or ask the tool to "open these images".

The CLI + `--emit paths` default is the whole integration when you skip the sinks.

## Ollama-based tools (Open WebUI, Continue offline mode)

Local LLMs that accept image input (LLaVA, bakllava, moondream) can read the emitted frames once ingested into the chat:

```bash
peepshow ./video.mp4 --emit json \
  | jq -r '.frames[].path' \
  | while read -r f; do ollama run llava "describe this frame" < "$f"; done
```

## Stacking with caveman (token-aware output)

When your agent runtime has [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) active, switch peepshow's output to match:

```bash
peepshow ./video.mp4 --emit caveman
# 12frm 42s 1920x1080 h264 30fps scene 187.24ms
# /tmp/peepshow-abc/frame_0001.jpg
# /tmp/peepshow-abc/frame_0002.jpg
# ...
```

That first line is ~70% shorter than the default summary while preserving every stat a caller might need, so the LLM spends fewer tokens on peepshow's preamble and more on actually reasoning about the frames.

---

## Generic shell / pipeline

For tools that aren't in this list, the contract is stable:

```bash
peepshow <input> --emit json
```

produces a JSON document like:

```json
{
  "outputDir": "/tmp/peepshow-abc",
  "strategy": "scene",
  "frames": [ { "path": "...", "bytes": 12345 }, ... ],
  "video": { "durationSeconds": 60.0, "codec": "h264", "width": 1920, "height": 1080, "fps": 30, ... },
  "extraction": { "framesEmitted": 12, "elapsedMs": 342.1, ... }
}
```

Exit code 0 means success with ≥1 frame. See `README.md` for the full exit code table.

## Adding your tool here

PRs welcome. Keep examples concise and focus on the stdout-contract rather than re-inventing tool-specific plugin formats.
