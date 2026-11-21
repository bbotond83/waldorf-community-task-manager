import assert from "node:assert/strict";
import test from "node:test";
import { envelope, failure, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { eventMessage } from "./copy.ts";
import { createEventPort } from "./events.ts";
import { RetryableDataFailure, TerminalDataFailure } from "./errors.ts";

const id = (n: number) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "event-key-0001";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createEventPort(fake.database) };
}

const eventRow = {
  id: id(1),
  title: "Őszi vásár",
  location: "Tornaterem",
  starts_at: "2026-11-02T14:00:00+00:00",
  ends_at: "2026-11-02T18:00:00+00:00",
  status: "planned",
  is_finished: false,
  is_open: true,
  group_id: id(2),
  group_name: "Kerti munkacsoport",
  is_summer: false,
  signup_deadline: "2026-10-30",
  notice_lead_days: 3,
  food_signup_on: true,
  tale: "Egyszer volt",
  version: 4,
};

/** One row of an event list: the event's own fields and the sign-up count and flag of the list reads. */
const listRow = { ...eventRow, signup_count: 0, is_signed_up: false };

test("a list row without its sign-up count or flag is malformed, never read as zero", async () => {
  const { port: events } = port({
    rpc: () =>
      envelope("success", null, { items: [eventRow], caller: { can_manage_community: false } }),
  });
  await assert.rejects(events.list({ past: false }), /UNEXPECTED_RESPONSE/);
});

const detailBody = {
  event: eventRow,
  notices: [
    { position: 1, text: "mogyoró" },
    { position: 2, text: "tej" },
  ],
  roles: [
    {
      id: id(10),
      name: "Szervező",
      kind: "parent",
      parent_id: id(30),
      display_name: "Fenyő Anna",
      is_organiser: true,
      version: 1,
    },
    {
      id: id(11),
      name: "Sütő",
      kind: "typed",
      parent_id: null,
      display_name: "Tóth Mária",
      is_organiser: false,
      version: 2,
    },
    {
      id: id(12),
      name: "Régi szerep",
      kind: "something-new",
      display_name: "korábbi tag",
      is_organiser: false,
      version: 1,
    },
  ],
  signups: [
    {
      id: id(20),
      parent_display_name: "Fenyő Anna",
      family_display_name: "Fenyő család",
      note: "Segítek",
      chosen_at: null,
      version: 1,
      is_own: true,
    },
  ],
  food: {
    on: true,
    categories: [
      {
        category: "bread",
        offers: [
          {
            id: id(40),
            parent_display_name: "Fenyő Anna",
            text: "Kenyér",
            has_milk: false,
            has_egg: true,
            has_garlic: false,
            version: 3,
            is_own: true,
          },
        ],
      },
      { category: "not-a-category", offers: [] },
    ],
  },
  caller: { can_manage: false, can_sign_up: true },
};

test("the event page carries every part of the document and drops unknown categories and kinds", async () => {
  const { port: events, fake } = port({
    rpc: () => envelope("success", null, detailBody, id(1)),
  });
  const outcome = await events.detail(id(1));
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const { data } = outcome;
  assert.equal(data.event.title, "Őszi vásár");
  assert.equal(data.event.signupDeadline, "2026-10-30");
  assert.equal(data.event.noticeLeadDays, 3);
  assert.equal(data.event.tale, "Egyszer volt");
  assert.equal(data.event.isOpen, true);
  assert.deepEqual(data.notices, ["mogyoró", "tej"]);
  assert.deepEqual(
    data.roles.map((role) => [role.kind, role.displayName, role.isOrganiser]),
    [
      ["parent", "Fenyő Anna", true],
      ["typed", "Tóth Mária", false],
      ["former", "korábbi tag", false],
    ],
  );
  assert.equal(data.roles[0]?.parentId, id(30));
  assert.equal(data.roles[1]?.parentId, undefined);
  assert.equal(data.signups[0]?.note, "Segítek");
  assert.equal(data.signups[0]?.chosenAt, undefined);
  assert.deepEqual(
    data.food.categories.map((entry) => entry.category),
    ["bread"],
  );
  assert.equal(data.food.categories[0]?.offers[0]?.hasEgg, true);
  assert.deepEqual(data.caller, { canManage: false, canSignUp: true });
  assert.ok(Object.isFrozen(data) && Object.isFrozen(data.roles[0]));
  assert.deepEqual(fake.rpcCalls[0], { name: "event_get", args: { p_event_id: id(1) } });
});

test("an event that is cancelled or has an unknown status reads as cancelled, not as planned", async () => {
  const { port: events } = port({
    rpc: () =>
      envelope("success", null, { ...detailBody, event: { ...eventRow, status: "weird" } }, id(1)),
  });
  const outcome = await events.detail(id(1));
  assert.ok(outcome.state === "success" && outcome.data.event.status === "cancelled");
});

