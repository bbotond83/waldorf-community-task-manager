import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { todoMessage } from "./copy.ts";
import { createTodoPort } from "./todo.ts";

const id = (n: number) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "todo-key-00000001";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createTodoPort(fake.database) };
}

const card = {
  id: id(1),
  topic: "Kerítés festése",
  priority: 2,
  status: "open",
  owner_kind: "working_group",
  owner_id: id(20),
  owner_label: "Kert",
  claimant_display_name: null,
  claimed_by_me: false,
  not_before: null,
  deadline: "2026-12-01",
  is_done: false,
  is_not_yet: false,
  is_overdue: true,
  needs_attention: false,
  version: 3,
  can_claim: true,
};

test("the list is one call, carries the filters and reads every field of a card", async () => {
  const { port: todo, fake } = port({
    rpc: () =>
      envelope("success", null, {
        items: [
          { ...card, on_event: true, done_on_event: false },
          {
            ...card,
            id: id(2),
            priority: null,
            claimant_display_name: "korábbi tag",
            claimed_by_me: true,
            deadline: null,
            on_event: false,
            done_on_event: false,
          },
        ],
        truncated: true,
        caller: { can_claim_tasks: true, can_manage_community: false },
      }),
  });
  const outcome = await todo.list({ showHidden: true, owner: id(20), status: "open", priority: 2 });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const [first, second] = outcome.data.items;
  assert.deepEqual(
    [first?.topic, first?.priority, first?.deadline, first?.isOverdue, first?.canClaim],
    ["Kerítés festése", 2, "2026-12-01", true, true],
  );
  assert.deepEqual([first?.onEvent, first?.doneOnEvent, first?.version], [true, false, 3]);
  assert.deepEqual(
    [second?.priority, second?.deadline, second?.claimantDisplayName, second?.claimedByMe],
    [undefined, undefined, "korábbi tag", true],
  );
  assert.deepEqual(
    [
      outcome.data.truncated,
      outcome.data.caller.canClaimTasks,
      outcome.data.caller.canManageCommunity,
    ],
    [true, true, false],
  );
  assert.ok(Object.isFrozen(outcome.data) && Object.isFrozen(first));
  assert.deepEqual(fake.rpcCalls, [
    {
      name: "todo_list",
      args: {
        p_show_hidden: true,
        p_owner: id(20),
        p_status: "open",
        p_priority: 2,
        p_attention_only: false,
      },
    },
  ]);
});

test("a list with no filters asks for the default view, and an owner that is not an identifier reads as denied", async () => {
  const { port: todo, fake } = port({
    rpc: () =>
      envelope("success", null, {
        items: [],
        truncated: false,
        caller: { can_claim_tasks: false, can_manage_community: true },
      }),
  });
  const empty = await todo.list({});
  assert.ok(empty.state === "success" && empty.data.items.length === 0);
  assert.deepEqual(fake.rpcCalls[0]?.args, {
    p_show_hidden: false,
    p_owner: null,
    p_status: null,
    p_priority: null,
    p_attention_only: false,
  });
  assert.deepEqual(await todo.list({ owner: "not-an-id" }), { state: "denied" });
  assert.equal(fake.rpcCalls.length, 1);
});

