# Tech Stack Decisions: u8-animal-care-and-information

This Unit stays inside the stack in `technology-stack.md`, as the constraints in `requirements.md` require. It follows `functional-spec.md`, `rules.md` and `contract-summary.md`.

## Decisions

| Area | Decision | Reason |
|---|---|---|
| Rules | Named Postgres functions behind row-level security, in one new forward-only migration file | `team.md`; applied migrations are never edited |
| Structure | Four new tables: slot calendars, slots, fair-share rounds and information sections; the duty origin list gains `animal_slot` | Slots are duties and places (C4), so sign-up, swaps, reminders and removal reuse what exists |
| Sign-up | The existing `duty_sign_up` (C18) with its C10 check; no new sign-up function | One way to take a place |
| Give-up | `slot_give_up` in the DutyChanges block, resting on C5 `place_release` (C19, ADR-012) | One owner for every change of who holds a place |
| Fair share | Worked out when read, from places and C20 standings; only the month's round is stored | Never out of date; the round makes the reminder once a month |
| Section owner | Stored as the working group's name and resolved in the current school year (C3) | Groups exist per year; a new year's group takes over by itself |
| Section text | Plain text with a small formatting subset, shown by the app's own renderer into React elements, never as raw HTML | No new package; nothing in the text can run (NFR3.12) |
| Notices | Four kinds and the target type `animal_signup` registered in U5's registries by this Unit's migration; sent through `notice_send` | C8; U5's functions are not edited |
| Daily checks | Two registry rows inserted by this Unit's migration; each function takes the moment of the run | C9; safe to run twice and testable without waiting |
| Time | Slot starts are stored as moments made from the local date and time in Budapest time, inside the database | Matches the rest of the app; correct across clock changes |
| Screens | The existing Next.js app and `app/globals.css`, with the `parent-` and `admin-` class prefixes and a new `info-` prefix for the information page | Team class-prefix rule: a new area gets its own prefix |
| Tests | The existing database, Vitest and Playwright suites | No new tool is needed |

No new package, service or scheduler is added.
