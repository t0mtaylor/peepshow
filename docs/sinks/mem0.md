# peepshow-sink-mem0

Write a peepshow run to [Mem0](https://mem0.ai) long-term memory. Each run
is stored as one system message (video summary) plus one user message per
extracted frame. Mem0 distils those into retrievable memories scoped to a
user (+ optional agent / app).

## Install

Ships built-in — the bin lands on PATH after `npm i -g peepshow`.

## Invocation

```bash
peepshow ./bug-repro.mov --sink mem0
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MEM0_API_KEY` | ✓ | — | Mem0 cloud / self-hosted API key. |
| `MEM0_USER_ID` | ✓ | — | User the memory is written for. |
| `MEM0_API_URL` |   | `https://api.mem0.ai` | Override for self-hosted. |
| `MEM0_AGENT_ID`|   | (none) | Scope the memory to a specific agent. |
| `MEM0_APP_ID`  |   | (none) | Scope the memory to a specific app. |

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Memory accepted. |
| 2 | Missing `MEM0_API_KEY` / `MEM0_USER_ID`. |
| 4 | stdin malformed / empty. |
| 5 | Mem0 returned non-2xx. |
