import { defineConfig, devices } from '@playwright/test';

// Keep localhost readiness checks local when this Windows host uses an HTTP proxy.
process.env.NO_PROXY = [process.env.NO_PROXY, '127.0.0.1', 'localhost', '[::1]'].filter(Boolean).join(',');
const production = process.env.PLAYWRIGHT_PRODUCTION === '1';
const baseURL = `http://127.0.0.1:${production ? 5174 : 5173}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  outputDir: production ? './test-results/e2e-production' : './test-results/e2e',
  reporter: [['list'], ['html', { outputFolder: production ? 'test-results/report-production' : 'test-results/report', open: 'never' }]],
  use: {
    ...devices['Desktop Edge'],
    channel: 'msedge',
    headless: true,
    baseURL,
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: production ? 'npm run build && npx vite preview --host 127.0.0.1 --port 5174 --strictPort' : 'npm run dev -- --port 5173',
    url: baseURL,
    reuseExistingServer: !production,
    timeout: 60_000,
  },
});
