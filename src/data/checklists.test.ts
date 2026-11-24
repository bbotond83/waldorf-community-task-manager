import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { checklistMessage } from "./copy.ts";
import { createChecklistPort } from "./checklists.ts";

const id = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "checklist-key-0001";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createChecklistPort(fake.database) };
}

const task = {
  id: id(10),
  position: 1,
  title: "Székek bevitele",
  place: "Terem",
  props: null,
  priority: 2,
  materials: null,
  tip: "Hozz létrát",
  deadline: null,
  summer_only: false,
  helpers_needed: 2,
  helpers_taken: 1,
  time_matters: true,
  source_ref: "todo:1",
  version: 3,
  done: { at: "2026-11-02T10:00:00+00:00", by_display_name: "Fenyő Anna", is_own: true },
  claims: [
    {
      id: id(20),
      version: 1,
      parent_display_name: "Fenyő Anna",
      family_display_name: "Fenyő család",
      typed_name: null,
      note: "két szék",
      chosen_at: "2026-11-02T09:00:00+00:00",
      outside_event: false,
      is_own: true,
      can_remove: true,
    },
    {
      id: id(21),
      version: 2,
      parent_display_name: null,
      family_display_name: null,
      typed_name: "Vendég Vince",
      note: null,
      chosen_at: null,
      outside_event: true,
      is_own: false,
      can_remove: false,
    },
  ],
  can: { claim: false, mark_done: true, undo_done: true },
};
const plainTask = {
  ...task,
  id: id(11),
  place: null,
  tip: null,
  priority: null,
  source_ref: null,
  done: null,
  claims: [],
};
const item = {
  event_id: id(1),
  event_title: "Őszi vásár",
  checklist_version: 5,
  copied_from_template_id: id(40),
  is_empty: false,
  is_open: true,
  is_finished: false,
  is_cancelled: false,
  is_summer: true,
  signup_deadline: "2026-10-30",
  all_done: false,
  sections: [
    {
      id: id(30),
      position: 1,
      title: "Szülők",
      kind: "parents",
      version: 1,
      tasks: [task, plainTask],
    },
    { id: id(31), position: 2, title: "Új", kind: "something-else", version: 1, tasks: [] },
  ],
  caller: { in_team: true, can_manage: false, can_claim_tasks: true },
};

test("a checklist reads in one document: sections, tasks, claims, done marks and what the caller may do", async () => {
  const { port: checklists, fake } = port({
    rpc: () => envelope("success", null, { item }, id(1)),
  });
  const outcome = await checklists.checklist(id(1));
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const model = outcome.data;
  assert.deepEqual(fake.rpcCalls[0], { name: "checklist_get", args: { p_event_id: id(1) } });
  assert.deepEqual(
    [model.checklistVersion, model.allDone, model.copiedFromTemplateId],
    [5, false, id(40)],
  );
  assert.equal(model.sections[1]!.kind, "parents", "an unknown kind reads as the parents' kind");
  const first = model.sections[0]!.tasks[0]!;
  assert.deepEqual(
    [first.title, first.helpersTaken, first.done?.byDisplayName, first.can.markDone],
    ["Székek bevitele", 1, "Fenyő Anna", true],
  );
  assert.deepEqual(
    [first.claims[0]!.parentDisplayName, first.claims[1]!.typedName, first.claims[1]!.outsideEvent],
    ["Fenyő Anna", "Vendég Vince", true],
  );
  const plain = model.sections[0]!.tasks[1]!;
  assert.deepEqual(
    [plain.place, plain.priority, plain.sourceRef, plain.done],
    [undefined, undefined, undefined, undefined],
  );
  assert.deepEqual(model.caller, { inTeam: true, canManage: false, canClaimTasks: true });
  const plainItem = {
    ...item,
    all_done: null,
    copied_from_template_id: null,
    signup_deadline: null,
    sections: [],
  };
  const empty = await port({
    rpc: () => envelope("success", null, { item: plainItem }),
  }).port.checklist(id(1));
  assert.ok(
    empty.state === "success" &&
      empty.data.allDone === undefined &&
      empty.data.signupDeadline === undefined,
  );
});

test("a task without its helper count is malformed, never read as zero", async () => {
  const broken = {
    ...item,
    sections: [{ ...item.sections[0]!, tasks: [{ ...task, helpers_needed: undefined }] }],
  };
  const { port: checklists } = port({ rpc: () => envelope("success", null, { item: broken }) });
  await assert.rejects(checklists.checklist(id(1)), /UNEXPECTED_RESPONSE/);
});

