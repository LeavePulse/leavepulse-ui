import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4501",
    browserName: "chromium",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: "bun run dev --config vite.browser.config.ts",
    url: "http://127.0.0.1:4501/tests/browser/",
    reuseExistingServer: !process.env.CI,
  },
})
