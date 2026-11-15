import assert from "node:assert/strict";
import test from "node:test";
import { envelope, failure, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { workingGroupMessage, type WorkingGroupAction } from "./copy.ts";
import { RetryableDataFailure, TerminalDataFailure } from "./errors.ts";
import { createWorkingGroupPort } from "./working-groups.ts";

const id = (n: number) => `dddddddd-0000-4000-8000-${String(n).padStart(12, "0")}`;

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createWorkingGroupPort(fake.database) };
}

const group = {
  id: id(1),
  name: "Kerti munkacsoport",
  description: "A kert gondozása.",
  school_year_id: id(2),
  school_year_name: "2026-2027",
};

const detailBody = (members: unknown[], extra: Record<string, unknown> = {}) => ({
  group,
  has_coordinator: true,
  caller_is_parent: true,
  own_membership: { id: id(10), version: 2 },
  members,
  ...extra,
});

test("the group page carries the fields the database sent, the caller's membership and no others", async () => {
  const members = [
    {
      membership_id: id(10),
      parent_id: id(20),
      full_name: "Fenyő Anna",
      is_coordinator: true,
      is_self: true,
      email: "anna@example.test",
      phone: "+36 30 000 0000",
    },
    {
      membership_id: id(11),
      parent_id: id(21),
      full_name: "Tölgy Béla",
      is_coordinator: false,
      is_self: false,
    },
  ];
  const { port: groups, fake } = port({
    rpc: () => envelope("success", null, detailBody(members), id(1)),
  });
  const outcome = await groups.detail(id(1));
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.deepEqual(outcome.data.group, {
    id: id(1),
    name: "Kerti munkacsoport",
    description: "A kert gondozása.",
    schoolYearId: id(2),
    schoolYearName: "2026-2027",
  });
  assert.deepEqual(outcome.data.ownMembership, { id: id(10), version: 2 });
  assert.equal(outcome.data.hasCoordinator, true);
  assert.equal(outcome.data.callerIsParent, true);
  assert.deepEqual(outcome.data.members[0], {
    membershipId: id(10),
    parentId: id(20),
    fullName: "Fenyő Anna",
    isCoordinator: true,
    isSelf: true,
    email: "anna@example.test",
    phone: "+36 30 000 0000",
  });
  assert.deepEqual(fake.rpcCalls[0], { name: "working_group_detail", args: { p_group_id: id(1) } });
});

test("a phone and an address the database withheld are absent from the view model, not blank", async () => {
  const withheld = {
    membership_id: id(11),
    parent_id: id(21),
    full_name: "Tölgy Béla",
    is_coordinator: false,
    is_self: false,
    email: null,
    phone: null,
  };
  const outcome = await port({
    rpc: () => envelope("success", null, detailBody([withheld], { own_membership: null })),
  }).port.detail(id(1));
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const [member] = outcome.data.members;
  assert.equal("email" in member!, false);
  assert.equal("phone" in member!, false);
  assert.equal("version" in member!, false);
  assert.equal(outcome.data.ownMembership, null);
  assert.doesNotMatch(JSON.stringify(outcome.data), /example\.test|\+36/);
});

test("a super admin's rows carry the membership version they need to appoint or revoke", async () => {
  const row = {
    membership_id: id(11),
    parent_id: id(21),
    full_name: "Tölgy Béla",
    is_coordinator: false,
    is_self: false,
    version: 4,
  };
  const outcome = await port({
    rpc: () => envelope("success", null, detailBody([row], { caller_is_parent: false })),
  }).port.detail(id(1));
  assert.equal(outcome.state, "success");
  if (outcome.state === "success") {
    assert.equal(outcome.data.members[0]!.version, 4);
    assert.equal(outcome.data.callerIsParent, false);
  }
});

test("an address that is not an identifier reads as a missing group and never reaches the database", async () => {
  const { port: groups, fake } = port({
    rpc: () => envelope("success", null, detailBody([]), id(1)),
  });
  for (const address of ["nincs-ilyen", "", "../x", "1; drop table groups"]) {
    assert.deepEqual(await groups.detail(address), { state: "denied" });
  }
  assert.equal(fake.rpcCalls.length, 0);
});

