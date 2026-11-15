import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
import { createSmtpTransport } from "../../src/identity/mail.ts";
import { main } from "../../scripts/timed-run.ts";
import {
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  TASK_1,
} from "./directory-support.ts";
import { serviceKey, stackSettings } from "./stack-support.ts";

const SCHEMA = "worker_3";
const MAIL_API = "http://127.0.0.1:54324/api/v1";
const APP_URL = "http://127.0.0.1:3000";

type Message = {
  To: { Address: string }[];
  Cc: unknown[] | null;
  Bcc: unknown[] | null;
  Subject: string;
  Text: string;
  HTML: string;
};

async function newestTo(address: string): Promise<Message | undefined> {
  const search = await fetch(`${MAIL_API}/search?query=${encodeURIComponent(`to:${address}`)}`);
  const found = (await search.json()) as { messages: { ID: string }[] };
  const first = found.messages[0];
  if (!first) return undefined;
  return (await (await fetch(`${MAIL_API}/message/${first.ID}`)).json()) as Message;
}

/**
 * The notice mailer, the timed command and the real local mail catcher together: two families each get one sign-up
 * confirmation, the command sends them over SMTP, and the caught message of one family holds the title, the item, the
 * link and the automatic-email line, one recipient, and nothing of the other family.
 */
describe("a notice email through the local mail catcher", () => {
  let db: pg.Client;
  const first = `identity.${PARENT_F1}@example.test`;
  const second = `identity.${PARENT_F2}@example.test`;

  before(async () => {
    db = await openDirectoryDatabase(SCHEMA);
  });
  after(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await seedCoordinationWorld(db, SCHEMA);
  });

  it("delivers the fixed template to one recipient and reveals no other family", async () => {
    const settings = stackSettings();
    await db.query("select notice_send($1::uuid[], 'sign_up_confirmed', 'task', $2, $3)", [
      [PARENT_ROW_F1],
      TASK_1,
      `catcher-one-${Date.now()}`,
    ]);
    await db.query("select notice_send($1::uuid[], 'sign_up_confirmed', 'task', $2, $3)", [
      [PARENT_ROW_F2],
      TASK_1,
      `catcher-two-${Date.now()}`,
    ]);
    const logs: string[] = [];
    const code = await main(["--mode", "deliver"], {
      environment: {
        SUPABASE_URL: settings.apiUrl,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey(),
        DATABASE_SCHEMA: SCHEMA,
        APP_PUBLIC_URL: APP_URL,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "54325",
        SMTP_FROM: "no-reply@example.test",
      },
      readFile: () => undefined,
      createAdmin: createAdminAccess,
      createTransport: createSmtpTransport,
      now: () => Date.now(),
      log: (line) => logs.push(line),
    });
    assert.equal(code, 0, logs.join("\n"));
    assert.ok(logs.includes("emails_sent=2 emails_failed=0 cancelled=0"), logs.join("\n"));
    assert.ok(!logs.join("\n").includes("example.test"), "the command log holds no address");

    const message = await newestTo(first);
    assert.ok(message, "the first family's email reached the catcher");
    assert.equal(message.To.length, 1);
    assert.equal(message.To[0]!.Address, first);
    assert.ok(!message.Cc?.length && !message.Bcc?.length);
    assert.equal(message.Subject, "Jelentkezés megerősítve: Sütés");
    assert.match(message.Text, /Sütés/);
    assert.ok(message.Text.includes(`${APP_URL}/szulo/feladatok/${TASK_1}`));
    assert.match(message.Text, /automatikusan küldte/);
    for (const part of [message.Text, message.HTML, message.Subject]) {
      assert.ok(!part.includes(second) && !part.includes(PARENT_F2), "no other family's detail");
    }
    const other = await newestTo(second);
    assert.ok(other && other.To.length === 1 && !other.Text.includes(first));
    const states = (
      await db.query("select status, count(*)::int as n from email_deliveries group by 1")
    ).rows;
    assert.deepEqual(states, [{ status: "sent", n: 2 }]);
  });
});
