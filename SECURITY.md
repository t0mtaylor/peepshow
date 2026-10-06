# Security policy

## Supported versions

peepshow ships from a single line of development. Fixes land in the latest
release; there are no maintained backport branches.

| Version | Supported |
| :------ | :-------- |
| latest `0.9.x` | ✅ |
| `< 0.9.0` | ❌ — upgrade via `npm i -g peepshow` |

## Reporting a vulnerability

Report privately — please don't open a public issue for a security problem.

- **Preferred:** [GitHub private vulnerability reporting](https://github.com/t0mtaylor/peepshow/security/advisories/new)
- **Alternative:** email `tom.tha.dj@gmail.com` with `peepshow security` in the subject

Please include the peepshow version (`peepshow --version`), your OS and Node
version, which ffmpeg peepshow resolved (the `ffmpeg=` field in `--stats`
output), and the smallest reproduction you can manage. If a specific input file
triggers it, describe the input rather than attaching it in a first message.

Expect an acknowledgement within 7 days. If a fix is warranted it goes out in
the next patch release, credited unless you'd rather not be.

## What peepshow does on your machine

Worth knowing when assessing impact:

- **It shells out to `ffmpeg`.** Resolution order is `PEEPSHOW_FFMPEG` →
  `ffmpeg` on `PATH` → the bundled `ffmpeg-static`. Setting `PEEPSHOW_FFMPEG`
  points peepshow at an arbitrary executable, so treat it as you would any
  other command-path override.
- **Some inputs shell out further.** YouTube URLs invoke `yt-dlp` from `PATH`;
  optional ML passes invoke `whisper.cpp`, `transnetv2`, `yolo` and similar if
  you enable them. peepshow does not download or install these — they run only
  if already present.
- **Sinks are arbitrary executables by design.** `--sink <name>` runs
  `peepshow-sink-<name>` from `PATH` and `--sink-cmd` runs a shell command you
  supply, each receiving the run's JSON payload on stdin. Auto-sinks in
  `~/.peepshow/sinks.json` run on *every* extraction. Anything that can write
  that file can get code executed on your next run — it is a local
  configuration file and should be treated as trusted input.
- **Credentials come from the environment.** Sinks read their own env vars
  (`DATABASE_URL`, `*_API_KEY`, `*_TOKEN`, …). peepshow does not read, store,
  or forward credentials beyond passing the environment to the sink process.
  Example values in `docs/sinks/*.md` are placeholders, never real keys.
- **`peepshow serve` binds loopback by default.** Widening the bind address
  exposes your run history — frames, transcripts, and metadata — to the
  network with no authentication of its own.
- **Network egress is input-driven.** peepshow fetches remote URLs you pass it
  and uploads audio only when you select a cloud transcription provider. There
  is no telemetry, no analytics, and no background reporting.

## Scope

In scope: anything that lets untrusted *input* (a video file, a URL, a
container metadata tag, a sink payload) escalate into command execution, path
traversal, credential disclosure, or writes outside the run's output directory.

Out of scope: the deliberate execution surfaces above when driven by local
configuration you control (`--sink-cmd`, `PEEPSHOW_FFMPEG`, a non-loopback
`serve` bind), and vulnerabilities in `ffmpeg`, `yt-dlp`, or other third-party
binaries — report those upstream, though do tell us if peepshow's use of them
makes an upstream issue materially worse.
