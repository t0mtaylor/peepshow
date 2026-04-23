# peepshow-sink-msteams

POST a peepshow run as an Adaptive Card to a Microsoft Teams Incoming
Webhook. Card renders title + subtle summary + FactSet (Strategy /
Frames / Codec / Duration / Resolution / Director / Studio). If
`MSTEAMS_IMAGE_BASE` is set, the first N frames (up to `MSTEAMS_MAX_IMAGES`)
are embedded as images; otherwise a TextBlock lists the frame paths.

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `MSTEAMS_WEBHOOK_URL` | ✓ | — | Incoming-webhook URL (classic or Workflows). |
| `MSTEAMS_IMAGE_BASE`  |   | — | URL prefix — Teams fetches images from `<base>/<frame-basename>`. Leave unset if frames aren't served publicly. |
| `MSTEAMS_MAX_IMAGES`  |   | `8` | Max image blocks in the card. |

## Exit codes

| 0 | Card posted. |
| 2 | Missing `MSTEAMS_WEBHOOK_URL`. |
| 4 | stdin malformed. |
| 5 | Teams returned non-2xx. |
