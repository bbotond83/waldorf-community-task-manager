# NFR Requirements Questions: u3-directory-and-profile

Most of U3's non-functional targets already follow from `requirements.md` (NFR1 to NFR11), the Unit's `functional-spec.md` and `rules.md`, and today's code (sign-in lockout of 5 wrong tries in 15 minutes, 32-byte links stored only as a hash, a failed invitation email keeps the invitation and offers a resend). These two points are not settled anywhere yet. Contains no names or contact details.

## Q1. [Security] How often may a confirmation or invitation email be re-sent?

"Új levél" (a new email-change link) and "Új meghívó" (a new invitation) each send an email to an address. Without a limit, anyone signed in, or an administrator by mistake, could flood that inbox. Today nothing limits invitation resends.

A. At most 3 emails to the same address per hour for each kind; the 4th is refused with "Túl sok levél ment ki. Próbáld újra egy óra múlva." (Recommended: stops flooding, never gets in the way of a real retry)
B. At most 1 email per address per 5 minutes
C. No limit, because the app only runs on the owner's computer for now
X. Other (please specify)

[Answer]: A

## Q2. [Privacy] How long are finished email-change requests kept?

Each request stores the new address. Once it is confirmed, replaced, cancelled or expired it is no longer needed, but the address stays in the database. The audit log keeps that the change happened, without the address.

A. Deleted 30 days after they finish, by the existing housekeeping step (Recommended: keeps a short window for questions, then the address is gone)
B. Deleted as soon as they finish
C. Kept until the parent is removed, then cleared with the rest of their details
X. Other (please specify)

[Answer]: A
