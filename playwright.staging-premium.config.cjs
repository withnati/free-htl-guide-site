const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.FHL_STAGING_BASE_URL;
if (!baseURL) throw new Error('FHL_STAGING_BASE_URL is required.');
if (!process.env.FHL_STAGING_PREMIUM_EMAIL || !process.env.FHL_STAGING_PREMIUM_PASSWORD) {
  throw new Error('Designated staging Premium account credentials are required.');
}

module.exports = defineConfig({
  testDir: './browser-tests',
  testMatch: 'staging-premium.spec.cjs',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
