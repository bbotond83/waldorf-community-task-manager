import assert from "node:assert/strict";
import { it } from "node:test";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  FacadePipeline,
  TeacherApplicationFacade,
  type SessionContext,
  type TeacherApplicationPort,
} from "./index.ts";
import {
  createSyntheticTeacherFacade,
  createSyntheticTeacherRepository,
  TEACHER_GROUPS,
  SYNTHETIC_SCHEDULE,
} from "../teacher-web/index.ts";
const scope = TEACHER_GROUPS[0]!.scope;
const session: SessionContext = {
  subjectId: "teacher",
  authorizationVersion: 1,
  ...sessionGrantBindings("teacher", "kindergarten_teacher", [scope]),
  roles: ["kindergarten_teacher"] as const,
  scopes: TEACHER_GROUPS.map((group) => group.scope),
  runtimeMode: "synthetic",
  isSynthetic: true,
};
const query = { groupScope: scope, from: "2026-08-12", to: "2026-08-20" };
function setup(port?: TeacherApplicationPort) {
  const versions = new InMemoryAuthorizationVersions({ teacher: 1 });
  const authorization = new AuthorizationContract(versions);
  const facade = port
    ? new TeacherApplicationFacade(new FacadePipeline(authorization), port)
    : createSyntheticTeacherFacade(authorization);
  return { facade, versions, authorization };
}
it("Teacher facade projects explicit allowlist and exact list/detail envelopes", async () => {
  const { facade } = setup();
  const result = await facade.getSchedule(session, query);
  assert.equal(result.state, "success");
  if (result.state === "success") {
    assert.equal(result.data.entries[0]?.ownerDisplayName, "Kitalált Dóra");
    assert.equal("sourceRecordId" in result.data.entries[0]!, false);
    assert.equal(result.code, "SUCCESS");
    assert.equal(result.focusTarget, "#fo-tartalom");
  }
  const detail = await facade.getScheduleEntry(session, { ...query, entryId: "schedule-garden" });
  assert.equal(detail.code, "SCHEDULE_ENTRY_READY");
});
it("Teacher facade authorizes before validation and source", async () => {
  let reads = 0;
  const { facade, versions } = setup({
    getSchedule: async () => {
      reads++;
      return { state: "success", data: { entries: SYNTHETIC_SCHEDULE.slice(0, 2) } };
    },
  });
  assert.equal((await facade.getSchedule(session, { ...query, from: "bad" })).state, "validation");
  assert.equal(
    (
      await facade.getSchedule(session, {
        ...query,
        groupScope: { ...scope, id: "other" },
        from: "bad",
      })
    ).state,
    "denied",
  );
  versions.setVersion("teacher", 2);
  assert.equal((await facade.getSchedule(session, { ...query, from: "bad" })).state, "invalidated");
  assert.equal(reads, 0);
});
it("Teacher facade current inactive revoked invalid-mode grants deny", async () => {
  const { facade } = setup();
  for (const context of [
    { ...session, isActive: false },
    { ...session, grants: session.grants.map((grant) => ({ ...grant, revokedAt: "now" })) },
    { ...session, isSynthetic: false },
    { ...session, grants: [] },
  ]) {
    const result = await facade.getSchedule(context, query);
    assert.equal(result.state, "denied");
    assert.equal("data" in result, false);
  }
});
it("Teacher facade rejects every mixed scope and malformed source without partial data", async () => {
  for (const rows of [
    [...SYNTHETIC_SCHEDULE.slice(0, 2), { ...SYNTHETIC_SCHEDULE[0]!, organizationId: "other" }],
    [{ ...SYNTHETIC_SCHEDULE[0]!, currentStatusLabel: undefined }],
  ]) {
    const { facade } = setup({
      getSchedule: async () => ({ state: "success", data: { entries: rows as never } }),
    });
    const result = await facade.getSchedule(session, query);
    assert.equal(result.state, rows.length > 1 ? "denied" : "dependency-failure-terminal");
    assert.equal("data" in result, false);
  }
});
it("Teacher facade normalizes zero success to empty and absent detail to denial", async () => {
  const { facade } = setup({
    getSchedule: async () => ({ state: "success", data: { entries: [] } }),
  });
  assert.equal((await facade.getSchedule(session, query)).code, "EMPTY");
  assert.equal(
    (await facade.getScheduleEntry(session, { ...query, entryId: "missing" })).code,
    "AUTHORIZATION_DENIED",
  );
});
it("Teacher facade fresh reads cannot reuse prior source projection", async () => {
  const { authorization } = setup();
  const { repository, operator } = createSyntheticTeacherRepository();
  let reads = 0;
  const facade = createSyntheticTeacherFacade(authorization, "ready", {
    readCurrent: (input) => {
      reads++;
      return repository.readCurrent(input);
    },
  });
  await facade.getSchedule(session, query);
  operator.replaceTrackingFields("schedule-garden", {
    ownerDisplayName: "Changed",
    assigneeDisplayNames: ["Now"],
    currentStatusLabel: "Current",
  });
  const result = await facade.getSchedule(session, query);
  assert.equal(reads, 2);
  if (result.state !== "success") assert.fail();
  assert.equal(result.data.entries[0]?.currentStatusLabel, "Current");
});
it("Teacher facade preserves error classification and source invalidation", async () => {
  const { authorization } = setup();
  for (const [scenario, state, code] of [
    ["retryable", "dependency-failure-retryable", "DEPENDENCY_RETRYABLE"],
    ["terminal", "dependency-failure-terminal", "UNEXPECTED_DEPENDENCY_FAILURE"],
    ["denied", "denied", "AUTHORIZATION_DENIED"],
  ] as const) {
    const result = await createSyntheticTeacherFacade(authorization, scenario).getSchedule(
      session,
      query,
    );
    assert.equal(result.state, state);
    assert.equal(result.code, code);
    assert.equal("data" in result, false);
  }
  const { facade } = setup({ getSchedule: async () => ({ state: "invalidated" }) });
  assert.equal((await facade.getSchedule(session, query)).code, "STATE_INVALIDATED");
});
it("Teacher facade removes sensitive sentinels and unsupported recovery detail", async () => {
  const row = {
    ...SYNTHETIC_SCHEDULE[0]!,
    finance: "private-sentinel",
    email: "private-sentinel",
    allergen: "private-sentinel",
  };
  const { facade } = setup({
    getSchedule: async () => ({ state: "success", data: { entries: [row] } }),
  });
  assert.equal(
    JSON.stringify(await facade.getSchedule(session, query)).includes("private-sentinel"),
    false,
  );
  const recovery = setup({
    getSchedule: async () => ({ state: "recovery", data: { entries: [row] } }),
  });
  assert.equal(
    (await recovery.facade.getScheduleEntry(session, { ...query, entryId: row.id })).code,
    "SCHEDULE_RECOVERY_UNAVAILABLE",
  );
});

it("Teacher facade duplicate source IDs and unsupported states fail terminal", async () => {
  for (const outcome of [
    { state: "success", data: { entries: [SYNTHETIC_SCHEDULE[0], SYNTHETIC_SCHEDULE[0]] } },
    { state: "conflict" },
    undefined,
  ]) {
    const { facade } = setup({ getSchedule: async () => outcome as never });
    const result = await facade.getSchedule(session, query);
    assert.equal(result.state, "dependency-failure-terminal");
    assert.equal("data" in result, false);
  }
});
