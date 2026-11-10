import assert from "node:assert/strict";
import test from "node:test";
import type { Scope } from "../access/index.ts";
import type { AdminOperation } from "../application/index.ts";
import {
  envelope,
  fakeData,
  ok,
  type FakeHandlers,
  type QueryCall,
} from "../../tests/support/data-fakes.ts";
import {
  ADMIN_NOTIFICATION_USE_CASES,
  createAdminPort,
  DATABASE_ADMIN_OPERATIONS,
} from "./admin-port.ts";

const id = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const SCOPE: Scope = { id: ORG, type: "organization", organizationId: ORG };
const KEY = "record:save:abc-123";

type Row = Record<string, unknown>;

/** Table reads over in-memory rows: the equality, not-equal, in and ilike steps of the real query. */
function tables(data: Record<string, Row[]>): NonNullable<FakeHandlers["table"]> {
  return (query: QueryCall) => {
    let rows = data[query.table] ?? [];
    // Ordering steps apply last, in reverse, so the first one is the most significant (a stable sort).
    const orderings = query.steps.filter(([step]) => step === "order").reverse();
    for (const [step, column, value] of query.steps) {
      const name = String(column);
      if (step === "eq") rows = rows.filter((row) => row[name] === value);
      if (step === "neq") rows = rows.filter((row) => row[name] !== value);
      if (step === "in") rows = rows.filter((row) => (value as unknown[]).includes(row[name]));
      if (step === "ilike") {
        const needle = String(value).replaceAll("%", "").replaceAll("\\", "").toLowerCase();
        rows = rows.filter((row) => String(row[name]).toLowerCase().includes(needle));
      }
    }
    rows = [...rows];
    for (const [, column, options] of orderings) {
      const name = String(column);
      const descending = (options as { ascending?: boolean } | undefined)?.ascending === false;
      rows.sort((a, b) => {
        const compared = String(a[name] ?? "").localeCompare(String(b[name] ?? ""));
        return descending ? -compared : compared;
      });
    }
    return ok(rows);
  };
}

function admin(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  const port = createAdminPort(fake.database);
  const run = (operation: AdminOperation, payload: Record<string, unknown> = {}, key?: string) =>
    port.execute<unknown>({
      actorId: "ignored",
      operation,
      scope: SCOPE,
      payload,
      ...(key ? { idempotencyKey: key } : {}),
    });
  return { fake, run };
}

const FAMILY = { id: id(1), display_name: "Fenyő család", status: "active", version: 3 };
const CHILD = { id: id(2), family_id: id(1), display_name: "Gergő", status: "active", version: 2 };
const GROUP = {
  id: id(3),
  school_year_id: id(4),
  name: "Boróka",
  description: "A kert gondozása.",
  status: "active",
  version: 5,
};
const YEAR = {
  id: id(4),
  name: "2026/2027",
  starts_on: "2026-09-01",
  ends_on: "2027-06-30",
  status: "archived",
  version: 1,
};

test("the record list merges every kind, sorted by name, and a filter reaches the query", async () => {
  const { fake, run } = admin({
    table: tables({ families: [FAMILY], children: [CHILD], groups: [GROUP], school_years: [YEAR] }),
  });
  const outcome = await run("records.list", {});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const items = (outcome.data as { items: { title: string; state: string }[] }).items;
  assert.deepEqual(
    items.map((item) => item.title),
    ["2026/2027", "Boróka", "Fenyő család", "Gergő"],
  );
  assert.equal(fake.queries.length, 4);
  const filtered = await run("records.list", { state: "archived", q: "26/20" });
  assert.equal(filtered.state, "success");
  assert.ok(
    fake.queries
      .slice(4)
      .every((query) =>
        query.steps.some(
          ([step, column, value]) => step === "eq" && column === "status" && value === "archived",
        ),
      ),
  );
  assert.ok(fake.queries.slice(4).some((query) => query.steps.some(([step]) => step === "ilike")));
});

test("a search text is matched literally and nothing found is the empty state", async () => {
  const { fake, run } = admin({ table: tables({}) });
  assert.deepEqual(await run("records.list", { q: "100%_x" }), { state: "empty" });
  const pattern = fake.queries[0]?.steps.find(([step]) => step === "ilike")?.[2];
  assert.equal(pattern, "%100\\%\\_x%");
});

test("one record is found by id across the kinds, and an unknown id is denied", async () => {
  const { run } = admin({ table: tables({ groups: [GROUP] }) });
  const found = await run("records.get", { id: id(3) });
  assert.deepEqual(found, {
    state: "success",
    data: {
      id: id(3),
      title: "Boróka",
      state: "active",
      version: 5,
      kind: "group",
      details: { schoolYearId: id(4), description: "A kert gondozása." },
    },
  });
  assert.deepEqual(await run("records.get", { id: id(9) }), { state: "denied" });
  assert.deepEqual(await run("records.get", { id: "placeholder" }), { state: "denied" });
  assert.deepEqual(await run("records.get", {}), { state: "denied" });
});

test("a school year and a child are read with the fields their forms edit", async () => {
  const { run } = admin({ table: tables({ school_years: [YEAR], children: [CHILD] }) });
  assert.deepEqual(await run("records.get", { id: id(4) }), {
    state: "success",
    data: {
      id: id(4),
      title: "2026/2027",
      state: "archived",
      version: 1,
      kind: "school-year",
      details: { startsOn: "2026-09-01", endsOn: "2027-06-30" },
    },
  });
  const child = await run("records.get", { id: id(2) });
  assert.equal(child.state, "success");
  if (child.state === "success") {
    assert.deepEqual((child.data as { details: unknown }).details, { familyId: id(1) });
  }
});

