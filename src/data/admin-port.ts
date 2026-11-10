import type { Scope } from "../access/index.ts";
import type { AdminApplicationPort, AdminOperation, DomainOutcome } from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { changeRecordState, getRecord, listRecords, saveRecord } from "./admin-records.ts";
import {
  getSettings,
  listGrants,
  listLifecycle,
  revokeGrant,
  runLifecycle,
  saveSettings,
} from "./admin-settings.ts";
import {
  assignFamily,
  decideApproval,
  getDashboard,
  listApprovals,
  listTasks,
  removeAssignment,
  saveNotes,
  saveTask,
} from "./admin-tasks.ts";
import { DataGateway } from "./gateway.ts";
import { listReminders, retryReminder } from "./notifications.ts";
import type { Payload } from "./payload.ts";
import { listFamilyNames } from "./working-groups.ts";

/**
 * Database adapter for the admin application port (BR32.1): records, tasks, assignments, approvals, notes,
 * dashboard, settings, governance, lifecycle and reminders, each calling one named database
 * function or a policy-filtered table read, with the same result states and codes as today (BR32.8, BR42.3).
 *
 * Every admin operation now has a database answer, so the production composition no longer uses the interim
 * port (BR42.1); anything this adapter does not know is answered with `denied`.
 */

/**
 * The use cases of this adapter that change a family's assignments, and so need a notification once U4
 * connects them (BR31.10): the admin's decisions, a place given or removed, a task that is cancelled (its
 * places are removed) and a family that is archived. Together with the parent adapter's list this is every
 * use case that changes assignments; a test asserts it.
 */
export const ADMIN_NOTIFICATION_USE_CASES = Object.freeze([
  "assignment.assign",
  "assignment.remove",
  "swap.decide",
  "cancellation.decide",
  "task.save",
  "family.archive",
] as const);

/** Every admin operation this adapter answers (the rest of `AdminOperation` stays on the old adapter). */
export const DATABASE_ADMIN_OPERATIONS: readonly AdminOperation[] = Object.freeze([
  "dashboard.get",
  "records.list",
  "records.get",
  "records.save",
  "records.archive",
  "records.restore",
  "tasks.list",
  "tasks.save",
  "assignments.assign",
  "assignments.remove",
  "approvals.list",
  "approvals.decide",
  "notes.save",
  "governance.list",
  "governance.update",
  "lifecycle.list",
  "lifecycle.run",
  "settings.get",
  "settings.save",
  "reminders.list",
  "reminders.retry",
  "families.names",
]);

export class DatabaseAdminPort implements AdminApplicationPort {
  private readonly gateway: DataGateway;

  constructor(database: DatabaseClient) {
    this.gateway = new DataGateway(database);
  }

  async execute<T>(input: {
    operation: AdminOperation;
    scope: Scope;
    payload: Payload;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<T>> {
    const outcome = await this.dispatch(input);
    return outcome as DomainOutcome<T>;
  }

  private dispatch(input: {
    operation: AdminOperation;
    scope: Scope;
    payload: Payload;
    idempotencyKey?: string;
  }): Promise<DomainOutcome<unknown>> {
    const call = {
      payload: input.payload,
      ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    };
    switch (input.operation) {
      case "dashboard.get":
        return getDashboard(this.gateway, input.scope);
      case "records.list":
        return listRecords(this.gateway, input.payload);
      case "records.get":
        return getRecord(this.gateway, input.payload);
      case "records.save":
        return saveRecord(this.gateway, call);
      case "records.archive":
        return changeRecordState(this.gateway, call, "archive");
      case "records.restore":
        return changeRecordState(this.gateway, call, "restore");
      case "tasks.list":
        return listTasks(this.gateway, input.payload);
      case "tasks.save":
        return saveTask(this.gateway, call);
      case "assignments.assign":
        return assignFamily(this.gateway, call);
      case "assignments.remove":
        return removeAssignment(this.gateway, call);
      case "approvals.list":
        return listApprovals(this.gateway, input.payload);
      case "approvals.decide":
        return decideApproval(this.gateway, call);
      case "notes.save":
        return saveNotes(this.gateway, call);
      case "governance.list":
        return listGrants(this.gateway);
      case "governance.update":
        return revokeGrant(this.gateway, call);
      case "lifecycle.list":
        return listLifecycle(this.gateway, input.payload);
      case "lifecycle.run":
        return runLifecycle(this.gateway, call);
      case "settings.get":
        return getSettings(this.gateway);
      case "settings.save":
        return saveSettings(this.gateway, call);
      case "families.names":
        return listFamilyNames(this.gateway);
      case "reminders.list":
        return listReminders(this.gateway, input.payload);
      case "reminders.retry":
        return retryReminder(this.gateway, call);
      default:
        return Promise.resolve({ state: "denied" });
    }
  }
}

export function createAdminPort(database: DatabaseClient): AdminApplicationPort {
  return new DatabaseAdminPort(database);
}
