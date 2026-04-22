---
description: Manage peepshow's persistent auto-sink list (list, add, remove, clear). Use when the user asks to turn a peepshow sink on or off, enable folder/mysql/webhook sinks, or wants to see which sinks are currently active. Sinks run on every peepshow extraction.
---

# Sink management

peepshow supports **auto-sinks** — persistent sink definitions in `~/.peepshow/sinks.json` that run on every extract. This skill manages that list on the user's behalf.

## Detect intent

| User says | Run |
| :-------- | :-- |
| "list sinks" / "which sinks are active" / "show sinks" | `peepshow sinks list` |
| "enable folder sink at /Volumes/Shared" / "add folder sink" | `peepshow sinks add folder:/Volumes/Shared` |
| "enable mysql sink" | `peepshow sinks add mysql` *(reminder: sink needs `DATABASE_URL` in env)* |
| "add custom sink: <command>" | `peepshow sinks add-cmd '<command>'` |
| "add X but only for .mp4/.mov files" | `peepshow sinks add <spec> --when extension=mp4,mov` |
| "add X for videos under /Videos/" | `peepshow sinks add <spec> --when path=/Videos/` |
| "add X for films directed by Kubrick" | `peepshow sinks add <spec> --when director=Kubrick` |
| "add X when filename matches *vacation*" | `peepshow sinks add <spec> --when filename='*vacation*'` |
| "remove sink 2" / "disable the mysql one" | First `peepshow sinks list`, then `peepshow sinks remove <n>` |
| "clear all sinks" / "disable all sinks" | `peepshow sinks clear` |
| "turn off sinks for this video only" | Tell the user to pass `--no-auto-sinks` on the next invocation — do not touch the config |

## Notes

- Always run `peepshow sinks list` after any mutation to confirm the new state.
- `<name>` maps to an executable `peepshow-sink-<name>` on `$PATH`. Extra colon-separated tokens become positional args (`folder:/tmp/shared` → `peepshow-sink-folder /tmp/shared`).
- The sink count is shown live in the Claude Code statusline badge, e.g. `[PEEPSHOW|3s]` means three auto-sinks are active.
- Sinks receive the full peepshow JSON payload on stdin (including container tags: title, director, producer, copyright, etc.) — mention this when the user is choosing what to persist.
- **Conditional matching (`--when`):** extension/filename/path/container/codec + any video metadata tag (director, genre, show, producer, publisher, …). Multiple `--when` flags AND together; values inside one clause (e.g. `ext=mp4,mov`) are ORed. Example: `peepshow sinks add folder:/cinema --when director=Kubrick --when extension=mp4` = "archive Kubrick mp4s only".

## Troubleshooting

- **"sink failed (exit N)"** during a run → the sink's binary isn't on `$PATH` (for `--sink <name>`) or the shell command is wrong (for `--sink-cmd`). Fix by `peepshow sinks remove <n>` and re-adding with the correct spec, or by installing the missing binary.
- **"no auto-sinks configured"** → file doesn't exist yet. Any `add` command creates it.
