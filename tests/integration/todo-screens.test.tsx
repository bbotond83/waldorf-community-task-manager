import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  denied,
  success,
  terminalFailure,
  type MyTasksModel,
  type MyTasksRow,
  type TodoCard,
  type TodoDetailModel,
  type TodoGroupListModel,
  type TodoListModel,
} from "../../src/application/index.ts";

const TASK = "11111111-1111-4111-8111-111111111111";
const TASK_B = "22222222-2222-4222-8222-222222222222";
const GROUP = "33333333-3333-4333-8333-333333333333";
const FAMILY = "44444444-4444-4444-8444-444444444444";
const EVENT = "55555555-5555-4555-8555-555555555555";

const world = vi.hoisted(() => ({
  facadeOn: true,
  todo: {
    list: vi.fn(),
    get: vi.fn(),
    groupList: vi.fn(),
    myTasks: vi.fn(),
  },
  events: { detail: vi.fn() },
  admin: { listFamilyNames: vi.fn() },
  groups: { detail: vi.fn() },
  manager: undefined as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../app/_todo/actor.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/_todo/actor.ts")>()),
  resolveTodoManager: async () => world.manager,
}));
vi.mock("../../app/_todo/facade.ts", () => ({
  resolveTodoFacade: async () => (world.facadeOn ? world.todo : undefined),
}));
vi.mock("../../app/_events/facade.ts", () => ({
  resolveEventFacade: async () => (world.facadeOn ? world.events : undefined),
}));
vi.mock("../../app/admin/_lib/facade.ts", () => ({
  resolveAdminFacade: async () => (world.facadeOn ? world.admin : undefined),
}));
vi.mock("../../app/teacher/_lib/facade.ts", () => ({
  resolveWorkingGroupFacade: async () => (world.facadeOn ? world.groups : undefined),
}));
// The recurring and template tabs are the group pages' own bodies; their reads are tested with those screens.
vi.mock("../../app/_recurring/RecurringScreens.tsx", () => ({
  RecurringGroupTab: (props: { groupId: string }) => `[recurring-tab ${props.groupId}]`,
}));
vi.mock("../../app/_checklists/TemplateScreens.tsx", () => ({
  TemplateListTab: (props: { groupId: string; actor: { area: string } }) =>
    `[templates-tab ${props.groupId} ${props.actor.area}]`,
}));

import {
  ClaimButton,
  DoneButton,
  PullForm,
  TodoForm,
  UpdateForm,
} from "../../app/_todo/TodoForms.tsx";
import {
  GroupTodoSection,
  loadGroupTodo,
  MyTasksScreen,
  parseManageTab,
  parseTodoFilters,
  TodoDetailScreen,
  TodoFormScreen,
  TodoListScreen,
  TodoManageScreen,
  TodoPullScreen,
} from "../../app/_todo/TodoScreens.tsx";

const actorFor = (area: "szulo" | "teacher" | "admin") =>
  ({ area, session: { roles: ["parent"] }, scope: {} }) as never;

const card = (id: string, over: Partial<TodoCard> = {}): TodoCard => ({
  id,
  topic: "Kerítésjavítás",
  status: "open",
  ownerKind: "working_group",
  ownerId: GROUP,
  ownerLabel: "Kert munkacsoport",
  claimedByMe: false,
  isDone: false,
  isNotYet: false,
  isOverdue: false,
  needsAttention: false,
  canClaim: false,
  version: 1,
  onEvent: false,
  doneOnEvent: false,
  ...over,
});

const listModel = (items: TodoCard[], canClaimTasks = true): TodoListModel => ({
  items,
  truncated: false,
  caller: { canClaimTasks, canManageCommunity: false },
});

const noRights = {
  claim: false,
  giveBack: false,
  update: false,
  markDone: false,
  undoDone: false,
  freeClaim: false,
  edit: false,
};

const detailModel = (
  item: TodoCard,
  over: Partial<TodoDetailModel> = {},
  can: Partial<TodoDetailModel["can"]> = {},
): TodoDetailModel => ({
  item,
  createdAt: "2026-11-01T08:00:00Z",
  history: [],
  eventLinks: [],
  can: { ...noRights, ...can },
  ...over,
});

const html = async (node: Promise<unknown>) => renderToStaticMarkup((await node) as never);

const groupScope = { id: GROUP, type: "group", organizationId: "org" };
const coordinator = {
  session: { roles: ["group_admin"] },
  isSuperAdmin: false,
  scopeFor: (groupId?: string) => (groupId === GROUP ? groupScope : undefined),
};

beforeEach(() => {
  world.manager = coordinator;
  world.facadeOn = true;
  for (const fn of Object.values(world.todo)) fn.mockReset();
  world.events.detail.mockReset();
  world.admin.listFamilyNames.mockReset();
  world.groups.detail.mockReset();
});

