import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  auditRows,
  caller,
  COMMUNITY_EVENT,
  GROUP_EVENT,
  PAST_EVENT,
  seedEventWorld,
} from "./events-support.ts";
import { count } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  PARENT_ROW_NO_ACCOUNT,
  SUPER_ADMIN,
  addMemberWithoutAccount,
} from "./working-groups-support.ts";

/**
 * The role rules of U10 (W5; BR105.1 to BR106.2, BR123.1, BR124.2) on the fixed list. Not applicable:
 * - the organiser mark gives no right to edit the event: shown as "refused" for a marked parent;
 * - event_typed_roles_list is a read: no stale screen, no repeated click and no race to lose.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;
type Role = { id: string; name: string; kind: string; display_name: string; is_organiser: boolean };

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`event roles in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(() => seedEventWorld(db, schema));

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const args = (
      event: string,
      role: string | null,
      version: number | null,
      name: string,
      parent: string | null,
      person: string | null,
      organiser: boolean,
      key = nextKey("r"),
    ) => [key, event, role, version, name, parent, person, organiser];
    const SAVE = "event_role_save($1, $2, $3, $4, $5, $6, $7, $8)";
    const add = (
      account: string,
      event: string,
      name: string,
      parent: string | null,
      person: string | null,
      organiser = false,
    ) => call(account, SAVE, args(event, null, null, name, parent, person, organiser));
    const outcome = (result: Result) => [result.state, result.code];
    const roles = async (event: string) =>
      ((await call(SUPER_ADMIN, "event_get($1)", [event])) as Result & { roles: Role[] }).roles;

    it("allowed: a role with a parent or a typed name; the organiser mark is audited without a name", async () => {
      const typed = await add(SUPER_ADMIN, COMMUNITY_EVENT, "Zenész", null, "Vendég Béla");
      assert.deepEqual([typed.state, typed.version], ["success", 1]);
      const parent = await add(SUPER_ADMIN, COMMUNITY_EVENT, "Szervező", PARENT_ROW_F1, null, true);
      assert.equal(parent.state, "success");
      const listed = await roles(COMMUNITY_EVENT);
      assert.deepEqual(
        listed.map((role) => role.kind),
        ["typed", "parent"],
      );
      assert.equal(listed[0]!.display_name, "Vendég Béla");
      const marked = await auditRows(db, "event.organiser_marked");
      assert.equal(marked.length, 1);
      assert.equal(marked[0]!.details, `event:${COMMUNITY_EVENT}`);
      assert.equal(JSON.stringify(marked).includes("Vendég"), false);
      const unmarked = await call(
        SUPER_ADMIN,
        SAVE,
        args(COMMUNITY_EVENT, parent.reference!, 1, "Szervező", PARENT_ROW_F1, null, false),
      );
      assert.deepEqual([unmarked.state, unmarked.version], ["success", 2]);
      assert.equal((await auditRows(db, "event.organiser_unmarked")).length, 1);
    });
    it("allowed: a group admin manages the roles of a group event; roles stay changeable after the event ended", async () => {
      assert.equal(
        (await add(ADMIN_G1, GROUP_EVENT, "Segítő", PARENT_ROW_F1, null)).state,
        "success",
      );
      assert.equal(
        (await add(SUPER_ADMIN, PAST_EVENT, "Fotós", null, "Utólag Ede")).state,
        "success",
      );
    });
    it("refused: exactly one person, an organiser needs a parent, parents need an account, limits of 20 roles", async () => {
      const both = await add(SUPER_ADMIN, COMMUNITY_EVENT, "R", PARENT_ROW_F1, "Név");
      assert.deepEqual([both.field, both.reason], ["person", "person_invalid"]);
      const none = await add(SUPER_ADMIN, COMMUNITY_EVENT, "R", null, null);
      assert.deepEqual([none.field, none.reason], ["person", "person_invalid"]);
      const organiser = await add(SUPER_ADMIN, COMMUNITY_EVENT, "R", null, "Név", true);
      assert.deepEqual(outcome(organiser), ["validation", "ROLE_ORGANISER_NEEDS_ACCOUNT"]);
      await addMemberWithoutAccount(db);
      const noAccount = await add(SUPER_ADMIN, COMMUNITY_EVENT, "R", PARENT_ROW_NO_ACCOUNT, null);
      assert.equal(noAccount.reason, "person_invalid");
      assert.equal((await add(SUPER_ADMIN, COMMUNITY_EVENT, " ", null, "Név")).field, "name");
      for (let index = 0; index < 20; index += 1) {
        assert.equal(
          (await add(SUPER_ADMIN, COMMUNITY_EVENT, `Szerep ${index}`, null, "Név")).state,
          "success",
        );
      }
      const extra = await add(SUPER_ADMIN, COMMUNITY_EVENT, "Huszonegyedik", null, "Név");
      assert.deepEqual([extra.field, extra.reason], ["roles", "too_many"]);
      assert.equal(await count(db, "event_roles", `event_id = '${COMMUNITY_EVENT}'`), 20);
    });
    it("refused and out of reach: a marked organiser, a parent, a teacher and another group's admin cannot manage roles", async () => {
      const marked = await add(SUPER_ADMIN, COMMUNITY_EVENT, "Szervező", PARENT_ROW_F1, null, true);
      assert.equal(marked.state, "success");
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, OUTSIDER]) {
        assert.deepEqual(
          outcome(await add(account, COMMUNITY_EVENT, "Tilos", null, "Név")),
          ["denied", "authorization_denied"],
          account,
        );
      }
      assert.equal((await add(ADMIN_G2, GROUP_EVENT, "Tilos", null, "Név")).state, "denied");
      for (const account of [SIGNED_OUT]) {
        assert.deepEqual(outcome(await add(account, COMMUNITY_EVENT, "X", null, "Név")), [
          "denied",
          "session_inactive",
        ]);
      }
      const real = await add(OTHER_ADMIN, COMMUNITY_EVENT, "X", null, "Név");
      const made = await add(OTHER_ADMIN, "99999999-0000-4000-8000-000000000005", "X", null, "Név");
      assert.deepEqual([real.state, real.field], [made.state, made.field]);
    });
    it("outdated screen: an old role version is a conflict; removal needs the version too", async () => {
      const role = await add(SUPER_ADMIN, COMMUNITY_EVENT, "Egy", null, "Név");
      const stale = await call(
        SUPER_ADMIN,
        SAVE,
        args(COMMUNITY_EVENT, role.reference!, 9, "Új", null, "Név", false),
      );
      assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
      const staleRemove = await call(SUPER_ADMIN, "event_role_remove($1, $2, $3)", [
        nextKey("x"),
        role.reference,
        9,
      ]);
      assert.deepEqual(outcome(staleRemove), ["conflict", "VERSION_CONFLICT"]);
      assert.equal(
        (
          await call(SUPER_ADMIN, "event_role_remove($1, $2, $3)", [
            nextKey("x"),
            role.reference,
            1,
          ])
        ).state,
        "success",
      );
      assert.equal(await count(db, "event_roles"), 0);
    });
    it("repeated click: the same key makes one role", async () => {
      const key = nextKey("rep");
      const first = await call(
        SUPER_ADMIN,
        SAVE,
        args(COMMUNITY_EVENT, null, null, "Egyszer", null, "Név", false, key),
      );
      const again = await call(
        SUPER_ADMIN,
        SAVE,
        args(COMMUNITY_EVENT, null, null, "Egyszer", null, "Név", false, key),
      );
      assert.deepEqual(outcome(again), ["success", "replayed"]);
      assert.equal(again.reference, first.reference);
      assert.equal(await count(db, "event_roles"), 1);
    });
    it("two at once: two changes of one role version leave one winner; the 21st role cannot slip in beside the 20th", async () => {
      const role = await add(SUPER_ADMIN, COMMUNITY_EVENT, "Egy", null, "Név");
      const answers = await Promise.all([
        call(SUPER_ADMIN, SAVE, args(COMMUNITY_EVENT, role.reference!, 1, "A", null, "Név", false)),
        callSecond(
          SUPER_ADMIN,
          SAVE,
          args(COMMUNITY_EVENT, role.reference!, 1, "B", null, "Név", false),
        ),
      ]);
      assert.deepEqual(answers.map((answer) => answer.state).sort(), ["conflict", "success"]);
      for (let index = 0; index < 18; index += 1) {
        await add(SUPER_ADMIN, COMMUNITY_EVENT, `Szerep ${index}`, null, "Név");
      }
      const racers = await Promise.all([
        add(SUPER_ADMIN, COMMUNITY_EVENT, "Utolsó A", null, "Név"),
        callSecond(
          SUPER_ADMIN,
          SAVE,
          args(COMMUNITY_EVENT, null, null, "Utolsó B", null, "Név", false),
        ),
      ]);
      assert.deepEqual(racers.map((answer) => answer.state).sort(), ["success", "validation"]);
      assert.equal(await count(db, "event_roles", `event_id = '${COMMUNITY_EVENT}'`), 20);
    });
    it("clearing a typed name: only a super admin; the role then shows korábbi tag; audited without the name", async () => {
      const role = await add(SUPER_ADMIN, COMMUNITY_EVENT, "Zenész", null, "Elköltözött Pál");
      const clear = (account: string, version: number, key = nextKey("c")) =>
        call(account, "event_role_clear_name($1, $2, $3)", [key, role.reference, version]);
      assert.equal((await clear(ADMIN_G1, 1)).state, "denied");
      assert.deepEqual(outcome(await clear(SUPER_ADMIN, 9)), ["conflict", "VERSION_CONFLICT"]);
      const key = nextKey("clear");
      assert.equal((await clear(SUPER_ADMIN, 1, key)).state, "success");
      assert.deepEqual(outcome(await clear(SUPER_ADMIN, 1, key)), ["success", "replayed"]);
      assert.equal((await roles(COMMUNITY_EVENT))[0]!.display_name, "korábbi tag");
      const audit = await auditRows(db, "event.name_cleared");
      assert.equal(audit.length, 1);
      assert.equal(JSON.stringify(audit).includes("Pál"), false);
      assert.equal((await clear(SUPER_ADMIN, 2)).code, "no_typed_name");
    });
    it("lists typed names for the removal screen to a super admin only", async () => {
      await add(SUPER_ADMIN, COMMUNITY_EVENT, "Zenész", null, "Idegen Név");
      const listing = (await call(SUPER_ADMIN, "event_typed_roles_list($1, $2)", [
        "parent",
        PARENT_ROW_F2,
      ])) as Result & {
        items: { person_name: string }[];
      };
      assert.deepEqual(
        listing.items.map((item) => item.person_name),
        ["Idegen Név"],
      );
      assert.deepEqual(
        outcome(await call(ADMIN_G1, "event_typed_roles_list($1, $2)", ["parent", PARENT_ROW_F2])),
        ["denied", "authorization_denied"],
      );
      assert.equal(
        (await call(PARENT_F2, "event_typed_roles_list($1, $2)", ["parent", PARENT_ROW_F2])).state,
        "denied",
      );
    });
  });
}
