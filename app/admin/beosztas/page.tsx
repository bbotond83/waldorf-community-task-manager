import type { RotaPlanModel, RotaPlanWeek } from "../../../src/application/index.ts";
import { formatLongDay, formatWeekRange } from "../../../src/application/rota-format.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { resolveRotaFacade } from "../../_identity/rota-facade.ts";
import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { AdminMutationForm } from "../_components/AdminMutationForm.tsx";
import { YearSwitcher } from "../_components/RotaParts.tsx";
import { resolveAdminSession } from "../_lib/session.ts";
import {
  discardDraftAction,
  makeDraftAction,
  publishAction,
  setWeekAction,
} from "../rota-actions.ts";

export default async function RotaPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ tanev?: string }>;
}) {
  const [session, rota, { tanev }] = await Promise.all([
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
  return <PlanningScreen model={result.data} years={years} />;
}

function PlanningScreen({
  model,
  years,
}: Readonly<{ model: RotaPlanModel; years: readonly Readonly<{ id: string; name: string }>[] }>) {
  const { schoolYear: year, plan } = model;
  return (
    <section className="admin-page admin-rota-page" data-testid="admin-rota-page">
      <header>
        <p className="eyebrow">Adminisztráció{year ? ` · ${year.name}` : ""}</p>
        <h1 tabIndex={-1} autoFocus>
          Beosztás tervezése
        </h1>
        <p>
          Benti takarítás: egy család jut egy tanítási hétre. A szülők a tervezetet nem látják, csak
          a közzétett beosztást.
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
          <div className="admin-rota-grid admin-rota-grid-wide">
            <WeekPlan model={model} />
            <FamilyCounts model={model} />
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

function Blockers({ model }: Readonly<{ model: RotaPlanModel }>) {
  const { emptyWeeks, breakWeeks, ineligibleWeeks } = model.blockers;
  if (model.canPublish) return null;
  const groups: [string, string, readonly string[]][] = [
    ["empty", "Üres hetek: családot kell adni, mielőtt közzéteszi.", emptyWeeks],
    ["break", "Szünetes hétre család van beosztva: üresítse ki.", breakWeeks],
    ["ineligible", "A család már nem aktív: adjon másik családot.", ineligibleWeeks],
  ];
  return (
    <section className="admin-rota-warning" role="alert" data-testid="admin-rota-blockers">
      <h2>A beosztás még nem tehető közzé</h2>
      {groups
        .filter(([, , weeks]) => weeks.length > 0)
        .map(([key, text, weeks]) => (
          <div key={key} data-testid={`admin-rota-blockers-${key}`}>
            <p>{text}</p>
            <ul>
              {weeks.map((week) => (
                <li key={week}>{formatWeekRange(week)}</li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}

function WeekPlan({ model }: Readonly<{ model: RotaPlanModel }>) {
  const plan = model.plan!;
  const draft = plan.status === "draft";
  return (
    <section className="admin-rota-panel" data-testid="admin-rota-weeks">
      <h2>Iskolai hetek beosztása</h2>
      <div className="admin-rota-table-wrapper">
        <table className="admin-rota-table">
          <thead>
            <tr>
              <th scope="col">Hét</th>
              <th scope="col">Felelős család</th>
              {draft && <th scope="col">Módosítás</th>}
            </tr>
          </thead>
          <tbody>
            {model.weeks.map((week, index) => (
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
                : "Üres: még nincs család"
            }
            symbol={{ icon: "warning", character: "" }}
          />
        )}
      </td>
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
                    {family.displayName} ({family.weeks} hét)
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

function FamilyCounts({ model }: Readonly<{ model: RotaPlanModel }>) {
  return (
    <section className="admin-rota-panel" data-testid="admin-rota-families">
      <h2>Hetek családonként</h2>
      {model.families.length === 0 ? (
        <p>Nincs aktív család.</p>
      ) : (
        <ul className="admin-rota-counts">
          {model.families.map((family) => (
            <li key={family.familyId} data-testid={`admin-rota-count-${family.familyId}`}>
              <span>{family.displayName}</span>
              <strong>{family.weeks} hét</strong>
              {family.aboveLowest && (
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
