import type { PendingRequests } from "../../../src/application/notification-context.ts";
import { dutyStateLabel } from "../../../src/application/status-labels.ts";

/**
 * What a request page shows in place of its form while a request waits: the pending notice and a
 * link back to the task.
 */
export function PendingRequestPanel({
  pending,
  dutyId,
  testId,
}: Readonly<{
  pending: Pick<PendingRequests, "swap" | "cancellation">;
  dutyId: string;
  testId: string;
}>) {
  return (
    <div data-testid={testId}>
      <PendingRequestNotice pending={pending} />
      <p className="parent-page-actions">
        <a href={`/szulo/feladatok/${dutyId}`} data-testid={`${testId}-back-link`}>
          Vissza a feladathoz
        </a>
      </p>
    </div>
  );
}

/**
 * Tells the parent that a swap or cancellation request is waiting on a task. One line per
 * waiting request kind; it renders nothing when no request waits.
 */
export function PendingRequestNotice({
  pending,
}: Readonly<{ pending: Pick<PendingRequests, "swap" | "cancellation"> }>) {
  if (!pending.swap && !pending.cancellation) return null;
  return (
    <div className="parent-notice parent-pending-notice" data-testid="pending-request-notice">
      {pending.swap && <p data-testid="pending-swap-notice">{dutyStateLabel("swap-pending")}</p>}
      {pending.cancellation && (
        <p data-testid="pending-cancellation-notice">{dutyStateLabel("cancellation-pending")}</p>
      )}
    </div>
  );
}
