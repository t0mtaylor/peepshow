# Skeleton sinks — partial implementations awaiting community input

Four sinks on the roadmap need input from their upstream projects before they can ship production-ready. This doc captures exactly what's in place, what's missing, and how to finish each one. PRs very welcome — most are ~100 lines of code.

Each skeleton already:

- Reads the peepshow JSON payload on stdin via `_lib.ts`.
- Validates env vars expected by its target system.
- Prints a dry-run summary of what it *would* do.
- Has unit tests covering payload parsing + env validation.

What they don't yet do: make the actual API calls. That's the piece we're asking contributors to add.

## peepshow-sink-cognee

**Target:** [cognee](https://github.com/topoteretes/cognee) — AI memory framework with knowledge-graph ingestion.

**Gap:** cognee's primary API is Python (`cognee.add`, `cognee.cognify`). A Node sink would need to either:
1. Shell out to the `cognee` CLI (requires `pip install cognee` and Python env)
2. Call cognee's REST API (project hasn't shipped a stable one yet — check their roadmap)

**Env:** `COGNEE_DATA_ROOT`, `COGNEE_USER_ID`.

**What a PR should add:** pick option 1 or 2 above, implement the upload call, and ingest frame paths + video tags as nodes in the cognee graph.

## peepshow-sink-mempalace

**Target:** MemPalace — spatial-memory AI framework (no single canonical repo; the term is used by several projects).

**Gap:** no public API surface yet; integration path depends which project the user means. A PR should first pin which implementation (upstream URL in README).

**What a PR should add:** a thin REST/CLI wrapper that attaches frames to a "spatial node" or equivalent.

## peepshow-sink-perplexity

**Target:** Perplexity Spaces / Pro API.

**Gap:** Perplexity's Space-upload API is currently invite-only. Sink ships as a scaffold that POSTs the right shape to a configurable URL so early-access users can wire it up.

**Env:** `PERPLEXITY_API_KEY`, `PERPLEXITY_SPACE_ID`, `PERPLEXITY_UPLOAD_URL` (override).

**What a PR should add:** swap the mock URL for the official endpoint once it's public, plus multipart upload support for frame files (not just JSON metadata).

## peepshow-sink-antigravity

**Target:** Antigravity — IDE-integrated artifact system.

**Gap:** no public API documented. Integration may happen via filesystem (drop to a watched dir) once Antigravity ships a protocol spec.

**What a PR should add:** if/when Antigravity documents an artifact-import format, map the peepshow payload onto it.

---

## Contributing a full sink

1. Copy an existing sink in `src/builtin-sinks/` (e.g. `graphql.ts` for API-call sinks or `obsidian.ts` for filesystem sinks) as a template.
2. Keep the transform logic pure so unit tests stay fast.
3. Add a bin wrapper in `bin/peepshow-sink-<name>` following the pattern.
4. Add tests under `tests/builtin-sinks/<name>.test.ts`.
5. Add a doc page under `docs/sinks/<name>.md`.
6. Register the bin in `package.json` `bin` map.
7. Open a PR.
