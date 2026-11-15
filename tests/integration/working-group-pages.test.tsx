import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflict,
  denied,
  success,
  type ApplicationResult,
  type WorkingGroupDetailModel,
  type WorkingGroupMember,
} from "../../src/application/index.ts";
import {
  COORDINATOR_MEMBER_NOTE,
  EMPTY_MEMBERS_TEXT,
  GROUP_UNAVAILABLE_TEXT,
  NO_COORDINATOR_NOTICE,
  WorkingGroupDetail,
  type GroupArea,
} from "../../src/runtime/WorkingGroupDetail.tsx";
import {
  GROUP_DETAIL,
  GROUP_ID,
  OTHER_MEMBERSHIP_ID,
  OWN_MEMBERSHIP_ID,
  requestWorld,
  type RoleKey,
} from "../support/request-world.ts";

vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
const revalidated = vi.hoisted(() => [] as string[]);
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const member = (overrides: Partial<WorkingGroupMember> = {}): WorkingGroupMember => ({
  membershipId: OTHER_MEMBERSHIP_ID,
  parentId: "parent-juhar",
  fullName: "Juhar Dóra",
  isCoordinator: false,
  isSelf: false,
  ...overrides,
});

const model = (overrides: Partial<WorkingGroupDetailModel> = {}): WorkingGroupDetailModel => ({
  ...GROUP_DETAIL,
  ...overrides,
});

const ok = (data: WorkingGroupDetailModel) =>
  success(data) as ApplicationResult<WorkingGroupDetailModel>;

function show(
  result: ApplicationResult<WorkingGroupDetailModel>,
  area: GroupArea = "parent",
  extra: Partial<Parameters<typeof WorkingGroupDetail>[0]> = {},
) {
  return render(
    <WorkingGroupDetail
      result={result}
      area={area}
      listPath={`/${area}/munkacsoportok`}
      directoryPath={`/${area}/szulok`}
      {...extra}
    />,
  );
}

