# Task Creation User Flow

## Basis

The flow implements the approved [intent statement](../intent-capture/intent-statement.md), stays within the [scope document](../scope-definition/scope-document.md), and covers the Must Have workflow in the [intent backlog](../scope-definition/intent-backlog.md). [intent] [scope] [backlog]

## Happy Path

```text
S1 [Start local app]
   |
   v
S2 [Show loading state and attempt task load]
   |
   v
D1 [Load succeeds?]
   | yes                         | no
   v                             v
S3 [Show seeded tasks]          E1 [Show load error]
   |                                | retry -> S2
   v
S4 [Enter or correct name, category, capacity]
   |
   v
S5 [Submit form]
   |
   v
D2 [Input valid?]
   | yes                         | no
   v                             v
S6 [Disable submit; show busy]  E2 [Show summary + inline errors]
   |                                | correct -> S4 -> S5 -> D2
   v
S7 [Attempt task creation]
   |
   v
D3 [Creation succeeds?]
   | yes                         | no
   v                             v
S8 [Announce success]           E3 [Show create error; preserve values]
   |                                | retry -> S6 -> S7 -> D3
   v
S9 [Render new task first]
```

## Recovery Paths

| Condition | User-visible response | Recovery | Source |
| --- | --- | --- | --- |
| Missing or invalid required field | Focused error summary plus field-level Hungarian error | Correct fields and resubmit | [Q2] [Q6] |
| Task list cannot load | Plain-language error with retry action | Retry or restart local server | [scope] [Q6] |
| Task creation is running | Busy submit label and duplicate-submit prevention | Wait for success or failure | [Q2] [Q6] |
| Task creation fails | Focused failure message with preserved form values | Retry submission | [Q2] [Q6] |
| No tasks exist | Guided empty state with jump-to-form action | Create the first task | [scope] [Q1] |
| Process restarts | Seeded state returns with local-data notice | Continue with restored demonstration data | [scope] [backlog] |

## Responsive Flow

Desktop keeps the task list and creation panel visible side by side when space permits. Mobile preserves the same sequence in one column: context, list, form, feedback. [Q3] [Q5]

## Accessibility Flow

- A skip link moves keyboard focus directly to `main`. [Q6]
- Tab order follows the visual and DOM order without custom positive tab indexes. [Q6]
- Invalid submission focuses the error summary; linked messages identify each invalid field. [Q6]
- Successful creation is announced through a polite live region and remains visible in the list. [Q2] [Q6]
- Focus indicators, labels, and state changes remain perceivable without color alone. [Q6]

## Validation Contract

The name is trimmed and must contain 3–80 characters; category must be explicitly selected from `Kert`, `Konyha`, `Terem`, `Udvar`, or `Egyéb`; capacity must be a whole number from 1 through 20. Invalid values remain in the form, no task is created, and correction requires explicit resubmission through the same validation decision. [Q2] [Q6]

## Scope Guard

The flow does not include authentication, real personal data, signup, swaps, cancellation, administration, notifications, or external-service behavior. [scope] [backlog]

## Assumptions and Open Questions

None.
