# Functional Design Questions: u7-swaps-and-duty-changes

The requirements, stories, contracts and the U6 design settle most of this piece of work. These four points are still open. Contains no names or contact details.

## Q1. [Product owner] Swapping into a working group's duty

A swap now works across any kind of duty (AC8.2.1). Today's swap only allows two duties of the same working group, and both families must be members of that group. A swap could now hand a family a duty that belongs to a working group it has not joined, for example an event task of the Garden group.

A. Any active family may receive any duty through a swap; group membership is not checked. The changeover rule and the same-week rule still apply (Recommended)
B. A family may receive a working group's duty only if it is a member of that group; rota duties and community-wide duties are open to every family
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Weekend openings and closings in a swap

A weekend opening or closing belongs to a week: the indoor-cleaning or front-garden family picks it, and the weekend family holds the rest and the shelter cleaning (U6). When such a week changes hands, its pick already moves with it (AC8.2.3). The question is whether a single opening or closing can also be swapped on its own.

A. No. An opening or closing cannot be swapped on its own; it follows its week, and a family that wants a different slot changes its pick (Recommended)
B. Yes. An opening or closing can be swapped like any other duty, as long as the receiving family is not already on that weekend
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] An approved cancellation of a rota duty

A family can ask to cancel a duty, and an administrator decides (assumption A6). For a rota duty, the week then has nobody. A rota week with nobody already exists in the app as a flagged duty, and the weekend family covers a missing picking family (AC6.1.3).

A. Approving frees the duty and flags it, like a duty whose family was removed. The administrator then gives it to another family with a reassignment; any weekend pick of that week goes back to the weekend family (Recommended)
B. Approving needs a new family in the same step, so a rota week is never left empty
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] The administrator and a pending swap

Today an administrator can approve or reject a pending swap on the families' behalf. Now a swap applies as soon as both families agree, and the administrator steps in by reversing an applied swap (AC8.2.4) or by reassigning a duty, which cancels its pending swap (AC5.4.6).

A. Only the two families decide a pending swap. The administrator sees pending swaps in the swap list and can reassign a duty, but no longer approves or rejects swaps (Recommended)
B. Keep the administrator's approve and reject for pending swaps as well
X. Other (please specify)

[Answer]: A
