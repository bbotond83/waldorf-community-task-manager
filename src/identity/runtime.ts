import "server-only";
import { type DatabaseClient, getDatabaseClient } from "../runtime/database/client.ts";
import {
  type IdentitySettings,
  requireDatabaseConfig,
  requireIdentitySettings,
} from "../runtime/database/config.ts";
import { type AdminAccess } from "./admin-client.ts";
import { getAdminAccess } from "./admin-runtime.ts";
import { type EventEmitter, createEventEmitter } from "./events.ts";
import { createInvitationMailer, createSmtpTransport, type InvitationMailer } from "./mail.ts";
import { createSignInService, type SignInService } from "./service.ts";

/**
 * Composition of the identity module for server actions and pages: validated configuration, the
 * sign-in service, the database client, the admin access, the mailer and the event emitter. Everything
 * here runs on the server; nothing is created at import time, so the build never needs the settings.
 */
export type IdentityRuntime = Readonly<{
  settings: IdentitySettings;
  emailKeySecret: string;
  service: SignInService;
  admin: AdminAccess;
  database: DatabaseClient;
  mailer: InvitationMailer;
  events: EventEmitter;
}>;

/** True when the database, the public address and the mail settings are all configured. */
export function isIdentityConfigured(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  try {
    const config = requireDatabaseConfig(environment);
    requireIdentitySettings(environment, config.url);
    return true;
  } catch {
    return false;
  }
}

let cached: IdentityRuntime | undefined;

export function getIdentityRuntime(): IdentityRuntime {
  if (cached) return cached;
  const config = requireDatabaseConfig(process.env);
  const settings = requireIdentitySettings(process.env, config.url);
  const events = createEventEmitter({ secret: config.sessionSecret });
  cached = {
    settings,
    emailKeySecret: config.sessionSecret,
    service: createSignInService({ url: config.url, publicKey: config.publicKey }),
    admin: getAdminAccess(),
    database: getDatabaseClient(config),
    mailer: createInvitationMailer({
      transport: createSmtpTransport({ host: settings.smtp.host, port: settings.smtp.port }),
      from: settings.smtp.from,
    }),
    events,
  };
  return cached;
}

export function resetIdentityRuntimeForTests(): void {
  cached = undefined;
}
