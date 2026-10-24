# Accessibility Requirements: U3 Directory, settings and coordination

Source: NFR5 and NFR7 of the requirements, answers Q6 and Q7, rule BR32.7. NFR7 (no regression of other pages) is amended by the owner's approval of exactly two screen changes: the swap flow and the admin forms.

| ID | Requirement | Check |
|---|---|---|
| NFR5.4 | The changed swap page, the new incoming-swaps page and the extended admin forms meet WCAG 2.2 AA: text contrast 4.5:1, controls 3:1, every control labelled, errors announced and linked to their field, keyboard operable in reading order | The automated accessibility scan in the browser tests has no serious or critical violation on these screens |
| NFR5.5 | All new copy is Hungarian, including the messages for the new codes (BR32.8); Confirm, Decline and Withdraw name the partner task in their accessible label | Browser tests read the labels; a copy test lists the new messages |
| NFR7.3 | Apart from the swap page, the incoming-swaps page, the parent navigation link, the admin record, assign and notes forms, and the parent notification page for real (non-synthetic) accounts, which shows the empty state instead of fixture data until U4 (BR32.9), other pages keep their markup, copy, test ids and behaviour; the notification page's existing tests for the synthetic actor stay unchanged | The existing component and browser tests for those pages stay unchanged and green |
