# U1 Security Design

## Basis and Boundary

This design satisfies [security-requirements.md](../nfr-requirements/security-requirements.md) and [tech-stack-decisions.md](../nfr-requirements/tech-stack-decisions.md) through the workflows in [functional-spec.md](../functional-design/functional-spec.md) and C1/C2/C5 of [contract-summary.md](../../../inception/contract-design/contract-summary.md). Access remains policy/grant owner; Runtime resolves current synthetic sessions; Application preserves explicit result contracts. U2/U3 consume these contracts, without creating a competing permission authority. The design is not execution evidence.

## SD1: Exhaustive Current Authorization

For NFR1.1/NFR1.2, use a single current-role validator and an explicit allowlist for role-specific scope shapes. All persistence/profile/session adapters validate untrusted values before constructing typed current actors. No default branch grants teacher access. Candidate grants are evaluated independently as complete role-and-scope permissions. Parent family membership uses Directory's established relations; matching group/organization values are mandatory for group authority. Unknown role values, malformed scopes, unrelated organizations and invalid required fields fail closed.

The domain evaluates action/resource/field permission through the current policy. Application matrix rows and runtime navigation/gates mirror it, rather than using the first recognized role as a broad authorization shortcut. Align versioned authorization rows and policy consumer tests. Teacher tracking reads remain limited to permitted group schedule and coordination display fields; raw family/table reads and every teacher mutation deny. Group admin retains only core granted-group operations; Super administrator organization grants authorize advanced/governance operations only in that organization. Do not weaken Parent field restrictions.

Intended persisted policy replacement inventories old helpers and every permissive policy. Restrict family/assignment reads and admin mutations to the appropriate supported roles and exact relationship checks; restrict import operations to organization Super administrator. Drop obsolete policies within the migration transaction before installing replacements. Keep the current-grant resolver self-subject restricted. Role grant writes and version changes remain privileged transaction operations, not ordinary client writes. Database-side scope helpers never substitute for allowlisted application field projection. Without an actual matching relationship/schema, deny and label unsupported parity; do not certify it from text inspection.

## SD2: Atomic Grant Changes and Conversion

For NFR1.3/NFR1.4, introduce the necessary transaction capability at the existing Access persistence seam. Conversion receives its explicit migration-only input and transaction port; ordinary assignment receives current roles only. The adapter transaction owns grant, subject/version and evidence state so an exception cannot leave a partial role or audit change. Fixture transactions snapshot and restore all relevant stores. Database migrations use one transaction and writer-exclusive locks in a consistent order before inspecting grants/versions. Hold locks through preflight, mapping, version invalidation, evidence append, role/scope constraint validation and policy replacement.

Preflight checks supported columns/types, valid scopes/roles, available version range and known authoritative issuer semantics before any write. Preserve every row identity, nonrole field, activity and historical evidence. Equivalent grants stay as records; effective grants deduplicate only valid unrevoked access. Increment once per changed subject; initialize a missing supported-baseline version to 2 only under the exact fail-closed issuer precondition in functional-spec. Unsupported preconditions and overflow abort without writes. Repeated conversion with no legacy rows adds no conversion/version change. An injected failure at each phase restores original state, including newly appended evidence and enforcement changes.

Normal revocation/downgrade uses the same locked read-validate-write pattern. Count distinct qualifying active subjects with surviving nonrevoked organization Super administrator grants after the proposed change. Preserve at least one qualifying administrator in that organization, including equivalent grants and concurrent mutations. Revoke/no-op behavior remains explicit; a successful effective grant change invalidates its subject version atomically.

## SD3: Restricted Redacted Evidence

For NFR1.5, use typed allowlisted audit writers at denial and change boundaries. Conversion evidence records stable operation/grant/subject identifiers, original/current role and safe outcome, never tokens/contact/allergen/financial or unrelated display fields. The evidence repository participates in the same transaction; absence of transactional support blocks conversion. Preserve old audit rows and existing retention behavior.

The current persisted audit shape cannot carry all conversion identity safely. Add dedicated conversion evidence with stable identity and access restricted to authorized governance operators within the appropriate organization, deriving that organization from each preserved grant. Ordinary users cannot insert/update/delete evidence directly. Migration writes use privileged transaction authority; privileged database bypass and actual RLS execution remain explicit evidence limitations. No synthetic names or arbitrary organization are supplied to fill absent source fields.

## SD4: Current Session Resolution and Safe Recovery

For NFR1.6/NFR3.2, preserve the existing signed cookie, nonce, eight-hour expiry, origin/mode checks and cookie security attributes. Only four current profile identifiers resolve. A removed cookie/profile or stale version is rejected before protected queries/rendering. No compatibility profile alias or silent token refresh. Fresh selection/sign-in binds current valid grants/version and rotates the cookie only at a writable session boundary; pure resolution performs no cookie mutation. Clear protected cache on invalidation and return existing no-data result/recovery. Unlinked production cannot fall back to synthetic authority.

Current profile forms/navigation retain accessible names, focus targets and announcements. U1 asserts result/presentation contracts; integrated keyboard and accessibility proof remains final Build and Test with U2 teacher screens. Preserve existing nonce CSP and output escaping when updating profile copy; no security header redesign or credential service is introduced.

## SD5: Delivery Controls and Maintainability

For NFR2.1/NFR2.2/NFR2.3/NFR3.1, preserve strict types, test-after per layer, constructor injection and explicit result mapping. Colocated policy/conversion/session tests check current roles, scope relationships, rollback, revoked/inactive/equivalent states and stale recovery. Preserve historical migrations and record history; add the new conversion migration alongside them. Technical teacher names are English and user labels Hungarian Óvónő.

Each completed Unit uses the authorized command npm run typecheck and npm test through its recorded combined checkpoint. Final integrated evidence covers the 80% line/branch/function floors, formatting/lint, build/start, critical browser/accessibility and dependency/security/secret scans. Private SBOM/build archive/metadata/checksums remain unsigned, with 14-day artifact retention and pinned actions. No signing service or deployment workflow is added. Preserve the local-only next-env.d.ts exclusion.

## Verification and Failure Ownership

| Design | Required evidence |
| --- | --- |
| SD1 | Role/scope/action/field parity cases, direct-denial unchanged state and unknown-role rejection |
| SD2 | Populated conversion identity/version comparisons, failure injection and writer/final-admin interleavings |
| SD3 | Redacted sentinel assertions, transaction rollback and evidence access checks where executable |
| SD4 | Current/removed/stale/tampered/expired/origin/mode session cases with no protected payload |
| SD5 | Current Unit checks and final integrated quality reports |

Failures return blocked/denied/invalidated or existing dependency states and contain no protected data. Do not automatically retry conversion or fall back to old permissions. Explicit reruns require repaired preconditions. Static artifact checks, runnable fixtures, actual database execution and real target verification remain distinct. No application implementation/tests/browser/database work occurred here. Library-kind standalone performance, scalability, reliability and observability designs are not applicable; transactional integrity and safe failure remain mandatory.
