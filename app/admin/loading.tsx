export default function AdminLoading() {
  return (
    <section className="admin-page admin-state" aria-busy="true" data-testid="admin-loading-state">
      <p className="eyebrow">Adminisztráció</p>
      <h1>Betöltés folyamatban</h1>
      <p role="status">Az adminisztrációs adatok betöltése folyamatban van.</p>
    </section>
  );
}
