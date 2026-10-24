import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  CHILD_F1,
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  FAMILY_OTHER,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedDirectoryWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  ADMIN_G1,
  ADMIN_G2,
  YEAR_1,
  uuid,
  asActor,
  authenticated,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { failureOf } from "./stack-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;

/** Directory and Settings functions: reach, validation, versions, consent, memberships, settings and repeated keys (BR30, BR32.8, NFR6.11, NFR6.12). */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`directory functions in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedDirectoryWorld(db, schema);
    });

    const save = (account: string, payload: unknown, key = nextKey("save")): Promise<Result> =>
      callFunction(db, schema, account, "directory_save($1, $2::jsonb)", [
        key,
        JSON.stringify(payload),
      ]);
    const structure = (account: string, kind: string, payload: unknown, key = nextKey("st")) =>
      callFunction(db, schema, account, "structure_save($1, $2, $3::jsonb)", [
        key,
        kind,
        JSON.stringify(payload),
      ]);
    const archive = (account: string, kind: string, id: string, version: number) =>
      callFunction(db, schema, account, "directory_archive_item($1, $2, $3, $4)", [
        nextKey("ar"),
        kind,
        id,
        version,
      ]);
    const restore = (account: string, kind: string, id: string, version: number) =>
      callFunction(db, schema, account, "directory_restore_item($1, $2, $3, $4)", [
        nextKey("re"),
        kind,
        id,
        version,
      ]);
    const one = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0] as Record<string, unknown>;

    const newFamily = {
      display_name: "Új család",
      parents: [
        {
          display_name: "Új Anna",
          optional_profile_consent: true,
          optional_profile: "Kertészkedem.",
          contact: { email: "Anna@Example.test", phone: "+36 30 123 4567", locality: "Pécs" },
        },
      ],
      children: [{ display_name: "Új Gergő" }],
      add_group_ids: [GROUP_1],
    };

    it("creates a family with its parents, contacts, children and membership in one call, as a super admin", async () => {
      const result = await save(SUPER_ADMIN, newFamily);
      assert.equal(result.state, "success");
      assert.equal(result.version, 1);
      const familyId = result.reference as string;
      assert.equal(await count(db, "parents", `family_id = '${familyId}'`), 1);
      assert.equal(await count(db, "children", `family_id = '${familyId}'`), 1);
      const contact = await one(
        "select c.contact_email, c.contact_phone, c.locality from parent_contacts c join parents p on p.id = c.parent_id where p.family_id = $1",
        [familyId],
      );
      assert.deepEqual(contact, {
        contact_email: "anna@example.test",
        contact_phone: "+36 30 123 4567",
        locality: "Pécs",
      });
      assert.equal(
        await count(
          db,
          "group_memberships",
          `family_id = '${familyId}' and group_id = '${GROUP_1}' and status = 'active'`,
        ),
        1,
      );
      assert.equal(
        await count(db, "parents", `family_id = '${familyId}' and account_id is not null`),
        0,
      );
    });

    it("lets a group admin create a family only with a membership of a group they reach, and change it afterwards", async () => {
      const without = await save(ADMIN_G1, { ...newFamily, add_group_ids: [] });
      assert.deepEqual([without.state, without.code], ["denied", "authorization_denied"]);
      const otherGroup = await save(ADMIN_G1, { ...newFamily, add_group_ids: [GROUP_2] });
      assert.equal(otherGroup.state, "denied");
      assert.equal(
        await count(db, "families", "display_name = 'Új család'"),
        0,
        "nothing was created",
      );
      const created = await save(ADMIN_G1, newFamily);
      assert.equal(created.state, "success");
      const changed = await save(ADMIN_G1, {
        family_id: created.reference,
        expected_version: created.version,
        display_name: "Átnevezett család",
      });
      assert.equal(changed.state, "success");
      assert.equal(changed.version, 2);
      assert.equal(
        (await one("select display_name from families where id = $1", [created.reference]))
          .display_name,
        "Átnevezett család",
      );
    });

    it("denies every role that is not an admin in reach, answers like a missing record for another organization, and refuses an inactive session", async () => {
      const change = (account: string, family: string) =>
        save(account, { family_id: family, expected_version: 1, display_name: "Más név" });
      for (const account of [PARENT_F1, CO_PARENT_F1, PARENT_F2, TEACHER_G1, OUTSIDER]) {
        assert.equal((await change(account, FAMILY_1)).state, "denied", account);
      }
      assert.equal(
        (await change(ADMIN_G2, FAMILY_1)).state,
        "denied",
        "group admin of another group",
      );
      assert.equal(
        (await change(ADMIN_G1, FAMILY_NO_GROUP)).state,
        "denied",
        "family without a group",
      );
      assert.equal(
        (await change(SUPER_ADMIN, FAMILY_NO_GROUP)).state,
        "success",
        "super admin reaches it",
      );
      const foreign = await change(SUPER_ADMIN, FAMILY_OTHER);
      assert.deepEqual([foreign.state, foreign.code], ["validation", "family_not_found"]);
      const crossAdmin = await change(OTHER_ADMIN, FAMILY_1);
      assert.deepEqual([crossAdmin.state, crossAdmin.code], ["validation", "family_not_found"]);
      const inactive = await change(DEACTIVATED, FAMILY_1);
      assert.deepEqual([inactive.state, inactive.code], ["denied", "session_inactive"]);
      assert.equal(
        (await one("select display_name from families where id = $1", [FAMILY_1])).display_name,
        "Fenyő család",
      );
    });

    it("refuses a stale version with VERSION_CONFLICT and writes nothing, not even the parts that came before", async () => {
      const stale = await save(SUPER_ADMIN, {
        family_id: FAMILY_1,
        expected_version: 99,
        display_name: "Elavult",
      });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      // The family is current, but a nested parent carries an old version: the family rename that was
      // already written inside the call is rolled back with it.
      const nested = await save(SUPER_ADMIN, {
        family_id: FAMILY_1,
        expected_version: 1,
        display_name: "Félig mentett",
        children: [{ display_name: "Új gyerek" }],
        parents: [{ id: PARENT_ROW_F1, expected_version: 42, display_name: "Fenyő Anna" }],
      });
      assert.deepEqual([nested.state, nested.code], ["conflict", "VERSION_CONFLICT"]);
      assert.equal(
        (await one("select display_name, version from families where id = $1", [FAMILY_1]))
          .display_name,
        "Fenyő család",
      );
      assert.equal(await count(db, "children", `family_id = '${FAMILY_1}'`), 1);
      const missing = await save(SUPER_ADMIN, {
        family_id: FAMILY_1,
        display_name: "Verzió nélkül",
      });
      assert.deepEqual([missing.state, missing.code], ["validation", "field_invalid"]);
      assert.equal(missing.field, "expected_version");
    });

    it("validates every field against the limits of the design and names the field", async () => {
      const long = (n: number) => "x".repeat(n);
      const cases: [string, unknown][] = [
        ["display_name", { ...newFamily, display_name: "   " }],
        ["display_name", { ...newFamily, display_name: long(201) }],
        ["parents.display_name", { ...newFamily, parents: [{ display_name: "" }] }],
        [
          "parents.contact.email",
          { ...newFamily, parents: [{ display_name: "A", contact: { email: "nem-cim" } }] },
        ],
        [
          "parents.contact.phone",
          { ...newFamily, parents: [{ display_name: "A", contact: { phone: "12" } }] },
        ],
        [
          "parents.contact.locality",
          { ...newFamily, parents: [{ display_name: "A", contact: { locality: long(101) } }] },
        ],
        [
          "parents.optional_profile",
          {
            ...newFamily,
            parents: [
              { display_name: "A", optional_profile_consent: true, optional_profile: long(501) },
            ],
          },
        ],
        ["children.display_name", { ...newFamily, children: [{ display_name: long(201) }] }],
        ["add_group_ids", { ...newFamily, add_group_ids: ["nem-uuid"] }],
      ];
      for (const [field, payload] of cases) {
        const result = await save(SUPER_ADMIN, payload);
        assert.deepEqual(
          [result.state, result.code, result.field],
          ["validation", "field_invalid", field],
          field,
        );
      }
      const tooMany = await save(SUPER_ADMIN, {
        ...newFamily,
        children: Array.from({ length: 21 }, () => ({ display_name: "Gyerek" })),
      });
      assert.deepEqual([tooMany.state, tooMany.code], ["validation", "request_invalid"]);
      assert.equal(await count(db, "families"), 4, "no refused request created a family");
    });

    it("stores the optional profile only with consent and empties it when consent is withdrawn (BR30.4)", async () => {
      const created = await save(SUPER_ADMIN, {
        display_name: "Profil család",
        parents: [
          { display_name: "Nincs hozzájárulás", optional_profile: "Ezt nem szabad tárolni." },
          {
            display_name: "Hozzájárult",
            optional_profile_consent: true,
            optional_profile: "Szívesen sütök.",
          },
        ],
        add_group_ids: [GROUP_1],
      });
      assert.equal(created.state, "success");
      const rows = async () =>
        (
          await db.query(
            "select display_name, optional_profile, optional_profile_consent, version, id from parents where family_id = $1 order by display_name",
            [created.reference],
          )
        ).rows as {
          display_name: string;
          optional_profile: string | null;
          optional_profile_consent: boolean;
          version: number;
          id: string;
        }[];
      let [consenting, without] = await rows();
      assert.equal(without!.optional_profile, null, "text sent without consent is dropped");
      assert.equal(consenting!.optional_profile, "Szívesen sütök.");
      // Changing the name keeps the stored profile when the payload does not mention it.
      await save(SUPER_ADMIN, {
        family_id: created.reference,
        expected_version: 1,
        display_name: "Profil család",
        parents: [{ id: consenting!.id, expected_version: 1, display_name: "Hozzájárult Anna" }],
      });
      [consenting, without] = await rows();
      assert.equal(consenting!.display_name, "Hozzájárult Anna");
      assert.equal(consenting!.optional_profile, "Szívesen sütök.");
      // Withdrawing consent empties the text in the same change.
      await save(SUPER_ADMIN, {
        family_id: created.reference,
        expected_version: 2,
        display_name: "Profil család",
        parents: [
          {
            id: consenting!.id,
            expected_version: consenting!.version,
            display_name: "Hozzájárult Anna",
            optional_profile_consent: false,
          },
        ],
      });
      [consenting] = await rows();
      assert.deepEqual(
        [consenting!.optional_profile_consent, consenting!.optional_profile],
        [false, null],
      );
    });

    it("adds and ends memberships only in groups the admin reaches, refuses a duplicate and a group of another organization", async () => {
      // The version moves with every accepted save: read it before each call.
      const version = async () =>
        (await one("select version from families where id = $1", [FAMILY_1])).version as number;
      const call = async (account: string, groups: string[], end: string[] = []) =>
        save(account, {
          family_id: FAMILY_1,
          expected_version: await version(),
          display_name: "Fenyő család",
          add_group_ids: groups,
          end_group_ids: end,
        });
      const duplicate = await call(ADMIN_G1, [GROUP_1]);
      assert.deepEqual([duplicate.state, duplicate.code], ["conflict", "MEMBERSHIP_DUPLICATE"]);
      const unreached = await call(ADMIN_G1, [GROUP_2]);
      assert.equal(unreached.state, "denied", "a group admin adds only groups they reach");
      const foreign = await call(SUPER_ADMIN, [GROUP_OTHER]);
      assert.deepEqual(
        [foreign.state, foreign.code, foreign.field],
        ["validation", "field_invalid", "add_group_ids"],
      );
      assert.equal((await call(SUPER_ADMIN, [GROUP_2])).state, "success");
      // Ending needs reach of that group: the admin of group 1 cannot end the group 2 membership.
      assert.equal((await call(ADMIN_G1, [], [GROUP_2])).state, "denied");
      assert.equal((await call(ADMIN_G2, [], [GROUP_2])).state, "success");
      assert.equal(
        await count(
          db,
          "group_memberships",
          `family_id = '${FAMILY_1}' and group_id = '${GROUP_2}' and status = 'ended'`,
        ),
        1,
      );
      const notMember = await call(SUPER_ADMIN, [], [GROUP_2]);
      assert.deepEqual([notMember.state, notMember.field], ["validation", "end_group_ids"]);
      // Ending a membership keeps the family and its history.
      assert.equal(await count(db, "group_memberships", `family_id = '${FAMILY_1}'`), 2);
    });

    it("links a sign-in account only through a super admin correction and never to two parents (BR30.3)", async () => {
      const version = async () =>
        (await one("select version from families where id = $1", [FAMILY_2])).version as number;
      const link = async (account: string, parentRow: string, accountId: string | null) =>
        save(account, {
          family_id: FAMILY_2,
          expected_version: await version(),
          display_name: "Napraforgó család",
          children: [{ display_name: "Rolled back" }],
          parents: [
            {
              id: parentRow,
              expected_version: (
                await one("select version from parents where id = $1", [parentRow])
              ).version,
              display_name: "Napraforgó Csilla",
              account_id: accountId,
            },
          ],
        });
      const newParent = await save(SUPER_ADMIN, {
        family_id: FAMILY_2,
        expected_version: await version(),
        display_name: "Napraforgó család",
        parents: [{ display_name: "Napraforgó Dénes" }],
      });
      assert.equal(newParent.state, "success");
      const second = (
        await one(
          "select id from parents where family_id = $1 and display_name = 'Napraforgó Dénes'",
          [FAMILY_2],
        )
      ).id as string;
      const denied = await save(ADMIN_G2, {
        family_id: FAMILY_2,
        expected_version: await version(),
        display_name: "Napraforgó család",
        parents: [
          {
            id: second,
            expected_version: 1,
            display_name: "Napraforgó Dénes",
            account_id: OUTSIDER,
          },
        ],
      });
      assert.equal(denied.state, "denied", "a group admin does not link accounts");
      const linked = await save(SUPER_ADMIN, {
        family_id: FAMILY_2,
        expected_version: await version(),
        display_name: "Napraforgó család",
        parents: [
          {
            id: second,
            expected_version: 1,
            display_name: "Napraforgó Dénes",
            account_id: OUTSIDER,
          },
        ],
      });
      assert.equal(linked.state, "success");
      // The same account on another parent is refused and the whole call is rolled back.
      const twice = await link(SUPER_ADMIN, PARENT_ROW_F2, OUTSIDER);
      assert.deepEqual([twice.state, twice.code], ["conflict", "ACCOUNT_ALREADY_LINKED"]);
      assert.equal(await count(db, "children", "display_name = 'Rolled back'"), 0);
      const missingAccount = await link(SUPER_ADMIN, second, uuid(9999));
      assert.deepEqual(
        [missingAccount.state, missingAccount.field],
        ["validation", "parents.account_id"],
      );
      const unlinked = await save(SUPER_ADMIN, {
        family_id: FAMILY_2,
        expected_version: await version(),
        display_name: "Napraforgó család",
        parents: [
          { id: second, expected_version: 2, display_name: "Napraforgó Dénes", account_id: null },
        ],
      });
      assert.equal(unlinked.state, "success");
      assert.equal(await count(db, "parents", `id = '${second}' and account_id is null`), 1);
    });

    it("manages school years and groups for super admins only, with unique names, dates and versions (BR30.9)", async () => {
      const year = await structure(SUPER_ADMIN, "school_year", {
        name: "2027/2028",
        starts_on: "2027-09-01",
        ends_on: "2028-06-30",
      });
      assert.deepEqual([year.state, year.version], ["success", 1]);
      for (const account of [ADMIN_G1, TEACHER_G1, PARENT_F1, OUTSIDER]) {
        assert.equal(
          (
            await structure(account, "school_year", {
              name: "Tiltott",
              starts_on: "2027-09-01",
              ends_on: "2028-06-30",
            })
          ).state,
          "denied",
          account,
        );
      }
      const badDates = await structure(SUPER_ADMIN, "school_year", {
        name: "Fordított",
        starts_on: "2028-06-30",
        ends_on: "2027-09-01",
      });
      assert.deepEqual(
        [badDates.state, badDates.field, badDates.reason],
        ["validation", "ends_on", "before_start"],
      );
      const impossible = await structure(SUPER_ADMIN, "school_year", {
        name: "Nincs február 31",
        starts_on: "2027-02-31",
        ends_on: "2027-03-01",
      });
      assert.equal(impossible.field, "starts_on");
      const taken = await structure(SUPER_ADMIN, "school_year", {
        name: "2026/2027",
        starts_on: "2027-09-01",
        ends_on: "2028-06-30",
      });
      assert.deepEqual([taken.field, taken.reason], ["name", "taken"]);
      const group = await structure(SUPER_ADMIN, "group", {
        school_year_id: year.reference,
        name: "Mókus",
      });
      assert.equal(group.state, "success");
      const sameName = await structure(SUPER_ADMIN, "group", {
        school_year_id: year.reference,
        name: "mókus",
      });
      assert.deepEqual([sameName.field, sameName.reason], ["name", "taken"]);
      const renamed = await structure(SUPER_ADMIN, "group", {
        id: group.reference,
        expected_version: 1,
        name: "Mókus 2",
      });
      assert.deepEqual([renamed.state, renamed.version], ["success", 2]);
      const stale = await structure(SUPER_ADMIN, "group", {
        id: group.reference,
        expected_version: 1,
        name: "Elavult",
      });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const moved = await structure(SUPER_ADMIN, "group", {
        id: group.reference,
        expected_version: 2,
        school_year_id: YEAR_1,
        name: "Mókus 2",
      });
      assert.deepEqual([moved.field, moved.reason], ["school_year_id", "locked"]);
      const foreignYear = await structure(SUPER_ADMIN, "group", {
        school_year_id: uuid(5999),
        name: "Árva",
      });
      assert.deepEqual([foreignYear.field, foreignYear.reason], ["school_year_id", "not_found"]);
      assert.equal(
        (await structure(OTHER_ADMIN, "group", { school_year_id: year.reference, name: "Idegen" }))
          .reason,
        "not_found",
      );
    });

    it("archives and restores a child, a group and a school year with the rules of BR30.7", async () => {
      // A child: an admin who reaches its family, not another group's admin; stale and repeated archive refused.
      assert.equal((await archive(ADMIN_G2, "child", CHILD_F1, 1)).state, "denied");
      const stale = await archive(ADMIN_G1, "child", CHILD_F1, 9);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const archived = await archive(ADMIN_G1, "child", CHILD_F1, 1);
      assert.deepEqual([archived.state, archived.version], ["success", 2]);
      assert.equal(
        (await archive(ADMIN_G1, "child", CHILD_F1, 2)).code,
        "VERSION_CONFLICT",
        "already archived",
      );
      assert.equal((await restore(ADMIN_G1, "child", CHILD_F1, 2)).state, "success");
      const active = await restore(ADMIN_G1, "child", CHILD_F1, 3);
      assert.deepEqual([active.state, active.code], ["conflict", "RESTORE_CONFLICT"]);
      // A child of an archived family cannot be restored on its own.
      await archive(SUPER_ADMIN, "child", CHILD_F1, 3);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      assert.equal((await restore(SUPER_ADMIN, "child", CHILD_F1, 4)).code, "RESTORE_CONFLICT");
      // Groups and school years are for super admins; a year closes only when all its groups are archived.
      assert.equal((await archive(ADMIN_G1, "group", GROUP_1, 1)).state, "denied");
      const yearBlocked = await archive(SUPER_ADMIN, "school_year", YEAR_1, 1);
      assert.deepEqual(
        [yearBlocked.state, yearBlocked.code],
        ["conflict", "SCHOOL_YEAR_HAS_ACTIVE_GROUPS"],
      );
      assert.equal((await archive(SUPER_ADMIN, "group", GROUP_1, 1)).state, "success");
      assert.equal((await archive(SUPER_ADMIN, "group", GROUP_2, 1)).state, "success");
      assert.equal((await archive(SUPER_ADMIN, "school_year", YEAR_1, 1)).state, "success");
      assert.equal(
        (await restore(SUPER_ADMIN, "group", GROUP_1, 2)).code,
        "RESTORE_CONFLICT",
        "its school year is archived",
      );
      assert.equal((await restore(SUPER_ADMIN, "school_year", YEAR_1, 2)).state, "success");
      assert.equal((await restore(SUPER_ADMIN, "group", GROUP_1, 2)).state, "success");
      assert.equal((await archive(SUPER_ADMIN, "family", FAMILY_1, 1)).code, "request_invalid");
    });

    it("reads the reminder setting for admins and saves it for super admins with the stored codes (BR30.10)", async () => {
      const get = (account: string) => callFunction(db, schema, account, "settings_get()");
      const first = await get(SUPER_ADMIN);
      assert.deepEqual(
        [first.state, first.enabled, first.recipient_scope, first.version],
        ["success", true, "duty", 1],
      );
      assert.equal((await get(ADMIN_G1)).state, "success", "a group admin reads");
      for (const account of [PARENT_F1, TEACHER_G1, OUTSIDER, DEACTIVATED]) {
        assert.equal((await get(account)).state, "denied", account);
      }
      const saveSettings = (account: string, version: number, enabled: boolean, scope: string) =>
        callFunction(db, schema, account, "settings_save($1, $2, $3, $4)", [
          nextKey("set"),
          version,
          enabled,
          scope,
        ]);
      assert.equal(
        (await saveSettings(ADMIN_G1, 1, false, "group")).state,
        "denied",
        "only super admins save",
      );
      const stale = await saveSettings(SUPER_ADMIN, 7, false, "bogus");
      assert.deepEqual(
        [stale.state, stale.code],
        ["invalidated", "SETTINGS_STALE"],
        "the version is checked first",
      );
      const invalid = await saveSettings(SUPER_ADMIN, 1, false, "everyone");
      assert.deepEqual([invalid.state, invalid.code], ["conflict", "SETTINGS_RECIPIENT_INVALID"]);
      const saved = await saveSettings(SUPER_ADMIN, 1, false, "group");
      assert.deepEqual([saved.state, saved.version], ["success", 2]);
      const after = await get(ADMIN_G2);
      assert.deepEqual([after.enabled, after.recipient_scope, after.version], [false, "group", 2]);
      assert.equal(
        await count(db, "audit_events"),
        0,
        "settings and directory edits are not audited",
      );
    });

    it("returns the stored result for a repeated key, refuses a reused key with other content and does not store refusals (U1 BR3.6)", async () => {
      const key = nextKey("repeat");
      const first = await save(SUPER_ADMIN, newFamily, key);
      const again = await save(SUPER_ADMIN, newFamily, key);
      assert.deepEqual(
        [again.state, again.reference, again.code],
        ["success", first.reference, "replayed"],
      );
      assert.equal(
        await count(db, "families", "display_name = 'Új család'"),
        1,
        "nothing more was created",
      );
      const reused = await save(SUPER_ADMIN, { ...newFamily, display_name: "Más" }, key);
      assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);
      // A refused request is not stored: the same key works once the request is corrected.
      const refusedKey = nextKey("refused");
      const refused = await save(SUPER_ADMIN, { ...newFamily, display_name: "" }, refusedKey);
      assert.equal(refused.state, "validation");
      const retry = await save(SUPER_ADMIN, { ...newFamily, display_name: "Javított" }, refusedKey);
      assert.equal(retry.state, "success");
      const badKey = await save(SUPER_ADMIN, newFamily, "");
      assert.deepEqual([badKey.state, badKey.code], ["validation", "idempotency_key_invalid"]);
    });

    it("is not callable by anon or the service role, and not for a signed-out session", async () => {
      for (const role of ["anon", "service_role"] as const) {
        const failure = await failureOf(() =>
          asActor(db, schema, { role }, () => db.query("select directory_save('k', '{}'::jsonb)")),
        );
        assert.equal(failure?.code, "42501", role);
      }
      const signedOut = await save("bbbbbbbb-0000-4000-8000-000000000017", newFamily);
      assert.deepEqual([signedOut.state, signedOut.code], ["denied", "session_inactive"]);
      const noToken = await failureOf(() =>
        asActor(db, schema, authenticated(SUPER_ADMIN, null), async () => {
          const result = await db.query("select directory_save('k', '{}'::jsonb) as result");
          assert.equal(result.rows[0].result.code, "session_inactive");
        }),
      );
      assert.equal(noToken, undefined);
    });
  });
}
