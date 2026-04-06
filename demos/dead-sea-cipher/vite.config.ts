import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative asset paths so the production bundle works on GitHub Pages
  // regardless of the repository name or deployment subdirectory.
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  test: {
    globals: true,
    environment: 'node',
  },
} as any);
