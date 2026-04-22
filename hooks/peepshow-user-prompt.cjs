#!/usr/bin/env node
// peepshow — Claude Code UserPromptSubmit hook.
//
// Claude Code auto-attaches dropped images but inserts a plain path for
// videos/animated images. This hook inspects each submitted prompt for
// video/animated-image file references and injects a system-reminder
// telling Claude to run /peepshow:slides on them, so dropping a .mp4 /
// .gif / .mov into the prompt triggers extraction the same way a dropped
// image triggers inline view.
//
// Silent success: emits nothing when no video-like path is present.
// Silent failure: any unexpected error is swallowed — a noisy hook would
// block every prompt submission.

'use strict';

const fs = require('fs');

// Extensions we know ffmpeg can demux as a timed sequence of frames.
// Static image formats are excluded — Claude handles them natively.
const VIDEO_EXTS = new Set([
  'mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'flv', 'wmv',
  'ts', 'mts', 'm2ts', '3gp', '3g2', 'ogv', 'mpg', 'mpeg',
]);
const ANIMATED_IMAGE_EXTS = new Set(['gif', 'apng']);
const ALL_EXTS = new Set([...VIDEO_EXTS, ...ANIMATED_IMAGE_EXTS]);

// Match unquoted filesystem paths that look like:
//   /abs/path/clip.mp4
//   ./relative/clip.mov
//   ~/Desktop/loop.gif
//   C:\path\to\clip.mp4   (Windows)
// Stops at whitespace or common boundary punctuation so trailing ,)"' don't
// sneak into the captured path.
const PATH_RE = /(?:~|\.{1,2}|[A-Za-z]:[\\/]|\/)[^\s"'<>|]*\.[A-Za-z0-9]+/g;

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function extensionOf(p) {
  const dot = p.lastIndexOf('.');
  if (dot < 0) return '';
  return p.slice(dot + 1).toLowerCase().replace(/[^a-z0-9].*$/, '');
}

function findMediaPaths(prompt) {
  const found = [];
  const seen = new Set();
  let match;
  while ((match = PATH_RE.exec(prompt)) !== null) {
    const raw = match[0];
    const ext = extensionOf(raw);
    if (!ALL_EXTS.has(ext)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    found.push(raw);
  }
  return found;
}

try {
  const raw = readStdinSync();
  if (!raw) process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Claude Code's UserPromptSubmit payload exposes the submitted text. Field
  // names have shifted across versions — accept the few plausible keys.
  const prompt =
    (payload && (payload.prompt || payload.user_prompt || payload.userPrompt || payload.input)) || '';
  if (typeof prompt !== 'string' || prompt.length === 0) process.exit(0);

  // Only fire when the prompt is *just* a path (user dropped a file), or when
  // the prompt is short and contains a single video-like path. Avoids
  // derailing longer prompts that happen to mention a filename.
  const trimmed = prompt.trim();
  const paths = findMediaPaths(trimmed);
  if (paths.length === 0) process.exit(0);

  const promptIsOnlyPath = paths.length === 1 && trimmed === paths[0];
  const promptIsShortAndPathy = paths.length === 1 && trimmed.length <= paths[0].length + 80;

  if (!promptIsOnlyPath && !promptIsShortAndPathy) process.exit(0);

  const target = paths[0];

  const response = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        'PEEPSHOW AUTO-INVOKE: The user dropped a video or animated-image path into the prompt ("' +
        target +
        '"). Claude Code does not attach video bytes like it does images. Invoke `/peepshow:slides ' +
        target +
        '` (or run `peepshow "' +
        target +
        '" --emit json` via Bash and Read each frame) so you can see the frames. After extracting, ' +
        'answer whatever question the user asked — if the prompt is only the path, describe what you see across the timeline.',
    },
  };

  process.stdout.write(JSON.stringify(response));
} catch {
  // Silent fail — never block a prompt over this.
  process.exit(0);
}
