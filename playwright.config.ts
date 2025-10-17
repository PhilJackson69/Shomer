import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 60_000
  },
  use: { baseURL: "http://localhost:3000" },
  reporter: [["list"]],
  timeout: 30_000,
  outputDir: "tmp/playwright-artifacts", // Avoid test-results perms issues on Windows
});
