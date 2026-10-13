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
  send(message: MailMessage & { from: string }): Promise<void>;
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
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: false,
    ignoreTLS: local,
    requireTLS: !local,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });
  return {
    async send(message) {
      await transporter.sendMail(message);
    },
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
