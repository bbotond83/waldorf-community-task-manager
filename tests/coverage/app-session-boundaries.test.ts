import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createSyntheticSessionToken } from "../../src/runtime/session/session.ts";
import { getSyntheticProfile } from "../../src/runtime/synthetic/profiles.ts";
import { resetSyntheticAdminFixtures } from "../../src/admin-core/synthetic-admin.ts";
import { resetSyntheticAdvancedFixtures } from "../../src/admin-advanced/index.ts";
import { resetSyntheticParentState } from "../../src/parent-web/index.ts";
const boundary = vi.hoisted(() => ({
  token: undefined as string | undefined,
  set: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (boundary.token ? { value: boundary.token } : undefined),
    set: boundary.set,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
  boundary.token = undefined;
  vi.clearAllMocks();
  resetSyntheticAdminFixtures();
  resetSyntheticAdvancedFixtures();
  resetSyntheticParentState();
});
afterEach(() => vi.unstubAllEnvs());
function signIn(id: string) {
  boundary.token = createSyntheticSessionToken(getSyntheticProfile(id)!);
}
import { resolveAdminSession } from "../../app/admin/_lib/session.ts";
import { resolveParentSession } from "../../app/szulo/_lib/session.ts";
import { resolveTeacherSession } from "../../app/teacher/_lib/session.ts";
import { resolveAdminFacade } from "../../app/admin/_lib/facade.ts";
import { resolveParentFacade } from "../../app/szulo/_lib/facade.ts";
import { resolveTeacherFacade } from "../../app/teacher/_lib/facade.ts";
import { mapApplicationResult } from "../../app/admin/_lib/action-state.ts";
import { mapParentResult } from "../../app/szulo/_lib/action-state.ts";
import * as result from "../../src/application/results.ts";
it("resolves signed-out, granted, forbidden and invalid configuration sessions", async () => {
  for (const resolver of [resolveAdminSession, resolveParentSession, resolveTeacherSession])
    expect((await resolver()).state).toBe("signed-out");
  for (const [id, resolver] of [
    ["group-admin-local", resolveAdminSession],
    ["super-admin-local", resolveAdminSession],
    ["parent-local", resolveParentSession],
    ["kindergarten-teacher-local", resolveTeacherSession],
  ] as const) {
    signIn(id);
    expect((await resolver()).state).toBe("success");
  }
  signIn("parent-local");
  expect((await resolveAdminSession()).state).toBe("denied");
  expect((await resolveTeacherSession()).state).toBe("denied");
  signIn("kindergarten-teacher-local");
  expect((await resolveParentSession()).state).toBe("denied");
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
  for (const resolver of [resolveAdminSession, resolveParentSession, resolveTeacherSession])
    expect((await resolver()).state).toBe("configuration-error");
  for (const resolver of [resolveAdminFacade, resolveParentFacade, resolveTeacherFacade])
    expect(await resolver()).toBeUndefined();
});
it("returns real synthetic facades and, in production mode without a real sign-in, no session and no facade", async () => {
  expect(await resolveAdminFacade()).toBeDefined();
  expect(await resolveParentFacade()).toBeDefined();
  expect(await resolveTeacherFacade()).toBeDefined();
  vi.stubEnv("APP_RUNTIME_MODE", "production");
  vi.stubEnv("APP_SESSION_SECRET", "invented".repeat(6));
  vi.stubEnv("SUPABASE_URL", "https://invented.invalid");
  vi.stubEnv("SUPABASE_ANON_KEY", "invented".repeat(6));
  // Production mode reads the real sign-in session (U2). The invented session cookie is not one, and the
  // identity settings are not configured here, so nobody is signed in: no session, no facade.
  for (const resolver of [resolveAdminSession, resolveParentSession, resolveTeacherSession])
    expect((await resolver()).state).toBe("signed-out");
  for (const resolver of [resolveAdminFacade, resolveParentFacade, resolveTeacherFacade])
    expect(await resolver()).toBeUndefined();
});
it("maps explicit application states to safe actionable presentation", () => {
  const outcomes = [
    result.success({ id: "invented" }),
    result.validation({ title: "required" }),
    result.denied(),
    result.conflict("VERSION_CONFLICT"),
    result.invalidated(),
    result.retryableFailure({ idempotencyKey: "safe-key", action: "save" }),
    result.terminalFailure(),
  ];
  const expected = [
    "success",
    "validation",
    "denied",
    "conflict",
    "invalidated",
    "retryable",
    "terminal",
  ];
  outcomes.forEach((outcome, index) => {
    expect(mapApplicationResult(outcome).state).toBe(expected[index]);
    expect(mapParentResult(outcome, "done").state).toBe(expected[index]);
  });
});