describe("the filters of the list", () => {
  it("keeps only values that mean something", () => {
    expect(
      parseTodoFilters({
        mind: "1",
        allapot: "in_progress",
        fontossag: "2",
        felelos: GROUP,
        figyelem: "1",
      }),
    ).toEqual({
      showHidden: true,
      status: "in_progress",
      priority: 2,
      owner: GROUP,
      attentionOnly: true,
    });
    expect(
      parseTodoFilters({
        mind: "0",
        allapot: "bogus",
        fontossag: "9",
        felelos: "x",
        figyelem: ["1"],
      }),
    ).toEqual({});
  });
});

describe("the community list", () => {
  const items = [
    card(TASK, {
      claimantDisplayName: "Nagy Réka",
      claimedByMe: true,
      priority: 1,
      deadline: "2026-12-12",
      status: "in_progress",
      isOverdue: true,
    }),
    card(TASK_B, { topic: "Veteményes", ownerKind: "family", ownerId: FAMILY, canClaim: true }),
    card("c3", { topic: "Tető", isDone: true, status: "done", claimantDisplayName: "Nagy Réka" }),
    card("c4", { topic: "Pince", needsAttention: true, isNotYet: true, notBefore: "2027-01-10" }),
  ];

  it("reads once and shows each status as an icon and a word, with the buttons the card allows", async () => {
    world.todo.list.mockResolvedValue(success(listModel(items)));
    const out = await html(TodoListScreen({ actor: actorFor("szulo"), filters: {} }));
    expect(world.todo.list).toHaveBeenCalledTimes(1);
    for (const word of ["Vállalta: Nagy Réka", "Szabad", "Kész", "Figyelem: korábbi tag"]) {
      expect(out).toContain(word);
    }
    expect(out).toContain("Lejárt");
    expect(out).toContain("Még nem kezdődik");
    expect(out).toContain("1. prioritás • Határidő: 2026. december 12.");
    expect(out).toContain('data-status-icon="check"');
    expect(out).toContain('data-status-icon="warning"');
    expect(out).toContain('data-testid="todo-claim-form-' + TASK_B + '"');
    expect(out).toContain('data-testid="todo-done-form-' + TASK + '"');
    expect(out).toContain('data-testid="todo-giveback-form-' + TASK + '"');
    expect(out).not.toContain("todo-claim-form-" + TASK + '"');
    expect(out).toContain(`href="/szulo/teendok/${TASK}"`);
    expect(out).not.toContain("todo-new-link");
    expect(out).toContain("Elkészültek és későbbiek is");
    expect(out).not.toContain("todo-filter-attention");
  });

  it("offers the owners found on the list and keeps the chosen filters in the form", async () => {
    world.todo.list.mockResolvedValue(success(listModel(items)));
    const out = await html(
      TodoListScreen({
        actor: actorFor("admin"),
        filters: { showHidden: true, status: "open", priority: 3, owner: GROUP },
      }),
    );
    expect(world.todo.list).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      showHidden: true,
      status: "open",
      priority: 3,
      owner: GROUP,
    });
    expect(out).toContain("Kert munkacsoport");
    expect(out).toContain('href="/admin/teendok/uj"');
    expect(out).toContain("Új teendő");
  });

  it("keeps offering every owner after one owner is chosen: the choices come from a second, wider read", async () => {
    world.todo.list
      .mockResolvedValueOnce(success(listModel([items[0]!])))
      .mockResolvedValueOnce(
        success(
          listModel([
            items[0]!,
            card("c9", { ownerKind: "family", ownerId: FAMILY, ownerLabel: "Cserepes család" }),
          ]),
        ),
      );
    const out = await html(TodoListScreen({ actor: actorFor("admin"), filters: { owner: GROUP } }));
    expect(world.todo.list).toHaveBeenCalledTimes(2);
    expect(world.todo.list).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), {
      showHidden: true,
    });
    expect(out).toContain("Cserepes család");
  });

  it("shows the attention filter to a person who may manage the community", async () => {
    world.todo.list.mockResolvedValue(
      success({ ...listModel(items), caller: { canClaimTasks: false, canManageCommunity: true } }),
    );
    const out = await html(TodoListScreen({ actor: actorFor("admin"), filters: {} }));
    expect(out).toContain("todo-filter-attention");
    expect(out).not.toContain("todo-claim-form");
  });

  it("gives a teacher the list and no button", async () => {
    world.todo.list.mockResolvedValue(success(listModel(items)));
    const out = await html(TodoListScreen({ actor: actorFor("teacher"), filters: {} }));
    expect(out).toContain("Veteményes");
    expect(out).not.toMatch(/data-testid="todo-[a-z]+-form-/);
    expect(out).toContain(`href="/teacher/teendok/${TASK}"`);
  });

  it("says nothing is open, or that no task matches with a way back, only after a successful read", async () => {
    world.todo.list.mockResolvedValue(success(listModel([])));
    const empty = await html(TodoListScreen({ actor: actorFor("szulo"), filters: {} }));
    expect(empty).toContain('data-testid="todo-empty"');
    expect(empty).toContain("Most nincs nyitott teendő.");
    const none = await html(
      TodoListScreen({ actor: actorFor("szulo"), filters: { status: "postponed" } }),
    );
    expect(none).toContain('data-testid="todo-no-match"');
    expect(none).toContain("Nincs találat");
    expect(none).toContain('href="/szulo/teendok"');
    world.todo.list.mockResolvedValue(denied());
    const refused = await html(TodoListScreen({ actor: actorFor("szulo"), filters: {} }));
    expect(refused).toContain("todo-list-state-denied");
    expect(refused).not.toContain("todo-empty");
    world.todo.list.mockResolvedValue(terminalFailure());
    expect(await html(TodoListScreen({ actor: actorFor("szulo"), filters: {} }))).not.toContain(
      "todo-empty",
    );
    world.facadeOn = false;
    expect(await html(TodoListScreen({ actor: actorFor("szulo"), filters: {} }))).not.toContain(
      "todo-empty",
    );
  });
});