test("a task page carries the card, its texts, the done mark, the history, the links and what the caller may do", async () => {
  const { port: todo, fake } = port({
    rpc: () =>
      envelope("success", id(1), {
        item: {
          ...card,
          status: "done",
          is_done: true,
          description: "Két réteg festék",
          materials: null,
          note: "Kész a nyugati oldal",
          created_at: "2026-11-01T08:00:00+00:00",
          done: { at: "2026-11-20T10:00:00+00:00", by_display_name: null, is_own: false },
          history: [
            {
              change: "status",
              from_status: "open",
              to_status: "done",
              actor: "adminisztrátor",
              at: "2026-11-20T10:00:00+00:00",
              event_id: null,
              event_title: null,
            },
            {
              change: "pulled",
              from_status: null,
              to_status: null,
              actor: "korábbi tag",
              at: "2026-11-21T10:00:00+00:00",
              event_id: id(40),
              event_title: "Tavaszi nagytakarítás",
            },
          ],
          event_links: [
            {
              event_id: id(40),
              event_title: "Tavaszi nagytakarítás",
              pulled_at: "2026-11-21T10:00:00+00:00",
              state: "done_on_event",
              event_closed: false,
            },
            {
              event_id: id(41),
              event_title: null,
              pulled_at: "2026-11-22T10:00:00+00:00",
              state: "gone",
              event_closed: null,
            },
          ],
          can: {
            claim: false,
            give_back: false,
            update: false,
            mark_done: false,
            undo_done: true,
            free_claim: false,
            edit: true,
          },
        },
      }),
  });
  const outcome = await todo.get(id(1));
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  const detail = outcome.data;
  assert.deepEqual(
    [detail.description, detail.materials, detail.note, detail.createdAt],
    ["Két réteg festék", undefined, "Kész a nyugati oldal", "2026-11-01T08:00:00+00:00"],
  );
  assert.deepEqual(detail.done, { at: "2026-11-20T10:00:00+00:00", isOwn: false });
  assert.deepEqual(
    [detail.history[0]?.fromStatus, detail.history[0]?.toStatus, detail.history[0]?.eventId],
    ["open", "done", undefined],
  );
  assert.deepEqual(
    [detail.history[1]?.fromStatus, detail.history[1]?.eventTitle],
    [undefined, "Tavaszi nagytakarítás"],
  );
  assert.deepEqual(
    detail.eventLinks.map((link) => [link.state, link.eventClosed, link.eventTitle]),
    [
      ["done_on_event", false, "Tavaszi nagytakarítás"],
      ["gone", false, undefined],
    ],
  );
  assert.deepEqual(detail.can, {
    claim: false,
    giveBack: false,
    update: false,
    markDone: false,
    undoDone: true,
    freeClaim: false,
    edit: true,
  });
  assert.deepEqual(fake.rpcCalls, [{ name: "todo_get", args: { p_task_id: id(1) } }]);
});

test("a done mark shows who finished it when the database names a person, and a task that is not done has none", async () => {
  const detailBody = (extra: Record<string, unknown>) => ({
    item: {
      ...card,
      created_at: "2026-11-01T08:00:00+00:00",
      history: [],
      event_links: [],
      can: {
        claim: true,
        give_back: false,
        update: false,
        mark_done: false,
        undo_done: false,
        free_claim: false,
        edit: false,
      },
      ...extra,
    },
  });
  const named = port({
    rpc: () =>
      envelope(
        "success",
        id(1),
        detailBody({
          done: {
            at: "2026-11-20T10:00:00+00:00",
            by_display_name: "Mogyoró család",
            is_own: true,
          },
        }),
      ),
  });
  const done = await named.port.get(id(1));
  assert.ok(
    done.state === "success" &&
      done.data.done?.byDisplayName === "Mogyoró család" &&
      done.data.done.isOwn,
  );
  const open = port({ rpc: () => envelope("success", id(1), detailBody({ done: null })) });
  const notDone = await open.port.get(id(1));
  assert.ok(notDone.state === "success" && notDone.data.done === undefined);
});

