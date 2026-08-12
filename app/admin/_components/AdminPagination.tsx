export function AdminPagination() {
  return (
    <nav aria-label="Lapozás" className="admin-pagination" data-testid="admin-pagination">
      <span aria-disabled="true">Előző oldal</span>
      <span aria-current="page">1. oldal</span>
      <span aria-disabled="true">Következő oldal</span>
    </nav>
  );
}