describe("a task's page", () => {
  const full = detailModel(
    card(TASK, {
      priority: 2,
      deadline: "2026-12-12",
      notBefore: "2026-12-01",
      claimantDisplayName: "Nagy Réka",
      isDone: true,
      status: "done",
    }),
    {
      description: "Az északi oldal",
      materials: "Léc, szög",
      note: "Hétvégén",
      done: { at: "2026-11-20T10:00:00Z", isOwn: false, byDisplayName: "Nagy Réka" },
      history: [
        { change: "created", actor: "adminisztrátor", at: "2026-11-01T08:00:00Z" },
        {
          change: "status_changed",
          actor: "Nagy Réka",
          at: "2026-11-02T08:00:00Z",
          fromStatus: "open",
          toStatus: "in_progress",
        },
      ],
      eventLinks: [
        {
          eventId: EVENT,
          pulledAt: "2026-11-03T08:00:00Z",
          state: "on_list",
          eventClosed: false,
          eventTitle: "Kaláka",
        },
        {
          eventId: EVENT,
          pulledAt: "2026-11-03T08:00:00Z",
          state: "gone",
          eventClosed: true,
          eventTitle: "Régi",
        },
      ],
    },
    { undoDone: true, edit: true },
  );

  it("shows the fields, the event links, the history and only the buttons the database allows", async () => {
    world.todo.get.mockResolvedValue(success(full));
    const out = await html(TodoDetailScreen({ actor: actorFor("szulo"), taskId: TASK }));
    expect(world.todo.get).toHaveBeenCalledTimes(1);
    for (const text of [
      "Az északi oldal",
      "Léc, szög",
      "Hétvégén",
      "Kert munkacsoport",
      "Nagy Réka",
      "Felvéve az eseményre: Kaláka",
      "Már nincs az esemény feladatlistáján.",
      "Létrehozva",
      "Állapot módosítva: Nyitott → Folyamatban",
    ]) {
      expect(out).toContain(text);
    }
    expect(out).toContain(`href="/szulo/esemenyek/${EVENT}"`);
    expect(out).toContain(`href="/szulo/munkacsoportok/${GROUP}/kezeles/teendo/${TASK}"`);
    expect(out).toContain('data-testid="todo-undo-form-' + TASK + '"');
    expect(out).not.toContain("todo-done-form");
    expect(out).not.toContain("todo-update-form");
  });

  it("shows topic, description, materials and note as plain text, escaped (NFR1.10)", async () => {
    world.todo.get.mockResolvedValue(
      success(
        detailModel(
          card(TASK, { topic: "<b>Pad</b>" }),
          { description: "<script>x()</script>", materials: "<i>léc</i>", note: "<u>jegyzet</u>" },
          {},
        ),
      ),
    );
    const out = await html(TodoDetailScreen({ actor: actorFor("szulo"), taskId: TASK }));
    for (const markup of ["<b>", "<script>", "<i>", "<u>"]) expect(out).not.toContain(markup);
    for (const escaped of [
      "&lt;b&gt;Pad",
      "&lt;script&gt;x()",
      "&lt;i&gt;léc",
      "&lt;u&gt;jegyzet",
    ]) {
      expect(out).toContain(escaped);
    }
  });

  it("sends a family-owned task and the admin area to the admin form", async () => {
    world.todo.get.mockResolvedValue(
      success(
        detailModel(card(TASK, { ownerKind: "family", ownerId: FAMILY }), {}, { edit: true }),
      ),
    );
    expect(await html(TodoDetailScreen({ actor: actorFor("szulo"), taskId: TASK }))).toContain(
      `href="/admin/teendok/${TASK}/szerkesztes"`,
    );
    world.todo.get.mockResolvedValue(success(detailModel(card(TASK), {}, { edit: true })));
    expect(await html(TodoDetailScreen({ actor: actorFor("admin"), taskId: TASK }))).toContain(
      `href="/admin/teendok/${TASK}/szerkesztes"`,
    );
  });

  it("offers claiming, finishing, giving back, freeing and the status form where allowed", async () => {
    world.todo.get.mockResolvedValue(
      success(
        detailModel(
          card(TASK, { claimedByMe: true, status: "in_progress" }),
          { note: "Megjegyzés" },
          { claim: true, markDone: true, giveBack: true, freeClaim: true, update: true },
        ),
      ),
    );
    const out = await html(TodoDetailScreen({ actor: actorFor("szulo"), taskId: TASK }));
    for (const form of ["claim", "done", "giveback", "free", "update"]) {
      expect(out).toContain(`data-testid="todo-${form}-form`);
    }
    expect(out).toContain("Folyamatban");
  });

  it("gives a teacher the page and no button or edit link", async () => {
    world.todo.get.mockResolvedValue(
      success(detailModel(card(TASK), {}, { claim: true, edit: true, update: true })),
    );
    const out = await html(TodoDetailScreen({ actor: actorFor("teacher"), taskId: TASK }));
    expect(out).not.toContain("<button");
    expect(out).not.toContain("todo-edit-link");
    expect(out).toContain('href="/teacher/teendok"');
  });

  it("reads a refused task as the denied state and a missing facade as no content", async () => {
    world.todo.get.mockResolvedValue(denied());
    expect(await html(TodoDetailScreen({ actor: actorFor("szulo"), taskId: TASK }))).toContain(
      "todo-detail-state-denied",
    );
    world.facadeOn = false;
    expect(await html(TodoDetailScreen({ actor: actorFor("szulo"), taskId: TASK }))).not.toContain(
      "todo-fact",
    );
  });
});

