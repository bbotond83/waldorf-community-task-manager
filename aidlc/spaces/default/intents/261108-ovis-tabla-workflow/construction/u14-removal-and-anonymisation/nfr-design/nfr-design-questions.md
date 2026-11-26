# NFR Design Questions: u14-removal-and-anonymisation

The NFR requirements and both reviews settle the locking, session, audit and test design. One point needs the owner's decision. Contains no names or contact details.

## Q1. [Product owner] A super admin removing themselves or their own family

Removal ends the removed parents' sessions. If a super admin removes their own family, or themselves, their own session ends at that moment, so they never see the result page with the flagged items. The NFR review raised this.

A. Refuse it: a super admin cannot remove themselves or their own family; another super admin does it. The confirmation page says so instead of showing the button (Recommended)
B. Allow it: the removal goes ahead, and the super admin lands on the sign-in page with a message that the removal is done; another super admin sees the flagged items later
X. Other (please specify)

[Answer]: A