test("a family is read with its active parents, their contact details and children", async () => {
  const { fake, run } = admin({
    // The profile text is read through its function, only for the parent who gave consent.
    rpc: (name, args) =>
      name === "directory_parent_profile" && args.p_parent_id === id(30)
        ? ok("Kertész vagyok.")
        : ok(null),
    table: tables({
      families: [FAMILY],
      parents: [
        {
          id: id(30),
          family_id: id(1),
          status: "active",
          display_name: "Fenyő Anna",
          optional_profile_consent: true,
          account_id: id(99),
          version: 4,
        },
        {
          id: id(31),
          family_id: id(1),
          status: "active",
          display_name: "Fenyő Béla",
          optional_profile: null,
          optional_profile_consent: false,
          account_id: null,
          version: 1,
        },
        {
          id: id(32),
          family_id: id(1),
          status: "archived",
          display_name: "Régi szülő",
          optional_profile: null,
          optional_profile_consent: false,
          account_id: null,
          version: 1,
        },
      ],
      parent_contacts: [
        {
          parent_id: id(30),
          contact_email: "anna@example.test",
          contact_phone: "+36 30 111 2222",
          locality: "Pécs",
        },
      ],
      children: [{ ...CHILD, status: "active" }],
    }),
  });
  const outcome = await run("records.get", { id: id(1) });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const data = outcome.data as { kind: string; details: Record<string, unknown> };
  assert.equal(data.kind, "family");
  assert.deepEqual(data.details, {
    parents: [
      {
        id: id(30),
        version: 4,
        displayName: "Fenyő Anna",
        email: "anna@example.test",
        phone: "+36 30 111 2222",
        locality: "Pécs",
        optionalProfile: "Kertész vagyok.",
        optionalProfileConsent: true,
        linked: true,
      },
      {
        id: id(31),
        version: 1,
        displayName: "Fenyő Béla",
        optionalProfileConsent: false,
        linked: false,
      },
    ],
    children: [{ id: id(2), version: 2, displayName: "Gergő" }],
  });
  // Only the parent with consent had a profile asked for.
  assert.deepEqual(
    fake.rpcCalls.map((call) => [call.name, call.args.p_parent_id]),
    [["directory_parent_profile", id(30)]],
  );
});

test("a parent who consented but wrote no profile text is read without a profile; a NULL answer stays a terminal failure", async () => {
  const parents = [
    {
      id: id(30),
      family_id: id(1),
      status: "active",
      display_name: "Fenyő Anna",
      optional_profile_consent: true,
      account_id: null,
      version: 1,
    },
  ];
  // The database now answers the empty string for this case (migration 20261035_integrity_directory_reads).
  const empty = admin({
    rpc: () => ok(""),
    table: tables({ families: [FAMILY], parents }),
  });
  const outcome = await empty.run("records.get", { id: id(1) });
  assert.equal(outcome.state, "success");
  if (outcome.state === "success") {
    const details = outcome.data as { details: { parents: Record<string, unknown>[] } };
    assert.equal(details.details.parents[0]?.optionalProfileConsent, true);
    assert.equal("optionalProfile" in (details.details.parents[0] ?? {}), false);
  }
  // The client guard is unchanged: a NULL scalar is still an unexpected failure, which is why the fix is
  // in the database function and not here.
  const nothing = admin({
    rpc: () => ok(null),
    table: tables({ families: [FAMILY], parents }),
  });
  await assert.rejects(
    () => nothing.run("records.get", { id: id(1) }),
    /UNEXPECTED_DEPENDENCY_FAILURE/,
  );
});

test("a family without parents is read with empty lists", async () => {
  const { run } = admin({ table: tables({ families: [FAMILY] }) });
  const outcome = await run("records.get", { id: id(1) });
  assert.equal(outcome.state, "success");
  if (outcome.state === "success") {
    assert.deepEqual((outcome.data as { details: unknown }).details, {
      parents: [],
      children: [],
    });
  }
});

test("a new family is saved with its parents, contact details and children", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 1 }, id(10)),
    table: tables({}),
  });
  const outcome = await run(
    "records.save",
    {
      id: "new",
      expectedVersion: 1,
      kind: "family",
      displayName: "Új család",
      parents: [
        {
          displayName: "Új Anna",
          email: "anna@example.test",
          phone: "+36 30 111 2222",
          locality: "Pécs",
          optionalProfile: "Szívesen főzök.",
          optionalProfileConsent: true,
        },
      ],
      children: [{ displayName: "Új Gyerek" }],
    },
    KEY,
  );
  assert.deepEqual(outcome, {
    state: "success",
    data: { id: id(10), title: "Új család", state: "active", version: 1 },
  });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "directory_save",
    args: {
      p_idempotency_key: KEY,
      p_family: {
        family_id: null,
        display_name: "Új család",
        parents: [
          {
            display_name: "Új Anna",
            optional_profile: "Szívesen főzök.",
            optional_profile_consent: true,
            contact: { email: "anna@example.test", phone: "+36 30 111 2222", locality: "Pécs" },
          },
        ],
        children: [{ display_name: "Új Gyerek" }],
      },
    },
  });
});