describe("My tasks", () => {
  const row = (over: Partial<MyTasksRow>): MyTasksRow => ({
    kind: "todo",
    id: TASK,
    refId: TASK,
    title: "Kerítésjavítás",
    status: "in_progress",
    version: 2,
    isOverdue: false,
    canMarkDone: true,
    ...over,
  });
  const model = (over: Partial<MyTasksModel> = {}): MyTasksModel => ({
    thisWeek: [],
    later: [],
    noDate: [],
    isEmpty: false,
    weekEnd: "2026-11-29",
    ...over,
  });

  it("groups the rows by week and sends each kind to its own screen", async () => {
    world.todo.myTasks.mockResolvedValue(
      success(
        model({
          thisWeek: [
            row({ isOverdue: true, date: "2026-11-20" }),
            row({ kind: "recurring", id: "r1", refId: "r1", title: "Tyúkok" }),
          ],
          later: [
            row({ kind: "duty", id: "d1", refId: "t1", title: "Takarítás", canMarkDone: false }),
          ],
          noDate: [row({ id: TASK_B, refId: TASK_B, title: "Veteményes", canMarkDone: false })],
        }),
      ),
    );
    const out = await html(MyTasksScreen({ actor: actorFor("szulo") }));
    expect(world.todo.myTasks).toHaveBeenCalledTimes(1);
    for (const heading of ["Ezen a héten", "Később", "Nincs dátum"]) {
      expect(out).toContain(heading);
    }
    expect(out).toContain("Lejárt");
    expect(out).toContain(`href="/szulo/teendok/${TASK}"`);
    expect(out).toContain('href="/szulo/ismetlodo"');
    expect(out).toContain('href="/szulo/feladatok/d1"');
    expect(out).toContain(`data-testid="todo-done-form-${TASK}"`);
    expect(out).toContain('data-testid="todo-recurring-done-form-r1"');
    expect(out).not.toContain("todo-done-form-" + TASK_B);
  });

  it("says nothing is left with links to the to-do list and the animal care, and shows refusals as such", async () => {
    world.todo.myTasks.mockResolvedValue(success(model({ isEmpty: true })));
    const empty = await html(MyTasksScreen({ actor: actorFor("szulo") }));
    expect(empty).toContain("Most nincs feladatotok.");
    expect(empty).toContain('href="/szulo/teendok"');
    expect(empty).toContain('href="/szulo/allatok"');
    world.todo.myTasks.mockResolvedValue(denied());
    const refused = await html(MyTasksScreen({ actor: actorFor("szulo") }));
    expect(refused).toContain("my-tasks-state-denied");
    expect(refused).not.toContain("my-tasks-empty");
    world.facadeOn = false;
    expect(await html(MyTasksScreen({ actor: actorFor("szulo") }))).not.toContain("my-tasks-empty");
  });
});