describe("the working-group page (W4)", () => {
  it("shows the name, description, school year and members, with the Koordinátor label", () => {
    show(
      ok(
        model({
          members: [
            member({ isCoordinator: true }),
            member({ membershipId: "m-2", fullName: "Kőris Bence", isSelf: true }),
          ],
        }),
      ),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Játszókert" })).toBeVisible();
    expect(screen.getByText("A játszókert gondozása.")).toBeVisible();
    expect(screen.getByText("2026/2027-es nevelési év")).toBeVisible();
    const coordinator = screen.getByTestId(`parent-group-member-${OTHER_MEMBERSHIP_ID}`);
    expect(within(coordinator).getByText("Koordinátor")).toBeVisible();
    const own = screen.getByTestId("parent-group-member-m-2");
    expect(within(own).getByText("Te")).toBeVisible();
    expect(within(own).queryByText("Koordinátor")).toBeNull();
    expect(screen.queryByTestId("parent-group-no-coordinator")).toBeNull();
  });

  it("links each name to the area's directory and the back link to the area's list", () => {
    show(ok(model()), "teacher");
    expect(screen.getByRole("link", { name: "Juhar Dóra" })).toHaveAttribute(
      "href",
      "/teacher/szulok",
    );
    expect(screen.getByRole("link", { name: "Vissza a munkacsoportokhoz" })).toHaveAttribute(
      "href",
      "/teacher/munkacsoportok",
    );
  });

  it("shows the contact details exactly as the database returned them, and no others", () => {
    show(
      ok(
        model({
          members: [member({ phone: "+36 30 000 0001", email: "juhar@example.test" })],
        }),
      ),
    );
    expect(screen.getByRole("link", { name: "+36 30 000 0001" })).toHaveAttribute(
      "href",
      "tel:+36300000001",
    );
    expect(screen.getByRole("link", { name: "juhar@example.test" })).toHaveAttribute(
      "href",
      "mailto:juhar@example.test",
    );
    cleanupAndShow(ok(model({ members: [member()] })));
    expect(document.body.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull();
  });

  it("says so when the group has no coordinator, and no member row claims the label", () => {
    show(ok(model({ hasCoordinator: false, members: [member()] })));
    expect(screen.getByTestId("parent-group-no-coordinator")).toHaveTextContent(
      NO_COORDINATOR_NOTICE,
    );
    expect(screen.queryByText("Koordinátor")).toBeNull();
  });

  it("shows an empty member list as a status with the approved sentence", () => {
    show(ok(model({ members: [] })));
    expect(screen.getByRole("status")).toHaveTextContent(EMPTY_MEMBERS_TEXT);
    expect(screen.queryByTestId("parent-group-members")).toBeNull();
  });

  it.each(["denied", "invalidated", "empty"] as const)(
    "shows %s as the unavailable group with the way back, never as an empty group",
    (name) => {
      show({ state: name } as ApplicationResult<WorkingGroupDetailModel>, "admin");
      expect(screen.getByRole("alert")).toHaveAttribute("data-testid", "admin-group-unavailable");
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(GROUP_UNAVAILABLE_TEXT);
      expect(screen.getByRole("link", { name: "Vissza a munkacsoportokhoz" })).toBeVisible();
      expect(screen.queryByText(EMPTY_MEMBERS_TEXT)).toBeNull();
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    },
  );

  it("shows a failed read as the error state, separate from the unavailable one", () => {
    show({ state: "dependency-failure-terminal" } as ApplicationResult<WorkingGroupDetailModel>);
    expect(screen.getByRole("alert")).toHaveAttribute("data-testid", "parent-group-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Hiba történt");
    expect(screen.queryByText(GROUP_UNAVAILABLE_TEXT)).toBeNull();
  });

  it("offers no control on its own: the teacher variant has no button at all", () => {
    show(ok(model({ members: [member({ isCoordinator: true, version: 3 })] })), "teacher");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the coordinator note to the admin only when the member rows can be managed", () => {
    show(ok(model({ members: [member({ version: 3 })] })), "admin");
    expect(screen.getByTestId("admin-group-member-note")).toHaveTextContent(
      COORDINATOR_MEMBER_NOTE,
    );
    cleanupAndShow(ok(model({ members: [member()] })), "admin");
    expect(screen.queryByTestId("admin-group-member-note")).toBeNull();
  });

  it("keeps a hostile name and description as plain text", () => {
    const hostile = '<img src=x onerror="sentinel()">';
    const { container } = show(
      ok(
        model({
          group: { ...GROUP_DETAIL.group, description: hostile },
          members: [member({ fullName: hostile })],
        }),
      ),
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText(hostile)).toHaveLength(2);
  });

  it("passes the render slots the member and the page model", () => {
    show(ok(model({ members: [member({ version: 4 })] })), "admin", {
      ownControls: (page) => <p data-testid="own">{page.group.name}</p>,
      memberControls: (row, page) => (
        <p data-testid="row-control">{`${row.fullName}:${row.version}:${page.group.id}`}</p>
      ),
    });
    expect(screen.getByTestId("own")).toHaveTextContent("Játszókert");
    expect(screen.getByTestId("row-control")).toHaveTextContent(`Juhar Dóra:4:${GROUP_ID}`);
  });
});

function cleanupAndShow(
  result: ApplicationResult<WorkingGroupDetailModel>,
  area: GroupArea = "parent",
) {
  document.body.innerHTML = "";
  return show(result, area);
}

// The parent's own membership panel, with the actions replaced so the test sees what the form sends.
// The command tests below call the real actions, so the replacement only answers while `fake` is on.
const actions = vi.hoisted(() => ({
  fake: false,
  join: vi.fn(),
  leave: vi.fn(),
}));
vi.mock("../../app/szulo/group-actions.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../app/szulo/group-actions.ts")>();
  return {
    joinGroupAction: (...args: Parameters<typeof real.joinGroupAction>) =>
      actions.fake ? actions.join(...args) : real.joinGroupAction(...args),
    leaveGroupAction: (...args: Parameters<typeof real.leaveGroupAction>) =>
      actions.fake ? actions.leave(...args) : real.leaveGroupAction(...args),
  };
});

