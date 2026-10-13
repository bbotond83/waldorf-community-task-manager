import type { ApplicationResult } from "../../src/application/contracts.ts";
import { retryableFailure, success } from "../../src/application/results.ts";
import type {
  AdminAccess,
  AdminFunctionName,
  AdminFunctionResult,
} from "../../src/identity/admin-client.ts";
import type { EventEmitter } from "../../src/identity/events.ts";
import type { InvitationMailer } from "../../src/identity/mail.ts";
import type { AuthSession, ServiceOutcome, SignInService } from "../../src/identity/service.ts";
import type {
  DatabaseClient,
  DatabaseResponse,
  OperationOutcome,
} from "../../src/runtime/database/client.ts";

/** Fakes for the infrastructure seams of the identity module: only ordering and failure handling use them. */

/** A JWT-shaped string with the given claims; it is never verified by the code under test. */
export function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(claims)}.${encode("signature-placeholder")}`;
}

export const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
export const SESSION_ID = "22222222-2222-4222-8222-222222222222";

export function fakeSession(
  overrides: Partial<AuthSession> = {},
  expiresInSeconds = 3600,
): AuthSession {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    accessToken: fakeJwt({ sub: ACCOUNT_ID, session_id: SESSION_ID, exp }),
    refreshToken: "refresh-token-value",
    userId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    email: "person@example.test",
    ...overrides,
  };
}

export const ok = <T>(value: T): ServiceOutcome<T> => ({ ok: true, value });
export const rejected = (code = "rejected", status = 400): ServiceOutcome<never> => ({
  ok: false,
  kind: "rejected",
  code,
  status,
});
export const unavailable: ServiceOutcome<never> = { ok: false, kind: "unavailable" };

export type Call = { name: string; args: unknown[] };

export type FakeService = SignInService & { calls: Call[] };

export function fakeService(overrides: Partial<SignInService> = {}): FakeService {
  const calls: Call[] = [];
  const record =
    <A extends unknown[], R>(name: string, fallback: (...args: A) => R) =>
    (...args: A): R => {
      calls.push({ name, args });
      return fallback(...args);
    };
  return {
    calls,
    passwordSignIn: record("passwordSignIn", (...args: [string, string]) =>
      (overrides.passwordSignIn ?? (async () => ok(fakeSession())))(...args),
    ),
    refresh: record("refresh", (token: string) =>
      (overrides.refresh ?? (async () => ok(fakeSession())))(token),
    ),
    signOut: record("signOut", (token: string) =>
      (overrides.signOut ?? (async () => ok(null)))(token),
    ),
    requestRecovery: record("requestRecovery", (email: string) =>
      (overrides.requestRecovery ?? (async () => ok(null)))(email),
    ),
    verifyRecovery: record("verifyRecovery", (hash: string) =>
      (overrides.verifyRecovery ?? (async () => ok(fakeSession())))(hash),
    ),
    updatePassword: record("updatePassword", (token: string, password: string) =>
      (overrides.updatePassword ?? (async () => ok(null)))(token, password),
    ),
  };
}

export type AdminHandlers = Partial<
  Record<AdminFunctionName, (args: Record<string, unknown>) => ServiceOutcome<AdminFunctionResult>>
>;

export const envelope = (
  state: string,
  code: string | null = null,
  reference: string | null = null,
  fields: Record<string, unknown> = {},
): ServiceOutcome<AdminFunctionResult> => ({ ok: true, value: { state, code, reference, fields } });

export type FakeAdmin = AdminAccess & { calls: Call[] };

export function fakeAdmin(
  handlers: AdminHandlers = {},
  users: Partial<Pick<AdminAccess, "createUser" | "setPassword" | "setBan" | "deleteUser">> = {},
): FakeAdmin {
  const calls: Call[] = [];
  return {
    calls,
    async createUser(input) {
      calls.push({ name: "createUser", args: [input] });
      return (users.createUser ?? (async () => ok({ id: ACCOUNT_ID })))(input);
    },
    async setPassword(id, password) {
      calls.push({ name: "setPassword", args: [id, password] });
      return (users.setPassword ?? (async () => ok(null)))(id, password);
    },
    async setBan(id, banned) {
      calls.push({ name: "setBan", args: [id, banned] });
      return (users.setBan ?? (async () => ok(null)))(id, banned);
    },
    async deleteUser(id) {
      calls.push({ name: "deleteUser", args: [id] });
      return (users.deleteUser ?? (async () => ok(null)))(id);
    },
    async callFunction(name, args) {
      calls.push({ name, args: [args] });
      const handler = handlers[name];
      return handler ? handler(args as Record<string, unknown>) : envelope("success", "ok");
    },
  };
}

export type FakeDatabase = DatabaseClient & {
  operations: { name: string; args: Record<string, unknown>; token: string | undefined }[];
};

/** A database client whose `current_session_is_active` and named operations answer as configured. */
export function fakeDatabase(
  options: {
    active?: boolean | "unavailable";
    operation?: (
      name: string,
      args: Record<string, unknown>,
    ) => ApplicationResult<OperationOutcome>;
  } = {},
): FakeDatabase {
  const operations: FakeDatabase["operations"] = [];
  const build = (token: string | undefined): FakeDatabase => ({
    schema: "public",
    operations,
    async callOperation(name, args) {
      operations.push({ name, args: { ...args }, token });
      return (
        options.operation?.(name, { ...args }) ??
        success<OperationOutcome>({ reference: "33333333-3333-4333-8333-333333333333", code: null })
      );
    },
    async read<T>(
      run: (client: never) => PromiseLike<DatabaseResponse<T>>,
      retry: { idempotencyKey: string; action: string },
    ): Promise<ApplicationResult<T>> {
      if (options.active === "unavailable") return retryableFailure<T>(retry);
      const response = await run({
        rpc: async () => ({ data: options.active ?? true, error: null }),
      } as never);
      return success(response.data as T);
    },
    forSession: (accessToken: string) => build(accessToken),
  });
  return build(undefined);
}

export type RecordedEvent = { event: string; subject: unknown; code: string | undefined };

export function recordingEvents(): EventEmitter & { events: RecordedEvent[] } {
  const events: RecordedEvent[] = [];
  return {
    events,
    emit(event, subject, code) {
      events.push({ event, subject, code });
    },
  };
}

export function fakeMailer(
  fail = false,
): InvitationMailer & { sent: { to: string; link: string }[] } {
  const sent: { to: string; link: string }[] = [];
  return {
    sent,
    async sendInvitation(to, link) {
      if (fail) return { ok: false, reason: "mail_unavailable" };
      sent.push({ to, link });
      return { ok: true };
    },
  };
}
