import { defineConfig } from "vitest/config";

// Unit tests only. E2E stays in Playwright (playwright.config.ts) — Vitest is
// told to ignore it so the two runners never fight over the same files.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
