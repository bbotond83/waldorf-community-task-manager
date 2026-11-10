# Refined Mockups

Screen-by-screen layouts for the stories in `stories.md` and the requirements in `requirements.md`. There are no `wireframes` or `user-flow` documents, because this plan has no rough-mockup stage; these screens are designed directly from the stories. The final Stitch design of each screen is made and approved just before that piece is built (Q1, `team-practices.md`). Hungarian labels are proposals. Layout rules are in `design-system-mapping.md`, behaviour in `interaction-spec.md`. All names shown in examples are invented.

## Navigation

**Parent, on a phone:** a bottom bar with Feladataim (My tasks), Beosztás (Rota), Események (Events), Teendők (To-do list) and Több (More). "Több" opens Munkacsoportok, Szülők, Könyvtár, Információ and Fiókom. A bell at the top opens Értesítések.

**Parent, on a computer:** the same destinations in the existing top navigation panel.

**Teacher:** Beosztás, Események, Teendők, Munkacsoportok, Szülők, Információ. All read-only except their own account.

**Coordinator:** the parent menu. "Több" also lists "Csoportom" (My group), one entry per group the person coordinates.

**Administrator:** the existing admin menu, plus Tanév (school calendar), Beosztás tervezése (rota planning), Események (community events), Sablonok (templates), Csere áttekintés (swaps), Munkacsoportok and Értesítési hibák (failed emails). On a phone it stays in the existing collapsible panel, without a bottom bar.

**Someone who is both a parent and an administrator:** the existing role home applies. A "Szülői nézet" / "Adminisztráció" link in the header switches between the two menus.

```text
+--------------------------------+
| Logo            (bell) (3)     |
+--------------------------------+
|                                |
|  page content                  |
|                                |
+--------------------------------+
| Feladataim Beosztás Események  |
| Teendők  Több                  |
+--------------------------------+
```

Text fallback: a phone screen with a header holding the logo and a notification bell, the page content in the middle, and a fixed bottom bar with five items.

## Parent Screens

### My tasks, /szulo/feladataim (US15.1, US5.3)

```text
Feladataim
-- Ezen a héten --
[ Benti takarítás  nov. 9-15.     Teendő ]
[ Hétvégi nyitás: válassz egyet!  Sürgős ]
-- Később --
[ Vízhordás  nov. 23-29.                 ]
[ Felvállalt teendő: csap javítása       ]
```

Text fallback: a heading, then cards grouped under "this week" and "later". Each card has a title, a date and a status pill.

Empty state: "Most nincs feladatotok." with a link to the To-do list and to the animal-care sign-up.

Each card for a recurring duty or claimed task has a Kész (Done) button. After it is pressed, the card shows the name, the time and the word Kész. A duty owned by a working group appears here for a member who claims it, and the group's page offers Kész to its members and coordinators. Someone else trying it directly gets the refusal notice "Ezt a feladatot csak a felelős jelölheti késznek."

### Duty card, /szulo/beosztas/[id] (US5.3, US6.1, US8.2, US9.2, US10.1)

Title, week, family name, the "no fixed day" note, the instructions with a link to the information section, an optional "clean the bottles" duty with a done button, and the actions: Csere (Swap) and Lemondás kérése (asks an administrator to cancel, with a required reason; the card then shows "Lemondás elbírálás alatt").

| Card version | Shown |
|---|---|
| Weekend picker | The four opening or closing choices as large radio rows, taken ones disabled and labelled by family. The shelter cleaning is shown as "A hétvégi család feladata", never as a choice; a direct attempt to take it gets a refusal notice |
| Weekend animal-care family | The shelter cleaning, the slots still theirs, and a list of who has picked what. Before the pickers have finished it shows "Még nem választott: [család]". In a break week it shows three slots |
| Picking family missing | The weekend family's card says the slot has come to them; the administrator gets a notice |
| Any family concerned, and the administrator | A "Ki mit választott?" list for that weekend |

### Rota overview, /szulo/beosztas (US8.1, Q3)

Phone: a list of weeks from now on. Each week is a card listing its jobs and families; my family's rows are bold with a "Ti" (You) tag. School-break weeks show a "Szünet" label. A filter by job and family sits above.

Computer: a table with one row per week and one column per job.

Empty state: "Még nincs közzétett beosztás."

### Animal-care sign-up, /szulo/allatok (US7.1, US7.2, Q4)

```text
Állatgondozás
[Fair share: Ti 6 alkalom, átlag 8  >]
hétfő, nov. 10.
  Reggel    Kovács család
  Délután   [ Elvállalom ]   (üres)
kedd, nov. 11.
  Reggel    [ Elvállalom ]   (üres)
  Délután   Szabó család
```

