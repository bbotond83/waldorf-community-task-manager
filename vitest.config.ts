import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/integration/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      include: ["src/runtime/**/*.{ts,tsx}"],
      exclude: ["src/runtime/**/*.test.ts"],
      thresholds: { lines: 80, branches: 80, functions: 80 },
      reporter: ["text", "json-summary"],
    },
  },
});