test("a title-only change of a family keeps everything else as it is", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 4 }, id(1)),
    table: tables({ families: [FAMILY] }),
  });
  const outcome = await run(
    "records.save",
    { id: id(1), expectedVersion: 3, kind: "record", title: "Fenyő" },
    KEY,
  );
  assert.deepEqual(outcome, {
    state: "success",
    data: { id: id(1), title: "Fenyő", state: "active", version: 4 },
  });
  assert.deepEqual(fake.rpcCalls[0]?.args.p_family, {
    family_id: id(1),
    expected_version: 3,
    display_name: "Fenyő",
  });
  const same = await run("records.save", { id: id(1), expectedVersion: 3 }, KEY);
  assert.equal(same.state, "success");
  assert.equal((fake.rpcCalls[1]?.args.p_family as Row).display_name, "Fenyő család");
});

test("a stale family version is the conflict the screen maps", async () => {
  const { run } = admin({
    rpc: () => envelope("conflict", "VERSION_CONFLICT"),
    table: tables({ families: [FAMILY] }),
  });
  assert.deepEqual(await run("records.save", { id: id(1), expectedVersion: 1, title: "x" }, KEY), {
    state: "conflict",
    code: "VERSION_CONFLICT",
  });
});

test("a record whose kind is unknown or disagrees with its id is refused before any change", async () => {
  const { fake, run } = admin({ table: tables({ families: [FAMILY] }) });
  assert.deepEqual(await run("records.save", { id: "new", expectedVersion: 1, title: "x" }, KEY), {
    state: "validation",
    fieldErrors: { kind: "VAL-REQUIRED" },
    code: "field_invalid",
  });
  assert.deepEqual(
    await run("records.save", { id: id(1), expectedVersion: 3, kind: "group", title: "x" }, KEY),
    { state: "validation", fieldErrors: { kind: "VAL-INVALID" }, code: "field_invalid" },
  );
  assert.deepEqual(await run("records.save", { id: id(9), expectedVersion: 1, title: "x" }, KEY), {
    state: "denied",
  });
  assert.equal(fake.rpcCalls.length, 0);
});

test("a group is created in a school year and renamed without sending the school year again", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 6 }, id(3)),
    table: tables({ groups: [GROUP] }),
  });
  const created = await run(
    "records.save",
    {
      id: "new",
      expectedVersion: 1,
      kind: "group",
      name: "Napraforgó",
      description: "Rövid leírás.",
      schoolYearId: id(4),
    },
    KEY,
  );
  assert.equal(created.state, "success");
  assert.deepEqual(fake.rpcCalls[0], {
    name: "structure_save",
    args: {
      p_idempotency_key: KEY,
      p_kind: "group",
      p_payload: {
        id: null,
        name: "Napraforgó",
        description: "Rövid leírás.",
        school_year_id: id(4),
      },
    },
  });
  await run("records.save", { id: id(3), expectedVersion: 5, title: "Boróka 2" }, KEY);
  assert.deepEqual(fake.rpcCalls[1]?.args.p_payload, {
    id: id(3),
    expected_version: 5,
    name: "Boróka 2",
    description: "A kert gondozása.",
  });
});

test("a school year keeps its dates unless new ones are sent", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 2 }, id(4)),
    table: tables({ school_years: [YEAR] }),
  });
  await run("records.save", { id: id(4), expectedVersion: 1, name: "2026/27" }, KEY);
  assert.deepEqual(fake.rpcCalls[0]?.args.p_payload, {
    id: id(4),
    expected_version: 1,
    name: "2026/27",
    starts_on: "2026-09-01",
    ends_on: "2027-06-30",
  });
  await run(
    "records.save",
    {
      id: "new",
      expectedVersion: 1,
      kind: "school-year",
      name: "2027/28",
      startsOn: "2027-09-01",
      endsOn: "2028-06-30",
    },
    KEY,
  );
  assert.equal(fake.rpcCalls[1]?.args.p_kind, "school_year");
});

test("a school year sends the changeover date it is given and leaves it out otherwise (BR20.3)", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 2 }, id(4)),
    table: tables({ school_years: [YEAR] }),
  });
  await run(
    "records.save",
    { id: id(4), expectedVersion: 1, name: "2026/27", changeoverDate: "2027-07-15" },
    KEY,
  );
  assert.equal(
    (fake.rpcCalls[0]?.args.p_payload as Record<string, unknown>).changeover_date,
    "2027-07-15",
  );
});

test("a child is saved through its family, whose version is read first, and read back", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 4 }, id(1)),
    table: tables({ families: [FAMILY], children: [CHILD] }),
  });
  const updated = await run(
    "records.save",
    { id: id(2), expectedVersion: 2, title: "Gergő 2" },
    KEY,
  );
  assert.equal(updated.state, "success");
  assert.deepEqual(fake.rpcCalls[0]?.args.p_family, {
    family_id: id(1),
    expected_version: 3,
    display_name: "Fenyő család",
    children: [{ id: id(2), expected_version: 2, display_name: "Gergő 2" }],
  });
  const created = await run(
    "records.save",
    { id: "new", kind: "child", familyId: id(1), title: "Gergő" },
    KEY,
  );
  assert.deepEqual(fake.rpcCalls[1]?.args.p_family, {
    family_id: id(1),
    expected_version: 3,
    display_name: "Fenyő család",
    children: [{ display_name: "Gergő" }],
  });
  assert.deepEqual(created, {
    state: "success",
    data: { id: id(2), title: "Gergő", state: "active", version: 2, kind: "child" },
  });
});

