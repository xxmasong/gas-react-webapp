// Deterministic RPC contract checker — name-set parity across the four surfaces
// that must agree for the GAS RPC bridge to work:
//
//   1. src/shared/types.ts      ServerFunctions   (source of truth)
//   2. src/server/api.js        top-level named function declarations
//   3. src/client/lib/server.ts the exported `server` object (real bridge)
//   4. src/client/lib/serverMock.ts createMock() return object (mock bridge)
//
// `tsc` already verifies arg/return TYPES via contract.ts; this script verifies
// the SET OF NAMES, which tsc cannot (api.js is plain JS, and the bridge objects
// are structurally typed so a missing key only surfaces at call time). Wired into
// `npm run typecheck:all`, so a drifted contract fails the pre-deploy gate.
//
// Tool-agnostic: runs the same for Claude Code and Codex.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// Private helpers in api.js are prefixed with `_` and are not part of the contract.
const isPrivate = (name) => name.startsWith('_');

// Return the substring inside the `{...}` that opens at/after `fromIndex`,
// using brace-depth matching so nested object literals are spanned correctly.
function braceBlock(src, fromIndex) {
  const open = src.indexOf('{', fromIndex);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return null;
}

// Top-level (depth-1) `name:` or `name(` entries inside a block — skips nested
// object literals so type fields / mock sub-objects don't pollute the name set.
function topLevelNames(block, { calls = false } = {}) {
  const names = new Set();
  let depth = 0;
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (depth === 0 && !line.startsWith('//')) {
      const m = calls
        ? line.match(/^([a-zA-Z_]\w*)\s*[:(]/)   // method sig `name(` or key `name:`
        : line.match(/^([a-zA-Z_]\w*)\s*:/);     // object key `name:`
      if (m) names.add(m[1]);
    }
    for (const ch of rawLine) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  return names;
}

// ── 1. ServerFunctions in types.ts ───────────────────────────────────────────
function serverFunctionNames(src) {
  const at = src.search(/export\s+type\s+ServerFunctions\s*=/);
  const block = at === -1 ? null : braceBlock(src, at);
  if (!block) throw new Error('Could not locate `export type ServerFunctions` block in types.ts');
  return topLevelNames(block, { calls: true });
}

// ── 2. Top-level named functions in api.js ────────────────────────────────────
function apiFunctionNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/^function\s+([a-zA-Z_]\w*)\s*\(/gm)) {
    if (!isPrivate(m[1])) names.add(m[1]);
  }
  return names;
}

// ── 3. Keys of the exported `server` object in server.ts ──────────────────────
function serverBridgeNames(src) {
  const at = src.search(/export\s+const\s+server\s*=/);
  const block = at === -1 ? null : braceBlock(src, at);
  if (!block) throw new Error('Could not locate `export const server = {` block in server.ts');
  return topLevelNames(block);
}

// ── 4. Keys returned by createMock() in serverMock.ts ─────────────────────────
function mockNames(src) {
  const ci = src.indexOf('createMock');
  if (ci === -1) throw new Error('Could not locate `createMock` in serverMock.ts');
  const ri = src.indexOf('return', ci);
  const block = ri === -1 ? null : braceBlock(src, ri);
  if (!block) throw new Error('Could not locate `createMock` return object in serverMock.ts');
  return topLevelNames(block);
}

const surfaces = {
  'types.ts ServerFunctions': serverFunctionNames(read('src/shared/types.ts')),
  'api.js functions':         apiFunctionNames(read('src/server/api.js')),
  'server.ts bridge':         serverBridgeNames(read('src/client/lib/server.ts')),
  'serverMock createMock':    mockNames(read('src/client/lib/serverMock.ts')),
};

// Union of every name seen anywhere, then flag any surface missing it.
const all = new Set();
for (const set of Object.values(surfaces)) for (const n of set) all.add(n);

const problems = [];
for (const name of [...all].sort()) {
  const missingFrom = Object.entries(surfaces)
    .filter(([, set]) => !set.has(name))
    .map(([label]) => label);
  if (missingFrom.length) problems.push({ name, missingFrom });
}

if (problems.length === 0) {
  console.log(`✓ contract in sync — ${all.size} RPC functions present on all 4 surfaces`);
  process.exit(0);
}

console.error('✗ RPC contract drift detected:\n');
for (const { name, missingFrom } of problems) {
  console.error(`  ${name}  — missing from: ${missingFrom.join(', ')}`);
}
console.error(
  '\nEvery ServerFunctions entry needs: a top-level function in api.js, a key in the\n' +
  '`server` object (server.ts), and a key in createMock() (serverMock.ts).'
);
process.exit(1);