test("a group's list and My tasks read their parts in one call each", async () => {
  const { port: todo, fake } = port({
    rpc: (name) =>
      name === "todo_list_for_group"
        ? envelope("success", id(20), {
            items: [
              {
                id: id(1),
                title: "Kerítés festése",
                status: "in_progress",
                priority: 1,
                deadline: "2026-12-01",
                claimant_display_name: "Mogyoró család",
                is_overdue: false,
                needs_attention: true,
                version: 4,
              },
              {
                id: id(2),
                title: "Locsolás",
                status: "open",
                priority: null,
                deadline: null,
                claimant_display_name: null,
                is_overdue: false,
                needs_attention: false,
                version: 1,
              },
            ],
            truncated: false,
          })
        : envelope("success", null, {
            this_week: [
              {
                kind: "todo",
                id: id(1),
                ref_id: id(1),
                title: "Kerítés festése",
                date: "2026-11-27",
                status: "open",
                version: 3,
                is_overdue: true,
                can_mark_done: true,
              },
            ],
            later: [
              {
                kind: "recurring",
                id: id(5),
                ref_id: id(5),
                title: "Komposztálás",
                date: "2026-12-14",
                status: "open",
                version: 1,
                is_overdue: false,
                can_mark_done: false,
              },
            ],
            no_date: [
              {
                kind: "duty",
                id: id(6),
                ref_id: id(7),
                title: "Sütés",
                date: null,
                status: "open",
                version: 2,
                is_overdue: false,
                can_mark_done: true,
              },
            ],
            is_empty: false,
            week_end: "2026-11-29",
          }),
  });
  const group = await todo.groupList(id(20));
  assert.ok(group.state === "success");
  if (group.state === "success") {
    assert.deepEqual(
      group.data.items.map((item) => [
        item.title,
        item.priority,
        item.deadline,
        item.needsAttention,
      ]),
      [
        ["Kerítés festése", 1, "2026-12-01", true],
        ["Locsolás", undefined, undefined, false],
      ],
    );
    assert.equal(group.data.items[0]?.claimantDisplayName, "Mogyoró család");
  }
  const mine = await todo.myTasks();
  assert.ok(mine.state === "success");
  if (mine.state === "success") {
    assert.deepEqual(
      [mine.data.thisWeek[0]?.kind, mine.data.later[0]?.kind, mine.data.noDate[0]?.kind],
      ["todo", "recurring", "duty"],
    );
    assert.deepEqual([mine.data.noDate[0]?.date, mine.data.noDate[0]?.refId], [undefined, id(7)]);
    assert.deepEqual([mine.data.isEmpty, mine.data.weekEnd], [false, "2026-11-29"]);
  }
  assert.deepEqual(
    fake.rpcCalls.map((call) => call.name),
    ["todo_list_for_group", "my_tasks_get"],
  );
});

test("an address that is not an identifier reads as denied without asking the database", async () => {
  const { port: todo, fake } = port({ rpc: () => envelope("success") });
  const input = { idempotencyKey: KEY, taskId: "nope", expectedVersion: 1 };
  const results = await Promise.all([
    todo.get("nope"),
    todo.groupList("nope"),
    todo.claim(input),
    todo.giveBack(input),
    todo.freeClaim(input),
    todo.update(input),
    todo.markDone(input),
    todo.undoDone(input),
    todo.pullToEvent({ idempotencyKey: KEY, eventId: "nope", tasks: [] }),
    todo.pullToEvent({
      idempotencyKey: KEY,
      eventId: id(40),
      tasks: [{ taskId: "nope", expectedVersion: 1 }],
    }),
  ]);
  assert.ok(results.every((result) => result.state === "denied"));
  assert.deepEqual(fake.rpcCalls, []);
});