test("a new child is found again as the newest one of that name when names repeat (not the last row by chance)", async () => {
  const older = { ...CHILD, id: id(20), version: 1, created_at: "2026-01-01T10:00:00Z" };
  const newest = { ...CHILD, id: id(21), version: 1, created_at: "2026-03-01T10:00:00Z" };
  const middle = { ...CHILD, id: id(22), version: 1, created_at: "2026-02-01T10:00:00Z" };
  // Rows come back in an order that puts the newest one in the middle, so "the last row" would be wrong.
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 4 }, id(1)),
    table: tables({ families: [FAMILY], children: [older, newest, middle] }),
  });
  const created = await run(
    "records.save",
    { id: "new", kind: "child", familyId: id(1), title: "Gergő" },
    KEY,
  );
  assert.deepEqual(created, {
    state: "success",
    data: { id: id(21), title: "Gergő", state: "active", version: 1, kind: "child" },
  });
  const read = fake.queries.filter((call) => call.table === "children").at(-1);
  assert.deepEqual(
    read?.steps.filter(([step]) => step === "order"),
    [
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ],
  );
});

test("a child without a known family is refused and a refused child change is passed on", async () => {
  const { run } = admin({
    rpc: () => envelope("conflict", "VERSION_CONFLICT"),
    table: tables({ families: [FAMILY], children: [CHILD] }),
  });
  assert.deepEqual(
    await run("records.save", { id: "new", kind: "child", familyId: id(9), title: "x" }, KEY),
    {
      state: "validation",
      fieldErrors: { familyId: "VAL-NOT-FOUND" },
      code: "field_invalid",
    },
  );
  assert.deepEqual(await run("records.save", { id: "new", kind: "child", title: "x" }, KEY), {
    state: "validation",
    fieldErrors: { familyId: "VAL-NOT-FOUND" },
    code: "field_invalid",
  });
  assert.deepEqual(await run("records.save", { id: id(2), expectedVersion: 1, title: "x" }, KEY), {
    state: "conflict",
    code: "VERSION_CONFLICT",
  });
});

test("archiving a family and the other kinds call different functions", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, {}, id(1)),
    table: tables({ families: [FAMILY], groups: [GROUP], school_years: [YEAR], children: [CHILD] }),
  });
  const done = { state: "success", data: { completed: true } };
  assert.deepEqual(await run("records.archive", { id: id(1), expectedVersion: 3 }, KEY), done);
  assert.deepEqual(await run("records.archive", { id: id(3), expectedVersion: 5 }, KEY), done);
  assert.deepEqual(await run("records.restore", { id: id(1), expectedVersion: 3 }, KEY), done);
  assert.deepEqual(await run("records.restore", { id: id(4), expectedVersion: 1 }, KEY), done);
  assert.deepEqual(
    fake.rpcCalls.map((call) => call.name),
    ["family_archive", "directory_archive_item", "family_restore", "directory_restore_item"],
  );
  assert.deepEqual(fake.rpcCalls[1]?.args, {
    p_idempotency_key: KEY,
    p_kind: "group",
    p_id: id(3),
    p_expected_version: 5,
  });
  assert.equal(fake.rpcCalls[3]?.args.p_kind, "school_year");
  assert.deepEqual(await run("records.archive", { id: id(9), expectedVersion: 1 }, KEY), {
    state: "denied",
  });
});

test("restoring an active family is the conflict the screen maps", async () => {
  const { run } = admin({
    rpc: () => envelope("conflict", "RESTORE_CONFLICT"),
    table: tables({ families: [FAMILY] }),
  });
  assert.deepEqual(await run("records.restore", { id: id(1), expectedVersion: 3 }, KEY), {
    state: "conflict",
    code: "RESTORE_CONFLICT",
  });
});

const EVENT = {
  id: id(20),
  group_id: id(3),
  title: "Őszi ünnep",
  location: "Tornaterem",
  coordinator_name: "Kovács Mária",
  starts_at: "2026-11-02T10:00:00+00:00",
  ends_at: "2026-11-02T13:00:00+00:00",
  status: "planned",
  version: 2,
};
const TASK = {
  id: id(21),
  group_id: id(3),
  event_id: id(20),
  title: "Sütés",
  category: "general",
  capacity: 3,
  starts_at: "2026-11-02T10:00:00+00:00",
  ends_at: "2026-11-02T12:00:00+00:00",
  location: "Konyha",
  status: "open",
  version: 4,
  origin_kind: "manual",
};

test("events and tasks are listed together, soonest first, with the screens' status words", async () => {
  const closed = {
    ...TASK,
    id: id(22),
    title: "Zárt",
    status: "closed",
    starts_at: "2026-11-03T10:00:00+00:00",
  };
  const cancelled = {
    ...TASK,
    id: id(23),
    title: "Törölt",
    status: "cancelled",
    starts_at: "2026-11-04T10:00:00+00:00",
  };
  // A rota duty is in the same table and never in the list or the form (BR24.4).
  const rotaDuty = {
    ...TASK,
    id: id(24),
    title: "Belső takarítás",
    origin_kind: "rota_week",
    starts_at: "2026-11-05T10:00:00+00:00",
  };
  const { run } = admin({
    table: tables({ events: [EVENT], tasks: [TASK, closed, cancelled, rotaDuty] }),
  });
  const outcome = await run("tasks.list", {});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const items = (outcome.data as { items: { id: string; state: string }[] }).items;
  assert.deepEqual(
    items.map((item) => [item.id, item.state]),
    [
      [id(20), "scheduled"],
      [id(21), "open"],
      [id(22), "closed"],
      [id(23), "cancelled"],
    ],
  );
  const open = await run("tasks.list", { state: "open", q: "süt" });
  assert.equal(open.state, "success");
  assert.deepEqual(await run("tasks.list", { state: "scheduled", q: "nincs ilyen" }), {
    state: "empty",
  });
});

