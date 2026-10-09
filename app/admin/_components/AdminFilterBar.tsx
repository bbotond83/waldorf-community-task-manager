import {
  ADMIN_LIST_STATUS_OPTIONS,
  statusLabel,
  type AdminListKind,
} from "../../../src/application/status-labels.ts";

type AdminFilterBarProps = Readonly<{
  action: string;
  /** Which list the bar belongs to: it offers only the statuses that list can contain. */
  list: AdminListKind;
  query?: string;
  state?: string;
  /** True when the address carried a status the list does not offer (it is ignored). */
  unknownState?: boolean;
}>;

export function AdminFilterBar({
  action,
  list,
  query = "",
  state = "",
  unknownState = false,
}: AdminFilterBarProps) {
  return (
    <>
      <form action={action} method="get" className="admin-filter" data-testid="admin-filter-form">
        <label htmlFor="admin-filter-query">Keresés</label>
        <input
          id="admin-filter-query"
          name="q"
          defaultValue={query}
          data-testid="admin-filter-query-input"
        />
        <label htmlFor="admin-filter-state">Állapot</label>
        <select
          id="admin-filter-state"
          name="state"
          defaultValue={state}
          data-testid="admin-filter-state-select"
        >
          <option value="">Minden állapot</option>
          {ADMIN_LIST_STATUS_OPTIONS[list].map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
        <button type="submit" data-testid="admin-filter-submit-button">
          Szűrés
        </button>
      </form>
      {unknownState && (
        <p role="status" className="form-hint" data-testid="admin-filter-unknown-note">
          Ez az állapotszűrő ebben a listában már nem érhető el, ezért minden elem látható.
        </p>
      )}
    </>
  );
}
