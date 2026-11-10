/**
 * Public surface of the database adapters (src/data): what the production composition imports.
 */
export {
  ADMIN_NOTIFICATION_USE_CASES,
  createAdminPort,
  DATABASE_ADMIN_OPERATIONS,
} from "./admin-port.ts";
export { classifyDataFailure, RetryableDataFailure, TerminalDataFailure } from "./errors.ts";
export { createParentPort, PARENT_NOTIFICATION_USE_CASES } from "./parent-port.ts";
export { BUSINESS_CODE_STATES, type BusinessCode } from "./results.ts";
export {
  createVersionPort,
  readAccessContext,
  toSessionContext,
  type AccessContext,
  type ParentLink,
} from "./session.ts";
export { createTeacherPort } from "./teacher-port.ts";
export { createWorkingGroupPort } from "./working-groups.ts";

import { ADMIN_NOTIFICATION_USE_CASES } from "./admin-port.ts";
import { PARENT_NOTIFICATION_USE_CASES } from "./parent-port.ts";

/**
 * The use cases U4 must connect to notifications (BR31.10): every use case that changes a family's
 * assignments. U3 creates no notification record and no outbox table; U4 adds the writes inside these same
 * database functions. The test in `src/data/notification-use-cases.test.ts` compares this list with the
 * functions of the database that change assignments, so a new one cannot be added unnoticed.
 */
export const NOTIFICATION_USE_CASES = Object.freeze([
  ...PARENT_NOTIFICATION_USE_CASES,
  ...ADMIN_NOTIFICATION_USE_CASES,
] as const);

/**
 * The functions outside that list that U4's table of BR40.9 also gives a behaviour: they change no assignment,
 * but they change what the reminder jobs and recipients must look like (the event, the reminder setting, the
 * lifecycle) or are the counterpart of a listed one (restoring a family creates nothing). The hand-off test
 * (`tests/database/notifications-handoff.test.ts`) runs every entry of both lists.
 */
export const NOTIFICATION_EXTRA_FUNCTIONS = Object.freeze([
  "event.save",
  "settings.save",
  "lifecycle.run",
  "family.restore",
] as const);
