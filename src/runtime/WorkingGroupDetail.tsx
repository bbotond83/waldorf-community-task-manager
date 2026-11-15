import type { ReactNode } from "react";
import type {
  ApplicationResult,
  WorkingGroupDetailModel,
  WorkingGroupMember,
} from "../application/index.ts";

/** The role area a group page is shown in; it decides the class prefix (`parent-group-`, `teacher-group-`, `admin-group-`). */
export type GroupArea = "parent" | "teacher" | "admin";

export const NO_COORDINATOR_NOTICE =
  "Ennek a csoportnak most nincs koordinátora. Amíg nincs, csak az adminisztrátor kezelheti.";
export const GROUP_UNAVAILABLE_TEXT = "Ez a munkacsoport nem érhető el.";
export const EMPTY_MEMBERS_TEXT = "Még nincs tagja ennek a csoportnak.";
export const COORDINATOR_MEMBER_NOTE =
  "Koordinátor csak a csoport tagja lehet. Ha a megválasztott szülő nincs a listán, előbb csatlakoznia kell a csoporthoz.";

type Props = Readonly<{
  result: ApplicationResult<WorkingGroupDetailModel>;
  area: GroupArea;
  /** The area's group list, where the back link goes. */
  listPath: string;
  /** The area's parent directory, where a member's name leads (U3 decides what it shows). */
  directoryPath: string;
  /** What the caller can do about their own membership (a parent's join and leave). */
  ownControls?: (model: WorkingGroupDetailModel) => ReactNode;
  /** What the caller can do about one member (a super admin's coordinator actions). */
  memberControls?: (member: WorkingGroupMember, model: WorkingGroupDetailModel) => ReactNode;
}>;

function MemberRow({
  member,
  model,
  area,
  directoryPath,
  memberControls,
}: Readonly<{
  member: WorkingGroupMember;
  model: WorkingGroupDetailModel;
  area: GroupArea;
  directoryPath: string;
  memberControls: Props["memberControls"];
}>) {
  const controls = memberControls?.(member, model);
  return (
    <li
      className={`${area}-group-member`}
      data-testid={`${area}-group-member-${member.membershipId}`}
    >
      <div className={`${area}-group-member-main`}>
        <a href={directoryPath} className={`${area}-group-member-name`}>
          {member.fullName}
        </a>
        {member.isSelf && <span className={`${area}-group-badge`}>Te</span>}
        {member.isCoordinator && (
          <span
            className={`${area}-group-badge ${area}-group-badge-coordinator`}
            data-testid={`${area}-group-coordinator-${member.membershipId}`}
          >
            Koordinátor
          </span>
        )}
        {(member.phone || member.email) && (
          <p className={`${area}-group-member-contact`}>
            {member.phone && <a href={`tel:${member.phone.replace(/\s/g, "")}`}>{member.phone}</a>}
            {member.email && <a href={`mailto:${member.email}`}>{member.email}</a>}
          </p>
        )}
      </div>
      {controls}
    </li>
  );
}

function StatePanel({ area, kind }: Readonly<{ area: GroupArea; kind: "unavailable" | "error" }>) {
  const unavailable = kind === "unavailable";
  return (
    <section className={`${area}-group-state`} role="alert" data-testid={`${area}-group-${kind}`}>
      <h2>{unavailable ? GROUP_UNAVAILABLE_TEXT : "Hiba történt"}</h2>
      {!unavailable && <p>A munkacsoport most nem tölthető be. Próbáld meg később.</p>}
    </section>
  );
}

/**
 * One working group's page, shared by the parent, teacher and admin areas (BR42). The page shows the same group
 * and members to every role; what a role may do comes in as `ownControls` and `memberControls`, so the teacher page
 * has none. Success (also with no members), unavailable and error are separate states, never stacked (NFR4.5).
 */
export function WorkingGroupDetail({
  result,
  area,
  listPath,
  directoryPath,
  ownControls,
  memberControls,
}: Props) {
  const back = (
    <a
      href={listPath}
      className={`${area}-group-back-link`}
      data-testid={`${area}-group-back-link`}
    >
      Vissza a munkacsoportokhoz
    </a>
  );
  if (result.state !== "success" && result.state !== "recovery") {
    const unavailable = ["denied", "invalidated", "empty"].includes(result.state);
    return (
      <section className={`${area}-group-page`} data-testid={`${area}-group-page`}>
        {back}
        <StatePanel area={area} kind={unavailable ? "unavailable" : "error"} />
      </section>
    );
  }
  const model = result.data;
  const manages = model.members.some((member) => member.version !== undefined);
  return (
    <section className={`${area}-group-page`} data-testid={`${area}-group-page`}>
      {back}
      <header className={`${area}-group-header`}>
        <p className="eyebrow">{model.group.schoolYearName}-es nevelési év</p>
        <h1 tabIndex={-1}>{model.group.name}</h1>
        <p>{model.group.description}</p>
      </header>
      {!model.hasCoordinator && (
        <p
          className={`${area}-group-notice`}
          role="note"
          data-testid={`${area}-group-no-coordinator`}
        >
          {NO_COORDINATOR_NOTICE}
        </p>
      )}
      {ownControls?.(model)}
      <section className={`${area}-group-members`} aria-labelledby={`${area}-group-members-title`}>
        <h2 id={`${area}-group-members-title`}>Tagok</h2>
        {area === "admin" && manages && (
          <p className={`${area}-group-hint`} data-testid={`${area}-group-member-note`}>
            {COORDINATOR_MEMBER_NOTE}
          </p>
        )}
        {model.members.length === 0 ? (
          <p
            className={`${area}-group-empty`}
            role="status"
            data-testid={`${area}-group-members-empty`}
          >
            {EMPTY_MEMBERS_TEXT}
          </p>
        ) : (
          <ul className={`${area}-group-member-list`} data-testid={`${area}-group-members`}>
            {model.members.map((member) => (
              <MemberRow
                key={member.membershipId}
                member={member}
                model={model}
                area={area}
                directoryPath={directoryPath}
                memberControls={memberControls}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
