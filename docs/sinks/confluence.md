# peepshow-sink-confluence

Create a Confluence Cloud page per peepshow run. Body is storage-format
XHTML with a Metadata list + a numbered Frames list. Uses basic auth
(email + API token) + `/wiki/api/v2/pages`.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `CONFLUENCE_BASE_URL`       | ✓ | — | `https://<you>.atlassian.net`. |
| `CONFLUENCE_USER`           | ✓ | — | Email for basic auth. |
| `CONFLUENCE_API_TOKEN`      | ✓ | — | API token. |
| `CONFLUENCE_SPACE_ID`       | ◐ | — | Numeric space id (preferred by v2). |
| `CONFLUENCE_SPACE_KEY`      | ◐ | — | Alphanumeric space key — fallback if no id. |
| `CONFLUENCE_PARENT_PAGE_ID` |   | — | Nest under an existing page. |

Either `CONFLUENCE_SPACE_ID` or `CONFLUENCE_SPACE_KEY` is required.

## Exit codes

| 0 | Page created. |
| 2 | Missing env / space identifier. |
| 4 | stdin malformed. |
| 5 | Confluence returned non-2xx. |