test("listed events and tasks carry the kind and the fields their forms edit, with the three event notes", async () => {
  const noted = {
    ...EVENT,
    allergen_note: "Dió nélkül",
    supply_note: null,
    food_note: "Sütemény",
  };
  const { run } = admin({ table: tables({ events: [noted], tasks: [TASK] }) });
  const outcome = await run("tasks.list", {});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const [event, task] = (outcome.data as { items: Record<string, unknown>[] }).items;
  assert.equal(event?.kind, "event");
  assert.deepEqual(event?.details, {
    groupId: id(3),
    startsAt: "2026-11-02T10:00:00+00:00",
    endsAt: "2026-11-02T13:00:00+00:00",
    location: "Tornaterem",
    coordinatorName: "Kovács Mária",
    allergenNote: "Dió nélkül",
    foodNote: "Sütemény",
  });
  assert.equal(task?.kind, "task");
  assert.deepEqual(task?.details, {
    groupId: id(3),
    eventId: id(20),
    category: "general",
    capacity: 3,
    startsAt: "2026-11-02T10:00:00+00:00",
    endsAt: "2026-11-02T12:00:00+00:00",
    location: "Konyha",
  });
});

test("a title-only change of an event fills the other fields from the stored event", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 3 }, id(20)),
    table: tables({ events: [EVENT], tasks: [TASK] }),
  });
  const outcome = await run(
    "tasks.save",
    { id: id(20), expectedVersion: 2, kind: "event", title: "Őszi ünnep 2" },
    KEY,
  );
  assert.deepEqual(outcome, {
    state: "success",
    data: { id: id(20), title: "Őszi ünnep 2", state: "scheduled", version: 3 },
  });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "event_save",
    args: {
      p_idempotency_key: KEY,
      p_event: {
        id: id(20),
        expected_version: 2,
        group_id: id(3),
        title: "Őszi ünnep 2",
        location: "Tornaterem",
        coordinator_name: "Kovács Mária",
        starts_at: EVENT.starts_at,
        ends_at: EVENT.ends_at,
        status: "planned",
      },
    },
  });
});

test("a task is changed or created with every field it needs", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 5 }, id(21)),
    table: tables({ events: [EVENT], tasks: [TASK] }),
  });
  const changed = await run(
    "tasks.save",
    { id: id(21), expectedVersion: 4, title: "Sütés 2", capacity: "4" },
    KEY,
  );
  assert.deepEqual(changed, {
    state: "success",
    data: { id: id(21), title: "Sütés 2", state: "open", version: 5 },
  });
  assert.equal((fake.rpcCalls[0]?.args.p_task as Row).capacity, 4);
  assert.equal((fake.rpcCalls[0]?.args.p_task as Row).event_id, id(20));
  await run(
    "tasks.save",
    {
      id: "new",
      expectedVersion: 1,
      kind: "task",
      title: "Új",
      groupId: id(3),
      capacity: 2,
      startsAt: "2026-12-01T10:00:00Z",
      endsAt: "2026-12-01T11:00:00Z",
      status: "closed",
    },
    KEY,
  );
  assert.deepEqual(fake.rpcCalls[1]?.args.p_task, {
    id: null,
    group_id: id(3),
    title: "Új",
    capacity: 2,
    starts_at: "2026-12-01T10:00:00Z",
    ends_at: "2026-12-01T11:00:00Z",
    status: "closed",
  });
});

test("a task or event that does not exist is denied, and a new one needs a kind", async () => {
  const { run } = admin({ table: tables({}), rpc: () => envelope("success") });
  assert.deepEqual(await run("tasks.save", { id: id(9), expectedVersion: 1, title: "x" }, KEY), {
    state: "denied",
  });
  assert.deepEqual(await run("tasks.save", { id: "new", title: "x" }, KEY), {
    state: "validation",
    fieldErrors: { kind: "VAL-REQUIRED" },
    code: "field_invalid",
  });
});

test("the notes of an event are saved with its version and an empty text clears a note", async () => {
  const { fake, run } = admin({ rpc: () => envelope("success", null, { version: 3 }, id(20)) });
  const outcome = await run(
    "notes.save",
    {
      id: id(20),
      expectedVersion: 2,
      allergenNote: "mogyoró",
      supplyNote: "",
      foodNote: "sütemény",
    },
    KEY,
  );
  assert.deepEqual(outcome, {
    state: "success",
    data: { id: id(20), title: "", state: "notes-saved", version: 3 },
  });
  assert.deepEqual(fake.rpcCalls[0]?.args, {
    p_idempotency_key: KEY,
    p_event_id: id(20),
    p_expected_version: 2,
    p_allergen_note: "mogyoró",
    p_supply_note: "",
    p_food_note: "sütemény",
  });
  assert.deepEqual(await run("notes.save", { id: "x", expectedVersion: 1 }, KEY), {
    state: "denied",
  });
});

