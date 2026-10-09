import assert from "node:assert/strict";
import { it } from "node:test";
import { createSyntheticTeacherRepository, TEACHER_GROUPS, SYNTHETIC_SCHEDULE } from "./index.ts";
const query = { groupScope: TEACHER_GROUPS[0]!.scope, from: "2026-08-12", to: "2026-08-20" };
it("Teacher repository preserves existing fixture identities dates and scopes", () => {
  const { operator } = createSyntheticTeacherRepository();
  assert.deepEqual(
    operator.snapshot().map((row) => [row.id, row.groupId, row.startsAt, row.endsAt]),
    SYNTHETIC_SCHEDULE.map((row) => [row.id, row.groupId, row.startsAt, row.endsAt]),
  );
});
it("Teacher repository returns bounded inclusive start dates", async () => {
  const { repository } = createSyntheticTeacherRepository();
  const rows = await repository.readCurrent({ ...query, from: "2026-08-14", to: "2026-08-14" });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["schedule-crafts"],
  );
  assert.deepEqual(
    await repository.readCurrent({ ...query, from: "2026-09-01", to: "2026-09-05" }),
    [],
  );
});
it("Teacher repository isolates organization and group", async () => {
  const { repository } = createSyntheticTeacherRepository();
  assert.deepEqual(
    await repository.readCurrent({
      ...query,
      groupScope: { ...query.groupScope, organizationId: "other" },
    }),
    [],
  );
  const rows = await repository.readCurrent({ ...query, groupScope: TEACHER_GROUPS[1]!.scope });
  assert.equal(rows[0]?.id, "schedule-coverage");
  assert.equal(rows[0]?.ownerDisplayName, null);
  assert.deepEqual(rows[0]?.assigneeDisplayNames, []);
  assert.equal(rows[0]?.currentStatusLabel, null);
});
it("Teacher repository update handle changes only current tracking fields", async () => {
  const { repository, operator } = createSyntheticTeacherRepository();
  const before = operator.snapshot();
  operator.replaceTrackingFields("schedule-garden", {
    ownerDisplayName: "Updated",
    assigneeDisplayNames: ["A", "B"],
    currentStatusLabel: "Current",
  });
  const after = await repository.readCurrent(query);
  assert.equal(after[0]?.ownerDisplayName, "Updated");
  assert.equal(after[0]?.sourceRecordId, before[0]?.sourceRecordId);
  assert.equal(after[0]?.startsAt, before[0]?.startsAt);
});
it("Teacher repository snapshots cannot alter shared state", async () => {
  const { repository } = createSyntheticTeacherRepository();
  const rows = await repository.readCurrent(query);
  assert.ok(Object.isFrozen(rows));
  assert.ok(Object.isFrozen(rows[0]));
  assert.ok(Object.isFrozen(rows[0]?.assigneeDisplayNames));
});
it("Teacher repository instances and read ports stay isolated", async () => {
  const one = createSyntheticTeacherRepository();
  const two = createSyntheticTeacherRepository();
  one.operator.replaceTrackingFields("schedule-garden", {
    ownerDisplayName: "Only one",
    assigneeDisplayNames: [],
    currentStatusLabel: null,
  });
  assert.equal((await two.repository.readCurrent(query))[0]?.ownerDisplayName, "Kitalált Dóra");
  assert.deepEqual(Object.keys(one.repository), ["readCurrent"]);
});
it("Teacher repository rejects malformed updates and date ranges", () => {
  const { repository, operator } = createSyntheticTeacherRepository();
  assert.throws(() =>
    operator.replaceTrackingFields("missing", {
      ownerDisplayName: null,
      assigneeDisplayNames: [],
      currentStatusLabel: null,
    }),
  );
  assert.throws(() =>
    operator.replaceTrackingFields("schedule-garden", {
      ownerDisplayName: 4,
      assigneeDisplayNames: [],
      currentStatusLabel: null,
    } as never),
  );
  assert.throws(() => repository.readCurrent({ ...query, from: "invalid" }));
  assert.throws(() =>
    createSyntheticTeacherRepository([{ ...SYNTHETIC_SCHEDULE[0]!, endsAt: "bad" }]),
  );
});