test("templates read as a list, one template and the options for a group", async () => {
  const list = port({
    rpc: () =>
      envelope("success", null, {
        items: [
          {
            id: id(40),
            name: "Karácsony",
            working_group_id: null,
            group_name: null,
            task_count: 12,
            status: "active",
            version: 2,
          },
          {
            id: id(41),
            name: "Régi",
            working_group_id: id(2),
            group_name: "Kert",
            task_count: 0,
            status: "removed",
            version: 1,
          },
        ],
        caller: { can_manage_community: true, managed_group_ids: [id(2), 7] },
      }),
  });
  const listed = await list.port.templates();
  assert.ok(listed.state === "success");
  if (listed.state === "success") {
    assert.deepEqual(
      listed.data.items.map((row) => row.status),
      ["active", "removed"],
    );
    assert.deepEqual(
      [listed.data.canManageCommunity, listed.data.managedGroupIds],
      [true, [id(2)]],
    );
  }
  assert.deepEqual(list.fake.rpcCalls[0], { name: "template_list_admin", args: {} });
  await list.port.templatesForGroup(id(2));
  assert.deepEqual(list.fake.rpcCalls[1], { name: "template_list", args: { p_group_id: id(2) } });

  const one = port({
    rpc: () =>
      envelope("success", null, {
        item: {
          id: id(40),
          working_group_id: id(2),
          working_group_name: "Kert",
          name: "Karácsony",
          description: "Leírás",
          default_lead_days: 14,
          is_removed: false,
          version: 3,
          sections: [
            {
              id: id(50),
              position: 1,
              title: "Szülők",
              kind: "organisers",
              tasks: [
                {
                  id: id(60),
                  position: 1,
                  title: "Fa",
                  place: null,
                  props: null,
                  priority: 1,
                  materials: "szög",
                  tip: null,
                  summer_only: true,
                  helpers_needed: 3,
                  time_matters: false,
                },
              ],
            },
          ],
        },
      }),
  });
  const template = await one.port.template(id(40));
  assert.ok(template.state === "success");
  if (template.state === "success") {
    assert.deepEqual(
      [
        template.data.name,
        template.data.defaultLeadDays,
        template.data.sections[0]!.kind,
        template.data.sections[0]!.tasks[0]!.summerOnly,
      ],
      ["Karácsony", 14, "organisers", true],
    );
  }

  const options = port({
    rpc: () =>
      envelope("success", null, {
        items: [
          {
            id: id(40),
            name: "Karácsony",
            default_lead_days: 14,
            working_group_id: null,
            has_summer_tasks: true,
          },
        ],
      }),
  });
  const chosen = await options.port.templateOptions();
  assert.ok(chosen.state === "success" && chosen.data.items[0]!.hasSummerTasks === true);
  assert.deepEqual(options.fake.rpcCalls[0], {
    name: "template_options",
    args: { p_group_id: null },
  });
  await options.port.templateOptions(id(2));
  assert.deepEqual(options.fake.rpcCalls[1], {
    name: "template_options",
    args: { p_group_id: id(2) },
  });
});

test("an address that is not an identifier reads as denied without asking the database", async () => {
  const { port: checklists, fake } = port({ rpc: () => envelope("success") });
  assert.deepEqual(await checklists.checklist("x"), { state: "denied" });
  assert.deepEqual(await checklists.template("x"), { state: "denied" });
  assert.deepEqual(await checklists.templatesForGroup("x"), { state: "denied" });
  assert.deepEqual(await checklists.templateOptions("x"), { state: "denied" });
  assert.equal(fake.rpcCalls.length, 0);
});

