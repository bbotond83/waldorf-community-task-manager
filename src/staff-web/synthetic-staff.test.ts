import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  type SessionContext,
} from "../application/index.ts";
import {
  createSyntheticStaffFacade,
  STAFF_GROUPS,
  SyntheticStaffScheduleAdapter,
  UNGRANTED_STAFF_GROUP,
} from "./index.ts";

const versions = new InMemoryAuthorizationVersions({ "staff-local": 1 });
const authorization = new AuthorizationContract(versions);
const session: SessionContext = {
  subjectId: "staff-local",
  authorizationVersion: 1,
  roles: ["read_only_staff"],
  scopes: STAFF_GROUPS.map(({ scope }) => scope),
  runtimeMode: "synthetic",
  isSynthetic: true,
};
const range = { from: "2026-08-12", to: "2026-08-20" };

describe("synthetic Staff schedule", () => {
  it("returns only the allowlisted schedule projection for a granted group", async () => {
    const result = await createSyntheticStaffFacade(authorization).getSchedule(session, {
      groupScope: STAFF_GROUPS[0]!.scope,
      ...range,
    });
    assert.equal(result.state, "success");
    if (result.state !== "success") return;
    assert.equal(result.data.entries.length, 2);
    assert.deepEqual(Object.keys(result.data.entries[0]!).sort(), [
      "coordinationDisplayName",
      "endsAt",
      "id",
      "location",
      "startsAt",
      "title",
    ]);
    assert.equal(JSON.stringify(result).match(/email|phone|family|reason|assignment/iu), null);
  });

  it("returns empty for a bounded range without entries", async () => {
    const result = await createSyntheticStaffFacade(authorization).getSchedule(session, {
      groupScope: STAFF_GROUPS[0]!.scope,
      from: "2026-09-01",
      to: "2026-09-05",
    });
    assert.equal(result.state, "empty");
  });

  it("rejects a range longer than 31 days before calling the adapter", async () => {
    const result = await createSyntheticStaffFacade(authorization).getSchedule(session, {
      groupScope: STAFF_GROUPS[0]!.scope,
      from: "2026-08-01",
      to: "2026-09-02",
    });
    assert.equal(result.state, "validation");
  });

  it("generically denies an ungranted group and row", async () => {
    const facade = createSyntheticStaffFacade(authorization);
    const groupResult = await facade.getSchedule(session, {
      groupScope: UNGRANTED_STAFF_GROUP,
      ...range,
    });
    const rowResult = await facade.getScheduleEntry(session, {
      groupScope: STAFF_GROUPS[0]!.scope,
      entryId: "schedule-outside-scope",
      ...range,
    });
    assert.equal(groupResult.state, "denied");
    assert.equal(rowResult.state, "denied");
    assert.equal(JSON.stringify([groupResult, rowResult]).includes("outside-scope"), false);
  });

  it("enforces grant revocation on the next request", async () => {
    const facade = createSyntheticStaffFacade(authorization);
    versions.setVersion("staff-local", 2);
    const result = await facade.getSchedule(session, {
      groupScope: STAFF_GROUPS[0]!.scope,
      ...range,
    });
    assert.equal(result.state, "invalidated");
    assert.deepEqual(versions.clearedSubjects, ["staff-local"]);
    versions.setVersion("staff-local", 1);
  });

  it("classifies retryable and terminal failures without leaking adapter details", async () => {
    const retryable = await createSyntheticStaffFacade(authorization, "retryable").getSchedule(
      session,
      { groupScope: STAFF_GROUPS[0]!.scope, ...range },
    );
    const terminal = await createSyntheticStaffFacade(authorization, "terminal").getSchedule(
      session,
      { groupScope: STAFF_GROUPS[0]!.scope, ...range },
    );
    assert.equal(retryable.state, "dependency-failure-retryable");
    assert.equal(terminal.state, "dependency-failure-terminal");
    assert.equal(JSON.stringify([retryable, terminal]).includes("Synthetic staff"), false);
  });

  it("keeps the adapter read-only", () => {
    const methods = Object.getOwnPropertyNames(SyntheticStaffScheduleAdapter.prototype);
    assert.deepEqual(methods.sort(), ["constructor", "getSchedule"]);
  });
});
