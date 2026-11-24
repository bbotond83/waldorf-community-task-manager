import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  SUPER_ADMIN,
} from "./directory-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  ADMIN_G1,
  CARE_GROUP_NAME,
  refused,
  seedAnimalWorld,
  TEACHER_G1,
} from "./animal-support.ts";

/**
 * The information page (W7, W8; BR86, BR87): the six starting sections, the list as every role, editing by a
 * coordinator (text only) or a super admin, link rules, creating, hiding, outdated pages, repeated clicks and two
 * people at once. All data is invented; the starting text holds no name or contact detail.
 */
type Item = {
  id: string;
  key: string;
  title: string;
  body: string;
  owning_group_name: string | null;
  season_months: number[] | null;
  position: number;
  hidden: boolean;
  version: number;
  can_edit_text: boolean;
  can_edit_all: boolean;
};

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`information sections in ${schema}`, () => {
    let db: pg.Client;
    let other: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      other = await openDatabase();
    });
    after(async () => {
      await other.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedAnimalWorld(db, schema, { slots: false });
      await db.query("delete from info_sections");
      await db.query(`select ${schema}.info_starting_sections_install($1)`, [ORGANIZATION]);
    });

    const list = async (account: string) =>
      callFunction(db, schema, account, "info_sections_list()");
    const items = async (account: string) => ((await list(account)).items ?? []) as Item[];
    const byKey = async (account: string, key: string) =>
      (await items(account)).find((i) => i.key === key)!;
    const update = (
      account: string,
      item: Item,
      change: Partial<{
        title: string;
        body: string;
        owner: string | null;
        months: number[] | null;
        position: number;
        version: number;
      }> = {},
      key = nextKey("is"),
      client: pg.Client = db,
    ) =>
      callFunction(client, schema, account, "info_section_update($1, $2, $3, $4, $5, $6, $7, $8)", [
        key,
        item.id,
        change.title ?? item.title,
        change.body ?? item.body,
        "owner" in change ? change.owner : item.owning_group_name,
        "months" in change ? change.months : item.season_months,
        change.position ?? item.position,
        change.version ?? item.version,
      ]);

    it("installs the six starting sections once, with owners and the watering season", async () => {
      const rows = (await items(SUPER_ADMIN)).sort((a, b) => a.position - b.position);
      assert.deepEqual(
        rows.map((r) => r.key),
        ["morning", "afternoon", "watering", "saturday-cleaning", "animal-feeding", "big-cleaning"],
      );
      assert.deepEqual(
        rows.map((r) => r.owning_group_name),
        [
          CARE_GROUP_NAME,
          CARE_GROUP_NAME,
          CARE_GROUP_NAME,
          CARE_GROUP_NAME,
          CARE_GROUP_NAME,
          "Nagytakarítás szervezése",
        ],
      );
      assert.deepEqual(
        rows.find((r) => r.key === "watering")!.season_months,
        [3, 4, 5, 6, 7, 8, 9, 10],
      );
      assert.ok(rows.every((r) => r.title === "Locsolás" || r.key !== "watering"));
      const again = await db.query(`select ${schema}.info_starting_sections_install($1) as n`, [
        ORGANIZATION,
      ]);
      assert.equal(again.rows[0].n, 0);
      for (const row of rows) {
        assert.ok(
          !/@|\+36|\d{2}[ /-]\d{3}[ -]\d{4}/.test(row.body),
          `${row.key} holds no contact detail`,
        );
        assert.ok(row.body.length > 100 && row.body.length <= 20000);
      }
    });

    it("lets every member read the visible sections and only super admins see hidden ones (allowed, out of reach)", async () => {
      const morning = await byKey(SUPER_ADMIN, "morning");
      const hid = await callFunction(
        db,
        schema,
        SUPER_ADMIN,
        "info_section_set_hidden($1, $2, true, $3)",
        [nextKey("h"), morning.id, morning.version],
      );
      assert.equal(hid.state, "success", JSON.stringify(hid));
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1]) {
        const seen = await items(account);
        assert.equal(seen.length, 5, account);
        assert.ok(seen.every((i) => !i.hidden));
        assert.ok(seen.every((i) => !i.can_edit_all));
      }
      const all = await items(SUPER_ADMIN);
      assert.equal(all.length, 6);
      assert.equal(all.find((i) => i.key === "morning")!.hidden, true);
      assert.equal((await list(OUTSIDER)).state, "denied");
      const restored = await callFunction(
        db,
        schema,
        SUPER_ADMIN,
        "info_section_set_hidden($1, $2, false, $3)",
        [nextKey("h"), morning.id, Number(hid.version)],
      );
      assert.equal(restored.state, "success");
      assert.equal((await items(PARENT_F1)).length, 6);
    });

    it("keeps a coordinator away from a hidden section of their own group, by id too (out of reach)", async () => {
      const section = await byKey(SUPER_ADMIN, "afternoon");
      assert.equal((await update(SUPER_ADMIN, section, { owner: "Boróka" })).state, "success");
      const owned = await byKey(SUPER_ADMIN, "afternoon");
      const hid = await callFunction(
        db,
        schema,
        SUPER_ADMIN,
        "info_section_set_hidden($1, $2, true, $3)",
        [nextKey("h"), owned.id, owned.version],
      );
      assert.equal(hid.state, "success", JSON.stringify(hid));
      const hidden = await byKey(SUPER_ADMIN, "afternoon");
      refused(
        await update(ADMIN_G1, hidden, { body: "Rejtett szakasz." }),
        "denied",
        "authorization_denied",
      );
      assert.equal((await byKey(SUPER_ADMIN, "afternoon")).body, hidden.body);
    });

    it("hides a section once for a repeated click, refuses an outdated page and lets one of two hide calls win", async () => {
      const section = await byKey(SUPER_ADMIN, "morning");
      const hide = (version: number, key = nextKey("h"), client: pg.Client = db) =>
        callFunction(client, schema, SUPER_ADMIN, "info_section_set_hidden($1, $2, true, $3)", [
          key,
          section.id,
          version,
        ]);
      const key = nextKey("h");
      assert.equal((await hide(section.version, key)).state, "success");
      assert.equal((await hide(section.version, key)).code, "replayed");
      refused(await hide(section.version), "conflict", "VERSION_CONFLICT");
      const other2 = await byKey(SUPER_ADMIN, "afternoon");
      const answers = await Promise.all(
        [db, other].map((client) =>
          callFunction(client, schema, SUPER_ADMIN, "info_section_set_hidden($1, $2, true, $3)", [
            nextKey("r"),
            other2.id,
            other2.version,
          ]),
        ),
      );
      assert.equal(answers.filter((a) => a.state === "success").length, 1, JSON.stringify(answers));
    });

    it("lets a super admin change every field and a parent change nothing (refused)", async () => {
      const item = await byKey(SUPER_ADMIN, "morning");
      const done = await update(SUPER_ADMIN, item, {
        title: "Reggeli teendők (új)",
        body: "Új szöveg [terv](/szulo/allatok) és [oldal](https://example.test/x).",
        owner: CARE_GROUP_NAME.toLowerCase(),
        months: [3, 4],
        position: 9,
      });
      assert.equal(done.state, "success", JSON.stringify(done));
      const after = await byKey(SUPER_ADMIN, "morning");
      assert.deepEqual(
        [after.title, after.owning_group_name, after.season_months, after.position, after.version],
        ["Reggeli teendők (új)", CARE_GROUP_NAME, [3, 4], 9, item.version + 1],
      );
      refused(await update(PARENT_F1, after, { body: "x" }), "denied", "authorization_denied");
      refused(await update(TEACHER_G1, after, { body: "x" }), "denied", "authorization_denied");
      refused(await update(OUTSIDER, after, { body: "x" }), "denied", "authorization_denied");
    });

    it("lets the owning group's coordinator change the text only, and only in the current year (BR87.6)", async () => {
      const section = await byKey(SUPER_ADMIN, "afternoon");
      refused(
        await update(ADMIN_G1, section, { body: "Nem az ő csoportja." }),
        "denied",
        "authorization_denied",
      );
      assert.equal((await update(SUPER_ADMIN, section, { owner: "Boróka" })).state, "success");
      const owned = await byKey(ADMIN_G1, "afternoon");
      assert.equal(owned.can_edit_text, true);
      assert.equal(owned.can_edit_all, false);
      const changed = await update(ADMIN_G1, owned, { body: "A koordinátor szövege." });
      assert.equal(changed.state, "success", JSON.stringify(changed));
      const now = await byKey(ADMIN_G1, "afternoon");
      refused(await update(ADMIN_G1, now, { title: "Más cím" }), "denied", "authorization_denied");
      refused(await update(ADMIN_G1, now, { owner: null }), "denied", "authorization_denied");
      refused(await update(ADMIN_G1, now, { months: [1] }), "denied", "authorization_denied");
      refused(await update(ADMIN_G1, now, { position: 5 }), "denied", "authorization_denied");
      await db.query(
        "update app_role_grants set revoked_at = now() where subject_id = $1 and role = 'group_admin'",
        [ADMIN_G1],
      );
      refused(
        await update(ADMIN_G1, now, { body: "Már nem koordinátor." }),
        "denied",
        "authorization_denied",
      );
      await db.query("update groups set status = 'archived' where name = 'Boróka'");
      refused(await update(SUPER_ADMIN, now, { owner: "Boróka" }), "validation", "field_invalid");
    });

    it("refuses bad link addresses, bad owners, bad months and over-long text", async () => {
      const item = await byKey(SUPER_ADMIN, "morning");
      for (const body of [
        "[x](javascript:alert(1))",
        "[x](//evil.test/a)",
        "[x](ftp://example.test/a)",
        "[x]( https://example.test/a)",
        "[x]()",
      ]) {
        refused(await update(SUPER_ADMIN, item, { body }), "validation", "INFO_TEXT_INVALID");
      }
      assert.equal(
        (await update(SUPER_ADMIN, item, { body: "<b>nem fut</b> [ok](/informacio#morning)" }))
          .state,
        "success",
      );
      const fresh = await byKey(SUPER_ADMIN, "morning");
      assert.equal(
        (await update(SUPER_ADMIN, fresh, { owner: "Nincs ilyen csoport" })).state,
        "validation",
      );
      assert.equal((await update(SUPER_ADMIN, fresh, { months: [0, 13] })).state, "validation");
      assert.equal((await update(SUPER_ADMIN, fresh, { months: [3, 3] })).state, "validation");
      assert.equal(
        (await update(SUPER_ADMIN, fresh, { body: "a".repeat(20001) })).state,
        "validation",
      );
      assert.equal((await update(SUPER_ADMIN, fresh, { title: "" })).state, "validation");
    });

    it("refuses a save on an outdated page and replays a repeated click (outdated screen, repeated click)", async () => {
      const item = await byKey(SUPER_ADMIN, "morning");
      const key = nextKey("same");
      assert.equal((await update(SUPER_ADMIN, item, { body: "Egy." }, key)).state, "success");
      assert.equal((await update(SUPER_ADMIN, item, { body: "Egy." }, key)).code, "replayed");
      refused(await update(SUPER_ADMIN, item, { body: "Kettő." }), "conflict", "VERSION_CONFLICT");
      assert.equal((await byKey(SUPER_ADMIN, "morning")).body, "Egy.");
    });

    it("lets one of two simultaneous saves of the same version win (two people at once)", async () => {
      const item = await byKey(SUPER_ADMIN, "morning");
      const answers = await Promise.all([
        update(SUPER_ADMIN, item, { body: "A." }),
        update(SUPER_ADMIN, item, { body: "B." }, nextKey("r"), other),
      ]);
      assert.equal(answers.filter((a) => a.state === "success").length, 1, JSON.stringify(answers));
      assert.equal((await byKey(SUPER_ADMIN, "morning")).version, item.version + 1);
    });

    it("creates a section with a key made from its title, for super admins only", async () => {
      const create = (account: string, title: string, owner: string | null = null) =>
        callFunction(db, schema, account, "info_section_create($1, $2, $3, $4, $5, $6)", [
          nextKey("c"),
          title,
          "Szöveg [link](https://example.test/a).",
          owner,
          null,
          7,
        ]);
      const made = await create(SUPER_ADMIN, "Új, Érdekes Szekció!", CARE_GROUP_NAME);
      assert.equal(made.state, "success", JSON.stringify(made));
      assert.equal((await byKey(SUPER_ADMIN, "uj-erdekes-szekcio")).title, "Új, Érdekes Szekció!");
      const twin = await create(SUPER_ADMIN, "Új, Érdekes Szekció!");
      assert.equal(twin.state, "success");
      assert.ok(await byKey(SUPER_ADMIN, "uj-erdekes-szekcio-2"));
      for (const account of [PARENT_F1, ADMIN_G1, TEACHER_G1, OUTSIDER]) {
        refused(await create(account, "Tilos"), "denied", "authorization_denied");
      }
      assert.equal((await create(SUPER_ADMIN, "")).state, "validation");
      const key = nextKey("dup");
      const call = () =>
        callFunction(
          db,
          schema,
          SUPER_ADMIN,
          "info_section_create($1, 'Ismételt', 'Szöveg', null, null, 8)",
          [key],
        );
      assert.equal((await call()).state, "success");
      assert.equal((await call()).code, "replayed");
      assert.equal((await items(SUPER_ADMIN)).filter((i) => i.title === "Ismételt").length, 1);
    });

    it("refuses hiding by anyone but a super admin and on an outdated page", async () => {
      const item = await byKey(SUPER_ADMIN, "morning");
      for (const account of [PARENT_F1, ADMIN_G1, TEACHER_G1]) {
        refused(
          await callFunction(db, schema, account, "info_section_set_hidden($1, $2, true, $3)", [
            nextKey("h"),
            item.id,
            item.version,
          ]),
          "denied",
          "authorization_denied",
        );
      }
      refused(
        await callFunction(db, schema, SUPER_ADMIN, "info_section_set_hidden($1, $2, true, $3)", [
          nextKey("h"),
          item.id,
          item.version + 3,
        ]),
        "conflict",
        "VERSION_CONFLICT",
      );
    });
  });
}
