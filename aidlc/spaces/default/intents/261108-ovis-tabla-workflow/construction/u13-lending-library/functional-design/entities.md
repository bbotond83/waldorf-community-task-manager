# Entities: u13-lending-library

The data shape for the community's lending library: books, loans and return watches, and what this unit registers for notices. Built from `unit-of-work.md` (U13), `unit-of-work-story-map.md`, `stories.md` (US16.1 to US16.3 and the book part of US17.1), `requirements.md` (FR1.2, FR1.6, FR16, FR17.4, NFR3 to NFR5, NFR10), `components.md` (Library, TimedChecks, WebApplication), `contract-summary.md` (C1, C2, C3, C6, C8, C9, C16, C17, C20) and the owner's answers Q1 to Q7 in `functional-design-questions.md`. Decisions are ADR-001 and ADR-006 in `decisions.md`. Contains no names or contact details.

All three entities are new: there is no library table, function or screen in the code today. Books belong to the whole community (FR1.2), so a book carries no working group. One *book* is one physical copy; two copies of one title are two books.

## Entity Model

```yaml
entities:
  - name: Book
    description: One physical copy in the community's lending library, with an owner. Where it is now is not stored on the book; it follows from its loans (a book is borrowed while it has an open loan).
    owner: Library
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: communityId, type: reference, required: true, references: Community }
      - { name: title, type: text, required: true, min: 1, max: 200 }
      - { name: authors, type: text, required: true, min: 1, max: 200, note: "one line, for example several authors separated by commas" }
      - { name: description, type: text, required: false, max: 1000, note: "optional; a book without one is shown without a broken layout (AC16.1.2)" }
      - { name: ownerParentId, type: reference, required: false, references: Parent, note: "the owner, a parent with an account (Q1). Empty for a book whose owner has no account, and after the owner was removed (BR139.1)" }
      - { name: ownerName, type: text, required: false, max: 200, note: "a typed owner name, only for a book loaded from the spreadsheet whose owner matches no parent (Q1). Shown as typed, with no link; never set by a signed-in user" }
      - { name: sourceKey, type: text, required: false, unique: true, note: "stable key of the spreadsheet row; set only by the one-off load (BR140.1), so a second run creates no duplicate" }
      - { name: removedAt, type: timestamp, required: false, note: "set when the book is removed (Q2); a removed book leaves every list and keeps its loans" }
      - { name: version, type: integer, required: true, min: 1, default: 1, note: "goes up on every change of the book and on every borrow and return" }
    constraints:
      - A book names at most one owner: ownerParentId and ownerName are never both set.
      - ownerName is only ever set together with a sourceKey.
      - A book with an open loan cannot be removed (BR132.2).
      - Several books may share a title and authors; they are different copies.
    relationships:
      - { to: Community, cardinality: many-to-one, direction: Book to Community }
      - { to: Parent, cardinality: many-to-one, direction: Book to Parent, note: "optional; the owner" }
      - { to: Loan, cardinality: one-to-many, direction: Loan to Book }
      - { to: ReturnWatch, cardinality: one-to-many, direction: ReturnWatch to Book }

  - name: Loan
    description: One borrowing of a book by one parent, from the day it is recorded until the owner records the return. It is kept as history after the return.
    owner: Library
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: bookId, type: reference, required: true, references: Book }
      - { name: borrowerParentId, type: reference, required: false, references: Parent, note: "the parent who borrowed; shown through C6, so a removed parent shows as korábbi tag. Cleared on removal once the loan is closed (BR139.1)" }
      - { name: borrowerFamilyId, type: reference, required: false, references: Family, note: "the borrower's family at the moment of borrowing; read by the reminder to a leaving family (BR136.1). Cleared together with borrowerParentId" }
      - { name: borrowedAt, type: timestamp, required: true }
      - { name: until, type: date, required: false, note: "the optional 'until when' date; only shown, nothing happens when it passes (Q7, BR133.3)" }
      - { name: returnedAt, type: timestamp, required: false, note: "empty while the book is out; an open loan has no returnedAt" }
      - { name: version, type: integer, required: true, min: 1, default: 1 }
    constraints:
      - A book has at most one open loan (returnedAt empty) at any moment; the database refuses a second one.
      - returnedAt is not before borrowedAt.
      - until, when set, is not before the date of borrowedAt. The limit "not before today and not more than one year ahead" is checked by the function against today at the moment the date is set (BR133.3), so the table never raises a raw check error for a date the rule accepted.
      - A closed loan never changes again, except that the borrower links may be cleared by a removal.
    relationships:
      - { to: Book, cardinality: many-to-one, direction: Loan to Book }
      - { to: Parent, cardinality: many-to-one, direction: Loan to Parent, note: "optional; the borrower" }
      - { to: Family, cardinality: many-to-one, direction: Loan to Family, note: "optional; the borrower's family" }

  - name: ReturnWatch
    description: A parent's request to be told when a borrowed book is back (AC16.3.1). It exists only while the book is out and is deleted when the notice has been sent.
    owner: Library
    change: new
    attributes:
      - { name: id, type: identifier, required: true, unique: true }
      - { name: bookId, type: reference, required: true, references: Book }
      - { name: parentId, type: reference, required: true, references: Parent }
      - { name: createdAt, type: timestamp, required: true }
    constraints:
      - A parent has at most one watch on a book.
      - Neither the holder nor the owner of the book can watch it (the holder has it, the owner records its return).
      - The watch is deleted when the return notice is sent, when the parent borrows the book, when the parent cancels it, when the book is removed and when the parent is removed.
    relationships:
      - { to: Book, cardinality: many-to-one, direction: ReturnWatch to Book }
      - { to: Parent, cardinality: many-to-one, direction: ReturnWatch to Parent }

  - name: NoticeKind
    description: Registered kinds of notice (U5). This unit adds two.
    owner: Notifications
    change: two registered values, added by this unit's migration (contract C8, new_values)
    attributes:
      - { name: kind, type: text, required: true, unique: true, allowed_added: [book_returned, book_return_due] }
    constraints:
      - 'Hungarian title prefixes are "Könyv visszaérkezett" and "Könyvet vissza kell vinni".'
    relationships: []

  - name: NoticeTarget
    description: Registered kinds of item a notice concerns (U5). This unit registers book.
    owner: Notifications
    change: one registered value, with its facts function (title, date, page path /szulo/konyvtar/[id])
    attributes:
      - { name: targetType, type: text, required: true, unique: true, allowed_added: [book] }
    constraints:
      - The facts function returns only the book's title and, for a reminder, the changeover date; never a borrower, an owner or a contact detail (NFR10).
    relationships: []

  - name: TimedCheck
    description: A row in the daily run's registry (U5, contract C9). This unit adds one.
    owner: TimedChecks
    change: one registered row, inserted by this unit's migration; U5's function is not edited
    attributes:
      - { name: checkName, type: text, required: true, unique: true, allowed_added: [library_return_due] }
      - { name: functionName, type: text, required: true, allowed_added: [library_due_check] }
      - { name: runKind, type: enum, required: true, allowed: [daily, friday_noon], default: daily }
    constraints:
      - The check is internal; no signed-in user can call it, and it is safe to run twice (BR136.2).
    relationships: []
```

## Summary

- **Book** is one copy with a title, authors, an optional description and an owner. The owner is a parent, or, for a book loaded from the spreadsheet whose owner has no account, a typed name with no rights. Removing a book hides it and keeps its history.
- **Loan** is one borrowing. A book is *available* when it has no open loan and *borrowed* when it has one, so the book's place is never a second copy of what the loan says (the same single-record reasoning as ADR-010). A borrower may add an "until when" date, which is only shown.
- **ReturnWatch** is a parent's one-time request to be told when a borrowed book returns. It disappears once the notice has gone out.
- Two notice kinds, one target type and one daily check are registered for U5's mechanism; nothing in U5 is edited.
- No record joins a child, a contact detail or a family's health. A loan links only to the borrower and the borrower's family, and both links are cleared on removal (BR139.1).