test("an unavailable group and a refused caller read as denied, and a malformed page is terminal", async () => {
  const gone = await port({ rpc: () => envelope("denied", "GROUP_UNAVAILABLE") }).port.detail(
    id(1),
  );
  assert.deepEqual(gone, { state: "denied" });
  await assert.rejects(
    port({ rpc: () => envelope("success", null, { group: { id: 5 } }) }).port.detail(id(1)),
    TerminalDataFailure,
  );
  await assert.rejects(
    port({
      rpc: () => envelope("success", null, detailBody([{ membership_id: id(1), full_name: 7 }])),
    }).port.detail(id(1)),
    TerminalDataFailure,
  );
});

test("the list still turns an empty answer into the empty state and keeps a refusal a refusal", async () => {
  const empty = await port({ rpc: () => envelope("success", null, { items: [] }) }).port.list();
  assert.deepEqual(empty, { state: "empty" });
  const refused = await port({ rpc: () => envelope("denied", "authorization_denied") }).port.list();
  assert.deepEqual(refused, { state: "denied" });
  const listed = await port({
    rpc: () => envelope("success", null, { items: [group] }),
  }).port.list();
  assert.equal(listed.state, "success");
});

test("each command sends its function name, the key and the version the screen saw", async () => {
  const { port: groups, fake } = port({
    rpc: () => envelope("success", null, { version: 3 }, id(10)),
  });
  const joined = await groups.join({ idempotencyKey: "k-join", groupId: id(1) });
  assert.deepEqual(joined, {
    state: "success",
    data: { membershipId: id(10), version: 3, alreadyMember: false },
  });
  await groups.leave({ idempotencyKey: "k-leave", membershipId: id(10), expectedVersion: 2 });
  await groups.appoint({ idempotencyKey: "k-appoint", membershipId: id(11), expectedVersion: 1 });
  await groups.revoke({ idempotencyKey: "k-revoke", membershipId: id(11), expectedVersion: 5 });
  assert.deepEqual(fake.rpcCalls, [
    { name: "working_group_join", args: { p_idempotency_key: "k-join", p_group_id: id(1) } },
    {
      name: "working_group_leave",
      args: { p_idempotency_key: "k-leave", p_membership_id: id(10), p_expected_version: 2 },
    },
    {
      name: "coordinator_appoint",
      args: { p_idempotency_key: "k-appoint", p_membership_id: id(11), p_expected_version: 1 },
    },
    {
      name: "coordinator_revoke",
      args: { p_idempotency_key: "k-revoke", p_membership_id: id(11), p_expected_version: 5 },
    },
  ]);
});

test("a repeated join is a success that says the parent was already a member", async () => {
  const outcome = await port({
    rpc: () => envelope("success", "ALREADY_MEMBER", { version: 1 }, id(10)),
  }).port.join({ idempotencyKey: "k", groupId: id(1) });
  assert.deepEqual(outcome, {
    state: "success",
    data: { membershipId: id(10), version: 1, alreadyMember: true },
  });
  const noVersion = await port({
    rpc: () => envelope("success", null, {}, id(10)),
  }).port.leave({ idempotencyKey: "k", membershipId: id(10), expectedVersion: 1 });
  assert.deepEqual(noVersion, {
    state: "success",
    data: { membershipId: id(10), version: null, alreadyMember: false },
  });
});