test("each command calls its function with the key first and the version it was given", async () => {
  const { port: todo, fake } = port({
    rpc: (name) =>
      name === "todo_pull_to_event"
        ? envelope("success", null, { added: 2, already_on_list: 0, claimants_carried: 0 }, id(40))
        : envelope("success", null, { version: 5 }, id(1)),
  });
  const base = { idempotencyKey: KEY, taskId: id(1), expectedVersion: 4 };
  const results = await Promise.all([
    todo.save({
      idempotencyKey: KEY,
      ownerGroupId: id(20),
      topic: "Kerítés festése",
      priority: 2,
      deadline: "2026-12-01",
    }),
    todo.save({
      idempotencyKey: KEY,
      taskId: id(1),
      expectedVersion: 4,
      topic: "Kerítés festése",
      status: "postponed",
      note: "Eső miatt",
    }),
    todo.claim(base),
    todo.giveBack(base),
    todo.freeClaim(base),
    todo.update({ ...base, status: "in_progress", note: "Elkezdtük" }),
    todo.update(base),
    todo.markDone(base),
    todo.undoDone(base),
    todo.pullToEvent({
      idempotencyKey: KEY,
      eventId: id(40),
      tasks: [
        { taskId: id(1), expectedVersion: 4 },
        { taskId: id(2), expectedVersion: 1 },
      ],
    }),
  ]);
  assert.ok(
    results.slice(0, 9).every((r) => r.state === "success" && r.data && "version" in r.data),
  );
  const calls = fake.rpcCalls;
  assert.deepEqual(calls[0], {
    name: "todo_task_save",
    args: {
      p_idempotency_key: KEY,
      p_task: {
        id: null,
        expected_version: null,
        owner_group_id: id(20),
        owner_family_id: null,
        topic: "Kerítés festése",
        priority: 2,
        description: null,
        materials: null,
        status: null,
        note: null,
        not_before: null,
        deadline: "2026-12-01",
      },
    },
  });
  assert.deepEqual(
    [
      calls[1]?.args.p_task && (calls[1].args.p_task as Record<string, unknown>).id,
      (calls[1]?.args.p_task as Record<string, unknown>).expected_version,
      (calls[1]?.args.p_task as Record<string, unknown>).status,
    ],
    [id(1), 4, "postponed"],
  );
  assert.deepEqual(
    calls.slice(2, 5).map((call) => call.name),
    ["todo_task_claim", "todo_task_give_back", "todo_task_free_claim"],
  );
  assert.deepEqual(calls[2]?.args, {
    p_idempotency_key: KEY,
    p_task_id: id(1),
    p_expected_version: 4,
  });
  assert.deepEqual(calls[5], {
    name: "todo_task_update",
    args: {
      p_idempotency_key: KEY,
      p_task_id: id(1),
      p_status: "in_progress",
      p_note: "Elkezdtük",
      p_expected_version: 4,
    },
  });
  assert.equal(calls[6]?.args.p_status, null);
  assert.deepEqual(
    calls.slice(7, 9).map((call) => call.name),
    ["todo_task_mark_done", "todo_task_undo_done"],
  );
  assert.deepEqual(calls[9], {
    name: "todo_pull_to_event",
    args: {
      p_idempotency_key: KEY,
      p_event_id: id(40),
      p_todo_ids: [id(1), id(2)],
      p_expected_versions: [4, 1],
    },
  });
});

test("a command answers the task id and its new version, and a replay answers no new version", async () => {
  const fresh = port({ rpc: () => envelope("success", null, { version: 5 }, id(1)) });
  assert.deepEqual(
    await fresh.port.claim({ idempotencyKey: KEY, taskId: id(1), expectedVersion: 4 }),
    { state: "success", data: { id: id(1), version: 5 } },
  );
  const replay = port({ rpc: () => envelope("success", "replayed", {}, id(1)) });
  assert.deepEqual(
    await replay.port.claim({ idempotencyKey: KEY, taskId: id(1), expectedVersion: 4 }),
    { state: "success", data: { id: id(1), version: null } },
  );
});

test("a pull answers how many tasks were added, already there and brought a helper along", async () => {
  const { port: todo } = port({
    rpc: () =>
      envelope("success", null, { added: 2, already_on_list: 1, claimants_carried: 1 }, id(40)),
  });
  const outcome = await todo.pullToEvent({
    idempotencyKey: KEY,
    eventId: id(40),
    tasks: [{ taskId: id(1), expectedVersion: 1 }],
  });
  assert.deepEqual(outcome, {
    state: "success",
    data: { eventId: id(40), added: 2, alreadyOnList: 1, claimantsCarried: 1 },
  });
});

