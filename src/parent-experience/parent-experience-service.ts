import type { AuthorizationDecision } from "../access/types.ts";
export interface Session { subjectId: string; authorizationVersion: number; }
export interface FamilyDirectory { getVisible(session: Session, familyId: string): unknown | AuthorizationDecision; }
export interface ParentAssignment { id: string; familyId: string; title: string; dueAt: string; state: "active" | "swap_pending" | "cancellation_pending"; }
export interface NotificationItem { id: string; recipientId: string; title: string; link: string; readAt?: string; }
export interface ParentRepository { listAssignments(familyId: string): ParentAssignment[]; listNotifications(recipientId: string): NotificationItem[]; findNotification(id: string): NotificationItem | undefined; saveNotification(item: NotificationItem): void; }
export interface ParentCommands { signUp(actor: Session, familyId: string, taskId: string): "accepted" | "conflict" | "denied"; requestSwap(actor: Session, assignmentId: string, counterpartId: string): "pending" | "approved" | "denied"; requestCancellation(actor: Session, assignmentId: string): "pending" | "denied"; }
export type ParentResult<T> = { state: "ready"; value: T } | { state: "denied"; message: "Nincs jogosultság" } | { state: "not_found"; message: "Nincs jogosultság" };
const denied = (): ParentResult<never> => ({ state: "denied", message: "Nincs jogosultság" });
export class ParentExperienceService {
  private readonly now: () => Date;
  private readonly directory: FamilyDirectory; private readonly repository: ParentRepository;
  private readonly commands?: ParentCommands;
  constructor(directory: FamilyDirectory, repository: ParentRepository, now: () => Date = () => new Date(), commands?: ParentCommands) { this.directory = directory; this.repository = repository; this.now = now; this.commands = commands; }
  getProjection(actor: Session, familyId: string): ParentResult<{ assignments: ParentAssignment[] }> { if (isDenied(this.directory.getVisible(actor, familyId))) return denied(); return { state: "ready", value: { assignments: this.repository.listAssignments(familyId) } }; }
  getNotifications(actor: Session): ParentResult<Array<Omit<NotificationItem, "recipientId">>> { return { state: "ready", value: this.repository.listNotifications(actor.subjectId).map(({ id, title, link, readAt }) => ({ id, title, link, ...(readAt ? { readAt } : {}) })) }; }
  markNotificationRead(actor: Session, notificationId: string): ParentResult<{ link: string }> { const item = this.repository.findNotification(notificationId); if (!item || item.recipientId !== actor.subjectId) return denied(); this.repository.saveNotification({ ...item, readAt: item.readAt ?? this.now().toISOString() }); return { state: "ready", value: { link: item.link } }; }
  signUp(actor: Session, familyId: string, taskId: string): ParentResult<"accepted" | "conflict"> { if (!this.commands || isDenied(this.directory.getVisible(actor, familyId))) return denied(); const result = this.commands.signUp(actor, familyId, taskId); return result === "denied" ? denied() : { state: "ready", value: result }; }
  requestSwap(actor: Session, familyId: string, assignmentId: string, counterpartId: string): ParentResult<"pending" | "approved"> { if (!this.commands || isDenied(this.directory.getVisible(actor, familyId))) return denied(); const result = this.commands.requestSwap(actor, assignmentId, counterpartId); return result === "denied" ? denied() : { state: "ready", value: result }; }
  requestCancellation(actor: Session, familyId: string, assignmentId: string): ParentResult<"pending"> { if (!this.commands || isDenied(this.directory.getVisible(actor, familyId))) return denied(); return this.commands.requestCancellation(actor, assignmentId) === "pending" ? { state: "ready", value: "pending" } : denied(); }
}
function isDenied(value: unknown): value is AuthorizationDecision { return typeof value === "object" && value !== null && "allowed" in value && (value as AuthorizationDecision).allowed === false; }
