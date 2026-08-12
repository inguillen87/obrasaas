import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3100';
const target = new URL(baseURL);
const localTarget = ['127.0.0.1', 'localhost'].includes(target.hostname);
const browserUse = {
  ...devices['Desktop Chrome'],
  ...(process.env.PLAYWRIGHT_CHANNEL
    ? { channel: process.env.PLAYWRIGHT_CHANNEL }
    : {}),
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    locale: 'es-AR',
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: localTarget
    ? {
        command: 'npm run dev -- --hostname localhost --port 3100',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: 'public',
      testMatch: /landing\.spec\.js/,
      use: browserUse,
    },
    {
      name: 'setup',
      testMatch: /global\.setup\.js/,
    },
    {
      name: 'authenticated',
      dependencies: ['setup'],
      testMatch: /auth\.spec\.js/,
      use: browserUse,
    },
    {
      name: 'authenticated-s92',
      dependencies: ['setup'],
      retries: 0,
      workers: 1,
      testMatch: /s92-authenticated\.spec\.js/,
      use: {
        ...browserUse,
        screenshot: 'off',
        trace: 'off',
        video: 'off',
      },
    },
    {
      name: 'authenticated-s93',
      dependencies: ['setup'],
      retries: 0,
      workers: 1,
      testMatch: /s93-authenticated\.spec\.js/,
      use: {
        ...browserUse,
        screenshot: 'off',
        trace: 'off',
        video: 'off',
      },
    },
  ],
});
