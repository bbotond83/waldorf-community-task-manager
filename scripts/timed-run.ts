import { readFileSync } from "node:fs";
import { createAdminAccess, type AdminAccess } from "../src/identity/admin-client.ts";
import {
  createNoticeMailer,
  createSmtpTransport,
  type MailTransport,
  type NoticeMailer,
} from "../src/identity/mail.ts";
import { readIdentitySettings } from "../src/runtime/database/config.ts";
import {
  parseArguments,
  parseEnvFile,
  PUBLIC_ENV_FILE,
  runAsCommand,
  SERVICE_ENV_FILE,
  type Log,
} from "./db/common.ts";

export const TIMED_RUN_HELP = `Usage: npm run timed:run -- --mode <daily|friday_noon|deliver> [--schema <name>]

The scheduled job of the notice system. It never needs a signed-in person; it acts as the service.

  daily        sweep stuck emails, run the daily checks, then send the due emails
  friday_noon  sweep stuck emails, run the Friday-noon checks, then send the due emails
  deliver      sweep stuck emails, then send the due emails (no checks)

Sending takes the due emails in batches of 10, at most 50 in one pass, and starts no new batch after
2 minutes. The output holds counts only: no address, name, title or server text. The exit code is
not zero when a check failed or was missing, or an email could not be sent.

Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_PUBLIC_URL, SMTP_HOST, SMTP_PORT, SMTP_FROM and
DATABASE_SCHEMA from the environment, or from the git-ignored files ${PUBLIC_ENV_FILE} and
${SERVICE_ENV_FILE}.`;

export const BATCH_SIZE = 10;
export const PASS_LIMIT = 50;
export const BATCH_WINDOW_MS = 2 * 60 * 1000;

const MODES = ["daily", "friday_noon", "deliver"] as const;
type Mode = (typeof MODES)[number];

export interface TimedRunDeps {
  environment: Readonly<Record<string, string | undefined>>;
  readFile: (path: string) => string | undefined;
  createAdmin: (options: { url: string; serviceKey: string; schema: string }) => AdminAccess;
  createTransport: (options: { host: string; port: number }) => MailTransport;
  createMailer?: (options: {
    transport: MailTransport;
    from: string;
    appUrl: string;
  }) => NoticeMailer;
  now: () => number;
  log: Log;
}

export function defaultTimedRunDeps(): TimedRunDeps {
  return {
    environment: process.env,
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    createAdmin: createAdminAccess,
    createTransport: createSmtpTransport,
    now: () => Date.now(),
    log: (line) => console.log(line),
  };
}

interface Claimed {
  deliveryId: string;
  round: number;
  attempt: number;
  email: string;
  title: string;
  itemName: string;
  itemDate: string;
  path: string;
}

const asText = (value: unknown) => (typeof value === "string" ? value : "");
const asNumber = (value: unknown) => (typeof value === "number" ? value : Number(value) || 0);

function parseClaimed(items: unknown): Claimed[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
      deliveryId: asText(item.delivery_id),
      round: asNumber(item.round),
      attempt: asNumber(item.attempt),
      email: asText(item.email),
      title: asText(item.title),
      itemName: asText(item.item_name),
      itemDate: asText(item.item_date),
      path: asText(item.path),
    };
  });
}

/**
 * One scheduled pass. Returns the exit code: 0 when every check succeeded and every email was sent (or none was due),
 * 1 otherwise. Nothing that identifies a person is ever written to the log.
 */
