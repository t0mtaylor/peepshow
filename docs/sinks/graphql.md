# peepshow-sink-graphql

<!-- gif:sink:graphql -->
<p align="center">
  <img src="https://raw.githubusercontent.com/t0mtaylor/peepshow/main/docs/sink-gifs/graphql.gif" alt="peepshow → graphql demo" width="720">
</p>
<!-- /gif:sink:graphql -->


POSTs a GraphQL mutation with the peepshow payload to any GraphQL endpoint. Default mutation targets a schema with `recordPeepshowRun(input: PeepshowRunInput!)` — override for your own schema.

## Config

| Env var | Required | Default | Purpose |
| :------ | :------- | :------ | :------ |
| `PEEPSHOW_GRAPHQL_URL` | yes | — | endpoint URL |
| `PEEPSHOW_GRAPHQL_AUTH` | no | — | full `Authorization` header, verbatim |
| `PEEPSHOW_GRAPHQL_MUTATION` | no | built-in | mutation string; variable is `$input: <YourInput>!` |
| `PEEPSHOW_GRAPHQL_OP_NAME` | no | — | `operationName` if your API distinguishes operations |

## Use

Default mutation (your schema must have `recordPeepshowRun`):

```bash
export PEEPSHOW_GRAPHQL_URL="https://api.example/graphql"
export PEEPSHOW_GRAPHQL_AUTH="Bearer sk-live-xxx"
peepshow sinks add graphql
```

Custom mutation:

```bash
export PEEPSHOW_GRAPHQL_MUTATION='mutation Save($input: VideoRunIn!) { videoRuns { insert(object: $input) { id } } }'
export PEEPSHOW_GRAPHQL_OP_NAME=Save
```

## Request shape

```json
POST <url>
Content-Type: application/json
Authorization: <your header>

{
  "query": "<your mutation>",
  "variables": { "input": { "outputDir": "...", "strategy": "scene", "frames": [...], "video": {...}, "extraction": {...} } },
  "operationName": "<optional>"
}
```

## Hasura / PostgREST compatibility

Hasura, Supabase, PostGraphile, and similar tools autogenerate CRUD mutations. Example Hasura-style:

```graphql
mutation Save($input: peepshow_runs_insert_input!) {
  insert_peepshow_runs_one(object: $input) {
    id
  }
}
```

## Caveats

- GraphQL errors are reported and the sink exits non-zero even when HTTP 200 (most servers return 200 for logical errors).
- No batching; one POST per peepshow run.

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
export PEEPSHOW_GRAPHQL_URL="https://example.com"
```

### 2. Register as an auto-sink

Auto-sinks fire on every `peepshow` run without per-invocation flags,
so the LLM doesn't have to remember a pipeline — the routing is
declarative:

```sh
peepshow sinks add graphql
# Optional: only fire for matching inputs
peepshow sinks add graphql --when extension=mp4,mov
peepshow sinks add graphql --when director=Kubrick
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
> then forwards the run to the `GraphQL` sink.
>
> **`GraphQL`**: fires a parameterised GraphQL mutation with the peepshow payload as variables.
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

> **Transcript handling**: the transcript rides along inside the JSON payload your downstream consumer receives.
