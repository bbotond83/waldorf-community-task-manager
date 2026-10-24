# Frontend Components: U4 Notifications and Excel import

The owner-approved screen changes (answer Q7, BR42.2) are limited to the import screen in production mode: the file upload and the replacement of demo-only values by real ones. Everything else keeps its markup, copy and test ids. All new copy is Hungarian, every control is labelled, errors are announced and linked to their field, and the flow must pass the automated accessibility scan (WCAG 2.2 AA, NFR5). Source: `functional-spec.md` workflows W2, W5, W7 to W11 and rules BR42.2, BR42.3.

## Screens

| Route | Component | Change |
|---|---|---|
| `/admin/import` (first step) | WorkbookUploadForm | Changed in production mode: a file input for the `.xlsx` workbook (accept `.xlsx`, size hint 5 MB; the app's server-action body limit is raised to 6 MB) with a submit button and the Hungarian messages for IMPORT_MALFORMED, IMPORT_OVERSIZED, IMPORT_MISSING_SHEET, IMPORT_MISSING_HEADER and IMPORT_UNSAFE_CELL; the demo scenario selector stays in synthetic mode only |
| `/admin/import` (preview, conflicts, confirm, result, recovery) | existing step components | Changed only in what the real run needs: the 'Forrás' line shows the file name instead of the demo fixture id; the resolve, commit and recovery forms send the real run id and run version (no constants '1' and 'run-waldorf-v1'); every attempt sends a fresh idempotency key (no constant keys); the confirm text and the result panel show the real counts (no fixed '3 engedélyezett változást', '3 elem módosult' or demo sentence); the scenario selects and the `scenario` field are not rendered or sent in production mode; the result step gains a 'new upload' link; layout and other wording stay |
| `/admin/emlekeztetok` | reminders list | Unchanged; shows real jobs with the label 'Szimulált kézbesítés' and family counts |
| `/szulo/ertesitesek` | notification list | Unchanged; shows the parent's own real notifications (the empty state until something happens) |
| `/admin` (dashboard) | open import conflicts count | Unchanged; now the real count for super admins |

## Component Hierarchy and State

- The preview model gains `runId`, `runVersion` and the file name (BR42.2); each resolve answer returns the new version.
- The upload form is a client form that posts the file with a server action; the action reads the bytes, hands them to the parser and returns an explicit result state; no file path is ever sent or stored, and the file name is kept only as a label.
- Each IMPORT_* code maps to one Hungarian message; a stale preview reloads the page (as the conflict step does today).
- Keyboard order follows reading order; the file input has a visible label and a hint; errors are linked to the input.
