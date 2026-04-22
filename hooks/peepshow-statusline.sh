#!/bin/bash
# peepshow — statusline badge script for Claude Code.
# Prints a colored [PEEPSHOW] badge when the plugin is active. No newline, so
# it can be concatenated with other plugin statuslines (e.g. caveman).
#
# Suffix composition: [PEEPSHOW[|Ns][:<run-status>]]
#   Ns        → count of persistent auto-sinks configured in sinks.json
#   run-status → read from $PEEPSHOW_STATUS_FILE (defaults to
#                ~/.claude/.peepshow-last). Set by the CLI: "decoding:42%",
#                "5frm:scene:system", etc.
#
# Usage in settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/peepshow-statusline.sh" }

STATUS_FILE="${PEEPSHOW_STATUS_FILE:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.peepshow-last}"
SINKS_FILE="${PEEPSHOW_AUTO_SINKS_FILE:-$HOME/.peepshow/sinks.json}"

# Refuse symlinks — prevents rendering arbitrary file bytes.
if [ -L "$STATUS_FILE" ]; then
  STATUS_FILE=""
fi
if [ -L "$SINKS_FILE" ]; then
  SINKS_FILE=""
fi

RUN_SUFFIX=""
if [ -n "$STATUS_FILE" ] && [ -f "$STATUS_FILE" ]; then
  RAW=$(head -c 64 "$STATUS_FILE" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
  CLEAN=$(printf '%s' "$RAW" | tr -cd 'a-z0-9:.-')
  if [ -n "$CLEAN" ]; then
    RUN_SUFFIX=":$CLEAN"
  fi
fi

SINK_SUFFIX=""
if [ -n "$SINKS_FILE" ] && [ -f "$SINKS_FILE" ] && command -v jq >/dev/null 2>&1; then
  COUNT=$(jq -r '(.sinks // []) | length' "$SINKS_FILE" 2>/dev/null || echo "")
  if [ -n "$COUNT" ] && [ "$COUNT" -gt 0 ] 2>/dev/null; then
    SINK_SUFFIX="|${COUNT}s"
  fi
fi

# Color 141 = soft pink/purple. Distinct from caveman's 172 (orange).
printf ' \033[38;5;141m[PEEPSHOW%s%s]\033[0m' "$SINK_SUFFIX" "$RUN_SUFFIX"