const REFUSALS: readonly {
  action: WorkingGroupAction;
  state: "conflict" | "validation" | "denied";
  code: string | null;
  text: string;
}[] = [
  {
    action: "leave",
    state: "conflict",
    code: "NOT_A_MEMBER",
    text: "Már nem vagy tagja ennek a csoportnak.",
  },
  {
    action: "appoint",
    state: "validation",
    code: "NOT_A_MEMBER",
    text: "Koordinátor csak a csoport tagja lehet. Kérd meg a szülőt, hogy előbb csatlakozzon a csoporthoz.",
  },
  {
    action: "revoke",
    state: "conflict",
    code: "NOT_A_MEMBER",
    text: "Ő már nem tagja ennek a csoportnak.",
  },
  {
    action: "appoint",
    state: "conflict",
    code: "ALREADY_COORDINATOR",
    text: "Ő már koordinátora ennek a csoportnak.",
  },
  {
    action: "revoke",
    state: "conflict",
    code: "NOT_COORDINATOR",
    text: "Ő már nem koordinátora ennek a csoportnak.",
  },
  {
    action: "appoint",
    state: "validation",
    code: "ACCOUNT_REQUIRED",
    text: "Csak aktív fiókkal rendelkező szülő lehet koordinátor.",
  },
  {
    action: "leave",
    state: "conflict",
    code: "VERSION_CONFLICT",
    text: "Az oldal közben megváltozott. Frissítsd, és próbáld újra.",
  },
  {
    action: "appoint",
    state: "denied",
    code: "GROUP_UNAVAILABLE",
    text: "Ez a munkacsoport nem érhető el.",
  },
];

test("every refusal code of the rules table keeps its code through the port and reads as its own text", async () => {
  for (const refusal of REFUSALS) {
    const { port: groups } = port({ rpc: () => envelope(refusal.state, refusal.code) });
    const command = {
      idempotencyKey: "k",
      membershipId: id(10),
      expectedVersion: 1,
    };
    const outcome =
      refusal.action === "appoint"
        ? await groups.appoint(command)
        : refusal.action === "revoke"
          ? await groups.revoke(command)
          : await groups.leave(command);
    assert.equal(outcome.state, refusal.state, `${refusal.action} ${refusal.code}`);
    const code = "code" in outcome ? outcome.code : undefined;
    if (refusal.state !== "denied") assert.equal(code, refusal.code);
    assert.equal(
      workingGroupMessage(refusal.action, { state: outcome.state, code }),
      refusal.text,
      `${refusal.action} ${refusal.code}`,
    );
  }
});

test("the repeated join reads as its note, and an unknown code never shows its raw text", () => {
  assert.equal(
    workingGroupMessage("join", { state: "success", code: "ALREADY_MEMBER" }),
    "Már tagja vagy ennek a csoportnak.",
  );
  const fallback = workingGroupMessage("join", { state: "conflict", code: "SOMETHING_NEW" });
  assert.equal(fallback, "A művelet most nem hajtható végre.");
  assert.equal(workingGroupMessage("join", { state: "conflict" }), fallback);
  assert.equal(
    workingGroupMessage("join", { state: "validation", code: "NOT_A_MEMBER" }),
    fallback,
  );
});

test("a refused key reaches the screen as a validation with its field, never as database text", async () => {
  const outcome = await port({
    rpc: () => envelope("validation", "idempotency_key_invalid"),
  }).port.join({ idempotencyKey: "x", groupId: id(1) });
  assert.deepEqual(outcome, {
    state: "validation",
    fieldErrors: { idempotencyKey: "VAL-IDEMPOTENCY-KEY" },
    code: "idempotency_key_invalid",
  });
});

test("an unexpected database failure leaves the port as a typed failure with no database text", async () => {
  const lost = port({ rpc: () => failure("08006", "connection failure") }).port;
  await assert.rejects(lost.join({ idempotencyKey: "k", groupId: id(1) }), RetryableDataFailure);
  await assert.rejects(lost.detail(id(1)), RetryableDataFailure);
  const broken = port({ rpc: () => failure("XX000", "secret table detail") }).port;
  for (const run of [
    () => broken.leave({ idempotencyKey: "k", membershipId: id(10), expectedVersion: 1 }),
    () => broken.appoint({ idempotencyKey: "k", membershipId: id(10), expectedVersion: 1 }),
    () => broken.revoke({ idempotencyKey: "k", membershipId: id(10), expectedVersion: 1 }),
  ]) {
    await assert.rejects(run(), (error) => {
      assert.ok(error instanceof TerminalDataFailure);
      assert.doesNotMatch(String(error), /secret/);
      return true;
    });
  }
  await assert.rejects(
    port({ rpc: () => envelope("surprise") }).port.join({ idempotencyKey: "k", groupId: id(1) }),
    TerminalDataFailure,
  );
});
