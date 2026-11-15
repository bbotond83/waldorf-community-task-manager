import { connect, type Socket } from "node:net";
import nodemailer from "nodemailer";
import { COPY } from "./copy.ts";

/**
 * Outgoing invitation email (BR2.10, NFR2.3). The sign-in service's own invitation email cannot carry the
 * app's token link, so the application sends it itself over SMTP to the stack's mail server (the local mail
 * catcher locally). One function, one sender. A failure is reported as an explicit outcome and never
 * includes the address, the link or the server's response text.
 */
export type MailMessage = Readonly<{ to: string; subject: string; text: string; html: string }>;

export interface MailTransport {
  /** `signal`: when it aborts, the send is stopped (connection closed) so it cannot finish later. */
  send(message: MailMessage & { from: string }, options?: { signal?: AbortSignal }): Promise<void>;
}

export type MailOutcome = { ok: true } | { ok: false; reason: "mail_unavailable" };

export interface InvitationMailer {
  sendInvitation(to: string, link: string): Promise<MailOutcome>;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildInvitationMessage(to: string, link: string): MailMessage {
  const c = COPY.mail;
  const text = [
    c.invitationGreeting,
    "",
    c.invitationBody,
    link,
    "",
    c.invitationValidity,
    c.invitationIgnore,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(c.invitationGreeting)}</p>`,
    `<p>${escapeHtml(c.invitationBody)}</p>`,
    `<p><a href="${escapeHtml(link)}">${escapeHtml(c.invitationLinkLabel)}</a></p>`,
    `<p>${escapeHtml(c.invitationValidity)}</p>`,
    `<p>${escapeHtml(c.invitationIgnore)}</p>`,
  ].join("\n");
  return { to, subject: c.invitationSubject, text, html };
}

export function createSmtpTransport(options: { host: string; port: number }): MailTransport {
  // The local mail catcher speaks plain SMTP; any other server must be reached over TLS.
  const local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(options.host);
  const base = {
    host: options.host,
    port: options.port,
    secure: false,
    ignoreTLS: local,
    requireTLS: !local,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  };
  return {
    async send(message, sendOptions) {
      const signal = sendOptions?.signal;
      if (signal?.aborted) throw new Error("aborted");
      // One connection per send, opened here, so an abort can destroy it and nothing finishes later.
      let socket: Socket | undefined;
      const single = nodemailer.createTransport({
        ...base,
        getSocket(
          _options: unknown,
          done: (error: Error | null, result?: { connection: Socket }) => void,
        ) {
          const opened = connect({ host: options.host, port: options.port });
          socket = opened;
          let answered = false;
          opened.once("connect", () => {
            answered = true;
            done(null, { connection: opened });
          });
          opened.once("error", (error) => {
            if (!answered) done(error);
          });
        },
      });
      const stop = () => {
        socket?.destroy();
        single.close();
      };
      signal?.addEventListener("abort", stop, { once: true });
      try {
        await single.sendMail(message);
      } finally {
        signal?.removeEventListener("abort", stop);
        single.close();
      }
    },
  };
}

/** Account mail (BR34): the link for a new address, and the notice that goes to the address being replaced. */
export interface AccountMailer {
  sendEmailChangeLink(to: string, link: string): Promise<MailOutcome>;
  sendEmailChangeNotice(to: string): Promise<MailOutcome>;
}

export function buildEmailChangeMessage(to: string, link: string): MailMessage {
  const c = COPY.mail;
  const text = [
    c.emailChangeGreeting,
    "",
    c.emailChangeBody,
    link,
    "",
    c.emailChangeValidity,
    c.emailChangeIgnore,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(c.emailChangeGreeting)}</p>`,
    `<p>${escapeHtml(c.emailChangeBody)}</p>`,
    `<p><a href="${escapeHtml(link)}">${escapeHtml(c.emailChangeLinkLabel)}</a></p>`,
    `<p>${escapeHtml(c.emailChangeValidity)}</p>`,
    `<p>${escapeHtml(c.emailChangeIgnore)}</p>`,
  ].join("\n");
  return { to, subject: c.emailChangeSubject, text, html };
}

