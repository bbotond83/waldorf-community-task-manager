export default function StaffLoading() {
  return (
    <section className="staff-page" role="status" aria-live="polite" data-testid="staff-loading">
      <p className="eyebrow">Munkatársi felület</p>
      <h1 tabIndex={-1}>Beosztás</h1>
      <p>Betöltés folyamatban</p>
    </section>
  );
}
