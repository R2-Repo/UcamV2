import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: 'mobile-preview.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  timeout: 30_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.PREVIEW_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
  },
  outputDir: 'test-results/mobile-check',
  projects: [
    {
      name: 'iphone-13',
      use: {
        browserName: 'chromium',
        ...devices['iPhone 13'],
      },
    },
    {
      name: 'pixel-7',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 7'],
      },
    },
  ],
})