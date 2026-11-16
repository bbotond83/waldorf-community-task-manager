# NFR Requirements Questions: u4-working-groups

No questions are needed for U4. Its non-functional targets all follow from `requirements.md` (NFR1 to NFR11), the Unit's `functional-spec.md` and `rules.md`, the contracts in `contract-summary.md`, and choices already made for U3 and U5:

- **Speed:** the 2-second list-page target of NFR9.
- **Email:** sending, retries and the failures screen belong to U5. The coordinator notices use U5's notice function unchanged (Q4 and Q5 of `functional-design-questions.md`).
- **Contact details:** the phone and email rules come from U3's directory rules.
- **Resend limits:** join, leave, appoint and revoke send no email to an address the caller chooses, so U3's resend limit does not apply.
- **Hosting:** nothing is hosted in this work, so no availability or alerting target applies.

Contains no names or contact details.
