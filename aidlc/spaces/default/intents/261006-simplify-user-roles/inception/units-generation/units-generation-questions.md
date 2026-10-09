# Units Generation Questions

## Established Constraints

The approved [components.md](../domain-design/components.md) and [decisions.md](../domain-design/decisions.md) preserve existing logical ownership. The four roles, teacher scope/read-only fields, grant conversion, safe bookmark redirects and record preservation are settled by [requirements.md](../requirements-analysis/requirements.md), [stories.md](../user-stories/stories.md) and prior questions. Development role naming remains English: Kindergarten teacher.

Retain the existing application deployment as a shared release; no independently deployed service, new backend, live migration or signing infrastructure is proposed. Work units are implementation boundaries within that application, not replacements for domain component ownership. Current classic scope has walking-skeleton ceremony off. Dependencies describe prerequisites only; Delivery Planning chooses delivery sequencing and ownership. Parallel execution and Construction autonomy remain separate later choices.

## Q1: Work Unit Granularity

The role model is shared by sessions, teacher screens and existing workflows. Which implementation grouping would you prefer?

A. Three bounded units (recommended): current-role policy/grant/session foundation; teacher tracking and bookmark compatibility; retained parent/admin workflows and final executable-role cleanup. The latter two depend on the foundation, and final cleanup depends on the teacher rename. Test each unit through its contracts, then release the integrated change together.
B. One combined unit for the complete role change. Fewer handoffs, but a larger implementation and review slice covering all eight stories.
X. Other (please specify)

[Answer]: A. Three bounded units. Verbatim chat response: "it does fit" to the proposed three-unit split, released together.

## Proposed Kinds and Boundary Notes

- Current-role foundation: `library`, embedded policy/conversion/session code plus SQL migration artifact and its tests; no separate runtime. It owns authorization/catalog/session changes, including policy consumer updates required to keep the application coherent.
- Teacher tracking: `service`, a runnable end-to-end slice of the existing app including repository projection, facade, responsive UI and minimal redirects; shared application deployment, not a new service process.
- Retained workflows and cleanup: `service`, a runnable slice of existing parent/group/super-admin workflows, archive-owner metadata and final verification references; shared application deployment. It owns workflow adaptation beyond foundation policy changes, not teacher projection or session ownership.

The exact Unit IDs/directories and artifact scope will be presented for explicit Approve Plan / Revise Plan after this answer. Each unit remains independently testable with prior-unit contracts and fixtures; none is separately promoted to production. Shared-file edits must be serially integrated or assigned at the function/section boundary during Delivery Planning; the dependency graph alone grants no parallel execution.

## Interaction Mode

A. Guide me
B. I'll edit the file
C. Chat
X. Other (please specify)

[Answer]: Chat

## Decomposition Plan Approval

The proposed units preserve the existing shared application deployment and logical component ownership:

| Unit ID | Directory | Kind | Boundary | Direct dependencies |
| --- | --- | --- | --- | --- |
| U1 | u1-current-role-foundation | library | Current-role policy, grant conversion, session/catalog handling, matching SQL enforcement and required policy consumer updates | None |
| U2 | u2-teacher-tracking | service | Existing app's runnable teacher projection/facade/UI slice and minimal bookmark redirects | U1 |
| U3 | u3-retained-workflows-cleanup | service | Existing parent/group/super-admin workflows, archive-owner metadata and final executable fixture/manifest cleanup | U1, U2 |

Kinds describe the required Construction design scope. U1 is embedded code and a migration artifact, with no standalone runtime. U2 and U3 deliver runnable slices inside the existing deployed application, not additional service processes. The dependency U3 -> U2 is required for final current-role reference cleanup to consume the completed teacher naming/routes/projection contract; it does not transfer teacher ownership to U3. Tests local to each changed layer are included in its owning unit. Final integrated verification remains Build and Test.

No separate deployment or parallel execution is approved by this plan. Delivery Planning chooses delivery grouping/sequence and coordinates shared-file edits. All eight stories are assigned, with cross-unit criteria traced explicitly during generation. Classic scope has no walking-skeleton ceremony.

A. Approve Plan
B. Revise Plan
X. Other (please specify)

[Answer]: Approve Plan
