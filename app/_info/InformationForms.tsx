"use client";

import type { InfoSectionItem } from "../../src/application/index.ts";
import { ParentMutationForm } from "../szulo/_components/ParentMutationForm.tsx";
import { saveSectionAction, setHiddenAction } from "./actions.ts";

const MONTH_NAMES = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
];

/**
 * The editor of one section, or of a new one when `section` is missing. Everyone who may edit sees the text and its
 * formatting help; only a super admin also sees the title, owner, season months and order. The other fields are sent
 * unchanged, so a coordinator's save changes the text only (BR87.1, BR87.6).
 */
export function SectionEditor({
  section,
  canEditAll,
  ownerGroupNames,
}: Readonly<{
  section?: InfoSectionItem;
  canEditAll: boolean;
  ownerGroupNames: readonly string[];
}>) {
  const months = new Set(section?.seasonMonths ?? []);
  return (
    <ParentMutationForm
      action={saveSectionAction}
      submitLabel={section ? "Mentés" : "Szakasz felvétele"}
      testId="info-section-form"
      freshIdempotencyKey
    >
      <input
        type="hidden"
        name="idempotencyKey"
        value={section ? `info-section:${section.id}:v${section.version}` : "info-section-add"}
      />
      {section && <input type="hidden" name="sectionId" value={section.id} />}
      {section && <input type="hidden" name="expectedVersion" value={section.version} />}
      {canEditAll ? (
        <div className="parent-field">
          <label htmlFor="info-title">Cím</label>
          <input
            id="info-title"
            name="title"
            type="text"
            defaultValue={section?.title}
            maxLength={120}
            required
            data-testid="info-title"
          />
        </div>
      ) : (
        <>
          <input type="hidden" name="title" value={section?.title ?? ""} />
          <input type="hidden" name="owningGroupName" value={section?.owningGroupName ?? ""} />
          <input type="hidden" name="position" value={section?.position ?? 0} />
          {(section?.seasonMonths ?? []).map((month) => (
            <input key={month} type="hidden" name="seasonMonth" value={month} />
          ))}
        </>
      )}
      <div className="parent-field">
        <label htmlFor="info-body">Szöveg</label>
        <p id="info-body-hint" className="form-hint">
          Üres sor új bekezdést kezd. Felsoroláshoz sor elejére írj „- ” jelet, számozáshoz „1. ”
          jelet. Vastag szöveg: **így**. Hivatkozás: [szöveg](https://cím).
        </p>
        <textarea
          id="info-body"
          name="body"
          rows={14}
          maxLength={20000}
          defaultValue={section?.body}
          aria-describedby="info-body-hint info-body-warning"
          data-testid="info-body"
        />
        <p id="info-body-warning" className="parent-notice" data-testid="info-body-warning">
          Ne írj ide telefonszámot, e-mail-címet vagy gyermek nevét: az oldalt minden bejelentkezett
          felhasználó látja.
        </p>
      </div>
      {canEditAll && (
        <>
          <div className="parent-field">
            <label htmlFor="info-owner">Felelős csoport</label>
            <select
              id="info-owner"
              name="owningGroupName"
              defaultValue={section?.owningGroupName ?? ""}
              data-testid="info-owner"
            >
              <option value="">Nincs</option>
              {ownerGroupNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="parent-field" data-testid="info-season">
            <legend>Szezon (hónapok; üresen: egész évben)</legend>
            {MONTH_NAMES.map((name, index) => (
              <label key={name} className="info-month">
                <input
                  type="checkbox"
                  name="seasonMonth"
                  value={index + 1}
                  defaultChecked={months.has(index + 1)}
                />{" "}
                {name}
              </label>
            ))}
          </fieldset>
          <div className="parent-field">
            <label htmlFor="info-position">Sorrend</label>
            <input
              id="info-position"
              name="position"
              type="number"
              min={0}
              max={1000}
              defaultValue={section?.position ?? 100}
              data-testid="info-position"
            />
          </div>
        </>
      )}
    </ParentMutationForm>
  );
}

/** Hides or restores a section; the section's version travels with the form. */
export function HideForm({ section }: Readonly<{ section: InfoSectionItem }>) {
  return (
    <ParentMutationForm
      action={setHiddenAction}
      submitLabel={section.hidden ? "Visszaállítás" : "Elrejtés"}
      submitAriaLabel={
        section.hidden ? `${section.title} visszaállítása` : `${section.title} elrejtése`
      }
      testId={`info-hide-${section.key}`}
      freshIdempotencyKey
    >
      <input
        type="hidden"
        name="idempotencyKey"
        value={`info-hide:${section.id}:v${section.version}`}
      />
      <input type="hidden" name="sectionId" value={section.id} />
      <input type="hidden" name="expectedVersion" value={section.version} />
      <input type="hidden" name="hidden" value={section.hidden ? "false" : "true"} />
    </ParentMutationForm>
  );
}
