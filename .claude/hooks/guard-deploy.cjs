#!/usr/bin/env node
// PreToolUse(Bash): force versioned deploys. Blocks HEAD-only deploy and bare clasp push.
// Reads tool input from stdin (see _lib.cjs).

const { readInput, bashCommand, deny, passthrough } = require('./_lib.cjs');

const command = bashCommand(readInput());

// Block `npm run deploy` (HEAD-only) but allow `npm run deploy:version`.
if (/npm run deploy($|\s)/.test(command) && !command.includes('deploy:version')) {
  deny('PreToolUse', 'HEAD-only deploy blocked. Use `npm run deploy:version` instead (always versioned).');
}

// Block bare `clasp push` / `npm run push` (bypasses build + versioning).
if (/(^|\s)clasp push\b/.test(command) || /npm run push($|\s)/.test(command)) {
  deny('PreToolUse', 'Direct push blocked. Use `npm run deploy:version` to build, push, and version atomically.');
}

passthrough();
