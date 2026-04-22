# peepshow-sink-graphql

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