export async function main(
  argv: readonly string[],
  deps: TimedRunDeps = defaultTimedRunDeps(),
): Promise<number> {
  const { flags } = parseArguments(argv);
  if (flags.has("help")) {
    deps.log(TIMED_RUN_HELP);
    return 0;
  }
  const mode = flags.get("mode");
  if (typeof mode !== "string" || !(MODES as readonly string[]).includes(mode)) {
    deps.log("timed_run_failed step=arguments setting=mode");
    return 1;
  }

  const fromFiles = {
    ...parseEnvFile(deps.readFile(PUBLIC_ENV_FILE) ?? ""),
    ...parseEnvFile(deps.readFile(SERVICE_ENV_FILE) ?? ""),
  };
  const environment: Record<string, string | undefined> = { ...fromFiles, ...deps.environment };
  const url = environment.SUPABASE_URL?.trim() ?? "";
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const schema =
    (typeof flags.get("schema") === "string" ? String(flags.get("schema")) : undefined) ??
    (environment.DATABASE_SCHEMA?.trim() || "public");
  if (!url || !serviceKey) {
    deps.log(
      `timed_run_failed step=settings setting=${!url ? "SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY"}`,
    );
    return 1;
  }
  const identity = readIdentitySettings(environment, url);
  if (!identity.ok) {
    deps.log(`timed_run_failed step=settings setting=${identity.error.variable}`);
    return 1;
  }

  const admin = deps.createAdmin({ url, serviceKey, schema });
  const mailer = (deps.createMailer ?? createNoticeMailer)({
    transport: deps.createTransport({
      host: identity.value.smtp.host,
      port: identity.value.smtp.port,
    }),
    from: identity.value.smtp.from,
    appUrl: identity.value.appPublicUrl,
  });

  let failed = false;
  const call = async (name: Parameters<AdminAccess["callFunction"]>[0], args: object) => {
    const outcome = await admin.callFunction(name, args as Record<string, unknown>);
    if (!outcome.ok || outcome.value.state !== "success") {
      deps.log(
        `timed_run_failed step=${name} reason=${outcome.ok ? outcome.value.state : outcome.kind}`,
      );
      return undefined;
    }
    return outcome.value.fields;
  };

  const swept = await call("notice_email_sweep", {});
  if (!swept) return 1;
  deps.log(`swept=${asNumber(swept.swept)}`);

  if (mode !== "deliver") {
    const run = await call("timed_checks_run_system", { p_run_kind: mode as Mode });
    if (!run) {
      // The run itself failed: the due emails still go out, then the exit code says it failed.
      failed = true;
    } else {
      const checks = Array.isArray(run.checks) ? (run.checks as Record<string, unknown>[]) : [];
      const bad = checks.filter((check) => check.outcome !== "success").length;
      deps.log(
        `checks=${checks.length} created=${checks.reduce((sum, check) => sum + asNumber(check.created), 0)} failed=${bad}`,
      );
      if (bad > 0) failed = true;
    }
  }

  const started = deps.now();
  let sent = 0;
  let failedMails = 0;
  let cancelled = 0;
  let taken = 0;
  while (taken < PASS_LIMIT && deps.now() - started < BATCH_WINDOW_MS) {
    const claim = await call("notice_email_claim", {
      p_limit: Math.min(BATCH_SIZE, PASS_LIMIT - taken),
    });
    if (!claim) return 1;
    cancelled += asNumber(claim.cancelled);
    const items = parseClaimed(claim.items);
    if (items.length === 0 && asNumber(claim.cancelled) === 0) break;
    taken += items.length + asNumber(claim.cancelled);
    for (const item of items) {
      const result = await mailer.sendNotice({
        to: item.email,
        title: item.title,
        itemName: item.itemName,
        itemDate: item.itemDate,
        path: item.path,
      });
      if (result.ok) sent += 1;
      else {
        failedMails += 1;
        failed = true;
        deps.log(`notice_mail_failed reason=${result.reason}`);
      }
      const recorded = await admin.callFunction("notice_email_record", {
        p_delivery_id: item.deliveryId,
        p_round: item.round,
        p_attempt: item.attempt,
        p_outcome: result.ok ? "sent" : "failed",
        p_reason: result.ok ? null : result.reason,
      });
      if (!recorded.ok || recorded.value.state !== "success") {
        deps.log("timed_run_failed step=notice_email_record");
        failed = true;
      }
    }
  }
  deps.log(`emails_sent=${sent} emails_failed=${failedMails} cancelled=${cancelled}`);
  return failed ? 1 : 0;
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
