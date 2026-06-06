#!/usr/bin/env node
// Blocks HEAD-only deploys. Forces deploy:version.
// Fires on PreToolUse for Bash tool.

const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const command = input.command || '';

const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
};

// Block `npm run deploy` but allow `npm run deploy:version`
if (/npm run deploy($|\s)/.test(command) && !command.includes('deploy:version')) {
  deny('HEAD-only deploy blocked. Use npm run deploy:version instead.');
}

// Block bare `clasp push` (bypasses versioning)
if (/^clasp push/.test(command.trim())) {
  deny('Direct clasp push blocked. Use npm run deploy:version to build, push, and version atomically.');
}

process.exit(0);
