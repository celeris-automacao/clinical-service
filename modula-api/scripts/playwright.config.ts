import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

function findChromium(): string {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  try {
    return execSync("which chromium", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

const chromiumPath = findChromium();

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:80",
    headless: true,
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath, args: ["--no-sandbox", "--disable-setuid-sandbox"] } } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
