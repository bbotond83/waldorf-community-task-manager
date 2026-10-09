import { randomUUID } from "node:crypto";
import { AdminBackLink, ADMIN_LIST_LINKS } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm, AdminTextField } from "../../_components/AdminMutationForm.tsx";
import { saveRecordAction } from "../../actions.ts";

export default function NewRecordPage() {
  return (
    <section className="admin-page" data-testid="admin-record-create-page">
      <header>
        <AdminBackLink list="records" />
        <p className="eyebrow">Nyilvántartások</p>
        <h1 tabIndex={-1}>Új elem</h1>
      </header>
      <AdminMutationForm
        action={saveRecordAction}
        submitLabel="Elem létrehozása"
        testId="admin-record-create-form"
        successLink={ADMIN_LIST_LINKS.records}
      >
        <input type="hidden" name="id" value="new" />
        <input type="hidden" name="expectedVersion" value="1" />
        <input type="hidden" name="idempotencyKey" value={`record:create:${randomUUID()}`} />
        <label htmlFor="kind">Elem típusa</label>
        <select id="kind" name="kind" data-testid="admin-record-kind-select">
          <option value="family">Család</option>
          <option value="child">Gyermek</option>
          <option value="group">Csoport</option>
          <option value="school-year">Nevelési év</option>
        </select>
        <AdminTextField
          id="title"
          name="title"
          label="Megnevezés"
          maxLength={120}
          required
          testId="admin-record-title-input"
        />
      </AdminMutationForm>
    </section>
  );
}
