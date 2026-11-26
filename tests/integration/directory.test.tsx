import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationResult, DirectoryModel } from "../../src/application/index.ts";
import { DirectoryPage } from "../../src/runtime/DirectoryPage.tsx";
import { filterFamilies, normalizeForSearch } from "../../src/runtime/directory-search.ts";
import { ACCOUNT_IDS, requestWorld } from "../support/request-world.ts";
import { DIRECTORY_FIXTURE, removedParent } from "../support/port-doubles.ts";
import {
  envelope,
  fakeAdmin,
  fakeDatabase,
  fakeJwt,
  fakeMailer,
  fakeService,
  ok,
  recordingEvents,
  rejected,
  unavailable,
  type FakeAdmin,
  type FakeService,
} from "../support/identity-fakes.ts";

const identity = vi.hoisted(() => ({
  runtime: undefined as unknown,
  session: undefined as unknown,
  throwRuntime: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
vi.mock("../../app/_identity/current-session.ts", () => ({
  currentSession: async () => identity.session,
}));
vi.mock("../../src/identity/runtime.ts", async (original) => ({
  ...(await original<typeof import("../../src/identity/runtime.ts")>()),
  getIdentityRuntime: () => {
    if (identity.throwRuntime) throw new Error("CONFIG_INVALID");
    return identity.runtime;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const success = (data: DirectoryModel): ApplicationResult<DirectoryModel> =>
  ({ state: "success", data }) as ApplicationResult<DirectoryModel>;
const state = (name: "empty" | "denied" | "invalidated" | "dependency-failure-terminal") =>
  ({ state: name }) as ApplicationResult<DirectoryModel>;

describe("the directory cards (US3.1, US3.5)", () => {
  it("shows each family as a card with its parents, and the children only where they were sent", () => {
    render(<DirectoryPage result={success(DIRECTORY_FIXTURE)} />);
    expect(screen.getByRole("heading", { level: 1, name: "Szülők" })).toBeVisible();
    expect(screen.getByTestId("directory-count")).toHaveTextContent("Aktív családok (3 bejegyzés)");
    expect(screen.getByTestId("directory-legend")).toHaveTextContent(
      "Önkéntesen megosztott adatok",
    );
    expect(screen.getByTestId("directory-search-hint")).toHaveTextContent(
      "A kereső automatikusan szűr a családnevekre és a megadott keresztnevekre is.",
    );
    expect(screen.getByTestId("directory-search-input")).toHaveAccessibleDescription(
      /automatikusan szűr/,
    );
    const shared = within(screen.getByTestId("directory-family-family-boroka"));
    expect(shared.getByRole("heading", { level: 2, name: "Minta család" })).toBeVisible();
    expect(shared.getByText("Mintaváros")).toBeVisible();
    expect(shared.getByText("Kertrendezés")).toBeVisible();
    expect(shared.getByRole("link", { name: "borbala@example.test" })).toHaveAttribute(
      "href",
      "mailto:borbala@example.test",
    );
    expect(shared.getByRole("link", { name: "+36 30 111 2222" })).toHaveAttribute(
      "href",
      "tel:+36301112222",
    );
    expect(screen.getByTestId("directory-children-family-boroka")).toHaveTextContent(
      "Minta Liliána",
    );
    expect(screen.queryByTestId("directory-children-family-reti")).toBeNull();
    expect(screen.queryByTestId("directory-children-family-szabo")).toBeNull();
  });

  it("shows a parent who shared nothing by name only, with no field and no contact", () => {
    render(<DirectoryPage result={success(DIRECTORY_FIXTURE)} />);
    const card = within(screen.getByTestId("directory-parent-parent-reti"));
    expect(card.getByRole("heading", { name: "Réti Johanna" })).toBeVisible();
    expect(card.getByText("Nem osztott meg részletes adatokat.")).toBeVisible();
    expect(card.queryByRole("link")).toBeNull();
    expect(card.queryByText("Lakóhely")).toBeNull();
  });

  it("shows the teacher's view: name, phone and email, and none of the other profile fields", () => {
    render(<DirectoryPage result={success(DIRECTORY_FIXTURE)} />);
    const card = within(screen.getByTestId("directory-parent-parent-szabo"));
    expect(card.getByRole("link", { name: "marton@example.test" })).toBeVisible();
    expect(card.queryByText("Foglalkozás")).toBeNull();
    expect(card.queryByText("Hobbi")).toBeNull();
    expect(card.queryByText("Nem osztott meg részletes adatokat.")).toBeNull();
  });

  it("filters the cards while typing without any network call, and finds accented names by plain letters", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<DirectoryPage result={success(DIRECTORY_FIXTURE)} />);
    fireEvent.change(screen.getByTestId("directory-search-input"), { target: { value: "reti" } });
    expect(screen.getByTestId("directory-count")).toHaveTextContent("Aktív családok (1 bejegyzés)");
    expect(screen.getByTestId("directory-family-family-reti")).toBeVisible();
    expect(screen.queryByTestId("directory-family-family-boroka")).toBeNull();
    fireEvent.change(screen.getByTestId("directory-search-input"), { target: { value: "lilia" } });
    expect(screen.getByTestId("directory-family-family-boroka")).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("says Nincs találat with a way back, and keeps it apart from the empty community", () => {
    render(<DirectoryPage result={success(DIRECTORY_FIXTURE)} />);
    const input = screen.getByTestId("directory-search-input");
    fireEvent.change(input, { target: { value: "senki" } });
    const none = screen.getByTestId("directory-no-match");
    expect(within(none).getByRole("heading", { name: "Nincs találat" })).toBeVisible();
    expect(screen.queryByText("Még nincs szülő a névsorban.")).toBeNull();
    fireEvent.click(within(none).getByRole("button", { name: "Keresés törlése" }));
    expect(input).toHaveValue("");
    expect(screen.getByTestId("directory-list").children).toHaveLength(3);
  });

  it("shows the empty community as a status with the approved text", () => {
    render(<DirectoryPage result={state("empty")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Még nincs szülő a névsorban.");
    expect(screen.queryByTestId("directory-search-input")).toBeNull();
  });

  it.each(["denied", "invalidated"] as const)("shows %s as denied, never as empty", (name) => {
    render(<DirectoryPage result={state(name)} />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-testid", "directory-denied");
    expect(screen.queryByText("Még nincs szülő a névsorban.")).toBeNull();
  });

  it("shows a failed read as the error state", () => {
    render(<DirectoryPage result={state("dependency-failure-terminal")} />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-testid", "directory-error");
  });

  it("wraps a very long name instead of cutting it", () => {
    const long = "Nagyon-Hosszú-Családnév ".repeat(8).trim();
    render(
      <DirectoryPage
        result={success({
          families: [
            {
              familyId: "f-long",
              familyName: long,
              isOwnFamily: false,
              parents: [{ id: "p-long", fullName: long, isSelf: false }],
            },
          ],
        })}
      />,
    );
    expect(screen.getAllByText(long).length).toBeGreaterThan(0);
  });
});

describe("the search words", () => {
  it("ignores case and accents and needs every word", () => {
    expect(normalizeForSearch("  ŐRÜLT Ábel ")).toBe("orult abel");
    expect(filterFamilies(DIRECTORY_FIXTURE.families, "minta borbala")).toHaveLength(1);
    expect(filterFamilies(DIRECTORY_FIXTURE.families, "minta marton")).toHaveLength(0);
    expect(filterFamilies(DIRECTORY_FIXTURE.families, "   ")).toBe(DIRECTORY_FIXTURE.families);
  });

  it("does not search contact details", () => {
    expect(filterFamilies(DIRECTORY_FIXTURE.families, "example.test")).toHaveLength(0);
    expect(filterFamilies(DIRECTORY_FIXTURE.families, "0001")).toHaveLength(0);
  });
});

describe("the directory pages of each role", () => {
  beforeEach(() => requestWorld.reset());
  const html = (node: ReactNode) => renderToStaticMarkup(node);

  it.each([
    ["parent", "../../app/szulo/szulok/page.tsx"],
    ["teacher", "../../app/teacher/szulok/page.tsx"],
    ["super_admin", "../../app/admin/szulok/page.tsx"],
  ] as const)("renders the cards for a %s", async (role, path) => {
    requestWorld.signIn(role);
    const page = (await import(path)).default as () => Promise<ReactNode>;
    const output = html(await page());
    expect(output).toContain("directory-family-family-boroka");
    expect(output).toContain("Minta család");
  });

  it("shows an empty community as the empty state", async () => {
    requestWorld.signIn("parent");
    requestWorld.ports.directory.directory = undefined;
    const page = (await import("../../app/szulo/szulok/page.tsx"))
      .default as () => Promise<ReactNode>;
    const output = html(await page());
    expect(output).toContain("Még nincs szülő a névsorban.");
    expect(output).not.toContain("directory-list");
  });

  it("shows no card without a session", async () => {
    const page = (await import("../../app/szulo/szulok/page.tsx"))
      .default as () => Promise<ReactNode>;
    const output = html(await page());
    expect(output).not.toContain("directory-family-");
    expect(output).toContain("directory-error");
  });
});

/* ---------------------------------------------------------------------------------------------------------------
 * The commands behind "Fiókom" and the removal of a parent
 * ------------------------------------------------------------------------------------------------------------- */

const KEY = "attempt:0123456789abcdef";
const REMOVED_PARENT = "aaaaaaaa-0000-4000-8000-000000000001";
const FAMILY = "aaaaaaaa-0000-4000-8000-0000000000f1";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

type Harness = {
  admin: FakeAdmin;
  service: FakeService;
  events: ReturnType<typeof recordingEvents>;
  links: { to: string; link: string }[];
};

function installIdentity(
  overrides: {
    admin?: Parameters<typeof fakeAdmin>[1];
    service?: Parameters<typeof fakeService>[0];
  } = {},
): Harness {
  const admin = fakeAdmin(
    { email_change_pending: () => envelope("success", "none") },
    overrides.admin,
  );
  const service = fakeService(overrides.service);
  const events = recordingEvents();
  const links: { to: string; link: string }[] = [];
  identity.runtime = {
    settings: { appPublicUrl: "http://127.0.0.1:3000", smtp: { host: "h", port: 1, from: "f" } },
    emailKeySecret: "test-secret-value-for-hashing-0123456789",
    service,
    admin,
    database: fakeDatabase(),
    mailer: fakeMailer(),
    accountMailer: {
      sendEmailChangeLink: async (to: string, link: string) => {
        links.push({ to, link });
        return { ok: true };
      },
      sendEmailChangeNotice: async () => ({ ok: true }),
    },
    events,
  };
  identity.session = {
    status: "signed-in",
    accountId: ACCOUNT_IDS.parent,
    sessionId: "22222222-2222-4222-8222-222222222222",
    accessToken: fakeJwt({
      sub: ACCOUNT_IDS.parent,
      email: "borbala@example.test",
      exp: 9999999999,
    }),
  };
  return { admin, service, events, links };
}

describe("removing a parent (W7, BR36.3)", () => {
  beforeEach(() => {
    requestWorld.reset();
    identity.throwRuntime = false;
  });
  const input = (extra: Record<string, string> = {}) =>
    form({
      parentId: REMOVED_PARENT,
      familyId: FAMILY,
      expectedVersion: "3",
      idempotencyKey: KEY,
      ...extra,
    });

  it("removes the parent, then bans the sign-in user and ends its sessions", async () => {
    const harness = installIdentity();
    requestWorld.signIn("super_admin");
    const { removeParentAction } = await import("../../app/admin/parent-actions.ts");
    const result = await removeParentAction({ state: "initial" }, input());
    expect(result).toMatchObject({ state: "success", message: "A szülő eltávolítva." });
    expect(requestWorld.ports.directory.removed).toEqual([REMOVED_PARENT]);
    expect(harness.admin.calls.map((call) => call.name)).toEqual(["setBan", "sessions_remove"]);
    expect(harness.admin.calls[0]!.args).toEqual(["account-removed", true]);
    expect(harness.events.events).toEqual([]);
  });

  it("says plainly when ending the sign-in failed, keeps the removal, and writes the failure line", async () => {
    const harness = installIdentity({ admin: { setBan: async () => unavailable } });
    requestWorld.signIn("super_admin");
    const { removeParentAction } = await import("../../app/admin/parent-actions.ts");
    const result = await removeParentAction({ state: "initial" }, input());
    expect(result.state).toBe("success");
    expect(result.code).toBe("SIGN_IN_FOLLOW_UP_PENDING");
    expect(result.message).toBe(
      "A szülő eltávolítva. Egy kijelentkeztetés nem sikerült; a fiók a következő kérésnél úgyis le lesz tiltva.",
    );
    expect(harness.events.events).toEqual([
      expect.objectContaining({ event: "follow_up_failed", code: "parent_removal" }),
    ]);
  });

  it("treats an unreadable identity runtime as a pending follow-up, not a failed removal", async () => {
    installIdentity();
    identity.throwRuntime = true;
    requestWorld.signIn("super_admin");
    const { removeParentAction } = await import("../../app/admin/parent-actions.ts");
    const result = await removeParentAction({ state: "initial" }, input());
    expect(result.code).toBe("SIGN_IN_FOLLOW_UP_PENDING");
    expect(requestWorld.ports.directory.removed).toHaveLength(1);
  });

  it("does nothing more for a parent who had no account", async () => {
    const harness = installIdentity();
    requestWorld.signIn("super_admin");
    requestWorld.ports.directory.removeAnswer = {
      state: "success",
      data: removedParent(REMOVED_PARENT, []),
    };
    const { removeParentAction } = await import("../../app/admin/parent-actions.ts");
    const result = await removeParentAction({ state: "initial" }, input());
    expect(result.message).toBe("A szülő eltávolítva.");
    expect(harness.admin.calls).toEqual([]);
  });

  it.each(["parent", "teacher", "group_admin"] as const)("refuses a %s", async (role) => {
    const harness = installIdentity();
    requestWorld.signIn(role);
    const { removeParentAction } = await import("../../app/admin/parent-actions.ts");
    const result = await removeParentAction({ state: "initial" }, input());
    expect(result.state).toBe("denied");
    expect(requestWorld.ports.directory.removed).toEqual([]);
    expect(harness.admin.calls).toEqual([]);
  });

  it("names the only-parent refusal and does not touch the sign-in", async () => {
    const harness = installIdentity();
    requestWorld.signIn("super_admin");
    requestWorld.ports.directory.removeAnswer = {
      state: "conflict",
      code: "PARENT_LAST_IN_FAMILY",
    };
    const { removeParentAction } = await import("../../app/admin/parent-actions.ts");
    const result = await removeParentAction({ state: "initial" }, input());
    expect(result).toMatchObject({
      state: "conflict",
      message: "Az utolsó szülő nem távolítható el a családból.",
    });
    expect(harness.admin.calls).toEqual([]);
  });

  it("tells an outdated screen to reload, and refuses a malformed request before the database", async () => {
    installIdentity();
    requestWorld.signIn("super_admin");
    requestWorld.ports.directory.removeAnswer = { state: "conflict", code: "VERSION_CONFLICT" };
    const { removeParentAction } = await import("../../app/admin/parent-actions.ts");
    const outdated = await removeParentAction({ state: "initial" }, input());
    expect(outdated.state).toBe("conflict");
    expect(outdated.message).toContain("Töltse újra");
    requestWorld.ports.directory.removed.length = 0;
    const bad = await removeParentAction({ state: "initial" }, input({ parentId: "not-an-id" }));
    expect(bad.state).toBe("validation");
    expect(requestWorld.ports.directory.removed).toEqual([]);
  });
});

describe("the account panels of Fiókom", () => {
  beforeEach(() => {
    requestWorld.reset();
    identity.throwRuntime = false;
  });

  it("saves the details, keeps what was typed when a field is wrong, and names the field", async () => {
    installIdentity();
    requestWorld.signIn("parent");
    const { saveProfileAction } = await import("../../app/szulo/fiokom/actions.ts");
    const wrong = await saveProfileAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, expectedVersion: "1", phone: "abc", hobby: "kenyér" }),
    );
    expect(wrong.state).toBe("validation");
    expect(wrong.fieldErrors).toHaveProperty("phone");
    expect(requestWorld.ports.directory.version).toBe(1);
    const saved = await saveProfileAction(
      { state: "initial" },
      form({
        idempotencyKey: KEY,
        expectedVersion: "1",
        phone: "+36 30 000 0009",
        residence: "Mintaváros",
        howISupport: "Kertrendezés",
      }),
    );
    expect(saved).toMatchObject({ state: "success", message: "Az adataid mentése sikerült." });
    expect(requestWorld.ports.directory.profileFields).toMatchObject({
      phone: "+36 30 000 0009",
      residence: "Mintaváros",
      howISupport: "Kertrendezés",
    });
  });

  it("refuses an outdated page and overwrites nothing", async () => {
    installIdentity();
    requestWorld.signIn("parent");
    const { saveProfileAction, saveSharingAction } =
      await import("../../app/szulo/fiokom/actions.ts");
    const outdated = await saveProfileAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, expectedVersion: "7", hobby: "kenyér" }),
    );
    expect(outdated.state).toBe("conflict");
    expect(outdated.message).toContain("töltse újra");
    expect(requestWorld.ports.directory.profileFields).toEqual({});
    const sharing = await saveSharingAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, expectedVersion: "7", sharing: "on" }),
    );
    expect(sharing.state).toBe("conflict");
    expect(requestWorld.ports.directory.sharing).toBe(false);
  });

  it("saves the sharing choice, and unticking is a separate message", async () => {
    installIdentity();
    requestWorld.signIn("parent");
    const { saveSharingAction } = await import("../../app/szulo/fiokom/actions.ts");
    const on = await saveSharingAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, expectedVersion: "1", sharing: "on" }),
    );
    expect(on.message).toBe("Az adataid mostantól láthatók a közösségnek.");
    const off = await saveSharingAction(
      { state: "initial" },
      form({ idempotencyKey: `${KEY}2`, expectedVersion: "2" }),
    );
    expect(off.message).toBe("Az adataid nem láthatók a közösségnek.");
    expect(requestWorld.ports.directory.sharing).toBe(false);
  });

  it.each(["teacher", "super_admin"] as const)(
    "refuses the own-account commands of a %s",
    async (role) => {
      installIdentity();
      requestWorld.signIn(role);
      const { saveSharingAction } = await import("../../app/szulo/fiokom/actions.ts");
      const result = await saveSharingAction(
        { state: "initial" },
        form({ idempotencyKey: KEY, expectedVersion: "1", sharing: "on" }),
      );
      expect(result.state).toBe("denied");
      expect(requestWorld.ports.directory.sharing).toBe(false);
    },
  );

  it("changes the password, and says so when the other sessions could not be ended", async () => {
    const harness = installIdentity();
    requestWorld.signIn("parent");
    const { changePasswordAction } = await import("../../app/szulo/fiokom/actions.ts");
    const fields = {
      currentPassword: "régi-jelszó-123",
      newPassword: "új-jelszó-456789",
      newPasswordRepeat: "új-jelszó-456789",
    };
    const done = await changePasswordAction({ state: "initial" }, form(fields));
    expect(done).toMatchObject({ state: "success", message: "A jelszavad megváltozott." });
    expect(harness.service.calls.map((call) => call.name)).toContain("updatePassword");

    const failing = installIdentity({});
    failing.admin.callFunction = async (name) =>
      name === "sessions_remove" ? envelope("terminal") : envelope("success", "ok");
    const partial = await changePasswordAction({ state: "initial" }, form(fields));
    expect(partial.state).toBe("success");
    expect(partial.message).toContain("többi bejelentkezést nem sikerült kijelentkeztetni");
  });

  it("names a wrong current password and a mismatching repeat next to their fields", async () => {
    installIdentity({ service: { passwordSignIn: async () => rejected() } });
    requestWorld.signIn("parent");
    const { changePasswordAction } = await import("../../app/szulo/fiokom/actions.ts");
    const wrong = await changePasswordAction(
      { state: "initial" },
      form({
        currentPassword: "rossz",
        newPassword: "új-jelszó-456789",
        newPasswordRepeat: "új-jelszó-456789",
      }),
    );
    expect(wrong.fieldErrors).toEqual({ currentPassword: "A jelenlegi jelszó nem helyes." });
    const mismatch = await changePasswordAction(
      { state: "initial" },
      form({ currentPassword: "x", newPassword: "a", newPasswordRepeat: "b" }),
    );
    expect(mismatch.fieldErrors).toHaveProperty("newPasswordRepeat");
    const empty = await changePasswordAction({ state: "initial" }, form({}));
    expect(empty.fieldErrors).toHaveProperty("currentPassword");
  });

  it("asks for a new address, sends the link to the new address only, and keeps password and address checks apart", async () => {
    const harness = installIdentity();
    requestWorld.signIn("parent");
    const { requestEmailChangeAction } = await import("../../app/szulo/fiokom/actions.ts");
    const sent = await requestEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, email: "Uj@Example.test", currentPassword: "régi-jelszó-123" }),
    );
    expect(sent).toMatchObject({ state: "success" });
    expect(harness.links).toHaveLength(1);
    expect(harness.links[0]!.to).toBe("uj@example.test");
    const noAddress = await requestEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, currentPassword: "x" }),
    );
    expect(noAddress.fieldErrors).toHaveProperty("email");
    const noPassword = await requestEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, email: "a@example.test" }),
    );
    expect(noPassword.fieldErrors).toHaveProperty("currentPassword");
  });

  it("shows the rate limit and an address in use in the words of the table, naming nobody", async () => {
    installIdentity({});
    (identity.runtime as { admin: FakeAdmin }).admin = fakeAdmin({
      email_change_request: () => envelope("validation", "EMAIL_UNAVAILABLE"),
    });
    requestWorld.signIn("parent");
    const { requestEmailChangeAction } = await import("../../app/szulo/fiokom/actions.ts");
    const taken = await requestEmailChangeAction(
      { state: "initial" },
      form({
        idempotencyKey: KEY,
        email: "foglalt@example.test",
        currentPassword: "régi-jelszó-123",
      }),
    );
    expect(taken.state).toBe("validation");
    expect(taken.fieldErrors).toEqual({ email: "Ez az e-mail-cím nem használható." });
    (identity.runtime as { admin: FakeAdmin }).admin = fakeAdmin({
      email_change_request: () => envelope("conflict", "EMAIL_RATE_LIMITED"),
    });
    const limited = await requestEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: KEY, email: "x@example.test", currentPassword: "régi-jelszó-123" }),
    );
    expect(limited.message).toContain("Túl sok levelet");
  });

  it("cancels and resends the pending request, and refuses a resend when none is pending", async () => {
    const harness = installIdentity();
    requestWorld.signIn("parent");
    const { cancelEmailChangeAction, resendEmailChangeAction } =
      await import("../../app/szulo/fiokom/actions.ts");
    const none = await resendEmailChangeAction({ state: "initial" }, form({ idempotencyKey: KEY }));
    expect(none.state).toBe("conflict");
    expect(none.message).toBe("Nincs függőben lévő címváltoztatási kérés.");
    (identity.runtime as { admin: FakeAdmin }).admin = fakeAdmin({
      email_change_pending: () =>
        envelope("success", "pending", null, { new_email: "uj@example.test", expires_at: "x" }),
    });
    const resent = await resendEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: KEY }),
    );
    expect(resent).toMatchObject({ state: "success", message: "Új megerősítő levelet küldtünk." });
    expect(harness.links.map((entry) => entry.to)).toEqual(["uj@example.test"]);
    const cancelled = await cancelEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: `${KEY}c` }),
    );
    expect(cancelled.state).toBe("success");
    const badKey = await cancelEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: "x" }),
    );
    expect(badKey.state).toBe("validation");
  });

  it("shows a temporary failure when the identity runtime cannot be read", async () => {
    installIdentity();
    identity.throwRuntime = true;
    requestWorld.signIn("parent");
    const { cancelEmailChangeAction } = await import("../../app/szulo/fiokom/actions.ts");
    const result = await cancelEmailChangeAction(
      { state: "initial" },
      form({ idempotencyKey: KEY }),
    );
    expect(result.state).toBe("terminal");
  });

  it("renders the three panels with the current values, separate from an unreadable pending state", async () => {
    installIdentity();
    requestWorld.signIn("parent");
    const page = (await import("../../app/szulo/fiokom/page.tsx"))
      .default as () => Promise<ReactNode>;
    const output = renderToStaticMarkup(await page());
    for (const title of ["Adataim", "Láthatóság", "Bejelentkezés"]) expect(output).toContain(title);
    expect(output).toContain("borbala@example.test");
    expect(output).toContain("Megerősített e-mail");
    expect(output).toContain("Hitelesített szülő");
    expect(output).toContain("account-password-pair");
    expect(output).not.toContain("account-email-pending");

    (identity.runtime as { admin: FakeAdmin }).admin = fakeAdmin({
      email_change_pending: () =>
        envelope("success", "pending", null, { new_email: "uj@example.test", expires_at: "x" }),
    });
    const pending = renderToStaticMarkup(await page());
    expect(pending).toContain("Megerősítésre vár: uj@example.test.");
    expect(pending).toContain("A régi cím marad érvényes, amíg meg nem erősíted.");
    expect(pending).toContain("Mégse");
    expect(pending).toContain("Új levél");

    identity.throwRuntime = true;
    const unreadable = renderToStaticMarkup(await page());
    expect(unreadable).toContain("account-pending-error");
    expect(unreadable).toContain("Adataim");
    expect(unreadable).toContain("Hitelesített szülő");
  });
});