describe("the management page", () => {
  const group = (over: Partial<TodoGroupListModel> = {}): TodoGroupListModel => ({
    items: [
      {
        id: TASK,
        title: "Kerítés",
        status: "in_progress",
        isOverdue: true,
        needsAttention: false,
        version: 3,
        priority: 2,
        deadline: "2026-12-12",
        claimantDisplayName: "Nagy Réka",
      },
      {
        id: TASK_B,
        title: "Pince",
        status: "open",
        isOverdue: false,
        needsAttention: true,
        version: 1,
      },
      {
        id: "c3",
        title: "Tető",
        status: "done",
        isOverdue: false,
        needsAttention: false,
        version: 1,
        claimantDisplayName: "Nagy Réka",
      },
    ],
    truncated: false,
    ...over,
  });

  it("shows the tabs, the group's tasks, the form links and the free button for a held task", async () => {
    world.todo.groupList.mockResolvedValue(success(group()));
    const out = await html(TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(world.todo.groupList).toHaveBeenCalledTimes(1);
    // The read uses the coordinator's own session and the group's scope, not the family scope of the parent pages.
    expect(world.todo.groupList).toHaveBeenCalledWith(coordinator.session, groupScope, GROUP);
    for (const tab of ["Teendők", "Ismétlődő feladatok", "Sablonok", "Tagok"]) {
      expect(out).toContain(tab);
    }
    // The tabs stay on the management page; the open one is marked.
    expect(out).toContain(`href="/szulo/munkacsoportok/${GROUP}/kezeles?ful=ismetlodo"`);
    expect(out).toContain(`href="/szulo/munkacsoportok/${GROUP}/kezeles?ful=sablonok"`);
    expect(out).toContain(`href="/szulo/munkacsoportok/${GROUP}/kezeles?ful=tagok"`);
    expect(out).toMatch(/aria-current="page"[^>]*data-testid="manage-tab-todo"/);
    expect(out).toContain(`href="/szulo/munkacsoportok/${GROUP}/kezeles/teendo"`);
    expect(out).toContain(`href="/szulo/munkacsoportok/${GROUP}/kezeles/teendo/${TASK}"`);
    expect(out).toContain(`data-testid="todo-free-form-${TASK}"`);
    expect(out).not.toContain("todo-free-form-" + TASK_B);
    expect(out).not.toContain("todo-free-form-c3");
    expect(out).toContain("Figyelem: korábbi tag");
    expect(out).toContain("Új teendő");
  });

  it("shows the recurring duties, the templates and the members inline, reading only the open tab", async () => {
    const recurring = await html(
      TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP, tab: "recurring" }),
    );
    expect(recurring).toContain(`[recurring-tab ${GROUP}]`);
    expect(recurring).toMatch(/aria-current="page"[^>]*data-testid="manage-tab-recurring"/);
    const templates = await html(
      TodoManageScreen({ actor: actorFor("admin"), groupId: GROUP, tab: "templates" }),
    );
    expect(templates).toContain(`[templates-tab ${GROUP} admin]`);
    world.groups.detail.mockResolvedValue(
      success({
        group: { id: GROUP, name: "Kert", description: "", schoolYearName: "2026/27" },
        hasCoordinator: true,
        callerIsParent: true,
        members: [
          {
            membershipId: "m1",
            fullName: "Teszt Elek",
            isSelf: false,
            isCoordinator: true,
          },
        ],
      }),
    );
    const members = await html(
      TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP, tab: "members" }),
    );
    expect(members).toContain("Teszt Elek");
    expect(members).toContain("Koordinátor");
    expect(members).toContain('href="/szulo/szulok"');
    // Only the open tab is read: the to-do read was not made for any of the three.
    expect(world.todo.groupList).not.toHaveBeenCalled();
    expect(world.groups.detail).toHaveBeenCalledTimes(1);
    world.groups.detail.mockResolvedValue(denied());
    expect(
      await html(TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP, tab: "members" })),
    ).toContain("manage-members-state-denied");
    world.facadeOn = false;
    expect(
      await html(TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP, tab: "members" })),
    ).not.toContain("Teszt Elek");
  });

  it("names a tab by its address and falls back to the to-do tab for anything else", () => {
    expect(parseManageTab("ismetlodo")).toBe("recurring");
    expect(parseManageTab("sablonok")).toBe("templates");
    expect(parseManageTab("tagok")).toBe("members");
    expect(parseManageTab("teendok")).toBe("todo");
    expect(parseManageTab(undefined)).toBe("todo");
    expect(parseManageTab(["tagok"])).toBe("todo");
    expect(parseManageTab("valami")).toBe("todo");
  });

  it("uses the admin addresses in the admin area and says when the group has no task", async () => {
    world.todo.groupList.mockResolvedValue(success(group({ items: [] })));
    const out = await html(TodoManageScreen({ actor: actorFor("admin"), groupId: GROUP }));
    expect(out).toContain(`href="/admin/munkacsoportok/${GROUP}/kezeles/teendo"`);
    expect(out).toContain('data-testid="manage-empty"');
  });

  it("reads a refused page as the denied state, never an empty list", async () => {
    world.todo.groupList.mockResolvedValue(denied());
    const out = await html(TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(out).toContain("manage-state-denied");
    expect(out).not.toContain("manage-empty");
    // A person who coordinates no such group, or no group at all, is refused before the database is asked.
    world.todo.groupList.mockReset();
    const other = await html(TodoManageScreen({ actor: actorFor("szulo"), groupId: FAMILY }));
    expect(other).toContain("manage-state-denied");
    world.manager = undefined;
    expect(await html(TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP }))).toContain(
      "manage-state-denied",
    );
    expect(world.todo.groupList).not.toHaveBeenCalled();
    world.facadeOn = false;
    expect(
      await html(TodoManageScreen({ actor: actorFor("szulo"), groupId: GROUP })),
    ).not.toContain("manage-empty");
  });
});

