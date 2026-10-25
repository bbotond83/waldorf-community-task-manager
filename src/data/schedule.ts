import type { TrackingSourceRecord } from "../application/tracking-model.ts";
import { scheduleStatusLabel } from "./copy.ts";
import { malformedResponse } from "./errors.ts";
import { optionalText, text, type Row } from "./values.ts";

/**
 * Mapping of the schedule function's rows to the teacher schedule model (entities.md, TeacherSchedule):
 * start, end, title, location, coordination name, owner, assignees and the status label (BR33.3). Each field
 * is copied by name: nothing else in a row (no contact, note or person id) can reach the screen (BR30.5).
 */
export function toScheduleEntry(row: Row, organizationId: string): TrackingSourceRecord {
  const assignees = row.assignee_display_names;
  if (!Array.isArray(assignees) || !assignees.every((name) => typeof name === "string")) {
    throw malformedResponse();
  }
  const coordination = optionalText(row, "coordination_display_name");
  const id = text(row, "id");
  return Object.freeze({
    id,
    sourceRecordId: id,
    organizationId,
    groupId: text(row, "group_id"),
    startsAt: text(row, "starts_at"),
    endsAt: text(row, "ends_at"),
    title: text(row, "title"),
    location: text(row, "location"),
    ...(coordination !== undefined ? { coordinationDisplayName: coordination } : {}),
    ownerDisplayName: optionalText(row, "owner_display_name") ?? null,
    assigneeDisplayNames: Object.freeze([...(assignees as string[])]),
    currentStatusLabel: scheduleStatusLabel(optionalText(row, "current_status_label") ?? null),
  });
}
