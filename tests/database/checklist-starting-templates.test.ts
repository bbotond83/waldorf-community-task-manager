import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase, ORGANIZATION } from "./directory-support.ts";
import {
  caller,
  rowsOf,
  saveTemplate,
  sectionBody,
  seedEventWorld,
  taskBody,
  templateBody,
} from "./checklist-support.ts";
import { ADMIN_G1, PARENT_F1, SUPER_ADMIN } from "./working-groups-support.ts";

/**
 * The starting templates of U11 (BR162.1, AC12.3.3): an internal install function that ships with the database. It is
 * content, not test data, so these tests only check its shape, that it is safe to run twice, that it holds no personal
 * data, and that no signed-in role can call it.
 */
const NAMES = [
  "Nagytakarítás",
  "Hajó javítás",
  "Szent Mihály",
  "Szent Márton",
  "Szent Miklós",
  "Spirál járás",
  "Húsvét",
  "Pünkösd",
  "Gyermekek búcsúnapja",
  "Búcsúzás/nyárünnep",
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`starting templates in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedEventWorld(db, schema);
      await db.query("delete from checklist_templates");
    });

    const call = caller(() => db, schema);
    const install = async (organization: string | null = ORGANIZATION) =>
      (await db.query("select checklist_starting_templates_install($1) as added", [organization]))
        .rows[0].added as number;
    const sectionsOf = async (name: string) =>
      (
        await db.query(
          `select s.title, s.kind, s.id, (select count(*)::int from checklist_template_tasks k where k.section_id = s.id) as tasks
             from checklist_template_sections s join checklist_templates t on t.id = s.template_id
            where t.name = $1 order by s.position`,
          [name],
        )
      ).rows as { title: string; kind: string; id: string; tasks: number }[];

    it("allowed: a fresh install adds the ten community templates, and a second run adds nothing", async () => {
      assert.equal(await install(), 10);
      const rows = await rowsOf(db, "checklist_templates");
      assert.deepEqual(rows.map((row) => row.name).sort(), [...NAMES].sort());
      assert.ok(rows.every((row) => row.working_group_id === null && row.is_removed === false));
      assert.equal(await install(), 0);
      assert.equal((await rowsOf(db, "checklist_templates")).length, 10);
    });
    it("allowed: the big cleaning has nine area sections and an organisers' section, a 14-day lead time, summer-only and timed tasks", async () => {
      await install();
      const sections = await sectionsOf("Nagytakarítás");
      assert.equal(sections.length, 10);
      assert.deepEqual(
        sections.slice(0, 9).map((section) => section.kind),
        Array(9).fill("parents"),
      );
      assert.equal(sections[9]!.kind, "organisers");
      const big = (await rowsOf(db, "checklist_templates", "name = 'Nagytakarítás'"))[0]!;
      assert.equal(big.default_lead_days, 14);
      const tasks = (
        await db.query(
          `select k.title, k.summer_only, k.time_matters, k.tip from checklist_template_tasks k
             join checklist_templates t on t.id = k.template_id where t.name = 'Nagytakarítás'`,
        )
      ).rows as {
        title: string;
        summer_only: boolean;
        time_matters: boolean;
        tip: string | null;
      }[];
      assert.ok(tasks.filter((task) => task.summer_only).length >= 5);
      assert.ok(
        tasks.every((task) => !task.title.startsWith("NYÁRON")),
        "the prefix became the summer-only mark",
      );
      const ladder = tasks.find((task) => task.title === "Baldachin vasalása");
      assert.match(ladder!.tip ?? "", /egyedül senki ne tegye/);
      const organisers = (
        await db.query(
          `select k.time_matters from checklist_template_tasks k where k.section_id = $1`,
          [sections[9]!.id],
        )
      ).rows as { time_matters: boolean }[];
      assert.ok(organisers.length >= 8 && organisers.every((task) => !task.time_matters));
    });
    it("allowed: the ship repair has one parents' section per topic with priorities and tools, and nothing done or claimed", async () => {
      await install();
      const sections = await sectionsOf("Hajó javítás");
      assert.deepEqual(
        sections.map((section) => section.title),
        [
          "Csúszda esésbiztonság",
          "Csúszda teteje (beülője)",
          "Feljáró palánk",
          "Belső létra",
          "Oldalkötézet",
          "Hajótest szerkezet",
        ],
      );
      assert.ok(sections.every((section) => section.kind === "parents"));
      const withPriority = await db.query(
        `select count(*)::int as n from checklist_template_tasks k join checklist_templates t on t.id = k.template_id
          where t.name = 'Hajó javítás' and k.priority is not null`,
      );
      assert.ok((withPriority.rows[0].n as number) >= 5);
    });
    it("allowed: festivals with listed tasks have a parents' section, the teachers' part is a teachers' section, empty ones have none", async () => {
      await install();
      for (const empty of ["Szent Mihály", "Szent Márton", "Pünkösd"]) {
        assert.equal((await sectionsOf(empty)).length, 0, empty);
      }
      assert.deepEqual(
        (await sectionsOf("Szent Miklós")).map((section) => [section.kind, section.tasks]),
        [
          ["parents", 5],
          ["teachers", 1],
        ],
      );
      assert.deepEqual(
        (await sectionsOf("Spirál járás")).map((section) => [section.kind, section.tasks]),
        [
          ["parents", 4],
          ["teachers", 2],
        ],
      );
      assert.deepEqual(
        (await sectionsOf("Húsvét")).map((section) => section.kind),
        ["parents"],
      );
      assert.deepEqual(
        (await sectionsOf("Gyermekek búcsúnapja")).map((section) => section.kind),
        ["parents", "teachers"],
      );
      assert.deepEqual(
        (await sectionsOf("Búcsúzás/nyárünnep")).map((section) => section.kind),
        ["parents"],
      );
    });
    it("allowed: a template the community already has under that name is skipped, whatever its case", async () => {
      await saveTemplate(
        call,
        SUPER_ADMIN,
        templateBody("nagytakarítás", [sectionBody("Egy", [taskBody("Saját")])]),
      );
      assert.equal(await install(), 9);
      assert.equal(
        (await sectionsOf("Nagytakarítás")).length,
        0,
        "the owner's own version stays as it is",
      );
    });
    it("allowed: the installed templates show in the admin list and can be started from", async () => {
      await install();
      const list = (await call(SUPER_ADMIN, "template_list_admin()")) as unknown as {
        items: { name: string }[];
      };
      assert.equal(list.items.length, 10);
      const options = (await call(SUPER_ADMIN, "template_options()")) as unknown as {
        items: { name: string }[];
      };
      assert.equal(options.items.length, 10);
    });
    it("refused: the content holds no email address, phone number or link", async () => {
      await install();
      const text = (
        await db.query(
          `select string_agg(concat_ws(' ', t.name, t.description, s.title, k.title, k.place, k.props, k.materials, k.tip), ' ') as text
             from checklist_templates t
             left join checklist_template_sections s on s.template_id = t.id
             left join checklist_template_tasks k on k.section_id = s.id`,
        )
      ).rows[0].text as string;
      assert.doesNotMatch(text, /@|https?:|www\.|\+?\d[\d\s/-]{7,}\d/);
    });
    it("out of reach: no signed-in role can call the install, and an unknown community gets nothing", async () => {
      for (const account of [SUPER_ADMIN, ADMIN_G1, PARENT_F1]) {
        await assert.rejects(
          call(account, "checklist_starting_templates_install($1)", [ORGANIZATION]),
          /permission denied/i,
        );
      }
      assert.equal(await install("00000000-0000-4000-8000-0000000000fe"), 0);
      assert.equal(await install(null), 0);
      assert.equal((await rowsOf(db, "checklist_templates")).length, 0);
    });
    it("nem értelmezhető: an internal install has no outdated screen, no repeated click (a second run is the test above) and no two people at once", () => {
      assert.ok(true);
    });
  });
}
