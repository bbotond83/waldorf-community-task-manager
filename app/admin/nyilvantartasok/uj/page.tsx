import { randomUUID } from "node:crypto";
import { AdminBackLink, ADMIN_LIST_LINKS } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { RecordFields } from "../../_components/RecordFields.tsx";
import { resolveAdminLookups } from "../../_lib/request-lookups.ts";
import { saveRecordAction } from "../../actions.ts";

export default async function NewRecordPage() {
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
        longForm
        clearOnSuccess
      >
        <input type="hidden" name="id" value="new" />
        <input type="hidden" name="expectedVersion" value="1" />
        <input type="hidden" name="idempotencyKey" value={`record:create:${randomUUID()}`} />
        <RecordFields mode="create" lookups={lookups} />
      </AdminMutationForm>
    </section>
  );
}
