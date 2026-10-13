import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { describe, it } from "node:test";
import { COPY } from "./copy.ts";
import {
  buildInvitationMessage,
  createInvitationMailer,
  createSmtpTransport,
  type MailTransport,
} from "./mail.ts";

describe("invitation email (BR2.10, NFR2.3)", () => {
  const link = "http://127.0.0.1:3000/meghivas/TOKEN-VALUE";

  it("is Hungarian, carries the link once in text and html, and escapes the html", () => {
    const message = buildInvitationMessage("person@example.test", `${link}?a=1&b="2"`);
    assert.equal(message.subject, COPY.mail.invitationSubject);
    assert.ok(message.text.includes(`${link}?a=1&b="2"`));
    assert.ok(message.html.includes("&amp;b=&quot;2&quot;"));
    assert.ok(message.html.includes(COPY.mail.invitationLinkLabel));
    assert.ok(message.text.includes(COPY.mail.invitationValidity));
    assert.equal(message.to, "person@example.test");
  });

  it("sends through the transport as the configured sender", async () => {
    const sent: unknown[] = [];
    const transport: MailTransport = { send: async (message) => void sent.push(message) };
    const mailer = createInvitationMailer({ transport, from: "sender@example.test" });
    assert.deepEqual(await mailer.sendInvitation("person@example.test", link), { ok: true });
    assert.equal((sent[0] as { from: string }).from, "sender@example.test");
    assert.equal((sent[0] as { to: string }).to, "person@example.test");
  });

  it("reports a failure without the address, the link or the server's words", async () => {
    const transport: MailTransport = {
      send: async () => {
        throw new Error("550 mailbox person@example.test refused " + link);
      },
    };
    const outcome = await createInvitationMailer({
      transport,
      from: "sender@example.test",
    }).sendInvitation("person@example.test", link);
    assert.deepEqual(outcome, { ok: false, reason: "mail_unavailable" });
    assert.equal(JSON.stringify(outcome).includes("example.test"), false);
  });

  it("speaks SMTP to a local server, and fails cleanly when none is listening", async () => {
    const received: string[] = [];
    const server = createServer((socket: Socket) => {
      socket.write("220 test ESMTP\r\n");
      let data = false;
      socket.on("data", (chunk) => {
        const text = String(chunk);
        received.push(text);
        if (data) {
          if (text.includes("\r\n.\r\n")) {
            data = false;
            socket.write("250 queued\r\n");
          }
          return;
        }
        for (const line of text.split("\r\n").filter(Boolean)) {
          const command = line.slice(0, 4).toUpperCase();
          if (command === "EHLO" || command === "HELO") socket.write("250 test\r\n");
          else if (command === "DATA") {
            data = true;
            socket.write("354 go\r\n");
          } else if (command === "QUIT") socket.end("221 bye\r\n");
          else socket.write("250 ok\r\n");
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const mailer = createInvitationMailer({
        transport: createSmtpTransport({ host: "127.0.0.1", port }),
        from: "sender@example.test",
      });
      assert.deepEqual(await mailer.sendInvitation("person@example.test", link), { ok: true });
      assert.ok(received.join("").includes("TOKEN-VALUE"));
    } finally {
      server.close();
    }
    const closed = createInvitationMailer({
      transport: createSmtpTransport({ host: "127.0.0.1", port }),
      from: "sender@example.test",
    });
    assert.deepEqual(await closed.sendInvitation("person@example.test", link), {
      ok: false,
      reason: "mail_unavailable",
    });
  });
});
