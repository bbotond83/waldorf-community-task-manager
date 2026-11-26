import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, ok, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { TerminalDataFailure } from "./errors.ts";
import { createDirectoryPort } from "./directory.ts";

const id = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createDirectoryPort(fake.database) };
}

const card = (extra: Record<string, unknown> = {}) => ({
  family_id: id(1),
  family_name: "Fenyő család",
  is_own_family: false,
  parents: [{ id: id(10), full_name: "Fenyő Anna" }],
  ...extra,
});

test("the directory carries exactly the fields the database sent and no others", async () => {
  const items = [
    card({
      is_own_family: true,
      children: [{ name: "Boróka" }],
      parents: [
        {
          id: id(10),
          full_name: "Fenyő Anna",
          email: "anna@example.test",
          phone: "+36 30 000 0000",
          residence: "Pécel",
          occupation: "Tanár",
          hobby: "Kertészet",
          how_i_support: "Sütés",
          sharing_consent: true,
          is_self: true,
        },
        { id: id(11), full_name: "Fenyő Béla" },
      ],
    }),
    card({
      family_id: id(2),
      family_name: "Tölgy család",
      parents: [{ id: id(12), full_name: "Tölgy Cili", has_account: false }],
    }),
  ];
  const { port: directory, fake } = port({ rpc: () => envelope("success", null, { items }) });
  const outcome = await directory.list();
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const [own, other] = outcome.data.families;
  assert.equal(own!.isOwnFamily, true);
  assert.deepEqual(own!.children, ["Boróka"]);
  assert.deepEqual(own!.parents[0], {
    id: id(10),
    fullName: "Fenyő Anna",
    isSelf: true,
    email: "anna@example.test",
    phone: "+36 30 000 0000",
    residence: "Pécel",
    occupation: "Tanár",
    hobby: "Kertészet",
    howISupport: "Sütés",
    sharingConsent: true,
  });
  // A parent with nothing shared has the name only: the model has no key for what was not sent.
  assert.deepEqual(own!.parents[1], { id: id(11), fullName: "Fenyő Béla", isSelf: false });
  assert.equal("children" in other!, false);
  assert.deepEqual(other!.parents[0], {
    id: id(12),
    fullName: "Tölgy Cili",
    isSelf: false,
    hasAccount: false,
  });
  assert.equal(fake.rpcCalls[0]!.name, "directory_list");
});

test("an empty directory, a refusal and a malformed answer map to their states", async () => {
  const empty = await port({ rpc: () => envelope("success", null, { items: [] }) }).port.list();
  assert.deepEqual(empty, { state: "empty" });
  const refused = await port({ rpc: () => envelope("denied", "authorization_denied") }).port.list();
  assert.deepEqual(refused, { state: "denied" });
  await assert.rejects(
    port({ rpc: () => envelope("success", null, { items: [{ family_id: 5 }] }) }).port.list(),
    TerminalDataFailure,
  );
});

test("the own profile is read from the table, and a parent with no row starts at version 1", async () => {
  const row = {
    parent_id: id(10),
    version: 3,
    email_on_record: "anna@example.test",
    phone: null,
    residence: "Pécel",
    occupation: null,
    hobby: null,
    how_i_support: null,
    sharing_consent: true,
  };
  const found = await port({ table: () => ok([row]) }).port.ownProfile(id(10));
  assert.deepEqual(found, {
    parentId: id(10),
    version: 3,
    sharingConsent: true,
    email: "anna@example.test",
    residence: "Pécel",
  });
  const none = await port({ table: () => ok([]) }).port.ownProfile(id(10));
  assert.deepEqual(none, { parentId: id(10), version: 1, sharingConsent: false });
});

test("sharing and profile changes send the key, the version and the fields, and map a stale version", async () => {
  const { port: directory, fake } = port({
    rpc: () => envelope("success", null, { version: 4 }, id(10)),
  });
  const shared = await directory.setSharing({
    idempotencyKey: "k1",
    parentId: id(10),
    expectedVersion: 3,
    sharing: true,
  });
  assert.deepEqual(shared, { state: "success", data: { id: id(10), version: 4 } });
  assert.deepEqual(fake.rpcCalls[0], {
    name: "profile_set_sharing",
    args: { p_idempotency_key: "k1", p_parent_id: id(10), p_expected_version: 3, p_sharing: true },
  });
  const saved = await directory.updateOwnProfile({
    idempotencyKey: "k2",
    parentId: id(10),
    expectedVersion: 4,
    fields: { hobby: "Kert", phone: null },
  });
  assert.equal(saved.state, "success");
  assert.deepEqual(fake.rpcCalls[1]!.args.p_fields, { hobby: "Kert", phone: null });

  const stale = await port({ rpc: () => envelope("conflict", "VERSION_CONFLICT") }).port.setSharing(
    {
      idempotencyKey: "k3",
      parentId: id(10),
      expectedVersion: 1,
      sharing: false,
    },
  );
  assert.deepEqual(stale, { state: "conflict", code: "VERSION_CONFLICT" });
});

