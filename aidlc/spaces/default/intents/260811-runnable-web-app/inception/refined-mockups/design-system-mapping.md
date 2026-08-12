# Design System Mapping

## Source Alignment

This mapping preserves the approved `260729-feature` design system and maps the current [wireframes](../../ideation/rough-mockups/wireframes.md), [user flow](../../ideation/rough-mockups/user-flow.md), [stories](../user-stories/stories.md), [requirements](../requirements-analysis/requirements.md), and [team practices](../practices-discovery/team-practices.md) to reusable local application components.

## Foundations

- Locale: Hungarian user-facing copy (`hu-HU`); technical identifiers remain English.
- Time: `Europe/Budapest` display with unambiguous date, time, and timezone context.
- Typography: one readable sans-serif stack; 16px minimum body baseline; line length capped for long explanations.
- Spacing: 4, 8, 16, 24, 32, 48px scale.
- Shape: restrained radius and border treatment; state meaning never relies on decoration alone.
- Focus: minimum 2px visible indicator with at least 3:1 adjacent contrast.
- Targets: minimum 44×44 CSS pixels with at least 8px separation on touch layouts.
- Color: at least 4.5:1 normal text, 3:1 large text and UI components; icon plus text label for every status.

## Semantic Tokens

| Token family | Use | Required companion |
|---|---|---|
| `surface.*` | page, panel, elevated detail | border or spacing hierarchy |
| `text.*` | primary, secondary, inverse | contrast verification |
| `action.*` | primary, secondary, destructive | visible label and focus state |
| `status.info` | loading/pending | text such as `Folyamatban` |
| `status.success` | completed | `Sikeres` text/icon |
| `status.warning` | invalidated/conflict | explanation and recovery action |
| `status.danger` | validation/failure/denial | specific Hungarian message, not color alone |

## Component Mapping

| UX need | Component | Notes |
|---|---|---|
| Shared frame | `AppShell`, `SkipLink`, `RoleNavigation`, `PageHeader`, `StatusRegion` | destinations come from authorization result |
| Local entry | `LocalIdentitySelector`, `InvitationAuthEntry`, `ProfileSummary`, `SessionStatePanel` | selector is development-only; invitation/auth preserves inherited flow |
| Collections | `FilterBar`, `ResultSummary`, `DataTable`, `DataCardList`, `Pagination` | identical permitted fields across variants |
| Duty/task display | `DutyCard`, `CapacityIndicator`, `EligibilityMessage`, `RequestStatus` | Hungarian state labels |
| Forms | `FormField`, `Fieldset`, `ErrorSummary`, `ActionBar` | visible labels; blur + submit validation |
| Async outcomes | `AsyncStatePanel`, `InlineOutcome`, `RetryAction` | consumes explicit result states only |
| Complex workflow | `DetailPage`, `ReviewSummary`, `ConfirmationDialog` | no nested dialogs |
| Import | `StepIndicator`, `UploadField`, `MappingTable`, `ConflictQueue`, `ImmutablePreview`, `RecoveryPanel` | seven-step sequence |
| Privacy/access | `GrantMatrixEditor`, `LifecycleTimeline`, `RedactedAuditSummary` | available only where matrix permits |

## Role and Privacy Mapping

Component props receive an authorized view model rather than raw persistence records. Prohibited navigation, actions, rows, and fields are absent at the application boundary. Staff view models permit schedule and required coordination display names only. Contact data, residence/locality, optional profile fields, protected reasons, unrelated-family data, and audit detail require explicit FR-LR-14 field grants. Synthetic fixtures use invented names and never production-derived values.

## Responsive Mapping

CSS is mobile-first. Under 768px, collections use cards and navigation is disclosed. From 768px, summary/filter grids may use two columns. From 1024px, side navigation and accessible tables are available. From 1440px, a max-width container limits line length. Components preserve semantic order; visual reordering must not diverge from DOM/focus order.

## State Mapping

Every data-bearing page composes `PageHeader` with exactly one of populated content, `AsyncStatePanel`, or a pending mutation overlay local to the initiating region. Empty, denied, invalidated, error, and recovery variants use stable headings and permitted actions. Success generally stays inline to preserve context; destructive and access-changing success may route to a read-only result page.

## Implementation Constraints

- Use semantic HTML before ARIA and expose all functionality by keyboard.
- Local-mode styling must not suggest synthetic authorization is weaker than production authorization.
- Components map expected failures to explicit discriminated states; they do not branch on exception strings.
- Prettier and ESLint remain blocking; user copy is Hungarian; component/module identifiers are English.
- No deployment control or production action appears in the local application UI.
