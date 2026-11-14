import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callAs,
  callFunction,
  CO_PARENT_F1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_OTHER,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedDirectoryWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import {
  asServiceRole,
  auditEvents,
  count,
  emailHashFor,
  tokenHashFor,
} from "./identity-support.ts";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import { applyMigrations, readMigrationFiles, TRACKING_SCHEMA } from "../../scripts/db/runner.ts";
import { openDatabase, root } from "./stack-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;
const NOBODY_ELSE = [PARENT_F1, CO_PARENT_F1, TEACHER_G1, ADMIN_G1, OUTSIDER];
const code = (result: Result) => result.code ?? result.state;

/**
 * Adding and editing records, removing a parent, invitations and the one-off load (W6 to W8, C17; BR35, BR36,
 * BR37.1, BR38.1), as real roles on the real stack. Every command has the fixed list: allowed, refused, out of
 * reach, outdated screen, repeated click and two people at once.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`directory records in ${schema}`, () => {
    let db: pg.Client;
    const extra: pg.Client[] = [];

    before(async () => {
      db = await openDirectoryDatabase(schema);
      extra.push(await openDatabase(), await openDatabase());
    });
    after(async () => {
      await Promise.all(extra.map((client) => client.end()));
      await db.end();
    });
    beforeEach(async () => {
      await seedDirectoryWorld(db, schema);
    });

    const as = (account: string, sql: string, values: unknown[], client: pg.Client = db) =>
      callFunction(client, schema, account, sql, values);
    const sample = (tag: string) => ({
      display_name: `Minta család ${tag}`,
      parents: [
        {
          display_name: `Minta Anna ${tag}`,
          email: `Minta.${tag}@Example.test`,
          phone: "+36 30 100 2000",
        },
        { display_name: `Minta Béla ${tag}`, email: `minta.b.${tag}@example.test` },
      ],
      children: [{ display_name: `Minta Gyerek ${tag}` }],
    });
    const familyAdd = (
      account: string,
      family: unknown,
      key = nextKey("fam"),
      client: pg.Client = db,
    ) => as(account, "family_add($1, $2::jsonb)", [key, JSON.stringify(family)], client);
    const parentAdd = (
      account: string,
      familyId: string,
      version: number,
      parent: unknown,
      key = nextKey("pa"),
    ) =>
      as(account, "parent_add($1, $2, $3, $4::jsonb)", [
        key,
        familyId,
        version,
        JSON.stringify(parent),
      ]);
    const parentEdit = (
      account: string,
      parentId: string,
      version: number,
      fields: unknown,
      key = nextKey("pe"),
    ) =>
      as(account, "parent_edit($1, $2, $3, $4::jsonb)", [
        key,
        parentId,
        version,
        JSON.stringify(fields),
      ]);
    const parentRemove = (
      account: string,
      parentId: string,
      version: number,
      key = nextKey("pr"),
      client: pg.Client = db,
    ) => as(account, "parent_remove($1, $2, $3)", [key, parentId, version], client);
    const invite = (account: string, parentId: string, label: string, key = nextKey("inv")) =>
      as(account, "invitation_send($1, $2, $3, $4)", [
        key,
        parentId,
        tokenHashFor(`${label}-${key}`),
        emailHashFor(label),
      ]);
    const one = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0] as Record<string, unknown>;
    const version = async (table: "parents" | "families", id: string) =>
      (await one(`select version from ${table} where id = $1`, [id])).version as number;
    const newParent = async (tag: string) => {
      const added = await familyAdd(SUPER_ADMIN, {
        display_name: `Új ${tag}`,
        parents: [{ display_name: `Új szülő ${tag}`, email: `uj.${tag}@example.test` }],
      });
      assert.equal(added.state, "success", JSON.stringify(added));
      return { family: added.reference as string, parent: (added.parent_ids as string[])[0]! };
    };

    // ---- family_add ----

    it("adds a family with parents and children, with sharing off, and writes one audit row each (BR35.2, BR31.1)", async () => {
      const result = await familyAdd(SUPER_ADMIN, sample("a"));
      assert.equal(result.state, "success", JSON.stringify(result));
      const family = result.reference as string;
      const profiles = (
        await db.query(
          "select pp.email_on_record, pp.phone, pp.sharing_consent from parent_profiles pp join parents p on p.id = pp.parent_id where p.family_id = $1 order by p.display_name",
          [family],
        )
      ).rows;
      assert.deepEqual(profiles, [
        {
          email_on_record: "minta.a@example.test",
          phone: "+36 30 100 2000",
          sharing_consent: false,
        },
        { email_on_record: "minta.b.a@example.test", phone: null, sharing_consent: false },
      ]);
      assert.equal(await count(db, "children", `family_id = '${family}'`), 1);
      assert.equal(
        await count(db, "parents", `family_id = '${family}' and account_id is not null`),
        0,
      );
      const actions = (await auditEvents(db)).map((event) => event.action).sort();
      assert.deepEqual(actions, ["family.added", "parent.added", "parent.added"]);
    });

    it("validates a new family and names the field, and refuses a taken or repeated address with one answer (BR35.2, BR35.3, NFR1.4)", async () => {
      const bad = async (family: unknown) => familyAdd(SUPER_ADMIN, family);
      const noParents = await bad({ display_name: "Szülő nélkül", parents: [] });
      assert.deepEqual(
        [noParents.state, noParents.code, noParents.field],
        ["validation", "field_invalid", "parents"],
      );
      const noName = await bad({ ...sample("b"), display_name: " " });
      assert.deepEqual([noName.code, noName.field], ["field_invalid", "display_name"]);
      const badEmail = await bad({
        ...sample("c"),
        parents: [{ display_name: "X", email: "nem-cim" }],
      });
      assert.deepEqual(
        [badEmail.state, badEmail.code, badEmail.field],
        ["validation", "EMAIL_INVALID", "parents.email"],
      );
      const badPhone = await bad({
        ...sample("d"),
        parents: [{ display_name: "X", email: "x@example.test", phone: "hívj" }],
      });
      assert.deepEqual([badPhone.code, badPhone.field], ["field_invalid", "parents.phone"]);
      const repeated = await bad({
        ...sample("e"),
        parents: [
          { display_name: "X", email: "azonos@example.test" },
          { display_name: "Y", email: "AZONOS@example.test" },
        ],
      });
      const onRecord = await bad({
        ...sample("f"),
        parents: [{ display_name: "X", email: "anna@example.test" }],
      });
      const signIn = await bad({
        ...sample("g"),
        parents: [
          {
            display_name: "X",
            email: (await one("select email from accounts where id = $1", [PARENT_F2])).email,
          },
        ],
      });
      const answers = [repeated, onRecord, signIn].map((result) => [
        result.state,
        result.code,
        result.field,
      ]);
      assert.deepEqual(answers, [
        ["validation", "EMAIL_UNAVAILABLE", "parents.email"],
        ["validation", "EMAIL_UNAVAILABLE", "parents.email"],
        ["validation", "EMAIL_UNAVAILABLE", "parents.email"],
      ]);
      assert.equal(
        await count(db, "families", "display_name like 'Minta%' or display_name = 'Szülő nélkül'"),
        0,
      );
    });

    it("refuses family_add for every caller but a super admin and answers a repeated click with the stored result", async () => {
      for (const account of NOBODY_ELSE)
        assert.equal((await familyAdd(account, sample("h"))).state, "denied", account);
      assert.equal(await count(db, "families", "display_name like 'Minta%'"), 0);
      const key = nextKey("click");
      const first = await familyAdd(SUPER_ADMIN, sample("i"), key);
      const again = await familyAdd(SUPER_ADMIN, sample("i"), key);
      assert.deepEqual(
        [again.state, again.code, again.reference],
        ["success", "replayed", first.reference],
      );
      assert.equal(await count(db, "families", "display_name = 'Minta család i'"), 1);
      assert.equal((await familyAdd(SUPER_ADMIN, sample("j"), key)).code, "idempotency_key_reused");
    });

    it("lets one of two adds of one address at once win, repeated without a deadlock (two people at once, NFR5)", async () => {
      for (let round = 0; round < 6; round += 1) {
        const address = `verseny.${round}@example.test`;
        const family = (name: string) => ({
          display_name: name,
          parents: [{ display_name: name, email: address }],
        });
        const results = await Promise.all([
          familyAdd(SUPER_ADMIN, family(`Első ${round}`), nextKey("x"), extra[0]),
          familyAdd(SUPER_ADMIN, family(`Második ${round}`), nextKey("y"), extra[1]),
        ]);
        assert.deepEqual(
          results.map(code).sort(),
          ["EMAIL_UNAVAILABLE", "success"],
          `round ${round}`,
        );
        assert.equal(await count(db, "parent_profiles", `email_on_record = '${address}'`), 1);
      }
    });

    // ---- parent_add ----

    it("adds a parent to a family, raises the family version and refuses an outdated screen (BR35.2)", async () => {
      const before = await version("families", FAMILY_1);
      const added = await parentAdd(SUPER_ADMIN, FAMILY_1, before, {
        display_name: "Új Szülő",
        email: "uj.szulo@example.test",
      });
      assert.equal(added.state, "success", JSON.stringify(added));
      assert.equal(added.family_version, before + 1);
      const stale = await parentAdd(SUPER_ADMIN, FAMILY_1, before, {
        display_name: "Másik",
        email: "masik@example.test",
      });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      assert.equal(await count(db, "parents", "display_name = 'Másik'"), 0);
      assert.equal(await count(db, "audit_events", "action = 'parent.added'"), 1);
    });

    it("refuses parent_add for everyone else, answers another community's family like a missing one and replays a repeated click", async () => {
      const v = await version("families", FAMILY_1);
      for (const account of NOBODY_ELSE) {
        assert.equal(
          (await parentAdd(account, FAMILY_1, v, { display_name: "X", email: "x@example.test" }))
            .state,
          "denied",
          account,
        );
      }
      const real = await parentAdd(SUPER_ADMIN, FAMILY_OTHER, 1, {
        display_name: "X",
        email: "x@example.test",
      });
      const invented = await parentAdd(SUPER_ADMIN, uuid(9999), 1, {
        display_name: "X",
        email: "x@example.test",
      });
      assert.deepEqual([real.state, real.code], [invented.state, invented.code]);
      const key = nextKey("click");
      const first = await parentAdd(
        SUPER_ADMIN,
        FAMILY_1,
        v,
        { display_name: "Kattintás", email: "kattintas@example.test" },
        key,
      );
      const again = await parentAdd(
        SUPER_ADMIN,
        FAMILY_1,
        v,
        { display_name: "Kattintás", email: "kattintas@example.test" },
        key,
      );
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
      assert.equal(await count(db, "parents", "display_name = 'Kattintás'"), 1);
    });

    it("lets one of two adds of one address to one family at once win (two people at once)", async () => {
      const v = await version("families", FAMILY_1);
      const call = (client: pg.Client, tag: string) =>
        as(
          SUPER_ADMIN,
          "parent_add($1, $2, $3, $4::jsonb)",
          [
            nextKey(tag),
            FAMILY_1,
            v,
            JSON.stringify({ display_name: tag, email: "ketten@example.test" }),
          ],
          client,
        );
      const results = await Promise.all([call(extra[0]!, "A"), call(extra[1]!, "B")]);
      assert.equal(results.filter((result) => result.state === "success").length, 1);
      assert.equal(
        await count(db, "parent_profiles", "email_on_record = 'ketten@example.test'"),
        1,
      );
    });

    // ---- parent_edit ----

    it("edits a parent's name and phone, keeps an absent field, and changes the address only while there is no account (BR35.4)", async () => {
      const { parent } = await newParent("edit");
      const v = await version("parents", parent);
      const edited = await parentEdit(SUPER_ADMIN, parent, v, {
        display_name: "Átnevezett",
        phone: "+36 20 999 8888",
      });
      assert.equal(edited.state, "success", JSON.stringify(edited));
      assert.deepEqual(
        await one(
          "select p.display_name, pp.phone, pp.email_on_record from parents p join parent_profiles pp on pp.parent_id = p.id where p.id = $1",
          [parent],
        ),
        {
          display_name: "Átnevezett",
          phone: "+36 20 999 8888",
          email_on_record: "uj.edit@example.test",
        },
      );
      const moved = await parentEdit(SUPER_ADMIN, parent, await version("parents", parent), {
        email: "Uj.Cim@Example.test",
      });
      assert.equal(moved.state, "success");
      assert.equal(
        (await one("select email_on_record from parent_profiles where parent_id = $1", [parent]))
          .email_on_record,
        "uj.cim@example.test",
      );
      const linked = await parentEdit(
        SUPER_ADMIN,
        PARENT_ROW_F1,
        await version("parents", PARENT_ROW_F1),
        { email: "masik.cim@example.test" },
      );
      assert.deepEqual(
        [linked.state, linked.code, linked.field],
        ["denied", "authorization_denied", "email"],
      );
      const taken = await parentEdit(SUPER_ADMIN, parent, await version("parents", parent), {
        email: "bela@example.test",
      });
      assert.deepEqual(
        [taken.state, taken.code, taken.field],
        ["validation", "EMAIL_UNAVAILABLE", "email"],
      );
      const invalid = await parentEdit(SUPER_ADMIN, parent, await version("parents", parent), {
        email: "nem-cim",
      });
      assert.deepEqual([invalid.code, invalid.field], ["EMAIL_INVALID", "email"]);
    });

    it("refuses parent_edit for everyone else, an outdated screen and out-of-reach ids alike, and replays a repeated click", async () => {
      const { parent } = await newParent("edit2");
      const v = await version("parents", parent);
      for (const account of NOBODY_ELSE)
        assert.equal(
          (await parentEdit(account, parent, v, { display_name: "Más" })).state,
          "denied",
          account,
        );
      const stale = await parentEdit(SUPER_ADMIN, parent, v + 5, { display_name: "Régi" });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const other = await parentEdit(SUPER_ADMIN, uuid(606), 1, { display_name: "Idegen" });
      const invented = await parentEdit(SUPER_ADMIN, uuid(9998), 1, { display_name: "Idegen" });
      assert.deepEqual([other.state, other.code], [invented.state, invented.code]);
      const key = nextKey("click");
      await parentEdit(SUPER_ADMIN, parent, v, { display_name: "Egyszer" }, key);
      const again = await parentEdit(SUPER_ADMIN, parent, v, { display_name: "Egyszer" }, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
    });

    // ---- parent_remove ----

    it("removes a parent: the sign-in ends, the link and every profile field go, invitations and the pending email request are deleted (BR36.3)", async () => {
      await db.query(
        "insert into email_change_requests (account_id, new_email, token_hash) values ($1, 'uj.cim.co@example.test', $2)",
        [CO_PARENT_F1, tokenHashFor("pending")],
      );
      await db.query(
        "update parent_profiles set occupation = 'Tanár', sharing_consent = true where parent_id = $1",
        [PARENT_ROW_CO],
      );
      const removed = await parentRemove(
        SUPER_ADMIN,
        PARENT_ROW_CO,
        await version("parents", PARENT_ROW_CO),
      );
      assert.equal(removed.state, "success", JSON.stringify(removed));
      assert.equal(removed.account_id, CO_PARENT_F1);
      assert.deepEqual(
        await one("select status, account_id from parents where id = $1", [PARENT_ROW_CO]),
        { status: "archived", account_id: null },
      );
      assert.deepEqual(
        await one(
          "select email_on_record, phone, residence, occupation, hobby, how_i_support, sharing_consent from parent_profiles where parent_id = $1",
          [PARENT_ROW_CO],
        ),
        {
          email_on_record: null,
          phone: null,
          residence: null,
          occupation: null,
          hobby: null,
          how_i_support: null,
          sharing_consent: false,
        },
      );
      assert.equal(
        (await one("select status from accounts where id = $1", [CO_PARENT_F1])).status,
        "deactivated",
      );
      assert.equal(await count(db, "email_change_requests", `account_id = '${CO_PARENT_F1}'`), 0);
      const denied = await as(CO_PARENT_F1, "directory_list()", []);
      assert.equal(denied.state, "denied", "the removed parent can no longer use the session");
      assert.equal(await count(db, "audit_events", "action = 'parent.removed'"), 1);
    });

    it("never removes the only active parent of a family and refuses a family's last parent whoever asks (BR36.2)", async () => {
      const { parent } = await newParent("only");
      const result = await parentRemove(SUPER_ADMIN, parent, await version("parents", parent));
      assert.deepEqual([result.state, result.code], ["conflict", "PARENT_LAST_IN_FAMILY"]);
      assert.equal(
        (await one("select status from parents where id = $1", [parent])).status,
        "active",
      );
      assert.equal(await count(db, "audit_events", "action = 'parent.removed'"), 0);
    });

    it("refuses parent_remove for everyone else, an outdated screen and out-of-reach ids alike, and replays a repeated click", async () => {
      const v = await version("parents", PARENT_ROW_CO);
      for (const account of NOBODY_ELSE)
        assert.equal((await parentRemove(account, PARENT_ROW_CO, v)).state, "denied", account);
      const stale = await parentRemove(SUPER_ADMIN, PARENT_ROW_CO, v + 3);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const other = await parentRemove(SUPER_ADMIN, uuid(606), 1);
      const invented = await parentRemove(SUPER_ADMIN, uuid(9997), 1);
      assert.deepEqual([other.state, other.code], [invented.state, invented.code]);
      const key = nextKey("click");
      assert.equal((await parentRemove(SUPER_ADMIN, PARENT_ROW_CO, v, key)).state, "success");
      const again = await parentRemove(SUPER_ADMIN, PARENT_ROW_CO, v, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.equal(await count(db, "audit_events", "action = 'parent.removed'"), 1);
    });

    it("lets one of two removals of one parent at once win without a deadlock (two people at once)", async () => {
      for (let round = 0; round < 6; round += 1) {
        await seedDirectoryWorld(db, schema);
        const v = await version("parents", PARENT_ROW_CO);
        const results = await Promise.all([
          parentRemove(SUPER_ADMIN, PARENT_ROW_CO, v, nextKey("a"), extra[0]),
          parentRemove(SUPER_ADMIN, PARENT_ROW_CO, v, nextKey("b"), extra[1]),
        ]);
        assert.deepEqual(
          results.map(code).sort(),
          ["VERSION_CONFLICT", "success"],
          `round ${round}`,
        );
      }
    });

    it("runs removal against deactivation and removal against an own-details save in both orders without a deadlock (NFR5.6)", async () => {
      for (let round = 0; round < 8; round += 1) {
        await seedDirectoryWorld(db, schema);
        const v = await version("parents", PARENT_ROW_CO);
        const pv = (
          await one("select version from parent_profiles where parent_id = $1", [PARENT_ROW_CO])
        ).version as number;
        const calls: Promise<Result>[] = [
          parentRemove(SUPER_ADMIN, PARENT_ROW_CO, v, nextKey("r"), extra[0]),
          as(
            round % 2 === 0 ? SUPER_ADMIN : CO_PARENT_F1,
            round % 2 === 0
              ? "account_deactivate($1, $2)"
              : 'profile_update_own($1, $2, $3, \'{"occupation":"Tanár"}\'::jsonb)',
            round % 2 === 0 ? [nextKey("d"), CO_PARENT_F1] : [nextKey("o"), PARENT_ROW_CO, pv],
            extra[1],
          ).catch((error: unknown) => {
            // When the removal commits first it ends the actor's session, and the platform
            // refuses the own-details save before the function runs: that is a refusal too.
            if (error instanceof Error && /session is not active/.test(error.message)) {
              return { state: "denied" } as Result;
            }
            throw error;
          }),
        ];
        const results = await Promise.all(calls);
        assert.ok(
          results.every((result) => ["success", "denied", "conflict"].includes(result.state)),
          `round ${round}: ${JSON.stringify(results)}`,
        );
        assert.equal(
          await count(db, "accounts", `id = '${CO_PARENT_F1}' and status = 'active'`),
          0,
          "removal ends the sign-in either way",
        );
      }
    });

    // ---- removal steps of C16 (the family-first path of U14) ----

    it("previews and applies the removal steps for a parent and for a whole family, with the same counts (BR36.4)", async () => {
      const asOwner = (sql: string, values: unknown[]) =>
        db.query(`select ${sql} as result`, values).then((r) => r.rows[0].result);
      assert.deepEqual(await asOwner("directory_removal_preview('parent', $1)", [PARENT_ROW_CO]), {
        to_clear: 1,
        to_flag: 0,
      });
      const family = await asOwner("directory_removal_preview('family', $1)", [FAMILY_1]);
      assert.equal(family.to_flag, 0);
      assert.equal(family.to_clear, 4);
      assert.deepEqual(await asOwner("directory_removal_apply('family', $1)", [FAMILY_1]), family);
      assert.deepEqual(
        await one(
          "select (select count(*) from parents where family_id = $1 and status = 'active')::int as active, (select status from families where id = $1) as family",
          [FAMILY_1],
        ),
        { active: 0, family: "archived" },
      );
      assert.equal(
        await count(
          db,
          "accounts",
          `id in ('${PARENT_F1}', '${CO_PARENT_F1}') and status = 'active'`,
        ),
        0,
      );
    });

    it("runs the family-first removal against deactivation of its parents' accounts without a deadlock (NFR5.6)", async () => {
      for (let round = 0; round < 8; round += 1) {
        await seedDirectoryWorld(db, schema);
        const [first, second] = await Promise.all([
          extra[0]!
            .query("select directory_removal_apply('family', $1) as result", [FAMILY_1])
            .then(
              () => "done",
              (error: { code?: string }) => error.code ?? "error",
            ),
          as(SUPER_ADMIN, "account_deactivate($1, $2)", [nextKey("d"), PARENT_F1], extra[1]).then(
            (result) => result.state,
          ),
        ]);
        assert.notEqual(first, "40P01", "no deadlock");
        assert.ok(["success", "conflict"].includes(second), `round ${round}: ${second}`);
      }
    });

    // ---- invitation_send ----

    it("sends an invitation to a parent without an account, replaces an open one and limits resends to three an hour (BR37.1, NFR10.3)", async () => {
      const { parent } = await newParent("inv");
      const first = await invite(SUPER_ADMIN, parent, "inv");
      assert.equal(first.state, "success", JSON.stringify(first));
      const second = await invite(SUPER_ADMIN, parent, "inv");
      assert.equal(second.state, "success");
      assert.equal(
        await count(db, "invitations", `target_id = '${parent}' and status = 'pending'`),
        1,
      );
      assert.equal(
        await count(db, "invitations", `target_id = '${parent}' and status = 'replaced'`),
        1,
      );
      assert.equal((await invite(SUPER_ADMIN, parent, "inv")).state, "success");
      const refused = await invite(SUPER_ADMIN, parent, "inv");
      assert.deepEqual([refused.state, refused.code], ["conflict", "EMAIL_RATE_LIMITED"]);
      assert.equal(
        await count(db, "email_send_attempts", "kind = 'invitation'"),
        3,
        "a refused try writes nothing",
      );
      await db.query("update email_send_attempts set sent_at = now() - interval '61 minutes'");
      assert.equal(
        (await invite(SUPER_ADMIN, parent, "inv")).state,
        "success",
        "the window passed",
      );
      assert.equal(await count(db, "audit_events", "action = 'invitation.sent'"), 4);
    });

    it("refuses an invitation to a parent who has an account, for everyone else, for out-of-reach ids and for a parent without an address", async () => {
      const linked = await invite(SUPER_ADMIN, PARENT_ROW_F1, "linked");
      assert.deepEqual([linked.state, linked.code], ["conflict", "PARENT_HAS_ACCOUNT"]);
      const { parent } = await newParent("inv2");
      for (const account of NOBODY_ELSE)
        assert.equal((await invite(account, parent, "x")).state, "denied", account);
      const real = await invite(SUPER_ADMIN, uuid(606), "x");
      const invented = await invite(SUPER_ADMIN, uuid(9996), "x");
      assert.deepEqual([real.state, real.code], [invented.state, invented.code]);
      await db.query("update parent_profiles set email_on_record = null where parent_id = $1", [
        parent,
      ]);
      const noAddress = await invite(SUPER_ADMIN, parent, "x");
      assert.deepEqual([noAddress.state, noAddress.code], ["validation", "EMAIL_INVALID"]);
      const key = nextKey("click");
      await db.query(
        "update parent_profiles set email_on_record = 'vissza@example.test' where parent_id = $1",
        [parent],
      );
      await invite(SUPER_ADMIN, parent, "again", key);
      const again = await invite(SUPER_ADMIN, parent, "again", key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.equal(
        await count(db, "invitations", `target_id = '${parent}' and status = 'pending'`),
        1,
      );
    });

    it("refuses an invitation while the earlier one is being accepted", async () => {
      const { parent } = await newParent("busy");
      await invite(SUPER_ADMIN, parent, "busy");
      await db.query(
        "update invitations set status = 'accepting', reserved_at = now() where target_id = $1",
        [parent],
      );
      const busy = await invite(SUPER_ADMIN, parent, "busy");
      assert.deepEqual([busy.state, busy.code], ["conflict", "INVITATION_BUSY"]);
    });

    // ---- migration_load_family (C17) ----

    const loadFamily = (source: string, family: unknown, actor = asServiceRole) =>
      callAs(db, schema, actor, "migration_load_family($1, $2, $3::jsonb)", [
        source,
        ORGANIZATION,
        JSON.stringify(family),
      ]);
    const loaded = {
      display_name: "Betöltött család",
      parents: [
        {
          display_name: "Betöltött Anna",
          email: "betoltott@example.test",
          phone: "+36 30 222 3333",
          residence: "Mohács",
        },
      ],
      children: [{ display_name: "Betöltött Gyerek" }],
    };

    it("loads one family with its parents and children, unshared and without an invitation, and creates nothing the second time (BR38.1)", async () => {
      const first = await loadFamily("sor-1", loaded);
      assert.equal(first.state, "success", JSON.stringify(first));
      assert.deepEqual(
        await one(
          "select pp.residence, pp.sharing_consent, pp.occupation from parent_profiles pp join parents p on p.id = pp.parent_id where p.family_id = $1",
          [first.reference],
        ),
        { residence: "Mohács", sharing_consent: false, occupation: null },
      );
      assert.equal(await count(db, "invitations", "email = 'betoltott@example.test'"), 0);
      const second = await loadFamily("sor-1", loaded);
      assert.deepEqual(
        [second.state, second.code, second.reference],
        ["success", "replayed", first.reference],
      );
      assert.equal(await count(db, "families", "display_name = 'Betöltött család'"), 1);
      const changed = await loadFamily("sor-1", { ...loaded, display_name: "Másik" });
      assert.deepEqual([changed.state, changed.code], ["conflict", "idempotency_key_reused"]);
    });

    it("names the field of a bad row and never the value, and is not callable by a signed-in account (BR38.1, NFR3.5)", async () => {
      const bad = await loadFamily("sor-2", {
        ...loaded,
        parents: [{ display_name: "Hibás", email: "nem-cim" }],
      });
      assert.deepEqual(
        [bad.state, bad.code, bad.field],
        ["validation", "EMAIL_INVALID", "parents.email"],
      );
      assert.ok(!JSON.stringify(bad).includes("nem-cim"));
      const duplicate = await loadFamily("sor-3", {
        ...loaded,
        parents: [{ display_name: "Egyedi", email: "anna@example.test" }],
      });
      assert.deepEqual([duplicate.code, duplicate.field], ["EMAIL_UNAVAILABLE", "parents.email"]);
      assert.equal(await count(db, "families", "display_name = 'Betöltött család'"), 0);
      for (const account of [SUPER_ADMIN, PARENT_F1]) {
        const refused = await callFunction(
          db,
          schema,
          account,
          "migration_load_family($1, $2, $3::jsonb)",
          ["sor-4", ORGANIZATION, JSON.stringify(loaded)],
        ).then(
          (result) => result.state,
          (error: { code?: string }) => error.code,
        );
        assert.ok(refused === "denied" || refused === "42501", String(refused));
      }
      assert.equal(await count(db, "migration_loads"), 0);
    });

    it("keeps the sign-in accounts, parents and profiles of a second load apart from the first (BR38.1)", async () => {
      const a = await loadFamily("sor-5", loaded);
      const b = await loadFamily("sor-6", {
        ...loaded,
        display_name: "Második betöltés",
        parents: [{ display_name: "Más", email: "mas@example.test" }],
        children: [],
      });
      assert.notEqual(a.reference, b.reference);
      assert.equal(await count(db, "migration_loads"), 2);
      assert.ok(PARENT_ROW_F2);
    });
  });
}

/**
 * The structure change of 20261049 over data written by the earlier files (NFR7.4): every parent gets a profile, the
 * contact values are copied, a repeated address is not copied twice, the old profile text goes with its columns, and
 * every sharing value starts false (BR31.1). A scratch schema is migrated to the file before it and then to the file itself.
 */
