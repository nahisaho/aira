import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  webServer: {
    command: 'node backend/dist/server.js',
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: true,
    env: {
      NODE_ENV: 'test',
      AIRA_SERVE_FRONTEND: 'true',
    },
  },
});
