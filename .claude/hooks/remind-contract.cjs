#!/usr/bin/env node
// PostToolUse(Edit|Write): when a file in the 3-file RPC contract changes, remind
// Claude to keep the other two in sync. A reminder (not a gate) — the deterministic
// gate runs at deploy time in gate-deploy-typecheck.cjs.
// Reads tool input from stdin (see _lib.cjs).

const { readInput, editedFile, remind, passthrough } = require('./_lib.cjs');

const file = editedFile(readInput()).replace(/\\/g, '/');

const SYNC = 'Run `/verify-contract` or `npm run typecheck:all` (includes verify:contract) once the set is consistent.';

if (/src\/shared\/types\.ts$/.test(file)) {
  remind('PostToolUse',
    'CONTRACT: types.ts changed. Every ServerFunctions entry needs (1) a top-level named function in src/server/api.js, ' +
    '(2) an entry in the `server` object in src/client/lib/server.ts, and (3) an entry in createMock() in ' +
    'src/client/lib/serverMock.ts. ' + SYNC);
}

if (/src\/server\/api\.js$/.test(file)) {
  remind('PostToolUse',
    'CONTRACT: api.js changed. Mirror it client-side, same commit — an entry in the `server` object (src/client/lib/server.ts) ' +
    'AND an entry in createMock() (src/client/lib/serverMock.ts) for every function. ' + SYNC);
}

if (/src\/client\/lib\/(server|serverMock)\.ts$/.test(file)) {
  remind('PostToolUse',
    'CONTRACT: client bridge changed. The createMock() entry in serverMock.ts takes token as its first arg and must match ' +
    'real service output, including computed fields (qtyTotal, kyteMatch, costTotal) and updatedAt. ' + SYNC);
}

passthrough();
