import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ASSIGNMENT_F1_T1,
  CHILD_F1,
  callFunction,
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  nextKey,
  OTHER_ADMIN,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  REQUEST_1,
  seedCoordinationWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TASK_1,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;
type Candidate = {
  family_id: string;
  version: number;
  display_name: string;
  state: string;
  blockers: string[];
};

/** Every table U3 owns: the completeness search looks through all of them (NFR1.36). */
const U3_TABLES = [
  "organizations",
  "school_years",
  "groups",
  "families",
  "group_memberships",
  "parents",
  "parent_contacts",
  "children",
  "organization_settings",
  "reminder_settings",
  "events",
  "tasks",
  "assignments",
  "change_requests",
  "contribution_notes",
  // U2's table, searched on purpose: the invitations carry the parents' e-mail addresses (R-02, BR35.2). U2's
  // accounts table is not searched: a deactivated account keeps its e-mail, a documented exception.
  "invitations",
];

/** The personal values of the first family in the seeded world, and the reason text added by the test. */
const ORIGINALS = [
  "Fenyő család",
  "Fenyő Anna",
  "Fenyő Béla",
  "Fenyő Dóra",
  "Fenyő Emma",
  "Fenyő Gergő",
  "anna@example.test",
  "bela@example.test",
  "+36 30 777 1010",
  "Kaposvár",
  "Szívesen főzök.",
  "Almás pite",
  "Beteg lettem",
];

