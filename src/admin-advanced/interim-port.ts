import type { AdminApplicationPort, AdminOperation, DomainOutcome } from "../application/index.ts";

/**
 * The admin operations that stay with unit U4 (import and reminders, BR32.9) while the app runs against the
 * real database. Until U4 they have no real backing, so this port answers honestly and keeps nothing:
 *
 *  - reading the import status or the reminder list answers the empty state (nothing was imported, nothing
 *    is queued), never fixture data and never another admin's preview;
 *  - anything that would change something (a preview, a conflict resolution, a commit, a recovery, a retry)
 *    answers denied, so no screen can report a success that did not change anything.
 *
 * The synthetic mode does not use this port: its demo store (`synthetic-advanced.ts`) serves the demo.
 */
const EMPTY_STATE_OPERATIONS: readonly AdminOperation[] = ["import.status", "reminders.list"];

export class UnavailableInterimAdvancedPort implements AdminApplicationPort {
  async execute<T>(
    input: Parameters<AdminApplicationPort["execute"]>[0],
  ): Promise<DomainOutcome<T>> {
    return (
      EMPTY_STATE_OPERATIONS.includes(input.operation) ? { state: "empty" } : { state: "denied" }
    ) as DomainOutcome<T>;
  }
}
