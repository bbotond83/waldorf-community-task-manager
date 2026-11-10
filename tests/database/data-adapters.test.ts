import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import type { AdminOperation } from "../../src/application/index.ts";
import {
  BUSINESS_CODE_STATES,
  createAdminPort,
  createParentPort,
  createTeacherPort,
} from "../../src/data/index.ts";
import { createSignInService } from "../../src/identity/service.ts";
import { createDatabaseClient } from "../../src/runtime/database/client.ts";
import {
  resolveAdminAccess,
  resolveParentAccess,
  resolveTeacherAccess,
} from "../../src/runtime/production/access.ts";
import {
  createProductionServices,
  type RequestServices,
} from "../../src/runtime/production/services.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  ASSIGNMENT_F1_T1,
  DIRECTORY_SCHEMAS,
  EVENT_1,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  GROUP_OTHER,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TASK_3,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { count, FAMILY_ADMIN_G1 } from "./identity-support.ts";
import { report, stackSettings } from "./stack-support.ts";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const SESSION_SECRET = `test-secret-${randomBytes(24).toString("hex")}`;
const PASSWORD = `Pw-${randomBytes(6).toString("hex")}-1`;

const TASK_4 = uuid(815);
const TASK_5 = uuid(816);
const A_F1_T4 = uuid(851);
const A_F2_T5 = uuid(852);

const ACCOUNTS = {
  parent: PARENT_F1,
  parentOther: PARENT_F2,
  adminSame: ADMIN_G1,
  adminOther: ADMIN_G2,
  super: SUPER_ADMIN,
  teacher: TEACHER_G1,
  outsider: OUTSIDER,
} as const;
type Who = keyof typeof ACCOUNTS;

type Item = { id: string; title: string; state: string; version: number };
type Grant = {
  id: string;
  subjectLabel: string;
  role: string;
  scopeLabel: string;
  version: number;
  isSelf: boolean;
};
/** Everything an admin operation may return in `data`, typed once so the checks below need no cast. */
type FamilyParent = {
  displayName: string;
  email?: string;
  linked: boolean;
  optionalProfile?: string;
  optionalProfileConsent?: boolean;
};
type RecordDetails = {
  parents: FamilyParent[];
  children: { displayName: string }[];
  groups: { id: string; name: string }[];
};
type AdminData = Item & {
  kind: string;
  details: RecordDetails;
  items: Item[];
  grants: Grant[];
  candidates: { id: string; eligibility: string; version: number }[];
  scopeId: string;
  openApprovals: number;
  selectedRecipientId: string;
  remindersEnabled: boolean;
  outcome: string;
  grantId: string;
  authorizationVersion: number;
  invalidatedSubjectId: string;
  familyId: string;
  auditEvidenceId: string;
};
type Outcome = {
  state: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  data?: unknown;
};
/** A value the test needs: fails with a clear message when it is missing. */
function must<T>(value: T | undefined, what: string): T {
  assert.ok(value !== undefined, what);
  return value;
}
const refused = (outcome: Outcome, state: string, code: string) =>
  assert.deepEqual([outcome.state, outcome.code], [state, code]);