test("each refusal keeps its state and code, and a refused field names its entry", async () => {
  const base = { idempotencyKey: KEY, taskId: id(1), expectedVersion: 1 };
  const refusals: [string, string][] = [
    ["conflict", "TODO_CLAIMED"],
    ["conflict", "TODO_DONE"],
    ["conflict", "TODO_NOT_DONE"],
    ["conflict", "TODO_NOT_CLAIMED"],
    ["conflict", "TODO_NOT_YET"],
    ["conflict", "EVENT_CLOSED"],
    ["conflict", "VERSION_CONFLICT"],
    ["conflict", "idempotency_key_reused"],
  ];
  for (const [state, code] of refusals) {
    const { port: todo } = port({ rpc: () => envelope(state, code) });
    assert.deepEqual(await todo.claim(base), { state: "conflict", code });
  }
  const denied = port({ rpc: () => envelope("denied", "authorization_denied") });
  assert.deepEqual(await denied.port.claim(base), { state: "denied" });
  const cases: [string, Record<string, unknown>, Record<string, string>][] = [
    ["field_invalid", { field: "owner", reason: "one_only" }, { owner: "VAL-INVALID" }],
    ["field_invalid", { field: "owner", reason: "archived" }, { owner: "VAL-ARCHIVED" }],
    ["field_invalid", { field: "topic", reason: "required" }, { topic: "VAL-INVALID" }],
    [
      "field_invalid",
      { field: "not_before", reason: "not_before_after_deadline" },
      { notBefore: "VAL-DATE-RANGE" },
    ],
    [
      "field_invalid",
      { field: "expected_version", reason: "invalid" },
      { expectedVersion: "VAL-EXPECTED-VERSION" },
    ],
  ];
  for (const [code, extra, fieldErrors] of cases) {
    const { port: todo } = port({ rpc: () => envelope("validation", code, extra) });
    assert.deepEqual(await todo.save({ idempotencyKey: KEY, topic: "x" }), {
      state: "validation",
      fieldErrors,
      code,
    });
  }
});

test("a refusal with only a code (no parent record, too many tasks, a status that is not allowed) keeps that code", async () => {
  for (const code of ["no_parent_record", "too_many_tasks", "status_not_allowed"]) {
    const { port: todo } = port({ rpc: () => envelope("validation", code) });
    assert.deepEqual(
      await todo.update({ idempotencyKey: KEY, taskId: id(1), expectedVersion: 1 }),
      {
        state: "validation",
        fieldErrors: { request: "VAL-INVALID" },
        code,
      },
    );
  }
});

test("a refusal reads as Hungarian words that name what to correct", () => {
  assert.equal(todoMessage({ state: "denied" }), "Ezt a műveletet nem végezheted el.");
  assert.equal(
    todoMessage({ state: "conflict", code: "TODO_CLAIMED" }),
    "Ezt a feladatot közben valaki más vállalta.",
  );
  for (const code of [
    "TODO_DONE",
    "TODO_NOT_DONE",
    "TODO_NOT_CLAIMED",
    "TODO_NOT_YET",
    "EVENT_CLOSED",
    "VERSION_CONFLICT",
    "status_not_allowed",
    "too_many_tasks",
    "no_parent_record",
    "idempotency_key_reused",
  ]) {
    const message = todoMessage({ state: "validation", code });
    assert.notEqual(message, "A művelet most nem hajtható végre.", code);
  }
  assert.equal(
    todoMessage({ state: "validation", fieldErrors: { owner: "VAL-ARCHIVED" } }),
    "Ez a csoport már archivált.",
  );
  assert.equal(
    todoMessage({ state: "validation", fieldErrors: { notBefore: "VAL-DATE-RANGE" } }),
    "Add meg a kezdő dátumot, és ne legyen a határidő után.",
  );
  assert.equal(
    todoMessage({ state: "validation", fieldErrors: { topic: "VAL-INVALID" } }),
    "Adj meg egy témát, legfeljebb 200 karakterrel.",
  );
  assert.equal(
    todoMessage({ state: "validation", fieldErrors: { nothing: "VAL-INVALID" } }),
    "A művelet most nem hajtható végre.",
  );
});
