const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.FHL_STAGING_BASE_URL;
if (!baseURL) {
  throw new Error('FHL_STAGING_BASE_URL is required for live staging tests.');
}

module.exports = defineConfig({
  testDir: './browser-tests',
  testMatch: 'staging.spec.cjs',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-staging-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'staging-desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'staging-mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
