# User Flow

Upstream artifacts: `intent-statement.md`, `scope-document.md`, `intent-backlog.md`.

## Parent Flow

Sign in -> Saját feladataim -> view family-owned assignment -> sign up -> receive 7-day and 24-hour reminders. For change: choose Swap -> other parent accepts -> auto-approved; choose Cancel -> submit reason -> await authorized approval.

```
Sign in -> My Tasks -> Assignment Detail
                     +-- capacity available? -- yes -> Sign up -> confirmation -> reminders
                     |                         -- no  -> full-state message
                     +-- Swap -> eligible counterpart? -- no -> guidance
                     |                                  -- yes -> accept? -> auto-approved / declined
                     +-- Cancel -> pending approval -> approved / rejected
```

## Admin Flow

Sign in -> manage tasks/events -> assign or approve cancellation -> monitor reminders -> upload Excel -> map columns in preview -> fix validation errors -> confirm one-time import.

```text
Sign in -> authorized admin dashboard
  -> create task/event -> validation error / save
  -> assign family -> success / unavailable / permission denied
  -> cancellation request -> approve (release) / reject (keep assignment)
  -> reminder monitoring -> delivered / failed status (no manual resend)
  -> import file -> mapping -> validation errors -> confirm import
```

## Read-only Staff Flow

Sign in -> Csoport naptár -> view schedule and event details only; no editing and no parent names/contact data.
