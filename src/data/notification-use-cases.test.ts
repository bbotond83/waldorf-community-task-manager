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
      /create (?:or replace )?function (\w+)\s*\(|alter function (\w+)\s*\([^)]*\)\s*rename to (\w+)/gi,
    );
    for (const match of statements) {
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
 */
const ROTA_DECIDED_ITSELF = ["rota_plan_publish", "place_mark_done"];

test("the use cases U4 must connect to notifications are exactly the callable functions that change assignments", () => {
  const functions = definitions();
  assert.ok(functions.size > 80, "the migrations were read");
  const callable = callableBySignedInAccounts();
  const changing = [...writers(functions)]
    .filter(
      (name) =>
        callable.has(name) &&
        !IMPORT_WITHOUT_NOTICES.includes(name) &&
        !ROTA_DECIDED_ITSELF.includes(name),
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
const WITHOUT_BEHAVIOUR = ["swap_withdraw", "cancellation_request", "family_restore"];
/** U2 puts a wrapper on these two that only refuses a rota duty (BR25.1); it still writes no notice and plans no job. */
const ROTA_GUARD_ONLY = ["swap_withdraw", "cancellation_request"];
/** The two decisions share one body; the wrapper is placed there. */
const SHARED_BODY: Record<string, string> = {
  swap_decide: "coordination_decide",
  cancellation_decide: "coordination_decide",
};

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
    "swap_request",
    "swap_respond",
    "coordination_decide",
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
