import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  base: '/crypto-lab-dead-sea-cipher/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
} as any);
