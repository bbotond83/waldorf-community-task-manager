/** The school year choice of the calendar and rota screens; shown only when there is more than one active year. */
export function YearSwitcher({
  years,
  selectedId,
  action,
}: Readonly<{
  years: readonly Readonly<{ id: string; name: string }>[];
  selectedId: string;
  action: string;
}>) {
  if (years.length < 2) return null;
  return (
    <form className="parent-filter" action={action} data-testid="admin-year-switcher">
      <div className="filter-field">
        <label htmlFor="tanev">Tanév</label>
        <select id="tanev" name="tanev" defaultValue={selectedId}>
          {years.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-actions">
        <button type="submit">Megnyitás</button>
      </div>
    </form>
  );
}
