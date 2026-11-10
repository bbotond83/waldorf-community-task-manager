/**
 * The fields the admin screens send in the `payload` of a record, task, assignment or notes command, and
 * the fields a list or lookup may carry (BR32.7). The admin port keeps its one generic `execute` shape, so
 * these types document and check the contract between the screens and the database adapter; they add no
 * behaviour. A field that is absent means "leave as it is" on a change, and the adapter fills it from the
 * stored record, so a screen that only edits a title keeps working.
 */

/** The kinds of record a screen can create or change. `record` means "look the kind up from the id". */
export type AdminRecordKind = "family" | "child" | "group" | "school-year" | "record";

/** A contact person of a family, with the optional profile that is stored only with consent (BR30.4). */
export type AdminParentPayload = Readonly<{
  /** Absent on a new parent; the parent's own version is then needed as `expectedVersion`. */
  id?: string;
  expectedVersion?: number;
  displayName: string;
  email?: string;
  phone?: string;
  locality?: string;
  optionalProfile?: string;
  optionalProfileConsent?: boolean;
}>;

export type AdminChildPayload = Readonly<{
  id?: string;
  expectedVersion?: number;
  displayName: string;
}>;

/** `records.save`: a family with parents and children, a child, a working group or a school year. */
export type AdminRecordPayload = Readonly<{
  kind?: AdminRecordKind;
  /** The legacy single text field: the display name or name of the record. */
  title?: string;
  displayName?: string;
  name?: string;
  /** Group: the school year it belongs to (fixed once set). */
  schoolYearId?: string;
  /** School year: the first and last day (YYYY-MM-DD). */
  startsOn?: string;
  endsOn?: string;
  /** Child: the family it belongs to. */
  familyId?: string;
  /** Family: parents and children by id; those not listed stay as they are. */
  parents?: readonly AdminParentPayload[];
  children?: readonly AdminChildPayload[];
  /** Working group: what the group does (BR2.2). */
  description?: string;
}>;

/** The choice "Egész közösség" on the task and event forms: the item stores no group (BR1.1). */
export const COMMUNITY_GROUP = "community";

/** `tasks.save`: a task or an event. */
export type AdminTaskPayload = Readonly<{
  kind?: "task" | "event";
  title?: string;
  /** A working group's id, or `COMMUNITY_GROUP`. */
  groupId?: string;
  /** Task: the event it belongs to (same group). */
  eventId?: string;
  category?: string;
  capacity?: number;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  /** Event: the person who coordinates it. */
  coordinatorName?: string;
  /** Task: open, closed or cancelled. Event: planned or cancelled. */
  status?: string;
}>;

/** `assignments.assign`: `id` is the task, `expectedVersion` the task's version. */
export type AdminAssignPayload = Readonly<{ familyId: string }>;

/** `notes.save`: `id` is the event; an empty text clears a note. */
export type AdminNotesPayload = Readonly<{
  allergenNote?: string;
  supplyNote?: string;
  foodNote?: string;
}>;

/** `records.archive` and `records.restore` may name the kind; without it the adapter looks it up. */
export type AdminArchivePayload = Readonly<{ kind?: AdminRecordKind }>;

/** `approvals.decide`: `kind` saves one lookup when the screen knows it. */
export type AdminDecisionPayload = Readonly<{
  decision: "approved" | "rejected";
  kind?: "swap" | "cancellation";
}>;
