# Accessibility Requirements: U4 Notifications and Excel import

Source: NFR5 and NFR7 of the requirements, answer Q7, rule BR42.2. NFR7 (no regression of other pages) is amended by the owner's approval of the import screen changes (production mode: upload, real run values, new-upload link).

| ID | Requirement | Check |
|---|---|---|
| NFR5.6 | The changed import screen (file input, messages for the new codes, real counts, new-upload link) meets WCAG 2.2 AA: text contrast 4.5:1, controls 3:1, every control labelled, errors announced and linked to their field, keyboard operable in reading order | The automated accessibility scan in the browser tests has no serious or critical violation on every import step |
| NFR5.7 | All new copy is Hungarian, including the messages for IMPORT_UNSAFE_CELL and IMPORT_MATCH_CHANGED and the other IMPORT_* codes | A copy test lists the messages; browser tests read the labels |
| NFR7.4 | Apart from the import screen's production-mode changes, other pages keep their markup, copy, test ids and behaviour (the notification list, the reminders list, the dashboard count and the parent pages are unchanged); the import screen's synthetic mode is unchanged | The existing component and browser tests stay unchanged and green |
