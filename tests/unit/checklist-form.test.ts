import { describe, expect, it } from "vitest";
import { conflict, denied, success, validation } from "../../src/application/index.ts";
import {
  isChecklistId,
  isChecklistKey,
  readSectionFields,
  readTaskFields,
  readTemplatePayload,
  uuidField,
  versionField,
} from "../../app/_checklists/checklist-form.ts";
import { mapChecklistResult } from "../../app/_checklists/checklist-result.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("the checklist form readers", () => {
  it("accepts only identifiers, keys and versions of the right shape", () => {
    expect(isChecklistId(ID)).toBe(true);
    expect(isChecklistId("nem-azonosito")).toBe(false);
    expect(isChecklistId(undefined)).toBe(false);
    expect(isChecklistKey("checklist-claim:abcdef12")).toBe(true);
    expect(isChecklistKey("x")).toBe(false);
    expect(uuidField(form({ taskId: ID }), "taskId")).toBe(ID);
    expect(uuidField(form({ taskId: "x" }), "taskId")).toBeUndefined();
    expect(versionField(form({ expectedVersion: "3" }))).toBe(3);
    expect(versionField(form({ expectedVersion: "0" }))).toBeUndefined();
    expect(versionField(form({ expectedVersion: "1.5" }))).toBeUndefined();
    expect(versionField(form({}), "checklistVersion")).toBeUndefined();
  });

  it("reads a new task in the database's words, clearing the empty optional fields", () => {
    const read = readTaskFields(
      form({
        sectionId: ID,
        title: " Székek ",
        helpersNeeded: "2",
        summerOnly: "on",
        priority: "3",
      }),
    );
    expect(read).toEqual({
      ok: true,
      task: {
        section_id: ID,
        title: "Székek",
        place: null,
        props: null,
        materials: null,
        tip: null,
        priority: 3,
        deadline: null,
        helpers_needed: 2,
        summer_only: true,
        time_matters: false,
      },
    });
  });

  it("reads a changed task with its id and version, and refuses a half-changed or malformed one", () => {
    const changed = readTaskFields(
      form({
        sectionId: ID,
        taskId: OTHER,
        expectedVersion: "4",
        title: "Seprés",
        deadline: "2031-05-01",
      }),
    );
    expect(changed).toMatchObject({
      ok: true,
      task: { id: OTHER, expected_version: 4, deadline: "2031-05-01", helpers_needed: 1 },
    });
    expect(readTaskFields(form({ sectionId: ID, taskId: OTHER, title: "x" }))).toEqual({
      ok: false,
    });
    expect(readTaskFields(form({ title: "x" }))).toEqual({ ok: false });
    expect(readTaskFields(form({ sectionId: ID, priority: "9" }))).toEqual({ ok: false });
    expect(readTaskFields(form({ sectionId: ID, helpersNeeded: "1.5" }))).toEqual({ ok: false });
    expect(readTaskFields(form({ sectionId: ID, deadline: "holnap" }))).toEqual({ ok: false });
  });

  it("reads a section, defaults its kind to parents and refuses an unknown kind or a half-changed section", () => {
    expect(readSectionFields(form({ title: "Kert" }))).toEqual({
      ok: true,
      section: { title: "Kert", kind: "parents" },
    });
    expect(
      readSectionFields(
        form({ title: "Kert", kind: "teachers", sectionId: ID, expectedVersion: "2" }),
      ),
    ).toEqual({
      ok: true,
      section: { id: ID, expected_version: 2, title: "Kert", kind: "teachers" },
    });
    expect(readSectionFields(form({ title: "Kert", kind: "mindenki" }))).toEqual({ ok: false });
    expect(readSectionFields(form({ title: "Kert", sectionId: ID }))).toEqual({ ok: false });
  });

  it("reads a whole template: trimmed text, cleared empty fields, the group only on a new one", () => {
    const template = JSON.stringify({
      name: " Kerti nap ",
      description: "",
      defaultLeadDays: "10",
      sections: [
        {
          title: "Kert",
          kind: "parents",
          tasks: [
            { title: " Ásás ", place: "Kert", priority: "2", helpersNeeded: "3", summerOnly: true },
            { title: "Vetés", priority: "" },
          ],
        },
      ],
    });
    const created = readTemplatePayload(form({ template }), OTHER);
    expect(created).toMatchObject({
      ok: true,
      template: {
        working_group_id: OTHER,
        name: "Kerti nap",
        description: null,
        default_lead_days: 10,
      },
    });
    const sections = (
      created as unknown as { template: { sections: { tasks: Record<string, unknown>[] }[] } }
    ).template.sections;
    expect(sections[0]!.tasks[0]).toMatchObject({
      title: "Ásás",
      place: "Kert",
      priority: 2,
      helpers_needed: 3,
      summer_only: true,
    });
    expect(sections[0]!.tasks[1]).toMatchObject({ priority: null, helpers_needed: 1 });
    const changed = readTemplatePayload(
      form({ template, templateId: ID, expectedVersion: "5" }),
      OTHER,
    );
    expect(changed).toMatchObject({ ok: true, template: { id: ID, expected_version: 5 } });
    expect((changed as { template: Record<string, unknown> }).template).not.toHaveProperty(
      "working_group_id",
    );
    expect(
      (
        readTemplatePayload(
          form({ template: JSON.stringify({ name: "A", sections: [] }) }),
          undefined,
        ) as {
          template: Record<string, unknown>;
        }
      ).template,
    ).not.toHaveProperty("working_group_id");
  });

  it("refuses a template document that is not readable", () => {
    expect(readTemplatePayload(form({ template: "{nem json" }), undefined)).toEqual({ ok: false });
    expect(readTemplatePayload(form({ template: "[]" }), undefined)).toEqual({ ok: false });
    expect(readTemplatePayload(form({ template: '{"name":"A"}' }), undefined)).toEqual({
      ok: false,
    });
    expect(
      readTemplatePayload(form({ template: '{"sections":[{"title":"A"}]}' }), undefined),
    ).toEqual({ ok: false });
    expect(
      readTemplatePayload(form({ template: '{"sections":[]}', templateId: ID }), undefined),
    ).toEqual({ ok: false });
  });
});

describe("the words of a checklist answer", () => {
  it("turns each answer into the sentence a form shows", () => {
    expect(mapChecklistResult(success({ id: ID }), "Kész.")).toMatchObject({
      state: "success",
      message: "Kész.",
    });
    expect(mapChecklistResult(denied(), "x")).toMatchObject({ state: "denied" });
    expect(mapChecklistResult(conflict("TASK_TAKEN"), "x")).toEqual({
      state: "conflict",
      message: "Közben betelt ez a feladat, nincs több szabad hely.",
      code: "TASK_TAKEN",
    });
    expect(mapChecklistResult(validation({ title: "VAL-REQUIRED" }), "x").message).toBe(
      "A cím megadása kötelező, és legfeljebb 200 karakter lehet.",
    );
    expect(mapChecklistResult(validation({ order: "sections_differ" }), "x").message).toBe(
      "A rendezett lista nem egyezik a mostanival, töltsd újra.",
    );
    expect(mapChecklistResult({ state: "invalidated" } as never, "x")).toMatchObject({
      state: "invalidated",
    });
    expect(
      mapChecklistResult({ state: "dependency-failure-retryable", retry: {} } as never, "x"),
    ).toMatchObject({ state: "retryable" });
    expect(
      mapChecklistResult({ state: "dependency-failure-terminal" } as never, "x"),
    ).toMatchObject({ state: "terminal" });
  });
});
