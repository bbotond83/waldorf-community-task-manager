# Four-role Contract Summary

## Scope and Contract Register

These proposed contracts bind the approved shared application release. They preserve the component/entity ownership in [components.md](../domain-design/components.md), the U1–U3 boundaries in [unit-of-work.md](../units-generation/unit-of-work.md), the edges in [unit-of-work-dependency.md](../units-generation/unit-of-work-dependency.md), and the permissions/preservation requirements in [requirements.md](../requirements-analysis/requirements.md). The human selected fresh synthetic profile-selection/sign-in for removed profile IDs in [contract-design-questions.md](contract-design-questions.md). Development role name: Kindergarten teacher; Hungarian UI label: `Óvónő`.

| # | Provider Unit | Consumer | Mechanism | Owner |
| --- | --- | --- | --- | --- |
| C1 | U1 | U2 | Synchronous in-process current-role, authorization and session model | U1 / Access and Runtime |
| C2 | U1 | U3 | Shared role/policy model and explicit migration result contract | U1 / Access |
| C3 | U2 | U3 | Shared teacher source/projection/result and route contract | U2 / KindergartenTeacherTracking and Web |
| C4 | U2 | External: existing web browser | HTTP GET of teacher schedule/detail and old-URL redirects | U2 / Web |
| C5 | U1 | External: existing synthetic profile selector | Existing HTTP session form endpoint | U1 / Runtime |

C1–C3 cover all three direct Unit DAG edges. C4/C5 formalize existing browser boundaries; they introduce no partner API or independently deployed process. Contracts use version `four-role-v1` as a design/fixture marker, not a new URL prefix or network protocol. Unit IDs refer to their stable construction directories in unit-of-work.md. Existing unrelated parent/admin browser operations keep their current endpoint contracts while adopting C1/C2 policy.

## C1: Current Role, Authorization and Session Contract

The provider owns current-role semantics. The consumer requests a scoped decision through existing injected ports and must not authorize from a role label alone. Proposed shared TypeScript model:

```typescript
type CurrentRole = "parent" | "group_admin" | "kindergarten_teacher" | "super_admin";
type Scope = { id: string; type: "organization" | "group" | "family"; organizationId: string };
type CurrentActor = {
  subjectId: string;
  authorizationVersion: number;
  isActive: boolean;
  grants: readonly { id: string; role: CurrentRole; scope: Scope; revokedAt?: string }[];
};
type AuthorizationInput = {
  action: "read" | "create" | "update" | "delete" | "manage";
  resource: string;
  scope: Scope;
  fields: readonly string[];
};
type AuthorizationOutcome =
  | { state: "allowed" }
  | { state: "denied"; code: "AUTHORIZATION_DENIED" }
  | { state: "invalidated"; code: "REAUTHORIZATION_REQUIRED" };
type CurrentSessionOutcome =
  | { state: "ready"; actor: CurrentActor; profileId: string }
  | { state: "unauthenticated" }
  | { state: "invalidated"; recovery: "select-profile-or-sign-in" }
  | { state: "unavailable" };
```

These are shared boundary shapes to be adapted to existing result wrappers, not a claim that new exports already exist. Runtime must validate untrusted/persisted values exhaustively before constructing CurrentActor; unknown/removed role strings do not fit CurrentRole and are denied. Subject activity and current authorization version must be checked; revoked grants confer no access. Verify same organization plus the required scope relationship, never scope ID without organization. Family/group membership resolution uses existing Directory rules rather than assuming a parent family ID equals a group ID.

| Role | Allowed contract behavior | Required denial |
| --- | --- | --- |
| Parent | Existing own-family participation, requests, personal data and notifications, with current field restrictions | Other-family protected records and administrative advanced operations |
| Group admin | Existing core records/tasks/assignments/queues/archives within explicit granted groups | Other groups and organization-level imports/reminders/privacy/settings/governance |
| Kindergarten teacher | Read existing schedule/detail tracking within explicit granted groups, including permitted display names | All mutations; unrelated directory/private fields; ungranted groups and organization-wide fallback |
| Super administrator | Existing organization administration and governance within the granted organization | Other organizations and invalid/stale/revoked access |

Application policy rows, domain checks, runtime gates and intended SQL must evaluate this same case set. Scope-only SQL helpers cannot serve as universal role permission checks. Teacher projection is an allowlisted response; sensitive backing fields are never passed to Web. Teacher group choices are current-grant-derived. An item missing from the authorized result yields denial without confirming existence. Invalidated/denied results contain no protected data. No-group teacher access is denial, not a fabricated empty schedule.

