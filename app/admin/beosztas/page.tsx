import type {
  RotaJob,
  RotaPlanModel,
  RotaPlanWeek,
  RotaWeekRef,
} from "../../../src/application/index.ts";
import {
  formatLongDay,
  formatWeekRange,
  HOLD_REASON_TEXT,
  ROTA_JOB_LABELS,
  ROTA_WARNING_TEXT,
  rotaRefusalMessage,
} from "../../../src/application/rota-format.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { resolveRotaFacade } from "../../_identity/rota-facade.ts";
import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm } from "../_components/AdminMutationForm.tsx";
import { YearSwitcher } from "../_components/RotaParts.tsx";
import { resolveAdminSession } from "../_lib/session.ts";
import { reassignDutyAction } from "../actions.ts";
import {
  discardDraftAction,
  makeDraftAction,
  publishAction,
  setWeekAction,
} from "../rota-actions.ts";

export default async function RotaPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ tanev?: string; beosztas?: string }>;
}) {
  const [session, rota, { tanev, beosztas }] = await Promise.all([
    resolveAdminSession(),
    resolveRotaFacade(),
    searchParams,
  ]);
  if (session.state !== "success" || !rota) return <AdminAccessState kind="denied" embedded />;
  const [result, calendar] = await Promise.all([
    rota.getPlan(session.data.applicationSession, session.data.scope, tanev || undefined),
    rota.getCalendar(session.data.applicationSession, session.data.scope, tanev || undefined),
  ]);
  if (result.state === "denied" || result.state === "invalidated") {
    return <AdminAccessState kind="denied" embedded />;
  }
  if (result.state !== "success" && result.state !== "recovery") {
    return (
      <section className="admin-page" data-testid="admin-rota-page">
        <header>
          <p className="eyebrow">Adminisztráció</p>
          <h1 tabIndex={-1}>Beosztás tervezése</h1>
        </header>
        <div className="admin-rota-state" role="alert" data-testid="admin-rota-error">
          <h2>Hiba történt</h2>
          <p>A beosztás most nem tölthető be. Próbálja meg később.</p>
        </div>
      </section>
    );
  }
  const years = calendar.state === "success" ? calendar.data.schoolYears : [];
  const job = JOBS.find((candidate) => candidate === beosztas) ?? "indoor_cleaning";
  return <PlanningScreen model={result.data} years={years} job={job} />;
}

const JOBS = Object.keys(ROTA_JOB_LABELS) as RotaJob[];

function PlanningScreen({
  model,
  years,
  job,
}: Readonly<{
  model: RotaPlanModel;
  years: readonly Readonly<{ id: string; name: string }>[];
  job: RotaJob;
}>) {
  const { schoolYear: year, plan } = model;
  return (
    <section className="admin-page admin-rota-page" data-testid="admin-rota-page">
      <header>
        <p className="eyebrow">Adminisztráció{year ? ` · ${year.name}` : ""}</p>
        <h1 tabIndex={-1} autoFocus>
          Beosztás tervezése
        </h1>
        <p>
          Négy beosztás van: belső takarítás, előkert, vízhordás és hétvégi állatgondozás. Minden
          tanítási hétre egy-egy család jut. A szülők a tervezetet nem látják, csak a közzétett
          beosztást.
        </p>
      </header>
      {!year && (
        <p className="parent-empty" role="status" data-testid="admin-rota-no-year">
          Még nincs tanév. Vegyen fel egyet a Nyilvántartások oldalon.
        </p>
      )}
      {year && <YearSwitcher years={years} selectedId={year.id} action="/admin/beosztas" />}
      {year && !plan && <NoPlan model={model} yearId={year.id} />}
      {year && plan && (
        <>
          <PlanHeader model={model} />
          {plan.status === "draft" && <Blockers model={model} />}
          <Warnings model={model} />
          <JobTabs selected={job} yearId={year!.id} />
          <div className="admin-rota-grid admin-rota-grid-wide">
            <WeekPlan model={model} job={job} />
            <FamilyCounts model={model} job={job} />
          </div>
        </>
      )}
    </section>
  );
}

