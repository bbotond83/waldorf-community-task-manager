import { validateManifests } from "./core.ts";

const scenarios = validateManifests();
console.log(`VERIFICATION_MANIFESTS_VALID scenarios=${scenarios.length}`);
