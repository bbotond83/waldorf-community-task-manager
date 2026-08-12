import { randomUUID } from "node:crypto";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { saveRecordAction } from "../../actions.ts";

export default function NewRecordPage() {
  return (
    <section className="admin-page" data-testid="admin-record-create-page">
      <header>
        <p className="eyebrow">Nyilvántartások</p>
        <h1 tabIndex={-1}>Új rekord</h1>
      </header>
      <AdminMutationForm
        action={saveRecordAction}
        submitLabel="Rekord létrehozása"
        testId="admin-record-create-form"
      >
        <input type="hidden" name="id" value="new" />
        <input type="hidden" name="expectedVersion" value="1" />
        <input type="hidden" name="idempotencyKey" value={`record:create:${randomUUID()}`} />
        <label htmlFor="kind">Rekord típusa</label>
        <select id="kind" name="kind" data-testid="admin-record-kind-select">
          <option value="family">Család</option>
          <option value="child">Gyermek</option>
          <option value="group">Csoport</option>
          <option value="school-year">Nevelési év</option>
        </select>
        <label htmlFor="title">Megnevezés</label>
        <input
          id="title"
          name="title"
          maxLength={120}
          required
          data-testid="admin-record-title-input"
        />
      </AdminMutationForm>
    </section>
  );
}