function NoPlan({ model, yearId }: Readonly<{ model: RotaPlanModel; yearId: string }>) {
  return (
    <section className="admin-rota-panel" data-testid="admin-rota-no-plan">
      <h2>Még nincs terv</h2>
      <p>
        A tervezet az aktív családokat egyenletesen osztja szét a tanítási hetek között (
        {model.weekCount ?? 0} hét). A szüneteket előbb vegye fel a Tanév oldalon.
      </p>
      <AdminMutationForm
        action={makeDraftAction}
        submitLabel="Tervezet készítése"
        testId="admin-rota-draft-form"
        longForm
      >
        <input type="hidden" name="schoolYearId" value={yearId} />
        <input type="hidden" name="idempotencyKey" value={`draft:${yearId}`} />
      </AdminMutationForm>
    </section>
  );
}

function PlanHeader({ model }: Readonly<{ model: RotaPlanModel }>) {
  const plan = model.plan!;
  const draft = plan.status === "draft";
  return (
    <section className="admin-rota-panel admin-rota-head" data-testid="admin-rota-head">
      <div>
        <h2>
          {draft ? (
            <StatusBadge label="Tervezet" symbol={{ icon: "pencil", character: "" }} />
          ) : (
            <StatusBadge label="Közzétéve" symbol={{ icon: "check", character: "" }} />
          )}
        </h2>
        <p>
          {draft
            ? "A szülők még nem látják. Közzététel után mindenki a saját heteit látja, és értesítést kap."
            : `Közzétéve: ${plan.publishedAt ? formatLongDay(plan.publishedAt.slice(0, 10)) : ""}. A közzétett beosztás ebben a változatban nem módosítható.`}
        </p>
      </div>
      {draft && (
        <div className="admin-rota-actions">
          <AdminMutationForm
            action={discardDraftAction}
            submitLabel="Tervezet elvetése"
            testId="admin-rota-discard-form"
          >
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="expectedVersion" value={plan.version} />
            <input type="hidden" name="changedWeeks" value={model.changedWeeks} />
            <input
              type="hidden"
              name="idempotencyKey"
              value={`discard:${plan.id}:v${plan.version}:c${model.changedWeeks}`}
            />
            <p className="form-hint" data-testid="admin-rota-changed-weeks">
              {model.changedWeeks} hét kézzel módosítva
            </p>
          </AdminMutationForm>
          {model.canPublish && (
            <AdminMutationForm
              action={publishAction}
              submitLabel="Közzététel"
              testId="admin-rota-publish-form"
            >
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="expectedVersion" value={plan.version} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`publish:${plan.id}:v${plan.version}`}
              />
            </AdminMutationForm>
          )}
        </div>
      )}
    </section>
  );
}