test("the lists carry the caller's reach and read the optional fields only when present", async () => {
  const { port: events, fake } = port({
    rpc: () =>
      envelope("success", null, {
        items: [
          {
            ...listRow,
            location: null,
            group_id: null,
            group_name: null,
            status: "cancelled",
          },
          { ...listRow, signup_count: 3, is_signed_up: true },
        ],
        caller: { can_manage_community: true, managed_group_ids: [id(2), 7] },
      }),
  });
  const list = await events.list({ past: true });
  assert.equal(list.state, "success");
  if (list.state === "success") {
    assert.equal(list.data.canManageCommunity, true);
    assert.deepEqual(list.data.managedGroupIds, [id(2)]);
    assert.equal(list.data.items[0]?.status, "cancelled");
    assert.equal(list.data.items[0]?.location, undefined);
    assert.equal(list.data.items[0]?.groupId, undefined);
    assert.deepEqual(
      list.data.items.map((item) => [item.signupCount, item.isSignedUp]),
      [
        [0, false],
        [3, true],
      ],
    );
  }
  assert.deepEqual(fake.rpcCalls[0], { name: "event_list", args: { p_past: true } });

  const forGroup = port({
    rpc: () => envelope("success", null, { items: [listRow], caller: { can_manage: true } }, id(2)),
  });
  const groupList = await forGroup.port.listForGroup({ groupId: id(2), past: false });
  assert.ok(groupList.state === "success" && groupList.data.canManage === true);
  assert.deepEqual(forGroup.fake.rpcCalls[0], {
    name: "event_list_for_group",
    args: { p_group_id: id(2), p_past: false },
  });
});

test("an address that is not an identifier reads as denied without asking the database", async () => {
  const { port: events, fake } = port({ rpc: () => envelope("success") });
  assert.deepEqual(await events.detail("not-an-id"), { state: "denied" });
  assert.deepEqual(await events.listForGroup({ groupId: "x", past: false }), {
    state: "denied",
  });
  assert.deepEqual(await events.typedRoles({ subjectKind: "parent", subjectId: "x" }), {
    state: "denied",
  });
  assert.equal(fake.rpcCalls.length, 0);
});

test("a refusal stays a refusal: denied, conflict and the validation codes keep their words", async () => {
  const denied = port({ rpc: () => envelope("denied", "EVENT_UNAVAILABLE") });
  assert.deepEqual(await denied.port.detail(id(1)), { state: "denied" });

  const conflict = port({ rpc: () => envelope("conflict", "EVENT_CLOSED") });
  assert.deepEqual(await conflict.port.addSignup({ idempotencyKey: KEY, eventId: id(1) }), {
    state: "conflict",
    code: "EVENT_CLOSED",
  });

  const field = port({
    rpc: () => envelope("validation", "field_invalid", { field: "notices", reason: "too_many" }),
  });
  const refused = await field.port.saveNotices({
    idempotencyKey: KEY,
    eventId: id(1),
    expectedVersion: 1,
    notices: [],
  });
  assert.deepEqual(refused, {
    state: "validation",
    fieldErrors: { notices: "VAL-TOO-MANY" },
    code: "field_invalid",
  });
});

test("every command is one named function with the key and the version the screen saw", async () => {
  const { port: events, fake } = port({
    rpc: () => envelope("success", null, { version: 5 }, id(50)),
  });
  const change = { state: "success", data: { id: id(50), version: 5 } };
  assert.deepEqual(
    await events.saveNotices({
      idempotencyKey: KEY,
      eventId: id(1),
      expectedVersion: 4,
      notices: ["a"],
    }),
    change,
  );
  await events.saveTale({ idempotencyKey: KEY, eventId: id(1), expectedVersion: 4, tale: "t" });
  await events.saveRole({
    idempotencyKey: KEY,
    eventId: id(1),
    name: "Szervező",
    parentId: id(30),
    isOrganiser: true,
  });
  await events.saveRole({
    idempotencyKey: KEY,
    eventId: id(1),
    roleId: id(10),
    expectedVersion: 2,
    name: "Sütő",
    personName: "Tóth Mária",
    isOrganiser: false,
  });
  await events.removeRole({ idempotencyKey: KEY, roleId: id(10), expectedVersion: 2 });
  await events.clearRoleName({ idempotencyKey: KEY, roleId: id(10), expectedVersion: 2 });
  await events.addSignup({ idempotencyKey: KEY, eventId: id(1) });
  await events.changeSignup({
    idempotencyKey: KEY,
    signupId: id(20),
    expectedVersion: 1,
    note: "n",
    chosenAt: "2026-11-02T15:00:00+00:00",
  });
  await events.withdrawSignup({ idempotencyKey: KEY, signupId: id(20), expectedVersion: 1 });
  const offer = {
    category: "bread",
    text: "Kenyér",
    hasMilk: false,
    hasEgg: true,
    hasGarlic: false,
  };
  await events.addOffer({ idempotencyKey: KEY, eventId: id(1), ...offer });
  await events.changeOffer({ idempotencyKey: KEY, offerId: id(40), expectedVersion: 3, ...offer });
  await events.withdrawOffer({ idempotencyKey: KEY, offerId: id(40), expectedVersion: 3 });

  assert.deepEqual(
    fake.rpcCalls.map((call) => call.name),
    [
      "event_notices_save",
      "event_tale_save",
      "event_role_save",
      "event_role_save",
      "event_role_remove",
      "event_role_clear_name",
      "event_signup_add",
      "event_signup_change",
      "event_signup_withdraw",
      "food_offer_add",
      "food_offer_change",
      "food_offer_withdraw",
    ],
  );
  assert.deepEqual(fake.rpcCalls[0]?.args, {
    p_idempotency_key: KEY,
    p_event_id: id(1),
    p_expected_version: 4,
    p_notices: ["a"],
  });
  // A new role sends no role id and no version; a changed one sends both.
  assert.equal(fake.rpcCalls[2]?.args.p_role_id, null);
  assert.equal(fake.rpcCalls[2]?.args.p_expected_version, null);
  assert.equal(fake.rpcCalls[3]?.args.p_role_id, id(10));
  assert.equal(fake.rpcCalls[3]?.args.p_person_name, "Tóth Mária");
  assert.equal(fake.rpcCalls[3]?.args.p_parent_id, null);
  assert.equal(fake.rpcCalls[6]?.args.p_note, null);
  assert.equal(fake.rpcCalls[6]?.args.p_chosen_at, null);
  assert.deepEqual(fake.rpcCalls[9]?.args, {
    p_idempotency_key: KEY,
    p_event_id: id(1),
    p_category: "bread",
    p_text: "Kenyér",
    p_has_milk: false,
    p_has_egg: true,
    p_has_garlic: false,
  });
});

