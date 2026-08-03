import { defineConfig, devices } from '@playwright/test';

/**
 * Accessibility and functional-claims gate. Tests run against the production
 * build served by `vite preview`, so what passes here is what actually ships
 * to Pages.
 *
 * colorScheme is forced to 'dark' so the default scan is genuinely the dark
 * theme; clicking the toggle then deterministically reaches the light theme.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4223/crypto-lab-dead-sea-cipher/',
    colorScheme: 'dark',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Build before serving. `vite preview` hands out whatever is already in
    // dist/, so without this the suite can pass green against a stale bundle
    // while the source it claims to test no longer even compiles.
    command: 'npm run build && npm run preview -- --port 4223 --strictPort',
    port: 4223,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
