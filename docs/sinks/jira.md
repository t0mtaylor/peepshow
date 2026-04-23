# peepshow-sink-jira

Create a Jira issue (or attach to an existing one) with:
- a heading + bullet list (strategy, frames, codec, duration, resolution, director, studio) in the issue description as ADF,
- one multipart attachment per extracted frame.

Works with Jira Cloud + Data Center / Server via basic auth (email + API
token) or a Personal Access Token.

## Invocation

```bash
peepshow ./bug-repro.mov --sink jira
```

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `JIRA_BASE_URL`      | ✓ | — | `https://<you>.atlassian.net` (Cloud) or DC/Server URL. |
| `JIRA_USER`          | ○ | — | Email for basic auth. Required with `JIRA_API_TOKEN`. |
| `JIRA_API_TOKEN`     | ○ | — | API token for basic auth. |
| `JIRA_BEARER_TOKEN`  | ○ | — | PAT — use this **or** `JIRA_USER + JIRA_API_TOKEN`. |
| `JIRA_PROJECT_KEY`   | ◐ | — | Project key to create a new issue in (required unless `JIRA_ISSUE_KEY` is set). |
| `JIRA_ISSUE_KEY`     | ◐ | — | Attach to this existing key; skip the create step. |
| `JIRA_ISSUE_TYPE`    |   | `Task` | Issue type on create. |

## Exit codes

| 0 | Issue created / attachments uploaded. |
| 2 | Missing env / auth combo. |
| 4 | stdin malformed. |
| 5 | Jira returned non-2xx on create or attachment. |
