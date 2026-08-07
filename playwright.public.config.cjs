const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './browser-tests',
  testMatch: ['public-deployment.spec.cjs', 'public-premium-preview-release.spec.cjs'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: 'test-results-public',
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-public-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4174 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'public-desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'public-mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
