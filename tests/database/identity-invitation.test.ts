import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  asServiceRole,
  auditEvents,
  authenticated,
  callAs,
  count,
  FAMILY_1,
  FAMILY_2,
  failureOf,
  GROUP_1,
  GROUP_2,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  seedIdentityWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  tokenHashFor,
  uuid,
} from "./identity-support.ts";
import { openDatabase, report, bindSchema } from "./stack-support.ts";

type Result = Awaited<ReturnType<typeof callAs>>;

/** Invitations: reach per actor, the single open invitation, reservation, atomic acceptance (BR2.9 to BR2.11, NFR1.8, NFR1.23, NFR6.2). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`identity invitations in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
    });

    const email = (tag: string) => `${schema}.${tag}@example.test`;
    let counter = 0;
    const nextKey = () => `key-${(counter += 1)}`;

    const create = (
      account: string,
      args: {
        email?: string;
        role?: string;
        scopeType?: string;
        scope?: string;
        label?: string;
        key?: string;
      } = {},
      session?: string | null,
    ): Promise<Result> =>
      callAs(
        db,
        schema,
        authenticated(account, session),
        "invitation_create($1, $2, $3, $4, $5, $6, null)",
        [
          args.key ?? nextKey(),
          args.email ?? email("invitee"),
          args.role ?? "parent",
          args.scopeType ?? "family",
          args.scope ?? FAMILY_1,
          tokenHashFor(args.label ?? randomUUID()),
        ],
      );
    const status = async (id: string) =>
      (await db.query("select status from invitations where id = $1", [id])).rows[0]
        .status as string;

    /** The sign-in service's user for an invitation: a real row of its table, tagged with the invitation id. */
    async function signInUser(address: string, invitationId?: string): Promise<string> {
      const id = randomUUID();
      await db.query(
        "insert into auth.users (id, aud, role, email, raw_app_meta_data, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, $3, now(), now())",
        [id, address, JSON.stringify(invitationId ? { invitation_id: invitationId } : {})],
      );
      return id;
    }

    describe("create", () => {
      it("lets a super admin invite for any family or group of the organization, storing only the token hash for seven days", async () => {
        const family = await create(SUPER_ADMIN, { label: "a" });
        assert.equal(family.state, "success");
        const group = await create(SUPER_ADMIN, {
          role: "kindergarten_teacher",
          scopeType: "group",
          scope: GROUP_2,
          email: email("teacher"),
        });
        assert.equal(group.state, "success");
        const admin = await create(SUPER_ADMIN, {
          role: "group_admin",
          scopeType: "group",
          scope: GROUP_1,
          email: email("ga"),
        });
        assert.equal(admin.state, "success");
        const top = await create(SUPER_ADMIN, {
          role: "super_admin",
          scopeType: "organization",
          scope: ORGANIZATION,
          email: email("sa"),
        });
        assert.equal(top.state, "success");
        const row = (await db.query("select * from invitations where id = $1", [family.reference]))
          .rows[0];
        assert.equal(row.token_hash, tokenHashFor("a"));
        assert.equal(row.status, "pending");
        assert.equal(row.organization_id, ORGANIZATION);
        assert.equal(row.created_by_account_id, SUPER_ADMIN);
        assert.equal(Math.round((row.expires_at - row.created_at) / 86_400_000), 7);
        assert.equal(
          (await auditEvents(db)).length,
          0,
          "creating an invitation writes no audit event",
        );
      });

      it("lets a group admin invite parents of their own group's families and teachers of their own group only", async () => {
        assert.equal((await create(ADMIN_G1, { email: email("p1") })).state, "success");
        assert.equal(
          (
            await create(ADMIN_G1, {
              role: "kindergarten_teacher",
              scopeType: "group",
              scope: GROUP_1,
              email: email("t1"),
            })
          ).state,
          "success",
        );
        const denied: Parameters<typeof create>[1][] = [
          { scope: FAMILY_2, email: email("p2") },
          { role: "kindergarten_teacher", scopeType: "group", scope: GROUP_2, email: email("t2") },
          { role: "group_admin", scopeType: "group", scope: GROUP_1, email: email("g1") },
          {
            role: "super_admin",
            scopeType: "organization",
            scope: ORGANIZATION,
            email: email("s1"),
          },
        ];
        for (const args of denied) {
          const result = await create(ADMIN_G1, args);
          assert.equal(result.state, "denied", JSON.stringify(args));
        }
        const events = await auditEvents(db);
        assert.equal(events.length, 4);
        assert.ok(
          events.every(
            (event) =>
              event.action === "role.grant" &&
              event.outcome === "denied" &&
              event.actor_account_id === ADMIN_G1 &&
              event.actor_role === "group_admin",
          ),
        );
        assert.equal(await count(db, "invitations"), 2);
      });

      it("refuses a parent, a teacher and an account without a grant, with a denied event each", async () => {
        for (const account of [PARENT_F1, TEACHER_G1, OUTSIDER]) {
          assert.equal((await create(account)).state, "denied", account);
        }
        assert.equal(
          (await auditEvents(db)).filter((event) => event.outcome === "denied").length,
          3,
        );
        assert.equal(await count(db, "invitations"), 0);
      });

      it("answers scope_not_found for another organization's family, so another organization's record is never confirmed", async () => {
        const other = await create(OTHER_ADMIN, { scope: FAMILY_1 });
        assert.equal(other.state, "validation");
        assert.equal(other.code, "scope_not_found");
        const unknown = await create(SUPER_ADMIN, { scope: uuid(9) });
        assert.equal(unknown.code, "scope_not_found");
      });

      it("validates the address, the token hash and the role and scope pairing", async () => {
        for (const bad of [
          { email: "not-an-address" },
          { email: "" },
          { role: "parent", scopeType: "group", scope: GROUP_1 },
          { role: "wizard" },
        ]) {
          const result = await create(SUPER_ADMIN, bad);
          assert.equal(result.state, "validation", JSON.stringify(bad));
        }
        const badHash = await callAs(
          db,
          schema,
          authenticated(SUPER_ADMIN),
          "invitation_create($1, $2, 'parent', 'family', $3, 'xyz', null)",
          [nextKey(), email("x"), FAMILY_1],
        );
        assert.equal(badHash.state, "validation");
        assert.equal(await count(db, "invitations"), 0);
      });

      it("lower-cases the address and refuses a second open invitation for the same email, role and scope", async () => {
        const first = await create(SUPER_ADMIN, { email: email("Mixed").toUpperCase() });
        assert.equal(first.state, "success");
        assert.equal(
          (await db.query("select email from invitations where id = $1", [first.reference])).rows[0]
            .email,
          email("mixed"),
        );
        const second = await create(SUPER_ADMIN, { email: email("mixed") });
        assert.equal(second.state, "conflict");
        assert.equal(second.code, "invitation_exists");
      });

      it("treats an expired pending invitation as no longer open and marks it replaced", async () => {
        const first = await create(SUPER_ADMIN);
        await db.query(
          "update invitations set created_at = now() - interval '9 days', expires_at = now() - interval '2 days' where id = $1",
          [first.reference],
        );
        const second = await create(SUPER_ADMIN);
        assert.equal(second.state, "success");
        assert.equal(await status(first.reference!), "replaced");
      });

      it("returns the stored result for a repeated key and a conflict when the key is reused for another request", async () => {
        const first = await create(SUPER_ADMIN, { key: "same-key" });
        const again = await create(SUPER_ADMIN, { key: "same-key" });
        assert.equal(again.state, "success");
        assert.equal(again.reference, first.reference);
        assert.equal(again.code, "replayed");
        assert.equal(await count(db, "invitations"), 1);
        const reused = await create(SUPER_ADMIN, { key: "same-key", email: email("different") });
        assert.equal(reused.state, "conflict");
        assert.equal(reused.code, "idempotency_key_reused");
      });
    });

    describe("resend and revoke", () => {
      const resend = (account: string, id: string, label: string = randomUUID()) =>
        callAs(db, schema, authenticated(account), "invitation_resend($1, $2, $3)", [
          nextKey(),
          id,
          tokenHashFor(label),
        ]);
      const revoke = (account: string, id: string) =>
        callAs(db, schema, authenticated(account), "invitation_revoke($1, $2)", [nextKey(), id]);

      it("replaces a pending invitation by a new one with a new token and a new expiry", async () => {
        const first = await create(ADMIN_G1);
        const next = await resend(ADMIN_G1, first.reference!, "second-token");
        assert.equal(next.state, "success");
        assert.equal(await status(first.reference!), "replaced");
        const row = (await db.query("select * from invitations where id = $1", [next.reference]))
          .rows[0];
        assert.equal(row.status, "pending");
        assert.equal(row.replaces_invitation_id, first.reference);
        assert.equal(row.token_hash, tokenHashFor("second-token"));
        assert.equal(row.email, email("invitee"));
      });

      it("resends an expired pending invitation too, but not an accepted, revoked or replaced one", async () => {
        const expired = await create(SUPER_ADMIN, { email: email("expired") });
        await db.query(
          "update invitations set created_at = now() - interval '9 days', expires_at = now() - interval '2 days' where id = $1",
          [expired.reference],
        );
        assert.equal((await resend(SUPER_ADMIN, expired.reference!)).state, "success");
        for (const ended of ["accepted", "revoked", "replaced", "accepting"]) {
          const row = await create(SUPER_ADMIN, { email: email(ended) });
          await db.query("update invitations set status = $2 where id = $1", [
            row.reference,
            ended,
          ]);
          const result = await resend(SUPER_ADMIN, row.reference!);
          assert.equal(result.state, "conflict", ended);
          assert.equal(result.code, "invitation_not_pending");
        }
      });

      it("revokes a pending invitation and refuses to revoke a finished one", async () => {
        const row = await create(SUPER_ADMIN);
        assert.equal((await revoke(SUPER_ADMIN, row.reference!)).state, "success");
        assert.equal(await status(row.reference!), "revoked");
        assert.equal((await revoke(SUPER_ADMIN, row.reference!)).state, "conflict");
      });

      it("refuses another group's admin, a parent and another organization's admin, and the foreign one learns nothing", async () => {
        const row = await create(ADMIN_G1);
        for (const account of [ADMIN_G2, PARENT_F1, OUTSIDER]) {
          const resent = await resend(account, row.reference!);
          assert.equal(resent.state, "denied", `resend as ${account}`);
          assert.equal(
            (await revoke(account, row.reference!)).state,
            "denied",
            `revoke as ${account}`,
          );
        }
        const foreign = await resend(OTHER_ADMIN, row.reference!);
        assert.equal(foreign.state, "validation");
        assert.equal(foreign.code, "invitation_not_found");
        assert.equal((await revoke(OTHER_ADMIN, row.reference!)).code, "invitation_not_found");
        assert.equal(await status(row.reference!), "pending");
        const denied = (await auditEvents(db)).filter((event) => event.outcome === "denied");
        assert.equal(denied.length, 6);
        assert.ok(
          denied.every((event) => event.target_type === "invitation" && event.group_id === GROUP_1),
        );
      });

      it("lets a group admin resend and revoke an invitation another admin of the same group created", async () => {
        const row = await create(SUPER_ADMIN);
        assert.equal((await resend(ADMIN_G1, row.reference!)).state, "success");
        const later = await create(SUPER_ADMIN, { email: email("later") });
        assert.equal((await revoke(ADMIN_G1, later.reference!)).state, "success");
      });
    });

    describe("lookup, reserve and accept", () => {
      const lookup = (label: string) =>
        callAs(db, schema, asServiceRole, "invitation_lookup($1)", [tokenHashFor(label)]);
      const reserve = (label: string, key = nextKey(), connection: pg.Client = db) =>
        callAs(connection, schema, asServiceRole, "invitation_reserve($1, $2)", [
          key,
          tokenHashFor(label),
        ]);
      const accept = (
        key: string,
        invitation: string,
        account: string,
        connection: pg.Client = db,
      ) =>
        callAs(connection, schema, asServiceRole, "invitation_accept($1, $2, $3)", [
          key,
          invitation,
          account,
        ]);
      const release = (id: string, reservedAt: string) =>
        callAs(db, schema, asServiceRole, "invitation_release($1, $2)", [id, reservedAt]);
      const invite = async (label: string, tag = label, account = SUPER_ADMIN) => {
        const result = await create(account, { label, email: email(tag) });
        assert.equal(result.state, "success");
        return result.reference!;
      };

      it("looks a token up and returns only the role, the kind of scope and the validity", async () => {
        await invite("valid");
        const result = await lookup("valid");
        assert.equal(result.code, "valid");
        assert.deepEqual(Object.keys(result).sort(), [
          "code",
          "reference",
          "role",
          "scope_type",
          "state",
        ]);
        assert.equal(result.role, "parent");
        assert.equal(result.scope_type, "family");
        assert.equal((await lookup("unknown")).code, "not_valid");
      });

      it("reports expired, revoked, replaced and accepted links", async () => {
        const expired = await invite("expired");
        await db.query(
          "update invitations set created_at = now() - interval '9 days', expires_at = now() - interval '2 days' where id = $1",
          [expired],
        );
        assert.equal((await lookup("expired")).code, "expired");
        for (const ended of ["revoked", "replaced", "accepted"]) {
          const id = await invite(ended);
          await db.query("update invitations set status = $2 where id = $1", [id, ended]);
          assert.equal((await lookup(ended)).code, "not_valid", ended);
        }
      });

      it("reserves a pending invitation for one submit and refuses a second while the reservation is held", async () => {
        const id = await invite("one");
        const first = await reserve("one");
        assert.equal(first.state, "success");
        assert.equal(first.reference, id);
        assert.equal(first.email, email("one"));
        assert.equal(await status(id), "accepting");
        const second = await reserve("one");
        assert.equal(second.state, "conflict");
        assert.equal(second.code, "invitation_reserved");
      });

      it("names a sign-in user left by an earlier failed attempt so the next submit reuses it, and never one that has an Account", async () => {
        const id = await invite("orphan");
        const leftover = await signInUser(email("orphan"), randomUUID());
        const reserved = await reserve("orphan");
        assert.equal(reserved.orphan_user_id, leftover);
        await release(id, reserved.reserved_at as string);
        await db.query("insert into accounts (id, email, organization_id) values ($1, $2, $3)", [
          leftover,
          email("someone-else"),
          ORGANIZATION,
        ]);
        const again = await reserve("orphan");
        assert.equal(
          again.orphan_user_id,
          null,
          "a user that has an Account is never offered for reuse",
        );
      });

      it("releases a reservation older than two minutes to the next submit, and only its holder can release it", async () => {
        const id = await invite("stale");
        const first = await reserve("stale");
        await db.query(
          "update invitations set reserved_at = now() - interval '3 minutes' where id = $1",
          [id],
        );
        const second = await reserve("stale");
        assert.equal(second.state, "success");
        assert.notEqual(second.reserved_at, first.reserved_at);
        // The slow first submit fails late and tries to release: it no longer holds the reservation.
        const stale = await release(id, "2026-10-13T10:00:00+00:00");
        assert.equal(stale.code, "not_reserved");
        assert.equal(await status(id), "accepting", "the second submit's reservation is untouched");
        const explicit = await release(id, second.reserved_at as string);
        assert.equal(explicit.code, "released");
        assert.equal(await status(id), "pending");
        assert.equal((await release(id, second.reserved_at as string)).code, "not_reserved");
      });

      // Regression (code review Major 1): a reservation whose release was never proven used to stay
      // `accepting` forever, so no admin could revoke, resend or replace the invitation.
      describe("a reservation that was never released", () => {
        const ageReservation = (id: string, minutes: number) =>
          db.query(
            "update invitations set reserved_at = now() - make_interval(mins => $2) where id = $1",
            [id, minutes],
          );
        const revokeInvitation = (id: string) =>
          callAs(db, schema, authenticated(SUPER_ADMIN), "invitation_revoke($1, $2)", [
            nextKey(),
            id,
          ]);
        const resendInvitation = (id: string, label: string) =>
          callAs(db, schema, authenticated(SUPER_ADMIN), "invitation_resend($1, $2, $3)", [
            nextKey(),
            id,
            tokenHashFor(label),
          ]);

        it("still blocks revoke while the reservation is fresh", async () => {
          const id = await invite("fresh-hold");
          await reserve("fresh-hold");
          await ageReservation(id, 1);
          const result = await revokeInvitation(id);
          assert.equal(result.code, "invitation_not_pending");
          assert.equal(await status(id), "accepting");
        });

        it("lets an admin revoke it once the reservation is older than two minutes", async () => {
          const id = await invite("stale-revoke");
          await reserve("stale-revoke");
          await ageReservation(id, 3);
          const result = await revokeInvitation(id);
          assert.equal(result.state, "success");
          assert.equal(await status(id), "revoked");
        });

        it("lets an admin resend it, replacing the old invitation", async () => {
          const id = await invite("stale-resend");
          await reserve("stale-resend");
          await ageReservation(id, 3);
          const result = await resendInvitation(id, "stale-resend-new");
          assert.equal(result.state, "success");
          assert.equal(await status(id), "replaced");
          assert.equal(await status(result.reference!), "pending");
        });

        it("lets an admin create a new invitation after the old one expired while reserved", async () => {
          const id = await invite("stale-expired", "stale-expired");
          await reserve("stale-expired");
          await db.query(
            "update invitations set created_at = now() - interval '9 days', expires_at = now() - interval '2 days', reserved_at = now() - interval '3 days' where id = $1",
            [id],
          );
          const again = await create(SUPER_ADMIN, {
            label: "stale-expired-again",
            email: email("stale-expired"),
          });
          assert.equal(again.state, "success");
          assert.equal(await status(id), "replaced");
          assert.equal(await status(again.reference!), "pending");
        });

        it("is released by housekeeping, which leaves a fresh reservation alone", async () => {
          const stale = await invite("hk-stale");
          const fresh = await invite("hk-fresh");
          await reserve("hk-stale");
          await reserve("hk-fresh");
          await ageReservation(stale, 3);
          const result = await callAs(db, schema, asServiceRole, "identity_housekeeping()");
          assert.equal(result.reservations_released, 1);
          assert.equal(await status(stale), "pending");
          assert.equal(await status(fresh), "accepting");
        });
      });

      it("refuses an expired, revoked, replaced or accepted invitation, and an email that already has an Account", async () => {
        const expired = await invite("exp");
        await db.query(
          "update invitations set created_at = now() - interval '9 days', expires_at = now() - interval '2 days' where id = $1",
          [expired],
        );
        assert.equal((await reserve("exp")).code, "invitation_expired");
        for (const ended of ["revoked", "replaced", "accepted"]) {
          const id = await invite(ended);
          await db.query("update invitations set status = $2 where id = $1", [id, ended]);
          const result = await reserve(ended);
          assert.equal(result.state, "validation", ended);
          assert.equal(result.code, "invitation_not_valid");
        }
        const existing = await invite("dup", "known");
        await db.query("insert into accounts (id, email, organization_id) values ($1, $2, $3)", [
          uuid(7100),
          email("known"),
          ORGANIZATION,
        ]);
        const result = await reserve("dup");
        assert.equal(result.code, "account_exists");
        assert.equal(await status(existing), "pending", "the invitation is left as it was");
      });

      it("creates the Account, the grant and its version in one step, marks the invitation accepted and writes the audit event", async () => {
        const id = await invite("go");
        const reserved = await reserve("go", "accept-key");
        assert.equal(reserved.state, "success");
        const user = await signInUser(email("go"), id);
        const accepted = await accept("accept-key", id, user);
        assert.equal(accepted.state, "success");
        assert.equal(accepted.reference, user);
        assert.deepEqual(
          (
            await db.query("select email, organization_id, status from accounts where id = $1", [
              user,
            ])
          ).rows[0],
          {
            email: email("go"),
            organization_id: ORGANIZATION,
            status: "active",
          },
        );
        const grant = (
          await db.query(
            "select role, scope_type, scope_id, organization_id, granted_by_account_id, revoked_at from app_role_grants where subject_id = $1",
            [user],
          )
        ).rows;
        assert.deepEqual(grant, [
          {
            role: "parent",
            scope_type: "family",
            scope_id: FAMILY_1,
            organization_id: ORGANIZATION,
            granted_by_account_id: SUPER_ADMIN,
            revoked_at: null,
          },
        ]);
        assert.equal(
          (
            await db.query(
              "select authorization_version from app_authorization_versions where subject_id = $1",
              [user],
            )
          ).rows[0].authorization_version,
          1,
        );
        const row = (
          await db.query(
            "select status, accepted_account_id, accepted_at, reserved_at from invitations where id = $1",
            [id],
          )
        ).rows[0];
        assert.equal(row.status, "accepted");
        assert.equal(row.accepted_account_id, user);
        assert.ok(row.accepted_at);
        assert.equal(row.reserved_at, null);
        const events = await auditEvents(db);
        assert.deepEqual(
          events.map((event) => [
            event.action,
            event.outcome,
            event.actor_role,
            event.target_type,
            event.target_id,
            event.details,
            event.group_id,
          ]),
          [["role.grant", "success", "system", "invitation", id, `invitation:${id}`, GROUP_1]],
        );
        assert.equal(events[0]!.actor_account_id, "00000000-0000-0000-0000-000000000000");
      });

      it("returns the stored success for a repeated key and the not-valid answer for a new submit on an accepted invitation", async () => {
        const id = await invite("again");
        await reserve("again", "key-again");
        const user = await signInUser(email("again"), id);
        await accept("key-again", id, user);
        const repeat = await reserve("again", "key-again");
        assert.equal(repeat.state, "success");
        assert.equal(repeat.code, "replayed");
        assert.equal(repeat.reference, user);
        const fresh = await reserve("again", "another-key");
        assert.equal(fresh.state, "validation");
        assert.equal(fresh.code, "invitation_not_valid");
        const reused = await reserve("other-link", "key-again");
        assert.equal(reused.code, "idempotency_key_reused");
        assert.equal(await count(db, "accounts", `email = '${email("again")}'`), 1);
      });

      it("refuses acceptance without a reservation, without the sign-in user and for an existing account", async () => {
        const id = await invite("strict");
        const user = await signInUser(email("strict"), id);
        assert.equal((await accept("k1", id, user)).code, "invitation_not_reserved");
        await reserve("strict");
        assert.equal((await accept("k2", id, uuid(8888))).code, "sign_in_user_missing");
        await db.query("insert into accounts (id, email, organization_id) values ($1, $2, $3)", [
          user,
          email("strict"),
          ORGANIZATION,
        ]);
        assert.equal((await accept("k3", id, user)).code, "account_exists");
        assert.equal(await status(id), "accepting");
      });

      it("leaves nothing behind when acceptance fails midway, keeps the reservation to release, and lets a retry succeed", async () => {
        const id = await invite("inject");
        await reserve("inject", "k-inject");
        const user = await signInUser(email("inject"), id);
        await db.query(
          "create function fail_version_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure' using errcode = 'P0001'; end $$",
        );
        await db.query(
          "create trigger inject_failure before insert on app_authorization_versions for each row execute function fail_version_insert()",
        );
        try {
          const error = await failureOf(() => accept("k-inject", id, user));
          assert.equal(error?.message, "injected failure");
        } finally {
          await db.query("drop trigger inject_failure on app_authorization_versions");
          await db.query("drop function fail_version_insert()");
        }
        assert.equal(await count(db, "accounts", `id = '${user}'`), 0);
        assert.equal(await count(db, "app_role_grants", `subject_id = '${user}'`), 0);
        assert.equal(await count(db, "audit_events"), 0);
        assert.equal(await count(db, "idempotency_records", "operation = 'invitation.accept'"), 0);
        const held = (
          await db.query("select reserved_at::text as at from invitations where id = $1", [id])
        ).rows[0].at as string;
        await release(id, held);
        assert.equal(await status(id), "pending");
        assert.equal((await reserve("inject", "k-retry")).state, "success");
        assert.equal((await accept("k-retry", id, user)).state, "success");
      });

      it("lets exactly one of two simultaneous submits reserve, and exactly one accept", async () => {
        const id = await invite("race");
        const second = await openDatabase();
        try {
          await bindSchema(second, schema);
          const [a, b] = await Promise.all([
            reserve("race", "race-a", db),
            reserve("race", "race-b", second),
          ]);
          const states = [a.state, b.state].sort();
          assert.deepEqual(states, ["conflict", "success"]);
          const winner = a.state === "success" ? "race-a" : "race-b";
          const user = await signInUser(email("race"), id);
          const [x, y] = await Promise.all([
            accept(winner, id, user, db),
            accept(winner, id, user, second),
          ]);
          assert.equal([x, y].filter((r) => r.state === "success").length, 1);
          assert.equal(await count(db, "accounts", `email = '${email("race")}'`), 1);
          assert.equal(await count(db, "app_role_grants", `subject_id = '${user}'`), 1);
        } finally {
          await second.end();
        }
      });

      it("is executable only by the service role (signed-in accounts and anon are refused)", async () => {
        const id = await invite("guard");
        const hash = tokenHashFor("guard");
        const calls: [string, unknown[]][] = [
          ["invitation_lookup($1)", [hash]],
          ["invitation_reserve('k', $1)", [hash]],
          ["invitation_release($1, $2)", [id, "2026-10-13T10:00:00+00:00"]],
          ["invitation_accept('k', $1, $1)", [id]],
        ];
        for (const [sql, values] of calls) {
          for (const actor of [authenticated(SUPER_ADMIN), { role: "anon" as const }]) {
            const error = await failureOf(() => callAs(db, schema, actor, sql, values));
            assert.equal(error?.code, "42501", `${sql} as ${actor.role}`);
          }
        }
        const direct = await asActor(
          db,
          schema,
          authenticated(SUPER_ADMIN),
          async () => (await db.query("select count(*)::int as n from invitations")).rows[0].n,
        );
        assert.equal(direct, 1);
      });

      it("keeps lookup, reserve and acceptance under 500 ms (reported)", async () => {
        const id = await invite("timing");
        const user = await signInUser(email("timing"), id);
        const time = async (work: () => Promise<unknown>) => {
          const started = performance.now();
          await work();
          return performance.now() - started;
        };
        const lookupMs = await time(() => lookup("timing"));
        const reserveMs = await time(() => reserve("timing", "timing-key"));
        const acceptMs = await time(() => accept("timing-key", id, user));
        report(
          `invitation functions in ${schema}: lookup ${lookupMs.toFixed(1)} ms, reserve ${reserveMs.toFixed(1)} ms, accept ${acceptMs.toFixed(1)} ms (target 500 ms)`,
        );
        assert.ok(lookupMs < 500 && reserveMs < 500 && acceptMs < 500);
        assert.ok(ADMIN_G2 && FAMILY_2 && GROUP_2);
      });
    });
  });
}
