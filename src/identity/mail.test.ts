import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { describe, it } from "node:test";
import { COPY } from "./copy.ts";
import {
  buildInvitationMessage,
  buildNoticeMessage,
  createInvitationMailer,
  createNoticeMailer,
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

describe("notice email (outbox)", () => {
  const input = {
    to: "person@example.test",
    title: "Emlékeztető: <takarítás>",
    itemName: "Benti takarítás & rend",
    itemDate: "2026. 11. 20.",
    path: "/szulo/feladatok/abc",
  };
  const base = "http://127.0.0.1:3000";

  it("uses the title as the subject and holds item, date, link and the automatic-email line", () => {
    const message = buildNoticeMessage(input, base);
    assert.equal(message.subject, input.title);
    assert.equal(message.to, input.to);
    for (const part of [input.itemName, input.itemDate, `${base}/szulo/feladatok/abc`]) {
      assert.ok(message.text.includes(part), part);
    }
    assert.ok(message.text.includes(COPY.mail.deliveryAutomatic));
    assert.ok(message.html.includes("Benti takarítás &amp; rend"));
    assert.ok(!message.html.includes("<takarítás>"));
  });

  const mailerWith = (send: MailTransport["send"], timeoutMs?: number) =>
    createNoticeMailer({
      transport: { send },
      from: "sender@example.test",
      appUrl: base,
      timeoutMs,
    });

  it("sends once as the configured sender", async () => {
    const sent: unknown[] = [];
    const outcome = await mailerWith(async (message) => void sent.push(message)).sendNotice(input);
    assert.deepEqual(outcome, { ok: true });
    assert.equal((sent[0] as { from: string }).from, "sender@example.test");
  });

  it("maps a server outage to mail_unavailable and a permanent refusal to mail_rejected, without the error text", async () => {
    const down = await mailerWith(async () => {
      throw new Error("connect ECONNREFUSED person@example.test");
    }).sendNotice(input);
    assert.deepEqual(down, { ok: false, reason: "mail_unavailable" });
    const rejected = await mailerWith(async () => {
      throw Object.assign(new Error("550 person@example.test unknown"), { responseCode: 550 });
    }).sendNotice(input);
    assert.deepEqual(rejected, { ok: false, reason: "mail_rejected" });
    const temporary = await mailerWith(async () => {
      throw Object.assign(new Error("451 try later"), { responseCode: 451 });
    }).sendNotice(input);
    assert.deepEqual(temporary, { ok: false, reason: "mail_unavailable" });
    assert.ok(!JSON.stringify([down, rejected, temporary]).includes("example.test"));
  });

  it("gives up on a slow server after the overall timeout", async () => {
    const outcome = await mailerWith(() => new Promise<void>(() => undefined), 20).sendNotice(
      input,
    );
    assert.deepEqual(outcome, { ok: false, reason: "mail_unavailable" });
  });
});

describe("notice email, blank parts and aborting", () => {
  const base = "http://127.0.0.1:3000";
  const input = {
    to: "person@example.test",
    title: "Beosztás közzétéve",
    itemName: "",
    itemDate: "",
    path: "/szulo/beosztas",
  };

  it("leaves out the item and date lines when there is no name or date", () => {
    const message = buildNoticeMessage(input, base);
    assert.ok(!message.text.includes(COPY.mail.deliveryItem));
    assert.ok(!message.text.includes(COPY.mail.deliveryDate));
    assert.ok(!message.html.includes(COPY.mail.deliveryItem));
    assert.ok(!message.html.includes(COPY.mail.deliveryDate));
    assert.ok(message.text.includes(`${base}/szulo/beosztas`));
    const dated = buildNoticeMessage({ ...input, itemName: "Sütés", itemDate: " " }, base);
    assert.ok(dated.text.includes(`${COPY.mail.deliveryItem} Sütés`));
    assert.ok(!dated.text.includes(COPY.mail.deliveryDate));
  });

  it("aborts the send when the timeout passes, so it cannot finish later", async () => {
    let signal: AbortSignal | undefined;
    const transport: MailTransport = {
      send: (_message, options) => {
        signal = options?.signal;
        return new Promise<void>(() => undefined);
      },
    };
    const outcome = await createNoticeMailer({
      transport,
      from: "sender@example.test",
      appUrl: base,
      timeoutMs: 20,
    }).sendNotice({ ...input, itemName: "Sütés" });
    assert.deepEqual(outcome, { ok: false, reason: "mail_unavailable" });
    assert.equal(signal?.aborted, true);
  });

  it("does not abort a send that finished in time", async () => {
    let signal: AbortSignal | undefined;
    const transport: MailTransport = {
      send: async (_message, options) => {
        signal = options?.signal;
      },
    };
    await createNoticeMailer({ transport, from: "sender@example.test", appUrl: base }).sendNotice(
      input,
    );
    assert.equal(signal?.aborted, false);
  });

  it("closes the real SMTP connection when the send is aborted", async () => {
    let closed: () => void = () => undefined;
    const gone = new Promise<void>((resolve) => (closed = resolve));
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      sockets.push(socket);
      socket.write("220 stalled ESMTP\r\n"); // greets, then never answers
      socket.resume(); // read the client's words so its closing is noticed
      socket.on("close", closed);
      socket.on("error", () => undefined);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const controller = new AbortController();
    const sending = createSmtpTransport({ host: "127.0.0.1", port }).send(
      {
        to: "person@example.test",
        subject: "x",
        text: "x",
        html: "<p>x</p>",
        from: "sender@example.test",
      },
      { signal: controller.signal },
    );
    sending.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();
    await gone;
    await assert.rejects(sending);
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
