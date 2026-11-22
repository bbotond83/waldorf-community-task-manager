# Observability Design: u7-swaps-and-duty-changes

Sources: `observability-requirements.md` and `tech-stack-decisions.md` of this Unit, `functional-spec.md`, and C1, C8 and C9 in `contract-summary.md`. The app runs on the owner's computer only; no monitoring service, alert or SLO is added.

## Design

| Need | Design | Requirement |
|---|---|---|
| Audit actions | The audit action list gains `swap.reversed` and `duty.reassigned` in the migration, keeping every existing value | NFR4.4 |
| Audit reading | Entries are read by the existing audit reader; the administrator's swap list is the record of agreed swaps | NFR4.5 |
| Failed emails | The five new notice kinds are registered in U5's registry, so the delivery-problems screen lists their failures like any kind, with no address | NFR4.6 |
| Daily check record | `swap_expiry` writes its outcome and counts (swaps ended, cancellations ended, notices queued) to `timed_check_runs`; a failure shows on the same screen | NFR4.7 |
| Refusals | Every refusal carries its stable code in the C1 envelope; the screens map each code to one Hungarian text in the copy module | NFR4.8 |
| Failed reads | A failed read shows the existing error or denied state; "nincs kérés" appears only after a successful empty read | NFR4.9 |