**Session/profile naming:** Domain/persisted teacher role is `kindergarten_teacher`; synthetic teacher role is `kindergarten-teacher`, profile ID `kindergarten-teacher-local`. Other current synthetic IDs remain `parent-local`, `group-admin-local`, `super-admin-local`. Old `staff-local` and `kindergarten-admin-local` are absent from normal lookup/selection. Runtime maps only these explicit current syntactic vocabularies into domain roles. Four role categories do not limit populated user counts.

**Recovery:** A removed-profile cookie, mismatched version or revoked/inactive access produces invalidated/unauthenticated recovery before protected rendering. No old-profile alias or silent replacement session is created. Preserve existing signature, expiry, origin, HttpOnly, SameSite and secure-cookie behavior. Clear/replace cookies only at the existing writable session response/action boundary; a pure resolver rejects stale bytes even before they are cleared. Fresh selection/sign-in uses current grants/catalog; conversion itself never grants through a stale cookie. Production composition remains unavailable until legitimately linked; a local profile is not a production identity.

## C2: Conversion and Retained-workflow Policy Contract

U3 consumes C1 unchanged for existing workflow authorization. U1 additionally owns the explicit legacy conversion contract, used by populated fixtures and a migration artifact rather than an ordinary browser command.

```typescript
type SupportedLegacyRole = "read_only_staff" | "kindergarten_admin";
type ConversionMapping = {
  read_only_staff: "kindergarten_teacher";
  kindergarten_admin: "super_admin";
};
type ConversionResult =
  | {
      state: "converted";
      changedGrantIds: readonly string[];
      invalidatedSubjectIds: readonly string[];
      evidence: "redacted";
    }
  | { state: "unchanged"; changedGrantIds: readonly [] }
  | { state: "blocked"; code: "UNSUPPORTED_ROLE_OR_SCOPE" | "INCOMPATIBLE_SCHEMA" }
  | { state: "failed"; code: "TRANSACTION_FAILED" };
```

**Mapping and identity:** Update the role on the existing grant row; preserve grant ID, subject, scope type/ID, organization, grant timestamp where present, revoked timestamp and user active state. Staff conversion requires an existing explicit group scope; a legacy staff organization-only scope cannot become an organization-wide teacher grant and blocks for explicit remediation. Kindergarten-admin conversion requires the existing organization scope. Unsupported mappings/scope shapes are reported and block the transaction; they are not guessed, expanded, deleted or silently downgraded. Existing supported current grants are unchanged.

**Equivalent grants:** Preserve each existing grant's identity/history and revoked state. Do not create a second target grant for conversion. Equivalent rows can remain separate historical records; effective permissions/catalog grants are deduplicated by subject/current role/scope type/scope ID/organization. Revoked/inactive rows never activate another row. If an active current target grant already exists, its independently valid permission remains; conversion of a revoked legacy row does not add effective access. This contract imposes no destructive uniqueness rewrite of historical rows.

**Atomicity and repeatability:** Preflight supported schema/roles/scopes, lock relevant grant/version state within the applicable persistence transaction, transform role strings, increment the current authorization version once per affected subject, record redacted conversion evidence, validate resulting current-role rows, then install/validate the four-role constraint and matching RLS policy changes. All changes commit together or roll back together. A repeat run with no legacy rows returns unchanged, emits no second conversion/version increment and creates no grant. Prevent concurrent grant writers from introducing an obsolete row between preflight and constraint enforcement. Detailed SQL locking and supported-schema checks belong to U1 Functional Design.

The current SQL has `app_role_grants` and `app_authorization_versions`; it lacks full domain user-activity and display data. Do not invent persisted user activation or reset versions. Where a changed subject lacks a version row, establish a version that cannot match a stale accepted token, and document the exact initialization rule in U1 Functional Design. Migration evidence is redacted and preserves preconversion role identity without rewriting old audit entries. Unsupported rows remain intact on failure. Normal grant mutation still enforces final-super-administrator protection; no conversion failure may leave partially promoted access.

