# AGENTS.md — peepshow

Generic agent context file. Consumed by Codex CLI, OpenAI Agents, Zed AI, and any tool that follows the `AGENTS.md` convention.

## What peepshow is

CLI tool that turns videos and animated images (GIF/APNG/animated WebP) into a timeline of still frames + an extracted audio track + optional whisper.cpp / openai / groq / deepgram / assemblyai transcript, so an LLM can "watch" and "listen" to what's inside. Installed via `npm i -g peepshow`. Published at https://www.npmjs.com/package/peepshow.

## When to invoke it

**Trigger** — user references a local file path, HTTP(s) URL, or data URI whose target is a video or animated image. Common extensions: `mp4 mov mkv webm avi flv wmv ts mts m2ts 3gp ogv gif apng`.

**Don't fire for** static images (`png jpg jpeg static-webp`) — LLMs already read those natively.

## How to invoke

Preferred, most robust (structured JSON output; includes video metadata + tags):

```bash
peepshow "<path-or-url>" --emit json
```

Parse the stdout JSON:
- `frames[]` — ordered frame paths (chronological).
- `video` — container, codec, resolution, fps, duration, size, plus `tags` (title, director, producer, etc).
- `extraction` — strategy used, ffmpeg source, elapsed ms.

Read each `frames[i].path` as an image. Ground your answer in `video.tags` before describing frames.

## Flags worth knowing

```
peepshow <input> --emit json|paths|markdown|caveman
                 --stats off|short|full
                 --max 20  --min 6  --threshold 0.2  --fps 1  --width 960
                 --sink <name[:arg]>  --sink-cmd <shell>  --no-auto-sinks
                 --gpu auto|off|videotoolbox|cuda|qsv|vaapi|amf|d3d11va
                 --no-gpu
```

## Per-agent entrypoints

- Claude Code → `/peepshow:slides <path>` (+ `UserPromptSubmit` hook auto-invokes on drag-drop)
- Cursor → `.cursor/rules/peepshow.mdc`
- Windsurf → `.windsurf/rules/peepshow.md`
- Cline → `.clinerules/peepshow.md`
- Codex CLI → `.codex/hooks.json` (SessionStart announces peepshow; invoke via Bash)
- Gemini CLI → `gemini-extension.json` + `GEMINI.md`

Full integrations guide: [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md).
