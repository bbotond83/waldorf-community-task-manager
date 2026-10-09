import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const applicationDirectory = dirname(fileURLToPath(import.meta.url));
const productionFiles = [
  "admin-facade.ts",
  "authorization.ts",
  "contracts.ts",
  "evidence.ts",
  "facade-pipeline.ts",
  "idempotency.ts",
  "index.ts",
  "parent-facade.ts",
  "projection.ts",
  "results.ts",
  "session-facade.ts",
  "teacher-facade.ts",
  "validation.ts",
];

describe("application library isolation", () => {
  it("has no framework, transport, environment, or concrete adapter imports", () => {
    const forbidden = /from\s+["'](?:next|react|node:|.*runtime|.*in-memory|.*supabase)/;
    for (const file of productionFiles) {
      const source = readFileSync(join(applicationDirectory, file), "utf8");
      assert.doesNotMatch(source, forbidden, file);
      assert.doesNotMatch(source, /process\.env|cookies\(|\bRequest\s*\(|\bResponse\s*\(/, file);
    }
  });

  it("keeps user-facing presentation identifiers Hungarian-safe and stable", () => {
    const source = productionFiles
      .map((file) => readFileSync(join(applicationDirectory, file), "utf8"))
      .join("\n");
    assert.match(source, /Nincs jogosultság|Feladatok|Beosztás/);
    assert.doesNotMatch(source, /password|accessToken|serviceRoleKey/i);
  });
});
