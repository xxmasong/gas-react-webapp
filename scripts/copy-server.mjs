// Assembles the dist/ payload that clasp pushes to Google Apps Script.
//
// Vite builds the React app into dist/index.html (everything inlined). clasp
// then needs the server .js files and appsscript.json sitting in dist/ (flat
// or nested — GAS V8 loads all .js files recursively). This script copies the
// src/server/ tree (excluding .ts files) into dist/server/, preserving the
// lib/, services/, repositories/, mappers/ subdirectory structure so GAS loads
// them in alphabetical path order (lib → mappers → repositories → services →
// root api.js/webapp.js).

import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root   = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist   = join(root, 'dist');
const server = join(root, 'src', 'server');

mkdirSync(dist, { recursive: true });

let count = 0;

function copyJsFiles(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath  = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const stat     = statSync(srcPath);
    if (stat.isDirectory()) {
      copyJsFiles(srcPath, destPath);
    } else if (entry.endsWith('.js')) {
      cpSync(srcPath, destPath);
      console.log(`  + ${relative(root, destPath)}`);
      count++;
    }
    // .ts files (contract.ts) are intentionally skipped
  }
}

// Copy server .js files preserving subdirectory structure.
// Root-level files go flat into dist/; subdirs mirror the src/server/ layout.
for (const entry of readdirSync(server)) {
  const srcPath  = join(server, entry);
  const stat     = statSync(srcPath);
  if (stat.isDirectory()) {
    // lib/, services/, repositories/, mappers/ → dist/<subdir>/
    copyJsFiles(srcPath, join(dist, entry));
  } else if (entry.endsWith('.js')) {
    cpSync(srcPath, join(dist, entry));
    console.log(`  + ${entry}`);
    count++;
  }
}

// The manifest must live at the rootDir.
cpSync(join(root, 'appsscript.json'), join(dist, 'appsscript.json'));
console.log('  + appsscript.json');

if (!existsSync(join(dist, 'index.html'))) {
  console.warn('\n⚠  dist/index.html not found — run the Vite build first.');
  process.exit(1);
}

console.log(`\n✓ dist/ assembled with ${count} server file(s).`);
