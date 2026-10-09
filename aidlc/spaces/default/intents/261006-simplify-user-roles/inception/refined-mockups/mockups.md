# Four-Role Refined Mockups

## Design Basis and Naming

Reuse the existing visual layout and style, as selected in [refined-mockups-questions.md](refined-mockups-questions.md). Development prose and persona names use **Parent**, **Group admin**, **Kindergarten teacher**, and **Super administrator**. The Kindergarten teacher's Hungarian UI label is `Óvónő`; Hungarian text below is explicitly UI copy, not a development role identifier.

Inputs: [stories.md](../user-stories/stories.md), [requirements.md](../requirements-analysis/requirements.md), and [team-practices.md](../practices-discovery/team-practices.md). The classic scope omitted rough mockups: `wireframes` and `user-flow` inputs are absent. These designs are derived directly from approved behavior, without inventing prior sketches.

Bounded existing UI inspection found role/profile cards, a schedule table on wider screens, schedule cards at 44rem and below, native date/group filters, definition-list details and explicit state panels. Owner/assignment/status tracking fields are approved additions; their full projection is not claimed to exist already. This is a design artifact, not an implemented screen or accessibility test result.

## Screen M1: Current Role Selection

**Stories:** US1.1. **Role:** existing synthetic profile selector; authorized role assignment uses the same current-role vocabulary wherever that existing surface is present. Do not create a new assignment interface merely for these mockups.

Desktop structure, English annotations:

```text
+--------------------------------------------------------------------+
| Existing local-profile heading and explanatory text                 |
|                                                                    |
| +-----------------------------+ +-------------------------------+   |
| | Parent                      | | Group admin                   |   |
| | Existing own-family summary | | Existing granted-group summary|   |
| | [Use profile]               | | [Use profile]                 |   |
| +-----------------------------+ +-------------------------------+   |
| +-----------------------------+ +-------------------------------+   |
| | Kindergarten teacher        | | Super administrator           |   |
| | Assigned groups, read-only   | | Organization administration   |   |
| | [Use profile]               | | [Use profile]                 |   |
| +-----------------------------+ +-------------------------------+   |
+--------------------------------------------------------------------+
```

Text fallback: Existing heading followed by four profile cards. Each card has a role title, authorized scope summary and existing profile-selection button. Preserve the current fluid grid; cards stack when space requires. No separate staff or kindergarten-administrator category appears. Four role categories do not impose a four-user limit on a populated account system.

Hungarian UI copy: retain existing translated Parent, Group admin and Super administrator labels; change the staff label to `Óvónő`; retain `Profil használata`. Describe teacher scope as `Hozzárendelt csoportok · csak olvasás`. Existing local-only synthetic-environment copy remains because it explains which data the user is using.

Invalid/removed profile selection uses existing failure/recovery handling and creates no session. No obsolete profile alias may authorize an independent fifth role. Exact identifier/route compatibility is downstream contract work.

## Screen M2: Kindergarten Teacher Schedule — Wider Layout

**Stories:** US2.1, US2.2, US3.1, US3.3. The existing shell remains; role summary identifies the Kindergarten teacher. The schedule has explicit read-only context and only authorized group choices.

```text
+--------------------------------------------------------------------+
| Existing app header                  Kindergarten teacher           |
| Assigned groups, read-only             [Existing sign-out action]   |
| Existing authorized navigation                                     |
+--------------------------------------------------------------------+
| Schedule                                                           |
| Read-only task/event tracking                                       |
| Group [Assigned group] From [date] To [date] [Filter] [Clear filters] |
+--------------------------------------------------------------------+
| Date/time | Activity | Group | Owner | Assignees | Status | Details  |
|-----------+----------+-------+-------+-----------+--------+----------|
| Date/time | Title    | A     | Name  | Names     | Label  | [Open]   |
+--------------------------------------------------------------------+
```

Text fallback: Preserve the schedule filter above a semantic table. The row includes date/time, activity, authorized group, responsible owner, assignees, current status and a read-only details link. Existing location/coverage and coordination information remains available in detail; add tracking fields without removing supported information. The table may scroll horizontally inside its existing wrapper on intermediate widths.

Hungarian UI copy: `Beosztás`, `Csak olvasás`, `Csoport`, `Kezdő dátum`, `Záró dátum`, `Szűrés`, `Szűrők törlése`, `Dátum és idő`, `Tevékenység`, `Engedélyezett csoport`, `Felelős`, `Beosztottak`, `Állapot`, `Részletek`. Use `Engedélyezett óvónői beosztás` for the table caption. Existing date/time formatting remains Hungarian and uses the current Budapest time-zone convention.

The owner is not assumed to equal the coordination contact or an assignee. Domain Design must identify the authoritative owner/assignment/status fields. Status text reflects an existing task/event state; this design creates no new state machine, counters or progress percentages. No edit/create/delete/assign/approve controls appear.

## Screen M3: Kindergarten Teacher Schedule — Narrow Layout

At **44rem and below**, retain the existing table-to-card switch and stack native filters. Use the same projected record and tracking fields, not a weaker mobile permission/filter path.

