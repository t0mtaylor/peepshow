# Contributing to peepshow

Thanks for wanting to help. Two paths:

## Add a sink

Sinks receive the peepshow `--emit json` payload on stdin. Any language works — write a standalone executable and it fits the contract. Existing sinks live in [`docs/sinks/`](./docs/sinks/) (documentation); the runtime ships as part of the npm package.

**Suggested targets** (from [`docs/SINKS-MISSING.md`](./docs/SINKS-MISSING.md)):

- Memory backends — cognee, MemPalace, Mem0, Zep, Letta
- AI workspaces — Continue, Cody, Aider, Claude.ai Projects
- Trackers — Jira, GitHub Issues (via gh), Height, Shortcut
- Boards — Miro, FigJam
- Storage — Dropbox, Google Drive, Box, Supabase Storage
- Observability — Datadog, PagerDuty, Grafana
- Event tracking — PostHog, Plausible, Mixpanel
- Notes — Logseq, Tana, Outline, Confluence

## Open an issue

Report bugs, suggest sinks or agent integrations, or propose changes at:
<https://github.com/t0mtaylor/peepshow/issues>

## Security

If you find a security problem in peepshow or one of its sinks, email the maintainer listed in `package.json` rather than opening a public issue.