Text fallback: a page heading, a collapsible panel with the family's count and the average, then a list of days with a morning and an afternoon row; a taken slot shows the family name and an empty slot shows a primary button and the word "üres" (empty).

The panel expands into each family's count. Empty rows use the Info Wash background and the word "üres", never colour alone.

### Swap, /szulo/csere (US8.2, US8.3)

Step 1: my duty. Step 2: choose another family's duty from a list filtered by job and date. Rule-breaking choices are shown disabled with the reason. Step 3: required reason, then send. The inbox shows incoming requests with Elfogadom (Accept) and Elutasítom (Decline), and outgoing ones with Visszavonom (Withdraw).

### Directory, /szulo/szulok (US3.1, US3.5)

A searchable list of family cards. A field that may not be shown is absent from the page, not hidden visually.

| Case | Viewer | Shown | Absent |
|---|---|---|---|
| Parent has shared | Parent | Name, phone, email, place of residence, occupation, hobby, how they support the community | - |
| Parent has not shared | Parent | Full name only | Everything else |
| Parent has not shared | Teacher | Name, phone, email | Other profile fields |
| Parent has shared | Teacher | Everything a parent sees | - |
| Parent has no account, so cannot share | Parent | Full name only | Everything else |
| All parents of a family have shared, including a single parent | Parent | The children's names | - |
| Only some parents have shared, or a parent has no account | Parent | No child's name, and no note saying why | Children |
| Family has no children | Anyone | No children section | - |
| Any | Administrator | The full record, on the admin screens | - |

Empty state: "Még nincs szülő a névsorban." No search results: "Nincs találat", with a reset link. Very long names wrap.

The working-group member list follows the same table.

### My account, /szulo/fiokom (US3.2, US3.3, US3.4)

Three panels: Adataim (details), Láthatóság (the sharing tick box with an explanation of exactly what others will see) and Bejelentkezés (email and password change).

While an email change is pending, the panel shows "Megerősítésre vár: [új cím]. A régi cím marad érvényes, amíg meg nem erősíted", with Mégse and Új levél. Opening the confirmation link leads to a page saying the change succeeded, or that the link is no longer valid with a route back to Fiókom.

### Working groups, /szulo/munkacsoportok (US1.2, US2.1, US2.2)

Cards with name and description. The detail page shows the members, Csatlakozom or Kilépek, the group's events and its to-do tasks. A group with no coordinator shows a notice saying so.

### Events, /szulo/esemenyek and detail (US11.1 to US11.4, US12.1, US13.1)

The list shows upcoming events. Empty state: "Most nincs közelgő esemény." The detail has, in order: title and dates; notices (cup and plate, allergens) as an Info Wash callout; roles; the year's tale, collapsed; sign-up with a note; the checklist grouped by section, with Elvállalom and Kész on each task; the food sign-up with the eight categories, offers by category, and a form with a category select, free text and three tick boxes.

A task where timing matters adds an optional date and time field to its Elvállalom form, and the chosen time shows beside the person's name. A responsible person without an account shows as their typed name with no link and no profile.

### To-do list, /szulo/teendok (US14.2)

Cards with topic, title, owner, priority and status. Filters by owner, status and priority. Done and "not before" tasks are behind a toggle. Empty state: "Most nincs nyitott teendő." With a filter on: "Nincs találat", with a reset link.

### Library, /szulo/konyvtar (US16.1 to US16.3)

A book list with a search box, each showing where the book is. Detail has Kölcsönveszem with an optional date, Értesítést kérek, and for the owner Visszakaptam. "Új könyv" adds a book. Empty state: "Még nincs könyv a könyvtárban", with Új könyv.

### Information, /informacio (US10.1, US10.2)

A list of sections as accordions, each with an anchor so a duty card can link to it. Coordinators see Szerkesztés on the sections they own.

### Notifications

The existing screen, extended with the new kinds of notice. Each opens its item:

| Notice | Opens |
|---|---|
| Rota published, duty changed or flagged | Rota overview or the duty card |
| Weekend pick reminder; slot came to the weekend family | Duty card |
| Unpicked slot after Friday noon (administrator) | Unpicked weekend slots |
| Empty animal-care slots (daily list) | Animal-care sign-up |
| Fair-share reminder | Animal-care sign-up |
| Swap proposed, accepted, declined, withdrawn, expired or reversed | Swap inbox |
| Cancellation decided | Duty card |
| Event notice, sign-up deadline, unclaimed tasks | Event detail |
| Recurring duty due | My tasks or the duty card |
| To-do task assigned or changed | To-do task |
| Book back, or book to return before leaving | Library book |
| Leaving-related item flagged (administrator) | "Teendő a távozás miatt" list |

## Coordinator Screens

