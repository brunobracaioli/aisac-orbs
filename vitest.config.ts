import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15_000,
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    setupFiles: ["tests/support/fast-check-setup.ts"],
    reporters: ["default", "json"],
    outputFile: {
      json: "reports/vitest.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "reports/coverage",
      exclude: ["scripts/**", "tests/**", "app/smoke/**", "**/*.config.{ts,mjs,cjs}"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
        "core/**": { lines: 90, branches: 85 },
        "engine/**": { lines: 90, branches: 85 },
        "events/**": { lines: 90, branches: 85 },
        "formations/**": { lines: 90, branches: 85 },
        "adapters/**": { lines: 90, branches: 85 },
        "audio/**": { lines: 90, branches: 85 },
      },
    },
  },
});
