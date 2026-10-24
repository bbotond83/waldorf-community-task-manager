import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { blockerSummary, scheduleStatusLabel } from "./copy.ts";
import { TerminalDataFailure } from "./errors.ts";
import { toScheduleEntry } from "./schedule.ts";
import { createTeacherPort } from "./teacher-port.ts";

const GROUP = "cccccccc-0000-4000-8000-000000000101";
const ORGANIZATION = "aaaaaaaa-0000-4000-8000-000000000001";
const scope = { id: GROUP, type: "group" as const, organizationId: ORGANIZATION };

const row = (extra: Record<string, unknown> = {}) => ({
  id: "cccccccc-0000-4000-8000-000000000811",
  group_id: GROUP,
  starts_at: "2026-11-02T10:00:00+00:00",
  ends_at: "2026-11-02T12:00:00+00:00",
  title: "Sütés",
  location: "Konyha",
  coordination_display_name: "Kovács Mária",
  owner_display_name: "Fenyő család",
  assignee_display_names: ["Fenyő család", "Napraforgó család"],
  current_status_label: "open",
  ...extra,
});

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createTeacherPort(fake.database) };
}

test("the schedule rows become tracking records of the organization and group asked for", async () => {
  const { fake, port: teacher } = port({
    rpc: () => envelope("success", null, { items: [row()] }, GROUP),
  });
  const outcome = await teacher.getSchedule({
    actorId: "ignored",
    groupScope: scope,
    from: "2026-11-01",
    to: "2026-11-30",
  });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.entries[0], {
    id: "cccccccc-0000-4000-8000-000000000811",
    sourceRecordId: "cccccccc-0000-4000-8000-000000000811",
    organizationId: ORGANIZATION,
    groupId: GROUP,
    startsAt: "2026-11-02T10:00:00+00:00",
    endsAt: "2026-11-02T12:00:00+00:00",
    title: "Sütés",
    location: "Konyha",
    coordinationDisplayName: "Kovács Mária",
    ownerDisplayName: "Fenyő család",
    assigneeDisplayNames: ["Fenyő család", "Napraforgó család"],
    currentStatusLabel: "Nyitott",
  });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "schedule_get",
    args: { p_group_id: GROUP, p_from: "2026-11-01", p_to: "2026-11-30" },
  });
});

test("an open limit is sent as no limit", async () => {
  const { fake, port: teacher } = port({ rpc: () => envelope("success", null, { items: [] }) });
  await teacher.getSchedule({ actorId: "a", groupScope: scope });
  assert.deepEqual(fake.rpcCalls[0]?.args, { p_group_id: GROUP, p_from: null, p_to: null });
});

test("no tasks in the range is the empty state", async () => {
  const { port: teacher } = port({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await teacher.getSchedule({ actorId: "a", groupScope: scope }), {
    state: "empty",
  });
});

test("a group the teacher is not granted is denied, and so is an id that names no group", async () => {
  const { fake, port: teacher } = port({
    rpc: () => envelope("denied", "authorization_denied"),
  });
  assert.deepEqual(await teacher.getSchedule({ actorId: "a", groupScope: scope }), {
    state: "denied",
  });
  assert.deepEqual(
    await teacher.getSchedule({ actorId: "a", groupScope: { ...scope, id: "no-current-group" } }),
    { state: "denied" },
  );
  assert.equal(fake.rpcCalls.length, 1, "the malformed id never reaches the database");
});

test("the database's own date check is passed on as a validation result", async () => {
  const { port: teacher } = port({ rpc: () => envelope("validation", "VAL-DATE-RANGE") });
  const outcome = await teacher.getSchedule({ actorId: "a", groupScope: scope, from: "x" });
  assert.deepEqual(outcome, {
    state: "validation",
    fieldErrors: { range: "VAL-DATE-RANGE" },
    code: "VAL-DATE-RANGE",
  });
});

test("an entry with no coordinator, owner or status keeps those fields empty", () => {
  const entry = toScheduleEntry(
    row({
      coordination_display_name: null,
      owner_display_name: null,
      assignee_display_names: [],
      current_status_label: null,
    }),
    ORGANIZATION,
  );
  assert.ok(!("coordinationDisplayName" in entry));
  assert.equal(entry.ownerDisplayName, null);
  assert.deepEqual(entry.assigneeDisplayNames, []);
  assert.equal(entry.currentStatusLabel, null);
});

test("nothing but the listed fields reaches the entry: no contact, note or person id", () => {
  const entry = toScheduleEntry(
    row({
      contact_email: "a@example.test",
      allergen_note: "mogyoró",
      parent_id: "p",
      family_id: "f",
    }),
    ORGANIZATION,
  );
  const keys = Object.keys(entry).sort();
  assert.deepEqual(keys, [
    "assigneeDisplayNames",
    "coordinationDisplayName",
    "currentStatusLabel",
    "endsAt",
    "groupId",
    "id",
    "location",
    "organizationId",
    "ownerDisplayName",
    "sourceRecordId",
    "startsAt",
    "title",
  ]);
});

test("the stored status labels become the screens' words, and an unknown label no status", () => {
  assert.equal(scheduleStatusLabel("open"), "Nyitott");
  assert.equal(scheduleStatusLabel("full"), "Betelt");
  assert.equal(scheduleStatusLabel("cancelled"), "Törölve");
  assert.equal(scheduleStatusLabel("something"), null);
  assert.equal(scheduleStatusLabel(null), null);
});

test("a row with a malformed assignee list is a terminal failure", () => {
  assert.throws(
    () => toScheduleEntry(row({ assignee_display_names: "x" }), ORGANIZATION),
    TerminalDataFailure,
  );
  assert.throws(
    () => toScheduleEntry(row({ assignee_display_names: [1] }), ORGANIZATION),
    TerminalDataFailure,
  );
  assert.throws(() => toScheduleEntry(row({ title: null }), ORGANIZATION), TerminalDataFailure);
});

test("blocker codes read as one Hungarian line, with a generic reason for a new code", () => {
  assert.equal(blockerSummary([]), undefined);
  assert.equal(blockerSummary(["grace_period"]), "A türelmi idő még tart");
  assert.equal(
    blockerSummary(["hold", "grace_period"]),
    "Aktív megőrzési kötelezettség; A türelmi idő még tart",
  );
  assert.equal(blockerSummary(["account_refused"]), "A család jelenleg nem törölhető");
});
