/// <reference types="vitest" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The shipped build must be ONE self-contained index.html under 16 MB (see CLAUDE.md).
// vite-plugin-singlefile inlines all JS/CSS/assets into dist/index.html.
export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  resolve: {
    alias: { '@': '/src', '@data': '/data' },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 16_000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