describe("the parent's join and leave controls", () => {
  afterEach(() => {
    actions.fake = false;
  });
  beforeEach(() => {
    actions.fake = true;
    actions.join.mockReset().mockResolvedValue({
      state: "success",
      message: "Csatlakoztál a munkacsoporthoz.",
    });
    actions.leave.mockReset().mockResolvedValue({
      state: "success",
      message: "Kiléptél a munkacsoportból.",
    });
  });

  async function panel() {
    return (await import("../../app/szulo/_components/GroupMembershipPanel.tsx"))
      .GroupMembershipPanel;
  }

  it("offers Csatlakozom to a non-member and sends the group with a fresh key", async () => {
    const Panel = await panel();
    render(<Panel groupId={GROUP_ID} membership={null} isCoordinator={false} />);
    expect(screen.queryByRole("button", { name: "Kilépek" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Csatlakozom" }));
    await waitFor(() => expect(actions.join).toHaveBeenCalledTimes(1));
    const sent = actions.join.mock.calls[0]![1] as FormData;
    expect(sent.get("groupId")).toBe(GROUP_ID);
    expect(String(sent.get("idempotencyKey"))).toMatch(/^group-join:[0-9a-f]{32}$/);
    expect(await screen.findByTestId("parent-group-confirmation")).toHaveTextContent(
      "Csatlakoztál a munkacsoporthoz.",
    );
  });

  it("asks before leaving, and Mégsem changes nothing", async () => {
    const Panel = await panel();
    render(
      <Panel
        groupId={GROUP_ID}
        membership={{ id: OWN_MEMBERSHIP_ID, version: 3 }}
        isCoordinator={false}
      />,
    );
    expect(screen.queryByTestId("parent-group-leave-confirm")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Kilépek" }));
    const confirm = screen.getByTestId("parent-group-leave-confirm");
    expect(within(confirm).queryByTestId("parent-group-coordinator-warning")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mégsem" }));
    expect(screen.getByRole("button", { name: "Kilépek" })).toBeVisible();
    expect(actions.leave).not.toHaveBeenCalled();
  });

  it("warns a coordinator that the right ends with leaving, then sends the version that was on screen", async () => {
    const Panel = await panel();
    render(
      <Panel groupId={GROUP_ID} membership={{ id: OWN_MEMBERSHIP_ID, version: 3 }} isCoordinator />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kilépek" }));
    expect(screen.getByTestId("parent-group-coordinator-warning")).toHaveTextContent(
      "Ha kilépsz, megszűnik a koordinátori jogod ebben a csoportban.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Igen, kilépek" }));
    await waitFor(() => expect(actions.leave).toHaveBeenCalledTimes(1));
    const sent = actions.leave.mock.calls[0]![1] as FormData;
    expect(sent.get("membershipId")).toBe(OWN_MEMBERSHIP_ID);
    expect(sent.get("expectedVersion")).toBe("3");
    expect(sent.get("groupId")).toBe(GROUP_ID);
    expect(await screen.findByTestId("parent-group-confirmation")).toHaveTextContent(
      "Kiléptél a munkacsoportból.",
    );
  });

  it("keeps the form and shows the refusal in words when the command is refused", async () => {
    actions.leave.mockResolvedValue({
      state: "conflict",
      message: "Az oldal közben megváltozott. Frissítsd, és próbáld újra.",
    });
    const Panel = await panel();
    render(
      <Panel
        groupId={GROUP_ID}
        membership={{ id: OWN_MEMBERSHIP_ID, version: 3 }}
        isCoordinator={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kilépek" }));
    fireEvent.click(screen.getByRole("button", { name: "Igen, kilépek" }));
    expect(await screen.findByTestId("parent-group-leave-state-conflict")).toHaveTextContent(
      "Az oldal közben megváltozott.",
    );
    expect(screen.queryByTestId("parent-group-confirmation")).toBeNull();
    expect(screen.getByRole("button", { name: "Igen, kilépek" })).toBeEnabled();
  });
});

describe("the group commands of the parent and of the admin", () => {
  const initial = { state: "initial" } as const;
  const KEY = "group-key:0123456789abcdef";

  function form(values: Record<string, string>): FormData {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  }

  const parentActions = () => import("../../app/szulo/group-actions.ts");
  const adminActions = () => import("../../app/admin/group-actions.ts");

  beforeEach(() => {
    requestWorld.reset();
    revalidated.length = 0;
  });

  it("joins as the signed-in parent, refreshes the group page in every area and says so", async () => {
    requestWorld.signIn("parent");
    const { joinGroupAction } = await parentActions();
    const result = await joinGroupAction(initial, form({ groupId: GROUP_ID, idempotencyKey: KEY }));
    expect(result).toMatchObject({ state: "success", message: "Csatlakoztál a munkacsoporthoz." });
    expect(requestWorld.ports.workingGroups.calls).toEqual([
      { name: "join", input: { idempotencyKey: KEY, groupId: GROUP_ID } },
    ]);
    expect(revalidated).toEqual([
      `/szulo/munkacsoportok/${GROUP_ID}`,
      `/teacher/munkacsoportok/${GROUP_ID}`,
      `/admin/munkacsoportok/${GROUP_ID}`,
    ]);
  });

  it("reports a repeated join as a note, not an error", async () => {
    requestWorld.signIn("parent");
    requestWorld.ports.workingGroups.commandOutcome = {
      state: "success",
      data: { membershipId: OWN_MEMBERSHIP_ID, version: 1, alreadyMember: true },
    };
    const { joinGroupAction } = await parentActions();
    const result = await joinGroupAction(initial, form({ groupId: GROUP_ID, idempotencyKey: KEY }));
    expect(result).toMatchObject({
      state: "success",
      message: "Már tagja vagy ennek a csoportnak.",
    });
  });

  it("leaves with the membership and the version that were on screen", async () => {
    requestWorld.signIn("parent");
    const { leaveGroupAction } = await parentActions();
    const result = await leaveGroupAction(
      initial,
      form({
        groupId: GROUP_ID,
        membershipId: OWN_MEMBERSHIP_ID,
        expectedVersion: "3",
        idempotencyKey: KEY,
      }),
    );
    expect(result).toMatchObject({ state: "success", message: "Kiléptél a munkacsoportból." });
    expect(requestWorld.ports.workingGroups.calls[0]).toEqual({
      name: "leave",
      input: { idempotencyKey: KEY, membershipId: OWN_MEMBERSHIP_ID, expectedVersion: 3 },
    });
  });

  it.each([
    ["a missing group", { idempotencyKey: KEY }],
    ["a group that is not an identifier", { groupId: "../x", idempotencyKey: KEY }],
    ["a missing key", { groupId: GROUP_ID }],
    ["a key that is too short", { groupId: GROUP_ID, idempotencyKey: "short" }],
  ])("refuses %s before the database is asked", async (_name, values) => {
    requestWorld.signIn("parent");
    const { joinGroupAction } = await parentActions();
    expect(await joinGroupAction(initial, form(values))).toMatchObject({ state: "validation" });
    expect(requestWorld.ports.workingGroups.calls).toEqual([]);
  });

  it.each([
    ["no version", {}],
    ["version zero", { expectedVersion: "0" }],
    ["a version that is not a whole number", { expectedVersion: "1.5" }],
    ["a membership that is not an identifier", { membershipId: "nope", expectedVersion: "1" }],
  ])("refuses a leave with %s", async (_name, values) => {
    requestWorld.signIn("parent");
    const { leaveGroupAction } = await parentActions();
    const result = await leaveGroupAction(
      initial,
      form({ membershipId: OWN_MEMBERSHIP_ID, idempotencyKey: KEY, ...values }),
    );
    expect(result).toMatchObject({ state: "validation" });
    expect(requestWorld.ports.workingGroups.calls).toEqual([]);
  });

  it("answers a signed-out visitor with the unavailable-group words and calls nothing", async () => {
    const { joinGroupAction } = await parentActions();
    const result = await joinGroupAction(initial, form({ groupId: GROUP_ID, idempotencyKey: KEY }));
    expect(result).toMatchObject({ state: "denied", message: GROUP_UNAVAILABLE_TEXT });
    expect(requestWorld.ports.workingGroups.calls).toEqual([]);
  });

  it("shows a refused join in words and refreshes nothing", async () => {
    requestWorld.signIn("parent");
    requestWorld.ports.workingGroups.commandOutcome = { state: "denied" };
    const { joinGroupAction } = await parentActions();
    const result = await joinGroupAction(initial, form({ groupId: GROUP_ID, idempotencyKey: KEY }));
    expect(result).toMatchObject({ state: "denied", message: GROUP_UNAVAILABLE_TEXT });
    expect(revalidated).toEqual([]);
  });

  it.each([
    ["VERSION_CONFLICT", "Az oldal közben megváltozott. Frissítsd, és próbáld újra."],
    ["NOT_A_MEMBER", "Már nem vagy tagja ennek a csoportnak."],
    ["SOMETHING_NEW", "A művelet most nem hajtható végre."],
  ])("explains the leave conflict %s without showing the code", async (code, words) => {
    requestWorld.signIn("parent");
    requestWorld.ports.workingGroups.commandOutcome = { state: "conflict", code };
    const { leaveGroupAction } = await parentActions();
    const result = await leaveGroupAction(
      initial,
      form({
        groupId: GROUP_ID,
        membershipId: OWN_MEMBERSHIP_ID,
        expectedVersion: "3",
        idempotencyKey: KEY,
      }),
    );
    expect(result).toMatchObject({ state: "conflict", message: words });
    expect(result.message).not.toContain(code);
  });

  it("lets a super admin appoint and revoke, with each refusal in its own words", async () => {
    requestWorld.signIn("super_admin");
    const { appointCoordinatorAction, revokeCoordinatorAction } = await adminActions();
    const values = form({
      groupId: GROUP_ID,
      membershipId: OTHER_MEMBERSHIP_ID,
      expectedVersion: "2",
      idempotencyKey: KEY,
    });
    expect(await appointCoordinatorAction(initial, values)).toMatchObject({
      state: "success",
      message: "Koordinátor lett.",
    });
    expect(await revokeCoordinatorAction(initial, values)).toMatchObject({
      state: "success",
      message: "A koordinátori jog visszavonva.",
    });
    expect(requestWorld.ports.workingGroups.calls.map((call) => call.name)).toEqual([
      "appoint",
      "revoke",
    ]);
    expect(revalidated).toContain(`/admin/munkacsoportok/${GROUP_ID}`);

    requestWorld.ports.workingGroups.commandOutcome = { state: "conflict", code: "NOT_A_MEMBER" };
    expect(await appointCoordinatorAction(initial, values)).toMatchObject({
      state: "conflict",
      message:
        "Koordinátor csak a csoport tagja lehet. Kérd meg a szülőt, hogy előbb csatlakozzon a csoporthoz.",
    });
    requestWorld.ports.workingGroups.commandOutcome = {
      state: "conflict",
      code: "ACCOUNT_REQUIRED",
    };
    expect(await appointCoordinatorAction(initial, values)).toMatchObject({
      message: "Csak aktív fiókkal rendelkező szülő lehet koordinátor.",
    });
    requestWorld.ports.workingGroups.commandOutcome = {
      state: "conflict",
      code: "NOT_COORDINATOR",
    };
    expect(await revokeCoordinatorAction(initial, values)).toMatchObject({
      message: "Ő már nem koordinátora ennek a csoportnak.",
    });
  });

  it("refuses the coordinator actions for a group admin before the database is asked", async () => {
    requestWorld.signIn("group_admin");
    const { appointCoordinatorAction } = await adminActions();
    const result = await appointCoordinatorAction(
      initial,
      form({
        groupId: GROUP_ID,
        membershipId: OTHER_MEMBERSHIP_ID,
        expectedVersion: "2",
        idempotencyKey: KEY,
      }),
    );
    expect(result.state).toBe("denied");
    expect(requestWorld.ports.workingGroups.calls).toEqual([]);
  });

  it("refuses a bad coordinator request and a signed-out visitor", async () => {
    const { revokeCoordinatorAction } = await adminActions();
    expect(await revokeCoordinatorAction(initial, form({}))).toMatchObject({
      state: "validation",
    });
    const values = form({
      groupId: GROUP_ID,
      membershipId: OTHER_MEMBERSHIP_ID,
      expectedVersion: "2",
      idempotencyKey: KEY,
    });
    expect(await revokeCoordinatorAction(initial, values)).toMatchObject({ state: "denied" });
  });

  it("maps a retryable failure, an outdated page and an unexpected failure", async () => {
    const { mapWorkingGroupResult } = await import("../../app/_lib/working-group-result.ts");
    expect(
      mapWorkingGroupResult(
        "join",
        {
          state: "dependency-failure-retryable",
          code: "X",
          retry: { idempotencyKey: KEY, action: "join" },
        } as ApplicationResult<never>,
        "ok",
      ),
    ).toMatchObject({ state: "retryable", retry: { idempotencyKey: KEY } });
    expect(
      mapWorkingGroupResult(
        "join",
        { state: "invalidated", code: "X" } as ApplicationResult<never>,
        "ok",
      ),
    ).toMatchObject({
      state: "invalidated",
      message: "Az oldal közben megváltozott. Frissítsd, és próbáld újra.",
    });
    expect(
      mapWorkingGroupResult(
        "join",
        { state: "dependency-failure-terminal", code: "X" } as ApplicationResult<never>,
        "ok",
      ),
    ).toMatchObject({ state: "terminal" });
    expect(mapWorkingGroupResult("join", denied(), "ok").message).toBe(GROUP_UNAVAILABLE_TEXT);
    expect(mapWorkingGroupResult("leave", conflict("VERSION_CONFLICT"), "ok").state).toBe(
      "conflict",
    );
  });
});

describe("the three group pages", () => {
  beforeEach(() => requestWorld.reset());

  type Page = (input: { params: Promise<{ id: string }> }) => Promise<ReactNode>;
  const PARENT = async () => (await import("../../app/szulo/munkacsoportok/[id]/page.tsx")).default;
  const TEACHER = async () =>
    (await import("../../app/teacher/munkacsoportok/[id]/page.tsx")).default;
  const ADMIN = async () => (await import("../../app/admin/munkacsoportok/[id]/page.tsx")).default;
  async function html(load: () => Promise<Page>, role: RoleKey): Promise<string> {
    requestWorld.signIn(role);
    const page = await load();
    return renderToStaticMarkup(await page({ params: Promise.resolve({ id: GROUP_ID }) }));
  }

  it("gives a parent who is not a member the join button and nothing else to press", async () => {
    const output = await html(PARENT, "parent");
    expect(output).toContain("Játszókert");
    expect(output).toContain("Csatlakozom");
    expect(output).not.toContain("Kilépek");
    expect(requestWorld.ports.workingGroups.calls).toEqual([{ name: "detail", input: GROUP_ID }]);
  });

  it("gives a member the leave button, and a coordinator the warning only after pressing it", async () => {
    requestWorld.ports.workingGroups.detailOutcome = {
      state: "success",
      data: model({
        ownMembership: { id: OWN_MEMBERSHIP_ID, version: 2 },
        members: [member({ membershipId: OWN_MEMBERSHIP_ID, isSelf: true, isCoordinator: true })],
      }),
    };
    const output = await html(PARENT, "parent");
    expect(output).toContain("Kilépek");
    expect(output).not.toContain("Csatlakozom");
    expect(output).not.toContain("megszűnik a koordinátori jogod");
  });

  it("shows no join or leave to a viewer who has no parent record", async () => {
    requestWorld.ports.workingGroups.detailOutcome = {
      state: "success",
      data: model({ callerIsParent: false }),
    };
    const output = await html(PARENT, "parent");
    expect(output).not.toContain("Csatlakozom");
    expect(output).not.toContain("Kilépek");
  });

  it("shows the teacher the same group with no button", async () => {
    const output = await html(TEACHER, "teacher");
    expect(output).toContain("Játszókert");
    expect(output).toContain("teacher-group-page");
    expect(output).not.toContain("<button");
  });

  it("shows a super admin the coordinator action of each member, and a group admin none", async () => {
    requestWorld.ports.workingGroups.detailOutcome = {
      state: "success",
      data: model({
        members: [
          member({ version: 2 }),
          member({
            membershipId: "dddddddd-0000-4000-8000-000000000003",
            isCoordinator: true,
            version: 5,
          }),
        ],
      }),
    };
    const superAdmin = await html(ADMIN, "super_admin");
    expect(superAdmin).toContain("Koordinátorrá teszem");
    expect(superAdmin).toContain("Visszavonom a jogot");
    expect(superAdmin).toContain(COORDINATOR_MEMBER_NOTE);

    requestWorld.ports.workingGroups.detailOutcome = {
      state: "success",
      data: model({ members: [member()] }),
    };
    const groupAdmin = await html(ADMIN, "group_admin");
    expect(groupAdmin).toContain("Juhar Dóra");
    expect(groupAdmin).not.toContain("<button");
  });

  it("shows the unavailable group to every role when the group is missing", async () => {
    requestWorld.ports.workingGroups.detailOutcome = { state: "denied" };
    for (const [path, role] of [
      [PARENT, "parent"],
      [TEACHER, "teacher"],
      [ADMIN, "super_admin"],
    ] as const) {
      const output = await html(path, role);
      expect(output).toContain(GROUP_UNAVAILABLE_TEXT);
      expect(output).toContain("Vissza a munkacsoportokhoz");
    }
  });

  it("shows the error state, not the unavailable one, when the session cannot be used", async () => {
    requestWorld.setUnavailable(true);
    const output = await html(PARENT, "parent");
    expect(output).toContain("Hiba történt");
    expect(output).not.toContain(GROUP_UNAVAILABLE_TEXT);
  });
});
