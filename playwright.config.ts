import { defineConfig } from "@playwright/test"

// LP_TEST_URL points the suite at a preview that is already running (the
// local one on 4500) instead of starting a second dev server for the tests.
const external = process.env.LP_TEST_URL

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 2,
  use: {
    baseURL: external ?? "http://127.0.0.1:4501",
    browserName: "chromium",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: external
    ? undefined
    : {
        command: "bun run dev --config vite.browser.config.ts",
        url: "http://127.0.0.1:4501/tests/browser/",
        reuseExistingServer: !process.env.CI,
      },
})
