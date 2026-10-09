# U1 Security and Quality Requirements

## Scope and Sources

This Unit refines [requirements.md](../../../inception/requirements-analysis/requirements.md) NFR1–3 using [functional-spec.md](../functional-design/functional-spec.md), [rules.md](../functional-design/rules.md), C1/C2/C5 in [contract-summary.md](../../../inception/contract-design/contract-summary.md) and the shared [technology-stack.md](../../../../../codekb/waldorf-community-task-manager/technology-stack.md). The existing application and embedded Access/Runtime boundaries remain. These are required outcomes, not executed results or a certification of a real environment.

## Detailed Requirements and Acceptance Measures

| ID | Required outcome and target | Verification method and evidence scope |
| --- | --- | --- |
| NFR1.1 | Every protected boundary rejects unknown/removed role values, unsupported role scopes, inactive/revoked subjects, stale/missing versions and cross-organization authority; zero unauthorized successful cases in the defined matrix. No default-role fallback. | Domain/application/runtime negative and positive matrix cases, including mixed grants that cannot combine role and scope. SQL checks labeled static until executed on a database. |
| NFR1.2 | Kindergarten teacher mutations and raw private-family reads are denied in every defined case; Parent own-family and Group admin core scope restrictions remain; advanced/governance cases require organization Super administrator. Denials produce zero business state changes and no protected response fields. | Before/after repository snapshots, spies proving commands not called, field assertions and integrated consumer cases. U2 owns teacher projection/UI, U3 owns retained workflow integration. |
| NFR1.3 | Each supported conversion preserves every nonrole grant field, user activity and all business identifiers/relationships/owners. An affected subject version changes exactly once per conversion; repeat run changes it zero times. Equivalent grants never create duplicate effective authority or reactivate revoked rows. | Populated active/inactive/revoked/equivalent/repeat fixtures, whole-record comparison and version assertions. Missing-version baseline rule and unsupported issuer precondition from functional-spec must be exercised. |
| NFR1.4 | Preflight, conversion, version, audit and enforcement changes have one commit boundary. Injected failure at each stage leaves zero partial changes; concurrent writers cannot insert a removed role between preflight and constraint validation. Final qualifying organization administrator cannot be removed, including concurrent operations. | Transaction rollback tests, deterministic interleaving/concurrent persistence tests where supported, poststate comparisons. Actual database concurrency/RLS proof remains outstanding until executed with local tools; no fixture claims as real target evidence. |
| NFR1.5 | Authorization/conversion evidence excludes credentials, tokens, contact, financial, allergen and unrelated family/display data. Existing historical evidence is append-only; conversion retains original/current role identity in restricted transaction-bound evidence. | Structured audit allowlist and sensitive sentinel assertions, no history rewrite comparison; database evidence access checked only when executable. Existing retention policy stays unchanged. |
| NFR1.6 | Removed synthetic profile cookies require fresh valid selection/sign-in. Retain signature validation, eight-hour expiry, nonce rotation, origin/mode checks, HttpOnly/SameSite and secure-cookie behavior. Production remains unavailable without local fallback. | Session/form unit and boundary cases; stale profile/version, tampered signature, expired cookie, rejected origin/mode and inactive grant cases. No old-profile aliases. |
| NFR2.1 | Strict type checking and all applicable Unit tests pass; no failing existing regressions. Implement each applicable testable layer, then write/run its tests before the next layer. | Current local command output under the approved test-after posture. Unit checkpoint: npm run typecheck and npm test, through the already authorized combined command. |
| NFR2.2 | Integrated delivery meets at least 80% production line, branch and function coverage; blocking formatting/lint, production build, deterministic start smoke and critical browser flow remain green, with zero serious/critical automated accessibility findings. | Final Build and Test current execution reports across all Units; not claimed from this Unit's artifact or checkpoint. |
| NFR2.3 | High/critical dependency and SAST findings block delivery; existing secret scanning and immutable action pins remain. Private SBOM/archive/unsigned metadata/checksums remain explicitly unsigned with the existing 14-day artifact retention. | Final current scan/CI evidence, no waiver or signed-attestation claim. No signing/deployment service added. |
| NFR3.1 | Current technical identifiers use Kindergarten teacher consistently; current Hungarian role copy is Óvónő. No fifth selectable/authorizing role outside explicit migration/regression/history handling. Preserve ports, constructor injection and explicit result boundaries. | Exhaustive types/validation and catalog tests; remaining executable reference/copy inventory belongs to U3. |
| NFR3.2 | Current selector/navigation/session failure behavior remains keyboard operable with existing names/focus/announcements; no protected cached content on invalidation. | Unit presentation contract assertions plus final critical-flow keyboard/accessibility execution. U2 supplies teacher screen-specific checks. |

All targets apply before delivery. Unavailable tooling is reported as outstanding evidence, never a pass. No numerical latency or availability commitment is created by this role change.

## Threat and Data Boundaries

| Threat | Required control | Requirement |
| --- | --- | --- |
| Forged/stale local session or removed profile | Current signature/profile/version resolution before data query | NFR1.1, NFR1.6 |
| Crafted teacher/admin command or mismatched grant scope | Exhaustive current policy and same-grant role/scope evaluation | NFR1.1, NFR1.2 |
| Revoked grant collision or partial promotion | Non-destructive effective deduplication and atomic conversion | NFR1.3, NFR1.4 |
| Concurrent final-administrator loss | Qualifying subject count and locked mutation | NFR1.4 |
| Sensitive error/audit disclosure | Explicit no-data failures and restricted evidence allowlist | NFR1.5 |
| Old permissive policy surviving replacement | Inventory and replace policy set in the conversion transaction | NFR1.1, NFR1.4 |

Signed synthetic cookies are local test identities, not production credentials. Grant identifiers, subject identifiers, scopes and evidence are restricted operational data. Tracking display names are scoped only and cannot authorize access to contact or other private fields. Existing domain privacy handling is preserved; no new regulatory framework, retention period or compliance certification is asserted by this Unit.

## Applicability and Evidence Status

U1 has no independently deployed service and no added external request boundary. Standalone performance, scalability, availability and monitoring targets are not applicable; transaction and failure integrity remain mandatory under NFR1. Production/database linkage and remote issuer semantics remain unsupported until explicitly exercised against a valid target. All execution measurements are pending. Preserve local-only next-env.d.ts and frozen historical evidence.
