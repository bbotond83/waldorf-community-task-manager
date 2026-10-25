import assert from "node:assert/strict";
import { it } from "node:test";
import {
  isCalendarDate,
  isTrackingRange,
  isTrackingSource,
  matchesTrackingScope,
  projectTrackingEntry,
} from "./tracking-model.ts";
const row = {
  id: "id",
  sourceRecordId: "source",
  groupId: "group",
  organizationId: "org",
  startsAt: "2026-08-01T00:00:00Z",
  endsAt: "2026-08-01T01:00:00Z",
  title: "Title",
  location: "Location",
  ownerDisplayName: null,
  assigneeDisplayNames: [],
  currentStatusLabel: null,
};
it("Teacher calendar accepts real leap dates", () => {
  assert.ok(isCalendarDate("2024-02-29"));
  assert.ok(isCalendarDate("2026-08-01"));
});
it("Teacher calendar rejects normalized impossible and noncanonical dates", () => {
  for (const value of [
    "2026-02-29",
    "2026-02-30",
    "2026-06-31",
    "2026-8-01",
    "2026-08-01T00:00Z",
    null,
    5,
    "",
  ])
    assert.equal(isCalendarDate(value), false);
});
it("Teacher range accepts same day and elapsed31 boundary", () => {
  assert.ok(isTrackingRange("2026-08-01", "2026-08-01"));
  assert.ok(isTrackingRange("2026-08-01", "2026-09-01"));
  assert.equal(isTrackingRange("2026-08-01", "2026-09-02"), false);
  assert.equal(isTrackingRange("2026-08-02", "2026-08-01"), false);
});
it("Teacher source requires explicit metadata and nullable fields", () => {
  assert.ok(isTrackingSource(row));
  for (const [key, value] of [
    ["sourceRecordId", ""],
    ["ownerDisplayName", undefined],
    ["assigneeDisplayNames", [3]],
    ["currentStatusLabel", 2],
    ["coordinationDisplayName", 2],
    ["endsAt", "2026-07-01T00:00Z"],
  ])
    assert.equal(isTrackingSource({ ...row, [key as string]: value }), false);
  assert.equal(isTrackingSource(null), false);
});
it("Teacher scope checks organization as well as group", () => {
  assert.ok(matchesTrackingScope(row, { id: "group", type: "group", organizationId: "org" }));
  assert.equal(
    matchesTrackingScope(row, { id: "group", type: "group", organizationId: "other" }),
    false,
  );
  assert.equal(
    matchesTrackingScope(row, { id: "group", type: "organization", organizationId: "org" }),
    false,
  );
});
it("Teacher projection excludes private and source-only fields", () => {
  const result = projectTrackingEntry({
    ...row,
    email: "secret",
    financial: "private",
    coordinationDisplayName: "Separate",
  } as typeof row);
  assert.deepEqual(Object.keys(result).sort(), [
    "assigneeDisplayNames",
    "coordinationDisplayName",
    "currentStatusLabel",
    "endsAt",
    "groupId",
    "id",
    "location",
    "ownerDisplayName",
    "startsAt",
    "title",
  ]);
  assert.equal(result.ownerDisplayName, null);
});
it("Teacher projection copies arrays and freezes values", () => {
  const names = ["A"];
  const result = projectTrackingEntry({ ...row, assigneeDisplayNames: names });
  names.push("B");
  assert.deepEqual(result.assigneeDisplayNames, ["A"]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.assigneeDisplayNames));
});