describe("the task form page", () => {
  it("opens an empty form for a group", async () => {
    const out = await html(TodoFormScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(out).toContain("Új teendő");
    expect(out).toContain('name="ownerGroupId"');
    expect(out).toContain(`href="/szulo/munkacsoportok/${GROUP}/kezeles"`);
    expect(world.todo.get).not.toHaveBeenCalled();
  });

  it("lets a super admin choose the group when none is named", async () => {
    const out = await html(
      TodoFormScreen({
        actor: actorFor("admin"),
        groups: [{ id: GROUP, name: "Kert" }],
      }),
    );
    expect(out).toContain("Válassz munkacsoportot");
    expect(out).toContain("Kert");
    expect(out).toContain('href="/admin/teendok"');
  });

  it("fills the form of an existing task and shows who owns it", async () => {
    world.todo.get.mockResolvedValue(
      success(
        detailModel(
          card(TASK, { priority: 3, notBefore: "2026-12-01", deadline: "2026-12-20", version: 4 }),
          { description: "Leírás", materials: "Anyag", note: "Megjegyzés" },
          { edit: true },
        ),
      ),
    );
    const out = await html(TodoFormScreen({ actor: actorFor("szulo"), taskId: TASK }));
    expect(out).toContain("Szerkesztés");
    expect(out).toContain('value="Kerítésjavítás"');
    expect(out).toContain("Kert munkacsoport");
    expect(out).toContain('name="expectedVersion" value="4"');
    expect(out).toContain('value="2026-12-20"');
    expect(out).not.toContain("Válassz munkacsoportot");
  });

  it("keeps a family-owned task with its family and hides the status of a done task", async () => {
    world.todo.get.mockResolvedValue(
      success(
        detailModel(
          card(TASK, { ownerKind: "family", ownerId: FAMILY, status: "done", isDone: true }),
          {},
          { edit: true },
        ),
      ),
    );
    const out = await html(TodoFormScreen({ actor: actorFor("admin"), taskId: TASK }));
    expect(out).toContain(`name="ownerFamilyId" value="${FAMILY}"`);
    expect(out).not.toContain('id="todo-status"');
  });

  describe("handing a family's task to another family", () => {
    const familyTask = () =>
      success(
        detailModel(
          card(TASK, { ownerKind: "family", ownerId: FAMILY, needsAttention: true }),
          {},
          { edit: true },
        ),
      );
    const superAdmin = {
      session: { roles: ["super_admin"] },
      isSuperAdmin: true,
      scopeFor: () => ({}),
    };

    it("offers the other active families to a super admin, never the current owner", async () => {
      world.manager = superAdmin;
      world.todo.get.mockResolvedValue(familyTask());
      world.admin.listFamilyNames.mockResolvedValue(
        success({
          items: [
            { id: FAMILY, displayName: "Kovács család" },
            { id: GROUP, displayName: "Szabó család" },
          ],
        }),
      );
      const out = await html(TodoFormScreen({ actor: actorFor("admin"), taskId: TASK }));
      expect(out).toContain("Átadás másik családnak");
      expect(out).toContain("Nem változik");
      expect(out).toContain("Szabó család");
      expect(out).not.toContain("Kovács család");
      expect(world.admin.listFamilyNames).toHaveBeenCalledTimes(1);
    });

    it("offers nothing to a coordinator, in the parent area, for a group's task, or when the list cannot be read", async () => {
      world.todo.get.mockResolvedValue(familyTask());
      world.admin.listFamilyNames.mockResolvedValue(
        success({ items: [{ id: GROUP, displayName: "Szabó család" }] }),
      );
      // A coordinator is not a super admin: the read is not even made.
      expect(await html(TodoFormScreen({ actor: actorFor("admin"), taskId: TASK }))).not.toContain(
        "Átadás másik családnak",
      );
      world.manager = superAdmin;
      expect(await html(TodoFormScreen({ actor: actorFor("szulo"), taskId: TASK }))).not.toContain(
        "Átadás másik családnak",
      );
      expect(world.admin.listFamilyNames).not.toHaveBeenCalled();
      world.todo.get.mockResolvedValue(success(detailModel(card(TASK), {}, { edit: true })));
      expect(await html(TodoFormScreen({ actor: actorFor("admin"), taskId: TASK }))).not.toContain(
        "Átadás másik családnak",
      );
      world.todo.get.mockResolvedValue(familyTask());
      world.admin.listFamilyNames.mockResolvedValue(denied());
      expect(await html(TodoFormScreen({ actor: actorFor("admin"), taskId: TASK }))).not.toContain(
        "Átadás másik családnak",
      );
      world.facadeOn = false;
      expect(await html(TodoFormScreen({ actor: actorFor("admin"), taskId: TASK }))).toContain(
        "todo-form-denied",
      );
    });

    it("links the task page of a super admin to the chooser, and shows no such link to anyone else", async () => {
      world.todo.get.mockResolvedValue(familyTask());
      const admin = await html(TodoDetailScreen({ actor: actorFor("admin"), taskId: TASK }));
      expect(admin).toContain('data-testid="todo-handover-link"');
      expect(admin).toContain(`/admin/teendok/${TASK}/szerkesztes#todo-new-owner-family`);
      world.todo.get.mockResolvedValue(
        success(
          detailModel(card(TASK, { ownerKind: "family", ownerId: FAMILY }), {}, { edit: false }),
        ),
      );
      expect(
        await html(TodoDetailScreen({ actor: actorFor("admin"), taskId: TASK })),
      ).not.toContain("todo-handover-link");
      world.todo.get.mockResolvedValue(success(detailModel(card(TASK), {}, { edit: true })));
      expect(
        await html(TodoDetailScreen({ actor: actorFor("admin"), taskId: TASK })),
      ).not.toContain("todo-handover-link");
    });
  });

  it("refuses a person who may not edit, a refused task and a missing facade with one plain sentence", async () => {
    world.todo.get.mockResolvedValue(success(detailModel(card(TASK), {}, { edit: false })));
    expect(await html(TodoFormScreen({ actor: actorFor("szulo"), taskId: TASK }))).toContain(
      "todo-form-denied",
    );
    world.todo.get.mockResolvedValue(denied());
    expect(await html(TodoFormScreen({ actor: actorFor("szulo"), taskId: TASK }))).toContain(
      "Ezt a teendőt nem kezelheted.",
    );
    world.facadeOn = false;
    expect(await html(TodoFormScreen({ actor: actorFor("szulo"), groupId: GROUP }))).toContain(
      "todo-form-denied",
    );
  });
});

describe("the pull list of an event", () => {
  const eventDetail = (over: Record<string, unknown> = {}, canManage = true) =>
    success({
      event: { id: EVENT, title: "Kaláka", isOpen: true, groupId: GROUP, ...over },
      caller: { canManage, canSignUp: false },
    });

  it("reads the event and the list, and offers a checkbox for every open task", async () => {
    world.events.detail.mockResolvedValue(eventDetail());
    world.todo.list.mockResolvedValue(
      success(
        listModel([
          card(TASK, { onEvent: true, priority: 1 }),
          card(TASK_B, { topic: "Veteményes", claimantDisplayName: "Nagy Réka" }),
          card("c3", { topic: "Kész", isDone: true }),
        ]),
      ),
    );
    const out = await html(TodoPullScreen({ actor: actorFor("szulo"), eventId: EVENT }));
    expect(world.events.detail).toHaveBeenCalledTimes(1);
    expect(world.todo.list).toHaveBeenCalledTimes(1);
    expect(out).toContain("Teendők hozzáadása");
    expect(out).toContain("Kijelöltek hozzáadása (0)");
    expect(out).toContain(`value="${TASK}:1"`);
    expect(out).toContain(`value="${TASK_B}:1"`);
    expect(out).not.toContain('value="c3:1"');
    expect(out).toContain(`data-testid="todo-pull-added-${TASK}"`);
    expect(out).not.toContain("todo-pull-added-" + TASK_B);
    expect(out).toContain(`href="/szulo/esemenyek/${EVENT}"`);
  });

  it("refuses a person who does not manage the event, a teacher and a missing event, before reading the list", async () => {
    world.events.detail.mockResolvedValue(eventDetail({}, false));
    expect(await html(TodoPullScreen({ actor: actorFor("szulo"), eventId: EVENT }))).toContain(
      "todo-pull-denied",
    );
    world.events.detail.mockResolvedValue(eventDetail());
    expect(await html(TodoPullScreen({ actor: actorFor("teacher"), eventId: EVENT }))).toContain(
      "todo-pull-denied",
    );
    world.events.detail.mockResolvedValue(denied());
    expect(await html(TodoPullScreen({ actor: actorFor("szulo"), eventId: EVENT }))).toContain(
      "todo-pull-denied",
    );
    expect(world.todo.list).not.toHaveBeenCalled();
  });

  it("says a closed event takes no task, and shows a refused list as such", async () => {
    world.events.detail.mockResolvedValue(eventDetail({ isOpen: false }));
    world.todo.list.mockResolvedValue(success(listModel([])));
    expect(await html(TodoPullScreen({ actor: actorFor("szulo"), eventId: EVENT }))).toContain(
      "todo-pull-closed",
    );
    world.events.detail.mockResolvedValue(eventDetail());
    world.todo.list.mockResolvedValue(denied());
    expect(await html(TodoPullScreen({ actor: actorFor("szulo"), eventId: EVENT }))).toContain(
      "todo-pull-state-denied",
    );
    world.facadeOn = false;
    expect(await html(TodoPullScreen({ actor: actorFor("szulo"), eventId: EVENT }))).toContain(
      "todo-pull-denied",
    );
  });
});

describe("a group's page", () => {
  it("lists the group's open tasks for every reader with one read, narrowed to the group", async () => {
    world.todo.list.mockResolvedValue(success(listModel([card(TASK)])));
    const actor = actorFor("teacher");
    const result = await loadGroupTodo(actor, GROUP);
    const out = renderToStaticMarkup(
      <GroupTodoSection actor={actor} groupId={GROUP} result={result} />,
    );
    expect(world.todo.list).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      owner: GROUP,
    });
    expect(out).toContain("Kerítésjavítás");
    expect(out).toContain(`href="/teacher/teendok/${TASK}"`);
    expect(out).toContain(`href="/teacher/teendok?felelos=${GROUP}"`);
    expect(out).not.toContain("<button");
  });

  it("says when there is none and shows nothing when the read is refused or fails", async () => {
    const actor = actorFor("szulo");
    const section = (result: Awaited<ReturnType<typeof loadGroupTodo>>) =>
      renderToStaticMarkup(<GroupTodoSection actor={actor} groupId={GROUP} result={result} />);
    world.todo.list.mockResolvedValue(success(listModel([])));
    expect(section(await loadGroupTodo(actor, GROUP))).toContain("group-todo-empty");
    world.todo.list.mockResolvedValue(denied());
    expect(section(await loadGroupTodo(actor, GROUP))).toBe("");
    world.facadeOn = false;
    expect(section(await loadGroupTodo(actor, GROUP))).toBe("");
  });
});

