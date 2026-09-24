# Team Allocation

## Allocation Basis

The plan consumes [requirements](../requirements-analysis/requirements.md), [stories](../user-stories/stories.md), [mockups](../refined-mockups/mockups.md), [components](../application-design/components.md), [unit definitions](../units-generation/unit-of-work.md), [DAG](../units-generation/unit-of-work-dependency.md), [story map](../units-generation/unit-of-work-story-map.md), and [team practices](../practices-discovery/team-practices.md).

## Bolt Ownership

| Bolt | Lead mob | Required review/support focus |
|---|---|---|
| 1 Runnable Parent Skeleton | AI developer | architect for composition/contracts; quality for smoke/browser; security for mode/auth boundary; design for accessibility |
| 2 Staff Visibility | AI developer | quality/security for field-negative and denial tests; design for responsive schedule |
| 3 Administrator Core | AI developer | architect for domain ownership; quality/security for authorization/atomic outcomes; design for complex states |
| 4 Administrator Advanced | AI developer | architect/security/quality for import/jobs/revocation/lifecycle; design for step/timeline behavior |
| 5 Verification & Handoff | AI developer | quality lead for gates/evidence; devsecops for scans; product for fresh-checkout acceptance |

## Parallel Coordination

Bolts 2 and 3 may use separate worktrees after Bolt 1 merges. They share only approved runtime/façade contracts and must not edit each other's UI ownership. Bolt 4 starts from merged admin-core contracts. Bolt 5 integrates after all product Bolts converge.

## Merge and Approval

Each Bolt follows trunk-based short-lived worktrees and squash merge. Bolt 1 is explicitly gated. The construction autonomy ladder after Bolt 1 determines whether later Bolts remain gated or proceed autonomously; reviewer and quality gates still apply.

