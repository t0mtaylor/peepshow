# peepshow-sink-outline

Create a document in [Outline](https://www.getoutline.com) per peepshow
run. Title is `peepshow · <video title> · <date>`. Body is markdown with
a Metadata section + a numbered Frames list.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `OUTLINE_BASE_URL`      | ✓ | — | `https://your.outline/` or `https://app.getoutline.com`. |
| `OUTLINE_API_TOKEN`     | ✓ | — | Bearer API token. |
| `OUTLINE_COLLECTION_ID` | ✓ | — | Collection to create the doc under. |
| `OUTLINE_PARENT_DOC_ID` |   | — | Create as a child of this doc. |
| `OUTLINE_PUBLISH`       |   | — | `1` publishes immediately; default leaves it as a draft. |

## Exit codes

| 0 | Document created. |
| 2 | Missing required env. |
| 4 | stdin malformed. |
| 5 | Outline returned non-2xx. |
