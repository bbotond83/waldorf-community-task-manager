# Performance Design: u3-directory-and-profile

How the targets in `performance-requirements.md` are met, following `functional-spec.md`, `tech-stack-decisions.md` and `technology-stack.md`. Contains no names or contact details.

## Read Path

`directory_list` returns every card in one call: families, their active parents, profile fields allowed for the viewer, and children where BR30.4 allows. It works from set-based joins on indexed family and parent ids, with the viewer and the "shared" test worked out once per call rather than once per row (NFR9.2). At 20 families (about 40 parents) the result is a few dozen rows, far below the data API's 1000-row limit.

No cache is used. A cached card could show a field after a parent unticked sharing, which NFR2.1 forbids, and the data is small enough that a fresh read is cheap.

## Search

The search box filters the cards already in the page in the browser (BR30.9, NFR9.3). It issues no request, so it is fast at this size and cannot match a hidden field. A browser test asserts no network call while typing.

## Other Pages

"Fiókom" reads one profile, one account and at most one pending email request in one call. The records screen keeps its existing paged read and adds the invitation state in the same call. Each loads in under 2 seconds on the large seed (NFR9.1).

## Existing Lists

New read rules touch only the directory and contact reads. Task, reminder and records lists are unchanged; the existing timing tests run on the large seed to show it (NFR9.4).

## Screens

Screens use the existing Next.js app and `app/globals.css` with new `parent-` and `admin-` classes. Long names wrap. All text is Hungarian. Each new screen is designed in Stitch first and checked at phone width and by keyboard (NFR8.1, NFR8.2).
