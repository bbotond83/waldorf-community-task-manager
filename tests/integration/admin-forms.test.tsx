import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { success, type AdminItemModel } from "../../src/application/index.ts";
import type { AdminActionState } from "../../app/admin/actions.ts";
import type { AdminLookups } from "../../app/admin/_lib/lookups.ts";

const world = vi.hoisted(() => ({
  production: true,
  submitted: [] as { action: string; data: FormData }[],
  answer: { state: "success", message: "Mentve." } as AdminActionState,
  lookups: undefined as AdminLookups | undefined,
  items: [] as AdminItemModel[],
  record: undefined as AdminItemModel | undefined,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../app/_identity/production-request.ts", () => ({
  isProductionMode: async () => world.production,
  productionRequest: async () => ({ state: "not-production" }),
}));
vi.mock("../../app/admin/_lib/request-lookups.ts", () => ({
  resolveAdminLookups: async () =>
    world.lookups ?? { schoolYears: [], groups: [], families: [], events: [] },
}));
vi.mock("../../app/admin/_lib/facade.ts", () => ({
  resolveAdminFacade: async () => ({
    listTasks: async () => success({ items: world.items }),
    getRecord: async () => success(world.record),
  }),
}));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () => ({
    state: "success",
    data: { applicationSession: { subjectId: "admin" }, scope: { id: "org" } },
  }),
}));
vi.mock("../../app/admin/actions.ts", () => {
  const record = (action: string) => async (_state: unknown, data: FormData) => {
    world.submitted.push({ action, data });
    return world.answer;
  };
  return {
    saveRecordAction: record("saveRecord"),
    archiveRecordAction: record("archiveRecord"),
    saveTaskAction: record("saveTask"),
    assignTaskAction: record("assignTask"),
    saveEventNotesAction: record("saveEventNotes"),
  };
});

import NewRecordPage from "../../app/admin/nyilvantartasok/uj/page.tsx";
import RecordDetailPage from "../../app/admin/nyilvantartasok/[id]/page.tsx";
import NewTaskPage from "../../app/admin/feladatok/uj/page.tsx";
import TaskDetailPage from "../../app/admin/feladatok/[id]/page.tsx";
import { RecordFields } from "../../app/admin/_components/RecordFields.tsx";
import { TaskFields } from "../../app/admin/_components/TaskFields.tsx";
import {
  AdminCheckboxField,
  AdminMutationForm,
  AdminSelectField,
  AdminTextareaField,
  AdminTextField,
} from "../../app/admin/_components/AdminMutationForm.tsx";
import { saveRecordAction, saveTaskAction } from "../../app/admin/actions.ts";

const LOOKUPS: AdminLookups = {
  schoolYears: [{ value: "y-1", label: "2026/2027" }],
  groups: [
    { value: "g-1", label: "Boróka" },
    { value: "g-2", label: "Napraforgó" },
  ],
  families: [
    { value: "f-1", label: "Fenyő család" },
    { value: "f-2", label: "Diófa család" },
  ],
  events: [
    { value: "e-1", label: "Őszi ünnep", groupId: "g-1" },
    { value: "e-2", label: "Karácsony", groupId: "g-2" },
  ],
};

beforeEach(() => {
  world.production = true;
  world.submitted = [];
  world.answer = { state: "success", message: "Mentve." };
  world.lookups = LOOKUPS;
  world.items = [];
  world.record = undefined;
});

function Form({ children, ...props }: { children: React.ReactNode; clearOnSuccess?: boolean }) {
  return (
    <AdminMutationForm
      action={saveRecordAction}
      submitLabel="Mentés"
      testId="test-form"
      longForm
      {...props}
    >
      <input type="hidden" name="id" value="new" />
      <input type="hidden" name="idempotencyKey" value="record:create:0123456789" />
      {children}
    </AdminMutationForm>
  );
}