**SQL policy boundary:** Four-role text validation plus scoped policy must match C1. Existing family/assignment/import/audit tables do not by themselves implement a production teacher view or field projection. Imports and organization administration require organization-scoped super-admin; group core checks require valid group-admin scope or authorized super-admin organization. Parent own-family checks retain the existing relationship rules; teacher select rights are limited to approved tracking data, not broad raw-family access. A permissive old policy cannot remain alongside a restrictive replacement and accidentally broaden effective access. Static/local fixture policy results and actual database/RLS execution evidence must be labeled separately.

**U3 metadata:** Replace executable archive/import administrator-owner label `kindergarten-admin` with `super-admin` while retaining all supported sheet/archive destinations and process-owner categories. This metadata is not task responsible ownership; C2 must not rewrite actual task/assignment owners, business groups, family links or historical records. U3 uses converted fixtures from U1 rather than implementing another converter.

**Failures/retries:** No request-time conversion, automatic grant retry, best-effort partial promotion or rollback to a permissive role. A failed transaction changes nothing and exposes only safe error/evidence. Explicit rerun is allowed after remediation, preserving repeatability. No live database operation is authorized or claimed here.

## C3: Teacher Source, Projection and Result Contract

U2 owns this shared model; U3 consumes its names/fields/routes for executable fixtures and scenarios. The existing schedule repository/adapter is the source boundary. Coordination retains writable task/assignment ownership; Directory retains identity ownership. A source record must explicitly identify responsibility, assignment and status independent of coordination contact.

```typescript
type TrackingSourceRecord = {
  id: string;
  sourceRecordId: string;
  groupId: string;
  organizationId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  location: string;
  coordinationDisplayName?: string;
  ownerDisplayName: string | null;
  assigneeDisplayNames: readonly string[];
  currentStatusLabel: string | null;
};
type TrackingEntry = {
  id: string;
  groupId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  location: string;
  coordinationDisplayName?: string;
  ownerDisplayName: string | null;
  assigneeDisplayNames: readonly string[];
  currentStatusLabel: string | null;
};
type TrackingQuery = {
  groupScope: Scope;
  from: string;
  to: string;
};
type TrackingOutcome =
  | { state: "success"; entries: readonly TrackingEntry[] }
  | { state: "empty" }
  | { state: "validation-error" }
  | { state: "denied" }
  | { state: "invalidated" }
  | { state: "dependency-failure-retryable" }
  | { state: "dependency-failure-terminal" };
```

Facade detail success returns one TrackingEntry in the existing ApplicationResult envelope. Existing result codes, presentation codes, focus targets and announcement behavior remain mapped explicitly; no second competing response wrapper is exposed to pages. A successful empty collection is normalized to empty, while no grants/denied item remains denied. Retryable failure offers the existing user-initiated retry with safe filters and fresh grants/data. Terminal failure offers existing later-retry guidance. No automatic retry loop or synthetic successful fallback is introduced. Existing adapter classification maps unexpected errors to terminal failure. Shared in-process calls introduce no network timeout; future remote adapter deadlines stay outside this intent, and current explicit error handling must remain.

**Authoritative source mapping:** For the currently runnable synthetic mode, extend the existing schedule backing fixture records with explicit owner, assignee and current-status values and `sourceRecordId` identifying that existing record. Preserve the existing schedule/group identities and dates. These are declared synthetic values, not inferred real identities. The injected repository reads those current backing fields on each query; projection never caches old statuses as permanent presentation literals. Unit tests must modify a backing record through the repository/test fixture seam and demonstrate subsequent reads reflect it. The existing admin fixture IDs/groups differ from the staff schedule fixture IDs/groups; no guessed join or reassignment of business scope is permitted.

For a repository backed by the existing task/assignment models, the adapter must supply explicit sourceRecordId, same organization/group scope, actual responsible-owner display data, current assignment display data and the existing source status translated to a label. Do not derive owner from coordinator, array position, title matching or unrelated family data. No production adapter/linkage is implemented by this contract; production remains unavailable. Functional Design must identify each actual current source field/fixture and the injection seam, constrained by this model. A missing authoritative value is explicit null/empty-list; it is not an invented owner/status. Unknown/unavailable status displays `Nincs elérhető állapot`; missing owner `Nincs kijelölt felelős`; empty assignment `Nincs beosztott`. Status is an existing state label, not a new state enum.

