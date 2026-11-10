"use client";

import { useState } from "react";
import type { AdminItemDetails } from "../../../src/application/index.ts";
import { COMMUNITY_GROUP } from "../../../src/application/admin-payloads.ts";
import { isoToBudapestLocal } from "../../../src/application/budapest-time.ts";
import type { AdminLookups } from "../_lib/lookups.ts";
import { AdminSelectField, AdminTextField } from "./AdminMutationForm.tsx";

export type TaskFormKind = "task" | "event";

const KIND_OPTIONS = [
  { value: "task", label: "Feladat" },
  { value: "event", label: "Esemény" },
] as const;

const TASK_STATUS_OPTIONS = [
  { value: "open", label: "Nyitott" },
  { value: "closed", label: "Lezárva" },
  { value: "cancelled", label: "Törölve" },
] as const;

const EVENT_STATUS_OPTIONS = [
  { value: "planned", label: "Ütemezve" },
  { value: "cancelled", label: "Törölve" },
] as const;

/** The state words as the stored values: an item is shown as `open` or `scheduled` and stored as below. */
function storedStatus(kind: TaskFormKind, shown: string | undefined): string | undefined {
  if (shown === undefined) return undefined;
  if (kind === "event") return shown === "cancelled" ? "cancelled" : "planned";
  return shown === "closed" || shown === "cancelled" ? shown : "open";
}

/**
 * The fields of the task and event form (BR32.7): the group, the event a task belongs to, the category,
 * capacity, start, end and place of a task, and the coordinator of an event. On the create page the kind is
 * chosen and the fields follow it; on the edit page the kind is fixed. Times are written in Budapest time.
 */
export function TaskFields({
  mode,
  kind: storedKind,
  title,
  state,
  details,
  lookups,
}: Readonly<{
  mode: "create" | "edit";
  kind?: TaskFormKind;
  title?: string;
  /** The item's displayed state, which the status field of the edit form starts from. */
  state?: string;
  details?: AdminItemDetails;
  lookups: AdminLookups;
}>) {
  const [chosen, setChosen] = useState<TaskFormKind>(storedKind ?? "task");
  // A stored item with no group is community-wide.
  const [groupId, setGroupId] = useState(
    details?.groupId ?? (mode === "edit" ? COMMUNITY_GROUP : ""),
  );
  const kind = mode === "edit" ? (storedKind ?? "task") : chosen;
  const events = lookups.events.filter((event) => !groupId || event.groupId === groupId);
  return (
    <>
      <input type="hidden" name="extended" value="1" />
      {mode === "create" ? (
        <AdminSelectField
          id="kind"
          name="kind"
          label="Típus"
          options={KIND_OPTIONS}
          value={chosen}
          onChange={(value) => setChosen(value as TaskFormKind)}
          testId="admin-task-kind-select"
        />
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}
      <AdminTextField
        id="title"
        name="title"
        label="Megnevezés"
        defaultValue={title}
        required
        maxLength={120}
        testId="admin-task-title-input"
      />
      <AdminSelectField
        id="groupId"
        name="groupId"
        label="Munkacsoport"
        options={lookups.groups}
        value={groupId}
        onChange={setGroupId}
        placeholder="Válasszon munkacsoportot"
        required
        testId="admin-task-group-select"
      />
      {kind === "task" && (
        <>
          <AdminSelectField
            id="eventId"
            name="eventId"
            label="Esemény"
            options={events}
            defaultValue={details?.eventId}
            placeholder="Nem tartozik eseményhez"
            hint="Csak a kiválasztott munkacsoport eseményei választhatók."
            testId="admin-task-event-select"
          />
          <AdminTextField
            id="category"
            name="category"
            label="Kategória"
            defaultValue={details?.category ?? "általános"}
            maxLength={100}
            testId="admin-task-category-input"
          />
          <AdminTextField
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={50}
            label="Férőhelyek száma"
            defaultValue={details?.capacity === undefined ? undefined : String(details.capacity)}
            required
            hint="1 és 50 között; nem lehet kevesebb, mint a már lefoglalt helyek száma."
            testId="admin-task-capacity-input"
          />
        </>
      )}
      <AdminTextField
        id="startsAt"
        name="startsAt"
        type="datetime-local"
        label="Kezdés (budapesti idő)"
        defaultValue={isoToBudapestLocal(details?.startsAt)}
        required
        testId="admin-task-starts-at-input"
      />
      <AdminTextField
        id="endsAt"
        name="endsAt"
        type="datetime-local"
        label="Befejezés (budapesti idő)"
        defaultValue={isoToBudapestLocal(details?.endsAt)}
        required
        testId="admin-task-ends-at-input"
      />
      <AdminTextField
        id="location"
        name="location"
        label="Helyszín"
        defaultValue={details?.location}
        maxLength={200}
        required={kind === "task"}
        testId="admin-task-location-input"
      />
      {kind === "event" && (
        <AdminTextField
          id="coordinatorName"
          name="coordinatorName"
          label="Koordinátor neve"
          defaultValue={details?.coordinatorName}
          maxLength={200}
          testId="admin-task-coordinator-input"
        />
      )}
      {mode === "edit" && (
        <AdminSelectField
          id="status"
          name="status"
          label="Állapot"
          options={kind === "task" ? TASK_STATUS_OPTIONS : EVENT_STATUS_OPTIONS}
          defaultValue={storedStatus(kind, state)}
          hint={
            kind === "task"
              ? "A lezárt feladatra a szülők már nem jelentkezhetnek. A törölt feladat végleges: a jelentkezések megszűnnek."
              : "Egy törölt esemény nyitott feladatai lezárulnak."
          }
          testId="admin-task-status-select"
        />
      )}
    </>
  );
}
