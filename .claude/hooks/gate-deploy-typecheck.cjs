#!/usr/bin/env node
// PreToolUse(Bash): hard gate before a real deploy. If the command is a deploy,
// run `npm run typecheck:all` and BLOCK the deploy when it fails. Deterministic
// enforcement of the pre-deploy contract check — prose can be ignored, this cannot.
// Reads tool input from stdin (see _lib.cjs).

const { execSync } = require('child_process');
const { readInput, bashCommand, deny, passthrough } = require('./_lib.cjs');

const command = bashCommand(readInput());

// Only gate actual deploys (deploy:version). Everything else passes through untouched.
const isDeploy = /npm run deploy:version\b/.test(command) || /node\s+scripts[/\\]deploy\.mjs\b/.test(command);
if (!isDeploy) passthrough();

try {
  execSync('npm run typecheck:all', { stdio: 'pipe', timeout: 120000 });
  passthrough(); // typecheck clean → allow the deploy
} catch (err) {
  const out = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
  const tail = out.trim().split('\n').slice(-12).join('\n');
  deny('PreToolUse',
    'Deploy blocked: `npm run typecheck:all` failed. Fix all type/contract errors before deploying.\n\n' + tail);
}