test("every command is one named function with the key, the row and the version the screen saw", async () => {
  const { port: checklists, fake } = port({
    rpc: () => envelope("success", null, { version: 4 }, id(9)),
  });
  const results = await Promise.all([
    checklists.saveTemplate({ idempotencyKey: KEY, template: { name: "N" } }),
    checklists.setTemplateRemoved({
      idempotencyKey: KEY,
      templateId: id(40),
      removed: true,
      expectedVersion: 2,
    }),
    checklists.copyTemplate({ idempotencyKey: KEY, eventId: id(1), templateId: id(40) }),
    checklists.saveSection({
      idempotencyKey: KEY,
      eventId: id(1),
      expectedChecklistVersion: 5,
      section: { title: "S" },
    }),
    checklists.removeSection({
      idempotencyKey: KEY,
      sectionId: id(30),
      expectedChecklistVersion: 5,
    }),
    checklists.saveTask({
      idempotencyKey: KEY,
      eventId: id(1),
      expectedChecklistVersion: 5,
      task: { title: "T" },
    }),
    checklists.removeTask({ idempotencyKey: KEY, taskId: id(10), expectedChecklistVersion: 5 }),
    checklists.reorder({
      idempotencyKey: KEY,
      eventId: id(1),
      expectedChecklistVersion: 5,
      order: { sections: [] },
    }),
    checklists.claim({
      idempotencyKey: KEY,
      taskId: id(10),
      note: "n",
      chosenAt: "2026-11-02T09:00:00+00:00",
    }),
    checklists.claim({ idempotencyKey: KEY, taskId: id(10) }),
    checklists.claimTyped({ idempotencyKey: KEY, taskId: id(10), name: "Vince" }),
    checklists.changeClaim({
      idempotencyKey: KEY,
      claimId: id(20),
      expectedVersion: 1,
      note: "új",
    }),
    checklists.withdrawClaim({ idempotencyKey: KEY, claimId: id(20), expectedVersion: 1 }),
    checklists.markDone({ idempotencyKey: KEY, taskId: id(10), expectedVersion: 3 }),
    checklists.undoDone({ idempotencyKey: KEY, taskId: id(10), expectedVersion: 4 }),
  ]);
  assert.ok(
    results.every(
      (result) =>
        result.state === "success" && result.data.id === id(9) && result.data.version === 4,
    ),
  );
  assert.deepEqual(fake.rpcCalls.map((call) => call.name).sort(), [
    "checklist_claim",
    "checklist_claim",
    "checklist_claim_change",
    "checklist_claim_typed",
    "checklist_claim_withdraw",
    "checklist_copy_template",
    "checklist_reorder",
    "checklist_section_remove",
    "checklist_section_save",
    "checklist_task_mark_done",
    "checklist_task_remove",
    "checklist_task_save",
    "checklist_task_undo_done",
    "template_save",
    "template_set_removed",
  ]);
  const claimCall = fake.rpcCalls.find(
    (call) => call.name === "checklist_claim" && call.args.p_note === "n",
  )!;
  assert.deepEqual(claimCall.args, {
    p_idempotency_key: KEY,
    p_task_id: id(10),
    p_note: "n",
    p_chosen_at: "2026-11-02T09:00:00+00:00",
  });
  const bare = fake.rpcCalls.find(
    (call) => call.name === "checklist_claim" && call.args.p_note === null,
  )!;
  assert.equal(bare.args.p_chosen_at, null);
});

test("a change without a version in the answer reads as no version, and a refusal keeps its word", async () => {
  const none = port({ rpc: () => envelope("success") });
  const removed = await none.port.removeTask({
    idempotencyKey: KEY,
    taskId: id(10),
    expectedVersion: 1,
    expectedChecklistVersion: 1,
  } as never);
  assert.deepEqual(removed, { state: "success", data: { id: null, version: null } });
  const conflict = port({ rpc: () => envelope("conflict", "TASK_TAKEN") });
  assert.deepEqual(await conflict.port.claim({ idempotencyKey: KEY, taskId: id(10) }), {
    state: "conflict",
    code: "TASK_TAKEN",
  });
  const denied = port({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await denied.port.checklist(id(1)), { state: "denied" });
});

test("every refusal reads as a sentence of its own, and an unknown one as the general fallback", () => {
  const codes = [
    "TASK_TAKEN",
    "ALREADY_CLAIMED",
    "TASK_NOT_CLAIMABLE",
    "TASK_DONE",
    "EVENT_CLOSED",
    "CHECKLIST_TASK_UNAVAILABLE",
    "CHECKLIST_NOT_EMPTY",
    "SECTION_HAS_CLAIMS",
    "TASK_HAS_CLAIMS",
    "TEMPLATE_UNAVAILABLE",
    "VERSION_CONFLICT",
    "authorization_denied",
  ];
  const sentences = codes.map((code) => checklistMessage({ state: "conflict", code }));
  assert.equal(new Set(sentences).size, sentences.length);
  assert.equal(
    checklistMessage({ state: "denied" }),
    checklistMessage({ state: "conflict", code: "CHECKLIST_TASK_UNAVAILABLE" }),
  );
  assert.match(
    checklistMessage({ state: "validation", fieldErrors: { chosen_at: "outside_event" } }),
    /eseményen kívül/,
  );
  assert.match(checklistMessage({ state: "validation", fieldErrors: { x: "nonsense" } }), /\S/);
  assert.match(checklistMessage({ state: "conflict", code: "NOPE" }), /\S/);
});
