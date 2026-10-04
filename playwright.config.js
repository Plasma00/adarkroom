import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: 'only-on-failure'
  },
  webServer: { command: 'npm start', url: 'http://127.0.0.1:8080', reuseExistingServer: !process.env.CI }
});
