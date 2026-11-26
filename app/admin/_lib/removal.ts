import "server-only";

import type { ApplicationResult, RemovalReportModel } from "../../../src/application/index.ts";
import { REMOVAL_TEXTS } from "../../../src/data/copy.ts";
import { endRemovedParentSignIn } from "../../../src/identity/accounts.ts";
import { getIdentityRuntime } from "../../../src/identity/runtime.ts";
import type { AdminActionState } from "../actions.ts";
import { mapApplicationResult } from "./action-state.ts";

/**
 * What the two removal actions (a parent, a family) share. The server log holds codes and ids only, never a name or a
 * text (NFR4.5).
 */
const SIGN_OUT_PENDING = "SIGN_IN_FOLLOW_UP_PENDING";

/**
 * Ends the sign-in of every account the removal returned, each with the retrying step. It runs after the commit, so a
 * failure never undoes the removal: the database already refuses the account (BR36.3, NFR3.2).
 */
async function endSignIns(accountIds: readonly string[]): Promise<boolean> {
  let allEnded = true;
  for (const accountId of accountIds) {
    let outcome: "done" | "pending";
    try {
      outcome = await endRemovedParentSignIn(accountId, getIdentityRuntime());
    } catch {
      outcome = "pending";
    }
    if (outcome !== "done") {
      allEnded = false;
      console.error("removal sign-out failed", { code: SIGN_OUT_PENDING, accountId });
    }
  }
  return allEnded;
}

/**
 * The result page's address with what only this answer knows: that the removal just happened, whether a sign-out
 * failed and which groups lost their coordinator. Flags and group ids only, never a name (NFR4.5).
 */
function resultAddress(path: string, report: RemovalReportModel, ended: boolean): string {
  const query = new URLSearchParams({ allapot: "eltavolitva" });
  if (!ended) query.set("kijelentkezes", "sikertelen");
  for (const group of report.groupsLeftWithoutCoordinator) query.append("csoport", group.groupId);
  return `${path}?${query.toString()}`;
}

/** The answer of a committed removal; `resultPath` is the page that lists what is left to handle. */
export async function removalSucceeded(
  message: string,
  code: string,
  report: RemovalReportModel,
  resultPath: string | undefined,
): Promise<AdminActionState> {
  const ended = await endSignIns(report.endedAccountIds);
  return {
    state: "success",
    message: ended ? message : `${message} ${REMOVAL_TEXTS.signOutWarning}`,
    code: ended ? code : SIGN_OUT_PENDING,
    ...(resultPath ? { resultPath: resultAddress(resultPath, report, ended) } : {}),
  };
}

/**
 * A removal that did not happen. A refusal reads as its own words; an unexpected error says that nothing changed, and
 * the log gets the operation, the code and the request's key.
 */
export function removalFailed<T>(
  operation: "parent_remove" | "family_archive",
  requestId: string,
  result: ApplicationResult<T>,
): AdminActionState {
  const mapped = mapApplicationResult(result);
  if (mapped.state !== "retryable" && mapped.state !== "terminal") return mapped;
  console.error("removal failed", { operation, code: result.code, requestId });
  return { ...mapped, message: REMOVAL_TEXTS.failed };
}