**Privacy and validation:** Resolve current teacher/grants first, validate groupScope organization/group membership and existing dates, then query and project. Every source row must match the authorized organization/group; mismatch yields denied without returning that row. `sourceRecordId`, organization metadata and private source fields are not browser payload fields. Projection copies only TrackingEntry keys. Use existing `YYYY-MM-DD` filter behavior, maximum 31-day validation, and Hungarian/Budapest presentation. Preserve current date boundary semantics consistently between adapter and domain; exact parser behavior is pinned in Functional Design against existing validation tests. Entry IDs are opaque values, encoded as a single route segment; they cannot supply a URL or widen scope. Detail lookup uses the same authorized query/allowlist and denies absent/ungranted items without existence disclosure.

Both responsive layouts and detail use the same projected model; owner/assignee/status are not omitted on mobile. Keep location and coordination separately. The teacher has no create/edit/delete/assign/approve command in this contract. Crafted requests for other commands still invoke C1 denial independently of UI controls. U3's executable scenarios reference current teacher names/results, while explicit removed-role denial/migration data may retain legacy strings.

## C4: Browser Schedule and Compatibility HTTP Contract

The English internal route namespace is `/teacher/schedule`; UI text remains Hungarian. This OpenAPI block describes browser-rendered HTML and redirects, not a new JSON endpoint. Shared response definitions bind existing presentation wrappers above.

```yaml
openapi: 3.1.0
info:
  title: Kindergarten teacher browser schedule
  version: four-role-v1
components:
  securitySchemes:
    syntheticSession:
      type: apiKey
      in: cookie
      name: waldorf_local_session
  parameters:
    groupId:
      name: groupId
      in: query
      schema: {type: string}
    from:
      name: from
      in: query
      schema: {type: string, format: date}
    to:
      name: to
      in: query
      schema: {type: string, format: date}
    id:
      name: id
      in: path
      required: true
      schema: {type: string}
  responses:
    page:
      description: Existing localized authorized page or explicit safe state panel; no protected data on failure
      content:
        text/html:
          schema: {type: string}
    recovery:
      description: Redirect to existing safe profile-selection or sign-in recovery
      headers:
        Location:
          schema: {type: string}
    moved:
      description: Temporary same-origin redirect to teacher equivalent using validated filter context
      headers:
        Location:
          schema: {type: string}
paths:
  /teacher/schedule:
    get:
      security: [{syntheticSession: []}]
      parameters:
        - {$ref: '#/components/parameters/groupId'}
        - {$ref: '#/components/parameters/from'}
        - {$ref: '#/components/parameters/to'}
      responses:
        '200': {$ref: '#/components/responses/page'}
        '307': {$ref: '#/components/responses/recovery'}
  /teacher/schedule/{id}:
    get:
      security: [{syntheticSession: []}]
      parameters:
        - {$ref: '#/components/parameters/id'}
        - {$ref: '#/components/parameters/groupId'}
        - {$ref: '#/components/parameters/from'}
        - {$ref: '#/components/parameters/to'}
      responses:
        '200': {$ref: '#/components/responses/page'}
        '307': {$ref: '#/components/responses/recovery'}
  /munkatars/beosztas:
    get:
      parameters:
        - {$ref: '#/components/parameters/groupId'}
        - {$ref: '#/components/parameters/from'}
        - {$ref: '#/components/parameters/to'}
      responses:
        '307': {$ref: '#/components/responses/moved'}
  /munkatars/beosztas/{id}:
    get:
      parameters:
        - {$ref: '#/components/parameters/id'}
        - {$ref: '#/components/parameters/groupId'}
        - {$ref: '#/components/parameters/from'}
        - {$ref: '#/components/parameters/to'}
      responses:
        '307': {$ref: '#/components/responses/moved'}
```

Compatibility handlers return no schedule data and create no session. Build Location from fixed same-origin teacher paths; encode detail ID and whitelist `groupId`, `from`, `to`. Reject/omit malformed values and all unknown query fields; never reflect `returnTo` or an arbitrary host/path. Syntactic preservation does not authorize a group: destination performs the full C1/C3 check. Well-formed but ungranted groups retain safe denial. Missing/invalid filters use destination's existing valid defaults or validation panel consistently; no unauthorized fallback group is chosen. Existing teacher filter defaults are derived only from current assigned groups.

HTML denial/error panels retain current page-state conventions; a 200 HTML response is not an allowed authorization decision. The structured facade result remains denied/invalidated, with no protected rows in markup. Session recovery redirects before protected rendering. GET-only compatibility does not preserve any old mutation API. Browser back/details preserve validated filter context. New teacher pages are read-only, keyboard operable and use the existing 44rem table/card switch and focused-state semantics. HTTP values are proposed contracts to verify against installed Next.js documentation before implementation; no framework code has been written here.

