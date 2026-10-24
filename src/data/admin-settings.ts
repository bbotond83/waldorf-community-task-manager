import type {
  AdvancedSettingsModel,
  AdvancedSettingsOutcome,
  DomainOutcome,
  GrantListModel,
  GrantModel,
  GrantOutcome,
  LifecycleListModel,
  LifecycleOutcomeModel,
} from "../application/index.ts";
import {
  blockerSummary,
  GROUP_SCOPE_LABEL,
  ORGANIZATION_SCOPE_LABEL,
  RECIPIENT_OPTIONS,
} from "./copy.ts";
import type { DataGateway } from "./gateway.ts";
import { payloadFlag, payloadNumber, payloadText, type Payload } from "./payload.ts";
import { toItemsOutcome, toOutcome } from "./results.ts";
import { asRows, flag, integer, isUuid, oneOf, optionalText, text, type Row } from "./values.ts";

/**
 * The admin operations on the reminder setting, the role grants and the family lifecycle (W13 to W16, BR30.10,
 * BR32.10, BR35). Each calls one named function; the functions check the caller's reach themselves.
 */
export type SettingsCall = Readonly<{ payload: Payload; idempotencyKey?: string }>;

const NO_KEY = "";

export async function getSettings(
  gateway: DataGateway,
): Promise<DomainOutcome<AdvancedSettingsModel>> {
  const envelope = await gateway.call("settings_get", {});
  return toOutcome(envelope, (result) => {
    const scope = oneOf(result, "recipient_scope", ["duty", "group"] as const);
    const selected = RECIPIENT_OPTIONS.find((option) => option.scope === scope);
    return Object.freeze({
      recipients: Object.freeze(
        RECIPIENT_OPTIONS.map(({ id, label, summary }) => Object.freeze({ id, label, summary })),
      ),
      selectedRecipientId: selected?.id ?? RECIPIENT_OPTIONS[0].id,
      remindersEnabled: flag(result, "enabled"),
      version: integer(result, "version"),
    });
  });
}

/** settings.save: `recipientId` is one of the two choices the screen offers; anything else is refused by the function. */
export async function saveSettings(
  gateway: DataGateway,
  call: SettingsCall,
): Promise<DomainOutcome<AdvancedSettingsOutcome>> {
  const { payload } = call;
  const key = call.idempotencyKey ?? NO_KEY;
  const recipientId = payloadText(payload, "recipientId") ?? "";
  const option = RECIPIENT_OPTIONS.find((candidate) => candidate.id === recipientId);
  const enabled = payloadFlag(payload, "remindersEnabled") ?? false;
  const envelope = await gateway.call(
    "settings_save",
    {
      p_idempotency_key: key,
      p_expected_version: payloadNumber(payload, "expectedVersion") ?? null,
      p_enabled: enabled,
      // An unknown choice is sent on as it is, so the function answers SETTINGS_RECIPIENT_INVALID.
      p_recipient_scope: option?.scope ?? recipientId,
    },
    key,
  );
  return toOutcome(envelope, (result) =>
    Object.freeze({
      selectedRecipientId: option?.id ?? recipientId,
      remindersEnabled: enabled,
      version:
        typeof result.version === "number"
          ? result.version
          : (payloadNumber(payload, "expectedVersion") ?? 0) + 1,
    }),
  );
}

const GRANT_ROLES = ["parent", "group_admin", "kindergarten_teacher", "super_admin"] as const;

function toGrant(row: Row): GrantModel {
  const scopeLabel =
    row.scope_type === "organization"
      ? ORGANIZATION_SCOPE_LABEL
      : (optionalText(row, "scope_label") ?? GROUP_SCOPE_LABEL);
  return Object.freeze({
    id: text(row, "grant_id"),
    subjectLabel: text(row, "subject_label"),
    role: oneOf(row, "role", GRANT_ROLES),
    scopeLabel,
    version: integer(row, "version"),
    isSelf: flag(row, "is_self"),
  });
}

export async function listGrants(gateway: DataGateway): Promise<DomainOutcome<GrantListModel>> {
  const envelope = await gateway.call("governance_list", {});
  return toItemsOutcome(envelope, (rows) =>
    Object.freeze({ grants: Object.freeze(rows.map(toGrant)) }),
  );
}

/**
 * governance.update revokes a grant (BR32.10): `id` is the grant, `expectedVersion` the account's
 * authorization version shown with it. The account the revoke affects is looked up from the list first so
 * the outcome can name it; the revoke function itself repeats every check.
 */
export async function revokeGrant(
  gateway: DataGateway,
  call: SettingsCall,
): Promise<DomainOutcome<GrantOutcome>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  if (!isUuid(id)) return { state: "denied" };
  const key = call.idempotencyKey ?? NO_KEY;
  const listed = await gateway.call("governance_list", {});
  const subject =
    listed.state === "success"
      ? asRows(listed.items).find((row) => text(row, "grant_id") === id)
      : undefined;
  const envelope = await gateway.call(
    "governance_revoke",
    {
      p_idempotency_key: key,
      p_grant_id: id,
      p_expected_version: payloadNumber(payload, "expectedVersion") ?? null,
    },
    key,
  );
  return toOutcome(envelope, (result) =>
    Object.freeze({
      grantId: id,
      authorizationVersion:
        typeof result.authorization_version === "number"
          ? result.authorization_version
          : (payloadNumber(payload, "expectedVersion") ?? 0) + 1,
      invalidatedSubjectId: subject ? text(subject, "subject_id") : "",
    }),
  );
}

const ELIGIBILITIES = ["eligible-delete", "eligible-anonymize", "blocked"] as const;

function toCandidate(row: Row): LifecycleListModel["candidates"][number] {
  const blockers = Array.isArray(row.blockers)
    ? row.blockers.filter((blocker): blocker is string => typeof blocker === "string")
    : [];
  const summary = blockerSummary(blockers);
  return Object.freeze({
    id: text(row, "family_id"),
    label: text(row, "display_name"),
    eligibility: oneOf(row, "state", ELIGIBILITIES),
    ...(summary !== undefined ? { blockerSummary: summary } : {}),
    version: integer(row, "version"),
  });
}

export async function listLifecycle(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<LifecycleListModel>> {
  const eligibility = payloadText(payload, "eligibility");
  const envelope = await gateway.call("lifecycle_list", {
    p_state: eligibility ? eligibility : null,
  });
  return toItemsOutcome(envelope, (rows) =>
    Object.freeze({ candidates: Object.freeze(rows.map(toCandidate)) }),
  );
}

/** lifecycle.run: `id` is the family, `confirmed` is the screen's "yes". */
export async function runLifecycle(
  gateway: DataGateway,
  call: SettingsCall,
): Promise<DomainOutcome<LifecycleOutcomeModel>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  if (!isUuid(id)) return { state: "denied" };
  const key = call.idempotencyKey ?? NO_KEY;
  const envelope = await gateway.call(
    "lifecycle_run",
    {
      p_idempotency_key: key,
      p_family_id: id,
      p_expected_version: payloadNumber(payload, "expectedVersion") ?? null,
      p_confirmed: payloadFlag(payload, "confirmed") ?? false,
    },
    key,
  );
  return toOutcome(envelope, (result) => {
    const state = result.outcome === "deleted" ? "deleted" : "anonymized";
    return Object.freeze({
      familyId: id,
      state,
      auditEvidenceId: optionalText(result, "audit_event_id") ?? "",
    });
  });
}
