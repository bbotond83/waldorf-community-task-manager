"use client";

import { useState } from "react";
import type { AdminItemDetails, AdminItemKind } from "../../../src/application/index.ts";
import type { AdminLookups } from "../_lib/lookups.ts";
import {
  AdminCheckboxField,
  AdminSelectField,
  AdminTextareaField,
  AdminTextField,
} from "./AdminMutationForm.tsx";

/** The kinds of record the create form offers, in the order of its dropdown. */
export type RecordFormKind = Extract<AdminItemKind, "family" | "child" | "group" | "school-year">;

const KIND_OPTIONS: readonly Readonly<{ value: RecordFormKind; label: string }>[] = [
  { value: "family", label: "Család" },
  { value: "child", label: "Gyermek" },
  { value: "group", label: "Munkacsoport" },
  { value: "school-year", label: "Nevelési év" },
];

const TITLE_LABELS: Readonly<Record<RecordFormKind, string>> = {
  family: "A család neve",
  child: "A gyermek neve",
  group: "A munkacsoport neve",
  "school-year": "A nevelési év megnevezése",
};

/** Parent blocks on a new family; a stored family shows its parents and one empty block for a new one. */
const NEW_FAMILY_PARENT_BLOCKS = 2;

/**
 * The fields of the record form for one kind of record (BR32.7). On the create page the kind is chosen from
 * a dropdown and the fields follow it; on the edit page the kind is the stored record's and fixed. A
 * hidden `extended` field tells the action that these are the record's own fields.
 */
export function RecordFields({
  mode,
  kind: storedKind,
  title,
  details,
  lookups,
}: Readonly<{
  mode: "create" | "edit";
  kind?: RecordFormKind;
  /** The stored name, shown in the title field of the edit form. */
  title?: string;
  details?: AdminItemDetails;
  lookups: AdminLookups;
}>) {
  const [chosen, setChosen] = useState<RecordFormKind>(storedKind ?? "family");
  const kind = mode === "edit" ? (storedKind ?? "family") : chosen;
  return (
    <>
      <input type="hidden" name="extended" value="1" />
      {mode === "create" ? (
        <AdminSelectField
          id="kind"
          name="kind"
          label="Elem típusa"
          options={KIND_OPTIONS}
          value={chosen}
          onChange={(value) => setChosen(value as RecordFormKind)}
          testId="admin-record-kind-select"
        />
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}
      <AdminTextField
        id="title"
        name="title"
        label={TITLE_LABELS[kind]}
        defaultValue={title}
        maxLength={120}
        required
        testId="admin-record-title-input"
      />
      {kind === "family" && <FamilyFields mode={mode} details={details} />}
      {kind === "group" && (
        <AdminTextareaField
          id="description"
          name="description"
          label="Leírás"
          defaultValue={details?.description}
          maxLength={1000}
          required
          testId="admin-record-description-input"
        />
      )}
      {kind === "child" && mode === "create" && (
        <AdminSelectField
          id="familyId"
          name="familyId"
          label="Család"
          options={lookups.families}
          placeholder="Válasszon családot"
          required
          testId="admin-record-family-select"
        />
      )}
      {kind === "group" && mode === "create" && (
        <AdminSelectField
          id="schoolYearId"
          name="schoolYearId"
          label="Nevelési év"
          options={lookups.schoolYears}
          placeholder="Válasszon nevelési évet"
          required
          hint="A munkacsoport nevelési éve később nem módosítható."
          testId="admin-record-school-year-select"
        />
      )}
      {kind === "school-year" && (
        <>
          <AdminTextField
            id="startsOn"
            name="startsOn"
            type="date"
            label="Első nap"
            defaultValue={details?.startsOn}
            required
            testId="admin-record-starts-on-input"
          />
          <AdminTextField
            id="endsOn"
            name="endsOn"
            type="date"
            label="Utolsó nap"
            defaultValue={details?.endsOn}
            required
            testId="admin-record-ends-on-input"
          />
        </>
      )}
    </>
  );
}

function FamilyFields({
  mode,
  details,
}: Readonly<{ mode: "create" | "edit"; details?: AdminItemDetails }>) {
  const parents = details?.parents ?? [];
  const blocks = mode === "create" ? NEW_FAMILY_PARENT_BLOCKS : parents.length + 1;
  return (
    <>
      {Array.from({ length: blocks }, (_, index) => (
        <ParentBlock
          key={parents[index]?.id ?? `new-${index}`}
          index={index}
          parent={parents[index]}
        />
      ))}
    </>
  );
}

function ParentBlock({
  index,
  parent,
}: Readonly<{ index: number; parent?: NonNullable<AdminItemDetails["parents"]>[number] }>) {
  const prefix = `parent-${index}`;
  return (
    <fieldset className="admin-parent-block" data-testid={`admin-parent-block-${index}`}>
      <legend>{parent ? `Szülő ${index + 1}` : `Szülő ${index + 1} (új)`}</legend>
      {parent && (
        <>
          <input type="hidden" name={`${prefix}-id`} value={parent.id} />
          <input type="hidden" name={`${prefix}-version`} value={parent.version} />
        </>
      )}
      <AdminTextField
        id={`${prefix}-name`}
        name={`${prefix}-name`}
        label="A szülő neve"
        defaultValue={parent?.displayName}
        maxLength={200}
        testId={`admin-parent-${index}-name-input`}
      />
      <AdminTextField
        id={`${prefix}-email`}
        name={`${prefix}-email`}
        type="email"
        label="E-mail-cím"
        defaultValue={parent?.email}
        maxLength={254}
        testId={`admin-parent-${index}-email-input`}
      />
      <AdminTextField
        id={`${prefix}-phone`}
        name={`${prefix}-phone`}
        type="tel"
        label="Telefonszám"
        defaultValue={parent?.phone}
        maxLength={20}
        testId={`admin-parent-${index}-phone-input`}
      />
      <AdminTextField
        id={`${prefix}-locality`}
        name={`${prefix}-locality`}
        label="Település"
        defaultValue={parent?.locality}
        maxLength={100}
        testId={`admin-parent-${index}-locality-input`}
      />
      <AdminTextareaField
        id={`${prefix}-profile`}
        name={`${prefix}-profile`}
        label="Önkéntes bemutatkozás"
        defaultValue={parent?.optionalProfile}
        maxLength={500}
        hint="Nem kötelező. Csak a szülő hozzájárulásával menthető."
        testId={`admin-parent-${index}-profile-input`}
      />
      <AdminCheckboxField
        id={`${prefix}-consent`}
        name={`${prefix}-consent`}
        label="A szülő hozzájárult a bemutatkozás tárolásához"
        defaultChecked={parent?.optionalProfileConsent}
        testId={`admin-parent-${index}-consent-input`}
      />
      {parent?.linked && (
        <p className="form-hint" data-testid={`admin-parent-${index}-linked`}>
          Ehhez a szülőhöz már tartozik bejelentkezési fiók.
        </p>
      )}
    </fieldset>
  );
}
