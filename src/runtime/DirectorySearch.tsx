"use client";

import { useId, useMemo, useState } from "react";
import type { DirectoryFamily, DirectoryParent } from "../application/index.ts";
import { filterFamilies } from "./directory-search.ts";

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase("hu"))
    .join("");
}

const DETAIL_ROWS = [
  ["residence", "Lakóhely"],
  ["occupation", "Foglalkozás"],
  ["hobby", "Hobbi"],
] as const;

/** One parent. A field the viewer may not see was never sent, so it is absent here, not hidden. */
function ParentEntry({ parent }: Readonly<{ parent: DirectoryParent }>) {
  const details = DETAIL_ROWS.filter(([field]) => parent[field]);
  const hasMore =
    details.length > 0 ||
    Boolean(parent.howISupport) ||
    Boolean(parent.email) ||
    Boolean(parent.phone);
  return (
    <li className="parent-directory-person" data-testid={`directory-parent-${parent.id}`}>
      <span className="parent-directory-initials" aria-hidden="true">
        {initials(parent.fullName)}
      </span>
      <div className="parent-directory-person-body">
        <h3>{parent.fullName}</h3>
        {!hasMore && <p className="parent-directory-quiet">Nem osztott meg részletes adatokat.</p>}
        {(parent.phone || parent.email) && (
          <p className="parent-directory-contact">
            {parent.phone && (
              <a
                className="button-link button-link-secondary"
                href={`tel:${parent.phone.replaceAll(" ", "")}`}
              >
                <ContactIcon shape="phone" />
                {parent.phone}
              </a>
            )}
            {parent.email && (
              <a className="button-link button-link-secondary" href={`mailto:${parent.email}`}>
                <ContactIcon shape="mail" />
                {parent.email}
              </a>
            )}
          </p>
        )}
        {(details.length > 0 || parent.howISupport) && (
          <dl className="parent-directory-details">
            {details.map(([field, label]) => (
              <div key={field}>
                <dt>{label}</dt>
                <dd>{parent[field]}</dd>
              </div>
            ))}
            {parent.howISupport && (
              <div>
                <dt>Hogyan támogatom a közösséget</dt>
                <dd>{parent.howISupport}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </li>
  );
}

function FamilyCard({ family }: Readonly<{ family: DirectoryFamily }>) {
  return (
    <li className="parent-directory-card" data-testid={`directory-family-${family.familyId}`}>
      <h2>{family.familyName}</h2>
      <ul className="parent-directory-people">
        {family.parents.map((parent) => (
          <ParentEntry key={parent.id} parent={parent} />
        ))}
      </ul>
      {family.children && family.children.length > 0 && (
        <div
          className="parent-directory-children"
          data-testid={`directory-children-${family.familyId}`}
        >
          <h3>Gyermekek</h3>
          <ul>
            {family.children.map((name, index) => (
              <li key={`${index}-${name}`}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/**
 * The searchable family cards (US3.1, US3.5). Typing filters the cards already on the page: nothing is sent while
 * typing (BR30.9). No match is its own state, with a way back to the whole list.
 */
export function DirectorySearch({ families }: Readonly<{ families: readonly DirectoryFamily[] }>) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const hintId = useId();
  const shown = useMemo(() => filterFamilies(families, query), [families, query]);
  return (
    <>
      <form
        className="parent-directory-search"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor={inputId}>Keresés név szerint</label>
        <input
          id={inputId}
          type="search"
          name="q"
          autoComplete="off"
          placeholder="Szülő, gyermek vagy család neve"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="directory-search-input"
          aria-describedby={hintId}
        />
        <p className="parent-directory-hint" id={hintId} data-testid="directory-search-hint">
          A kereső automatikusan szűr a családnevekre és a megadott keresztnevekre is.
        </p>
      </form>
      <div className="parent-directory-summary">
        <p className="parent-directory-count" role="status" data-testid="directory-count">
          {shown.length > 0 ? `Aktív családok (${shown.length} bejegyzés)` : "Nincs találat"}
        </p>
        <p className="parent-directory-legend" data-testid="directory-legend">
          <span className="parent-directory-legend-marker" aria-hidden="true" />
          Önkéntesen megosztott adatok
        </p>
      </div>
      {shown.length > 0 ? (
        <ul className="parent-directory-list" data-testid="directory-list">
          {shown.map((family) => (
            <FamilyCard key={family.familyId} family={family} />
          ))}
        </ul>
      ) : (
        <section className="parent-state parent-directory-none" data-testid="directory-no-match">
          <h2>Nincs találat</h2>
          <p>A megadott keresési feltételekkel nem találtunk szülőt vagy családot a névtárban.</p>
          <button type="button" className="secondary-button" onClick={() => setQuery("")}>
            Keresés törlése
          </button>
        </section>
      )}
    </>
  );
}

/** A small line icon before a contact, as in the design; the contact text itself carries the meaning. */
function ContactIcon({ shape }: { shape: "phone" | "mail" }) {
  return (
    <svg
      className="parent-directory-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shape === "phone" ? (
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
      ) : (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      )}
    </svg>
  );
}
