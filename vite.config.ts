import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Google Apps Script HtmlService can only serve self-contained HTML files.
// `viteSingleFile` inlines all JS/CSS into a single index.html so the entire
// React app ships as one file that GAS can return from doGet().
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  // Output goes to ./dist, which is the clasp rootDir (see .clasp.json).
  // The server-side .gs and appsscript.json are copied in alongside it.
  build: {
    outDir: 'dist',
    emptyOutDir: false, // server files are copied into dist separately
    target: 'es2019',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
