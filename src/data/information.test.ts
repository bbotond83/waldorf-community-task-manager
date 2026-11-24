import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { createInformationPort } from "./information.ts";

const id = (n: number) => `dddddddd-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "info-key-00001";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createInformationPort(fake.database) };
}

const section = {
  id: id(1),
  key: "kert",
  title: "Kert",
  body: "Szöveg **fontos**",
  owning_group_name: "Kert",
  season_months: [4, 5, 6],
  position: 2,
  hidden: false,
  version: 3,
  can_edit_text: true,
  can_edit_all: false,
};

test("the page is one function call and carries the sections with what the caller may change", async () => {
  const { port: info, fake } = port({
    rpc: () =>
      envelope("success", null, {
        can_manage: false,
        owner_group_names: ["Kert"],
        items: [section, { ...section, id: id(2), owning_group_name: null, season_months: null }],
      }),
  });
  const outcome = await info.list();
  assert.ok(outcome.state === "success");
  if (outcome.state !== "success") return;
  assert.deepEqual([outcome.data.canManage, outcome.data.ownerGroupNames], [false, ["Kert"]]);
  const [first, second] = outcome.data.items;
  assert.deepEqual(
    [
      first?.owningGroupName,
      first?.seasonMonths,
      first?.canEditText,
      first?.canEditAll,
      first?.version,
    ],
    ["Kert", [4, 5, 6], true, false, 3],
  );
  assert.deepEqual([second?.owningGroupName, second?.seasonMonths], [undefined, undefined]);
  assert.ok(Object.isFrozen(outcome.data) && Object.isFrozen(first));
  assert.deepEqual(fake.rpcCalls, [{ name: "info_sections_list", args: {} }]);
});

test("a page without owner names reads with an empty list of them", async () => {
  const { port: info } = port({
    rpc: () => envelope("success", null, { can_manage: true, items: [] }),
  });
  const outcome = await info.list();
  assert.deepEqual(outcome, {
    state: "success",
    data: { canManage: true, ownerGroupNames: [], items: [] },
  });
});

test("every command is one named function with the key and the version the editor saw", async () => {
  const { port: info, fake } = port({
    rpc: () => envelope("success", null, { version: 4 }, id(1)),
  });
  const fields = { title: "T", body: "B", position: 2 };
  const results = await Promise.all([
    info.update({
      idempotencyKey: KEY,
      sectionId: id(1),
      expectedVersion: 3,
      ...fields,
      owningGroupName: "Kert",
      seasonMonths: [4, 5],
    }),
    info.create({ idempotencyKey: KEY, ...fields }),
    info.setHidden({ idempotencyKey: KEY, sectionId: id(1), hidden: true, expectedVersion: 3 }),
  ]);
  assert.ok(
    results.every((r) => r.state === "success" && r.data.id === id(1) && r.data.version === 4),
  );
  assert.deepEqual(fake.rpcCalls[0], {
    name: "info_section_update",
    args: {
      p_idempotency_key: KEY,
      p_section_id: id(1),
      p_title: "T",
      p_body: "B",
      p_owning_group_name: "Kert",
      p_season_months: [4, 5],
      p_position: 2,
      p_expected_version: 3,
    },
  });
  assert.deepEqual(fake.rpcCalls[1], {
    name: "info_section_create",
    args: {
      p_idempotency_key: KEY,
      p_title: "T",
      p_body: "B",
      p_owning_group_name: null,
      p_season_months: null,
      p_position: 2,
    },
  });
  assert.deepEqual(fake.rpcCalls[2], {
    name: "info_section_set_hidden",
    args: { p_idempotency_key: KEY, p_section_id: id(1), p_hidden: true, p_expected_version: 3 },
  });
});

test("a replayed command reads as success with no new version", async () => {
  const { port: info } = port({ rpc: () => envelope("success", "replayed", {}, id(1)) });
  const outcome = await info.create({ idempotencyKey: KEY, title: "T", body: "B", position: 1 });
  assert.deepEqual(outcome, { state: "success", data: { id: id(1), version: null } });
});

test("each refusal keeps its state and code", async () => {
  for (const [state, code] of [
    ["conflict", "VERSION_CONFLICT"],
    ["denied", "authorization_denied"],
  ] as const) {
    const { port: info } = port({ rpc: () => envelope(state, code) });
    const outcome = await info.setHidden({
      idempotencyKey: KEY,
      sectionId: id(1),
      hidden: false,
      expectedVersion: 1,
    });
    assert.equal(outcome.state, state);
    if (outcome.state === "conflict") assert.equal(outcome.code, code);
  }
});

test("a section address that is not an identifier is denied without asking the database", async () => {
  const { port: info, fake } = port({ rpc: () => envelope("success", null, {}) });
  const fields = { title: "T", body: "B", position: 1 };
  assert.deepEqual(
    await info.update({ idempotencyKey: KEY, sectionId: "nope", expectedVersion: 1, ...fields }),
    { state: "denied" },
  );
  assert.deepEqual(
    await info.setHidden({
      idempotencyKey: KEY,
      sectionId: "nope",
      hidden: true,
      expectedVersion: 1,
    }),
    { state: "denied" },
  );
  assert.equal(fake.rpcCalls.length, 0);
});
