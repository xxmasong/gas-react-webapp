#!/usr/bin/env node
// After editing contract files, reminds Claude to check contract sync.
// Fires on PostToolUse for Edit/Write tool.

const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const file = input.file_path || input.path || '';

const remind = (msg) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: msg,
    },
  }));
  process.exit(0);
};

if (/src[/\\]server[/\\]api\.js$/.test(file)) {
  remind('CONTRACT CHECK: api.js was just edited. Verify that src/client/lib/server.ts has a matching real call in buildServer() AND a mock in createMock() for every function. Run npm run typecheck:all when done.');
}

if (/src[/\\]shared[/\\]types\.ts$/.test(file)) {
  remind('CONTRACT CHECK: types.ts was just edited. Verify that (1) every ServerFunctions entry exists as a top-level named function in api.js, (2) every entry has a real call and mock in server.ts. Run npm run typecheck:all when done.');
}

if (/src[/\\]client[/\\]lib[/\\]server\.ts$/.test(file)) {
  remind('CONTRACT CHECK: server.ts was just edited. Verify real calls in buildServer() and mocks in createMock() match api.js and types.ts. Mock output shapes must include all computed fields (qtyTotal, kyteMatch, costTotal, updatedAt). Run npm run typecheck:all when done.');
}

if (/src[/\\]client[/\\]lib[/\\]serverMock\.ts$/.test(file)) {
  remind('CONTRACT CHECK: serverMock.ts was just edited. Verify mock output shapes match real service outputs including all computed fields (qtyTotal, kyteMatch, costTotal, updatedAt).');
}

process.exit(0);
