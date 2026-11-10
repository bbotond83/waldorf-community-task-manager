import type {
  ApplicationResult,
  WorkingGroupItem,
  WorkingGroupListModel,
} from "../application/index.ts";

/** The groups of each school year, newest year first, as the list function returned them. */
function byYear(items: readonly WorkingGroupItem[]) {
  const years = new Map<string, WorkingGroupItem[]>();
  for (const item of items)
    years.set(item.schoolYearName, [...(years.get(item.schoolYearName) ?? []), item]);
  return [...years.entries()];
}

function WorkingGroupCards({ items }: Readonly<{ items: readonly WorkingGroupItem[] }>) {
  return (
    <ul className="workgroup-list" data-testid="workgroup-list">
      {items.map((group) => (
        <li className="workgroup-card" key={group.id} data-testid={`workgroup-card-${group.id}`}>
          <h2>{group.name}</h2>
          <p>{group.description}</p>
        </li>
      ))}
    </ul>
  );
}

function StateMessage({ result }: Readonly<{ result: ApplicationResult<WorkingGroupListModel> }>) {
  if (result.state === "empty") {
    return (
      <p className="workgroup-state" role="status" data-testid="workgroup-empty">
        Még nincs munkacsoport.
      </p>
    );
  }
  const refused = result.state === "denied" || result.state === "invalidated";
  return (
    <section
      className="workgroup-state"
      role="alert"
      data-testid={refused ? "workgroup-denied" : "workgroup-error"}
    >
      <h2>{refused ? "Nincs jogosultság" : "Hiba történt"}</h2>
      <p>
        {refused
          ? "A kért tartalom nem érhető el."
          : "A munkacsoportok most nem tölthetők be. Próbálja meg később."}
      </p>
    </section>
  );
}

/**
 * The read-only working-group list, one page per role area sharing this content (W3). Success, empty, denied and
 * error are separate states (NFR4.5).
 */
export function WorkingGroupList({
  result,
}: Readonly<{ result: ApplicationResult<WorkingGroupListModel> }>) {
  const years =
    result.state === "success" || result.state === "recovery" ? byYear(result.data.items) : [];
  const [first, ...older] = years;
  return (
    <section className="workgroup-page" data-testid="workgroup-page">
      <header>
        {first && <p className="eyebrow">{first[0]}-es nevelési év</p>}
        <h1 tabIndex={-1} autoFocus>
          Munkacsoportok
        </h1>
        <p>A közösség munkacsoportjai ebben a nevelési évben.</p>
      </header>
      {first ? <WorkingGroupCards items={first[1]} /> : <StateMessage result={result} />}
      {older.map(([year, items]) => (
        <section key={year}>
          <p className="eyebrow">{year}-es nevelési év</p>
          <WorkingGroupCards items={items} />
        </section>
      ))}
    </section>
  );
}