export function buildEmailChangeNoticeMessage(to: string): MailMessage {
  const c = COPY.mail;
  const text = [c.noticeGreeting, "", c.noticeBody, c.noticeContact].join("\n");
  const html = [c.noticeGreeting, c.noticeBody, c.noticeContact]
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
  return { to, subject: c.noticeSubject, text, html };
}

export function createAccountMailer(options: {
  transport: MailTransport;
  from: string;
}): AccountMailer {
  const deliver = async (message: MailMessage): Promise<MailOutcome> => {
    try {
      await options.transport.send({ ...message, from: options.from });
      return { ok: true };
    } catch {
      return { ok: false, reason: "mail_unavailable" };
    }
  };
  return {
    sendEmailChangeLink: (to, link) => deliver(buildEmailChangeMessage(to, link)),
    sendEmailChangeNotice: (to) => deliver(buildEmailChangeNoticeMessage(to)),
  };
}

export function createInvitationMailer(options: {
  transport: MailTransport;
  from: string;
}): InvitationMailer {
  return {
    async sendInvitation(to, link) {
      try {
        await options.transport.send({ ...buildInvitationMessage(to, link), from: options.from });
        return { ok: true };
      } catch {
        return { ok: false, reason: "mail_unavailable" };
      }
    },
  };
}

/**
 * Notice email (outbox): one fixed template, one recipient. The subject is the notice title; the body holds the
 * item name, its date and a link built from the app's public address. A failure is reduced to a reason class and
 * the library's text is dropped, because it can hold the address.
 */
export type NoticeMailInput = Readonly<{
  to: string;
  title: string;
  itemName: string;
  itemDate: string;
  path: string;
}>;

export type NoticeMailOutcome =
  { ok: true } | { ok: false; reason: "mail_unavailable" | "mail_rejected" };

export interface NoticeMailer {
  sendNotice(input: NoticeMailInput): Promise<NoticeMailOutcome>;
}

export function buildNoticeMessage(input: NoticeMailInput, appUrl: string): MailMessage {
  const c = COPY.mail;
  const link = new URL(input.path, appUrl).toString();
  // A rota notice has no date and a deleted item has no name: the bare label is left out.
  const name = input.itemName.trim();
  const date = input.itemDate.trim();
  const lines = [
    c.deliveryGreeting,
    ...(name ? [`${c.deliveryItem} ${name}`] : []),
    ...(date ? [`${c.deliveryDate} ${date}`] : []),
    `${c.deliveryLink} ${link}`,
    c.deliveryAutomatic,
  ];
  const html = [
    `<p>${escapeHtml(c.deliveryGreeting)}</p>`,
    ...(name ? [`<p>${escapeHtml(c.deliveryItem)} ${escapeHtml(name)}</p>`] : []),
    ...(date ? [`<p>${escapeHtml(c.deliveryDate)} ${escapeHtml(date)}</p>`] : []),
    `<p>${escapeHtml(c.deliveryLink)} <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
    `<p>${escapeHtml(c.deliveryAutomatic)}</p>`,
  ].join("\n");
  return { to: input.to, subject: input.title, text: lines.join("\n"), html };
}

export const NOTICE_MAIL_TIMEOUT_MS = 30_000;

export function createNoticeMailer(options: {
  transport: MailTransport;
  from: string;
  appUrl: string;
  timeoutMs?: number;
}): NoticeMailer {
  const timeoutMs = options.timeoutMs ?? NOTICE_MAIL_TIMEOUT_MS;
  return {
    async sendNotice(input) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      // After the timeout the send is aborted, so a late delivery cannot happen next to the retry of the same email.
      const controller = new AbortController();
      try {
        const message = buildNoticeMessage(input, options.appUrl);
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("timeout"));
          }, timeoutMs);
        });
        const sending = options.transport.send(
          { ...message, from: options.from },
          { signal: controller.signal },
        );
        sending.catch(() => undefined);
        await Promise.race([sending, timeout]);
        return { ok: true };
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "responseCode" in error
            ? Number((error as { responseCode: unknown }).responseCode)
            : 0;
        return { ok: false, reason: code >= 500 ? "mail_rejected" : "mail_unavailable" };
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
