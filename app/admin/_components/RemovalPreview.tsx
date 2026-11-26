import type {
  CoordinatorGroupModel,
  RemovalPreviewModel,
  RemovalSubjectModel,
} from "../../../src/application/index.ts";
import { REMOVAL_BLOCK_LABELS, REMOVAL_TEXTS } from "../../../src/data/copy.ts";

/**
 * What the two removal confirmations share (U14): what happens, the counts per area and the groups that will be left
 * without a coordinator. Each sentence states what the removal does; the directory loses the address, while the closed
 * sign-in account keeps it, and the words say so.
 */
const CONSEQUENCES: Readonly<Record<RemovalSubjectModel["kind"], readonly string[]>> = {
  parent: [
    "a szülő bejelentkezése megszűnik, és minden munkamenete véget ér;",
    "a telefonszáma, az e-mail-címe és a megosztott adatai törlődnek a névjegyzékből (a lezárt bejelentkezési fiók az e-mail-címet megőrzi);",
    "a nyitott meghívója érvénytelenné válik;",
    "a szülő eltűnik a névsorból, a korábbi bejegyzéseknél „korábbi tag” néven szerepel.",
  ],
  family: [
    "minden szülő bejelentkezése megszűnik;",
    "a telefonszámok, e-mail-címek és megosztott adatok törlődnek a névjegyzékből (a lezárt bejelentkezési fiók az e-mail-címet megőrzi);",
    "a jövőbeli kézi feladathelyek felszabadulnak;",
    "a beosztás és az állatgondozás helyei megmaradnak, és átosztásra várnak;",
    "a korábbi bejegyzéseknél „korábbi család” néven szerepel;",
    "30 napig visszaállítható.",
  ],
};

export function RemovalConsequences({ kind }: Readonly<{ kind: RemovalSubjectModel["kind"] }>) {
  return (
    <>
      <p>Az eltávolítás után:</p>
      <ul>
        {CONSEQUENCES[kind].map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
      </ul>
    </>
  );
}

/** The counts as a table, and on a phone as one card per area, so nothing scrolls sideways. */
export function RemovalCounts({ preview }: Readonly<{ preview: RemovalPreviewModel }>) {
  const rows = [
    ...preview.steps.map((step) => ({
      key: step.block,
      area: REMOVAL_BLOCK_LABELS[step.block],
      toClear: step.toClear,
      toFlag: step.toFlag,
    })),
    {
      key: "total",
      area: "Összesen",
      toClear: preview.totals.toClear,
      toFlag: preview.totals.toFlag,
    },
  ];
  return (
    <div data-testid="admin-removal-counts">
      <div className="admin-removal-table-wrapper">
        <table className="admin-removal-table">
          <caption className="visually-hidden">Az érintett bejegyzések száma területenként</caption>
          <thead>
            <tr>
              <th scope="col">Terület</th>
              <th scope="col">{REMOVAL_TEXTS.toClear}</th>
              <th scope="col">{REMOVAL_TEXTS.toFlag}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} data-testid={`admin-removal-row-${row.key}`}>
                <th scope="row">{row.area}</th>
                <td>{row.toClear}</td>
                <td>{row.toFlag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="admin-removal-cards" aria-label="Az érintett bejegyzések száma területenként">
        {rows.map((row) => (
          <li key={row.key}>
            <strong>{row.area}</strong>
            <dl>
              <div>
                <dt>{REMOVAL_TEXTS.toClear}</dt>
                <dd>{row.toClear}</dd>
              </div>
              <div>
                <dt>{REMOVAL_TEXTS.toFlag}</dt>
                <dd>{row.toFlag}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RemovalGroupsWarning({
  groups,
}: Readonly<{ groups: readonly CoordinatorGroupModel[] }>) {
  if (groups.length === 0) return null;
  return (
    <section className="admin-rota-warning" data-testid="admin-removal-groups">
      <h3>{REMOVAL_TEXTS.groupsLeftWithoutCoordinator}</h3>
      <ul>
        {groups.map((group) => (
          <li key={group.groupId}>{group.groupName}</li>
        ))}
      </ul>
      <p>Az eltávolítás után jelölj ki új koordinátort.</p>
    </section>
  );
}
