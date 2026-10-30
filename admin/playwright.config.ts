import { defineConfig } from '@playwright/test';

// Smoke test against the running local stack (docker compose up): admin on 5173, API on 4000.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // PW_CHANNEL=chrome runs in the installed Google Chrome, which can differ from the bundled Chromium.
  use: { baseURL: process.env.ADMIN_URL ?? 'http://localhost:5173', viewport: { width: 1440, height: 900 }, channel: process.env.PW_CHANNEL },
  reporter: 'list',
});
