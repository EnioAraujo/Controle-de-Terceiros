import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    // Captura screenshot apenas em falhas
    screenshot: "only-on-failure",
    // Captura trace apenas em falhas
    trace: "on-first-retry",
  },
  // Inicia o servidor de desenvolvimento antes de rodar os testes
  webServer: {
    command: "pnpm dev --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
