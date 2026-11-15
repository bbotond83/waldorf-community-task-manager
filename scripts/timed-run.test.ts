import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminAccess } from "../src/identity/admin-client.ts";
import type { NoticeMailer } from "../src/identity/mail.ts";
import { BATCH_SIZE, main, PASS_LIMIT, type TimedRunDeps } from "./timed-run.ts";

type Call = { name: string; args: Record<string, unknown> };

const ENVIRONMENT = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-key-for-tests-only",
  APP_PUBLIC_URL: "http://127.0.0.1:3000",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "54325",
  SMTP_FROM: "sender@example.test",
};

function item(index: number, email = `parent${index}@example.test`) {
  return {
    delivery_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    round: 1,
    attempt: 1,
    email,
    title: "Emlékeztető",
    item_name: "Takarítás",
    item_date: "2026. 11. 20.",
    path: "/szulo/ertesitesek",
  };
}

function world(options: {
  due?: number;
  checks?: Record<string, unknown>[];
  mail?: (to: string) => { ok: true } | { ok: false; reason: "mail_unavailable" | "mail_rejected" };
  noSession?: boolean;
  clock?: () => number;
  email?: (index: number) => string;
}) {
  const calls: Call[] = [];
  const logs: string[] = [];
  let remaining = options.due ?? 0;
  let index = 0;
  const admin: AdminAccess = {
    createUser: async () => ({ ok: false, kind: "unavailable" }),
    setPassword: async () => ({ ok: false, kind: "unavailable" }),
    setBan: async () => ({ ok: false, kind: "unavailable" }),
    deleteUser: async () => ({ ok: false, kind: "unavailable" }),
    async callFunction(name, args) {
      calls.push({ name, args: args as Record<string, unknown> });
      if (options.noSession) {
        return {
          ok: true,
          value: { state: "denied", reference: null, code: "authorization_denied", fields: {} },
        };
      }
      const ok = (fields: Record<string, unknown>) => ({
        ok: true as const,
        value: { state: "success", reference: null, code: null, fields },
      });
      if (name === "notice_email_sweep") return ok({ swept: 2 });
      if (name === "timed_checks_run_system") return ok({ checks: options.checks ?? [] });
      if (name === "notice_email_claim") {
        const take = Math.min(Number(args.p_limit), remaining);
        remaining -= take;
        const items = Array.from({ length: take }, () => {
          index += 1;
          return item(index, options.email?.(index));
        });
        return ok({ items, cancelled: 0 });
      }
      return ok({ status: "sent" });
    },
  };
  const mailer: NoticeMailer = {
    async sendNotice(input) {
      return options.mail ? options.mail(input.to) : { ok: true };
    },
  };
  const deps: TimedRunDeps = {
    environment: ENVIRONMENT,
    readFile: () => undefined,
    createAdmin: () => admin,
    createTransport: () => ({ send: async () => undefined }),
    createMailer: () => mailer,
    now: options.clock ?? (() => 0),
    log: (line) => logs.push(line),
  };
  return { deps, calls, logs };
}

