// One-time project bootstrap.
//
// Creates a new Google Sheets-bound Apps Script project so the active
// spreadsheet becomes the backend database. clasp writes the scriptId into a
// .clasp.json inside dist/; we hoist it to the repo root and fix rootDir.
//
// Prereq: `npm run login` (clasp login) must have been run first.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (existsSync(join(root, '.clasp.json'))) {
  console.error('✗ .clasp.json already exists — project is already set up.');
  console.error('  Delete it first if you want to create a brand-new project.');
  process.exit(1);
}

mkdirSync(dist, { recursive: true });

console.log('▶ Creating a new Sheets-bound Apps Script project…');
execSync(
  'npx clasp create --type sheets --title "GAS React Web App" --rootDir dist',
  { stdio: 'inherit', cwd: root, shell: true }
);

// clasp drops .clasp.json into rootDir (dist). Move it to the repo root and
// normalise rootDir back to "dist".
const inDist = join(dist, '.clasp.json');
const atRoot = join(root, '.clasp.json');
if (existsSync(inDist)) {
  renameSync(inDist, atRoot);
}
if (existsSync(atRoot)) {
  const cfg = JSON.parse(readFileSync(atRoot, 'utf8'));
  cfg.rootDir = 'dist';
  writeFileSync(atRoot, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`\n✓ Project created. scriptId: ${cfg.scriptId}`);
}

// Clean any stray files clasp may have created in dist.
for (const f of ['appsscript.json']) {
  const p = join(dist, f);
  if (existsSync(p)) rmSync(p);
}

console.log('\nNext steps:');
console.log('  1. npm run deploy:version   # build, push, and create the web-app deployment');
console.log('  2. npm run open             # open the editor; Deploy ▸ New deployment ▸ Web app');
console.log('     (set "Who has access" + copy the /exec URL)');
