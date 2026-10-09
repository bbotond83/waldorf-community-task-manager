import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminAccessState } from "../../app/admin/_components/AdminAccessState.tsx";
import { AdminFilterBar } from "../../app/admin/_components/AdminFilterBar.tsx";
import { AdminPagination } from "../../app/admin/_components/AdminPagination.tsx";
import { AdminBackLink, listReturnQuery } from "../../app/admin/_components/AdminBackLink.tsx";
import { DeveloperDetails } from "../../app/admin/_components/DeveloperDetails.tsx";
import {
  AdminMutationForm,
  AdminTextField,
} from "../../app/admin/_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../app/admin/_components/AsyncStatePanel.tsx";
import { ResponsiveCollection } from "../../app/admin/_components/ResponsiveCollection.tsx";
import {
  conflict,
  denied,
  empty,
  retryableFailure,
  success,
  terminalFailure,
  validation,
} from "../../src/application/index.ts";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("AsyncStatePanel", () => {
  it("renders authorized success data", () => {
    render(
      <AsyncStatePanel result={success({ count: 3 })} testId="panel" emptyMessage="Üres">
        {(data) => <span>{data.count}</span>}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel")).toHaveTextContent("3");
  });

  it("renders empty and denied without data", () => {
    const { rerender } = render(
      <AsyncStatePanel result={empty()} testId="panel" emptyMessage="Nincs adat">
        {() => <span>védett</span>}
      </AsyncStatePanel>,
    );
    expect(screen.getByText("Nincs adat")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={denied()} testId="panel" emptyMessage="Nincs adat">
        {() => <span>védett</span>}
      </AsyncStatePanel>,
    );
    expect(screen.getByText("Nincs jogosultság")).toBeInTheDocument();
    expect(screen.queryByText("védett")).not.toBeInTheDocument();
  });

  it("distinguishes validation, conflict, retryable, and terminal failures", () => {
    const states = [
      validation({ title: "required" }),
      conflict(),
      retryableFailure({ idempotencyKey: "retry:key:1", action: "save" }),
      terminalFailure(),
    ];
    const { rerender } = render(
      <AsyncStatePanel result={states[0]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-validation")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={states[1]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-conflict")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={states[2]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-retryable")).toBeInTheDocument();
    rerender(
      <AsyncStatePanel result={states[3]!} testId="panel" emptyMessage="Üres">
        {() => null}
      </AsyncStatePanel>,
    );
    expect(screen.getByTestId("panel-terminal")).toBeInTheDocument();
  });
});

describe("administrator shared presentation", () => {
  it("renders stable collection links and states", () => {
    render(
      <ResponsiveCollection
        items={[{ id: "family-feny", title: "Fenyő család", state: "active", version: 1 }]}
        basePath="/admin/nyilvantartasok"
        testId="records"
      />,
    );
    expect(screen.getByTestId("records-item-family-feny")).toHaveTextContent("Aktív");
    expect(screen.getByTestId("records-item-family-feny")).not.toHaveTextContent("active");
    // The symbol is a decorative icon: hidden from assistive technology, the word stays.
    const icon = screen
      .getByTestId("records-item-family-feny")
      .querySelector("svg[data-status-icon='dot']");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("records-open-family-feny")).toHaveAccessibleName(
      "Fenyő család Aktív",
    );
    expect(screen.getByTestId("records-open-family-feny")).toHaveAttribute(
      "href",
      "/admin/nyilvantartasok/family-feny",
    );
  });

  it("makes each item one whole-card link with one accessible name and no Részletek link", () => {
    render(
      <ResponsiveCollection
        items={[
          { id: "approval-csere", title: "Feladatcsere-kérelem", state: "pending", version: 1 },
          { id: "odd", title: "Új elem", state: "something-new" },
        ]}
        basePath="/admin/jovahagyasok"
        testId="approvals"
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const item of items) expect(within(item).getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Feladatcsere-kérelem Függőben" })).toHaveAttribute(
      "href",
      "/admin/jovahagyasok/approval-csere",
    );
    // A state without a Hungarian label never shows the raw value.
    expect(screen.getByRole("link", { name: "Új elem Ismeretlen állapot" })).toBeVisible();
    expect(document.body).not.toHaveTextContent("Részletek");
    expect(document.body).not.toHaveTextContent("something-new");
  });

  it("renders empty collection without an interactive link", () => {
    render(<ResponsiveCollection items={[]} basePath="/admin/nyilvantartasok" testId="records" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders multiple collection entries without leaking unrelated text", () => {
    render(
      <ResponsiveCollection
        items={[
          { id: "family-feny", title: "Fenyő család", state: "active" },
          { id: "group-boroka", title: "Boróka csoport", state: "active" },
        ]}
        basePath="/admin/nyilvantartasok"
        testId="records"
      />,
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(document.body).not.toHaveTextContent("email");
  });

  it("renders generic denial without protected identifiers", () => {
    render(<AdminAccessState kind="denied" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nincs jogosultság");
    expect(document.body).not.toHaveTextContent("family-feny");
  });

  it("leads a teacher who opened an admin page back to Beosztás", () => {
    render(<AdminAccessState kind="denied" homePath="/teacher/schedule" />);
    const back = screen.getByTestId("admin-access-state-home-link");
    expect(back).toHaveTextContent("Vissza a beosztáshoz");
    expect(back).toHaveAttribute("href", "/teacher/schedule");
  });

  it("renders a safe configuration failure", () => {
    render(<AdminAccessState kind="configuration-error" message="Hiányzó futtatási beállítás." />);
    expect(screen.getByTestId("admin-configuration-error")).toHaveTextContent(
      "Hiányzó futtatási beállítás",
    );
  });

  it("uses a safe fallback for configuration failure without details", () => {
    render(<AdminAccessState kind="configuration-error" />);
    expect(screen.getByTestId("admin-configuration-error")).toHaveTextContent(
      "Ellenőrizze a helyi futtatási beállításokat",
    );
  });

  it("renders labelled filter controls and stable test ids", () => {
    render(<AdminFilterBar action="/admin/feladatok" list="tasks" query="kert" state="open" />);
    expect(screen.getByLabelText("Keresés")).toHaveValue("kert");
    expect(screen.getByLabelText("Állapot")).toHaveValue("open");
    expect(screen.getByTestId("admin-filter-submit-button")).toBeInTheDocument();
  });

  it("puts every filter field in its own label-above-control group", () => {
    render(<AdminFilterBar action="/admin/feladatok" list="tasks" />);
    const form = screen.getByTestId("admin-filter-form");
    const fields = form.querySelectorAll(".filter-field");
    expect(fields).toHaveLength(2);
    for (const field of Array.from(fields)) {
      expect(field.firstElementChild?.tagName).toBe("LABEL");
      expect(field.children).toHaveLength(2);
    }
  });

  it("offers a clear link to the list without filter values", () => {
    render(<AdminFilterBar action="/admin/feladatok" list="tasks" query="kert" state="open" />);
    const clear = screen.getByTestId("admin-filter-clear-link");
    expect(clear).toHaveTextContent("Szűrők törlése");
    expect(clear).toHaveAttribute("href", "/admin/feladatok");
    expect(clear).toHaveClass("button-link");
  });

  it("clears a typed, unsubmitted value and goes to the bare list", () => {
    router.push.mockClear();
    render(<AdminFilterBar action="/admin/feladatok" list="tasks" />);
    fireEvent.change(screen.getByLabelText("Keresés"), { target: { value: "kert" } });
    fireEvent.change(screen.getByLabelText("Állapot"), { target: { value: "scheduled" } });
    fireEvent.click(screen.getByTestId("admin-filter-clear-link"));
    expect(screen.getByLabelText("Keresés")).toHaveValue("");
    expect(screen.getByLabelText("Állapot")).toHaveValue("");
    expect(router.push).toHaveBeenCalledWith("/admin/feladatok");
  });

  it("moves focus to the page heading after a clear", () => {
    render(
      <main>
        <h1>Feladatok és események</h1>
        <AdminFilterBar action="/admin/feladatok" list="tasks" query="kert" />
      </main>,
    );
    fireEvent.click(screen.getByTestId("admin-filter-clear-link"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("starts from the values of a new address, never from a stale typed value", () => {
    const { rerender } = render(
      <AdminFilterBar action="/admin/feladatok" list="tasks" query="kert" state="open" />,
    );
    fireEvent.change(screen.getByLabelText("Keresés"), { target: { value: "gépelt" } });
    rerender(<AdminFilterBar action="/admin/feladatok" list="tasks" />);
    expect(screen.getByLabelText("Keresés")).toHaveValue("");
    expect(screen.getByLabelText("Állapot")).toHaveValue("");
  });

  it.each([
    [
      "records",
      [
        ["active", "● Aktív"],
        ["archived", "○ Archivált"],
      ],
    ],
    [
      "tasks",
      [
        ["open", "◐ Nyitott"],
        ["scheduled", "▦ Ütemezve"],
      ],
    ],
    [
      "approvals",
      [
        ["pending", "◔ Függőben"],
        ["approved", "✓ Jóváhagyva"],
        ["rejected", "✕ Elutasítva"],
      ],
    ],
  ] as const)(
    "offers only the %s statuses, with a symbol and the Hungarian word, and unchanged option values",
    (list, expected) => {
      render(<AdminFilterBar action="/admin/x" list={list} />);
      const options = within(screen.getByLabelText("Állapot")).getAllByRole("option");
      expect(options.map((option) => [option.getAttribute("value"), option.textContent])).toEqual([
        ["", "Minden állapot"],
        ...expected,
      ]);
    },
  );

  it("shows a short note, not an error, for a status the list does not offer", () => {
    const { rerender } = render(<AdminFilterBar action="/admin/x" list="tasks" />);
    expect(screen.queryByTestId("admin-filter-unknown-note")).not.toBeInTheDocument();
    rerender(<AdminFilterBar action="/admin/x" list="tasks" unknownState />);
    expect(screen.getByTestId("admin-filter-unknown-note")).toHaveTextContent(
      "minden elem látható",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Állapot")).toHaveValue("");
  });

  it("renders empty filter defaults", () => {
    render(<AdminFilterBar action="/admin/feladatok" list="tasks" />);
    expect(screen.getByLabelText("Keresés")).toHaveValue("");
    expect(screen.getByLabelText("Állapot")).toHaveValue("");
  });

  it("preserves Hungarian search input", () => {
    render(<AdminFilterBar action="/admin/feladatok" list="tasks" query="Lámpás ünnep" />);
    expect(screen.getByLabelText("Keresés")).toHaveValue("Lámpás ünnep");
  });

  it("renders bounded pagination semantics", () => {
    render(<AdminPagination />);
    expect(screen.getByRole("navigation", { name: "Lapozás" })).toHaveTextContent("1. oldal");
    expect(screen.getByText("Előző oldal")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not expose unusable pagination links", () => {
    render(<AdminPagination />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Következő oldal")).toHaveAttribute("aria-disabled", "true");
  });
});

describe("AdminMutationForm", () => {
  it("renders an enabled labelled mutation action initially", () => {
    render(
      <AdminMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="mutation"
      >
        <label htmlFor="title">Megnevezés</label>
        <input id="title" name="title" />
      </AdminMutationForm>,
    );
    expect(screen.getByRole("button", { name: "Mentés" })).toBeEnabled();
    expect(screen.getByLabelText("Megnevezés")).toBeInTheDocument();
  });

  it("announces success without exposing field errors", async () => {
    render(
      <AdminMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="mutation"
      >
        <input name="title" defaultValue="Fenyő" />
      </AdminMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("mutation"));
    await waitFor(() =>
      expect(screen.getByTestId("mutation-state-success")).toHaveTextContent("Mentve"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("focuses validation and terminal summaries", async () => {
    const validationAction = async () => ({
      state: "validation" as const,
      message: "Ellenőrizze.",
      fieldErrors: { title: "Kötelező mező." },
    });
    const { rerender } = render(
      <AdminMutationForm action={validationAction} submitLabel="Mentés" testId="mutation">
        <input id="title" name="title" />
      </AdminMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("mutation"));
    await waitFor(() => expect(screen.getByTestId("mutation-state-validation")).toHaveFocus());
    rerender(
      <AdminMutationForm
        action={async () => ({ state: "terminal", message: "Hiba történt." })}
        submitLabel="Mentés"
        testId="terminal-mutation"
      >
        <input name="title" />
      </AdminMutationForm>,
    );
    fireEvent.submit(screen.getByTestId("terminal-mutation"));
    await waitFor(() =>
      expect(screen.getByTestId("terminal-mutation-state-terminal")).toHaveFocus(),
    );
  });

  it("lets an empty required field reach the action instead of the browser's own check", () => {
    render(
      <AdminMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="mutation"
      >
        <AdminTextField id="title" name="title" label="Megnevezés" required testId="title-input" />
      </AdminMutationForm>,
    );
    expect(screen.getByTestId("mutation")).toHaveAttribute("novalidate");
    expect(screen.getByLabelText("Megnevezés")).toBeRequired();
  });

  it("shows the field message next to the field, in the summary, and focuses the summary", async () => {
    const message = "A megnevezés megadása kötelező.";
    render(
      <AdminMutationForm
        action={async () => ({
          state: "validation",
          message: "Ellenőrizze a megadott adatokat.",
          fieldErrors: { title: message },
        })}
        submitLabel="Mentés"
        testId="mutation"
      >
        <AdminTextField id="title" name="title" label="Megnevezés" required testId="title-input" />
      </AdminMutationForm>,
    );
    expect(screen.queryByTestId("title-input-error")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByTestId("mutation"));
    await waitFor(() => expect(screen.getByTestId("mutation-state-validation")).toHaveFocus());
    expect(screen.getByTestId("title-input-error")).toHaveTextContent(message);
    expect(screen.getByLabelText("Megnevezés")).toBeInvalid();
    expect(screen.getByLabelText("Megnevezés")).toHaveAccessibleDescription(message);
    expect(screen.getByRole("link", { name: message })).toHaveAttribute("href", "#title");
  });

  it("shows the link back to the list beside a success message, and only then", async () => {
    render(
      <AdminMutationForm
        action={async () => ({ state: "success", message: "Mentve." })}
        submitLabel="Mentés"
        testId="mutation"
        successLink={{ href: "/admin/feladatok", label: "Vissza a feladatokhoz és eseményekhez" }}
      >
        <input name="title" defaultValue="Fenyő" />
      </AdminMutationForm>,
    );
    expect(screen.queryByTestId("mutation-success-link")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByTestId("mutation"));
    await waitFor(() => expect(screen.getByTestId("mutation-success-link")).toBeInTheDocument());
    expect(screen.getByTestId("mutation-success-link")).toHaveAttribute("href", "/admin/feladatok");
    // The form stays on the page.
    expect(screen.getByRole("button", { name: "Mentés" })).toBeInTheDocument();
  });
});

describe("AdminBackLink", () => {
  it.each([
    ["records", "/admin/nyilvantartasok", "Vissza a nyilvántartásokhoz"],
    ["tasks", "/admin/feladatok", "Vissza a feladatokhoz és eseményekhez"],
    ["approvals", "/admin/jovahagyasok", "Vissza a jóváhagyásokhoz"],
    ["archive", "/admin/archivum", "Vissza az archívumhoz"],
  ] as const)("leads %s details back to their list in the list's words", (list, href, label) => {
    render(<AdminBackLink list={list} />);
    expect(screen.getByTestId("admin-back-link")).toHaveAttribute("href", href);
    expect(screen.getByTestId("admin-back-link")).toHaveTextContent(label);
  });

  it("restores the list's search and status filter, and nothing else", () => {
    render(<AdminBackLink list="tasks" returnQuery="q=kert&state=open&x=evil&state2=1" />);
    expect(screen.getByTestId("admin-back-link")).toHaveAttribute(
      "href",
      "/admin/feladatok?q=kert&state=open",
    );
  });

  it("builds the query a list hands to its detail pages from its filter", () => {
    expect(listReturnQuery({ q: "", state: "" })).toBe("");
    expect(listReturnQuery({ q: "kert" })).toBe("q=kert");
    expect(listReturnQuery({ q: "Lámpás ünnep", state: "open" })).toBe(
      "q=L%C3%A1mp%C3%A1s+%C3%BCnnep&state=open",
    );
  });

  it("links each list card to its detail page, carrying the filter only when there is one", () => {
    const items = [{ id: "task-kert", title: "Kert", state: "open", version: 1 }] as never;
    const { rerender } = render(
      <ResponsiveCollection items={items} basePath="/admin/feladatok" testId="list" />,
    );
    expect(screen.getByTestId("list-open-task-kert")).toHaveAttribute(
      "href",
      "/admin/feladatok/task-kert",
    );
    rerender(
      <ResponsiveCollection
        items={items}
        basePath="/admin/feladatok"
        testId="list"
        returnQuery="q=kert&state=open"
      />,
    );
    expect(screen.getByTestId("list-open-task-kert")).toHaveAttribute(
      "href",
      "/admin/feladatok/task-kert?vissza=q%3Dkert%26state%3Dopen",
    );
  });
});

describe("DeveloperDetails", () => {
  it("keeps technical text in one section that is closed by default", () => {
    render(
      <>
        <p>Állapot: Nyitott</p>
        <DeveloperDetails>
          <p>Verzió: 3</p>
        </DeveloperDetails>
      </>,
    );
    const section = screen.getByTestId("developer-details");
    expect(section).not.toHaveAttribute("open");
    expect(within(section).getByText("Fejlesztői részletek")).toBeInTheDocument();
    expect(within(section).getByText("Verzió: 3")).toBeInTheDocument();
    expect(screen.getByText("Állapot: Nyitott").closest("details")).toBeNull();
  });
});
