// Playwright E2E configuration for AtelierPro.
import { defineConfig, devices } from "@playwright/test";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveFrontendUrl() {
  return stripTrailingSlash(
    process.env.BASE_URL ||
      process.env.E2E_FRONTEND_URL ||
      "http://127.0.0.1:5173"
  );
}

function resolveApiUrl(frontendUrl: string) {
  if (process.env.API_URL) return stripTrailingSlash(process.env.API_URL);
  if (process.env.E2E_API_URL) return stripTrailingSlash(process.env.E2E_API_URL);

  try {
    const url = new URL(frontendUrl);
    const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";

    if (isLocalHost && (!url.port || url.port === "5173")) {
      url.port = "3000";
      return stripTrailingSlash(url.toString());
    }

    return stripTrailingSlash(`${url.protocol}//${url.host}`);
  } catch {
    return "http://127.0.0.1:3000";
  }
}

const frontendUrl = resolveFrontendUrl();
const apiUrl = resolveApiUrl(frontendUrl);
const headless = process.env.PLAYWRIGHT_HEADLESS === "false" ? false : true;

process.env.BASE_URL = frontendUrl;
process.env.E2E_FRONTEND_URL = frontendUrl;
process.env.E2E_API_URL = apiUrl;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: process.env.CI ? 60_000 : 30_000,
  globalTimeout: 15 * 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: frontendUrl,
    headless,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium"
      }
    }
  ]
});