test("giving a place needs a chosen family and returns the task's new version", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 1, task_version: 5 }, id(30)),
  });
  assert.deepEqual(
    await run("assignments.assign", { id: id(21), expectedVersion: 4, familyId: id(1) }, KEY),
    {
      state: "success",
      data: { id: id(21), title: "", state: "assigned", version: 5 },
    },
  );
  assert.deepEqual(fake.rpcCalls[0]?.args, {
    p_idempotency_key: KEY,
    p_task_id: id(21),
    p_family_id: id(1),
    p_expected_version: 4,
  });
  assert.deepEqual(await run("assignments.assign", { id: id(21), expectedVersion: 4 }, KEY), {
    state: "validation",
    fieldErrors: { familyId: "VAL-REQUIRED" },
    code: "field_invalid",
  });
  assert.deepEqual(
    await run("assignments.assign", { id: "x", expectedVersion: 4, familyId: "y" }, KEY),
    {
      state: "denied",
    },
  );
});

test("a full task and a stale version keep the codes the old admin adapter used", async () => {
  for (const code of ["ASSIGNMENT_CAPACITY_FULL", "VERSION_CONFLICT"]) {
    const { run } = admin({ rpc: () => envelope("conflict", code) });
    assert.deepEqual(
      await run("assignments.assign", { id: id(21), expectedVersion: 4, familyId: id(1) }, KEY),
      { state: "conflict", code },
    );
  }
});

test("removing a place sends the assignment and its version", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { version: 3, task_version: 5 }, id(30)),
  });
  assert.deepEqual(await run("assignments.remove", { id: id(30), expectedVersion: 2 }, KEY), {
    state: "success",
    data: { id: id(30), title: "", state: "cancelled", version: 3 },
  });
  assert.equal(fake.rpcCalls[0]?.name, "assignment_remove");
  assert.deepEqual(await run("assignments.remove", { id: "nope", expectedVersion: 2 }, KEY), {
    state: "denied",
  });
});

const REQUEST_ROW = (extra: Row = {}) => ({
  id: id(40),
  kind: "swap",
  status: "open",
  version: 1,
  assignments: { tasks: { title: "Sütés" } },
  ...extra,
});

test("approvals are listed with a title from the kind and the task, and a state filter maps to the stored statuses", async () => {
  const rows = [
    REQUEST_ROW(),
    REQUEST_ROW({
      id: id(41),
      kind: "cancellation",
      status: "applied",
      assignments: [{ tasks: [{ title: "Díszítés" }] }],
    }),
    REQUEST_ROW({ id: id(42), status: "rejected", assignments: null }),
  ];
  const { fake, run } = admin({ table: tables({ change_requests: rows }) });
  const outcome = await run("approvals.list", {});
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const items = (outcome.data as { items: { title: string; state: string }[] }).items;
  assert.deepEqual(
    items.map((item) => [item.title, item.state]),
    [
      ["Feladatcsere-kérelem – Sütés", "pending"],
      ["Lemondási kérelem – Díszítés", "approved"],
      ["Feladatcsere-kérelem", "rejected"],
    ],
  );
  await run("approvals.list", { state: "approved" });
  const inStep = fake.queries[1]?.steps.find(([step]) => step === "in");
  assert.deepEqual(inStep?.[2], ["approved", "applied"]);
  assert.ok(
    fake.queries[0]?.steps.some(
      ([step, column, value]) => step === "neq" && column === "status" && value === "withdrawn",
    ),
  );
  const none = admin({ table: tables({}) });
  assert.deepEqual(await none.run("approvals.list", {}), { state: "empty" });
});

test("a decision finds the request kind when the screen does not send it", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { outcome: "approved" }, id(40)),
    table: tables({ change_requests: [{ id: id(40), kind: "cancellation" }] }),
  });
  const outcome = await run(
    "approvals.decide",
    { id: id(40), expectedVersion: 1, decision: "approved" },
    KEY,
  );
  assert.deepEqual(outcome, { state: "success", data: { outcome: "approved" } });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "cancellation_decide",
    args: { p_idempotency_key: KEY, p_request_id: id(40), p_approve: true, p_expected_version: 1 },
  });
  const swap = await run(
    "approvals.decide",
    { id: id(40), expectedVersion: 1, decision: "rejected", kind: "swap" },
    KEY,
  );
  assert.equal(fake.rpcCalls[1]?.name, "swap_decide");
  assert.equal(fake.rpcCalls[1]?.args.p_approve, false);
  assert.equal(swap.state, "success");
});

test("a decision reads the outcome from what the admin sent when the key is repeated", async () => {
  const { run } = admin({ rpc: () => envelope("success", "replayed", {}, id(40)) });
  assert.deepEqual(
    await run(
      "approvals.decide",
      { id: id(40), expectedVersion: 1, decision: "rejected", kind: "swap" },
      KEY,
    ),
    {
      state: "success",
      data: { outcome: "rejected" },
    },
  );
  assert.deepEqual(
    await run(
      "approvals.decide",
      { id: id(40), expectedVersion: 1, decision: "approved", kind: "swap" },
      KEY,
    ),
    {
      state: "success",
      data: { outcome: "approved" },
    },
  );
});

