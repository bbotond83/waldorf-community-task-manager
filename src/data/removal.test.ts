import assert from "node:assert/strict";
import test from "node:test";
import { envelope, failure, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { RetryableDataFailure, TerminalDataFailure } from "./errors.ts";
import { DataGateway } from "./gateway.ts";
import {
  createRemovalPort,
  removeFamilyRecord,
  removeParentRecord,
  toRemovalSteps,
} from "./removal.ts";

const id = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "removal:abc-123";

function gateway(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  const calls = new DataGateway(fake.database);
  return { fake, gateway: calls, port: createRemovalPort(fake.database) };
}

const STEPS = [
  { block: "duties", to_clear: 2, to_flag: 3 },
  { block: "directory", to_clear: 4, to_flag: 0 },
];
const MAPPED_STEPS = [
  { block: "duties", toClear: 2, toFlag: 3 },
  { block: "directory", toClear: 4, toFlag: 0 },
];
const REPORT = {
  steps: STEPS,
  ended_account_ids: [id(91), id(92)],
  groups_left_without_coordinator: [{ group_id: id(5), name: "Kerti kör" }],
  audit_event_id: id(70),
};

test("both removal commands call their own function and return the whole report", async () => {
  for (const [kind, name, argument, remove] of [
    ["parent", "parent_remove", "p_parent_id", removeParentRecord],
    ["family", "family_archive", "p_family_id", removeFamilyRecord],
  ] as const) {
    const { fake, gateway: calls } = gateway({
      rpc: () => envelope("success", null, { ...REPORT, account_id: id(91) }, id(1)),
    });
    assert.deepEqual(await remove(calls, { idempotencyKey: KEY, id: id(1), expectedVersion: 3 }), {
      state: "success",
      data: {
        subject: { kind, id: id(1) },
        steps: MAPPED_STEPS,
        endedAccountIds: [id(91), id(92)],
        groupsLeftWithoutCoordinator: [{ groupId: id(5), groupName: "Kerti kör" }],
        auditEvidenceId: id(70),
      },
    });
    assert.deepEqual(fake.rpcCalls, [
      { name, args: { p_idempotency_key: KEY, [argument]: id(1), p_expected_version: 3 } },
    ]);
  }
});

test("a malformed subject, id or version never reaches the database", async () => {
  const { fake, gateway: calls, port } = gateway({ rpc: () => envelope("success") });
  for (const expectedVersion of [0, -1, 1.5, Number.NaN]) {
    assert.deepEqual(
      await removeFamilyRecord(calls, { idempotencyKey: KEY, id: id(1), expectedVersion }),
      {
        state: "validation",
        fieldErrors: { expectedVersion: "VAL-EXPECTED-VERSION" },
        code: "field_invalid",
      },
    );
  }
  assert.deepEqual(
    await removeParentRecord(calls, { idempotencyKey: KEY, id: "x", expectedVersion: 1 }),
    { state: "denied" },
  );
  for (const read of [port.preview, port.flaggedItems]) {
    assert.equal((await read({ kind: "child", id: id(1) })).state, "validation");
    assert.deepEqual(await read({ kind: "family", id: "1 or 1=1" }), { state: "denied" });
  }
  assert.equal(fake.rpcCalls.length, 0);
});

test("the refusals of the commands keep their codes, and a lost serialization is retryable", async () => {
  const input = { idempotencyKey: KEY, id: id(1), expectedVersion: 2 };
  for (const code of [
    "VERSION_CONFLICT",
    "PARENT_LAST_IN_FAMILY",
    "SELF_REMOVAL",
    "last_super_admin",
  ]) {
    const { gateway: calls } = gateway({ rpc: () => envelope("conflict", code) });
    assert.deepEqual(await removeParentRecord(calls, input), { state: "conflict", code });
  }
  const lost = gateway({ rpc: () => failure("40001") });
  await assert.rejects(removeFamilyRecord(lost.gateway, input), RetryableDataFailure);
});

test("the preview maps the counts, groups and refusal, with no other field", async () => {
  const preview = {
    subject: { kind: "family", id: id(1) },
    version: 4,
    steps: STEPS,
    totals: { to_clear: 6, to_flag: 3 },
    groups_left_without_coordinator: [],
    refusal: null,
    display_name: "not carried",
  };
  const { fake, port } = gateway({ rpc: () => envelope("success", null, preview, id(1)) });
  const data = {
    subject: { kind: "family", id: id(1) },
    version: 4,
    steps: MAPPED_STEPS,
    totals: { toClear: 6, toFlag: 3 },
    groupsLeftWithoutCoordinator: [],
  };
  assert.deepEqual(await port.preview({ kind: "family", id: id(1) }), { state: "success", data });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "removal_preview",
    args: { p_subject_kind: "family", p_subject_id: id(1) },
  });
  fake.handlers.rpc = () =>
    envelope("success", null, { ...preview, refusal: "SELF_REMOVAL" }, id(1));
  assert.deepEqual(await port.preview({ kind: "family", id: id(1) }), {
    state: "success",
    data: { ...data, refusal: "SELF_REMOVAL" },
  });
});

test("the flagged items keep their order; a date is left out when there is none, and an empty list is a success", async () => {
  const subject = { kind: "family", id: id(1) };
  const { fake, port } = gateway({
    rpc: () =>
      envelope(
        "success",
        null,
        {
          subject,
          items: [
            {
              kind: "future_place",
              item_id: id(2),
              label: "Belső takarítás",
              on_date: "2026-12-07",
              link: "/admin/tanev",
            },
            {
              kind: "family_schedule",
              item_id: id(3),
              label: "Törölközők mosása",
              on_date: null,
              link: `/admin/ismetlodo/${id(3)}`,
            },
          ],
        },
        id(1),
      ),
  });
  assert.deepEqual(await port.flaggedItems(subject), {
    state: "success",
    data: {
      subject,
      items: [
        {
          kind: "future_place",
          itemId: id(2),
          label: "Belső takarítás",
          onDate: "2026-12-07",
          link: "/admin/tanev",
        },
        {
          kind: "family_schedule",
          itemId: id(3),
          label: "Törölközők mosása",
          link: `/admin/ismetlodo/${id(3)}`,
        },
      ],
    },
  });
  assert.equal(fake.rpcCalls[0]!.name, "removal_flagged_items");
  fake.handlers.rpc = () => envelope("success", null, { subject, items: [] }, id(1));
  assert.deepEqual(await port.flaggedItems(subject), {
    state: "success",
    data: { subject, items: [] },
  });
  fake.handlers.rpc = () => envelope("denied", "authorization_denied");
  assert.deepEqual(await port.flaggedItems(subject), { state: "denied" });
});

test("an answer of the wrong shape is a terminal failure, never a guessed report", async () => {
  const input = { idempotencyKey: KEY, id: id(1), expectedVersion: 2 };
  for (const broken of [
    { ...REPORT, steps: undefined },
    { ...REPORT, ended_account_ids: ["not-an-id"] },
    { ...REPORT, ended_account_ids: null },
    { ...REPORT, audit_event_id: null },
  ]) {
    const { gateway: calls } = gateway({ rpc: () => envelope("success", null, broken, id(1)) });
    await assert.rejects(removeFamilyRecord(calls, input), TerminalDataFailure);
  }
  assert.throws(
    () => toRemovalSteps([{ block: "unknown", to_clear: 0, to_flag: 0 }]),
    TerminalDataFailure,
  );
});
