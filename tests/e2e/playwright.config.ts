import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Acceptance matrix T1–T16 against Chromium, Firefox, WebKit.
 * Single worker — shared SQLite must not race across engines.
 *
 * Always start fresh webServers (reuseExistingServer: false) so DATABASE_URL
 * points at the e2e sqlite file rather than a leftover `pnpm dev` instance.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    actionTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @licensecore/server dev',
      cwd: root,
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        IP_PEPPER: 'test-ip-pepper-32bytes-minimum!!',
        JWT_SECRET: 'test-jwt-secret-32bytes-minimum!!!',
        ADMIN_API_KEY: 'test-admin-api-key',
        DATABASE_DIALECT: 'sqlite',
        // Relative to server package cwd resolution — use absolute via file:
        DATABASE_URL: `file:${path.resolve(root, 'data/e2e-device-identity.sqlite').replace(/\\/g, '/')}`,
        PORT: '8787',
        E2E_RELAX_RATE_LIMIT: '1',
      },
    },
    {
      command: 'pnpm --filter @licensecore/playground dev',
      cwd: root,
      url: 'http://127.0.0.1:5173/e2e.html',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
