import { randomUUID } from "node:crypto";
import { isProductionMode } from "../../../_identity/production-request.ts";
import { AdminBackLink, ADMIN_LIST_LINKS } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm, AdminTextField } from "../../_components/AdminMutationForm.tsx";
import { RecordFields } from "../../_components/RecordFields.tsx";
import { resolveAdminLookups } from "../../_lib/request-lookups.ts";
import { saveRecordAction } from "../../actions.ts";

export default async function NewRecordPage() {
  const production = await isProductionMode();
  const lookups = await resolveAdminLookups();
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
        longForm={production}
        clearOnSuccess
      >
        <input type="hidden" name="id" value="new" />
        <input type="hidden" name="expectedVersion" value="1" />
        <input type="hidden" name="idempotencyKey" value={`record:create:${randomUUID()}`} />
        {production ? (
          <RecordFields mode="create" lookups={lookups} />
        ) : (
          <>
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
          </>
        )}
      </AdminMutationForm>
    </section>
  );
}