/**
 * The database adapters against the real local stack, with real sign-in tokens (NFR2.17, NFR6.13): every
 * port operation of the parent, admin and teacher ports, the facades with the production authorization, and a
 * code-by-code contract test for the result table of BR32.8. Nothing is mocked: the data API, the row-level
 * policies and the sign-in service are the stack's own.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`database adapters in ${schema}`, () => {
    let db: pg.Client;
    const database = createDatabaseClient({
      url: apiUrl,
      publicKey: settings.publicKey,
      sessionSecret: SESSION_SECRET,
      schema,
    });
    const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
    const production = createProductionServices(database);
    const tokens = new Map<string, string>();

    /** The services of a request signed in as the account, with a real token from the sign-in service. */
    async function services(who: Who): Promise<RequestServices> {
      const account = ACCOUNTS[who];
      let token = tokens.get(account);
      if (!token) {
        // The seeded test identities are bare rows (made for tests that never sign in): give them the
        // service's instance and a password hash, then sign in through the service. The password is written
        // with SQL on purpose: the service's own password change ends every session of the user, and the
        // seeded identities are shared with test files running at the same moment, whose sessions it would
        // delete (the cause of the intermittent "session_inactive" failures; see code-summary.md).
        await db.query(
          `update auth.users set instance_id = '00000000-0000-0000-0000-000000000000',
                  encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
                  email_confirmed_at = coalesce(email_confirmed_at, now()),
                  confirmation_token = coalesce(confirmation_token, ''),
                  recovery_token = coalesce(recovery_token, ''),
                  email_change_token_new = coalesce(email_change_token_new, ''),
                  email_change = coalesce(email_change, ''),
                  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb),
                  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
            where id = $1`,
          [account, PASSWORD],
        );
        const signedIn = await service.passwordSignIn(`identity.${account}@example.test`, PASSWORD);
        assert.ok(signedIn.ok, `the sign-in service accepts ${who}`);
        token = signedIn.value.accessToken;
        tokens.set(account, token);
      }
      return production.forRequest(token);
    }

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      // A group administrator is also a parent (BR3.2): the first one holds the parent right of their own family.
      await db.query(
        "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'parent', 'family', $2, $3)",
        [ADMIN_G1, FAMILY_ADMIN_G1, ORGANIZATION],
      );
    });

    const admin = async (
      who: Who,
      operation: AdminOperation,
      payload: Record<string, unknown> = {},
      key = nextKey("adm"),
    ) => {
      const { database: asPerson } = await services(who);
      const scope = {
        id: ORGANIZATION,
        type: "organization" as const,
        organizationId: ORGANIZATION,
      };
      return createAdminPort(asPerson).execute<unknown>({
        actorId: ACCOUNTS[who],
        operation,
        scope,
        payload,
        idempotencyKey: key,
      }) as Promise<Outcome & { data: AdminData }>;
    };

    const parent = async (who: "parent" | "parentOther") => {
      const { database: asPerson } = await services(who);
      return createParentPort(asPerson);
    };
    const asParent = async (who: "parent" | "parentOther") => {
      const port = await parent(who);
      const base = { actorId: ACCOUNTS[who], familyId: "ignored" };
      return {
        list: async () => port.listDuties(base),
        get: (dutyId: string) => port.getDuty!({ ...base, dutyId }),
        /** The version a screen would send for the task: the place version when the family has one. */
        async versionOf(dutyId: string) {
          const detail = await port.getDuty!({ ...base, dutyId });
          assert.equal(detail.state, "success");
          return detail.state === "success" ? detail.data.version : 0;
        },
        signUp: (dutyId: string, expectedVersion: number, key = nextKey("su")) =>
          port.signUp({ ...base, dutyId, expectedVersion, idempotencyKey: key }),
        swap: (
          assignmentId: string,
          counterpartId: string,
          expectedVersion: number,
          counterpartVersion: number,
        ) =>
          port.requestSwap({
            ...base,
            assignmentId,
            counterpartId,
            expectedVersion,
            counterpartVersion,
            idempotencyKey: nextKey("sw"),
          }),
        cancel: (assignmentId: string, expectedVersion: number) =>
          port.requestCancellation({
            ...base,
            assignmentId,
            expectedVersion,
            idempotencyKey: nextKey("cn"),
          }),
        candidates: (assignmentId: string) => port.listSwapCandidates!({ ...base, assignmentId }),
        incoming: () => port.listSwapRequests!(base),
        respond: (requestId: string, accept: boolean) =>
          port.respondToSwap!({ ...base, requestId, accept, idempotencyKey: nextKey("rs") }),
        withdraw: (requestId: string) =>
          port.withdrawRequest!({ ...base, requestId, idempotencyKey: nextKey("wd") }),
        note: (dutyId: string, note: string) =>
          port.updateOwnContribution({
            ...base,
            eventId: dutyId,
            note,
            idempotencyKey: nextKey("nt"),
          }),
        notifications: () => port.listNotifications({ actorId: base.actorId }),
      };
    };

    const sql = async (text: string, values: unknown[] = []) => (await db.query(text, values)).rows;
    const version = async (table: string, id: string) =>
      (await sql(`select version from ${table} where id = $1`, [id]))[0].version as number;

    /** The swap world: family 1 holds a place on task 4 and family 2 on task 5, both of group 1. */
    async function swapWorld() {
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      await db.query(
        `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
         values ($1, $3, $4, 'Kert', 2, now() + interval '14 days', now() + interval '14 days 2 hours', 'Kert'),
                ($2, $3, $4, 'Műhely', 2, now() + interval '15 days', now() + interval '15 days 2 hours', 'Műhely')`,
        [TASK_4, TASK_5, ORGANIZATION, GROUP_1],
      );
      await db.query(
        `insert into assignments (id, organization_id, task_id, family_id, parent_id, source)
         values ($1, $3, $4, $5, $6, 'parent_sign_up'), ($2, $3, $7, $8, $9, 'parent_sign_up')`,
        [
          A_F1_T4,
          A_F2_T5,
          ORGANIZATION,
          TASK_4,
          FAMILY_1,
          PARENT_ROW_F1,
          TASK_5,
          FAMILY_2,
          PARENT_ROW_F2,
        ],
      );
    }

    describe("the signed-in session", () => {
      it("reads the family, the reach and the teacher's groups from the database as the person", async () => {
        const parentAccess = await resolveParentAccess(
          (await services("parent")).database,
          PARENT_F1,
        );
        assert.equal(parentAccess.state, "success");
        if (parentAccess.state === "success") {
          assert.equal(parentAccess.data.familyId, FAMILY_1);
          assert.equal(parentAccess.data.familyScope.organizationId, ORGANIZATION);
          assert.equal(parentAccess.data.applicationSession.subjectId, PARENT_F1);
          assert.equal(parentAccess.data.applicationSession.authorizationVersion, 1);
        }
        const other = await resolveParentAccess(
          (await services("parentOther")).database,
          PARENT_F2,
        );
        assert.equal(other.state === "success" && other.data.familyId, FAMILY_2);

        const group = await resolveAdminAccess((await services("adminSame")).database, ADMIN_G1);
        assert.equal(group.state === "success" && group.data.scope.id, GROUP_1);
        const superAdmin = await resolveAdminAccess(
          (await services("super")).database,
          SUPER_ADMIN,
        );
        assert.equal(superAdmin.state === "success" && superAdmin.data.scope.type, "organization");
        const teacher = await resolveTeacherAccess(
          (await services("teacher")).database,
          TEACHER_G1,
        );
        assert.equal(teacher.state, "success");
      });

      it("denies a person the page of a role they do not hold, pointing at their own home", async () => {
        const parentAsAdmin = await resolveAdminAccess(
          (await services("parent")).database,
          PARENT_F1,
        );
        assert.deepEqual(parentAsAdmin, { state: "denied", homePath: "/szulo/ertesitesek" });
        const adminAsParent = await resolveParentAccess(
          (await services("adminOther")).database,
          ADMIN_G2,
        );
        assert.deepEqual(adminAsParent, { state: "denied", homePath: "/admin" });
        const teacherAsAdmin = await resolveAdminAccess(
          (await services("teacher")).database,
          TEACHER_G1,
        );
        assert.deepEqual(teacherAsAdmin, { state: "denied", homePath: "/teacher/schedule" });
        const nobody = await resolveParentAccess((await services("outsider")).database, OUTSIDER);
        assert.deepEqual(nobody, { state: "denied" });
      });

      it("reads a family as archived the moment it is archived", async () => {
        await db.query(
          "update families set status = 'archived', archived_at = now() where id = $1",
          [FAMILY_1],
        );
        const access = await resolveParentAccess((await services("parent")).database, PARENT_F1);
        assert.equal(access.state, "denied");
      });

      it("carries a real access token to the database and nothing else", async () => {
        const { database: asPerson } = await services("parent");
        assert.equal(asPerson.schema, schema);
        const rows = (
          await sql("select count(*)::int as n from auth.sessions where user_id = $1", [PARENT_F1])
        )[0];
        assert.ok(rows.n >= 1, "the sign-in created a session");
      });
    });

    describe("the parent port", () => {
      it("lists every open task of the community with its state, whichever group owns it (BR4.1)", async () => {
        const f1 = await (await asParent("parent")).list();
        assert.equal(f1.state, "success");
        if (f1.state !== "success") return;
        const byTitle = Object.fromEntries(f1.data.duties.map((duty) => [duty.title, duty]));
        assert.equal(byTitle["Sütés"]?.state, "cancellation-pending");
        assert.equal(byTitle["Kerti munka"]?.state, "available");
        assert.equal(byTitle["Díszítés"]?.state, "available", "a task of another group is listed");
        assert.equal(byTitle["Idegen feladat"], undefined, "another community's task is not");
        const f2 = await (await asParent("parentOther")).list();
        assert.equal(f2.state, "success");
        if (f2.state === "success") {
          assert.deepEqual(f2.data.duties.map((duty) => duty.title).sort(), [
            "Díszítés",
            "Kerti munka",
            "Sütés",
          ]);
        }
      });

      it("shows the task detail with the notes only to the family that holds a place", async () => {
        const own = await (await asParent("parent")).get(TASK_1);
        assert.equal(own.state, "success");
        if (own.state === "success") {
          assert.equal(own.data.allergenNote, "mogyoró");
          assert.equal(own.data.ownContributionNote, "Almás pite");
          assert.equal(own.data.assignmentId, ASSIGNMENT_F1_T1);
          assert.equal(own.data.state, "cancellation-pending");
        }
        const stranger = await (await asParent("parentOther")).get(TASK_1);
        assert.equal(stranger.state, "success");
        if (stranger.state === "success") {
          assert.equal(stranger.data.allergenNote, undefined);
          assert.equal(stranger.data.ownContributionNote, undefined);
          assert.equal(stranger.data.state, "available");
        }
        assert.deepEqual(await (await asParent("parent")).get(uuid(99999)), { state: "denied" });
        assert.deepEqual(await (await asParent("parent")).get("not-an-id"), { state: "denied" });
      });

      it("signs the family up, repeats a key without a second place, and refuses with the screens' codes", async () => {
        const f1 = await asParent("parent");
        const taskVersion = await f1.versionOf(TASK_2);
        const key = nextKey("same");
        const first = await f1.signUp(TASK_2, taskVersion, key);
        assert.equal(first.state, "success");
        const again = await f1.signUp(TASK_2, taskVersion, key);
        assert.equal(again.state, "success");
        assert.equal(
          again.state === "success" && again.data.id,
          first.state === "success" && first.data.id,
        );
        assert.equal(
          await count(db, "assignments", `task_id = '${TASK_2}' and family_id = '${FAMILY_1}'`),
          1,
        );
        refused(await f1.signUp(TASK_2, taskVersion + 1), "conflict", "DUTY_ALREADY_ASSIGNED");
        refused(await f1.signUp(TASK_2, 1), "invalidated", "DUTY_VERSION_STALE");
        const f2 = await asParent("parentOther");
        refused(await f2.signUp(TASK_2, await f2.versionOf(TASK_2)), "conflict", "DUTY_FULL");
      });

      it("saves the family's contribution note, and not for a task it holds no place on", async () => {
        const f1 = await asParent("parent");
        const saved = await f1.note(TASK_1, "  Gyümölcs  ");
        assert.deepEqual(saved, { state: "success", data: { eventId: TASK_1, note: "Gyümölcs" } });
        const detail = await f1.get(TASK_1);
        assert.equal(detail.state === "success" && detail.data.ownContributionNote, "Gyümölcs");
        assert.deepEqual(await f1.note(TASK_2, "x"), { state: "denied" });
        assert.equal((await f1.note(TASK_1, "x".repeat(501))).state, "validation");
      });

      it("has no notifications for a real parent until U4", async () => {
        assert.deepEqual(await (await asParent("parent")).notifications(), { state: "empty" });
      });

      it("runs a swap: partners, request, the other family's list, confirmation and the exchange", async () => {
        await swapWorld();
        const f1 = await asParent("parent");
        const f2 = await asParent("parentOther");
        const partners = await f1.candidates(A_F1_T4);
        assert.equal(partners.state, "success");
        if (partners.state !== "success") return;
        const partner = partners.data.candidates.find((entry) => entry.assignmentId === A_F2_T5);
        assert.ok(partner, "family 2's place is offered");
        assert.deepEqual(Object.keys(partner).sort(), [
          "assignmentId",
          "assignmentVersion",
          "familyDisplayName",
          "startsAt",
          "taskId",
          "title",
        ]);
        assert.equal(partner.familyDisplayName, "Napraforgó család");

        const requested = await f1.swap(
          A_F1_T4,
          partner.assignmentId,
          await f1.versionOf(TASK_4),
          partner.assignmentVersion,
        );
        assert.equal(requested.state, "success");
        if (requested.state !== "success") return;
        const seen = await f2.incoming();
        assert.equal(seen.state, "success");
        if (seen.state !== "success") return;
        const incoming = seen.data.requests.find((entry) => entry.id === requested.data.id);
        assert.equal(incoming?.direction, "incoming");
        assert.equal(incoming?.partnerFamilyName, "Fenyő család");
        const own = await f1.incoming();
        assert.equal(
          own.state === "success" &&
            own.data.requests.some((entry) => entry.direction === "outgoing"),
          true,
        );

        const answered = await f2.respond(requested.data.id, true);
        assert.deepEqual(answered, {
          state: "success",
          data: { id: requested.data.id, outcome: "applied" },
        });
        assert.equal(
          (await sql("select task_id from assignments where id = $1", [A_F1_T4]))[0].task_id,
          TASK_5,
          "the places were exchanged",
        );
        refused(await f2.respond(requested.data.id, true), "conflict", "SWAP_REQUEST_NOT_OPEN");
      });

      it("lets the other family decline and the requester withdraw", async () => {
        await swapWorld();
        const f1 = await asParent("parent");
        const f2 = await asParent("parentOther");
        const partnerVersion = await version("assignments", A_F2_T5);
        const requested = await f1.swap(
          A_F1_T4,
          A_F2_T5,
          await version("assignments", A_F1_T4),
          partnerVersion,
        );
        assert.equal(requested.state, "success");
        if (requested.state !== "success") return;
        const declined = await f2.respond(requested.data.id, false);
        assert.deepEqual(declined, {
          state: "success",
          data: { id: requested.data.id, outcome: "declined" },
        });
        assert.equal(
          (await sql("select status from assignments where id = $1", [A_F1_T4]))[0].status,
          "active",
        );
        const second = await f1.swap(
          A_F1_T4,
          A_F2_T5,
          await version("assignments", A_F1_T4),
          await version("assignments", A_F2_T5),
        );
        assert.equal(second.state, "success");
        if (second.state !== "success") return;
        const withdrawn = await f1.withdraw(second.data.id);
        assert.deepEqual(withdrawn, {
          state: "success",
          data: { id: second.data.id, state: "withdrawn" },
        });
        refused(await f2.respond(second.data.id, true), "conflict", "SWAP_REQUEST_NOT_OPEN");
        assert.deepEqual(await f2.withdraw(second.data.id), { state: "denied" });
      });

      it("refuses an answer from the requester's own family", async () => {
        await swapWorld();
        const f1 = await asParent("parent");
        const requested = await f1.swap(
          A_F1_T4,
          A_F2_T5,
          await version("assignments", A_F1_T4),
          await version("assignments", A_F2_T5),
        );
        assert.equal(requested.state, "success");
        if (requested.state === "success")
          assert.deepEqual(await f1.respond(requested.data.id, true), { state: "denied" });
      });

      it("takes a cancellation request that an admin then decides", async () => {
        const f1 = await asParent("parent");
        const created = await f1.cancel(ASSIGNMENT_F1_T1, 1);
        refused(created, "conflict", "REQUEST_DUPLICATE");
        await db.query("update change_requests set status = 'withdrawn' where id = $1", [
          REQUEST_1,
        ]);
        await db.query("update assignments set status = 'active' where id = $1", [
          ASSIGNMENT_F1_T1,
        ]);
        const fresh = await f1.cancel(
          ASSIGNMENT_F1_T1,
          await version("assignments", ASSIGNMENT_F1_T1),
        );
        assert.equal(fresh.state, "success");
        if (fresh.state !== "success") return;
        const approvals = await admin("adminSame", "approvals.list", { state: "pending" });
        assert.equal(approvals.state, "success");
        const item = must(
          approvals.data.items.find((entry) => entry.id === fresh.data.id),
          "the new request is listed",
        );
        assert.equal(item.title, "Lemondási kérelem – Sütés");
        const decided = await admin("adminSame", "approvals.decide", {
          id: fresh.data.id,
          expectedVersion: item.version,
          decision: "approved",
        });
        assert.deepEqual(decided, { state: "success", data: { outcome: "approved" } });
        assert.equal(
          (await sql("select status from assignments where id = $1", [ASSIGNMENT_F1_T1]))[0].status,
          "removed",
        );
      });
    });

    describe("the admin port", () => {
      it("shows the dashboard counts of the admin's reach", async () => {
        const group1 = await admin("adminSame", "dashboard.get");
        assert.deepEqual(group1.data, {
          scopeId: ORGANIZATION,
          openApprovals: 1,
        });
        const group2 = await admin("adminOther", "dashboard.get");
        assert.equal(group2.data.openApprovals, 0);
        assert.deepEqual((await admin("teacher", "dashboard.get")).state, "denied");
      });

      it("lists and reads records of every kind within the reach, with filters", async () => {
        const all = await admin("super", "records.list");
        assert.equal(all.state, "success");
        const titles = all.data.items.map((item) => item.title);
        for (const title of [
          "Fenyő család",
          "Napraforgó család",
          "Boróka",
          "Napraforgó",
          "2026/2027",
          "Fenyő Gergő",
        ]) {
          assert.ok(titles.includes(title), title);
        }
        assert.ok(!titles.includes("Idegen család"), "another organization's family is not listed");
        const filtered = await admin("super", "records.list", { q: "fenyő" });
        assert.ok(filtered.data.items.every((item) => /fenyő/i.test(item.title)));
        assert.deepEqual(
          await admin("adminSame", "records.list", { q: "fenyő" }),
          { state: "empty" },
          "the policies show a group admin no family record (BR3.9); the facade refuses them first",
        );
        assert.deepEqual(await admin("super", "records.list", { q: "nincs ilyen nev" }), {
          state: "empty",
        });
        const one = await admin("super", "records.get", { id: FAMILY_1 });
        assert.equal(one.data.id, FAMILY_1);
        assert.equal(one.data.title, "Fenyő család");
        assert.equal(one.data.state, "active");
        assert.equal(one.data.version, 1);
        // The form's fields: kind, parents with their contact details and children.
        assert.equal(one.data.kind, "family");
        const names = one.data.details.parents.map((parent) => parent.displayName);
        assert.ok(names.includes("Fenyő Anna"), "the parents are listed");
        const anna = must(
          one.data.details.parents.find((parent) => parent.displayName === "Fenyő Anna"),
          "Anna is listed",
        );
        assert.equal(anna.email, "anna@example.test");
        assert.equal(anna.linked, true);
        assert.ok(one.data.details.children.some((child) => child.displayName === "Fenyő Gergő"));
        assert.deepEqual(await admin("adminSame", "records.get", { id: FAMILY_1 }), {
          state: "denied",
        });
        assert.deepEqual(await admin("adminOther", "records.get", { id: FAMILY_NO_GROUP }), {
          state: "denied",
        });
      });

      it("opens the family of a parent who consented to a profile but wrote no text (regression: a NULL scalar was a terminal failure)", async () => {
        await db.query(
          "update parents set optional_profile_consent = true, optional_profile = null where id = $1",
          [PARENT_ROW_F1],
        );
        const one = await admin("super", "records.get", { id: FAMILY_1 });
        assert.equal(one.state, "success", JSON.stringify(one));
        const consenting = must(
          one.data.details.parents.find((entry) => entry.optionalProfileConsent === true),
          "the consenting parent is listed",
        );
        assert.equal(consenting.optionalProfile, undefined, "no text, no profile shown");
        // A profile with text still comes through.
        await db.query("update parents set optional_profile = 'Szívesen főzök.' where id = $1", [
          PARENT_ROW_F1,
        ]);
        const filled = await admin("super", "records.get", { id: FAMILY_1 });
        assert.equal(
          filled.data.details.parents.find((entry) => entry.optionalProfileConsent === true)
            ?.optionalProfile,
          "Szívesen főzök.",
        );
      });

      it("saves a family with parents, contact details and a child, then changes only its name (super admin, BR3.9)", async () => {
        const created = await admin("super", "records.save", {
          id: "new",
          expectedVersion: 1,
          kind: "family",
          displayName: "Új család",
          parents: [
            {
              displayName: "Új Anna",
              email: "uj.anna@example.test",
              phone: "+36 30 123 4567",
              locality: "Pécs",
              optionalProfile: "Szívesen főzök.",
              optionalProfileConsent: true,
            },
          ],
          children: [{ displayName: "Új Gyerek" }],
        });
        assert.equal(created.state, "success");
        const id = created.data.id as string;
        assert.equal(await count(db, "parents", `family_id = '${id}'`), 1);
        assert.equal(
          await count(db, "parent_contacts", "contact_email = 'uj.anna@example.test'"),
          1,
        );
        const renamed = await admin("super", "records.save", {
          id,
          expectedVersion: created.data.version,
          title: "Új család 2",
        });
        assert.equal(renamed.state, "success");
        assert.equal(
          await count(db, "parents", `family_id = '${id}' and display_name = 'Új Anna'`),
          1,
          "the parent stayed",
        );
        assert.equal(await count(db, "children", `family_id = '${id}'`), 1, "the child stayed");
        refused(
          await admin("super", "records.save", { id, expectedVersion: 1, title: "Régi" }),
          "conflict",
          "VERSION_CONFLICT",
        );
        const outside = await admin("adminSame", "records.save", {
          id,
          expectedVersion: 9,
          title: "x",
        });
        assert.equal(outside.state, "denied");
      });

      it("refuses an invalid field with the field named", async () => {
        const bad = await admin("super", "records.save", {
          id: "new",
          expectedVersion: 1,
          kind: "family",
          displayName: "Hibás",
          parents: [{ displayName: "Hiba", email: "not an address" }],
        });
        assert.equal(bad.state, "validation");
        assert.deepEqual(bad.fieldErrors, { "parents.contact.email": "VAL-INVALID" });
        assert.equal(
          await count(db, "families", "display_name = 'Hibás'"),
          0,
          "nothing was half-written",
        );
      });

      it("saves, renames and archives groups and school years, and a child through its family", async () => {
        const year = await admin("super", "records.save", {
          id: "new",
          expectedVersion: 1,
          kind: "school-year",
          name: "2027/2028",
          startsOn: "2027-09-01",
          endsOn: "2028-06-30",
        });
        assert.equal(year.state, "success");
        const group = await admin("super", "records.save", {
          id: "new",
          expectedVersion: 1,
          kind: "group",
          name: "Méhecske",
          description: "Méhecske munkacsoport.",
          schoolYearId: year.data.id,
        });
        assert.equal(group.state, "success");
        const renamed = await admin("super", "records.save", {
          id: group.data.id,
          expectedVersion: group.data.version,
          title: "Méhecske 2",
        });
        assert.equal(renamed.state, "success");
        const archived = await admin("super", "records.archive", {
          id: group.data.id,
          expectedVersion: renamed.data.version,
        });
        assert.deepEqual(archived, { state: "success", data: { completed: true } });
        const restored = await admin("super", "records.restore", {
          id: group.data.id,
          expectedVersion: renamed.data.version + 1,
        });
        assert.deepEqual(restored, { state: "success", data: { completed: true } });
        const forbidden = await admin("adminSame", "records.save", {
          id: "new",
          expectedVersion: 1,
          kind: "school-year",
          name: "X",
          startsOn: "2030-01-01",
          endsOn: "2030-12-31",
        });
        assert.equal(forbidden.state, "denied");

        const child = await admin("super", "records.save", {
          id: "new",
          kind: "child",
          familyId: FAMILY_1,
          title: "Fenyő Hanna",
        });
        assert.equal(child.state, "success");
        assert.equal(child.data.title, "Fenyő Hanna");
        const edited = await admin("super", "records.save", {
          id: child.data.id,
          expectedVersion: child.data.version,
          title: "Fenyő Hanna 2",
        });
        assert.equal(edited.data.title, "Fenyő Hanna 2");
        assert.equal(
          (
            await admin("super", "records.archive", {
              id: child.data.id,
              expectedVersion: edited.data.version,
            })
          ).state,
          "success",
        );
      });

      it("archives a family, withdrawing its future places, and restores it (super admin, BR3.9)", async () => {
        assert.deepEqual(
          await admin("adminSame", "records.archive", { id: FAMILY_1, expectedVersion: 1 }),
          { state: "denied" },
        );
        const archived = await admin("super", "records.archive", {
          id: FAMILY_1,
          expectedVersion: 1,
        });
        assert.deepEqual(archived, { state: "success", data: { completed: true } });
        assert.equal(
          (await sql("select status from assignments where id = $1", [ASSIGNMENT_F1_T1]))[0].status,
          "removed",
        );
        const listed = await admin("super", "records.list", { state: "archived" });
        assert.ok(listed.data.items.some((item) => item.id === FAMILY_1));
        const restored = await admin("super", "records.restore", {
          id: FAMILY_1,
          expectedVersion: 2,
        });
        assert.deepEqual(restored, { state: "success", data: { completed: true } });
      });

      it("lists, saves and reads events and tasks and clears or changes event notes", async () => {
        const all = await admin("adminSame", "tasks.list");
        assert.equal(all.state, "success");
        const titles = all.data.items.map((item) => item.title);
        assert.ok(titles.includes("Őszi ünnep") && titles.includes("Sütés"));
        assert.ok(!titles.includes("Díszítés"), "a task of another group is outside the reach");
        const eventItem = must(
          all.data.items.find((item) => item.title === "Őszi ünnep"),
          "the event is listed",
        );
        assert.equal(eventItem.state, "scheduled");
        const renamed = await admin("adminSame", "tasks.save", {
          id: EVENT_1,
          expectedVersion: eventItem.version,
          kind: "event",
          title: "Őszi ünnep 2",
        });
        assert.equal(renamed.state, "success");
        const taskItem = must(
          all.data.items.find((item) => item.id === TASK_1),
          "the task is listed",
        );
        const changed = await admin("adminSame", "tasks.save", {
          id: TASK_1,
          expectedVersion: taskItem.version,
          title: "Sütés 2",
          capacity: 4,
        });
        assert.equal(changed.state, "success");
        assert.equal(
          (await sql("select capacity, event_id from tasks where id = $1", [TASK_1]))[0].capacity,
          4,
        );
        const created = await admin("adminSame", "tasks.save", {
          id: "new",
          kind: "task",
          title: "Új feladat",
          groupId: GROUP_1,
          capacity: 2,
          startsAt: new Date(Date.now() + 20 * 86_400_000).toISOString(),
          endsAt: new Date(Date.now() + 20 * 86_400_000 + 3_600_000).toISOString(),
          location: "Udvar",
        });
        assert.equal(created.state, "success");
        const notes = await admin("adminSame", "notes.save", {
          id: EVENT_1,
          expectedVersion: renamed.data.version,
          allergenNote: "tej",
          supplyNote: "",
          foodNote: "pite",
        });
        assert.equal(notes.state, "success");
        const stored = (
          await sql("select allergen_note, supply_note, food_note from events where id = $1", [
            EVENT_1,
          ])
        )[0];
        assert.deepEqual(stored, { allergen_note: "tej", supply_note: null, food_note: "pite" });
        assert.equal(
          (await admin("adminOther", "tasks.save", { id: TASK_1, expectedVersion: 1, title: "x" }))
            .state,
          "denied",
        );
      });

      it("gives a place to a chosen family and removes it", async () => {
        const task = await version("tasks", TASK_1);
        const assigned = await admin("super", "assignments.assign", {
          id: TASK_1,
          expectedVersion: task,
          familyId: FAMILY_2,
        });
        assert.equal(assigned.state, "success");
        assert.equal(
          await count(db, "assignments", `task_id = '${TASK_1}' and family_id = '${FAMILY_2}'`),
          1,
        );
        const placeId = (
          await sql("select id, version from assignments where task_id = $1 and family_id = $2", [
            TASK_1,
            FAMILY_2,
          ])
        )[0];
        const removed = await admin("super", "assignments.remove", {
          id: placeId.id,
          expectedVersion: placeId.version,
        });
        assert.equal(removed.state, "success");
        assert.equal(
          (await sql("select status from assignments where id = $1", [placeId.id]))[0].status,
          "removed",
        );
        assert.equal(
          (await admin("super", "assignments.assign", { id: TASK_1, expectedVersion: 1 })).state,
          "validation",
        );
      });

      it("reads and saves the reminder setting, and lists and revokes grants", async () => {
        const current = await admin("super", "settings.get");
        assert.equal(current.state, "success");
        assert.equal(current.data.remindersEnabled, true);
        const saved = await admin("super", "settings.save", {
          expectedVersion: current.data.version,
          recipientId: "recipient-group",
          remindersEnabled: "no",
        });
        assert.deepEqual(saved, {
          state: "success",
          data: {
            selectedRecipientId: "recipient-group",
            remindersEnabled: false,
            version: current.data.version + 1,
          },
        });
        assert.equal((await admin("adminSame", "settings.get")).state, "success");
        assert.equal(
          (
            await admin("adminSame", "settings.save", {
              expectedVersion: 2,
              recipientId: "recipient-duty",
            })
          ).state,
          "denied",
        );

        const grants = await admin("super", "governance.list");
        assert.equal(grants.state, "success");
        const mine = must(
          grants.data.grants.find((grant) => grant.isSelf),
          "the own grant is listed",
        );
        assert.equal(mine.scopeLabel, "Teljes szervezet");
        const target = must(
          grants.data.grants.find((grant) => grant.role === "kindergarten_teacher"),
          "the teacher grant is listed",
        );
        assert.equal(target.scopeLabel, "Teljes szervezet", "a teacher serves the whole community");
        const revoked = await admin("super", "governance.update", {
          id: target.id,
          expectedVersion: target.version,
        });
        assert.equal(revoked.state, "success");
        assert.equal(revoked.data.invalidatedSubjectId, TEACHER_G1);
        assert.equal(revoked.data.authorizationVersion, target.version + 1);
        assert.equal((await admin("adminSame", "governance.list")).state, "denied");
        const teacherAccess = await resolveTeacherAccess(
          (await services("teacher")).database,
          TEACHER_G1,
        );
        assert.equal(
          teacherAccess.state,
          "denied",
          "the role change took effect on the next request",
        );
      });

      it("lists lifecycle candidates and deletes or anonymizes a family after the grace period", async () => {
        await db.query(
          "update families set status = 'archived', archived_at = now() - interval '40 days' where id = $1",
          [FAMILY_NO_GROUP],
        );
        const listed = await admin("super", "lifecycle.list", {});
        assert.equal(listed.state, "success");
        const candidate = must(
          listed.data.candidates.find((entry) => entry.id === FAMILY_NO_GROUP),
          "the archived family is a candidate",
        );
        assert.equal(candidate.eligibility, "eligible-delete");
        const ran = await admin("super", "lifecycle.run", {
          id: FAMILY_NO_GROUP,
          expectedVersion: candidate.version,
          confirmed: "yes",
        });
        assert.equal(ran.state, "success");
        assert.equal(ran.data.state, "deleted");
        assert.match(ran.data.auditEvidenceId, /^[0-9a-f-]{36}$/);
        assert.equal(await count(db, "families", `id = '${FAMILY_NO_GROUP}'`), 0);
        assert.deepEqual(await admin("super", "lifecycle.list", {}), { state: "empty" });
        assert.equal((await admin("adminSame", "lifecycle.list", {})).state, "denied");
      });
    });

    describe("the teacher port", () => {
      it("returns the whole community, one group or community-wide items with the people's names and nothing private (BR3.7, W6)", async () => {
        const { database: asTeacher } = await services("teacher");
        const port = createTeacherPort(asTeacher);
        const scope = {
          id: ORGANIZATION,
          type: "organization" as const,
          organizationId: ORGANIZATION,
        };
        const groupView = { kind: "group" as const, groupId: GROUP_1 };
        const outcome = await port.getSchedule({
          actorId: TEACHER_G1,
          scope,
          view: groupView,
        });
        assert.equal(outcome.state, "success");
        if (outcome.state !== "success") return;
        const titles = outcome.data.entries.map((entry) => entry.title);
        assert.deepEqual(titles, ["Sütés", "Kerti munka"]);
        const baking = outcome.data.entries[0]!;
        assert.equal(baking.coordinationDisplayName, "Kovács Mária");
        assert.equal(baking.ownerDisplayName, "Fenyő család");
        assert.equal(baking.currentStatusLabel, "Nyitott");
        assert.ok(!JSON.stringify(outcome).includes("example.test"), "no contact detail");
        assert.ok(!JSON.stringify(outcome).includes("mogyoró"), "no allergen note");
        const all = await port.getSchedule({ actorId: TEACHER_G1, scope, view: { kind: "all" } });
        assert.equal(all.state === "success" && all.data.entries.length, 3);
        assert.deepEqual(
          await port.getSchedule({ actorId: TEACHER_G1, scope, view: { kind: "community" } }),
          { state: "empty" },
          "no community-wide item yet",
        );
        assert.deepEqual(
          await port.getSchedule({
            actorId: TEACHER_G1,
            scope,
            view: { kind: "group", groupId: GROUP_OTHER },
          }),
          { state: "denied" },
          "another community's group",
        );
        const range = await port.getSchedule({
          actorId: TEACHER_G1,
          scope,
          view: groupView,
          from: "2000-01-01",
          to: "2000-01-02",
        });
        assert.deepEqual(range, { state: "empty" });
      });
    });

    describe("the facades with the production authorization", () => {
      it("lets a parent sign up and answer a swap through the facade, and denies the actions of other roles", async () => {
        await swapWorld();
        const request = await services("parent");
        const access = await resolveParentAccess(request.database, PARENT_F1);
        assert.equal(access.state, "success");
        if (access.state !== "success") return;
        const input = { familyScope: access.data.familyScope, familyId: access.data.familyId };
        const session = access.data.applicationSession;
        const list = await request.parent.listDuties(session, input);
        assert.equal(list.state, "success");
        const signUp = await request.parent.signUp(session, {
          ...input,
          dutyId: TASK_2,
          expectedVersion: await version("tasks", TASK_2),
          idempotencyKey: nextKey("fac-su"),
        });
        assert.equal(signUp.state, "success");

        const f2 = await services("parentOther");
        const f2Access = await resolveParentAccess(f2.database, PARENT_F2);
        assert.equal(f2Access.state, "success");
        if (f2Access.state !== "success") return;
        const f2Input = {
          familyScope: f2Access.data.familyScope,
          familyId: f2Access.data.familyId,
        };
        const requested = await request.parent.requestSwap(session, {
          ...input,
          assignmentId: A_F1_T4,
          counterpartId: A_F2_T5,
          expectedVersion: 1,
          counterpartVersion: 1,
          idempotencyKey: nextKey("fac-sw"),
        });
        assert.equal(requested.state, "success");
        if (requested.state !== "success") return;
        const incoming = await f2.parent.listSwapRequests(
          f2Access.data.applicationSession,
          f2Input,
        );
        assert.equal(incoming.state, "success");
        const answered = await f2.parent.respondToSwap(f2Access.data.applicationSession, {
          ...f2Input,
          requestId: requested.data.id,
          accept: true,
          idempotencyKey: nextKey("fac-rs"),
        });
        assert.equal(answered.state, "success");
        const notice = await request.parent.listNotifications(session, input.familyScope);
        // The swap the other family accepted is a real notice for this parent now (BR40.9), not the empty state.
        assert.equal(notice.state, "success");
        if (notice.state === "success") {
          assert.ok(
            notice.data.notifications.some((item) => item.title.startsWith("Csere")),
            "a swap notice",
          );
        }

        // The admin facade is closed to a parent, and the parent facade to a teacher's session.
        const asAdmin = await request.admin.getDashboard(session, input.familyScope);
        assert.equal(asAdmin.state, "denied");
        const teacher = await services("teacher");
        const teacherAccess = await resolveTeacherAccess(teacher.database, TEACHER_G1);
        assert.equal(teacherAccess.state, "success");
        if (teacherAccess.state === "success") {
          const denied = await teacher.parent.respondToSwap(teacherAccess.data.applicationSession, {
            ...input,
            requestId: requested.data.id,
            accept: true,
            idempotencyKey: nextKey("fac-x"),
          });
          assert.equal(denied.state, "denied");
        }
      });

      it("serves the admin facade and the teacher facade", async () => {
        const request = await services("super");
        const access = await resolveAdminAccess(request.database, SUPER_ADMIN);
        assert.equal(access.state, "success");
        if (access.state !== "success") return;
        const dashboard = await request.admin.getDashboard(
          access.data.applicationSession,
          access.data.scope,
        );
        assert.equal(dashboard.state, "success");
        const records = await request.admin.listRecords(
          access.data.applicationSession,
          access.data.scope,
          {},
        );
        assert.equal(records.state, "success");
        const teacher = await services("teacher");
        const teacherAccess = await resolveTeacherAccess(teacher.database, TEACHER_G1);
        assert.equal(teacherAccess.state, "success");
        if (teacherAccess.state !== "success") return;
        const schedule = await teacher.teacher.getSchedule(teacherAccess.data.applicationSession, {
          scope: teacherAccess.data.scope,
          view: { kind: "all" },
        });
        assert.equal(schedule.state, "success");
      });

      it("denies a stale session version after a role change on the very next call", async () => {
        const request = await services("adminSame");
        const access = await resolveAdminAccess(request.database, ADMIN_G1);
        assert.equal(access.state, "success");
        if (access.state !== "success") return;
        const before = await request.admin.getDashboard(
          access.data.applicationSession,
          access.data.scope,
        );
        assert.equal(before.state, "success");
        await db.query(
          "update app_authorization_versions set authorization_version = authorization_version + 1 where subject_id = $1",
          [ADMIN_G1],
        );
        const after = await request.admin.getDashboard(
          access.data.applicationSession,
          access.data.scope,
        );
        assert.equal(after.state, "invalidated");
      });
    });

    describe("the result table of BR32.8, code by code", () => {
      const seen = new Map<string, string>();
      const check = (outcome: Outcome, state: string, code: string) => {
        refused(outcome, state, code);
        seen.set(code, outcome.state);
      };

      it("returns every code with its state through the real functions", async () => {
        // Settings
        const current = await admin("super", "settings.get");
        check(
          await admin("super", "settings.save", {
            expectedVersion: 99,
            recipientId: "recipient-duty",
          }),
          "invalidated",
          "SETTINGS_STALE",
        );
        check(
          await admin("super", "settings.save", {
            expectedVersion: current.data.version,
            recipientId: "recipient-nobody",
          }),
          "conflict",
          "SETTINGS_RECIPIENT_INVALID",
        );

        // Records and restore
        check(
          await admin("super", "records.save", {
            id: FAMILY_1,
            expectedVersion: 99,
            title: "x",
          }),
          "conflict",
          "VERSION_CONFLICT",
        );
        check(
          await admin("super", "records.restore", { id: FAMILY_1, expectedVersion: 1 }),
          "conflict",
          "RESTORE_CONFLICT",
        );

        // Parent sign-up
        const f1 = await asParent("parent");
        const f2 = await asParent("parentOther");
        check(await f1.signUp(TASK_2, 99), "invalidated", "DUTY_VERSION_STALE");
        check(
          await f1.signUp(TASK_1, await version("tasks", TASK_1)),
          "conflict",
          "DUTY_ALREADY_ASSIGNED",
        );
        const first = await f1.signUp(TASK_2, await version("tasks", TASK_2));
        assert.equal(first.state, "success");
        check(await f2.signUp(TASK_2, await version("tasks", TASK_2)), "conflict", "DUTY_FULL");
        check(
          await f2.signUp(TASK_3, await version("tasks", TASK_3)),
          "conflict",
          "DUTY_ALREADY_ASSIGNED",
        );
        await db.query("update tasks set status = 'closed' where id = $1", [TASK_2]);
        check(await f2.signUp(TASK_2, await version("tasks", TASK_2)), "conflict", "DUTY_CLOSED");
        await db.query("update tasks set status = 'open' where id = $1", [TASK_2]);

        // Admin assignment
        const noGroup = FAMILY_NO_GROUP;
        check(
          await admin("super", "assignments.assign", {
            id: TASK_2,
            expectedVersion: await version("tasks", TASK_2),
            familyId: noGroup,
          }),
          "conflict",
          "ASSIGNMENT_CAPACITY_FULL",
        );

        // Cancellation and swap requests
        const placeId = first.state === "success" ? first.data.id : "";
        check(await f1.cancel(ASSIGNMENT_F1_T1, 1), "conflict", "REQUEST_DUPLICATE");
        check(await f1.cancel(placeId, 99), "invalidated", "REQUEST_VERSION_STALE");
        check(await f1.swap(placeId, ASSIGNMENT_F1_T1, 1, 1), "conflict", "REQUEST_CONFLICT");
        await swapWorld();
        const swapped = await f1.swap(
          A_F1_T4,
          A_F2_T5,
          await version("assignments", A_F1_T4),
          await version("assignments", A_F2_T5),
        );
        assert.equal(swapped.state, "success");
        if (swapped.state !== "success") return;
        await db.query("update tasks set starts_at = now() - interval '1 day' where id = $1", [
          TASK_5,
        ]);
        check(await f2.respond(swapped.data.id, true), "conflict", "SWAP_CANNOT_BE_APPLIED");
        const withdrawnFirst = await f1.withdraw(swapped.data.id);
        assert.equal(withdrawnFirst.state, "success");
        check(await f2.respond(swapped.data.id, true), "conflict", "SWAP_REQUEST_NOT_OPEN");
        await db.query("update tasks set starts_at = now() + interval '15 days' where id = $1", [
          TASK_5,
        ]);
        const second = await f1.swap(
          A_F1_T4,
          A_F2_T5,
          await version("assignments", A_F1_T4),
          await version("assignments", A_F2_T5),
        );
        assert.equal(second.state, "success");
        check(await f1.swap(A_F1_T4, A_F2_T5, 1, 1), "conflict", "REQUEST_DUPLICATE");
        const another = await f2.swap(A_F2_T5, A_F1_T4, 99, 99);
        check(another, "invalidated", "REQUEST_VERSION_STALE");

        // Approvals
        const listed = await admin("adminSame", "approvals.list", { state: "pending" });
        const open = must(
          listed.data.items.find(
            (entry) => entry.id === (second.state === "success" ? second.data.id : ""),
          ),
          "the open request is listed",
        );
        check(
          await admin("adminSame", "approvals.decide", {
            id: open.id,
            expectedVersion: 99,
            decision: "approved",
          }),
          "invalidated",
          "APPROVAL_INVALIDATED",
        );
        assert.equal(
          (
            await admin("adminSame", "approvals.decide", {
              id: open.id,
              expectedVersion: open.version,
              decision: "rejected",
            })
          ).state,
          "success",
        );
        check(
          await admin("adminSame", "approvals.decide", {
            id: open.id,
            expectedVersion: open.version,
            decision: "rejected",
          }),
          "conflict",
          "APPROVAL_ALREADY_DECIDED",
        );

        // Lifecycle
        await db.query(
          "update families set status = 'archived', archived_at = now() where id = $1",
          [FAMILY_NO_GROUP],
        );
        const familyVersion = await version("families", FAMILY_NO_GROUP);
        check(
          await admin("super", "lifecycle.run", {
            id: FAMILY_NO_GROUP,
            expectedVersion: 99,
            confirmed: "yes",
          }),
          "invalidated",
          "LIFECYCLE_STALE",
        );
        check(
          await admin("super", "lifecycle.run", {
            id: FAMILY_NO_GROUP,
            expectedVersion: familyVersion,
            confirmed: "yes",
          }),
          "conflict",
          "LIFECYCLE_BLOCKED",
        );
        await db.query(
          "update families set archived_at = now() - interval '40 days' where id = $1",
          [FAMILY_NO_GROUP],
        );
        check(
          await admin("super", "lifecycle.run", {
            id: FAMILY_NO_GROUP,
            expectedVersion: await version("families", FAMILY_NO_GROUP),
            confirmed: "no",
          }),
          "conflict",
          "LIFECYCLE_CONFIRMATION_REQUIRED",
        );

        // Grants
        const grants = await admin("super", "governance.list");
        const own = must(
          grants.data.grants.find((grant) => grant.isSelf),
          "the own grant is listed",
        );
        const group = must(
          grants.data.grants.find(
            (grant) => grant.role === "group_admin" && grant.subjectLabel.includes(ADMIN_G2),
          ),
          "the other group's admin grant is listed",
        );
        check(
          await admin("super", "governance.update", { id: own.id, expectedVersion: own.version }),
          "conflict",
          "GRANT_SELF_LOCKOUT",
        );
        check(
          await admin("super", "governance.update", { id: group.id, expectedVersion: 99 }),
          "invalidated",
          "GRANT_STALE",
        );

        // GRANT_LAST_SUPER_ADMIN is a guard inside the grant function that no caller can reach through the
        // governance screen: the only account that may revoke a super admin's grant is a super admin, and a
        // revoking super admin is always left standing (their own grant answers GRANT_SELF_LOCKOUT first). It is
        // proven by the mapping table in src/data/results.test.ts instead.
        const unreachable = new Set(["GRANT_LAST_SUPER_ADMIN"]);
        for (const [code, state] of Object.entries(BUSINESS_CODE_STATES)) {
          if (unreachable.has(code)) continue;
          assert.equal(seen.get(code), state, `${code} is returned as ${state}`);
        }
        report(
          `result codes checked on the real stack in ${schema}: ${seen.size} of ${Object.keys(BUSINESS_CODE_STATES).length}`,
        );
      });
    });
  });
}
