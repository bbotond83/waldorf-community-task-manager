# NFR Requirements Questions: u14-removal-and-anonymisation

The requirements (NFR1, NFR3 to NFR6, NFR9, NFR11), this Unit's functional design and its design review settle the speed, sign-in, locking and test targets. Two privacy points need the owner's decision. Contains no names or contact details.

## Q1. [Product owner] Free text written by a removed person

The design empties the notes of a removed person's event sign-ups and food offers, because a note can hold a name. The design review found more places where a parent writes free text: notes on checklist claims, reasons given when skipping a recurring duty, reasons on swap and cancellation requests, to-do task notes, and book descriptions. History rows stay either way; only the text is in question.

A. At removal, empty every text that belongs to the removed person's own entry: sign-up notes, food-offer texts, checklist-claim notes, skip reasons they gave and reasons on their requests. Texts that describe shared work (to-do task notes and descriptions, book descriptions, event notices) stay, because others wrote or rely on them (Recommended)
B. As A, and also empty to-do task notes and the descriptions of the removed person's books
C. Only sign-up notes and food-offer texts, as the design says now
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] The stored name of a parent removed on their own

When a whole family is removed, its stored names stay for the 30 days so it can be restored. A parent removed on their own cannot be restored, yet the design keeps their name on the archived record until the whole family leaves, which can be years. Everyone except a super admin already sees "korábbi tag".

A. Replace the name with "Anonimizált szülő" at the moment a single parent is removed. History is unchanged, because it already reads "korábbi tag" (Recommended)
B. Keep the name until the family is deleted or anonymised, as the design says now, and confirm with the kindergarten before go-live
X. Other (please specify)

[Answer]: A
