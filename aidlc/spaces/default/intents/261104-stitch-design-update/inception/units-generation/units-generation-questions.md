# Units Generation Questions

A "unit" is one piece of work that is built, tested and reviewed on its own, which here means one pull request. You already decided the order: fonts and shared look first, then one flow at a time. Two choices remain.

## Q1. [Delivery] How many pieces should the work be cut into?

The first piece is the thin first slice: fonts, shared look, the page frame, the sign-in page, the CSS linter and the pinned versions. After it, the flows follow.

A. Five pieces: the first slice, then parent task list (with "Saját vállalásaim"), task details and signup, cancellation, and teacher and admin approvals. One pull request each, matching the flows you listed (recommended)
B. Three pieces: the first slice, all parent screens together, and teacher and admin approvals (fewer reviews, bigger changes each time)
X. Other (please specify)

[Answer]: A

## Q2. [Delivery] Should the flow pieces be allowed to run at the same time?

Every flow edits the same stylesheet, `app/globals.css`, so two flows built at once can collide on the same lines. The first slice must come first either way.

A. One after another in a fixed order: no two flows are in progress at once (recommended: avoids conflicts, and you review one at a time)
B. Independent after the first slice: they may be built in parallel, and conflicts are sorted out when they merge
X. Other (please specify)

[Answer]: A
