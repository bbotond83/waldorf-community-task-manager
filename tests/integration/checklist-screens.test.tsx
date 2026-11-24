import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  denied,
  success,
  type ChecklistClaimModel,
  type ChecklistModel,
  type ChecklistSectionModel,
  type ChecklistTaskModel,
  type TemplateListModel,
  type TemplateModel,
} from "../../src/application/index.ts";

const EVENT = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const TEMPLATE = "66666666-6666-4666-8666-666666666666";

const world = vi.hoisted(() => ({
  facadeOn: true,
  checklists: {
    checklist: vi.fn(),
    templates: vi.fn(),
    templatesForGroup: vi.fn(),
    template: vi.fn(),
    templateOptions: vi.fn(),
  },
  events: { detail: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../app/_checklists/facade.ts", () => ({
  resolveChecklistFacade: async () => (world.facadeOn ? world.checklists : undefined),
}));
vi.mock("../../app/_events/facade.ts", () => ({
  resolveEventFacade: async () => (world.facadeOn ? world.events : undefined),
}));

import { ChecklistBlock, ChecklistEditorScreen } from "../../app/_checklists/ChecklistScreens.tsx";
import { TemplateEditorForm, TemplateChooser } from "../../app/_checklists/ChecklistForms.tsx";
import {
  TemplateEditorScreen,
  TemplateListScreen,
  templatesPath,
} from "../../app/_checklists/TemplateScreens.tsx";

const actorFor = (area: "szulo" | "teacher" | "admin") =>
  ({ area, basePath: `/${area}/esemenyek`, session: { grants: [] }, scope: {} }) as never;

const claim = (id: string, over: Partial<ChecklistClaimModel> = {}): ChecklistClaimModel => ({
  id,
  version: 1,
  parentDisplayName: "Kovács Anna",
  familyDisplayName: "Kovács család",
  outsideEvent: false,
  isOwn: false,
  canRemove: false,
  ...over,
});

const task = (id: string, over: Partial<ChecklistTaskModel> = {}): ChecklistTaskModel => ({
  id,
  position: 1,
  title: `Feladat ${id}`,
  summerOnly: false,
  helpersNeeded: 2,
  helpersTaken: 0,
  timeMatters: false,
  version: 1,
  claims: [],
  can: { claim: false, markDone: false, undoDone: false },
  ...over,
});

const section = (
  id: string,
  tasks: ChecklistTaskModel[],
  over: Partial<ChecklistSectionModel> = {},
) =>
  ({
    id,
    position: 1,
    title: `Rész ${id}`,
    kind: "parents",
    version: 1,
    tasks,
    ...over,
  }) as ChecklistSectionModel;

const list = (
  sections: ChecklistSectionModel[],
  over: Partial<ChecklistModel> = {},
): ChecklistModel => ({
  eventId: EVENT,
  eventTitle: "Őszi nagytakarítás",
  checklistVersion: 3,
  isEmpty: sections.length === 0,
  isOpen: true,
  isFinished: false,
  isCancelled: false,
  isSummer: false,
  sections,
  caller: { inTeam: false, canManage: false, canClaimTasks: true },
  ...over,
});

const html = async (node: Promise<unknown>) => renderToStaticMarkup((await node) as never);

beforeEach(() => {
  world.facadeOn = true;
  for (const fn of [...Object.values(world.checklists), world.events.detail]) fn.mockReset();
});

describe("the checklist block of the event page", () => {
  it("shows nothing when the list cannot be read, and nothing for a parent when it is empty", async () => {
    world.facadeOn = false;
    expect(await html(ChecklistBlock({ actor: actorFor("szulo"), eventId: EVENT }))).toBe("");
    world.facadeOn = true;
    world.checklists.checklist.mockResolvedValue(denied());
    expect(await html(ChecklistBlock({ actor: actorFor("szulo"), eventId: EVENT }))).toBe("");
    world.checklists.checklist.mockResolvedValue(success(list([])));
    expect(await html(ChecklistBlock({ actor: actorFor("szulo"), eventId: EVENT }))).toBe("");
  });

  it("tells the team an empty list is empty and links the editor; a teacher gets no link", async () => {
    world.checklists.checklist.mockResolvedValue(
      success(list([], { caller: { inTeam: true, canManage: true, canClaimTasks: true } })),
    );
    const team = await html(ChecklistBlock({ actor: actorFor("szulo"), eventId: EVENT }));
    expect(team).toContain("checklist-empty");
    expect(team).toContain(`/szulo/esemenyek/${EVENT}/feladatlista`);
    const teacher = await html(ChecklistBlock({ actor: actorFor("teacher"), eventId: EVENT }));
    expect(teacher).toBe("");
  });

  it("shows the open count, each task's state in words, who took it, and the buttons the database allows", async () => {
    const own = claim("c-own", { isOwn: true, note: "Hozom a kapát" });
    const other = claim("c-other", { canRemove: true });
    const typed = claim("c-typed", {
      typedName: "Nagy Béla",
      parentDisplayName: undefined,
      familyDisplayName: undefined,
    });
    const gone = claim("c-gone", { parentDisplayName: undefined, familyDisplayName: undefined });
    world.checklists.checklist.mockResolvedValue(
      success(
        list(
          [
            section("s1", [
              task("t-free", { can: { claim: true, markDone: false, undoDone: false } }),
              task("t-part", {
                helpersTaken: 1,
                claims: [own, other],
                can: { claim: true, markDone: true, undoDone: false },
              }),
              task("t-full", {
                helpersTaken: 2,
                claims: [typed, gone],
                place: "Kert",
                props: "Kapa",
                tip: "Kesztyűt!",
                deadline: "2031-05-01",
              }),
              task("t-done", {
                helpersTaken: 1,
                done: { at: "2031-05-02T10:00:00Z", byDisplayName: "Tóth Mária", isOwn: false },
                claims: [claim("c-done", { isOwn: true })],
                can: { claim: false, markDone: false, undoDone: true },
              }),
            ]),
            section("s2", [task("t-org")], { kind: "organisers" }),
          ],
          { caller: { inTeam: true, canManage: true, canClaimTasks: true }, allDone: true },
        ),
      ),
    );
    const out = await html(
      ChecklistBlock({ actor: actorFor("szulo"), eventId: EVENT, groupId: GROUP }),
    );
    expect(out).toContain("Még 2 feladatra nincs vállaló");
    expect(out).toContain("0/2 vállalta (2 szabad hely)");
    expect(out).toContain("1/2 vállalta (1 szabad hely)");
    expect(out).toContain("2/2 vállalta (betelt)");
    expect(out).toContain("Kész – Tóth Mária");
    expect(out).toContain("Kovács Anna (Kovács család)");
    expect(out).toContain("<strong> (Te)</strong>");
    expect(out).toContain("Hozom a kapát");
    expect(out).toContain("Nagy Béla");
    expect(out).toContain("korábbi tag");
    expect(out).toContain("Kert • Kapa");
    expect(out).toContain("Kesztyűt!");
    expect(out).toContain("Határidő: 2031. 05. 01.");
    expect(out).toContain("Csak a szervezők látják");
    expect(out).toContain("checklist-claim-t-free");
    expect(out).toContain("checklist-done-t-part");
    expect(out).toContain("checklist-undo-t-done");
    expect(out).toContain("checklist-withdraw-c-own");
    expect(out).toContain("Levétel");
    expect(out).toContain("checklist-all-done");
    expect(out).toContain("checklist-edit-link");
  });

  it("hides the open-tasks callout once the event is finished or cancelled", async () => {
    for (const over of [{ isFinished: true }, { isCancelled: true }]) {
      world.checklists.checklist.mockResolvedValue(
        success(list([section("s1", [task("t")])], over)),
      );
      const out = await html(ChecklistBlock({ actor: actorFor("szulo"), eventId: EVENT }));
      expect(out).not.toContain("checklist-open-callout");
    }
  });
});

describe("the checklist editor", () => {
  const eventDetail = () => success({ event: { id: EVENT, groupId: GROUP } });
  const manager = { caller: { inTeam: true, canManage: true, canClaimTasks: true } };

  it("shows a refused read as its state and a person who may not manage as a refusal", async () => {
    world.events.detail.mockResolvedValue(eventDetail());
    world.checklists.checklist.mockResolvedValue(denied());
    expect(
      await html(ChecklistEditorScreen({ actor: actorFor("szulo"), eventId: EVENT })),
    ).toContain("checklist-editor-denied");
    world.checklists.checklist.mockResolvedValue(success(list([section("s1", [task("t")])])));
    expect(
      await html(ChecklistEditorScreen({ actor: actorFor("szulo"), eventId: EVENT })),
    ).toContain("Ezt a feladatlistát nem kezelheted.");
    world.facadeOn = false;
    expect(
      await html(ChecklistEditorScreen({ actor: actorFor("szulo"), eventId: EVENT })),
    ).toContain("Hiba történt");
  });

  it("offers the template copy on an empty list, with the templates the person may use", async () => {
    world.events.detail.mockResolvedValue(eventDetail());
    world.checklists.checklist.mockResolvedValue(success(list([], manager)));
    world.checklists.templateOptions.mockResolvedValue(
      success({ items: [{ id: TEMPLATE, name: "Kerti nap", hasSummerTasks: false }] }),
    );
    const out = await html(ChecklistEditorScreen({ actor: actorFor("szulo"), eventId: EVENT }));
    expect(out).toContain("checklist-copy-form");
    expect(out).toContain("Kerti nap");
    expect(world.checklists.templateOptions).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      GROUP,
    );
  });

  it("shows sections and tasks with a move button only where a move is possible, and says when the event is closed", async () => {
    world.events.detail.mockResolvedValue(success({ event: { id: EVENT } }));
    world.checklists.checklist.mockResolvedValue(
      success(
        list(
          [
            section("s1", [task("t1", { claims: [claim("c")] }), task("t2")]),
            section("s2", [task("t3")]),
          ],
          { ...manager, isFinished: true },
        ),
      ),
    );
    const out = await html(ChecklistEditorScreen({ actor: actorFor("admin"), eventId: EVENT }));
    expect(out).toContain("checklist-closed");
    expect(out).not.toContain("checklist-copy-form");
    expect(out).toContain("checklist-section-down-s1");
    expect(out).not.toContain("checklist-section-up-s1");
    expect(out).toContain("checklist-section-up-s2");
    expect(out).not.toContain("checklist-section-down-s2");
    expect(out).toContain("checklist-task-down-t1");
    expect(out).not.toContain("checklist-task-up-t1");
    expect(out).toContain("checklist-task-up-t2");
    expect(out).toContain("checklist-task-locked-t1");
    expect(out).toContain("Új feladat ebbe a részbe");
    expect(out).toContain("/admin/esemenyek");
  });
});