describe("the directory structure change over existing rows (NFR7.4)", () => {
  const scratch = "u3_row_counts";
  const CHANGE = "20261049_directory_and_profile.sql";
  const files = readMigrationFiles(`${root}supabase/migrations`);
  const change = files.find((file) => file.name === CHANGE)!;
  const earlier = files.filter((file) => file.name < CHANGE);
  let db: pg.Client;
  const apply = (list: typeof files) =>
    applyMigrations({
      client: db as never,
      schema: scratch,
      files: list,
      log: () => {},
      now: () => Date.now(),
      freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
    });
  const drop = async () => {
    await db.query("reset search_path");
    await db.query(`drop schema if exists ${scratch} cascade`);
    await db.query(`delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = $1`, [
      scratch,
    ]);
  };

  before(async () => {
    db = await openDatabase();
    await drop();
    await db.query(`create schema ${scratch}`);
  });
  after(async () => {
    await drop();
    await db.end();
  });

  it("copies every parent's contact into a profile, keeps one holder per address, drops the old fields and starts unshared", async () => {
    await apply(earlier);
    await db.query(`set search_path to ${scratch}, pg_catalog`);
    await db.query("insert into organizations (id, name) values ($1, 'Régi')", [ORGANIZATION]);
    await db.query(
      "insert into families (id, organization_id, display_name) values ($1, $3, 'Egy család'), ($2, $3, 'Két család')",
      [uuid(80001), uuid(80002), ORGANIZATION],
    );
    await db.query(
      `insert into parents (id, organization_id, family_id, display_name, optional_profile, optional_profile_consent) values
         ($1, $5, $4, 'Egy Anna', 'Szívesen főzök.', true), ($2, $5, $4, 'Egy Béla', null, false),
         ($3, $5, $6, 'Két Csilla', null, false)`,
      [uuid(80011), uuid(80012), uuid(80013), uuid(80001), ORGANIZATION, uuid(80002)],
    );
    await db.query(
      `insert into parent_contacts (parent_id, organization_id, contact_email, contact_phone, locality) values
         ($1, $3, 'azonos@example.test', '+36 30 111 2222', 'Pécs'), ($2, $3, 'azonos@example.test', null, 'Mohács')`,
      [uuid(80011), uuid(80012), ORGANIZATION],
    );
    const before = Number((await db.query("select count(*) as n from parents")).rows[0].n);
    await apply([change]);
    await db.query(`set search_path to ${scratch}, pg_catalog`);
    const rows = (
      await db.query(
        "select parent_id, email_on_record, phone, residence, sharing_consent from parent_profiles order by parent_id",
      )
    ).rows;
    assert.equal(rows.length, before, "every parent has a profile row");
    assert.deepEqual(
      rows.map((row) => [row.email_on_record, row.phone, row.residence, row.sharing_consent]),
      [
        ["azonos@example.test", "+36 30 111 2222", "Pécs", false],
        [null, null, "Mohács", false],
        [null, null, null, false],
      ],
      "the second holder of an address starts without one, and nobody shares",
    );
    assert.equal(
      Number(
        (
          await db.query(
            "select count(*) as n from information_schema.columns where table_schema = $1 and ((table_name = 'parents' and column_name like 'optional_profile%') or table_name = 'parent_contacts')",
            [scratch],
          )
        ).rows[0].n,
      ),
      0,
    );
  });
});