test("a refused field keeps its code for the screen", async () => {
  const outcome = await port({
    rpc: () => envelope("validation", "PROFILE_FIELD_INVALID", { field: "phone" }),
  }).port.updateOwnProfile({
    idempotencyKey: "k",
    parentId: id(10),
    expectedVersion: 1,
    fields: { phone: "x" },
  });
  assert.equal(outcome.state, "validation");
  if (outcome.state === "validation") assert.equal(outcome.code, "PROFILE_FIELD_INVALID");
});

test("the admin changes send the database's field names and return the new version", async () => {
  const { port: directory, fake } = port({
    rpc: (name) =>
      name === "family_add"
        ? envelope("success", null, { version: 1 }, id(1))
        : envelope("success", null, { family_version: 2 }, id(11)),
  });
  const family = await directory.addFamily({
    idempotencyKey: "a",
    displayName: "Fenyő család",
    parents: [{ displayName: "Fenyő Anna", email: "anna@example.test", phone: "+36 30 000 0000" }],
    children: ["Boróka"],
  });
  assert.deepEqual(family, { state: "success", data: { id: id(1), version: 1 } });
  assert.deepEqual(fake.rpcCalls[0]!.args.p_family, {
    display_name: "Fenyő család",
    parents: [{ display_name: "Fenyő Anna", email: "anna@example.test", phone: "+36 30 000 0000" }],
    children: [{ display_name: "Boróka" }],
  });
  const added = await directory.addParent({
    idempotencyKey: "b",
    familyId: id(1),
    expectedVersion: 1,
    parent: { displayName: "Fenyő Béla", email: "bela@example.test" },
  });
  assert.deepEqual(added, { state: "success", data: { id: id(11), version: 2 } });
  assert.deepEqual(fake.rpcCalls[1]!.args.p_parent, {
    display_name: "Fenyő Béla",
    email: "bela@example.test",
  });
  await directory.editParent({
    idempotencyKey: "c",
    parentId: id(11),
    expectedVersion: 1,
    fields: { email: "uj@example.test" },
  });
  assert.deepEqual(fake.rpcCalls[2]!.args.p_fields, { email: "uj@example.test" });
});

test("removing a parent returns the report with the accounts whose sign-in the server must end", async () => {
  for (const accounts of [[id(99)], []]) {
    const outcome = await port({
      rpc: () =>
        envelope(
          "success",
          null,
          {
            steps: [],
            ended_account_ids: accounts,
            groups_left_without_coordinator: [],
            audit_event_id: id(70),
          },
          id(10),
        ),
    }).port.removeParent({ idempotencyKey: "r", parentId: id(10), expectedVersion: 2 });
    assert.deepEqual(outcome, {
      state: "success",
      data: {
        parentId: id(10),
        removal: {
          subject: { kind: "parent", id: id(10) },
          steps: [],
          endedAccountIds: accounts,
          groupsLeftWithoutCoordinator: [],
          auditEvidenceId: id(70),
        },
      },
    });
  }
  const last = await port({
    rpc: () => envelope("conflict", "PARENT_LAST_IN_FAMILY"),
  }).port.removeParent({
    idempotencyKey: "r",
    parentId: id(10),
    expectedVersion: 2,
  });
  assert.deepEqual(last, { state: "conflict", code: "PARENT_LAST_IN_FAMILY" });
});

test("every refusal code of the directory commands has a Hungarian message, and an unknown one a fallback", async () => {
  const { DIRECTORY_REFUSAL_MESSAGES, DIRECTORY_REFUSAL_FALLBACK, directoryRefusalMessage } =
    await import("./copy.ts");
  for (const code of [
    "VERSION_CONFLICT",
    "EMAIL_INVALID",
    "EMAIL_UNAVAILABLE",
    "EMAIL_RATE_LIMITED",
    "EMAIL_LINK_INVALID",
    "PARENT_LAST_IN_FAMILY",
    "PARENT_HAS_ACCOUNT",
    "INVITATION_BUSY",
    "PROFILE_FIELD_INVALID",
  ]) {
    assert.ok(DIRECTORY_REFUSAL_MESSAGES[code], code);
    assert.equal(directoryRefusalMessage(code), DIRECTORY_REFUSAL_MESSAGES[code]);
  }
  assert.equal(directoryRefusalMessage("SOMETHING_NEW"), DIRECTORY_REFUSAL_FALLBACK);
  assert.equal(directoryRefusalMessage(undefined), DIRECTORY_REFUSAL_FALLBACK);
});