### My group, /szulo/munkacsoportok/[id]/kezeles (US2.4, US9.1, US9.4, US14.1, US12.2)

Tabs: Események, Teendők, Ismétlődő feladatok, Sablonok. Each is a list with a primary Új button and an edit form. An event's page has "Teendők hozzáadása", which picks open to-do tasks to add to its checklist (US14.3).

### Event form (coordinator and administrator) (US11.1, US11.3, US12.3, US13.1)

| Field | Default |
|---|---|
| Title, place | Empty, title required |
| Start and end date | Required; may span weeks |
| Scope | Community for an administrator; the group for a coordinator |
| Start from template | None |
| Summer event | Off; on includes "summer only" tasks |
| Notices | Empty |
| Roles | Empty; each is a name and a person |
| Year's tale | Empty |
| Food sign-up | Off |
| Sign-up deadline | Empty |
| Notice lead time | Two weeks for a big cleaning, otherwise none |
| Organiser's checklist | Empty; visible to organisers only |

Once every task is done, the organiser sees "Minden kész: jöhet a záró kör."

## Administrator Screens

### School calendar, /admin/tanev (US4.1, US4.2)

School-year dates, the changeover date, a list of break weeks to add and remove, and families with a Marad, Távozik or Új status. Flagged duties appear as a warning list.

### Rota planning, /admin/beosztas (US5.1, US5.2, US5.4)

A week-by-job table with Tervezet készítése (make a draft), an inline cell editor offering only valid families, a list of unfilled weeks and their reasons, and Közzététel. After publishing, a cell opens a "change duty" form that shows the impact on the weekend pick.

### Unpicked weekend slots (US6.2)

A list on the admin dashboard, with an assign action.

### Swaps, /admin/cserek (US8.2)

Applied swaps with their reasons and a reverse action.

### Templates, /admin/sablonok (US12.2, US12.3)

Template list; an editor with sections and tasks, each task with the optional fields, and Eltávolítás and Visszaállítás.

### Directory management, invitations, roles (US3.6, US3.7, US2.3)

The existing records screens, with Meghívó küldése on a parent and coordinator grants on a working group.

**Removing a parent or family (US3.6):** a confirmation page naming the person or family and listing what is affected: future duties, claimed tasks and borrowed books. Afterwards those items appear on a "Teendő a távozás miatt" list on the admin dashboard, with an action on each. In history a removed person shows as "korábbi tag".

**Invitation (US3.7):** the existing acceptance page. A used link or one older than 7 days shows "Ez a meghívó már nem érvényes. Kérj újat az adminisztrátortól." The admin's parent page shows the invitation's state and "Új meghívó".

### Cancellation decisions (US8.3)

The existing approvals screen, now showing the parent's reason. Approving leaves the duty unassigned and flagged for reassignment. Rejecting keeps it with the family. Either way the parent is notified, and the card's "Lemondás elbírálás alatt" notice ends.

### Settings and views

- Community events: the Események admin item, using the event form.
- Back-garden family: a select on the school calendar page (US14.1).
- Bottle-cleaning interval: a number on the school calendar page (US9.3).
- Failed emails: Értesítési hibák, listing the notice type, time and attempts without message content (US17.1).

## Screen States

Every list and detail screen has loading, empty, error, populated and partial states. Rules are in `interaction-spec.md`, and each list's own empty state is given with the screen. The working-group list: "Még nincs munkacsoport." Group members: "Még nincs tagja ennek a csoportnak."

## Story-to-Screen Index

| Stories | Screen |
|---|---|
| US1.1, US1.3 | Structure and access; no screen of their own |
| US1.2, US2.1, US2.2 | Working groups |
| US2.3 | Directory management, roles |
| US2.4, US9.1, US9.4, US14.1, US14.3 | My group |
| US3.1, US3.5 | Directory |
| US3.2, US3.3, US3.4 | My account |
| US3.6, US3.7 | Directory management, invitations |
| US4.1, US4.2 | School calendar |
| US5.1, US5.2, US5.4 | Rota planning |
| US5.3, US6.1, US9.2, US9.3, US10.1 | Duty card, My tasks |
| US6.2 | Notifications, Unpicked weekend slots |
| US7.1, US7.2 | Animal-care sign-up |
| US7.3 | Notifications, Animal-care sign-up |
| US8.1 | Rota overview |
| US8.2, US8.3 | Swap, Swaps, Cancellation decisions |
| US10.2 | Information |
| US11.1 to US11.4, US12.1, US13.1 | Events, Event form |
| US12.2, US12.3 | Templates, Event form |
| US14.2 | To-do list |
| US15.1 | My tasks |
| US16.1 to US16.3 | Library |
| US17.1 | Notifications, Failed emails |
| US18.1, US19.1 | No screen |