describe("the record form on the create page", () => {
  it("starts as a family with its group and two parent blocks, all fields labelled", () => {
    render(
      <Form>
        <RecordFields mode="create" lookups={LOOKUPS} />
      </Form>,
    );
    expect(screen.getByLabelText("Elem típusa")).toHaveValue("family");
    expect(screen.getByLabelText("A család neve")).toBeInTheDocument();
    const group = screen.getByLabelText("Csoport");
    expect(group).toBeRequired();
    expect(
      within(group)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Válasszon csoportot", "Boróka", "Napraforgó"]);
    const blocks = screen.getAllByRole("group", { name: /^Szülő \d \(új\)$/ });
    expect(blocks).toHaveLength(2);
    const first = within(blocks[0]!);
    for (const label of [
      "A szülő neve",
      "E-mail-cím",
      "Telefonszám",
      "Település",
      "Önkéntes bemutatkozás",
      "A szülő hozzájárult a bemutatkozás tárolásához",
    ]) {
      expect(first.getByLabelText(label)).toBeInTheDocument();
    }
    expect(first.getByLabelText("E-mail-cím")).toHaveAttribute("type", "email");
    expect(first.getByLabelText("Telefonszám")).toHaveAttribute("type", "tel");
    expect(document.querySelector('input[name="extended"]')).toHaveValue("1");
  });

  it("shows the fields of each kind of record the dropdown offers", () => {
    render(
      <Form>
        <RecordFields mode="create" lookups={LOOKUPS} />
      </Form>,
    );
    const kind = screen.getByLabelText("Elem típusa");
    fireEvent.change(kind, { target: { value: "child" } });
    expect(screen.getByLabelText("A gyermek neve")).toBeInTheDocument();
    expect(screen.getByLabelText("Család")).toBeRequired();
    expect(screen.queryByLabelText("A szülő neve")).not.toBeInTheDocument();

    fireEvent.change(kind, { target: { value: "group" } });
    expect(screen.getByLabelText("A csoport neve")).toBeInTheDocument();
    expect(screen.getByLabelText("Nevelési év")).toBeRequired();
    expect(screen.getByText("A csoport nevelési éve később nem módosítható.")).toBeVisible();

    fireEvent.change(kind, { target: { value: "school-year" } });
    expect(screen.getByLabelText("A nevelési év megnevezése")).toBeInTheDocument();
    expect(screen.getByLabelText("Első nap")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Utolsó nap")).toHaveAttribute("type", "date");
  });

  it("sends what was typed with a new key and keeps it when the server refuses", async () => {
    world.answer = {
      state: "validation",
      message: "Ellenőrizze a megadott adatokat.",
      fieldErrors: { "parent-0-email": "Adjon meg érvényes e-mail-címet." },
    };
    render(
      <Form>
        <RecordFields mode="create" lookups={LOOKUPS} />
      </Form>,
    );
    fireEvent.change(screen.getByLabelText("A család neve"), { target: { value: "Fenyő" } });
    fireEvent.change(screen.getByLabelText("Csoport"), { target: { value: "g-2" } });
    const block = within(screen.getByTestId("admin-parent-block-0"));
    fireEvent.change(block.getByLabelText("A szülő neve"), { target: { value: "Anna" } });
    fireEvent.change(block.getByLabelText("E-mail-cím"), { target: { value: "rossz" } });
    fireEvent.submit(screen.getByTestId("test-form"));
    await waitFor(() => expect(world.submitted).toHaveLength(1));
    const summary = await screen.findByRole("alert");
    expect(
      within(summary).getByRole("link", { name: "Adjon meg érvényes e-mail-címet." }),
    ).toHaveAttribute("href", "#parent-0-email");
    // The mistyped value stays, and the field it belongs to is marked and explained.
    const email = block.getByLabelText("E-mail-cím");
    expect(email).toHaveValue("rossz");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Adjon meg érvényes e-mail-címet.");
    expect(screen.getByLabelText("A család neve")).toHaveValue("Fenyő");
    expect(screen.getByLabelText("Csoport")).toHaveValue("g-2");

    fireEvent.submit(screen.getByTestId("test-form"));
    await waitFor(() => expect(world.submitted).toHaveLength(2));
    const [first, second] = world.submitted.map((entry) => entry.data);
    expect(first!.get("title")).toBe("Fenyő");
    expect(first!.get("addGroupId")).toBe("g-2");
    expect(first!.get("parent-0-name")).toBe("Anna");
    expect(String(first!.get("idempotencyKey"))).toMatch(/^record:[0-9a-f]{32}$/);
    expect(first!.get("idempotencyKey")).not.toBe(second!.get("idempotencyKey"));
  });

  it("clears a created record's fields after it was saved", async () => {
    render(
      <Form clearOnSuccess>
        <RecordFields mode="create" lookups={LOOKUPS} />
      </Form>,
    );
    fireEvent.change(screen.getByLabelText("A család neve"), { target: { value: "Fenyő" } });
    fireEvent.submit(screen.getByTestId("test-form"));
    await screen.findByRole("status");
    await waitFor(() => expect(screen.getByLabelText("A család neve")).toHaveValue(""));
  });
});

describe("the record form on the edit page", () => {
  const FAMILY_DETAILS = {
    parents: [
      {
        id: "p-1",
        version: 4,
        displayName: "Fenyő Anna",
        email: "anna@example.test",
        phone: "+36 30 111 2222",
        locality: "Pécs",
        optionalProfile: "Kertész vagyok.",
        optionalProfileConsent: true,
        linked: true,
      },
      {
        id: "p-2",
        version: 1,
        displayName: "Fenyő Béla",
        optionalProfileConsent: false,
        linked: false,
      },
    ],
    groups: [{ id: "g-1", name: "Boróka" }],
  };

  it("shows a family's parents with their details, the consent and an empty block for a new one", () => {
    render(
      <Form>
        <RecordFields
          mode="edit"
          kind="family"
          title="Fenyő család"
          details={FAMILY_DETAILS}
          lookups={LOOKUPS}
        />
      </Form>,
    );
    expect(screen.getByLabelText("A család neve")).toHaveValue("Fenyő család");
    expect(document.querySelector('input[name="kind"]')).toHaveValue("family");
    const first = within(screen.getByTestId("admin-parent-block-0"));
    expect(first.getByLabelText("A szülő neve")).toHaveValue("Fenyő Anna");
    expect(first.getByLabelText("E-mail-cím")).toHaveValue("anna@example.test");
    expect(first.getByLabelText("Telefonszám")).toHaveValue("+36 30 111 2222");
    expect(first.getByLabelText("Település")).toHaveValue("Pécs");
    expect(first.getByLabelText("Önkéntes bemutatkozás")).toHaveValue("Kertész vagyok.");
    expect(first.getByLabelText("A szülő hozzájárult a bemutatkozás tárolásához")).toBeChecked();
    expect(first.getByTestId("admin-parent-0-linked")).toHaveTextContent("bejelentkezési fiók");
    const second = within(screen.getByTestId("admin-parent-block-1"));
    expect(
      second.getByLabelText("A szülő hozzájárult a bemutatkozás tárolásához"),
    ).not.toBeChecked();
    expect(second.queryByTestId("admin-parent-1-linked")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Szülő 3 (új)" })).toBeInTheDocument();
    expect(document.querySelector('input[name="parent-0-id"]') as HTMLInputElement).toHaveValue(
      "p-1",
    );
    expect(document.querySelector('input[name="parent-0-version"]')).toHaveValue("4");
  });

  it("offers to end a membership and to add only a group the family is not in", () => {
    render(
      <Form>
        <RecordFields mode="edit" kind="family" details={FAMILY_DETAILS} lookups={LOOKUPS} />
      </Form>,
    );
    const ending = screen.getByLabelText("Tagság megszüntetése: Boróka");
    expect(ending).toHaveAttribute("name", "endGroupIds");
    expect(ending).toHaveAttribute("value", "g-1");
    const add = screen.getByLabelText("Csoporttagság hozzáadása");
    expect(add).not.toBeRequired();
    expect(
      within(add)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Nincs hozzáadás", "Napraforgó"]);
  });

  it("shows a school year's days, and a group or child without a year or family to change", () => {
    const { unmount } = render(
      <Form>
        <RecordFields
          mode="edit"
          kind="school-year"
          title="2026/2027"
          details={{ startsOn: "2026-09-01", endsOn: "2027-06-30" }}
          lookups={LOOKUPS}
        />
      </Form>,
    );
    expect(screen.getByLabelText("Első nap")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Utolsó nap")).toHaveValue("2027-06-30");
    unmount();
    const group = render(
      <Form>
        <RecordFields mode="edit" kind="group" title="Boróka" lookups={LOOKUPS} />
      </Form>,
    );
    expect(screen.getByLabelText("A csoport neve")).toHaveValue("Boróka");
    expect(screen.queryByLabelText("Nevelési év")).not.toBeInTheDocument();
    group.unmount();
    render(
      <Form>
        <RecordFields mode="edit" kind="child" title="Gergő" lookups={LOOKUPS} />
      </Form>,
    );
    expect(screen.getByLabelText("A gyermek neve")).toHaveValue("Gergő");
    expect(screen.queryByLabelText("Család")).not.toBeInTheDocument();
  });
});

describe("the field components of the admin forms", () => {
  function Fields() {
    return (
      <AdminMutationForm action={saveRecordAction} submitLabel="Mentés" testId="fields-form">
        <AdminTextField id="a" name="a" label="Szöveg" hint="Segítség" testId="text" />
        <AdminSelectField
          id="b"
          name="b"
          label="Választó"
          hint="Válasszon"
          options={[{ value: "1", label: "Egy" }]}
          placeholder="Válasszon"
          testId="select"
        />
        <AdminTextareaField id="c" name="c" label="Hosszú" hint="Írjon" testId="area" />
        <AdminCheckboxField id="d" name="d" label="Jelölés" hint="Tudnivaló" testId="check" />
      </AdminMutationForm>
    );
  }

  it("reads the hint with the label and, after a refusal, the error with the hint", async () => {
    world.answer = {
      state: "validation",
      message: "Ellenőrizze a megadott adatokat.",
      fieldErrors: {
        a: "Hibás szöveg.",
        b: "Hibás választás.",
        c: "Hibás hosszú.",
        d: "Hibás jelölés.",
      },
    };
    render(<Fields />);
    for (const [testId, hint] of [
      ["text", "Segítség"],
      ["select", "Válasszon"],
      ["area", "Írjon"],
      ["check", "Tudnivaló"],
    ] as const) {
      expect(screen.getByTestId(testId)).toHaveAccessibleDescription(hint);
      expect(screen.getByTestId(testId)).not.toHaveAttribute("aria-invalid");
    }
    fireEvent.submit(screen.getByTestId("fields-form"));
    await screen.findByRole("alert");
    for (const [testId, hint, error] of [
      ["text", "Segítség", "Hibás szöveg."],
      ["select", "Válasszon", "Hibás választás."],
      ["area", "Írjon", "Hibás hosszú."],
      ["check", "Tudnivaló", "Hibás jelölés."],
    ] as const) {
      expect(screen.getByTestId(testId)).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByTestId(testId)).toHaveAccessibleDescription(`${hint} ${error}`);
      expect(screen.getByTestId(`${testId}-error`)).toHaveTextContent(error);
    }
  });
});

describe("the task and event form", () => {
  it("offers the fields of a task and follows the group for the events", () => {
    render(
      <AdminMutationForm action={saveTaskAction} submitLabel="Mentés" testId="task-form" longForm>
        <TaskFields mode="create" lookups={LOOKUPS} />
      </AdminMutationForm>,
    );
    expect(screen.getByLabelText("Típus")).toHaveValue("task");
    for (const label of [
      "Megnevezés",
      "Csoport",
      "Esemény",
      "Kategória",
      "Férőhelyek száma",
      "Kezdés (budapesti idő)",
      "Befejezés (budapesti idő)",
      "Helyszín",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Kategória")).toHaveValue("általános");
    expect(screen.getByLabelText("Kezdés (budapesti idő)")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(screen.getByLabelText("Férőhelyek száma")).toHaveAttribute("min", "1");
    expect(screen.getByLabelText("Férőhelyek száma")).toHaveAttribute("max", "50");
    const events = screen.getByLabelText("Esemény");
    expect(within(events).getAllByRole("option")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Csoport"), { target: { value: "g-1" } });
    expect(
      within(events)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Nem tartozik eseményhez", "Őszi ünnep"]);
    expect(screen.queryByLabelText("Állapot")).not.toBeInTheDocument();
  });

  it("switches to the fields of an event", () => {
    render(
      <AdminMutationForm action={saveTaskAction} submitLabel="Mentés" testId="task-form" longForm>
        <TaskFields mode="create" lookups={LOOKUPS} />
      </AdminMutationForm>,
    );
    fireEvent.change(screen.getByLabelText("Típus"), { target: { value: "event" } });
    expect(screen.getByLabelText("Koordinátor neve")).toBeInTheDocument();
    expect(screen.queryByLabelText("Férőhelyek száma")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Esemény")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Helyszín")).not.toBeRequired();
  });

  it("shows a stored task in Budapest time with its status, and a closed task as Lezárva", () => {
    render(
      <AdminMutationForm action={saveTaskAction} submitLabel="Mentés" testId="task-form" longForm>
        <TaskFields
          mode="edit"
          kind="task"
          title="Sütés"
          state="closed"
          details={{
            groupId: "g-1",
            eventId: "e-1",
            category: "sütés",
            capacity: 3,
            startsAt: "2026-11-05T08:00:00+00:00",
            endsAt: "2026-11-05T10:30:00+00:00",
            location: "Konyha",
          }}
          lookups={LOOKUPS}
        />
      </AdminMutationForm>,
    );
    expect(screen.getByLabelText("Megnevezés")).toHaveValue("Sütés");
    expect(screen.getByLabelText("Csoport")).toHaveValue("g-1");
    expect(screen.getByLabelText("Esemény")).toHaveValue("e-1");
    expect(screen.getByLabelText("Férőhelyek száma")).toHaveValue(3);
    expect(screen.getByLabelText("Kezdés (budapesti idő)")).toHaveValue("2026-11-05T09:00");
    expect(screen.getByLabelText("Befejezés (budapesti idő)")).toHaveValue("2026-11-05T11:30");
    const status = screen.getByLabelText("Állapot");
    expect(status).toHaveValue("closed");
    expect(
      within(status)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Nyitott", "Lezárva", "Törölve"]);
    expect(document.querySelector('input[name="kind"]')).toHaveValue("task");
  });

  it("maps the shown state of an event to its stored status", () => {
    const statusOf = (kind: "task" | "event", state: string) => {
      const view = render(
        <AdminMutationForm action={saveTaskAction} submitLabel="Mentés" testId="task-form" longForm>
          <TaskFields mode="edit" kind={kind} state={state} lookups={LOOKUPS} />
        </AdminMutationForm>,
      );
      const value = (screen.getByLabelText("Állapot") as HTMLSelectElement).value;
      view.unmount();
      return value;
    };
    expect(statusOf("event", "scheduled")).toBe("planned");
    expect(statusOf("event", "cancelled")).toBe("cancelled");
    expect(statusOf("task", "something")).toBe("open");
    expect(statusOf("task", "cancelled")).toBe("cancelled");
    render(
      <AdminMutationForm action={saveTaskAction} submitLabel="Mentés" testId="task-form" longForm>
        <TaskFields mode="edit" kind="event" state="scheduled" lookups={LOOKUPS} />
      </AdminMutationForm>,
    );
    expect(screen.getByText("Egy törölt esemény nyitott feladatai lezárulnak.")).toBeVisible();
  });
});

async function renderNode(node: Promise<React.ReactNode>) {
  return render(<>{await node}</>);
}

describe("the admin pages with real data", () => {
  it("builds the create pages from the extended fields in the production mode", async () => {
    await renderNode(NewRecordPage());
    expect(screen.getByLabelText("Elem típusa")).toBeInTheDocument();
    expect(screen.getByLabelText("A család neve")).toBeInTheDocument();
    expect(screen.getByTestId("admin-record-create-form")).toBeInTheDocument();
  });

  it("keeps the one-field create pages in the synthetic mode", async () => {
    world.production = false;
    const record = await renderNode(NewRecordPage());
    expect(screen.getByLabelText("Megnevezés")).toBeInTheDocument();
    expect(screen.queryByLabelText("Csoport")).not.toBeInTheDocument();
    expect(document.querySelector('input[name="extended"]')).toBeNull();
    record.unmount();
    await renderNode(NewTaskPage());
    expect(screen.getByLabelText("Megnevezés")).toBeInTheDocument();
    expect(screen.queryByLabelText("Férőhelyek száma")).not.toBeInTheDocument();
  });

  it("builds the task create page from the extended fields in the production mode", async () => {
    await renderNode(NewTaskPage());
    expect(screen.getByLabelText("Férőhelyek száma")).toBeInTheDocument();
  });

  it("edits a record by its kind and falls back to the one field for a record of unknown kind", async () => {
    world.record = {
      id: "f-1",
      title: "Fenyő család",
      state: "active",
      version: 3,
      kind: "family",
      details: { parents: [], groups: [] },
    };
    await renderNode(
      RecordDetailPage({
        params: Promise.resolve({ id: "f-1" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByLabelText("A család neve")).toHaveValue("Fenyő család");
    expect(screen.getByTestId("admin-record-archive-form")).toBeInTheDocument();
  });

  it("keeps the one-field edit form for a record without a kind", async () => {
    world.record = { id: "f-1", title: "Fenyő család", state: "active", version: 3 };
    await renderNode(
      RecordDetailPage({
        params: Promise.resolve({ id: "f-1" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByLabelText("Megnevezés")).toHaveValue("Fenyő család");
    expect(document.querySelector('input[name="kind"]')).toHaveValue("record");
  });

  const TASK: AdminItemModel = {
    id: "t-1",
    title: "Sütés",
    state: "open",
    version: 2,
    kind: "task",
    details: { groupId: "g-1", capacity: 3, startsAt: "2026-11-05T08:00:00+00:00" },
  };
  const EVENT: AdminItemModel = {
    id: "e-1",
    title: "Őszi ünnep",
    state: "scheduled",
    version: 5,
    kind: "event",
    details: {
      groupId: "g-1",
      allergenNote: "Dió nélkül",
      supplyNote: "Terítők",
      foodNote: "Sütemény",
    },
  };

  async function detail(item: AdminItemModel) {
    world.items = [item];
    return renderNode(
      TaskDetailPage({
        params: Promise.resolve({ id: item.id }),
        searchParams: Promise.resolve({}),
      }),
    );
  }

  it("shows a task with its fields and an assignment form with a family selector", async () => {
    await detail(TASK);
    expect(screen.getByLabelText("Férőhelyek száma")).toHaveValue(3);
    const family = screen.getByLabelText("Család");
    expect(family).toBeRequired();
    expect(
      within(family)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Válasszon családot", "Fenyő család", "Diófa család"]);
    expect(document.querySelector('input[name="familySelector"]')).toHaveValue("1");
    expect(screen.queryByTestId("admin-event-notes-form")).not.toBeInTheDocument();
  });

  it("keeps the family chosen when the assignment is refused and sends a new key each time", async () => {
    await detail(TASK);
    world.answer = {
      state: "conflict",
      message: "A kiválasztott résztvevő nem jogosult erre a feladatra.",
      code: "ASSIGNMENT_INELIGIBLE",
    };
    fireEvent.change(screen.getByLabelText("Család"), { target: { value: "f-2" } });
    fireEvent.submit(screen.getByTestId("admin-assignment-form"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Család")).toHaveValue("f-2");
    fireEvent.submit(screen.getByTestId("admin-assignment-form"));
    await waitFor(() => expect(world.submitted).toHaveLength(2));
    expect(world.submitted[0]!.data.get("familyId")).toBe("f-2");
    expect(world.submitted[0]!.data.get("idempotencyKey")).not.toBe(
      world.submitted[1]!.data.get("idempotencyKey"),
    );
  });

  it("shows an event with its three notes filled in, errors tied to their note, and no assignment", async () => {
    await detail(EVENT);
    expect(screen.getByLabelText("Allergénnel kapcsolatos adminisztrátori megjegyzés")).toHaveValue(
      "Dió nélkül",
    );
    expect(screen.getByLabelText("Eszközigény")).toHaveValue("Terítők");
    expect(screen.getByLabelText("Ételhez kapcsolódó megjegyzés")).toHaveValue("Sütemény");
    expect(screen.queryByTestId("admin-assignment-form")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Koordinátor neve")).toBeInTheDocument();
    world.answer = {
      state: "validation",
      message: "Ellenőrizze a megadott adatokat.",
      fieldErrors: { supplyNote: "A megjegyzés legfeljebb 300 karakter lehet." },
    };
    fireEvent.submit(screen.getByTestId("admin-event-notes-form"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Eszközigény")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Eszközigény")).toHaveAccessibleDescription(
      "A megjegyzés legfeljebb 300 karakter lehet.",
    );
    // What was typed stays for the next try.
    expect(screen.getByLabelText("Eszközigény")).toHaveValue("Terítők");
  });

  it("keeps the old task detail page for an item without a kind", async () => {
    await detail({ id: "t-1", title: "Sütés", state: "open", version: 2 });
    expect(screen.getByTestId("admin-assignment-form")).toBeInTheDocument();
    expect(screen.queryByLabelText("Család")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Megnevezés")).toHaveValue("Sütés");
    expect(document.querySelector('input[name="kind"]')).toHaveValue("task");
  });
});