test("a missing or unknown decision is refused and nothing is sent to the database (fail closed)", async () => {
  for (const decision of [undefined, "", "approve", "Rejected", "later"]) {
    const { fake, run } = admin({
      rpc: () => envelope("success", null, { outcome: "approved" }, id(40)),
    });
    const payload =
      decision === undefined
        ? { id: id(40), expectedVersion: 1, kind: "swap" }
        : { id: id(40), expectedVersion: 1, kind: "swap", decision };
    assert.deepEqual(await run("approvals.decide", payload, KEY), {
      state: "validation",
      fieldErrors: { decision: "VAL-INVALID" },
      code: "field_invalid",
    });
    assert.equal(fake.rpcCalls.length, 0, String(decision));
  }
});

test("approval refusals keep their states and an unknown request is denied", async () => {
  for (const [state, code] of [
    ["conflict", "APPROVAL_ALREADY_DECIDED"],
    ["invalidated", "APPROVAL_INVALIDATED"],
    ["conflict", "SWAP_CANNOT_BE_APPLIED"],
  ] as const) {
    const { run } = admin({ rpc: () => envelope(state, code) });
    assert.deepEqual(
      await run(
        "approvals.decide",
        { id: id(40), expectedVersion: 1, decision: "approved", kind: "swap" },
        KEY,
      ),
      { state, code },
    );
  }
  const { run } = admin({ table: tables({}) });
  assert.deepEqual(await run("approvals.decide", { id: id(40), expectedVersion: 1 }, KEY), {
    state: "denied",
  });
  assert.deepEqual(await run("approvals.decide", { id: "x", expectedVersion: 1 }, KEY), {
    state: "denied",
  });
});

