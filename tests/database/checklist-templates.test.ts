import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  OTHER_ADMIN,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  auditRows,
  caller,
  nextKey,
  newTemplate,
  rowsOf,
  saveTemplate,
  sectionBody,
  seedEventWorld,
  setRemoved,
  taskBody,
  templateBody,
} from "./checklist-support.ts";
import { openDatabase } from "./stack-support.ts";
import { ADMIN_G1, ADMIN_G2, GROUP_1, PARENT_F1, SUPER_ADMIN } from "./working-groups-support.ts";

/**
 * The template rules of U11 (W1 to W3; BR160.1 to BR161.2, BR163.3) on the fixed list: allowed, refused, out of
 * reach, outdated screen, repeated click and two people at once. The reads have no outdated screen and no repeated
 * click; the cells that do not apply say so.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist templates in ${schema}`, () => {
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
    beforeEach(async () => {
      await seedEventWorld(db, schema);
      await db.query("delete from checklist_templates");
    });

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const outcome = (result: { state: string; code: string | null }) => [result.state, result.code];
    const simple = (name: string) =>
      templateBody(name, [sectionBody("Szülők", [taskBody("Egy feladat")])]);
    const groupTemplate = (name: string) => ({ ...simple(name), working_group_id: GROUP_1 });

    describe("W1 template_save", () => {
      it("allowed: a super admin saves a community template and reads it back in order, with the teachers' task fixed", async () => {
        const saved = await saveTemplate(
          call,
          SUPER_ADMIN,
          templateBody(
            "Nagytakarítás próba",
            [
              sectionBody("Előtér", [
                taskBody("Ablak", {
                  priority: 2,
                  helpers_needed: 3,
                  time_matters: true,
                  summer_only: true,
                  tip: "Létra",
                }),
                taskBody("Padló"),
              ]),
              sectionBody(
                "Óvónők",
                [taskBody("Dal", { helpers_needed: 4, time_matters: true })],
                "teachers",
              ),
            ],
            { description: "Leírás", default_lead_days: 14 },
          ),
        );
        assert.deepEqual([saved.state, saved.version], ["success", 1]);
        const read = (await call(SUPER_ADMIN, "template_get($1)", [
          saved.reference,
        ])) as unknown as {
          item: {
            name: string;
            default_lead_days: number;
            sections: { title: string; kind: string; tasks: Record<string, unknown>[] }[];
          };
        };
        assert.equal(read.item.default_lead_days, 14);
        assert.deepEqual(
          read.item.sections.map((section) => [section.title, section.kind, section.tasks.length]),
          [
            ["Előtér", "parents", 2],
            ["Óvónők", "teachers", 1],
          ],
        );
        assert.deepEqual(
          [read.item.sections[0]!.tasks[0]!.title, read.item.sections[0]!.tasks[0]!.helpers_needed],
          ["Ablak", 3],
        );
        const teachers = read.item.sections[1]!.tasks[0]!;
        assert.deepEqual([teachers.helpers_needed, teachers.time_matters], [1, false]);
      });
      it("allowed: a coordinator saves their own group's template, and an edit replaces sections and tasks in one go", async () => {
        const saved = await saveTemplate(call, ADMIN_G1, groupTemplate("Csoport lista"));
        assert.equal(saved.state, "success");
        const edited = await saveTemplate(call, ADMIN_G1, {
          ...templateBody("Csoport lista 2", [
            sectionBody("Új szakasz", [taskBody("Első"), taskBody("Második")]),
          ]),
          id: saved.reference,
          expected_version: 1,
          working_group_id: GROUP_1,
        });
        assert.deepEqual([edited.state, edited.version], ["success", 2]);
        assert.equal(
          (await rowsOf(db, "checklist_template_sections", "template_id = $1", [saved.reference]))
            .length,
          1,
        );
        assert.equal(
          (await rowsOf(db, "checklist_template_tasks", "template_id = $1", [saved.reference]))
            .length,
          2,
        );
      });
      it("allowed: a template may have no sections, and a removed template may still be edited", async () => {
        const saved = await saveTemplate(call, SUPER_ADMIN, templateBody("Üres", []));
        assert.equal(saved.state, "success");
        const removed = await setRemoved(call, SUPER_ADMIN, saved.reference!, true, 1);
        assert.equal(removed.state, "success");
        const edited = await saveTemplate(call, SUPER_ADMIN, {
          ...simple("Üres javítva"),
          id: saved.reference,
          expected_version: removed.version,
        });
        assert.equal(edited.state, "success");
        assert.equal(
          (await rowsOf(db, "checklist_templates", "id = $1", [saved.reference]))[0]!.is_removed,
          true,
          "editing does not restore it",
        );
      });
      it("refused: a parent, a teacher and a coordinator creating a community template are denied; nothing is written", async () => {
        for (const account of [PARENT_F1, TEACHER_G1]) {
          assert.deepEqual(outcome(await saveTemplate(call, account, simple("Nem lehet"))), [
            "denied",
            "authorization_denied",
          ]);
        }
        assert.deepEqual(outcome(await saveTemplate(call, ADMIN_G1, simple("Közösségi"))), [
          "denied",
          "authorization_denied",
        ]);
        assert.equal((await rowsOf(db, "checklist_templates")).length, 0);
      });
      it("refused: the fields are checked, and a name used by the same owner (any case) is taken, a removed one included", async () => {
        const bad = async (body: unknown, field: string) => {
          const result = await saveTemplate(call, SUPER_ADMIN, body);
          assert.deepEqual([result.state, result.field], ["validation", field]);
        };
        await bad({ ...simple("  "), name: "  " }, "name");
        await bad({ ...simple("x"), name: "n".repeat(201) }, "name");
        await bad({ ...simple("x"), default_lead_days: 61 }, "default_lead_days");
        await bad(templateBody("x", [sectionBody("", [taskBody("a")])]), "section_title");
        await bad(templateBody("x", [{ title: "S", kind: "weird", tasks: [] }]), "section_kind");
        await bad(
          templateBody("x", [sectionBody("S", [taskBody("a", { priority: 4 })])]),
          "priority",
        );
        await bad(
          templateBody("x", [sectionBody("S", [taskBody("a", { helpers_needed: 21 })])]),
          "helpers_needed",
        );
        await bad(
          templateBody("x", [sectionBody("S", [taskBody("a", { summer_only: "yes" })])]),
          "summer_only",
        );
        await bad(
          templateBody(
            "x",
            Array.from({ length: 31 }, (_, index) => sectionBody(`S${index}`, [])),
          ),
          "sections",
        );
        await bad(
          templateBody("x", [
            sectionBody(
              "A",
              Array.from({ length: 200 }, (_, index) => taskBody(`t${index}`)),
            ),
            sectionBody(
              "B",
              Array.from({ length: 101 }, (_, index) => taskBody(`u${index}`)),
            ),
          ]),
          "tasks",
        );
        assert.equal(
          (await rowsOf(db, "checklist_templates")).length,
          0,
          "nothing is half written",
        );
        const first = await saveTemplate(call, SUPER_ADMIN, simple("Egyedi név"));
        const clash = await saveTemplate(call, SUPER_ADMIN, simple("  egyedi NÉV "));
        assert.deepEqual(
          [clash.state, clash.field, clash.reason],
          ["validation", "name", "name_taken"],
        );
        await setRemoved(call, SUPER_ADMIN, first.reference!, true, 1);
        assert.equal(
          (await saveTemplate(call, SUPER_ADMIN, simple("Egyedi név"))).reason,
          "name_taken",
        );
        const group = await saveTemplate(call, SUPER_ADMIN, groupTemplate("Egyedi név"));
        assert.equal(group.state, "success", "the same name under another owner is fine");
      });
      it("out of reach: another group's coordinator and another community's admin cannot edit it; a made-up id is denied the same way", async () => {
        const mine = await saveTemplate(call, ADMIN_G1, groupTemplate("Az enyém"));
        const edit = (account: string, id: string) =>
          saveTemplate(call, account, {
            ...simple("Csere"),
            id,
            expected_version: 1,
            working_group_id: GROUP_1,
          });
        assert.deepEqual(outcome(await edit(ADMIN_G2, mine.reference!)), [
          "denied",
          "authorization_denied",
        ]);
        // Another community's admin is told the template does not exist, exactly as for a made-up id.
        assert.deepEqual(outcome(await edit(OTHER_ADMIN, mine.reference!)), [
          "validation",
          "field_invalid",
        ]);
        assert.deepEqual(outcome(await edit(ADMIN_G2, "00000000-0000-4000-8000-0000000000ff")), [
          "denied",
          "authorization_denied",
        ]);
        const other = await saveTemplate(call, ADMIN_G2, {
          ...simple("Másik"),
          working_group_id: GROUP_1,
        });
        assert.deepEqual(outcome(other), ["denied", "authorization_denied"]);
      });
      it("outdated screen: an old version is refused and nothing is overwritten", async () => {
        const saved = await saveTemplate(call, SUPER_ADMIN, simple("Régi"));
        await saveTemplate(call, SUPER_ADMIN, {
          ...simple("Új"),
          id: saved.reference,
          expected_version: 1,
        });
        const stale = await saveTemplate(call, SUPER_ADMIN, {
          ...simple("Vesztes"),
          id: saved.reference,
          expected_version: 1,
        });
        assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
        assert.equal(
          (await rowsOf(db, "checklist_templates", "id = $1", [saved.reference]))[0]!.name,
          "Új",
        );
      });
      it("repeated click: the same key returns the stored result once; the same key with other content is a conflict", async () => {
        const key = nextKey("same");
        const first = await saveTemplate(call, SUPER_ADMIN, simple("Egyszer"), key);
        const again = await saveTemplate(call, SUPER_ADMIN, simple("Egyszer"), key);
        assert.deepEqual(
          [again.state, again.reference, again.code],
          ["success", first.reference, "replayed"],
        );
        assert.equal((await rowsOf(db, "checklist_templates")).length, 1);
        assert.deepEqual(outcome(await saveTemplate(call, SUPER_ADMIN, simple("Másképp"), key)), [
          "conflict",
          "idempotency_key_reused",
        ]);
      });
      it("two people at once: two saves of one name leave one template, and two edits at one version leave one winner", async () => {
        const answers = await Promise.all([
          saveTemplate(call, SUPER_ADMIN, simple("Versengő")),
          saveTemplate(callSecond, SUPER_ADMIN, simple("Versengő")),
        ]);
        assert.deepEqual(answers.map((answer) => answer.state).sort(), ["success", "validation"]);
        assert.equal((await rowsOf(db, "checklist_templates")).length, 1);
        const id = (await rowsOf(db, "checklist_templates"))[0]!.id as string;
        const edits = await Promise.all([
          saveTemplate(call, SUPER_ADMIN, { ...simple("Első"), id, expected_version: 1 }),
          saveTemplate(callSecond, SUPER_ADMIN, { ...simple("Második"), id, expected_version: 1 }),
        ]);
        assert.deepEqual(edits.map((edit) => edit.state).sort(), ["conflict", "success"]);
      });
    });

    describe("W2 template_set_removed", () => {
      it("allowed: removing hides it and keeps it, restoring brings it back, each audited once without a name", async () => {
        const id = await newTemplate(call, ADMIN_G1, groupTemplate("Elrejtendő"));
        const removed = await setRemoved(call, ADMIN_G1, id, true, 1);
        assert.deepEqual([removed.state, removed.version], ["success", 2]);
        const row = (await rowsOf(db, "checklist_templates", "id = $1", [id]))[0]!;
        assert.equal(row.is_removed, true);
        assert.notEqual(row.removed_at, null);
        const restored = await setRemoved(call, ADMIN_G1, id, false, 2);
        assert.deepEqual([restored.state, restored.version], ["success", 3]);
        assert.equal(
          (await rowsOf(db, "checklist_templates", "id = $1", [id]))[0]!.removed_at,
          null,
        );
        const removedAudit = await auditRows(db, "checklist.template_removed");
        const restoredAudit = await auditRows(db, "checklist.template_restored");
        assert.equal(removedAudit.length, 1);
        assert.equal(restoredAudit.length, 1);
        assert.equal(removedAudit[0]!.details, null, "no name or text in the entry");
        assert.equal(removedAudit[0]!.group_id, GROUP_1);
      });
      it("refused and out of reach: a parent and another group's coordinator are denied; nothing changes", async () => {
        const id = await newTemplate(call, ADMIN_G1, groupTemplate("Védett"));
        for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G2]) {
          assert.deepEqual(outcome(await setRemoved(call, account, id, true, 1)), [
            "denied",
            "authorization_denied",
          ]);
        }
        assert.deepEqual(outcome(await setRemoved(call, OTHER_ADMIN, id, true, 1)), [
          "validation",
          "field_invalid",
        ]);
        const community = await newTemplate(call, SUPER_ADMIN, simple("Közösségi"));
        assert.deepEqual(outcome(await setRemoved(call, ADMIN_G1, community, true, 1)), [
          "denied",
          "authorization_denied",
        ]);
        assert.equal((await rowsOf(db, "checklist_templates", "is_removed")).length, 0);
        assert.equal((await auditRows(db, "checklist.template_removed")).length, 0);
      });
      it("outdated screen and repeated click: an old version conflicts; the same key replays; removing twice adds nothing", async () => {
        const id = await newTemplate(call, SUPER_ADMIN, simple("Kétszer"));
        assert.deepEqual(outcome(await setRemoved(call, SUPER_ADMIN, id, true, 9)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        const key = nextKey("once");
        const first = await setRemoved(call, SUPER_ADMIN, id, true, 1, key);
        const replay = await setRemoved(call, SUPER_ADMIN, id, true, 1, key);
        assert.equal(replay.code, "replayed");
        assert.equal(replay.reference, first.reference);
        const twice = await setRemoved(call, SUPER_ADMIN, id, true, 2);
        assert.equal(twice.state, "success");
        assert.equal(twice.version, 2, "already removed: no change, no new version");
        assert.equal((await auditRows(db, "checklist.template_removed")).length, 1);
      });
      it("two people at once: removing and editing at one version leave one winner and a consistent row", async () => {
        const id = await newTemplate(call, SUPER_ADMIN, simple("Verseny"));
        const answers = await Promise.all([
          setRemoved(call, SUPER_ADMIN, id, true, 1),
          saveTemplate(callSecond, SUPER_ADMIN, {
            ...simple("Verseny 2"),
            id,
            expected_version: 1,
          }),
        ]);
        assert.deepEqual(answers.map((answer) => answer.state).sort(), ["conflict", "success"]);
        const row = (await rowsOf(db, "checklist_templates", "id = $1", [id]))[0]!;
        assert.equal(row.version, 2);
        assert.equal(row.is_removed, row.removed_at !== null);
      });
    });

    describe("W3 reads", () => {
      it("allowed: the admin list shows a super admin every template and a coordinator only their group's, removed ones marked", async () => {
        const community = await newTemplate(call, SUPER_ADMIN, simple("Közös"));
        const mine = await newTemplate(call, ADMIN_G1, groupTemplate("Enyém"));
        await setRemoved(call, ADMIN_G1, mine, true, 1);
        const superList = (await call(SUPER_ADMIN, "template_list_admin()")) as unknown as {
          items: { id: string; status: string; task_count: number }[];
        };
        assert.deepEqual(
          superList.items.map((item) => [item.id, item.status]).sort(),
          [
            [community, "active"],
            [mine, "removed"],
          ].sort(),
        );
        const mineList = (await call(ADMIN_G1, "template_list_admin()")) as unknown as {
          items: { id: string }[];
        };
        assert.deepEqual(
          mineList.items.map((item) => item.id),
          [mine],
        );
      });
      it("allowed: template_list (C14) returns one group's rows for its manager; options hide removed templates and other groups'", async () => {
        const mine = await newTemplate(call, ADMIN_G1, groupTemplate("Csoportos"));
        const community = await newTemplate(call, SUPER_ADMIN, simple("Közösségi"));
        const hidden = await newTemplate(call, SUPER_ADMIN, simple("Elrejtett"));
        await setRemoved(call, SUPER_ADMIN, hidden, true, 1);
        const list = (await call(ADMIN_G1, "template_list($1)", [GROUP_1])) as unknown as {
          items: { id: string; title: string; status: string }[];
        };
        assert.deepEqual(
          list.items.map((item) => [item.id, item.title, item.status]),
          [[mine, "Csoportos", "active"]],
        );
        const options = (await call(ADMIN_G1, "template_options($1)", [GROUP_1])) as unknown as {
          items: { id: string }[];
        };
        assert.deepEqual(options.items.map((item) => item.id).sort(), [community, mine].sort());
        const everything = (await call(SUPER_ADMIN, "template_options()")) as unknown as {
          items: { id: string }[];
        };
        assert.deepEqual(everything.items.map((item) => item.id).sort(), [community, mine].sort());
      });
      it("refused and out of reach: a parent, a teacher and a coordinator of another group get the denied refusal, never an empty list", async () => {
        const id = await newTemplate(call, ADMIN_G1, groupTemplate("Zárt"));
        for (const account of [PARENT_F1, TEACHER_G1]) {
          for (const sql of ["template_list_admin()", "template_options()"]) {
            assert.deepEqual(
              outcome(await call(account, sql)),
              ["denied", "authorization_denied"],
              sql,
            );
          }
          assert.deepEqual(outcome(await call(account, "template_list($1)", [GROUP_1])), [
            "denied",
            "authorization_denied",
          ]);
          assert.deepEqual(outcome(await call(account, "template_get($1)", [id])), [
            "denied",
            "authorization_denied",
          ]);
        }
        assert.deepEqual(outcome(await call(ADMIN_G2, "template_list($1)", [GROUP_1])), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(outcome(await call(ADMIN_G2, "template_get($1)", [id])), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(outcome(await call(OTHER_ADMIN, "template_get($1)", [id])), [
          "denied",
          "authorization_denied",
        ]);
        assert.deepEqual(outcome(await call(ADMIN_G2, "template_options($1)", [GROUP_1])), [
          "denied",
          "authorization_denied",
        ]);
      });
      it("nem értelmezhető: a read has no outdated screen, no repeated click and no two people at once", () => {
        assert.ok(true);
      });
    });

    describe("BR163.3 no template command touches an event", () => {
      it("a changed or removed template leaves an event's own checklist alone", async () => {
        const id = await newTemplate(call, SUPER_ADMIN, simple("Másolt"));
        const before = JSON.stringify(await rowsOf(db, "event_checklist_tasks"));
        await saveTemplate(call, SUPER_ADMIN, { ...simple("Átírt"), id, expected_version: 1 });
        await setRemoved(call, SUPER_ADMIN, id, true, 2);
        assert.equal(JSON.stringify(await rowsOf(db, "event_checklist_tasks")), before);
      });
    });
  });
}
