#!/usr/bin/env node
// PreToolUse(Bash): block destructive operations on source files and git history.
// Reads tool input from stdin (see _lib.cjs).

const { readInput, bashCommand, deny, passthrough } = require('./_lib.cjs');

const command = bashCommand(readInput());

// rm -rf (any flag order) targeting critical project paths.
if (/\brm\b[^\n]*-[a-z]*r[a-z]*f|\brm\b[^\n]*-[a-z]*f[a-z]*r/i.test(command) &&
    /(src|dist|\.claude|node_modules|CLAUDE|AGENTS|README|package\.json)/i.test(command)) {
  deny('PreToolUse', 'Destructive rm -rf on project files is blocked. Delete specific files with the Edit/Write tools or a narrowly-scoped command.');
}

// Force-push to master/main (covers --force, -f, and --force-with-lease).
if (/git\s+push[^\n]*(--force(-with-lease)?|\s-f\b)[^\n]*(master|main)/.test(command) ||
    /git\s+push[^\n]*(master|main)[^\n]*(--force(-with-lease)?|\s-f\b)/.test(command)) {
  deny('PreToolUse', 'Force push to master/main is blocked.');
}

// Hard reset (loses uncommitted work).
if (/git\s+reset\s+--hard/.test(command)) {
  deny('PreToolUse', 'git reset --hard is blocked. Use `git stash` or `git restore <path>` for targeted rollback.');
}

// Clean that nukes untracked files.
if (/git\s+clean\s+[^\n]*-[a-z]*f/i.test(command)) {
  deny('PreToolUse', 'git clean -f is blocked (deletes untracked files). Remove specific files explicitly instead.');
}

passthrough();