```text
+-------------------------------+
| Schedule                      |
| Kindergarten teacher          |
| Assigned groups, read-only     |
| Group [Assigned group]         |
| From [date]                    |
| To [date]                      |
| [Filter]  [Clear filters]      |
+-------------------------------+
| Activity title                |
| Date/time: value              |
| Group: assigned group         |
| Owner: display name           |
| Assignees: display names      |
| Status: existing state label  |
| [Details]                     |
+-------------------------------+
```

Text fallback: Cards show activity title and labeled tracking values in a vertical list, followed by the details link. Long titles/names wrap. Owner/assignee/status are not hidden solely to fit mobile width. The inactive table/card representation is excluded from the accessibility tree and keyboard order through existing display switching.

## Screen M4: Kindergarten Teacher Schedule Detail

**Stories:** US2.1, US2.2. Keep the existing read-only detail pattern and preserve filter context on return.

```text
+--------------------------------------------------------------+
| [Back to schedule]                                           |
| Schedule details, read-only                                  |
| Activity title                                               |
| Date/time           value                                    |
| Authorized group    value                                    |
| Responsible owner   display name or explicit absence         |
| Assignees           display names or explicit absence        |
| Current status      existing state label                     |
| Location/coverage   existing permitted value                  |
| Coordination        existing permitted value                 |
+--------------------------------------------------------------+
```

Text fallback: Existing back link, heading and labeled definition-list fields. Preserve existing location/coordination information separately from responsible owner and assignees. No private-contact, financial, allergen or unrelated family fields are projected. No action toolbar is added.

Hungarian UI copy: retain `Vissza a beosztáshoz`, `Beosztás részletei · csak olvasás`, and existing field labels. Missing owner: `Nincs kijelölt felelős`; no assignments: `Nincs beosztott`. A genuinely unavailable status is `Nincs elérhető állapot`, never a fabricated task state. Existing `Nem szükséges` coordination text is retained only when it actually means coordination is unnecessary.

## Screen M5: Empty, Denied, Invalid and Recovery States

**Stories:** US2.1, US2.2, US3.3. Use the current inline state-panel hierarchy, with a focusable heading for errors/access failures. A state panel replaces protected content; it does not append hidden denied rows to the DOM.

| State | Hungarian UI copy | Available action and information boundary |
| --- | --- | --- |
| Loading | Existing localized loading state | Keep authorized shell/filter context; do not retain stale private records or add optimistic mutation controls. |
| Authorized empty result | `Nincs találat` / existing explanation that filters have no displayable schedule | `Szűrők törlése`; no create-task action. This state requires successful authorization. |
| No assigned-group access or denied item/group | `Nincs jogosultság` / `A kért tartalom nem érhető el.` | Existing safe navigation/session recovery only; disclose no unauthorized group names, counts, owners or item existence. |
| Invalid filter | `Érvénytelen szűrés` / existing valid date-range guidance | Correct filters and resubmit. Preserve the existing maximum 31-day range. |
| Retryable dependency failure | `Hiba történt` / existing temporary-failure explanation | `Újrapróbálás`; preserve safe authorized filters and refetch current grants/data. |
| Terminal dependency failure | Existing later-retry guidance | No invented successful data or unavailable edit action. |
| Stale/invalidated session requiring sign-in | Existing session-expiry/sign-in recovery | Sign in again; protected content is not displayed from stale role information. Refresh through current grants is also allowed by approved requirements. |
| Partial permitted item | Missing owner/assignee/status messages above; long names wrap | Continue read-only tracking; do not fetch private fallback fields. |

## Existing Parent and Administrator Screens

**Stories:** US3.2, US4.1, US4.2. Preserve existing Parent and Group admin screens and core flows. Existing Super administrator screens retain imports, reminders, privacy operations, settings and governance; migrated active kindergarten administrators see these current-role controls within their organization after grant/session resolution. Removed-role labels/options disappear from current assignment/settings/profile surfaces where those surfaces exist.

There is no new migration wizard or promotion-confirmation screen: grant conversion is an explicit migration artifact, and the user already selected its behavior. Business group lists, task owners and import sheet/archive coverage remain intact. Historical records remain historically accurate. A group admin or teacher who directly requests an advanced operation receives the existing denied state, regardless of navigation hiding.

## Responsive, Accessibility and Completion Boundaries

Use current CSS tokens and the existing 44rem breakpoint; see [design-system-mapping.md](design-system-mapping.md). Native filters have labels, keyboard access, visible focus and current 44px interaction targets. Table headers/caption and definition-list/card labels identify tracking values. State and status meaning is conveyed in text, not color alone. Detail/back navigation retains existing focus behavior and filter context. [interaction-spec.md](interaction-spec.md) and [accessibility-checklist.md](accessibility-checklist.md) define implementation and verification targets.

Product perspective: each screen maps to approved story outcomes; backend-only migration and cleanup are represented through resulting current-role screens rather than new UI workflows. All eight stories are covered above. No live migration, browser test, measured contrast or compliance certification is claimed. Implementation must supply projected fields and deny unauthorized data/actions independently of these visual controls.

## Assumptions & Open Questions

None. The approved existing-layout approach determines this visual treatment. English development names and Hungarian UI labels follow the user's naming clarification and existing localization practice. Route/identifier compatibility and authoritative projection mapping are design work, not additional user-facing requirements.
