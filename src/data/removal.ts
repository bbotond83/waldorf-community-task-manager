import type {
  CoordinatorGroupModel,
  DomainOutcome,
  FlaggedItemListModel,
  RemovalPreviewModel,
  RemovalReportModel,
  RemovalStepModel,
  RemovalSubjectModel,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { malformedResponse } from "./errors.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { refused, toOutcome } from "./results.ts";
import { asRow, asRows, integer, isUuid, oneOf, optionalText, text, type Row } from "./values.ts";

/**
 * The removal of a parent or a family (U14): the preview, the flagged items and the two commands with their reports.
 * Each is one named database function that checks the caller itself. The results hold ids, counts, codes, titles,
 * dates and group names, never a person's name; only the fields listed here are carried to the application.
 */
const SUBJECT_KINDS = ["parent", "family"] as const;
const BLOCKS = [
  "rota_planning",
  "dutychanges",
  "duties",
  "checklists",
  "todo",
  "library",
  "events",
  "recurring_duties",
  "notifications",
  "working_groups",
  "directory",
] as const;
const REFUSALS = [
  "SELF_REMOVAL",
  "last_super_admin",
  "PARENT_LAST_IN_FAMILY",
  "VERSION_CONFLICT",
] as const;
const FLAGGED_KINDS = [
  "future_place",
  "held_book",
  "claimed_task",
  "family_task",
  "family_schedule",
] as const;

type SubjectInput = Readonly<{ kind: string; id: string }>;
type CommandInput = Readonly<{ idempotencyKey: string; id: string; expectedVersion: number }>;

export function toRemovalSteps(value: unknown): readonly RemovalStepModel[] {
  return Object.freeze(
    asRows(value).map((row) =>
      Object.freeze({
        block: oneOf(row, "block", BLOCKS),
        toClear: integer(row, "to_clear"),
        toFlag: integer(row, "to_flag"),
      }),
    ),
  );
}

function toGroups(value: unknown): readonly CoordinatorGroupModel[] {
  return Object.freeze(
    asRows(value).map((row) =>
      Object.freeze({ groupId: text(row, "group_id"), groupName: text(row, "name") }),
    ),
  );
}

function toSubject(row: Row): RemovalSubjectModel {
  return Object.freeze({ kind: oneOf(row, "kind", SUBJECT_KINDS), id: text(row, "id") });
}

function toAccountIds(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every(isUuid)) throw malformedResponse();
  return Object.freeze([...value]);
}

/** What a removal command did. A repeated click returns the stored result, so it reads the same. */
function toReport(envelope: Envelope, subject: RemovalSubjectModel): RemovalReportModel {
  return Object.freeze({
    subject,
    steps: toRemovalSteps(envelope.steps),
    endedAccountIds: toAccountIds(envelope.ended_account_ids),
    groupsLeftWithoutCoordinator: toGroups(envelope.groups_left_without_coordinator),
    auditEvidenceId: text(envelope, "audit_event_id"),
  });
}

/** A request this module refuses before it reaches the database; `undefined` when the subject is well formed. */
function subjectRefusal<T>(subject: SubjectInput): DomainOutcome<T> | undefined {
  if (!SUBJECT_KINDS.some((kind) => kind === subject.kind)) {
    return refused({ request: "VAL-INVALID" });
  }
  // An id that cannot exist reads like one that is not visible (BR30.8).
  return isUuid(subject.id) ? undefined : { state: "denied" };
}

async function remove(
  gateway: DataGateway,
  kind: RemovalSubjectModel["kind"],
  input: CommandInput,
): Promise<DomainOutcome<RemovalReportModel>> {
  const invalid = subjectRefusal<RemovalReportModel>({ kind, id: input.id });
  if (invalid) return invalid;
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    return refused({ expectedVersion: "VAL-EXPECTED-VERSION" }, "field_invalid");
  }
  const envelope = await gateway.call(
    kind === "parent" ? "parent_remove" : "family_archive",
    {
      p_idempotency_key: input.idempotencyKey,
      [kind === "parent" ? "p_parent_id" : "p_family_id"]: input.id,
      p_expected_version: input.expectedVersion,
    },
    input.idempotencyKey,
  );
  return toOutcome(envelope, (current) => toReport(current, Object.freeze({ kind, id: input.id })));
}

export const removeParentRecord = (gateway: DataGateway, input: CommandInput) =>
  remove(gateway, "parent", input);

export const removeFamilyRecord = (gateway: DataGateway, input: CommandInput) =>
  remove(gateway, "family", input);

export async function previewRemoval(
  gateway: DataGateway,
  subject: SubjectInput,
): Promise<DomainOutcome<RemovalPreviewModel>> {
  const invalid = subjectRefusal<RemovalPreviewModel>(subject);
  if (invalid) return invalid;
  const envelope = await gateway.call("removal_preview", {
    p_subject_kind: subject.kind,
    p_subject_id: subject.id,
  });
  return toOutcome(envelope, (current) => {
    const totals = asRow(current.totals);
    const refusal =
      optionalText(current, "refusal") === undefined
        ? undefined
        : oneOf(current, "refusal", REFUSALS);
    return Object.freeze({
      subject: toSubject(asRow(current.subject)),
      version: integer(current, "version"),
      steps: toRemovalSteps(current.steps),
      totals: Object.freeze({
        toClear: integer(totals, "to_clear"),
        toFlag: integer(totals, "to_flag"),
      }),
      groupsLeftWithoutCoordinator: toGroups(current.groups_left_without_coordinator),
      ...(refusal ? { refusal } : {}),
    });
  });
}

/** The items a removal left for an administrator. An empty list is a success: everything has been handled. */
export async function listFlaggedItems(
  gateway: DataGateway,
  subject: SubjectInput,
): Promise<DomainOutcome<FlaggedItemListModel>> {
  const invalid = subjectRefusal<FlaggedItemListModel>(subject);
  if (invalid) return invalid;
  const envelope = await gateway.call("removal_flagged_items", {
    p_subject_kind: subject.kind,
    p_subject_id: subject.id,
  });
  return toOutcome(envelope, (current) =>
    Object.freeze({
      subject: toSubject(asRow(current.subject)),
      items: Object.freeze(
        asRows(current.items).map((row) => {
          const onDate = optionalText(row, "on_date");
          return Object.freeze({
            kind: oneOf(row, "kind", FLAGGED_KINDS),
            itemId: text(row, "item_id"),
            label: text(row, "label"),
            ...(onDate ? { onDate } : {}),
            link: text(row, "link"),
          });
        }),
      ),
    }),
  );
}

/** The removal operations behind the application facade. */
export function createRemovalPort(database: DatabaseClient) {
  const gateway = new DataGateway(database);
  return Object.freeze({
    preview: (subject: SubjectInput) => previewRemoval(gateway, subject),
    flaggedItems: (subject: SubjectInput) => listFlaggedItems(gateway, subject),
  });
}
