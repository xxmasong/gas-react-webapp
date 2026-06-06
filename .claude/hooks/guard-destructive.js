#!/usr/bin/env node
// Blocks destructive operations on source files and git history.
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

// Block rm -rf on critical project directories/files
if (/rm\s+-rf.*(src|dist|\.claude|node_modules|CLAUDE|AGENTS|README)/i.test(command)) {
  deny('Destructive rm -rf on project files is blocked.');
}

// Block force-pushing to master/main
if (/git push.*(--force|-f).*(master|main)/.test(command)) {
  deny('Force push to master/main is blocked.');
}

// Block hard resets
if (/git reset\s+--hard/.test(command)) {
  deny('git reset --hard is blocked. Use git stash or git restore for targeted rollback.');
}

process.exit(0);
