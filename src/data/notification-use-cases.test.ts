import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { NOTIFICATION_EXTRA_FUNCTIONS, NOTIFICATION_USE_CASES } from "./index.ts";

/**
 * BR31.10: U3 creates no notification records and leaves a marked place for U4. The list of use cases that
 * U4 must connect is checked against the database functions themselves: every function a signed-in account
 * can call that, directly or through another function, inserts, updates or deletes an assignment must be
 * on the list, and the list may name nothing else. A new use case that changes assignments fails here until
 * somebody decides about its notification.
 */
const DIRECTORY = "supabase/migrations";

type Fn = { name: string; body: string };

/**
 * The function bodies as the migrations leave them, in file order. A later `create or replace` replaces an
 * earlier definition of the same name; an `alter function ... rename to` moves the definition to the new
 * name (U4 renames the use cases of the hand-off list to `<name>_core` and puts a wrapper of the old name in
 * their place, 20261038_notifications_hooks.sql).
 */
function definitions(): Map<string, Fn> {
  const functions = new Map<string, Fn>();
  for (const file of readdirSync(DIRECTORY)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const text = readFileSync(`${DIRECTORY}/${file}`, "utf8");
    const statements = text.matchAll(
      /create (?:or replace )?function (\w+)\s*\(|alter function (\w+)\s*\([^)]*\)\s*rename to (\w+)|drop function (?:if exists )?(\w+)\s*\(/gi,
    );
    for (const match of statements) {
      if (match[4]) {
        functions.delete(match[4]);
        continue;
      }
      if (match[2]) {
        const moved = functions.get(match[2]);
        if (moved) {
          functions.delete(match[2]);
          functions.set(match[3]!, { name: match[3]!, body: moved.body });
        }
        continue;
      }
      const start = text.indexOf("$$", match.index);
      const end = start >= 0 ? text.indexOf("$$", start + 2) : -1;
      if (start < 0 || end < 0) continue;
      functions.set(match[1]!, { name: match[1]!, body: text.slice(start + 2, end).toLowerCase() });
    }
  }
  return functions;
}

function callableBySignedInAccounts(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(DIRECTORY)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const text = readFileSync(`${DIRECTORY}/${file}`, "utf8");
    for (const statement of text.matchAll(
      /grant execute on function([\s\S]*?)to authenticated;/gi,
    )) {
      for (const name of statement[1]!.matchAll(/(\w+)\s*\(/g)) names.add(name[1]!);
    }
  }
  return names;
}

const WRITES_ASSIGNMENTS =
  /\binsert\s+into\s+assignments\b|\bupdate\s+assignments\b|\bdelete\s+from\s+assignments\b/;

function writers(functions: Map<string, Fn>): Set<string> {
  const writing = new Set<string>(
    [...functions.values()].filter((fn) => WRITES_ASSIGNMENTS.test(fn.body)).map((fn) => fn.name),
  );
  for (let changed = true; changed;) {
    changed = false;
    for (const fn of functions.values()) {
      if (writing.has(fn.name)) continue;
      for (const other of writing) {
        if (new RegExp(`\\b${other}\\s*\\(`).test(fn.body)) {
          writing.add(fn.name);
          changed = true;
          break;
        }
      }
    }
  }
  return writing;
}

/**
 * The removed import's two callable functions still appear in the migration history this test reads (BR7.1 drops
 * them later, in another migration), so they are not part of the hand-off list.
 */
const IMPORT_WITHOUT_NOTICES = ["import_commit", "import_recover"];

/**
 * The Ovis tábla work's U2 adds two callable functions that change places: publishing a rota (it creates a duty
 * and a place for every filled week, and writes its own one notice per parent inside the same transaction) and the
 * done mark (it changes no one's schedule and sends no notice). Both decide their own behaviour, so neither is a
 * wrapped use case of the hand-off list; `tests/database/rota-plan.test.ts` proves them (BR23.4, BR26.2).
 * U6 adds the two weekend pick commands: they move a place between families and decide their own notices (a pick
 * writes none, an assignment by a super admin sends `weekend_pick_assigned`), so they are not wrapped either;
 * `tests/database/weekend-picks.test.ts` proves them (BR63.4, BR63.6).
 */
const ROTA_DECIDED_ITSELF = [
  "rota_plan_publish",
  "place_mark_done",
  "weekend_pick_set",
  "weekend_pick_assign",
];

/**
 * U7 (20261059) replaces the wrapped swap and cancellation functions of U3 and U4 with functions that decide their own
 * notices and reminders inside the same transaction (a proposal, an answer, a withdrawal, a reversal and a reassignment
 * tell the families concerned; a cancellation request and its decision are the exception that has its own notice kind).
 * So none is a wrapped use case of the hand-off list; `tests/database/swaps-*.test.ts` proves them.
 */
const U7_DECIDED_ITSELF = [
  "swap_request",
  "swap_respond",
  "swap_withdraw",
  "cancellation_request",
  "cancellation_decide",
  "duty_reassign",
  "swap_reverse",
];

test("the use cases U4 must connect to notifications are exactly the callable functions that change assignments", () => {
  const functions = definitions();
  assert.ok(functions.size > 80, "the migrations were read");
  const callable = callableBySignedInAccounts();
  const changing = [...writers(functions)]
    .filter(
      (name) =>
        callable.has(name) &&
        !IMPORT_WITHOUT_NOTICES.includes(name) &&
        !ROTA_DECIDED_ITSELF.includes(name) &&
        !U7_DECIDED_ITSELF.includes(name),
    )
    .sort();
  const listed = NOTIFICATION_USE_CASES.map((name) => name.replaceAll(".", "_")).sort();
  assert.deepEqual(listed, changing);
});

test("the list has no duplicate and every entry is a function of the database", () => {
  const functions = definitions();
  assert.equal(new Set(NOTIFICATION_USE_CASES).size, NOTIFICATION_USE_CASES.length);
  for (const useCase of NOTIFICATION_USE_CASES) {
    assert.ok(functions.has(useCase.replaceAll(".", "_")), useCase);
  }
});

test("the internal helpers that change assignments are reached only through listed use cases", () => {
  const functions = definitions();
  const callable = callableBySignedInAccounts();
  const internal = [...writers(functions)].filter((name) => !callable.has(name));
  assert.ok(internal.length > 0, "there are internal writers");
  const listed = new Set([
    ...NOTIFICATION_USE_CASES.map((name) => name.replaceAll(".", "_")),
    ...IMPORT_WITHOUT_NOTICES,
    ...ROTA_DECIDED_ITSELF,
    ...U7_DECIDED_ITSELF,
  ]);
  for (const helper of internal) {
    const callers = [...functions.values()].filter(
      (fn) => callable.has(fn.name) && new RegExp(`\\b${helper}\\s*\\(`).test(fn.body),
    );
    for (const caller of callers)
      assert.ok(listed.has(caller.name), `${helper} via ${caller.name}`);
  }
});

/**
 * U4 (BR40.9, BR42.5): every entry of the list and every extra function has a decided behaviour. Where the table
 * prescribes notices or job changes, the function the database exposes is U4's wrapper: it calls the renamed,
 * unchanged core of U3 and then a `notification_after_*` helper or the reminder planner. The three that the table
 * leaves without behaviour must not have a wrapper at all. The behaviour itself is proven on the real stack by
 * `tests/database/notifications-handoff.test.ts`.
 */
const WITHOUT_BEHAVIOUR = ["family_restore"];
const ROTA_GUARD_ONLY: string[] = [];
const SHARED_BODY: Record<string, string> = {};

test("every use case of the list and every extra function has a U4 hook, or is decided to have none", () => {
  const functions = definitions();
  const all = [...NOTIFICATION_USE_CASES, ...NOTIFICATION_EXTRA_FUNCTIONS].map((name) =>
    name.replaceAll(".", "_"),
  );
  assert.equal(new Set(all).size, all.length, "no function twice");
  for (const name of all) {
    assert.ok(functions.has(name), `${name} exists`);
    if (WITHOUT_BEHAVIOUR.includes(name)) {
      if (!ROTA_GUARD_ONLY.includes(name)) {
        assert.equal(functions.has(`${name}_core`), false, `${name} has no wrapper`);
      }
      assert.doesNotMatch(functions.get(name)!.body, /notification_after_|reminder_plan/, name);
      if (functions.has(`${name}_core`)) {
        assert.doesNotMatch(
          functions.get(`${name}_core`)!.body,
          /notification_after_|reminder_plan/,
          name,
        );
      }
      continue;
    }
    const hooked = SHARED_BODY[name] ?? name;
    const body = functions.get(hooked)!.body;
    assert.ok(functions.has(`${hooked}_core`), `${hooked} calls a renamed core`);
    assert.ok(body.includes(`${hooked}_core(`), `${hooked} calls its core`);
    assert.match(
      body,
      /notification_after_|reminder_plan/,
      `${hooked} writes notices or plans reminders`,
    );
  }
  assert.deepEqual([...NOTIFICATION_EXTRA_FUNCTIONS].sort(), [
    "event.save",
    "family.restore",
    "lifecycle.run",
    "settings.save",
  ]);
});

test("a refusal or a replay of a wrapped use case writes nothing: the hook runs only after a fresh success", () => {
  const functions = definitions();
  for (const name of [
    "duty_sign_up",
    "assignment_assign",
    "assignment_remove",
    "family_archive",
    "task_save",
    "event_save",
    "settings_save",
    "lifecycle_run",
  ]) {
    const body = functions.get(name)!.body;
    assert.match(body, /state'\s*=\s*'success'/, `${name} checks for a success`);
    assert.match(body, /is distinct from 'replayed'/, `${name} skips a replay`);
  }
});

/**
 * U10 (events, sign-ups with a note, food offers, roles) adds callable functions, but none changes a place: a sign-up is
 * not a duty (BR112.1). They decide their own notices (event_save sends the three event notices itself), so none is a
 * wrapped use case of the hand-off list. The removal pair of C16 writes the event tables only.
 */
test("the U10 functions change no assignment and are not part of the hand-off list", () => {
  const functions = definitions();
  const changing = writers(functions);
  const u10 = [
    "event_notices_save",
    "event_tale_save",
    "event_role_save",
    "event_role_remove",
    "event_role_clear_name",
    "event_signup_add",
    "event_signup_change",
    "event_signup_withdraw",
    "food_offer_add",
    "food_offer_change",
    "food_offer_withdraw",
    "event_list",
    "event_list_for_group",
    "event_get",
    "event_typed_roles_list",
    "event_is_summer",
    "event_deadline",
    "event_organisers",
    "events_removal_preview",
    "events_removal_apply",
    "notice_facts_event",
  ];
  for (const name of u10) {
    assert.ok(functions.has(name), `${name} is defined by the migrations`);
    assert.equal(changing.has(name), false, `${name} writes no assignment`);
    assert.equal(
      NOTIFICATION_USE_CASES.some((useCase) => useCase.replaceAll(".", "_") === name),
      false,
      `${name} is not a wrapped use case`,
    );
  }
});

/**
 * U9 (recurring duties) adds callable functions, but none changes a place: a recurring duty is a checklist item with a
 * due date, not an assignment (C12). The daily check tells people through `notice_send` itself, so none is a wrapped use
 * case of the hand-off list, and the removal pair of C16 writes the recurring tables only.
 */
test("the U9 functions change no assignment and are not part of the hand-off list", () => {
  const functions = definitions();
  const changing = writers(functions);
  const u9 = [
    "recurring_schedule_save",
    "recurring_schedule_set_active",
    "recurring_occurrence_mark_done",
    "recurring_occurrence_undo_done",
    "recurring_occurrence_skip",
    "recurring_list_for_group",
    "recurring_occurrence_get",
    "recurring_my_occurrences",
    "recurring_bottle_for_duty",
    "recurring_list",
    "recurring_schedule_get",
    "recurring_list_admin",
    "recurring_due_check",
    "recurring_notice_facts",
    "recurring_duties_removal_preview",
    "recurring_duties_removal_apply",
  ];
  for (const name of u9) {
    assert.ok(functions.has(name), `${name} is defined by the migrations`);
    assert.equal(changing.has(name), false, `${name} writes no assignment`);
    assert.equal(
      NOTIFICATION_USE_CASES.some((useCase) => useCase.replaceAll(".", "_") === name),
      false,
      `${name} is not a wrapped use case`,
    );
  }
  assert.match(functions.get("recurring_due_check")!.body, /notice_send\(/);
});

/**
 * U11 (checklists and templates) adds callable functions, but none changes a place: taking a checklist task is not a duty
 * (FR11.12, BR165.6). The two daily checks tell people through `notice_send` themselves, and U10's event_save is extended
 * to include the parents holding a claim, so none is a wrapped use case of the hand-off list. The removal pair of C16 and
 * the install write the checklist tables only.
 */
test("the U11 functions change no assignment and are not part of the hand-off list", () => {
  const functions = definitions();
  const changing = writers(functions);
  const u11 = [
    "template_save",
    "template_set_removed",
    "template_get",
    "template_list_admin",
    "template_list",
    "template_options",
    "checklist_copy_template",
    "checklist_section_save",
    "checklist_section_remove",
    "checklist_task_save",
    "checklist_task_remove",
    "checklist_reorder",
    "checklist_claim",
    "checklist_claim_typed",
    "checklist_claim_change",
    "checklist_claim_withdraw",
    "checklist_task_mark_done",
    "checklist_task_undo_done",
    "checklist_get",
    "checklist_add_task",
    "checklist_claimant_ids",
    "event_lead_notice_check",
    "checklist_unclaimed_check",
    "checklists_removal_preview",
    "checklists_removal_apply",
    "checklist_starting_templates_install",
  ];
  for (const name of u11) {
    assert.ok(functions.has(name), `${name} is defined by the migrations`);
    assert.equal(changing.has(name), false, `${name} writes no assignment`);
    assert.equal(
      NOTIFICATION_USE_CASES.some((useCase) => useCase.replaceAll(".", "_") === name),
      false,
      `${name} is not a wrapped use case`,
    );
  }
  assert.match(functions.get("event_lead_notice_check")!.body, /notice_send\(/);
  assert.match(functions.get("checklist_unclaimed_check")!.body, /notice_send\(/);
});

/**
 * U7 functions decide their own notices (BR71.5, BR72.2, BR72.5, BR73.2, BR74.3, BR75.2, BR76.3): each of them that
 * tells someone does it through the helpers that write the notice and the reminder plan inside the same function, and
 * only after the work has succeeded and the key is not a replay.
 */
test("the U7 functions are defined and tell the families through their own helpers", () => {
  const functions = definitions();
  const callable = callableBySignedInAccounts();
  for (const name of U7_DECIDED_ITSELF) {
    assert.ok(functions.has(name), `${name} exists`);
    assert.ok(callable.has(name), `${name} is callable by signed-in accounts`);
    assert.equal(functions.has(`${name}_core`), false, `${name} has no wrapper`);
    assert.doesNotMatch(functions.get(name)!.body, /notification_after_/, name);
  }
  for (const name of [
    "swap_request",
    "swap_respond",
    "swap_withdraw",
    "swap_reverse",
    "cancellation_decide",
  ]) {
    assert.match(functions.get(name)!.body, /dutychanges_notify\(/, `${name} tells the families`);
  }
  assert.match(functions.get("duty_reassign")!.body, /notice_send\(/);
  for (const retired of [
    "swap_decide",
    "coordination_decide",
    "coordination_decide_core",
    "swap_request_core",
    "swap_respond_core",
    "swap_withdraw_core",
    "cancellation_request_core",
    "notification_after_swap_request",
    "notification_after_swap_response",
    "notification_after_decision",
  ]) {
    assert.equal(functions.has(retired), false, `${retired} is gone`);
  }
});
