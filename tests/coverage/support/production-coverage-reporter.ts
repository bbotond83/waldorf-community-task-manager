import { mkdirSync, writeFileSync } from "node:fs";
import { discoverProduction, validateProductionCoverage } from "./production-inventory.ts";

export default class ProductionCoverageReporter {
  onCoverage(coverage: unknown) {
    const inventory = discoverProduction();
    mkdirSync("coverage", { recursive: true });
    writeFileSync("coverage/production-inventory.json", JSON.stringify({ inventory }, null, 2));
    // Vitest passes Istanbul's CoverageMap instance, not its plain JSON data.
    if (
      !coverage ||
      typeof coverage !== "object" ||
      !("toJSON" in coverage) ||
      typeof coverage.toJSON !== "function"
    ) {
      throw new Error("Unsupported Vitest coverage-map API");
    }
    const map = coverage.toJSON();
    writeFileSync("coverage/production-map.json", JSON.stringify(map));
    const result = validateProductionCoverage(map, inventory);
    writeFileSync("coverage/production-inventory.json", JSON.stringify(result, null, 2));
  }
}