/**
 * The lifecycle of a family that left: the candidate list, the grace period and holds, the checks in order, the
 * complete anonymization or deletion, the deactivated accounts and the audit event (BR35.1, BR35.2, NFR1.36,
 * NFR3.10, NFR6.10).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`lifecycle in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      await db.query("update change_requests set reason = 'Beteg lettem' where id = $1", [
        REQUEST_1,
      ]);
      // Contact values that belong to the first family only, so the search can tell them from the others'.
      await db.query(
        "update parent_contacts set contact_phone = '+36 30 777 1010', locality = 'Kaposvár' where parent_id in ($1, $2)",
        [PARENT_ROW_F1, PARENT_ROW_CO],
      );
    });

    const fn = (account: string, sql: string, values: unknown[] = []): Promise<Result> =>
      callFunction(db, schema, account, sql, values);
    const list = (account: string, state: string | null = null) =>
      fn(account, "lifecycle_list($1)", [state]);
    const items = (result: Result) => result.items as Candidate[];
    const run = async (
      account: string,
      family: string,
      confirmed: boolean | null = true,
      version?: number,
      key = nextKey("lc"),
    ) =>
      fn(account, "lifecycle_run($1, $2, $3, $4)", [
        key,
        family,
        version ?? (await versionOf(family)),
        confirmed,
      ]);
    const versionOf = async (family: string) =>
      (await db.query("select version from families where id = $1", [family])).rows[0]
        .version as number;
    const refused = (result: Result, state: string, code: string) =>
      assert.deepEqual([result.state, result.code], [state, code]);
    /** The family left `days` ago: archived with its people, as the archive function leaves it. */
    async function leave(family: string, days: number) {
      await db.query("update parents set status = 'archived' where family_id = $1", [family]);
      await db.query("update children set status = 'archived' where family_id = $1", [family]);
      await db.query(
        "update families set status = 'archived', archived_at = now() - ($2 || ' days')::interval where id = $1",
        [family, String(days)],
      );
    }
    /** An invitation of every status for a family's parents, with the parents' own e-mail addresses. */
    async function invite(
      scope: { type: "family" | "group"; id: string },
      email: string,
      status: "pending" | "accepting" | "accepted" | "revoked" | "replaced",
      target: string | null = null,
      role = "parent",
    ) {
      await db.query(
        `insert into invitations (email, role, scope_type, scope_id, organization_id, target_id, token_hash,
                                  status, reserved_at, accepted_at, accepted_account_id, created_by_account_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8,
                 case when $8 = 'accepting' then now() end,
                 case when $8 = 'accepted' then now() end,
                 case when $8 = 'accepted' then $9::uuid end, $10)`,
        [
          email,
          role,
          scope.type,
          scope.id,
          ORGANIZATION,
          target,
          randomBytes(32).toString("hex"),
          status,
          CO_PARENT_F1,
          SUPER_ADMIN,
        ],
      );
    }
    /** The family's invitations in every status, one with an address no longer in the contacts, and two that are not the family's. */
    async function seedInvitations() {
      const family = { type: "family" as const, id: FAMILY_1 };
      await invite(family, "anna@example.test", "pending", PARENT_ROW_F1);
      await invite(family, "bela@example.test", "accepted", PARENT_ROW_CO);
      await invite(family, "anna@example.test", "revoked", PARENT_ROW_F1);
      await invite(family, "bela@example.test", "replaced", PARENT_ROW_CO);
      await invite(family, "old.address@example.test", "accepting", PARENT_ROW_F1);
      // Not this family's: another family's invitation and a group invitation of a group admin.
      await invite({ type: "family", id: FAMILY_2 }, "other.family@example.test", "pending");
      await invite(
        { type: "group", id: GROUP_1 },
        "teacher.person@example.test",
        "pending",
        null,
        "group_admin",
      );
    }
    async function rowsContaining(values: string[]) {
      const found: Record<string, number> = {};
      for (const table of U3_TABLES) {
        const n = (
          await db.query(
            `select count(*)::int as n from ${table} t where ${values.map((_, i) => `row_to_json(t)::text ilike $${i + 1}`).join(" or ")}`,
            values.map((value) => `%${value}%`),
          )
        ).rows[0].n as number;
        if (n > 0) found[table] = n;
      }
      return found;
    }

    it("lists archived families with their state: delete, anonymize, or blocked by the grace period or a hold (BR35.1)", async () => {
      await leave(FAMILY_1, 40); // has places: anonymize
      await leave(FAMILY_NO_GROUP, 31); // no places: delete
      await leave(FAMILY_2, 5); // inside the grace period
      const state = (result: Result) =>
        Object.fromEntries(items(result).map((entry) => [entry.family_id, entry.state]));
      const all = await list(SUPER_ADMIN);
      assert.equal(all.state, "success");
      assert.deepEqual(state(all), {
        [FAMILY_1]: "eligible-anonymize",
        [FAMILY_NO_GROUP]: "eligible-delete",
        [FAMILY_2]: "blocked",
      });
      assert.deepEqual(items(all).find((entry) => entry.family_id === FAMILY_2)!.blockers, [
        "grace_period",
      ]);
      assert.deepEqual(Object.keys(items(all)[0]!).sort(), [
        "archived_at",
        "blockers",
        "display_name",
        "family_id",
        "state",
        "version",
      ]);
      assert.deepEqual(state(await list(SUPER_ADMIN, "eligible-delete")), {
        [FAMILY_NO_GROUP]: "eligible-delete",
      });
      assert.deepEqual(Object.keys(state(await list(SUPER_ADMIN, "blocked"))), [FAMILY_2]);
      assert.equal((await list(SUPER_ADMIN, "everything")).code, "filter_invalid");
      // An open hold blocks a family that is otherwise eligible; releasing it frees the family.
      const hold = await fn(
        SUPER_ADMIN,
        "lifecycle_hold_place($1, 'family', $2, $3, 'legal_hold:case_1')",
        [nextKey("hold"), FAMILY_NO_GROUP, ORGANIZATION],
      );
      assert.equal(hold.state, "success");
      const held = items(await list(SUPER_ADMIN, "blocked")).find(
        (entry) => entry.family_id === FAMILY_NO_GROUP,
      )!;
      assert.deepEqual(held.blockers, ["hold"]);
      assert.equal(
        (
          await fn(SUPER_ADMIN, "lifecycle_hold_release($1, $2, 1)", [
            nextKey("rel"),
            hold.reference,
          ])
        ).state,
        "success",
      );
      assert.equal(state(await list(SUPER_ADMIN))[FAMILY_NO_GROUP], "eligible-delete");
    });

    it("shows nothing but the empty state to a super admin of another organization, and denies everyone else (BR35.1)", async () => {
      await leave(FAMILY_1, 40);
      assert.deepEqual(
        [(await list(OTHER_ADMIN)).state, items(await list(OTHER_ADMIN))],
        ["success", []],
      );
      for (const account of [ADMIN_G1, PARENT_F1, TEACHER_G1])
        refused(await list(account), "denied", "authorization_denied");
      refused(await list(DEACTIVATED), "denied", "session_inactive");
      // A family restored after leaving is no longer archived, so no longer listed.
      await db.query("update families set status = 'active', archived_at = null where id = $1", [
        FAMILY_1,
      ]);
      assert.deepEqual(items(await list(SUPER_ADMIN)), []);
    });

    it("runs the checks in order: stale version, blocked, missing confirmation (BR35.2)", async () => {
      await leave(FAMILY_2, 5);
      refused(await run(SUPER_ADMIN, FAMILY_2, true, 99), "invalidated", "LIFECYCLE_STALE");
      const blocked = await run(SUPER_ADMIN, FAMILY_2, true);
      refused(blocked, "conflict", "LIFECYCLE_BLOCKED");
      assert.deepEqual([blocked.deferred, blocked.blockers], [true, ["grace_period"]]);
      refused(await run(SUPER_ADMIN, FAMILY_2, true, 99), "invalidated", "LIFECYCLE_STALE");
      await leave(FAMILY_1, 40);
      refused(
        await run(SUPER_ADMIN, FAMILY_1, false),
        "conflict",
        "LIFECYCLE_CONFIRMATION_REQUIRED",
      );
      refused(
        await run(SUPER_ADMIN, FAMILY_1, null),
        "conflict",
        "LIFECYCLE_CONFIRMATION_REQUIRED",
      );
      refused(await run(SUPER_ADMIN, FAMILY_NO_GROUP, true), "conflict", "LIFECYCLE_BLOCKED");
      assert.deepEqual((await run(SUPER_ADMIN, FAMILY_NO_GROUP, true)).blockers, ["not_archived"]);
      refused(await run(SUPER_ADMIN, uuid(99999), true, 1), "validation", "family_not_found");
      refused(await run(OTHER_ADMIN, FAMILY_1, true, 1), "validation", "family_not_found");
      for (const account of [ADMIN_G1, PARENT_F1, TEACHER_G1])
        refused(await run(account, FAMILY_1, true), "denied", "authorization_denied");
      assert.equal(await count(db, "audit_events"), 0, "no refusal wrote an event");
      assert.equal(await count(db, "families", "anonymized_at is not null"), 0);
    });

    it("anonymizes a family with places completely and keeps the places as history (BR35.2, NFR1.36)", async () => {
      await leave(FAMILY_1, 40);
      await seedInvitations();
      const originals = [...ORIGINALS, "old.address@example.test"];
      const before = await rowsContaining(originals);
      for (const table of [
        "families",
        "parents",
        "parent_contacts",
        "children",
        "contribution_notes",
        "change_requests",
        "invitations",
      ]) {
        assert.ok(before[table], `the search finds the original values in ${table}`);
      }
      assert.equal(before.invitations, 5, "the five invitations of the family carry the addresses");
      const places = await count(db, "assignments", `family_id = '${FAMILY_1}'`);
      const result = await run(SUPER_ADMIN, FAMILY_1, true);
      assert.deepEqual([result.state, result.outcome], ["success", "anonymized"]);
      assert.deepEqual(
        await rowsContaining(originals),
        {},
        "nothing personal is left in any table of the unit, the invitations included",
      );
      // Only the family's own invitations went, whatever their status; nobody else's.
      assert.deepEqual(
        (await db.query("select email from invitations order by email")).rows.map(
          (row) => row.email,
        ),
        ["other.family@example.test", "teacher.person@example.test"],
      );
      assert.equal(
        await count(db, "assignments", `family_id = '${FAMILY_1}'`),
        places,
        "the places stay as history",
      );
      const family = (
        await db.query("select display_name, status, anonymized_at from families where id = $1", [
          FAMILY_1,
        ])
      ).rows[0];
      assert.deepEqual(
        [family.display_name, family.status, family.anonymized_at !== null],
        ["Anonimizált család", "archived", true],
      );
      assert.equal(
        await count(db, "parent_contacts"),
        2,
        "only the other families' contacts remain",
      );
      assert.equal(await count(db, "group_memberships", `family_id = '${FAMILY_1}'`), 0);
      const parents = (
        await db.query(
          "select display_name, account_id, optional_profile, optional_profile_consent from parents where family_id = $1",
          [FAMILY_1],
        )
      ).rows;
      assert.ok(
        parents.every(
          (row) =>
            row.display_name === "Anonimizált szülő" &&
            row.account_id === null &&
            row.optional_profile === null &&
            row.optional_profile_consent === false,
        ),
      );
      assert.equal(
        (await db.query("select display_name from children where id = $1", [CHILD_F1])).rows[0]
          .display_name,
        "Anonimizált gyermek",
      );
      assert.equal(
        (
          await db.query("select text from contribution_notes where assignment_id = $1", [
            ASSIGNMENT_F1_T1,
          ])
        ).rows[0].text,
        "",
      );
      assert.equal(
        (await db.query("select reason from change_requests where id = $1", [REQUEST_1])).rows[0]
          .reason,
        null,
      );
      const lifecycleEvents = (await auditEvents(db)).filter((event) =>
        event.action.startsWith("lifecycle."),
      );
      assert.deepEqual(
        lifecycleEvents.map((event) => [
          event.action,
          event.outcome,
          event.target_type,
          event.target_id,
          event.actor_account_id,
          event.details,
        ]),
        [["lifecycle.anonymize", "success", "family", FAMILY_1, SUPER_ADMIN, "family"]],
      );
      // It is out of the list and cannot be run or restored again.
      assert.deepEqual(items(await list(SUPER_ADMIN)), []);
      assert.deepEqual((await run(SUPER_ADMIN, FAMILY_1, true)).blockers, ["already_anonymized"]);
      refused(
        await fn(SUPER_ADMIN, "family_restore($1, $2, $3)", [
          nextKey(),
          FAMILY_1,
          await versionOf(FAMILY_1),
        ]),
        "conflict",
        "RESTORE_CONFLICT",
      );
    });

    it("deactivates the parents' sign-in accounts through U2's function and deletes the family's invitations, open ones included", async () => {
      await leave(FAMILY_1, 40);
      await db.query(
        "insert into invitations (email, role, scope_type, scope_id, organization_id, token_hash, created_by_account_id) values ('open@example.test', 'parent', 'family', $1, $2, $3, $4)",
        [FAMILY_1, ORGANIZATION, "a".repeat(64), SUPER_ADMIN],
      );
      assert.equal((await run(SUPER_ADMIN, FAMILY_1, true)).state, "success");
      const accounts = (
        await db.query("select id, status from accounts where id in ($1, $2, $3, $4)", [
          PARENT_F1,
          CO_PARENT_F1,
          DEACTIVATED,
          SIGNED_OUT,
        ])
      ).rows;
      assert.equal(accounts.length, 4);
      assert.ok(
        accounts.every((row) => row.status === "deactivated"),
        JSON.stringify(accounts),
      );
      const events = (await auditEvents(db)).map((event) => event.action).sort();
      assert.deepEqual(
        events,
        ["account.deactivate", "account.deactivate", "account.deactivate", "lifecycle.anonymize"],
        "three accounts were deactivated; the one that already was needs no event",
      );
      // The open invitation no longer exists, so its link cannot be used (it was only marked revoked before).
      assert.equal(await count(db, "invitations", "email = 'open@example.test'"), 0);
      // The deactivated accounts keep their e-mail on purpose (U2 deactivates, never deletes): the one
      // documented exception to "nothing personal remains".
      assert.equal(
        await count(
          db,
          "accounts",
          `id = '${PARENT_F1}' and email is not null and status = 'deactivated'`,
        ),
        1,
      );
      // The deactivated parent can no longer use the session.
      refused(await fn(PARENT_F1, "duty_list()"), "denied", "session_inactive");
    });

    it("deletes a family without any place completely, with one audit event (BR35.2)", async () => {
      await db.query(
        "insert into parents (id, organization_id, family_id, display_name, optional_profile, optional_profile_consent) values ($1, $2, $3, 'Csoport Géza', 'Zenél.', true)",
        [uuid(620), ORGANIZATION, FAMILY_NO_GROUP],
      );
      await db.query(
        "insert into parent_contacts (parent_id, organization_id, contact_email, contact_phone, locality) values ($1, $2, 'geza@example.test', '+36 20 555 1212', 'Mohács')",
        [uuid(620), ORGANIZATION],
      );
      await db.query(
        "insert into children (organization_id, family_id, display_name) values ($1, $2, 'Csoport Dani')",
        [ORGANIZATION, FAMILY_NO_GROUP],
      );
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, FAMILY_NO_GROUP, GROUP_1],
      );
      const family = { type: "family" as const, id: FAMILY_NO_GROUP };
      await invite(family, "geza@example.test", "accepted", uuid(620));
      await invite(family, "geza@example.test", "revoked", uuid(620));
      await invite(family, "geza.uj@example.test", "pending", uuid(620));
      await invite({ type: "family", id: FAMILY_2 }, "other.family@example.test", "pending");
      await leave(FAMILY_NO_GROUP, 60);
      const originals = [
        "geza.uj@example.test",
        "Csoport nélküli család",
        "Csoport Géza",
        "Zenél.",
        "geza@example.test",
        "+36 20 555 1212",
        "Mohács",
        "Csoport Dani",
      ];
      assert.ok(
        Object.keys(await rowsContaining(originals)).length >= 4,
        "the search sees the values before",
      );
      const result = await run(SUPER_ADMIN, FAMILY_NO_GROUP, true);
      assert.deepEqual([result.state, result.outcome], ["success", "deleted"]);
      assert.deepEqual(await rowsContaining(originals), {});
      assert.equal(
        await count(
          db,
          "invitations",
          `scope_id = '${FAMILY_NO_GROUP}' or target_id = '${uuid(620)}'`,
        ),
        0,
        "no invitation of the deleted family is left, with no dangling target either",
      );
      assert.equal(
        await count(db, "invitations", "email = 'other.family@example.test'"),
        1,
        "another family's invitation is untouched",
      );
      for (const [table, column] of [
        ["families", "id"],
        ["parents", "family_id"],
        ["children", "family_id"],
        ["group_memberships", "family_id"],
      ] as const) {
        assert.equal(await count(db, table, `${column} = '${FAMILY_NO_GROUP}'`), 0, table);
      }
      assert.deepEqual(
        (await auditEvents(db)).map((event) => [event.action, event.target_id]),
        [["lifecycle.delete", FAMILY_NO_GROUP]],
      );
      assert.equal(await count(db, "families"), 3, "the other families are untouched");
    });

    it("treats a family with only removed places as a family with history: anonymize, not delete (NFR3.10)", async () => {
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source, status) values ($1, $2, $3, 'admin_assign', 'removed')",
        [ORGANIZATION, TASK_1, FAMILY_NO_GROUP],
      );
      await leave(FAMILY_NO_GROUP, 40);
      assert.equal(
        items(await list(SUPER_ADMIN)).find((entry) => entry.family_id === FAMILY_NO_GROUP)!.state,
        "eligible-anonymize",
      );
      assert.equal((await run(SUPER_ADMIN, FAMILY_NO_GROUP, true)).outcome, "anonymized");
      assert.equal(
        await count(db, "assignments", `family_id = '${FAMILY_NO_GROUP}' and status = 'removed'`),
        1,
        "the removed place is kept",
      );
    });

    it("lets places leave only through the lifecycle: no other function deletes an assignment or a request (NFR3.10)", async () => {
      const sources = (
        await db.query(
          `select p.proname from pg_proc p
            where p.pronamespace = current_schema()::regnamespace and p.prokind = 'f'
              and (p.prosrc ~* 'delete\\s+from\\s+(assignments|change_requests|contribution_notes)\\b')`,
        )
      ).rows.map((row) => row.proname);
      assert.deepEqual(
        sources,
        [],
        "the lifecycle only anonymizes places and deletes families without any",
      );
      assert.equal(
        (
          await db.query(
            "select has_table_privilege('authenticated', 'assignments', 'delete') as d",
          )
        ).rows[0].d,
        false,
      );
    });

    it("refuses to deactivate the last super admin's account and then changes nothing at all (BR35.2, NFR6.10)", async () => {
      await leave(FAMILY_1, 40);
      await db.query("update parents set account_id = $1 where id = $2", [
        SUPER_ADMIN,
        PARENT_ROW_CO,
      ]);
      const blocked = await run(SUPER_ADMIN, FAMILY_1, true);
      refused(blocked, "conflict", "LIFECYCLE_BLOCKED");
      assert.deepEqual(blocked.blockers, ["account_last_super_admin"]);
      assert.equal(
        await count(db, "accounts", `id = '${PARENT_F1}' and status = 'active'`),
        1,
        "the earlier deactivation was rolled back",
      );
      assert.equal(await count(db, "families", "anonymized_at is not null"), 0);
      assert.equal(await count(db, "audit_events"), 0);
      assert.ok(PARENT_ROW_F1);
    });

    it("rolls everything back when a step fails: nothing is deleted, anonymized or deactivated (NFR6.10)", async () => {
      await leave(FAMILY_1, 40);
      await seedInvitations();
      await db.query(
        `create function refuse_anonymize() returns trigger language plpgsql as $$ begin
           if new.anonymized_at is not null then raise exception 'injected failure' using errcode = 'XX000'; end if; return new; end $$`,
      );
      await db.query(
        "create trigger refuse_anonymize before update on families for each row execute function refuse_anonymize()",
      );
      try {
        const failure = await run(SUPER_ADMIN, FAMILY_1, true).then(
          () => undefined,
          (error: Error & { code?: string }) => error,
        );
        assert.equal(failure?.code, "XX000");
      } finally {
        await db.query("drop trigger refuse_anonymize on families");
        await db.query("drop function refuse_anonymize()");
      }
      assert.deepEqual(
        Object.keys(await rowsContaining(ORIGINALS)).includes("parent_contacts"),
        true,
        "the contacts are still there",
      );
      assert.equal(
        await count(db, "invitations", `scope_id = '${FAMILY_1}'`),
        5,
        "the invitations deleted before the failing step are back",
      );
      assert.equal(await count(db, "accounts", `id = '${PARENT_F1}' and status = 'active'`), 1);
      assert.equal(await count(db, "audit_events"), 0);
    });

    it("returns the stored result for a repeated key and writes one event only (NFR6.11)", async () => {
      await leave(FAMILY_1, 40);
      const key = nextKey("same");
      const version = await versionOf(FAMILY_1);
      const first = await run(SUPER_ADMIN, FAMILY_1, true, version, key);
      const again = await run(SUPER_ADMIN, FAMILY_1, true, version, key);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
      assert.equal(await count(db, "audit_events", "action = 'lifecycle.anonymize'"), 1);
      assert.equal(
        (
          await db.query(
            "select has_function_privilege('anon', 'lifecycle_run(text, uuid, integer, boolean)', 'execute') as a",
          )
        ).rows[0].a,
        false,
      );
    });
  });
}
