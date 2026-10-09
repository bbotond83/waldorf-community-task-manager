export default function TeacherLoading() {
  return (
    <section
      className="teacher-page"
      role="status"
      aria-live="polite"
      data-testid="teacher-loading"
    >
      <p className="eyebrow">Óvónő felület</p>
      <h1 tabIndex={-1}>Beosztás</h1>
      <p>Betöltés folyamatban</p>
    </section>
  );
}
