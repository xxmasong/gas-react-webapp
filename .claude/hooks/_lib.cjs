// Shared hook helpers. Claude Code delivers tool input on STDIN as JSON:
//   { tool_name, tool_input: { command }, cwd, hook_event_name, ... }
// (NOT via env vars — $TOOL_INPUT_JSON is never interpolated into hook env.)
//
// Files use the .cjs extension on purpose: package.json has "type": "module",
// so plain .js would be parsed as ESM and `require` would throw at runtime.

const fs = require('fs');

// Read + parse the PreToolUse/PostToolUse payload from stdin. Returns {} on any failure
// so a malformed payload degrades to passthrough rather than crashing the tool call.
function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

// Bash command string for the current tool call ('' if not a Bash call).
function bashCommand(input) {
  return ((input.tool_input || {}).command || '').toString();
}

// File path for the current Edit/Write tool call ('' if none).
function editedFile(input) {
  const ti = input.tool_input || {};
  return (ti.file_path || ti.path || '').toString();
}

// Block the tool call. Print deny JSON, exit 0 (deny is a valid result, not an error).
function deny(event, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// Inject a reminder back to Claude without blocking (PostToolUse).
function remind(event, message) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: message },
  }));
  process.exit(0);
}

// Let the tool call proceed via the normal permission flow (no auto-approve).
function passthrough() {
  process.exit(0);
}

module.exports = { readInput, bashCommand, editedFile, deny, remind, passthrough };
