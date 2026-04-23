# peepshow-sink-telegram

Post a peepshow run to a Telegram chat: one `sendMessage` with the
metadata summary, then one or more `sendMediaGroup` album posts with the
frames attached (max 10 photos per album — larger runs chunk
automatically).

## Configuration

| Env | Required | Default | Purpose |
|-----|----------|---------|---------|
| `TELEGRAM_BOT_TOKEN` | ✓ | — | Bot token from `@BotFather`. |
| `TELEGRAM_CHAT_ID`   | ✓ | — | `-100…` group id, `@username`, or numeric user id. |
| `TELEGRAM_API_URL`   |   | `https://api.telegram.org` | Override for local Bot API servers. |
| `TELEGRAM_PARSE_MODE`|   | `MarkdownV2` | `MarkdownV2` \| `HTML`. |

## Exit codes

| 0 | Summary + album(s) accepted. |
| 2 | Missing bot token or chat id. |
| 4 | stdin malformed. |
| 5 | Telegram returned non-2xx (sendMessage or sendMediaGroup). |
