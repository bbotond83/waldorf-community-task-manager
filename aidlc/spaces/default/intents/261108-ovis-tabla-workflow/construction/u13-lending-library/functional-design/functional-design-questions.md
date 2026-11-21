# Functional Design Questions: u13-lending-library

The requirements, stories, contracts, mockups and earlier answers settle most of this piece of work. These seven points are still open. Contains no names or contact details.

## Q1. [Product owner] Who owns a book

A book has an owner (AC16.1.1). The spreadsheet's 14 books also come in through this unit (U15), and some of their owners may have no account in the app.

A. The adding parent is the owner by default and may name another parent of the community instead. A book loaded from the spreadsheet whose owner matches no parent keeps the owner's typed name and has no owner with rights (Recommended)
B. The owner is always the parent who adds the book; nobody else can be named
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Changing and removing a book

The stories do not say who may correct a book's title or description, or take a book out of the list when it is lost or given away.

A. The owner and a super admin may change a book's title, authors and description at any time, and may remove a book while nobody holds it. A removed book leaves the list and keeps its loan history (Recommended)
B. Books cannot be changed or removed once added; only a super admin can, through the database
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] Who records a return

Only the owner records a return, and anyone else is refused (AC16.2.2, AC16.2.3). A book whose owner has no account, or whose owner was removed from the community, would then be stuck as "borrowed" for ever.

A. Only the owner records the return. For a book with no owner who has rights, a super admin may record it (Recommended)
B. The owner records it, and a super admin may always record it
C. Only the owner records it, with no exception
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] Who may borrow

FR16.3 says the borrower records borrowing. Teachers write nothing in the app (FR1.6).

A. Any parent with a family, including a group admin and a super admin who has a family, may borrow any available book that is not their own. There is no limit on how many books one person holds (Recommended)
B. As A, and a parent may also borrow their own book
C. As A, with a limit of 3 books held at a time
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Who sees where a book is

The list shows where each book is now (FR16.1). Showing who holds it helps people ask for it, but it is a person's name next to an activity.

A. Every signed-in reader sees the holder's name as the app shows people everywhere (korábbi tag for a removed person) and the "until when" date. No contact details are shown (Recommended)
B. Everyone sees only "Kölcsönözve" (borrowed) and the date; the holder's name is shown only to the owner and a super admin
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] The reminder to a leaving family

A family that is leaving and still holds a book gets one reminder 30 days before the changeover date (AC16.3.2). The daily run only knows the day, and a family may be marked as leaving, or may borrow, after that day has passed.

A. The parents of the holding family all get one notice and email per loan, on the first daily run on or after 30 days before the changeover date while the loan is open and the family is leaving. Nothing is sent after the changeover date (Recommended)
B. As A, and the owner is also told which book is still out
C. Only the parent who borrowed it is told
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] A book that is late

A borrower may give an "until when" date (AC16.2.1). Nothing in the stories says what happens when it passes.

A. The date is only shown on the book. Nothing is sent and nothing changes when it passes. The borrower may change the date while holding the book (Recommended)
B. As A, and the borrower gets one reminder on the day after the date
X. Other (please specify)

[Answer]: A
