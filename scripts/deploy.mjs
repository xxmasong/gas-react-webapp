// One-command deploy: build the React app, assemble dist/, push to GAS, and
// (optionally) cut a new versioned web-app deployment.
//
//   npm run deploy            -> build + push (updates the HEAD/dev deployment)
//   npm run deploy:version    -> build + push + `clasp deploy` (new version)
//
// For a stable public URL, create one versioned deployment once and thereafter
// `npm run deploy` keeps it current via the @HEAD code. Use deploy:version
// when you explicitly want an immutable snapshot.

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const newVersion = process.argv.includes('--new-version');

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, shell: true });
}

if (!existsSync(join(root, '.clasp.json'))) {
  console.error(
    '\n✗ .clasp.json not found.\n' +
      '  Run `npm run login` then `npm run setup` first (creates the GAS project).'
  );
  process.exit(1);
}

console.log('▶ Building React client (tsc + vite)…');
run('npm run build');

console.log('\n▶ Assembling server files into dist/…');
run('npm run copy:server');

console.log('\n▶ Pushing to Google Apps Script…');
run('npx clasp push -f');

if (newVersion) {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  console.log('\n▶ Creating new versioned deployment…');
  run(`npx clasp deploy --description "deploy ${stamp}"`);
}

console.log('\n✓ Deploy complete.');
console.log('  Open the script:   npm run open');
console.log('  Web app URL:       clasp open-script, then Deploy ▸ Manage deployments');
