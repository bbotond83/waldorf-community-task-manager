import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import ProductionCoverageReporter from "./tests/coverage/support/production-coverage-reporter.ts";

const coverageRun = process.argv.includes("--coverage");

export default defineConfig({
  test: {
    reporters: ["default", new ProductionCoverageReporter()],
    projects: [
      {
        resolve: {
          alias: { "server-only": resolve("node_modules/next/dist/compiled/server-only/empty.js") },
        },
        test: {
          name: "delivery",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: [
            "tests/unit/**/*.test.ts",
            "tests/integration/**/*.test.{ts,tsx}",
            "tests/coverage/**/*.test.{ts,tsx}",
          ],
        },
      },
      ...(coverageRun
        ? [
            {
              resolve: {
                alias: { "node:test": resolve("tests/coverage/support/node-test-adapter.ts") },
              },
              test: { name: "domain-coverage", environment: "node", include: ["src/**/*.test.ts"] },
            },
          ]
        : []),
    ],
    coverage: {
      provider: "istanbul",
      include: [
        "app/**/*.{ts,tsx}",
        "src/**/*.{ts,tsx}",
        "scripts/**/*.{ts,mjs,js}",
        "proxy.ts",
        "next.config.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
      thresholds: { lines: 80, branches: 80, functions: 80 },
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
    },
  },
});
