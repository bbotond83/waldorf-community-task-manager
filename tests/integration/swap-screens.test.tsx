import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  denied,
  empty,
  retryableFailure,
  success,
  type ApplicationResult,
  type SwapRequestItemModel,
} from "../../src/application/index.ts";
import type { ParentActionState } from "../../app/szulo/_lib/action-state.ts";

const world = vi.hoisted(() => ({
  facade: undefined as Record<string, (...args: unknown[]) => unknown> | undefined,
  sessionState: "success" as "success" | "signed-out",
  submitted: [] as { action: string; data: FormData }[],
  answer: { state: "success", message: "Rendben." } as ParentActionState,
  pending: undefined as Promise<void> | undefined,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/szulo/cserek",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../app/szulo/_lib/facade.ts", () => ({
  resolveParentFacade: async () => world.facade,
}));
vi.mock("../../app/szulo/_lib/session.ts", () => ({
  resolveParentSession: async () =>
    world.sessionState === "success"
      ? {
          state: "success",
          data: {
            applicationSession: { subjectId: "parent" },
            familyScope: { id: "family-1", type: "family", organizationId: "org" },
            familyId: "family-1",
          },
        }
      : { state: "signed-out" },
}));
vi.mock("../../app/szulo/actions.ts", () => {
  const record = (action: string) => async (_state: unknown, data: FormData) => {
    world.submitted.push({ action, data });
    await world.pending;
    return world.answer;
  };
  return {
    requestSwapAction: record("requestSwap"),
    respondToSwapAction: record("respondToSwap"),
    withdrawRequestAction: record("withdrawRequest"),
    requestCancellationAction: record("requestCancellation"),
    signUpAction: record("signUp"),
    markNotificationReadAction: record("markNotificationRead"),
    updateContributionAction: record("updateContribution"),
  };
});

import SwapRequestPage from "../../app/szulo/feladatok/[id]/csere/page.tsx";
import SwapRequestsPage from "../../app/szulo/cserek/page.tsx";
import {
  SwapRequestsBoard,
  type SwapRequestView,
} from "../../app/szulo/_components/SwapRequestsBoard.tsx";

const DUTY = {
  id: "duty-1",
  title: "Kerti előkészítés",
  dueAt: "2026-11-05T08:00:00+00:00",
  location: "Kert",
  state: "assigned",
  version: 4,
  assignmentId: "aaaaaaaa-0000-4000-8000-000000000001",
};

const CANDIDATE_A = {
  assignmentId: "aaaaaaaa-0000-4000-8000-0000000000a1",
  assignmentVersion: 3,
  taskId: "bbbbbbbb-0000-4000-8000-0000000000a1",
  title: "Sütés",
  startsAt: "2026-11-10T09:00:00+00:00",
  familyDisplayName: "Napraforgó család",
};
const CANDIDATE_B = {
  ...CANDIDATE_A,
  assignmentId: "aaaaaaaa-0000-4000-8000-0000000000a2",
  assignmentVersion: 7,
  title: "Takarítás",
  familyDisplayName: "Boróka család",
};

function useFacade(overrides: Record<string, unknown> = {}) {
  world.facade = {
    getDuty: async () => success(DUTY),
    listSwapCandidates: async () => success({ candidates: [CANDIDATE_A, CANDIDATE_B] }),
    listSwapRequests: async () => empty(),
    ...overrides,
  } as typeof world.facade;
}

async function renderSwapPage() {
  const page = await SwapRequestPage({ params: Promise.resolve({ id: "duty-1" }) });
  return render(<>{page}</>);
}

beforeEach(() => {
  world.sessionState = "success";
  world.submitted = [];
  world.answer = { state: "success", message: "Rendben." };
  world.pending = undefined;
  useFacade();
});

describe("the swap request page with a partner list", () => {
  it("lists the partner tasks with title, date and family name as one labelled choice", async () => {
    await renderSwapPage();
    const group = screen.getByRole("group", { name: "Melyik családi feladatra cserélne?" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAccessibleName(/Sütés.*Napraforgó család/);
    expect(radios[1]).toHaveAccessibleName(/Takarítás.*Boróka család/);
    expect(radios[0]).toHaveAttribute("value", `${CANDIDATE_A.assignmentId}:3`);
    expect(radios[1]).toHaveAttribute("value", `${CANDIDATE_B.assignmentId}:7`);
    expect(radios[0]).toHaveAttribute("id", "counterpart");
    expect(screen.getByLabelText("Indoklás")).toBeRequired();
    expect(document.querySelector('input[name="counterpartId"]')).toBeNull();
  });

  it("sends the chosen partner, both versions, the reason and a new key for every attempt", async () => {
    // The first attempt is refused, so the form keeps the choice and the reason for the second.
    world.answer = { state: "conflict", message: "Nem sikerült.", code: "REQUEST_CONFLICT" };
    await renderSwapPage();
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    fireEvent.change(screen.getByLabelText("Indoklás"), { target: { value: "Beteg a gyerek" } });
    fireEvent.submit(screen.getByTestId("swap-request-form"));
    await waitFor(() => expect(world.submitted).toHaveLength(1));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Indoklás")).toHaveValue("Beteg a gyerek");
    expect(screen.getAllByRole("radio")[1]).toBeChecked();
    fireEvent.submit(screen.getByTestId("swap-request-form"));
    await waitFor(() => expect(world.submitted).toHaveLength(2));
    const [first, second] = world.submitted.map((entry) => entry.data);
    for (const data of [first!, second!]) {
      expect(data.get("counterpart")).toBe(`${CANDIDATE_B.assignmentId}:7`);
      expect(data.get("expectedVersion")).toBe("4");
      expect(data.get("assignmentId")).toBe(DUTY.assignmentId);
      expect(data.get("partnerList")).toBe("1");
      expect(String(data.get("idempotencyKey"))).toMatch(/^swap:[0-9a-f]{32}$/);
    }
    expect(first!.get("idempotencyKey")).not.toBe(second!.get("idempotencyKey"));
  });

  it("says plainly when there is no partner and offers no form", async () => {
    useFacade({ listSwapCandidates: async () => empty() });
    await renderSwapPage();
    expect(screen.getByTestId("swap-candidates-empty")).toHaveTextContent(
      "Jelenleg nincs olyan másik családi feladat",
    );
    expect(screen.queryByTestId("swap-request-form")).not.toBeInTheDocument();
  });

  it("announces a partner list that could not be loaded", async () => {
    useFacade({
      listSwapCandidates: async () => retryableFailure({ idempotencyKey: "k", action: "a" }),
    });
    await renderSwapPage();
    expect(screen.getByRole("alert")).toHaveTextContent("A cseretársak listája most nem érhető el");
    expect(screen.queryByTestId("swap-request-form")).not.toBeInTheDocument();
  });

  it("shows the pending notice, not the list, for a request that was sent earlier", async () => {
    const listCandidates = vi.fn(async () => empty());
    useFacade({
      getDuty: async () => success({ ...DUTY, state: "swap-pending" }),
      listSwapCandidates: listCandidates,
    });
    await renderSwapPage();
    expect(screen.getByTestId("swap-pending-panel")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByTestId("swap-candidates-empty")).not.toBeInTheDocument();
  });

  it("always asks the database for the partner list and has no fixed partner field", async () => {
    const listCandidates = vi.fn(async () => success({ candidates: [CANDIDATE_A] }));
    useFacade({ listSwapCandidates: listCandidates });
    await renderSwapPage();
    expect(listCandidates).toHaveBeenCalledTimes(1);
    expect(document.querySelector('input[name="counterpartId"]')).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(1);
  });

  it("says there is nothing to swap for a task the family has no place on", async () => {
    useFacade({ getDuty: async () => success({ ...DUTY, assignmentId: undefined }) });
    await renderSwapPage();
    expect(screen.getByTestId("swap-ineligible-state")).toBeInTheDocument();
  });
});

const INCOMING: SwapRequestView = {
  id: "11111111-0000-4000-8000-000000000001",
  kind: "swap",
  direction: "incoming",
  version: 2,
  ownTaskTitle: "Kerti előkészítés",
  ownTaskStartsAt: "2026-11-05T08:00:00+00:00",
  partnerTaskTitle: "Sütés",
  partnerTaskStartsAt: "2026-11-10T09:00:00+00:00",
  partnerFamilyName: "Napraforgó család",
  ownWhen: "2026. november 5. 09:00",
  partnerWhen: "2026. november 10. 10:00",
};
const OUTGOING_SWAP: SwapRequestView = {
  ...INCOMING,
  id: "11111111-0000-4000-8000-000000000002",
  direction: "outgoing",
  version: 3,
};
const OUTGOING_CANCELLATION: SwapRequestView = {
  id: "11111111-0000-4000-8000-000000000003",
  kind: "cancellation",
  direction: "outgoing",
  version: 1,
  ownTaskTitle: "Takarítás",
  ownTaskStartsAt: "2026-11-12T08:00:00+00:00",
  ownWhen: "2026. november 12. 09:00",
};

describe("the incoming swaps board", () => {
  it("names the partner task on Confirm and Decline and the own task on Withdraw", () => {
    render(
      <SwapRequestsBoard incoming={[INCOMING]} outgoing={[OUTGOING_SWAP, OUTGOING_CANCELLATION]} />,
    );
    expect(
      screen.getByRole("button", { name: "Megerősítés: Sütés, 2026. november 10. 10:00" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Elutasítás: Sütés, 2026. november 10. 10:00" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Visszavonás: Cserekérelem, Kerti előkészítés" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Visszavonás: Lemondási kérelem, Takarítás" }),
    ).toBeEnabled();
    expect(screen.getByText("Napraforgó család cserét kér")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Saját nyitott kérelmek" })).toBeVisible();
  });

  it("confirms with the request and its version and announces the result", async () => {
    world.answer = { state: "success", message: "A csere megtörtént." };
    render(<SwapRequestsBoard incoming={[INCOMING]} outgoing={[]} />);
    fireEvent.click(screen.getByTestId(`swap-confirm-${INCOMING.id}`));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("A csere megtörtént."),
    );
    const data = world.submitted[0]!.data;
    expect(world.submitted[0]!.action).toBe("respondToSwap");
    expect(data.get("id")).toBe(INCOMING.id);
    expect(data.get("expectedVersion")).toBe("2");
    expect(String(data.get("idempotencyKey"))).toMatch(/^respond:[0-9a-f]{32}$/);
  });

  it("declines with its own decision value", async () => {
    render(<SwapRequestsBoard incoming={[INCOMING]} outgoing={[]} />);
    fireEvent.click(screen.getByTestId(`swap-decline-${INCOMING.id}`));
    await waitFor(() => expect(world.submitted).toHaveLength(1));
    expect(world.submitted[0]!.data.get("decision")).toBe("decline");
  });

  it("withdraws a cancellation request with its kind and a new key each time", async () => {
    world.answer = {
      state: "conflict",
      message: "Már nem nyitott.",
      code: "SWAP_REQUEST_NOT_OPEN",
    };
    render(<SwapRequestsBoard incoming={[]} outgoing={[OUTGOING_CANCELLATION]} />);
    const button = screen.getByTestId(`swap-withdraw-${OUTGOING_CANCELLATION.id}`);
    fireEvent.click(button);
    await waitFor(() => expect(world.submitted).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Már nem nyitott."));
    fireEvent.click(button);
    await waitFor(() => expect(world.submitted).toHaveLength(2));
    const [first, second] = world.submitted.map((entry) => entry.data);
    expect(first!.get("kind")).toBe("cancellation");
    expect(first!.get("id")).toBe(OUTGOING_CANCELLATION.id);
    expect(first!.get("idempotencyKey")).not.toBe(second!.get("idempotencyKey"));
    expect(String(first!.get("idempotencyKey"))).toMatch(/^withdraw:/);
  });

  it("moves focus to the announced error and lists field messages", async () => {
    world.answer = {
      state: "validation",
      message: "Ellenőrizze a megadott adatokat.",
      fieldErrors: { decision: "Válasszon: megerősítés vagy elutasítás." },
    };
    render(<SwapRequestsBoard incoming={[INCOMING]} outgoing={[]} />);
    fireEvent.click(screen.getByTestId(`swap-confirm-${INCOMING.id}`));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Válasszon: megerősítés vagy elutasítás.");
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it("keeps the result visible after the answered request leaves the list", async () => {
    world.answer = { state: "success", message: "A kérelmet visszavonta." };
    const { rerender } = render(<SwapRequestsBoard incoming={[]} outgoing={[OUTGOING_SWAP]} />);
    fireEvent.click(screen.getByTestId(`swap-withdraw-${OUTGOING_SWAP.id}`));
    await screen.findByRole("status");
    rerender(<SwapRequestsBoard incoming={[]} outgoing={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("A kérelmet visszavonta.");
    expect(screen.getByTestId("swap-outgoing-empty")).toBeInTheDocument();
  });

  it("disables both answer buttons while the answer is being sent", async () => {
    let release: () => void = () => undefined;
    world.pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    render(<SwapRequestsBoard incoming={[INCOMING]} outgoing={[]} />);
    fireEvent.click(screen.getByTestId(`swap-confirm-${INCOMING.id}`));
    await waitFor(() => expect(screen.getByTestId(`swap-decline-${INCOMING.id}`)).toBeDisabled());
    expect(screen.getByTestId(`swap-confirm-${INCOMING.id}`)).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(screen.getByTestId(`swap-decline-${INCOMING.id}`)).toBeEnabled());
  });

  it("says in each section when there is nothing to answer or withdraw", () => {
    render(<SwapRequestsBoard incoming={[]} outgoing={[]} />);
    expect(screen.getByTestId("swap-incoming-empty")).toHaveTextContent(
      "egy másik család sem kért cserét",
    );
    expect(screen.getByTestId("swap-outgoing-empty")).toHaveTextContent("nincs nyitott kérelmük");
  });
});

describe("the incoming swaps page", () => {
  const ITEMS: SwapRequestItemModel[] = [INCOMING, OUTGOING_SWAP, OUTGOING_CANCELLATION];

  async function renderPage() {
    const page = await SwapRequestsPage();
    return render(<>{page}</>);
  }

  it("splits the open requests into the ones addressed to the family and its own", async () => {
    useFacade({ listSwapRequests: async () => success({ requests: ITEMS }) });
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cserék és kérelmek");
    expect(within(screen.getByTestId("swap-incoming-list")).getAllByRole("listitem")).toHaveLength(
      1,
    );
    expect(within(screen.getByTestId("swap-outgoing-list")).getAllByRole("listitem")).toHaveLength(
      2,
    );
    expect(screen.getByTestId("swap-requests-tasks-link")).toHaveAttribute(
      "href",
      "/szulo/feladatok",
    );
    // The dates are written in Budapest time for the screen.
    expect(screen.getAllByText(/2026\. november 10\./).length).toBeGreaterThan(0);
  });

  it("shows the empty state with a way back when nothing is open", async () => {
    await renderPage();
    expect(screen.getByTestId("swap-requests-empty")).toHaveTextContent(
      "Jelenleg nincs nyitott cserekérelem.",
    );
    expect(screen.getByTestId("swap-requests-tasks-link")).toBeVisible();
  });

  it("shows no content for a signed-out person and a safe message when access is denied", async () => {
    world.sessionState = "signed-out";
    expect(await SwapRequestsPage()).toBeNull();
    world.sessionState = "success";
    useFacade({ listSwapRequests: async () => denied() as ApplicationResult<never> });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("A kért tartalom nem érhető el.");
  });
});