const templateList = (over: Partial<TemplateListModel> = {}): TemplateListModel => ({
  items: [
    {
      id: TEMPLATE,
      name: "Kerti nap",
      taskCount: 7,
      status: "active",
      version: 2,
      groupName: "Kert",
      workingGroupId: GROUP,
    },
    { id: "t-old", name: "Régi lista", taskCount: 2, status: "removed", version: 1 },
  ],
  canManageCommunity: true,
  managedGroupIds: [],
  ...over,
});

describe("the template list", () => {
  it("shows every template to an administrator, with edit and delete or restore buttons", async () => {
    world.checklists.templates.mockResolvedValue(success(templateList()));
    const out = await html(TemplateListScreen({ actor: actorFor("admin"), saved: true }));
    expect(out).toContain("template-new-link");
    expect(out).toContain("template-saved");
    expect(out).toContain("template-edit-" + TEMPLATE);
    expect(out).not.toContain("template-edit-t-old");
    expect(out).toContain("template-remove-" + TEMPLATE);
    expect(out).toContain("template-restore-t-old");
    expect(out).toContain("Közösség");
    expect(out).toContain("7 feladat");
  });

  it("shows a read-only list to a person who may not manage, and an empty list as empty", async () => {
    world.checklists.templates.mockResolvedValue(
      success(templateList({ canManageCommunity: false })),
    );
    const readOnly = await html(TemplateListScreen({ actor: actorFor("admin") }));
    expect(readOnly).not.toContain("template-new-link");
    expect(readOnly).not.toContain("template-edit-");
    world.checklists.templates.mockResolvedValue(success(templateList({ items: [] })));
    expect(await html(TemplateListScreen({ actor: actorFor("admin") }))).toContain(
      "template-empty",
    );
  });

  it("shows a working group's own templates, managed by the person who could read them", async () => {
    world.checklists.templatesForGroup.mockResolvedValue(
      success(templateList({ canManageCommunity: false })),
    );
    const out = await html(TemplateListScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(out).toContain("template-new-link");
    expect(out).toContain(`/szulo/munkacsoportok/${GROUP}/sablonok/uj`);
    expect(out).toContain("Kerti nap");
    expect(out).not.toContain("Régi lista");
    expect(out).toContain("Vissza a munkacsoporthoz");
    expect(templatesPath("admin")).toBe("/admin/sablonok");
  });

  it("shows a refused read as its own state, never as an empty list", async () => {
    world.checklists.templates.mockResolvedValue(denied());
    const out = await html(TemplateListScreen({ actor: actorFor("admin") }));
    expect(out).toContain("template-list-denied");
    expect(out).not.toContain("template-empty");
    world.facadeOn = false;
    expect(await html(TemplateListScreen({ actor: actorFor("admin") }))).toContain("Hiba történt");
  });
});

const template = (): TemplateModel => ({
  id: TEMPLATE,
  workingGroupId: GROUP,
  name: "Kerti nap",
  description: "Tavaszi munkák",
  defaultLeadDays: 10,
  isRemoved: false,
  version: 4,
  sections: [
    {
      id: "sec",
      position: 1,
      title: "Kert",
      kind: "parents",
      tasks: [
        {
          id: "k1",
          position: 1,
          title: "Ásás",
          place: "Kert",
          priority: 2,
          summerOnly: true,
          helpersNeeded: 3,
          timeMatters: false,
        },
        {
          id: "k2",
          position: 2,
          title: "Vetés",
          summerOnly: false,
          helpersNeeded: 1,
          timeMatters: true,
        },
      ],
    },
  ],
});

describe("the template editor", () => {
  it("opens an empty editor for a new template and the saved one for an existing template", async () => {
    const fresh = await html(TemplateEditorScreen({ actor: actorFor("admin") }));
    expect(fresh).toContain("Új sablon");
    expect(fresh).toContain("template-editor-form");
    world.checklists.template.mockResolvedValue(success(template()));
    const existing = await html(
      TemplateEditorScreen({ actor: actorFor("szulo"), groupId: GROUP, templateId: TEMPLATE }),
    );
    expect(existing).toContain("Sablon szerkesztése");
    expect(existing).toContain("Kerti nap");
    expect(existing).toContain("Ásás");
    expect(existing).toContain("template-reload-link");
  });

  it("shows a refused read as its state", async () => {
    world.checklists.template.mockResolvedValue(denied());
    expect(
      await html(TemplateEditorScreen({ actor: actorFor("admin"), templateId: TEMPLATE })),
    ).toContain("template-editor-denied");
    world.facadeOn = false;
    expect(
      await html(TemplateEditorScreen({ actor: actorFor("admin"), templateId: TEMPLATE })),
    ).toContain("Hiba történt");
  });
});

describe("the template editor form in the browser", () => {
  const payload = () =>
    JSON.parse((document.querySelector('input[name="template"]') as HTMLInputElement).value);

  it("keeps the whole template in one document that follows every change", () => {
    render(
      <TemplateEditorForm
        area="admin"
        template={template()}
        groupId={GROUP}
        backHref="/admin/sablonok"
      />,
    );
    expect(payload()).toMatchObject({ name: "Kerti nap", defaultLeadDays: "10" });
    fireEvent.change(screen.getByTestId("template-name-input"), { target: { value: "Új név" } });
    fireEvent.change(screen.getByTestId("template-description-input"), {
      target: { value: "Más leírás" },
    });
    fireEvent.change(screen.getByTestId("template-lead-input"), { target: { value: "5" } });
    fireEvent.change(screen.getByTestId("template-section-title-0"), {
      target: { value: "Veteményes" },
    });
    fireEvent.change(screen.getByTestId("template-task-title-0-0"), {
      target: { value: "Gyomlálás" },
    });
    expect(payload()).toMatchObject({
      name: "Új név",
      description: "Más leírás",
      defaultLeadDays: "5",
    });
    expect(payload().sections[0]).toMatchObject({ title: "Veteményes" });
    expect(payload().sections[0].tasks[0]).toMatchObject({
      title: "Gyomlálás",
      summerOnly: true,
      helpersNeeded: "3",
    });
  });

  it("edits every task field, moves a task, adds and removes tasks and sections", () => {
    render(<TemplateEditorForm area="admin" template={template()} backHref="/admin/sablonok" />);
    const task = within(screen.getByTestId("template-task-0-0"));
    fireEvent.change(task.getByLabelText("Helyszín"), { target: { value: "Udvar" } });
    fireEvent.change(task.getByLabelText("Eszközök"), { target: { value: "Kapa" } });
    fireEvent.change(task.getByLabelText("Fontosság (1–3)"), { target: { value: "3" } });
    fireEvent.change(task.getByLabelText("Hány segítő kell?"), { target: { value: "4" } });
    fireEvent.click(task.getByLabelText(/Időpont számít/));
    fireEvent.click(task.getByLabelText(/Csak nyáron/));
    expect(payload().sections[0].tasks[0]).toMatchObject({
      place: "Udvar",
      props: "Kapa",
      priority: "3",
      helpersNeeded: "4",
      timeMatters: true,
      summerOnly: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Feladat lejjebb: Ásás" }));
    expect(payload().sections[0].tasks.map((t: { title: string }) => t.title)).toEqual([
      "Vetés",
      "Ásás",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Feladat feljebb: Ásás" }));
    expect(payload().sections[0].tasks[0].title).toBe("Ásás");
    fireEvent.click(screen.getByTestId("template-add-task-0"));
    expect(payload().sections[0].tasks).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Feladat törlése: 3. feladat" }));
    expect(payload().sections[0].tasks).toHaveLength(2);
    fireEvent.click(screen.getByTestId("template-add-section"));
    expect(payload().sections).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Rész lejjebb: Kert" }));
    expect(payload().sections[1].title).toBe("Kert");
    fireEvent.click(screen.getByRole("button", { name: "Rész feljebb: Kert" }));
    expect(payload().sections[0].title).toBe("Kert");
    fireEvent.click(screen.getByRole("button", { name: "Rész törlése: 2. rész" }));
    expect(payload().sections).toHaveLength(1);
    fireEvent.change(screen.getByTestId("template-section-title-0"), { target: { value: "Kert" } });
    fireEvent.change(screen.getByLabelText("Kinek szól?"), { target: { value: "organisers" } });
    expect(payload().sections[0].kind).toBe("organisers");
  });

  it("starts a new template with one empty section and one empty task", () => {
    render(<TemplateEditorForm area="admin" backHref="/admin/sablonok" />);
    expect(payload().sections).toHaveLength(1);
    expect(payload().sections[0].tasks).toHaveLength(1);
  });
});

describe("the template choice of the new-event form", () => {
  const items = [
    { id: TEMPLATE, name: "Nagytakarítás", defaultLeadDays: 14, hasSummerTasks: true },
    { id: "t2", name: "Húsvét", hasSummerTasks: false },
  ];

  it("suggests the lead time into an empty notice field and says the template has summer tasks", () => {
    render(
      <>
        <input id="event-notice-lead" type="number" />
        <TemplateChooser templates={items} />
      </>,
    );
    fireEvent.change(screen.getByTestId("event-template-select"), { target: { value: TEMPLATE } });
    expect((document.getElementById("event-notice-lead") as HTMLInputElement).value).toBe("14");
    expect(screen.getByTestId("event-template-lead-hint").textContent).toContain("14 nappal");
    expect(screen.getByTestId("event-template-summer-hint")).toBeTruthy();
  });

  it("never overwrites a typed lead time and shows no hint for a template without one", () => {
    render(
      <>
        <input id="event-notice-lead" type="number" defaultValue="3" />
        <TemplateChooser templates={items} />
      </>,
    );
    fireEvent.change(screen.getByTestId("event-template-select"), { target: { value: TEMPLATE } });
    expect((document.getElementById("event-notice-lead") as HTMLInputElement).value).toBe("3");
    fireEvent.change(screen.getByTestId("event-template-select"), { target: { value: "t2" } });
    expect(screen.queryByTestId("event-template-lead-hint")).toBeNull();
    expect(screen.queryByTestId("event-template-summer-hint")).toBeNull();
    fireEvent.change(screen.getByTestId("event-template-select"), { target: { value: "" } });
    expect((screen.getByTestId("event-template-select") as HTMLSelectElement).value).toBe("");
  });
});
