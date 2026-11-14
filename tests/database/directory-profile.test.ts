import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  CO_PARENT_F1,
  callFunction,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_OTHER,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  PARENT_ROW_OTHER,
  seedDirectoryWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";

type Entry = Record<string, unknown>;
type Card = {
  family_id: string;
  is_own_family: boolean;
  parents: Entry[];
  children?: { name: string }[];
};

const SECRET_WORDS = ["Kertész", "Sakk", "Süteményt sütök.", "Pécs"];

/**
 * The directory read and the two commands of a parent's own profile (W1 to W3; BR30 to BR32), as real database
 * roles on the real stack. The fixed list of the unit applies to the commands; the read has one test per row
 * of the "Who sees what" matrix. "Outdated screen" and "repeated click" have no meaning for a read.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`directory and profile in ${schema}`, () => {
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
      // The seed fills the profile without a version bump (triggers off for this statement), so every test starts at 1.
      await db.query("set session_replication_role = replica");
      await db.query(
        "update parent_profiles set residence = 'Pécs', occupation = 'Kertész', hobby = 'Sakk', how_i_support = 'Süteményt sütök.' where parent_id in ($1, $2)",
        [PARENT_ROW_F1, PARENT_ROW_F2],
      );
      await db.query("set session_replication_role = origin");
    });

    const list = async (account: string, client: pg.Client = db) =>
      callFunction(client, schema, account, "directory_list()");
    const cards = async (account: string): Promise<Card[]> => {
      const result = await list(account);
      assert.equal(result.state, "success", `${account}: ${JSON.stringify(result)}`);
      return result.items as Card[];
    };
    const entry = async (account: string, parentId: string): Promise<Entry> => {
      for (const card of await cards(account)) {
        const found = card.parents.find((parent) => parent.id === parentId);
        if (found) return found;
      }
      throw new Error(`parent ${parentId} is not listed for ${account}`);
    };
    const card = async (account: string, familyId: string): Promise<Card> => {
      const found = (await cards(account)).find((item) => item.family_id === familyId);
      assert.ok(found, `family ${familyId} is listed for ${account}`);
      return found;
    };
    const accountEmail = async (account: string) =>
      (await db.query("select email from accounts where id = $1", [account])).rows[0]
        ?.email as string;
    const profileVersion = async (parentId: string) =>
      (await db.query("select version from parent_profiles where parent_id = $1", [parentId]))
        .rows[0].version as number;
    const setSharing = (
      account: string,
      parentId: string,
      version: number,
      sharing: boolean,
      key = nextKey("share"),
      client: pg.Client = db,
    ) =>
      callFunction(client, schema, account, "profile_set_sharing($1, $2, $3, $4)", [
        key,
        parentId,
        version,
        sharing,
      ]);
    const updateOwn = (
      account: string,
      parentId: string,
      version: number,
      fields: unknown,
      key = nextKey("own"),
    ) =>
      callFunction(db, schema, account, "profile_update_own($1, $2, $3, $4::jsonb)", [
        key,
        parentId,
        version,
        JSON.stringify(fields),
      ]);

    // ---- The read: one test per row of the "Who sees what" matrix (BR30.1 to BR30.9) ----

    it("shows a super admin every field of every active parent, the sharing choice, the account state and every child", async () => {
      const anna = await entry(SUPER_ADMIN, PARENT_ROW_F1);
      assert.deepEqual(Object.keys(anna).sort(), [
        "email",
        "full_name",
        "has_account",
        "hobby",
        "how_i_support",
        "id",
        "occupation",
        "phone",
        "residence",
        "sharing_consent",
      ]);
      assert.equal(anna.sharing_consent, false);
      assert.equal(anna.has_account, true);
      const bela = await entry(SUPER_ADMIN, PARENT_ROW_CO);
      assert.equal(bela.phone, "+36 30 111 2222");
      assert.ok(!("occupation" in bela), "an unfilled field is absent, not empty");
      const family = await card(SUPER_ADMIN, FAMILY_1);
      assert.deepEqual(family.children, [{ name: "Fenyő Gergő" }]);
      assert.ok(!(await cards(SUPER_ADMIN)).some((item) => item.family_id === FAMILY_OTHER));
    });

    it("shows a teacher the name, the email and the phone of everyone, and the rest only of a parent who shares", async () => {
      const anna = await entry(TEACHER_G1, PARENT_ROW_F1);
      assert.deepEqual(Object.keys(anna).sort(), ["email", "full_name", "id", "phone"]);
      await setSharing(PARENT_F1, PARENT_ROW_F1, 1, true);
      const shared = await entry(TEACHER_G1, PARENT_ROW_F1);
      assert.equal(shared.occupation, "Kertész");
      assert.ok(
        !("sharing_consent" in shared),
        "the choice itself is only for the parent and super admins",
      );
      assert.ok(!("has_account" in shared));
    });

    it("shows a group administrator, who is not a teacher, only the names of parents who do not share", async () => {
      const anna = await entry(ADMIN_G1, PARENT_ROW_F1);
      assert.deepEqual(Object.keys(anna).sort(), ["full_name", "id"]);
      assert.ok(!("children" in (await card(ADMIN_G1, FAMILY_2))));
    });

    it("shows a parent everything about themself, only the names of the others and the children of their own family", async () => {
      const own = await entry(PARENT_F1, PARENT_ROW_F1);
      assert.equal(own.is_self, true);
      assert.equal(own.sharing_consent, false);
      assert.equal(own.email, await accountEmail(PARENT_F1));
      assert.equal(own.occupation, "Kertész");
      const coParent = await entry(PARENT_F1, PARENT_ROW_CO);
      assert.deepEqual(Object.keys(coParent).sort(), ["full_name", "id"]);
      const other = await entry(PARENT_F1, PARENT_ROW_F2);
      assert.deepEqual(Object.keys(other).sort(), ["full_name", "id"]);
      const ownFamily = await card(PARENT_F1, FAMILY_1);
      assert.equal(ownFamily.is_own_family, true);
      assert.deepEqual(ownFamily.children, [{ name: "Fenyő Gergő" }]);
      assert.ok(
        !("children" in (await card(PARENT_F1, FAMILY_2))),
        "no children of another family",
      );
    });

    it("shows the fields of a parent who ticked to every other parent, and the children once every active parent of the family shares (BR30.4)", async () => {
      assert.equal((await setSharing(PARENT_F2, PARENT_ROW_F2, 1, true)).state, "success");
      const shared = await entry(PARENT_F1, PARENT_ROW_F2);
      assert.deepEqual(Object.keys(shared).sort(), [
        "email",
        "full_name",
        "hobby",
        "how_i_support",
        "id",
        "occupation",
        "phone",
        "residence",
      ]);
      assert.equal(
        shared.email,
        await accountEmail(PARENT_F2),
        "the sign-in email once an account is active (BR30.6)",
      );
      assert.deepEqual((await card(PARENT_F1, FAMILY_2)).children, [{ name: "Napraforgó Hanna" }]);
      // One parent of the first family shares, the others do not: its children stay hidden from others.
      await setSharing(PARENT_F1, PARENT_ROW_F1, 1, true);
      assert.ok(!("children" in (await card(PARENT_F2, FAMILY_1))));
    });

    it("answers a parent who ticked and was then deactivated as if they never shared, and keeps it off after reactivation (BR31.5)", async () => {
      await setSharing(PARENT_F2, PARENT_ROW_F2, 1, true);
      const deactivated = await callFunction(
        db,
        schema,
        SUPER_ADMIN,
        "account_deactivate($1, $2)",
        [nextKey("off"), PARENT_F2],
      );
      assert.equal(deactivated.state, "success", JSON.stringify(deactivated));
      assert.equal(
        (
          await db.query("select sharing_consent from parent_profiles where parent_id = $1", [
            PARENT_ROW_F2,
          ])
        ).rows[0].sharing_consent,
        false,
      );
      const seen = await entry(PARENT_F1, PARENT_ROW_F2);
      assert.deepEqual(Object.keys(seen).sort(), ["full_name", "id"]);
      await callFunction(db, schema, SUPER_ADMIN, "account_reactivate($1, $2)", [
        nextKey("on"),
        PARENT_F2,
      ]);
      assert.deepEqual(Object.keys(await entry(PARENT_F1, PARENT_ROW_F2)).sort(), [
        "full_name",
        "id",
      ]);
    });

    it("denies a sign-in without a role, a deactivated or signed-out account and an account of another community's reach (BR30.1)", async () => {
      for (const account of [OUTSIDER, DEACTIVATED, SIGNED_OUT]) {
        const result = await list(account);
        assert.equal(result.state, "denied", account);
        assert.equal("items" in result, false, "no list, not even an empty one");
      }
      const other = await list(OTHER_ADMIN);
      assert.equal(other.state, "success");
      assert.deepEqual(
        (other.items as Card[]).flatMap((item) => item.parents.map((parent) => parent.id)),
        [PARENT_ROW_OTHER],
        "another community's super admin reads only their own community",
      );
    });

    it("never selects a hidden field into the result: a search of the whole answer for its value finds nothing (NFR1.2)", async () => {
      // The profile of the second family's parent is unshared: nobody but the parent and a super admin may see it.
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1]) {
        const text = JSON.stringify(await card(account, FAMILY_2));
        for (const word of SECRET_WORDS) assert.ok(!text.includes(word), `${word} for ${account}`);
      }
      assert.ok(
        JSON.stringify(await card(PARENT_F2, FAMILY_2)).includes("Kertész"),
        "the parent sees their own",
      );
      assert.ok(JSON.stringify(await card(SUPER_ADMIN, FAMILY_2)).includes("Kertész"));
    });

    it("lists only active families and active parents, and gives the same order to every viewer", async () => {
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_CO]);
      const ids = (await cards(PARENT_F1)).flatMap((item) =>
        item.parents.map((parent) => parent.id),
      );
      assert.ok(!ids.includes(PARENT_ROW_CO));
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      assert.ok(!(await cards(SUPER_ADMIN)).some((item) => item.family_id === FAMILY_2));
      const names = (await cards(SUPER_ADMIN)).map((item) => item.family_id);
      assert.deepEqual(
        names,
        (await cards(TEACHER_G1)).map((item) => item.family_id),
      );
    });

    // ---- profile_set_sharing: the fixed list ----

    it("lets a parent tick and untick their own sharing and writes one audit row per real change (BR31.2, BR31.3, BR31.4)", async () => {
      const ticked = await setSharing(PARENT_F1, PARENT_ROW_F1, 1, true);
      assert.deepEqual([ticked.state, ticked.version], ["success", 2]);
      const same = await setSharing(PARENT_F1, PARENT_ROW_F1, 2, true);
      assert.deepEqual(
        [same.state, same.version],
        ["success", 2],
        "an unchanged value changes nothing",
      );
      const unticked = await setSharing(PARENT_F1, PARENT_ROW_F1, 2, false);
      assert.equal(unticked.version, 3);
      const events = (await auditEvents(db)).filter(
        (event) => event.action === "profile.sharing_changed",
      );
      assert.deepEqual(
        events.map((event) => [event.actor_account_id, event.target_id, event.details]),
        [
          [PARENT_F1, PARENT_ROW_F1, "true"],
          [PARENT_F1, PARENT_ROW_F1, "false"],
        ],
      );
      assert.equal(
        (
          await db.query(
            "select consent_changed_at is not null as set from parent_profiles where parent_id = $1",
            [PARENT_ROW_F1],
          )
        ).rows[0].set,
        true,
      );
    });

    it("refuses everyone but the parent themself: a super admin, a co-parent, a teacher, a group administrator, a parent of another family (NFR3.4)", async () => {
      for (const account of [
        SUPER_ADMIN,
        CO_PARENT_F1,
        TEACHER_G1,
        ADMIN_G1,
        PARENT_F2,
        OUTSIDER,
      ]) {
        const result = await setSharing(account, PARENT_ROW_F1, 1, true);
        assert.equal(result.state, "denied", account);
      }
      assert.equal(
        (
          await db.query("select sharing_consent from parent_profiles where parent_id = $1", [
            PARENT_ROW_F1,
          ])
        ).rows[0].sharing_consent,
        false,
      );
      assert.equal(await count(db, "audit_events", "action = 'profile.sharing_changed'"), 0);
    });

    it("refuses a parent who names a parent of another community or an invented id exactly like a parent of the same community (out of reach)", async () => {
      const real = await setSharing(PARENT_F1, PARENT_ROW_OTHER, 1, true);
      const invented = await setSharing(PARENT_F1, "99999999-0000-4000-8000-000000000001", 1, true);
      assert.deepEqual([real.state, real.code], [invented.state, invented.code]);
      assert.equal(real.state, "denied");
    });

    it("refuses an outdated screen with VERSION_CONFLICT and changes nothing", async () => {
      await setSharing(PARENT_F1, PARENT_ROW_F1, 1, true);
      const stale = await setSharing(PARENT_F1, PARENT_ROW_F1, 1, false);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      assert.equal(
        (
          await db.query("select sharing_consent from parent_profiles where parent_id = $1", [
            PARENT_ROW_F1,
          ])
        ).rows[0].sharing_consent,
        true,
      );
    });

    it("answers a repeated click with the stored result and writes one audit row only", async () => {
      const key = nextKey("click");
      const first = await setSharing(PARENT_F1, PARENT_ROW_F1, 1, true, key);
      const again = await setSharing(PARENT_F1, PARENT_ROW_F1, 1, true, key);
      assert.equal(first.state, "success");
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.equal(await count(db, "audit_events", "action = 'profile.sharing_changed'"), 1);
      const reused = await setSharing(PARENT_F1, PARENT_ROW_F1, 2, false, key);
      assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);
    });

    it("lets one of two people acting at once win and refuses the other with VERSION_CONFLICT", async () => {
      for (let round = 0; round < 5; round += 1) {
        const version = await profileVersion(PARENT_ROW_F1);
        const current = (
          await db.query("select sharing_consent from parent_profiles where parent_id = $1", [
            PARENT_ROW_F1,
          ])
        ).rows[0].sharing_consent as boolean;
        const results = await Promise.all([
          setSharing(PARENT_F1, PARENT_ROW_F1, version, !current, nextKey("a"), extra[0]),
          setSharing(PARENT_F1, PARENT_ROW_F1, version, !current, nextKey("b"), extra[1]),
        ]);
        const states = results.map((result) => result.code ?? result.state).sort();
        assert.deepEqual(states, ["VERSION_CONFLICT", "success"], `round ${round}`);
      }
    });

    it("refuses a bad key and a missing value without changing anything", async () => {
      const badKey = await setSharing(PARENT_F1, PARENT_ROW_F1, 1, true, "");
      assert.deepEqual([badKey.state, badKey.code], ["validation", "idempotency_key_invalid"]);
      const missing = await callFunction(
        db,
        schema,
        PARENT_F1,
        "profile_set_sharing($1, $2, $3, null)",
        [nextKey("null"), PARENT_ROW_F1, 1],
      );
      assert.deepEqual([missing.state, missing.code], ["validation", "request_invalid"]);
    });

    // ---- profile_update_own: the fixed list ----

    it("lets a parent change their own details, clear a field with an empty text and leave an absent one as it is (BR32.1, BR32.3)", async () => {
      const saved = await updateOwn(PARENT_F1, PARENT_ROW_F1, 1, {
        phone: " +36 20 555 1212 ",
        occupation: "Tanár",
        hobby: "",
      });
      assert.deepEqual([saved.state, saved.version], ["success", 2]);
      const row = (
        await db.query(
          "select phone, occupation, hobby, residence, how_i_support from parent_profiles where parent_id = $1",
          [PARENT_ROW_F1],
        )
      ).rows[0];
      assert.deepEqual(row, {
        phone: "+36 20 555 1212",
        occupation: "Tanár",
        hobby: null,
        residence: "Pécs",
        how_i_support: "Süteményt sütök.",
      });
      assert.equal(await count(db, "audit_events"), 0, "own details write no audit row (NFR4)");
    });

    it("names every wrong field at once and stores nothing (BR32.2)", async () => {
      const bad = await updateOwn(PARENT_F1, PARENT_ROW_F1, 1, {
        phone: "hívj fel",
        residence: "x".repeat(101),
        occupation: "x".repeat(101),
        hobby: "x".repeat(201),
        how_i_support: "x".repeat(501),
      });
      assert.deepEqual([bad.state, bad.code], ["validation", "PROFILE_FIELD_INVALID"]);
      assert.deepEqual((bad.fields as string[]).sort(), [
        "hobby",
        "how_i_support",
        "occupation",
        "phone",
        "residence",
      ]);
      assert.equal(await profileVersion(PARENT_ROW_F1), 1);
    });

    it("refuses everyone but the parent themself, an outdated screen and a repeated click like the sharing choice", async () => {
      for (const account of [SUPER_ADMIN, CO_PARENT_F1, TEACHER_G1, ADMIN_G1, PARENT_F2]) {
        assert.equal(
          (await updateOwn(account, PARENT_ROW_F1, 1, { phone: "+36 1 234 5678" })).state,
          "denied",
          account,
        );
      }
      const key = nextKey("same");
      assert.equal(
        (await updateOwn(PARENT_F1, PARENT_ROW_F1, 1, { occupation: "Tanár" }, key)).state,
        "success",
      );
      const again = await updateOwn(PARENT_F1, PARENT_ROW_F1, 1, { occupation: "Tanár" }, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      const stale = await updateOwn(PARENT_F1, PARENT_ROW_F1, 1, { occupation: "Orvos" });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const notObject = await updateOwn(PARENT_F1, PARENT_ROW_F1, 2, ["phone"]);
      assert.deepEqual([notObject.state, notObject.code], ["validation", "request_invalid"]);
    });

    it("lets one of two saves of the same screen at once win (two people at once)", async () => {
      const results = await Promise.all([
        callFunction(extra[0]!, schema, PARENT_F1, "profile_update_own($1, $2, 1, $3::jsonb)", [
          nextKey("x"),
          PARENT_ROW_F1,
          JSON.stringify({ occupation: "Tanár" }),
        ]),
        callFunction(extra[1]!, schema, PARENT_F1, "profile_update_own($1, $2, 1, $3::jsonb)", [
          nextKey("y"),
          PARENT_ROW_F1,
          JSON.stringify({ occupation: "Orvos" }),
        ]),
      ]);
      assert.deepEqual(results.map((result) => result.code ?? result.state).sort(), [
        "VERSION_CONFLICT",
        "success",
      ]);
    });

    it("keeps a signed-in account out of the profile table of other parents and out of every new table (NFR3.7)", async () => {
      assert.equal(await countRows(PARENT_F1, "parent_profiles"), 1);
      assert.equal(await countRows(TEACHER_G1, "parent_profiles"), 0);
      for (const table of ["email_change_requests", "email_send_attempts", "migration_loads"]) {
        const denied = await db
          .query("select 1")
          .then(() => countRows(PARENT_F1, table))
          .then(
            () => "readable",
            (error: { code?: string }) => error.code,
          );
        assert.equal(denied, "42501", table);
      }
    });

    async function countRows(account: string, table: string): Promise<number> {
      const { countAs } = await import("./directory-support.ts");
      return countAs(db, schema, account, table);
    }
  });
}
