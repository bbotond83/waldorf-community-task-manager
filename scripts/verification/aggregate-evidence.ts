import { resolve } from "node:path";
import { aggregateEvidence } from "./core.ts";

const evidenceDirectory = resolve(
  process.env.VERIFICATION_EVIDENCE_DIR ?? ".verification/evidence",
);
const counts = aggregateEvidence({
  evidenceDirectory,
  reportJson: resolve("verification/reports/local-acceptance.json"),
  reportMarkdown: resolve("verification/reports/local-acceptance.md"),
  outstandingMarkdown: resolve("verification/reports/outstanding-targets.md"),
});
console.log(
  `VERIFICATION_EVIDENCE_VALID pass=${counts.pass} fail=${counts.fail} outstanding=${counts.outstanding}`,
);
