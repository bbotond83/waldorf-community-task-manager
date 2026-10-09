import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSyntheticSessionToken,
  resolveSyntheticSession,
  SESSION_MAX_AGE_SECONDS,
} from "../../src/runtime/session/session.ts";
import {
  currentSyntheticActor,
  getSyntheticAccessState,
  resetSyntheticAccessState,
  revokeSyntheticSubjectAccess,
  setSyntheticAccessState,
} from "../../src/runtime/synthetic/access-state.ts";
import {
  getSyntheticProfile,
  SYNTHETIC_PROFILES,
  syntheticProfileIdSchema,
} from "../../src/runtime/synthetic/profiles.ts";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
} from "../../src/application/index.ts";
const now = Date.parse("2026-10-06T12:00:00Z");
const teacher = () => getSyntheticProfile("kindergarten-teacher-local")!;
function historicalToken(profileId: string, version = 1) {
  const payload = Buffer.from(
    JSON.stringify({
      profileId,
      authorizationVersion: version,
      issuedAt: now,
      nonce: "historical-test-nonce",
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", "waldorf-local-synthetic-session-key-v1").update(payload).digest("base64url")}`;
}
afterEach(() => resetSyntheticAccessState());
describe("current role session", () => {
  it("catalog contains four profiles and Hungarian teacher label", () => {
    expect(SYNTHETIC_PROFILES).toHaveLength(4);
    expect(teacher().label).toBe("Óvónő");
    expect(teacher().role).toBe("kindergarten-teacher");
    expect(teacher().homePath).toBe("/teacher/schedule");
  });
  it.each(["staff-local", "kindergarten-admin-local"])(
    "removed profile %s requires fresh selection with no alias",
    (id) => {
      expect(getSyntheticProfile(id)).toBeUndefined();
      expect(syntheticProfileIdSchema.safeParse(id).success).toBe(false);
      expect(resolveSyntheticSession(historicalToken(id), now)).toBeUndefined();
      expect(
        resolveSyntheticSession(createSyntheticSessionToken(teacher(), now), now)?.actor.roles,
      ).toEqual(["kindergarten_teacher"]);
    },
  );
  it("current teacher session binds active scoped paired grants", () => {
    const actor = resolveSyntheticSession(createSyntheticSessionToken(teacher(), now), now)?.actor;
    expect(actor?.isActive).toBe(true);
    expect(actor?.grants.map((grant) => grant.scope.id)).toEqual(["group-oak", "group-sunflower"]);
    expect(actor?.grants.every((grant) => grant.role === "kindergarten_teacher")).toBe(true);
  });
  it("current generation mutation invalidates old cookie and fresh selection uses resulting generation", () => {
    const token = createSyntheticSessionToken(teacher(), now);
    const state = getSyntheticAccessState(teacher().id)!;
    setSyntheticAccessState(teacher().id, { ...state, authorizationVersion: 2 });
    expect(resolveSyntheticSession(token, now)).toBeUndefined();
    expect(
      resolveSyntheticSession(createSyntheticSessionToken(teacher(), now), now)
        ?.authorizationVersion,
    ).toBe(2);
  });
  it.each(["inactive", "revoked", "missing", "invalid", "no-grants"])(
    "%s authoritative state rejects resolution and selection",
    (condition) => {
      const token = createSyntheticSessionToken(teacher(), now);
      const state = getSyntheticAccessState(teacher().id)!;
      if (condition === "inactive") state.isActive = false;
      if (condition === "revoked")
        state.grants = state.grants.map((grant) => ({ ...grant, revokedAt: "2026" }));
      if (condition === "invalid") state.authorizationVersion = 0;
      if (condition === "missing") state.authorizationVersion = undefined;
      if (condition === "no-grants") state.grants = [];
      setSyntheticAccessState(teacher().id, state);
      expect(currentSyntheticActor(teacher().id)).toBeUndefined();
      expect(resolveSyntheticSession(token, now)).toBeUndefined();
      expect(() => createSyntheticSessionToken(teacher(), now)).toThrow(
        "SYNTHETIC_PROFILE_INVALID",
      );
    },
  );
  it("malformed persisted role and organization scope cannot become teacher authority", () => {
    const state = getSyntheticAccessState(teacher().id)!;
    state.grants[0]!.role = "unknown" as never;
    setSyntheticAccessState(teacher().id, state);
    expect(currentSyntheticActor(teacher().id)).toBeUndefined();
  });
  it("expiry signature and future issued-at reject without resolver mutation", () => {
    const original = getSyntheticAccessState(teacher().id);
    const token = createSyntheticSessionToken(teacher(), now);
    expect(
      resolveSyntheticSession(token, now + (SESSION_MAX_AGE_SECONDS + 1) * 1000),
    ).toBeUndefined();
    expect(resolveSyntheticSession(token + "tampered", now)).toBeUndefined();
    expect(resolveSyntheticSession(token, now - 1)).toBeUndefined();
    expect(getSyntheticAccessState(teacher().id)).toEqual(original);
  });
  it("invalidated navigation clears protected cache and contains no payload", async () => {
    const actor = currentSyntheticActor(teacher().id)!;
    const versions = new InMemoryAuthorizationVersions({ [actor.subjectId]: 2 });
    const result = await new AuthorizationContract(versions).navigation(actor);
    expect(result.state).toBe("invalidated");
    expect("data" in result).toBe(false);
    expect(versions.clearedSubjects).toEqual([actor.subjectId]);
  });
  it("existing governance revocation rejects root cookie and advances authoritative generation", () => {
    const profile = getSyntheticProfile("group-admin-local")!;
    const token = createSyntheticSessionToken(profile, now);
    expect(revokeSyntheticSubjectAccess(profile.id)).toBe(2);
    expect(getSyntheticAccessState(profile.id)?.authorizationVersion).toBe(2);
    expect(resolveSyntheticSession(token, now)).toBeUndefined();
    expect(() => createSyntheticSessionToken(profile, now)).toThrow("SYNTHETIC_PROFILE_INVALID");
    expect(revokeSyntheticSubjectAccess(profile.id)).toBeUndefined();
    expect(getSyntheticAccessState(profile.id)?.authorizationVersion).toBe(2);
  });
});
