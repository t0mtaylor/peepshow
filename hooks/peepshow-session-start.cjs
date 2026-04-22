#!/usr/bin/env node
// peepshow — Claude Code SessionStart hook.
//
// Detects whether the user has wired the [PEEPSHOW] statusline badge into
// their Claude settings. If not, emits a one-line nudge as additional context
// so Claude can proactively offer to wire it up via the update-config skill.
//
// Silent success: emits nothing if already configured. Silent failure: any
// error is swallowed — a misconfigured hook must never block session start.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const settingsPath = path.join(claudeDir, 'settings.json');
const statuslineScript = path.join(__dirname, 'peepshow-statusline.sh');

try {
  let wired = false;
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(raw);
    const cmd = (settings && settings.statusLine && settings.statusLine.command) || '';
    if (typeof cmd === 'string' && cmd.indexOf('peepshow-statusline.sh') !== -1) {
      wired = true;
    }
  }

  if (!wired) {
    const invocation = 'bash "' + statuslineScript + '"';
    const snippet = JSON.stringify(invocation);
    const nudge =
      'PEEPSHOW STATUSLINE NOT WIRED: peepshow ships a [PEEPSHOW] badge (pink) for the Claude Code statusline. ' +
      'To enable, either: (a) if settings.json already has a statusLine.command, APPEND "; ' + invocation + '" ' +
      'to preserve existing badges like caveman; (b) if no statusLine exists, set ' +
      '"statusLine": { "type": "command", "command": ' + snippet + ' } in ' + settingsPath + '. ' +
      'Proactively offer to wire this up for the user on first interaction using the update-config skill.';
    process.stdout.write(nudge);
  }
} catch (e) {
  // Silent fail — do not block session start.
}