test("a change without a version in the answer reports none, and the typed names list reads its rows", async () => {
  const plain = port({ rpc: () => envelope("success", null, {}) });
  assert.deepEqual(
    await plain.port.removeRole({ idempotencyKey: KEY, roleId: id(10), expectedVersion: 2 }),
    { state: "success", data: { id: null, version: null } },
  );

  const typed = port({
    rpc: () =>
      envelope("success", null, {
        items: [
          {
            role_id: id(10),
            role_name: "Sütő",
            person_name: "Tóth Mária",
            version: 2,
            event_id: id(1),
            event_title: "Őszi vásár",
            starts_at: "2026-11-02T14:00:00+00:00",
          },
        ],
      }),
  });
  const outcome = await typed.port.typedRoles({ subjectKind: "family", subjectId: id(60) });
  assert.ok(outcome.state === "success" && outcome.data.items[0]?.personName === "Tóth Mária");
  assert.deepEqual(typed.fake.rpcCalls[0]?.args, {
    p_subject_kind: "family",
    p_subject_id: id(60),
  });
});

test("a lost connection and an unknown answer leave as the two typed failures", async () => {
  const lost = port({ rpc: () => failure("PGRST000", "down", 503) });
  await assert.rejects(() => lost.port.list({ past: false }), RetryableDataFailure);
  const odd = port({ rpc: () => envelope("surprise") });
  await assert.rejects(() => odd.port.detail(id(1)), TerminalDataFailure);
});

test("the words of each refusal are Hungarian, the access refusal reads as an unavailable event", () => {
  assert.equal(eventMessage({ state: "denied" }), "Ez az esemény nem érhető el.");
  assert.equal(
    eventMessage({ state: "conflict", code: "EVENT_CLOSED" }),
    "Erre az eseményre már lezárult a jelentkezés.",
  );
  for (const reason of ["VAL-ARCHIVED", "VAL-DATE-RANGE"]) {
    const text = eventMessage({ state: "validation", fieldErrors: { field: reason } });
    assert.doesNotMatch(text, /VAL-/, reason);
    assert.notEqual(text, "A művelet most nem hajtható végre.", reason);
  }
  for (const code of [
    "FOOD_SIGNUP_OFF",
    "EVENT_LIMIT_REACHED",
    "VERSION_CONFLICT",
    "ROLE_ORGANISER_NEEDS_ACCOUNT",
    "no_typed_name",
    "GROUP_UNAVAILABLE",
  ]) {
    const sentence = eventMessage({ state: "conflict", code });
    assert.match(sentence, /\.$/, code);
    assert.notEqual(sentence, eventMessage({ state: "conflict", code: "SOMETHING_NEW" }), code);
  }
  for (const reason of ["VAL-PERSON-INVALID", "VAL-TOO-MANY", "VAL-OUTSIDE-EVENT", "VAL-INVALID"]) {
    const sentence = eventMessage({ state: "validation", fieldErrors: { person: reason } });
    assert.notEqual(
      sentence,
      eventMessage({ state: "validation", fieldErrors: { person: "VAL-UNKNOWN" } }),
      reason,
    );
  }
  assert.equal(
    eventMessage({ state: "conflict" }),
    "A művelet most nem hajtható végre.",
    "an unknown refusal never shows raw text",
  );
});