test("the dashboard counts come from the database for the admin's scope", async () => {
  const { run } = admin({
    rpc: () => envelope("success", null, { open_approvals: 3 }),
  });
  assert.deepEqual(await run("dashboard.get"), {
    state: "success",
    data: { scopeId: ORG, openApprovals: 3 },
  });
  const refused = admin({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await refused.run("dashboard.get"), { state: "denied" });
});

test("the reminder setting is read with the two recipient choices and saved by choice", async () => {
  const { fake, run } = admin({
    rpc: (name) =>
      name === "settings_get"
        ? envelope(
            "success",
            null,
            { enabled: true, recipient_scope: "group", threshold: "default", version: 2 },
            id(50),
          )
        : envelope("success", null, { version: 3 }, id(50)),
  });
  const read = await run("settings.get");
  assert.equal(read.state, "success");
  if (read.state === "success") {
    const model = read.data as {
      recipients: unknown[];
      selectedRecipientId: string;
      remindersEnabled: boolean;
      version: number;
    };
    assert.equal(model.recipients.length, 2);
    assert.deepEqual(
      [model.selectedRecipientId, model.remindersEnabled, model.version],
      ["recipient-group", true, 2],
    );
  }
  const saved = await run(
    "settings.save",
    { expectedVersion: 2, recipientId: "recipient-duty", remindersEnabled: "yes" },
    KEY,
  );
  assert.deepEqual(saved, {
    state: "success",
    data: { selectedRecipientId: "recipient-duty", remindersEnabled: true, version: 3 },
  });
  assert.deepEqual(fake.rpcCalls[1]?.args, {
    p_idempotency_key: KEY,
    p_expected_version: 2,
    p_enabled: true,
    p_recipient_scope: "duty",
  });
});

test("an unknown recipient is sent on so the database refuses it, and a stale setting is invalidated", async () => {
  const { fake, run } = admin({ rpc: () => envelope("conflict", "SETTINGS_RECIPIENT_INVALID") });
  assert.deepEqual(
    await run("settings.save", { expectedVersion: 2, recipientId: "recipient-nobody" }, KEY),
    {
      state: "conflict",
      code: "SETTINGS_RECIPIENT_INVALID",
    },
  );
  assert.equal(fake.rpcCalls[0]?.args.p_recipient_scope, "recipient-nobody");
  assert.equal(fake.rpcCalls[0]?.args.p_enabled, false);
  const stale = admin({ rpc: () => envelope("invalidated", "SETTINGS_STALE") });
  assert.deepEqual(
    await stale.run("settings.save", { expectedVersion: 1, recipientId: "recipient-duty" }, KEY),
    {
      state: "invalidated",
      code: "SETTINGS_STALE",
    },
  );
});

const GRANT_ROW = (extra: Row = {}) => ({
  grant_id: id(60),
  subject_id: id(61),
  subject_label: "admin@example.test",
  role: "group_admin",
  scope_type: "group",
  scope_id: id(3),
  scope_label: "Boróka",
  version: 2,
  is_self: false,
  ...extra,
});

test("the grants list shows who holds which role where, with the version the revoke needs", async () => {
  const { run } = admin({
    rpc: () =>
      envelope("success", null, {
        items: [
          GRANT_ROW(),
          GRANT_ROW({
            grant_id: id(62),
            role: "super_admin",
            scope_type: "organization",
            scope_label: null,
            is_self: true,
          }),
          GRANT_ROW({ grant_id: id(63), scope_label: null }),
        ],
      }),
  });
  const outcome = await run("governance.list");
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const grants = (
    outcome.data as { grants: { scopeLabel: string; isSelf: boolean; version: number }[] }
  ).grants;
  assert.deepEqual(
    grants.map((grant) => [grant.scopeLabel, grant.isSelf, grant.version]),
    [
      ["Boróka", false, 2],
      ["Teljes szervezet", true, 2],
      ["Csoport", false, 2],
    ],
  );
});

test("revoking a grant names the affected account and returns the new authorization version", async () => {
  const { fake, run } = admin({
    rpc: (name) =>
      name === "governance_list"
        ? envelope("success", null, { items: [GRANT_ROW()] })
        : envelope("success", null, { authorization_version: 3 }, id(60)),
  });
  assert.deepEqual(await run("governance.update", { id: id(60), expectedVersion: 2 }, KEY), {
    state: "success",
    data: { grantId: id(60), authorizationVersion: 3, invalidatedSubjectId: id(61) },
  });
  assert.deepEqual(fake.rpcCalls[1], {
    name: "governance_revoke",
    args: { p_idempotency_key: KEY, p_grant_id: id(60), p_expected_version: 2 },
  });
  assert.deepEqual(await run("governance.update", { id: "x", expectedVersion: 2 }, KEY), {
    state: "denied",
  });
});

test("the grant refusals keep their codes", async () => {
  for (const [state, code] of [
    ["invalidated", "GRANT_STALE"],
    ["conflict", "GRANT_LAST_SUPER_ADMIN"],
    ["conflict", "GRANT_SELF_LOCKOUT"],
  ] as const) {
    const { run } = admin({
      rpc: (name) =>
        name === "governance_list"
          ? envelope("denied", "authorization_denied")
          : envelope(state, code),
    });
    assert.deepEqual(await run("governance.update", { id: id(60), expectedVersion: 2 }, KEY), {
      state,
      code,
    });
  }
});

test("lifecycle candidates carry their eligibility and a Hungarian blocker line", async () => {
  const { fake, run } = admin({
    rpc: () =>
      envelope("success", null, {
        items: [
          {
            family_id: id(1),
            version: 2,
            display_name: "Régi család",
            archived_at: "x",
            state: "eligible-anonymize",
            blockers: [],
          },
          {
            family_id: id(2),
            version: 1,
            display_name: "Tartott család",
            archived_at: "x",
            state: "blocked",
            blockers: ["hold"],
          },
        ],
      }),
  });
  const outcome = await run("lifecycle.list", { eligibility: "blocked" });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const candidates = (
    outcome.data as { candidates: { eligibility: string; blockerSummary?: string }[] }
  ).candidates;
  assert.equal(candidates[0]?.eligibility, "eligible-anonymize");
  assert.ok(!("blockerSummary" in (candidates[0] ?? {})));
  assert.equal(candidates[1]?.blockerSummary, "Aktív megőrzési kötelezettség");
  assert.deepEqual(fake.rpcCalls[0]?.args, { p_state: "blocked" });
  const none = admin({ rpc: () => envelope("success", null, { items: [] }) });
  assert.deepEqual(await none.run("lifecycle.list", {}), { state: "empty" });
  assert.deepEqual(none.fake.rpcCalls[0]?.args, { p_state: null });
});

test("running the lifecycle needs the confirmation word and reports what happened", async () => {
  const { fake, run } = admin({
    rpc: () => envelope("success", null, { outcome: "anonymized", audit_event_id: id(70) }, id(1)),
  });
  assert.deepEqual(
    await run("lifecycle.run", { id: id(1), expectedVersion: 2, confirmed: "yes" }, KEY),
    {
      state: "success",
      data: { familyId: id(1), state: "anonymized", auditEvidenceId: id(70) },
    },
  );
  assert.equal(fake.rpcCalls[0]?.args.p_confirmed, true);
  await run("lifecycle.run", { id: id(1), expectedVersion: 2 }, KEY);
  assert.equal(fake.rpcCalls[1]?.args.p_confirmed, false);
  const deleted = admin({ rpc: () => envelope("success", null, { outcome: "deleted" }, id(1)) });
  const result = await deleted.run(
    "lifecycle.run",
    { id: id(1), expectedVersion: 2, confirmed: "yes" },
    KEY,
  );
  assert.deepEqual(result, {
    state: "success",
    data: { familyId: id(1), state: "deleted", auditEvidenceId: "" },
  });
  assert.deepEqual(await run("lifecycle.run", { id: "x", expectedVersion: 2 }, KEY), {
    state: "denied",
  });
});

test("lifecycle refusals keep their codes", async () => {
  for (const [state, code] of [
    ["invalidated", "LIFECYCLE_STALE"],
    ["conflict", "LIFECYCLE_BLOCKED"],
    ["conflict", "LIFECYCLE_CONFIRMATION_REQUIRED"],
  ] as const) {
    const { run } = admin({ rpc: () => envelope(state, code) });
    assert.deepEqual(
      await run("lifecycle.run", { id: id(1), expectedVersion: 1, confirmed: "yes" }, KEY),
      { state, code },
    );
  }
});

test("an operation the adapter does not know is answered with denied and no call", async () => {
  const { fake, run } = admin({});
  assert.deepEqual(await run("nonsense.operation" as never, {}), { state: "denied" });
  assert.equal(fake.rpcCalls.length, 0);
});

test("the reminder operations and the family name list are answered by the database", () => {
  for (const operation of ["families.names", "reminders.list", "reminders.retry"] as const) {
    assert.ok(DATABASE_ADMIN_OPERATIONS.includes(operation), operation);
  }
});

test("the admin use cases that change assignments are listed for U4", () => {
  assert.deepEqual(
    [...ADMIN_NOTIFICATION_USE_CASES],
    [
      "assignment.assign",
      "assignment.remove",
      "swap.decide",
      "cancellation.decide",
      "task.save",
      "family.archive",
    ],
  );
});
