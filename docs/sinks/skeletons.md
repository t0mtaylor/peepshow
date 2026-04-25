# Contributing a new sink

A sink is any executable that reads the peepshow JSON payload on stdin and forwards it to some downstream system. The **71 built-ins** under `src/builtin-sinks/` all follow the same shape — copy the closest one and adapt.

## Shape every sink follows

1. **`src/builtin-sinks/<name>.ts`** — strip-only TypeScript with `.ts` import extensions. Pure helpers (`readConfig`, `buildRequest`, `parseResponse`) plus a `main()` wired up via `runSinkEntry` from `_lib.ts`.
2. **`tests/builtin-sinks/<name>.test.ts`** — `node:test` + `node:assert/strict`. **≥ 10 unit tests**. DI everything (mock `fetch`, `spawn`, `fs`) — never call the real network or filesystem.
3. **`bin/peepshow-sink-<name>`** — five-line shell wrapper. Copy verbatim from `bin/peepshow-sink-linear` (or any sibling) and swap the slug.
4. **`docs/sinks/<name>.md`** — user doc with config table, exit codes, usage example, and a `<!-- gif:sink:<name> -->` marker block at the top so `embed-doc-gifs.mjs` can wire the GIF in.
5. **Registration in `package.json`** `bin` block.
6. **Registration in `scripts/build.mjs`** ENTRIES.
7. **Registration in `scripts/build-landing-pages.mjs`** under the right category — bumps the catalogue count test in `tests/scripts/build-landing-pages.test.ts` (+1).

## Pick the closest existing template

| Your target | Closest template | Why |
| :---------- | :--------------- | :-- |
| REST + auth header (issue tracker / observability / chat) | `linear.ts`, `pagerduty.ts`, `opsgenie.ts` | Header auth, JSON body, response parse. |
| GraphQL endpoint | `linear.ts`, `graphql.ts` | Linear uses GraphQL. |
| Object storage / file upload | `gcs.ts`, `firebase-storage.ts`, `s3.ts` | Bytes upload + manifest write. |
| Vector DB (per-frame embedding) | `chroma.ts`, `qdrant.ts`, `pgvector.ts` | Per-frame ID + metadata. |
| Local markdown append (notes / agent memory) | `obsidian.ts`, `aider.ts`, `cody.ts` | DI fs, append vs create modes. |
| macOS-only via osascript / x-callback-url | `apple-notes.ts`, `imessage.ts`, `things.ts`, `bear.ts` | Darwin gating + `*_ALLOW_NON_DARWIN` escape. |
| Workflow webhook with signing + retry | `pipedream.ts`, `zapier.ts` | HMAC + 429/5xx backoff. |
| Wide-event ingest | `honeycomb.ts`, `newrelic.ts`, `datadog.ts` | Flat key→value event body. |

## Quick start

```bash
# 1. Pick a template + copy
cp src/builtin-sinks/linear.ts src/builtin-sinks/myservice.ts
cp tests/builtin-sinks/linear.test.ts tests/builtin-sinks/myservice.test.ts
cp bin/peepshow-sink-linear bin/peepshow-sink-myservice

# 2. Rename references inside
sed -i '' 's/linear/myservice/g; s/Linear/Myservice/g' \
  src/builtin-sinks/myservice.ts \
  tests/builtin-sinks/myservice.test.ts \
  bin/peepshow-sink-myservice

# 3. Adapt the URL, auth, body shape, env vars

# 4. Register in package.json bin, scripts/build.mjs, scripts/build-landing-pages.mjs

# 5. Validate
export PATH=$HOME/.nvm/versions/node/v22.22.1/bin:$PATH
npm run typecheck
npm run lint
node --test --experimental-strip-types tests/builtin-sinks/myservice.test.ts
```

## Conventions

- **No new runtime deps**. Stick to native `fetch`, `node:fs/promises`, `node:child_process`, `node:crypto`. SDK-driven sinks (e.g. `@aws-sdk/client-s3`) live in `optionalDependencies`.
- **Strip-only TS**. No decorators, no parameter properties, no enums. `.ts` extensions in every import.
- **DI for I/O**. Every test mocks `fetch` / `spawn` / `fs` via a deps object. Never let a test reach the real network or disk.
- **`SinkError` for failures**. Map to one of the codes in `SINK_EXIT` (`usage` 2, `missingDep` 3, `runtime` 5).
- **Macros: `requireEnv` / `optionalEnv` / `runSinkEntry`**. Don't roll your own — they're in `_lib.ts`.

## Looking for the next gap?

`docs/SINKS-MISSING.md` lists what's still unbuilt and what's blocked on upstream API availability. Most remaining candidates either need a single-platform wrapper (Make / n8n / Activepieces / Node-RED — the generic webhook sink covers them today, but a branded sink could add platform-specific signing) or are pending an upstream API release (Roam, Tana, Whimsical).
