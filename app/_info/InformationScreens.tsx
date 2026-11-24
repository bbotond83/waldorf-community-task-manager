import type { InfoSectionItem } from "../../src/application/index.ts";
import { parseSectionText, type InlinePart } from "../../src/application/section-text.ts";
import { terminalFailure } from "../../src/application/results.ts";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import { resolveInformationFacade } from "../_animal/facade.ts";
import type { InfoActor } from "./actor.ts";
import { HideForm, SectionEditor } from "./InformationForms.tsx";
import { OpenFromHash } from "./OpenFromHash.tsx";

const MONTHS = [
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

/** "március–október" for a run of months, otherwise the names joined by commas. */
function seasonText(months: readonly number[]): string {
  const sorted = [...months].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return "";
  const run = sorted.every((month, index) => month === first + index);
  const names = sorted.map((month) => MONTHS[month - 1] ?? "");
  return run && sorted.length > 2 ? `${names[0]}–${names[names.length - 1]}` : names.join(", ");
}

function Inline({ parts }: Readonly<{ parts: readonly InlinePart[] }>) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "bold") return <strong key={index}>{part.text}</strong>;
        if (part.kind === "link") {
          return part.external ? (
            <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
              {part.text}
            </a>
          ) : (
            <a key={index} href={part.href}>
              {part.text}
            </a>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

/** The stored text drawn as plain blocks (paragraphs, lists): never as HTML (NFR3.12). */
function SectionText({ body }: Readonly<{ body: string }>) {
  const blocks = parseSectionText(body);
  return (
    <div className="info-text" data-testid="info-text">
      {blocks.map((block, index) => {
        if (block.kind === "paragraph") {
          return (
            <p key={index}>
              <Inline parts={block.parts} />
            </p>
          );
        }
        const List = block.kind === "bullets" ? "ul" : "ol";
        return (
          <List key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <Inline parts={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

function Section({
  section,
  canManage,
  editing,
  ownerGroupNames,
}: Readonly<{
  section: InfoSectionItem;
  canManage: boolean;
  editing: boolean;
  ownerGroupNames: readonly string[];
}>) {
  return (
    // The link of a duty card is `/informacio#<key>`; a section the address names opens (the `:target` rule in the CSS).
    <details
      id={section.key}
      className="info-section"
      open={editing || undefined}
      data-testid={`info-section-${section.key}`}
    >
      <summary className="info-summary">
        <span className="info-title">{section.title}</span>
        {section.hidden && (
          <span className="info-chip" data-testid={`info-hidden-${section.key}`}>
            Elrejtve
          </span>
        )}
        {section.seasonMonths && section.seasonMonths.length > 0 && (
          <span className="info-chip" data-testid={`info-season-${section.key}`}>
            {seasonText(section.seasonMonths)}
          </span>
        )}
      </summary>
      <div className="info-body">
        {section.owningGroupName && (
          <p className="info-owner">Felelős csoport: {section.owningGroupName}</p>
        )}
        {editing ? (
          <SectionEditor
            section={section}
            canEditAll={section.canEditAll}
            ownerGroupNames={ownerGroupNames}
          />
        ) : (
          <SectionText body={section.body} />
        )}
        <p className="info-actions">
          {section.canEditText && !editing && (
            <a
              href={`/informacio?szerkesztes=${section.key}#${section.key}`}
              aria-label={`${section.title} szerkesztése`}
              data-testid={`info-edit-${section.key}`}
            >
              Szerkesztés
            </a>
          )}
          {editing && (
            <a href={`/informacio#${section.key}`} data-testid={`info-cancel-${section.key}`}>
              Mégse
            </a>
          )}
        </p>
        {canManage && !editing && <HideForm section={section} />}
      </div>
    </details>
  );
}

/**
 * The information page: the community's working instructions as sections the reader opens (BR86). Every signed-in role
 * reads the visible sections; whoever may edit gets a Szerkesztés link per section, and a super admin also adds, hides
 * and restores sections. A failed read shows an error, never an empty page.
 */
export async function InformationScreen({
  actor,
  editKey,
}: Readonly<{ actor: InfoActor; editKey: string | undefined }>) {
  const information = await resolveInformationFacade();
  const result = information
    ? await information.list(actor.session, actor.scope)
    : terminalFailure();
  return (
    <section className="parent-page info-page" data-testid="info-page">
      <header className="info-header">
        <p className="eyebrow">Közösségi élet</p>
        <h1 tabIndex={-1}>Információ</h1>
        <p className="info-intro">Tudnivalók a közös feladatokhoz és a mindennapokhoz.</p>
      </header>
      <OpenFromHash />
      <ParentStatePanel
        result={result}
        emptyMessage="Még nincs megjeleníthető szakasz."
        testId="info-state"
      >
        {(model) => (
          <>
            {model.canManage && editKey !== "uj" && (
              <p className="parent-page-actions">
                <a href="/informacio?szerkesztes=uj#uj" data-testid="info-new-link">
                  Új szakasz
                </a>
              </p>
            )}
            {model.canManage && editKey === "uj" && (
              <section id="uj" className="info-new" data-testid="info-new">
                <h2>Új szakasz</h2>
                <SectionEditor canEditAll ownerGroupNames={model.ownerGroupNames} />
                <p>
                  <a href="/informacio" data-testid="info-new-cancel">
                    Mégse
                  </a>
                </p>
              </section>
            )}
            {model.items.length === 0 ? (
              <p className="parent-empty" role="status" data-testid="info-empty">
                Még nincs megjeleníthető szakasz.
              </p>
            ) : (
              <div className="info-list" data-testid="info-list">
                {model.items.map((section) => (
                  <Section
                    key={section.id}
                    section={section}
                    canManage={model.canManage}
                    editing={editKey === section.key && section.canEditText}
                    ownerGroupNames={model.ownerGroupNames}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </ParentStatePanel>
    </section>
  );
}