/** What stops a publish (BR62.3), each line naming the rota and the week. */
function Blockers({ model }: Readonly<{ model: RotaPlanModel }>) {
  const { emptyRows, breakRows, ineligibleRows, flaggedWeeks, clashWeeks } = model.blockers;
  if (model.canPublish) return null;
  const rows = (list: readonly RotaWeekRef[]) =>
    list.map((row) => `${ROTA_JOB_LABELS[row.job]}: ${formatWeekRange(row.weekStart)}`);
  const groups: [string, string, readonly string[]][] = [
    ["empty", "Üres hetek: családot kell adni, mielőtt közzéteszi.", rows(emptyRows)],
    ["break", "Szünetes hétre család van beosztva: üresítse ki.", rows(breakRows)],
    ["ineligible", "A család már nem aktív: adjon másik családot.", rows(ineligibleRows)],
    [
      "flagged",
      "Olyan család szerepel a héten, amely aznap már nem (vagy még nem) vállalhat feladatot: adjon másik családot.",
      flaggedWeeks.map(
        (week) =>
          `${ROTA_JOB_LABELS[week.job]}: ${formatWeekRange(week.weekStart)} – ${week.familyDisplayName} (${HOLD_REASON_TEXT[week.reason]})`,
      ),
    ],
    [
      "clash",
      rotaRefusalMessage("ROTA_SAME_WEEK_CLASH"),
      clashWeeks.map((week) => `${formatWeekRange(week.weekStart)} – ${week.familyDisplayName}`),
    ],
  ];
  return (
    <section className="admin-rota-warning" role="alert" data-testid="admin-rota-blockers">
      <h2>A beosztás még nem tehető közzé</h2>
      {groups
        .filter(([, , lines]) => lines.length > 0)
        .map(([key, text, lines]) => (
          <div key={key} data-testid={`admin-rota-blockers-${key}`}>
            <p>{text}</p>
            <ul>
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}

/** Warnings that do not stop a publish: one family in two rotas of the same week (BR62.7). */
function Warnings({ model }: Readonly<{ model: RotaPlanModel }>) {
  const { twoJobs } = model.warnings;
  if (twoJobs.length === 0) return null;
  return (
    <section className="admin-rota-notice" role="status" data-testid="admin-rota-warnings">
      <h2>Figyelem</h2>
      <p>{ROTA_WARNING_TEXT.twoJobs} A közzétételt ez nem akadályozza.</p>
      <ul>
        {twoJobs.map((week) => (
          <li key={`${week.weekStart}:${week.familyId}`}>
            {formatWeekRange(week.weekStart)} – {week.familyDisplayName}
            {week.jobs ? ` (${week.jobs.map((job) => ROTA_JOB_LABELS[job]).join(", ")})` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One rota at a time: the tabs are links, so the page works without a script and keeps its address. */
function JobTabs({ selected, yearId }: Readonly<{ selected: RotaJob; yearId: string }>) {
  return (
    <nav className="admin-rota-tabs" aria-label="Beosztások" data-testid="admin-rota-tabs">
      {JOBS.map((job) => (
        <a
          key={job}
          className="admin-rota-tab"
          href={`/admin/beosztas?tanev=${yearId}&beosztas=${job}`}
          aria-current={job === selected ? "page" : undefined}
          data-testid={`admin-rota-tab-${job}`}
        >
          {ROTA_JOB_LABELS[job]}
        </a>
      ))}
    </nav>
  );
}

function WeekPlan({ model, job }: Readonly<{ model: RotaPlanModel; job: RotaJob }>) {
  const plan = model.plan!;
  const draft = plan.status === "draft";
  const weeks = model.weeks.filter((week) => week.job === job);
  return (
    <section className="admin-rota-panel" data-testid="admin-rota-weeks">
      <h2>{ROTA_JOB_LABELS[job]} – iskolai hetek beosztása</h2>
      {job === "weekend_animal_care" && (
        <p className="form-hint" data-testid="admin-rota-weekend-note">
          A hétvégi család viszi mind az öt hétvégi feladatot, amíg a hét belső takarító vagy
          előkerti családja nem választ belőlük.
        </p>
      )}
      <div className="admin-rota-table-wrapper">
        <table className="admin-rota-table">
          <thead>
            <tr>
              <th scope="col">Hét</th>
              <th scope="col">Felelős család</th>
              <th scope="col">{draft ? "Módosítás" : "Átadás"}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <WeekRow key={week.id} week={week} index={index} model={model} draft={draft} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WeekRow({
  week,
  index,
  model,
  draft,
}: Readonly<{ week: RotaPlanWeek; index: number; model: RotaPlanModel; draft: boolean }>) {
  const empty = !week.isBreak && !week.familyId;
  return (
    <tr
      className={week.isBreak ? "admin-rota-row-break" : empty ? "admin-rota-row-empty" : undefined}
      data-testid={`admin-rota-week-${week.weekStart}`}
    >
      <th scope="row">
        {index + 1}. hét
        <span className="form-hint">{formatWeekRange(week.weekStart)}</span>
      </th>
      <td>
        {week.isBreak ? (
          <StatusBadge label="Szünet" symbol={{ icon: "pause", character: "" }} />
        ) : week.familyDisplayName ? (
          week.familyDisplayName
        ) : (
          <StatusBadge
            label={
              week.emptyReason === "no_family"
                ? "Üres: nincs aktív család"
                : week.emptyReason === "cancelled"
                  ? "Üres: a család lemondta"
                  : "Üres: még nincs család"
            }
            symbol={{ icon: "warning", character: "" }}
          />
        )}
      </td>
      {!draft && (
        <td>
          {week.dutyId && week.placeVersion !== undefined ? (
            <details data-testid={`admin-rota-handover-${week.weekStart}`}>
              <summary>Átadás másik családnak</summary>
              <AdminMutationForm
                action={reassignDutyAction}
                submitLabel="Átadom"
                testId={`admin-rota-reassign-${week.weekStart}`}
              >
                <input type="hidden" name="id" value={week.dutyId} />
                <input type="hidden" name="expectedVersion" value={week.placeVersion} />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`reassign:${week.id}:v${week.placeVersion}`}
                />
                <label htmlFor={`handover-${week.id}`}>Család</label>
                <select
                  id={`handover-${week.id}`}
                  name="familyId"
                  defaultValue=""
                  data-testid={`admin-rota-handover-family-${week.weekStart}`}
                >
                  <option value="" disabled>
                    Válasszon családot
                  </option>
                  {model.families
                    .filter((family) => family.familyId !== week.familyId)
                    .map((family) => (
                      <option key={family.familyId} value={family.familyId}>
                        {family.displayName}
                      </option>
                    ))}
                </select>
                <p className="form-hint">A beosztás és a hétvégi választás követi a változást.</p>
              </AdminMutationForm>
            </details>
          ) : (
            "Nincs teendő"
          )}
        </td>
      )}
      {draft && (
        <td>
          {week.isBreak ? (
            "Nincs teendő"
          ) : (
            <AdminMutationForm
              action={setWeekAction}
              submitLabel="Mentés"
              testId={`admin-rota-set-${week.weekStart}`}
            >
              <input type="hidden" name="weekId" value={week.id} />
              <input type="hidden" name="expectedVersion" value={week.version} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`week:${week.id}:v${week.version}`}
              />
              <label className="visually-hidden" htmlFor={`family-${week.id}`}>
                Család: {formatWeekRange(week.weekStart)}
              </label>
              <select
                id={`family-${week.id}`}
                name="familyId"
                defaultValue={week.familyId ?? ""}
                data-testid={`admin-rota-family-${week.weekStart}`}
              >
                <option value="">Üres</option>
                {model.families.map((family) => (
                  <option key={family.familyId} value={family.familyId}>
                    {family.displayName} ({family.counts[week.job]} hét)
                  </option>
                ))}
              </select>
            </AdminMutationForm>
          )}
        </td>
      )}
    </tr>
  );
}

function FamilyCounts({ model, job }: Readonly<{ model: RotaPlanModel; job: RotaJob }>) {
  return (
    <section className="admin-rota-panel" data-testid="admin-rota-families">
      <h2>Hetek családonként</h2>
      <p className="form-hint">{ROTA_JOB_LABELS[job]}</p>
      {model.families.length === 0 ? (
        <p>Nincs aktív család.</p>
      ) : (
        <ul className="admin-rota-counts">
          {model.families.map((family) => (
            <li key={family.familyId} data-testid={`admin-rota-count-${family.familyId}`}>
              <span>{family.displayName}</span>
              <strong>{family.counts[job]} hét</strong>
              {family.aboveLowestJobs.includes(job) && (
                <StatusBadge
                  className="admin-rota-uneven"
                  label="Több hét a többinél"
                  symbol={{ icon: "warning", character: "" }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