## C5: Existing Synthetic Session Form Contract

```yaml
openapi: 3.1.0
info:
  title: Current synthetic profile session form
  version: four-role-v1
paths:
  /api/synthetic/session:
    post:
      description: Existing synthetic-only same-origin profile selection or clear-session action
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              required: [profileId]
              properties:
                profileId:
                  type: string
                  enum: ['', parent-local, group-admin-local, kindergarten-teacher-local, super-admin-local]
      responses:
        '303':
          description: Existing redirect to root after rotating a valid current-profile cookie or clearing the session
          headers:
            Location: {schema: {type: string}}
            Set-Cookie: {schema: {type: string}}
        '400': {description: Invalid or removed profile identifier; no new session}
        '403': {description: Origin rejected; no new session}
        '503': {description: Synthetic mode unavailable; no local session fallback}
```

Retain existing origin/mode checks and empty-profile clear behavior; validate profile against current catalog before rotation. The form schema is a current identifier allowlist, not authorization to sign into a populated production account as an arbitrary role. Selection binds current profile/grant/version; it does not reactivate revoked grants. `staff-local`, `kindergarten-admin-local` and unknown values fail normal selection. No profile compatibility alias is supplied after the user's selected fresh-session recovery.

## Contract Ownership, Evolution and Verification

- U1 owns C1/C2/C5; U2 owns C3/C4; U3 owns only its consumer adaptations, fixtures and remaining workflow contracts. Preserve existing ports/injection rather than creating new services.
- Breaking role/profile/source/route changes require provider and consumer updates in the same integrated release and updated executable manifest references. Keep legacy URL redirects and explicit migration/denial fixtures only for their documented purpose. Do not retain an independently authorizing old role.
- Additive source metadata is allowed behind the adapter, but browser projection remains an explicit allowlist. Consumers may ignore unknown non-sensitive versioned metadata; protected response serializers must never spread an untrusted source record. Removing/renaming required tracking fields is a breaking change.
- Pure queries may be retried explicitly after fresh authorization. Grant conversion is only retried as an explicit repeat-safe migration. Existing commands retain their current idempotency/result contracts. No new SLA, timeout budget, availability target or retry daemon is invented.
- Provider tests cover each shared shape/outcome; consumer tests cover field allowlists, mismatch/denial, stale recovery and route/query behavior. Permission parity uses the same role/scope/action/field cases across domain/application/intended SQL. Populated conversion tests include inactive/revoked/duplicate/repeat/unsupported-scope cases. U3 includes converted-user workflow and manifest integrity scenarios; final broad quality evidence remains Build and Test.
- Static schema/source checks, synthetic tests, actual local database execution and real target RLS verification are distinct evidence categories. Production remains unlinked, so no real migration or RLS parity is certified by these contracts. Current private CI evidence stays explicitly unsigned.

## Sources and Implementation Handoff

The approved unit-of-work, unit-of-work-dependency, components and requirements listed above govern this document. Bounded source reads confirmed `src/staff-web/synthetic-staff.ts` holds schedule fixtures without owner/assignment/status; `src/application/staff-facade.ts` projects fields and maps missing detail to denial; `src/runtime/session/session.ts` resolves signed profile/version cookies; and `supabase/migrations/20260806_access_rls.sql` has unconstrained roles and separate scope/RLS helpers. Existing-source filenames are evidence, not prescribed future English identifiers.

Functional Design must pin the exact conversion transaction/locking/schema checks and missing-version initialization; source field/fixture injection mapping and date parser behavior; and wrapper/presentation mappings to current implementation. It may not change the four-role permissions, fresh-session recovery, grant-preservation semantics, source privacy boundary or fixed redirect namespace without human-directed revision. Read installed Next.js docs before framework code. Preserve local-only next-env.d.ts and historical audit/evidence. No application tests, builds, browser sessions or migrations were performed in this stage.

## Open Questions

| Contract | Question | Blocks |
| --- | --- | --- |
| — | None. Required Functional Design implementation details are identified above; no contract choice remains unanswered. | — |

## Assumptions & Open Questions

None for contract behavior. These are proposed formal boundaries, not implemented exports/endpoints or production verification evidence.