describe("timed run command", () => {
  it("sweeps first, runs the daily checks, then sends every due email and records each", async () => {
    const w = world({ due: 3, checks: [{ check: "a", outcome: "success", created: 2 }] });
    assert.equal(await main(["--mode", "daily"], w.deps), 0);
    assert.deepEqual(
      w.calls.slice(0, 3).map((call) => call.name),
      ["notice_email_sweep", "timed_checks_run_system", "notice_email_claim"],
    );
    const records = w.calls.filter((call) => call.name === "notice_email_record");
    assert.equal(records.length, 3);
    assert.ok(
      records.every((call) => call.args.p_outcome === "sent" && call.args.p_reason === null),
    );
    assert.ok(w.logs.includes("emails_sent=3 emails_failed=0 cancelled=0"));
    assert.ok(w.logs.includes("checks=1 created=2 failed=0"));
  });

  it("does not run checks in deliver mode", async () => {
    const w = world({ due: 1 });
    assert.equal(await main(["--mode", "deliver"], w.deps), 0);
    assert.ok(!w.calls.some((call) => call.name === "timed_checks_run_system"));
  });

  it("records an unavailable server and a rejection by class, exits non-zero, and logs no address", async () => {
    const w = world({
      due: 2,
      mail: (to) =>
        to.startsWith("parent1@")
          ? { ok: false, reason: "mail_unavailable" }
          : { ok: false, reason: "mail_rejected" },
    });
    assert.equal(await main(["--mode", "deliver"], w.deps), 1);
    const records = w.calls.filter((call) => call.name === "notice_email_record");
    assert.deepEqual(
      records.map((call) => [call.args.p_outcome, call.args.p_reason]),
      [
        ["failed", "mail_unavailable"],
        ["failed", "mail_rejected"],
      ],
    );
    assert.ok(w.logs.includes("notice_mail_failed reason=mail_unavailable"));
    assert.ok(!w.logs.join("\n").includes("example.test"));
  });

  it("takes at most 50 of 60 due emails in one pass, in batches of 10", async () => {
    const w = world({ due: 60 });
    assert.equal(await main(["--mode", "deliver"], w.deps), 0);
    const claims = w.calls.filter((call) => call.name === "notice_email_claim");
    assert.equal(claims.length, PASS_LIMIT / BATCH_SIZE);
    assert.ok(claims.every((call) => call.args.p_limit === BATCH_SIZE));
    assert.equal(w.calls.filter((call) => call.name === "notice_email_record").length, PASS_LIMIT);
  });

  it("starts no new batch after 2 minutes", async () => {
    let time = 0;
    const w = world({ due: 60, clock: () => (time += 70_000) });
    await main(["--mode", "deliver"], w.deps);
    assert.ok(w.calls.filter((call) => call.name === "notice_email_claim").length < 5);
  });

  it("exits non-zero when a check failed or is missing", async () => {
    const w = world({
      checks: [
        { check: "a", outcome: "failed", created: 0 },
        { check: "b", outcome: "missing", created: 0 },
      ],
    });
    assert.equal(await main(["--mode", "friday_noon"], w.deps), 1);
    assert.ok(w.logs.includes("checks=2 created=0 failed=2"));
  });

  it("still sends the due emails when the run call itself fails, then exits non-zero", async () => {
    const w = world({ due: 2 });
    const inner = w.deps.createAdmin({ url: "", serviceKey: "", schema: "" });
    w.deps.createAdmin = () => ({
      ...inner,
      callFunction: async (name, args) =>
        name === "timed_checks_run_system"
          ? { ok: false, kind: "unavailable" }
          : inner.callFunction(name, args),
    });
    assert.equal(await main(["--mode", "daily"], w.deps), 1);
    assert.ok(
      w.logs.some((line) => line.startsWith("timed_run_failed step=timed_checks_run_system")),
    );
    assert.ok(w.logs.includes("emails_sent=2 emails_failed=0 cancelled=0"));
  });

  it("stops with a non-zero exit and no person data when the service is refused", async () => {
    const w = world({ noSession: true, due: 1 });
    assert.equal(await main(["--mode", "daily"], w.deps), 1);
    assert.equal(w.calls.length, 1);
    assert.ok(w.logs[0]!.startsWith("timed_run_failed step=notice_email_sweep"));
  });

  it("refuses an unknown mode and missing settings, naming the setting only", async () => {
    const w = world({});
    assert.equal(await main(["--mode", "weekly"], w.deps), 1);
    assert.equal(w.logs[0], "timed_run_failed step=arguments setting=mode");
    const bare = world({});
    bare.deps.environment = {};
    assert.equal(await main(["--mode", "daily"], bare.deps), 1);
    assert.equal(bare.logs[0], "timed_run_failed step=settings setting=SUPABASE_URL");
    const mailless = world({});
    mailless.deps.environment = { ...ENVIRONMENT, SMTP_FROM: "" };
    assert.equal(await main(["--mode", "daily"], mailless.deps), 1);
    assert.equal(mailless.logs[0], "timed_run_failed step=settings setting=SMTP_FROM");
  });

  it("prints help", async () => {
    const w = world({});
    assert.equal(await main(["--help"], w.deps), 0);
    assert.ok(w.logs[0]!.includes("--mode"));
  });
});