describe("the forms in the browser", () => {
  it("names each button after its task for assistive technology", () => {
    render(
      <>
        <ClaimButton taskId={TASK} topic="Kerítésjavítás" version={1} />
        <DoneButton taskId={TASK_B} topic="Veteményes" version={2} groupId={GROUP} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Vállalom: Kerítésjavítás" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kész: Veteményes" })).toBeTruthy();
  });

  it("counts the chosen tasks on the pull button", () => {
    const rows = [
      {
        id: TASK,
        version: 1,
        topic: "Kerítés",
        stateLabel: "Szabad",
        stateIcon: null,
        meta: "",
        onEvent: false,
      },
      {
        id: TASK_B,
        version: 2,
        topic: "Veteményes",
        stateLabel: "Szabad",
        stateIcon: null,
        meta: "Kert",
        onEvent: true,
      },
    ];
    render(<PullForm eventId={EVENT} groupId={GROUP} rows={rows} />);
    expect(screen.getByRole("button", { name: "Kijelöltek hozzáadása (0)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Kijelölés: Kerítés" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Kijelölés: Veteményes" }));
    expect(screen.getByRole("button", { name: "Kijelöltek hozzáadása (2)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Kijelölés: Kerítés" }));
    expect(screen.getByRole("button", { name: "Kijelöltek hozzáadása (1)" })).toBeTruthy();
    expect(screen.getByText("Már hozzáadva")).toBeTruthy();
  });

  it("shows the status choices and the saved note in the claimant's form", () => {
    render(
      <UpdateForm
        detail={detailModel(card(TASK, { status: "in_progress" }), { note: "Hétvégén" })}
      />,
    );
    expect(screen.getByLabelText("Állapot")).toBeTruthy();
    expect((screen.getByLabelText("Megjegyzés") as HTMLTextAreaElement).value).toBe("Hétvégén");
    expect(screen.getByRole("option", { name: "Elhalasztva" })).toBeTruthy();
  });

  it("shows the family chooser of a family-owned task only when families are given, with 'Nem változik' first", () => {
    const families = [{ id: GROUP, name: "Szabó család" }];
    const { unmount } = render(
      <TodoForm ownerFamilyId={FAMILY} families={families} backHref="/admin/teendok" />,
    );
    const chooser = screen.getByLabelText("Átadás másik családnak") as HTMLSelectElement;
    expect(chooser.name).toBe("newOwnerFamilyId");
    expect(chooser.value).toBe("");
    expect([...chooser.options].map((option) => option.text)).toEqual([
      "Nem változik",
      "Szabó család",
    ]);
    unmount();
    render(<TodoForm ownerFamilyId={FAMILY} families={[]} backHref="/admin/teendok" />);
    expect(screen.queryByLabelText("Átadás másik családnak")).toBeNull();
  });

  it("opens the task form empty with the approved field names and a save button", () => {
    render(<TodoForm ownerGroupId={GROUP} backHref="/szulo/teendok" />);
    for (const label of [
      "Téma",
      "Prioritás",
      "Leírás",
      "Eszközök és anyagok",
      "Állapot",
      "Megjegyzés",
      "Nem előbb",
      "Határidő",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Mentés" })).toBeTruthy();
  });
});
