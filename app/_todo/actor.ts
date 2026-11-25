import "server-only";

import {
  resolveRecurringActor,
  resolveRecurringManager,
  resolveRecurringParent,
  type RecurringActor,
  type RecurringManager,
  type RecurringParent,
} from "../_recurring/actor.ts";

/** The three areas that show to-do tasks: the parent pages (also a coordinator's), the teacher pages (read only) and the admin pages. */
export type TodoArea = RecurringActor["area"];

/** The signed-in person of a to-do page: the session and the scope the area reads with. */
export type TodoActor = RecurringActor;

/** A coordinator or super admin who keeps tasks; a coordinator names a group, a super admin holds the whole community. */
export type TodoManager = RecurringManager;

/** A parent with a family, who takes, finishes and gives back tasks. */
export type TodoParent = RecurringParent;

export const TODO_BASE_PATH: Readonly<Record<TodoArea, string>> = Object.freeze({
  szulo: "/szulo/teendok",
  teacher: "/teacher/teendok",
  admin: "/admin/teendok",
});

/** The address of a working group's management page ("Kezelés"), in the parent area (coordinators) or the admin area. */
export const groupManagePath = (area: "szulo" | "admin", groupId: string): string =>
  `/${area}/munkacsoportok/${groupId}/kezeles`;

/**
 * The same person resolution the recurring pages use, so one rule decides who is a coordinator or a super admin: the
 * database role grants, never anything the browser sends.
 */
export const resolveTodoActor = resolveRecurringActor;
export const resolveTodoManager = resolveRecurringManager;
export const resolveTodoParent = resolveRecurringParent;
