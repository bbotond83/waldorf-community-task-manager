type AdminFilterBarProps = Readonly<{
  action: string;
  query?: string;
  state?: string;
}>;

export function AdminFilterBar({ action, query = "", state = "" }: AdminFilterBarProps) {
  return (
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
        <option value="active">Aktív</option>
        <option value="archived">Archivált</option>
        <option value="open">Nyitott</option>
        <option value="pending">Függőben</option>
      </select>
      <button type="submit" data-testid="admin-filter-submit-button">
        Szűrés
      </button>
    </form>
  );
}