describe("the email confirmation page", () => {
  beforeEach(() => {
    identity.throwRuntime = false;
  });

  it("confirms with the button, shows the success, and shows a spent link as no longer valid", async () => {
    installIdentity();
    const { confirmEmailAction } = await import("../../app/email-megerosites/[token]/actions.ts");
    const token = "A".repeat(43);
    expect(await confirmEmailAction(token)).toEqual({ status: "success" });
    (identity.runtime as { admin: FakeAdmin }).admin = fakeAdmin({
      email_change_confirm: () => envelope("denied", "EMAIL_LINK_INVALID"),
    });
    expect(await confirmEmailAction(token)).toEqual({ status: "not-valid" });
    expect(await confirmEmailAction("kicsi")).toEqual({ status: "not-valid" });
    (identity.runtime as { admin: FakeAdmin }).admin = fakeAdmin({
      email_change_confirm: () => unavailable as never,
    });
    expect(await confirmEmailAction(token)).toEqual({ status: "error" });
    identity.throwRuntime = true;
    expect(await confirmEmailAction(token)).toEqual({ status: "error" });
  });

  it("renders the button page for a plausible token and the no-longer-valid page for anything else", async () => {
    const page = (await import("../../app/email-megerosites/[token]/page.tsx")).default as (input: {
      params: Promise<{ token: string }>;
    }) => Promise<ReactNode>;
    const valid = renderToStaticMarkup(
      await page({ params: Promise.resolve({ token: "A".repeat(43) }) }),
    );
    expect(valid).toContain("email-confirm-form");
    const bad = renderToStaticMarkup(await page({ params: Promise.resolve({ token: "../x" }) }));
    expect(bad).toContain("A hivatkozás már nem érvényes");
    expect(bad).toContain("/szulo/fiokom");
  });
});

describe("the invitation of a parent without an account (W8)", () => {
  beforeEach(() => {
    requestWorld.reset();
    identity.throwRuntime = false;
  });

  it("refuses everyone but a super admin before any address is read", async () => {
    installIdentity();
    requestWorld.signIn("group_admin");
    const { sendInvitationAction } = await import("../../app/admin/parent-actions.ts");
    const result = await sendInvitationAction(
      { state: "initial" },
      form({ parentId: REMOVED_PARENT, familyId: FAMILY, idempotencyKey: KEY }),
    );
    expect(result.state).not.toBe("success");
  });

  it("refuses a malformed request and a parent without an address on record", async () => {
    installIdentity();
    requestWorld.signIn("super_admin");
    const { sendInvitationAction } = await import("../../app/admin/parent-actions.ts");
    const bad = await sendInvitationAction({ state: "initial" }, form({ parentId: "x" }));
    expect(bad.state).toBe("validation");
    const none = await sendInvitationAction(
      { state: "initial" },
      form({ parentId: REMOVED_PARENT, familyId: FAMILY, idempotencyKey: KEY }),
    );
    expect(none.state).toBe("validation");
  });
});

void ok;
