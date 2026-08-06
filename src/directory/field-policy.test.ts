import assert from "node:assert/strict";
import test from "node:test";
test("documents optional profiles require explicit consent before administrative projection", () => { const profile = { optionalProfile: "skill", optionalProfileConsent: false }; assert.equal(profile.optionalProfileConsent, false); });
