import assert from "node:assert/strict";
import { it } from "node:test";
import {
  SyntheticTeacherScheduleAdapter,
  createSyntheticTeacherRepository,
  TEACHER_GROUPS,
  SYNTHETIC_SCHEDULE,
} from "./index.ts";
const query = {
  actorId: "teacher",
  groupScope: TEACHER_GROUPS[0]!.scope,
  from: "2026-08-12",
  to: "2026-08-20",
};
it("Teacher adapter reads existing source records with explicit responsibility", async () => {
  const result = await new SyntheticTeacherScheduleAdapter().getSchedule(query);
  assert.equal(result.state, "success");
  if (result.state === "success") {
    assert.equal(result.data.entries.length, 2);
    assert.equal(result.data.entries[0]?.ownerDisplayName, "Kitalált Dóra");
  }
});
it("Teacher adapter reads same injected source freshly", async () => {
  const { repository, operator } = createSyntheticTeacherRepository();
  const adapter = new SyntheticTeacherScheduleAdapter(repository);
  await adapter.getSchedule(query);
  operator.replaceTrackingFields("schedule-garden", {
    ownerDisplayName: "New",
    assigneeDisplayNames: ["Current"],
    currentStatusLabel: "Changed",
  });
  const result = await adapter.getSchedule(query);
  assert.equal(result.state, "success");
  if (result.state === "success")
    assert.equal(result.data.entries[0]?.currentStatusLabel, "Changed");
});
it("Teacher adapter has one bounded read per request", async () => {
  let reads = 0;
  const adapter = new SyntheticTeacherScheduleAdapter({
    readCurrent: () => {
      reads++;
      return SYNTHETIC_SCHEDULE.slice(0, 2);
    },
  });
  await adapter.getSchedule(query);
  assert.equal(reads, 1);
});
it("Teacher adapter distinguishes empty and denied scenarios", async () => {
  for (const scenario of ["empty", "denied"] as const)
    assert.equal(
      (
        await new SyntheticTeacherScheduleAdapter(
          createSyntheticTeacherRepository().repository,
          scenario,
        ).getSchedule(query)
      ).state,
      scenario,
    );
});
it("Teacher adapter preserves retryable and terminal classification", async () => {
  for (const scenario of ["retryable", "terminal"] as const)
    await assert.rejects(
      new SyntheticTeacherScheduleAdapter(
        createSyntheticTeacherRepository().repository,
        scenario,
      ).getSchedule(query),
      (error) => (error as { classification: string }).classification === scenario,
    );
});
it("Teacher adapter rejects mixed scope without partial data", async () => {
  const result = await new SyntheticTeacherScheduleAdapter({
    readCurrent: () => SYNTHETIC_SCHEDULE,
  }).getSchedule(query);
  assert.deepEqual(result, { state: "denied" });
});
it("Teacher adapter rejects malformed source", async () => {
  await assert.rejects(
    new SyntheticTeacherScheduleAdapter({
      readCurrent: () =>
        [
          { ...SYNTHETIC_SCHEDULE[0]!, ownerDisplayName: undefined },
        ] as unknown as typeof SYNTHETIC_SCHEDULE,
    }).getSchedule(query),
    /Invalid tracking source/,
  );
});
it("Teacher adapter has only the read capability", () =>
  assert.deepEqual(Object.getOwnPropertyNames(SyntheticTeacherScheduleAdapter.prototype).sort(), [
    "constructor",
    "getSchedule",
  ]));
