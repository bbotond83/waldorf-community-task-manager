import { beforeEach, describe, expect, it, vi } from "vitest";
import { COPY } from "../../src/identity/copy";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../../src/identity/cookies";
import {
  envelope,
  fakeAdmin,
  fakeDatabase,
  fakeMailer,
  fakeService,
  fakeSession,
  ok,
  recordingEvents,
  rejected,
  unavailable,
} from "../support/identity-fakes";

const state = vi.hoisted(() => ({
  jar: new Map<string, { value: string; options: Record<string, unknown> }>(),
  runtime: undefined as unknown,
  throwRuntime: false,
  pending: [] as Promise<unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => state.jar.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) =>
      state.jar.set(name, { value, options }),
  }),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<unknown>) => {
    state.pending.push(task());
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url}` });
  },
}));
vi.mock("../../src/identity/runtime", () => ({
  getIdentityRuntime: () => {
    if (state.throwRuntime) throw new Error("CONFIG_INVALID");
    return state.runtime;
  },
  isIdentityConfigured: () => !state.throwRuntime,
}));
vi.mock("../../src/runtime/composition", () => ({
  composeRuntime: async () => ({ ok: false, error: { code: "x", variable: "y", message: "z" } }),
}));

import { resetHousekeepingClockForTests } from "../../src/identity/sign-in";
import { signOutAction } from "../../app/_identity/actions";
import { currentSession } from "../../app/_identity/current-session";
import { signInAction } from "../../app/bejelentkezes/actions";
import { requestResetAction } from "../../app/jelszo-visszaallitas/actions";
import { setNewPasswordAction } from "../../app/jelszo-visszaallitas/uj/actions";
import { acceptRealInvitationAction } from "../../app/meghivas/[token]/actions";

const idle = { status: "idle", message: "" } as const;
const TOKEN = "T".repeat(43);

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

async function redirectOf(work: Promise<unknown>): Promise<string | undefined> {
  try {
    await work;
  } catch (error) {
    return (error as { digest?: string }).digest?.split(";")[2];
  }
  return undefined;
}

function install(
  parts: {
    service?: Parameters<typeof fakeService>[0];
    admin?: Parameters<typeof fakeAdmin>[0];
    users?: Parameters<typeof fakeAdmin>[1];
    active?: boolean | "unavailable";
  } = {},
) {
  const service = fakeService(parts.service);
  const admin = fakeAdmin(
    { sign_in_lockout_check: () => envelope("success", "open"), ...parts.admin },
    parts.users,
  );
  const events = recordingEvents();
  state.runtime = {
    settings: {
      appPublicUrl: "http://127.0.0.1:3000",
      smtp: { host: "127.0.0.1", port: 1, from: "s@example.test" },
    },
    emailKeySecret: "k".repeat(40),
    service,
    admin,
    database: fakeDatabase({ active: parts.active ?? true }),
    mailer: fakeMailer(),
    events,
  };
  return { service, admin, events };
}

beforeEach(() => {
  resetHousekeepingClockForTests();
  state.jar.clear();
  state.throwRuntime = false;
  install();
});

describe("signInAction (W1)", () => {
  it("stores the tokens in httpOnly cookies and redirects after a successful sign-in", async () => {
    const { service, admin } = install();
    const target = await redirectOf(
      signInAction(idle, form({ email: "Person@Example.test", password: "password-1x" })),
    );
    expect(target).toBe("/");
    expect(state.jar.get(ACCESS_COOKIE)?.value).toBeTruthy();
    expect(state.jar.get(REFRESH_COOKIE)?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(service.calls[0]!.args).toEqual(["person@example.test", "password-1x"]);
    expect(admin.calls.map((call) => call.name)).toContain("sign_in_attempt_clear");
  });

  it("returns the generic Hungarian message and keeps the address for a wrong password, and sets no cookie", async () => {
    install({ service: { passwordSignIn: async () => rejected("invalid_credentials") } });
    const result = await signInAction(
      idle,
      form({ email: "person@example.test", password: "wrong-1xyz" }),
    );
    expect(result).toEqual({
      status: "error",
      message: COPY.signIn.invalid,
      email: "person@example.test",
    });
    expect(state.jar.size).toBe(0);
  });

  it("returns the locked message for a locked address and the temporary message when the service is down", async () => {
    install({ admin: { sign_in_lockout_check: () => envelope("success", "locked") } });
    expect(
      (await signInAction(idle, form({ email: "person@example.test", password: "x1xxxxxx" })))
        .message,
    ).toBe(COPY.signIn.locked);
    install({ service: { passwordSignIn: async () => unavailable } });
    expect(
      (await signInAction(idle, form({ email: "person@example.test", password: "x1xxxxxx" })))
        .message,
    ).toBe(COPY.signIn.temporary);
  });

  it("runs the hourly housekeeping once and reports it", async () => {
    const { admin, events } = install();
    await redirectOf(
      signInAction(idle, form({ email: "person@example.test", password: "password-1x" })),
    );
    await vi.waitFor(() =>
      expect(events.events.some((entry) => entry.event.startsWith("housekeeping"))).toBe(true),
    );
    expect(admin.calls.some((call) => call.name === "identity_housekeeping")).toBe(true);
  });

  it("answers with the temporary message when the configuration is invalid", async () => {
    state.throwRuntime = true;
    const result = await signInAction(idle, form({ email: "person@example.test", password: "x" }));
    expect(result).toEqual({
      status: "error",
      message: COPY.signIn.temporary,
      email: "person@example.test",
    });
  });
});

describe("signOutAction (W3, BR2.8)", () => {
  it("ends this session, clears both cookies and redirects to the sign-in screen", async () => {
    const { service, events } = install();
    state.jar.set(ACCESS_COOKIE, { value: fakeSession().accessToken, options: {} });
    state.jar.set(REFRESH_COOKIE, { value: "refresh-1", options: {} });
    expect(await redirectOf(signOutAction())).toBe("/bejelentkezes");
    expect(service.calls.map((call) => call.name)).toEqual(["signOut"]);
    expect(state.jar.get(ACCESS_COOKIE)).toMatchObject({ value: "", options: { maxAge: 0 } });
    expect(state.jar.get(REFRESH_COOKIE)).toMatchObject({ value: "", options: { maxAge: 0 } });
    expect(events.events.map((entry) => entry.event)).toEqual(["sign_out"]);
  });

  it("clears the cookies even without a session or when the configuration is invalid", async () => {
    expect(await redirectOf(signOutAction())).toBe("/bejelentkezes");
    state.throwRuntime = true;
    state.jar.set(ACCESS_COOKIE, { value: "a", options: {} });
    expect(await redirectOf(signOutAction())).toBe("/bejelentkezes");
    expect(state.jar.get(ACCESS_COOKIE)?.value).toBe("");
  });
});

describe("requestResetAction (W6)", () => {
  it("shows the same confirmation whatever the address is", async () => {
    const { service } = install({
      admin: { account_recovery_check: () => envelope("success", "active") },
    });
    expect(await requestResetAction(idle, form({ email: "person@example.test" }))).toEqual({
      status: "success",
      message: COPY.reset.confirmation,
    });
    // The check and the mail are handed to Next's after (the unit test of the module proves they run later).
    await Promise.all(state.pending);
    expect(service.calls.map((call) => call.name)).toEqual(["requestRecovery"]);
    install({ admin: { account_recovery_check: () => envelope("success", "unknown") } });
    expect((await requestResetAction(idle, form({ email: "nobody@example.test" }))).message).toBe(
      COPY.reset.confirmation,
    );
  });

  it("refuses a malformed address on the field and still confirms when the configuration is broken", async () => {
    expect(await requestResetAction(idle, form({ email: "nope" }))).toEqual({
      status: "error",
      message: COPY.reset.emailInvalid,
      field: "email",
      email: "nope",
    });
    state.throwRuntime = true;
    expect((await requestResetAction(idle, form({ email: "person@example.test" }))).message).toBe(
      COPY.reset.confirmation,
    );
  });
});

describe("setNewPasswordAction (W6, BR2.12)", () => {
  const hash = "h".repeat(56);

  it("exchanges the code on submit, stores the new session and redirects", async () => {
    const { service } = install();
    expect(
      await redirectOf(setNewPasswordAction(hash, idle, form({ password: "new-password-1" }))),
    ).toBe("/bejelentkezes");
    expect(service.calls.map((call) => call.name)).toEqual(["verifyRecovery", "updatePassword"]);
    expect(state.jar.get(ACCESS_COOKIE)?.value).toBeTruthy();
  });

  it("answers the not-valid message for a spent code and the rule message on the field", async () => {
    install({ service: { verifyRecovery: async () => rejected("otp_expired", 403) } });
    const spent = await setNewPasswordAction(hash, idle, form({ password: "new-password-1" }));
    expect(spent).toEqual({ status: "error", message: COPY.reset.notValid, kind: "not-valid" });
    install();
    const weak = await setNewPasswordAction(hash, idle, form({ password: "weak" }));
    expect(weak).toEqual({ status: "error", message: COPY.password.ruleError, field: "password" });
    state.throwRuntime = true;
    expect(
      (await setNewPasswordAction(hash, idle, form({ password: "new-password-1" }))).message,
    ).toBe(COPY.common.temporary);
    expect(state.jar.size).toBe(0);
  });
});

describe("acceptRealInvitationAction (W5, BR2.11)", () => {
  const reserved = () =>
    envelope("success", "reserved", "inv-1", {
      email: "parent@example.test",
      orphan_user_id: null,
    });

  it("accepts, stores the session and redirects", async () => {
    install({
      admin: {
        invitation_reserve: reserved,
        invitation_accept: () => envelope("success", null, "user-1"),
      },
      users: { createUser: async () => ok({ id: "user-1" }) },
    });
    expect(
      await redirectOf(
        acceptRealInvitationAction(TOKEN, "key-1", idle, form({ password: "good-password-1" })),
      ),
    ).toBe("/bejelentkezes");
    expect(state.jar.get(ACCESS_COOKIE)?.value).toBeTruthy();
  });

  it("redirects to sign-in without a session when the automatic sign-in fails after the account exists", async () => {
    install({
      admin: {
        invitation_reserve: reserved,
        invitation_accept: () => envelope("success", null, "user-1"),
      },
      users: { createUser: async () => ok({ id: "user-1" }) },
      service: { passwordSignIn: async () => unavailable },
    });
    expect(
      await redirectOf(
        acceptRealInvitationAction(TOKEN, "key-2", idle, form({ password: "good-password-1" })),
      ),
    ).toBe("/bejelentkezes");
    expect(state.jar.size).toBe(0);
  });

  it("shows the not-valid message, the rule message and the temporary message as Hungarian states", async () => {
    install({ admin: { invitation_reserve: () => envelope("validation", "invitation_expired") } });
    expect(
      await acceptRealInvitationAction(TOKEN, "k", idle, form({ password: "good-password-1" })),
    ).toEqual({ status: "error", message: COPY.invitation.notValid, kind: "not-valid" });
    expect(
      (await acceptRealInvitationAction(TOKEN, "k", idle, form({ password: "weak" }))).field,
    ).toBe("password");
    state.throwRuntime = true;
    expect(
      (await acceptRealInvitationAction(TOKEN, "k", idle, form({ password: "good-password-1" })))
        .message,
    ).toBe(COPY.common.temporary);
  });

  it("offers no other invitation action than the real one: the old demo accept and resend are gone", async () => {
    const actions = await import("../../app/meghivas/[token]/actions.ts");
    expect(Object.keys(actions)).toEqual(["acceptRealInvitationAction"]);
  });
});

describe("currentSession (BR2.7, BR2.19)", () => {
  it("is signed out without cookies or without the identity settings", async () => {
    expect(await currentSession()).toEqual({ status: "signed-out", clearCookies: false });
    state.throwRuntime = true;
    expect(await currentSession()).toEqual({ status: "signed-out", clearCookies: false });
  });

  it("is signed in for an active session and never refreshes tokens while rendering a page", async () => {
    const { service } = install();
    state.jar.set(ACCESS_COOKIE, { value: fakeSession().accessToken, options: {} });
    state.jar.set(REFRESH_COOKIE, { value: "r", options: {} });
    expect((await currentSession()).status).toBe("signed-in");
    install({ active: false });
    expect(await currentSession()).toEqual({ status: "signed-out", clearCookies: true });
    const expired = fakeSession({}, -100);
    state.jar.set(ACCESS_COOKIE, { value: expired.accessToken, options: {} });
    expect(await currentSession()).toEqual({ status: "signed-out", clearCookies: false });
    expect(service.calls.length).toBe(0);
  });

  it("reports unavailable when the dependency fails", async () => {
    install({ active: "unavailable" });
    state.jar.set(ACCESS_COOKIE, { value: fakeSession().accessToken, options: {} });
    state.jar.set(REFRESH_COOKIE, { value: "r", options: {} });
    expect(await currentSession()).toEqual({ status: "unavailable" });
  });
});
