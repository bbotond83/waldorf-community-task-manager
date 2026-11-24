# Functional Design Questions — u8-animal-care-and-information

Unit 8 covers the daily animal-care slots (US7.1 to US7.3), giving up a slot (ADR-012, C19) and the information page (US10.1, US10.2). Most of it is settled by the requirements, the component catalogue, the contracts and the refined mockups. These questions cover only what those leave open.

Already settled and not asked again: two slots every weekday, breaks included, one family each (FR7.1); a family gives up its own slot up to 24 hours before and later can only swap (refined-mockups Q5, ADR-012); fair share counts only these slots and never blocks anyone (FR7.3, FR7.4); the sign-up page is a list of coming days with a fair-share panel (refined-mockups Q4).

## Q1. [Product owner] When each slot starts

Giving up a slot is allowed until 24 hours before it starts, and the empty-slot alert goes out "one day before". Both need a start time for the morning and the afternoon slot. The spreadsheet has no times.

A. An administrator sets the two start times once per school year, starting from 07:30 for the morning and 16:00 for the afternoon (Recommended: the times can change without a code change)
B. Fixed times in the app: 07:30 and 16:00
C. No times: the 24-hour limit counts from midnight at the start of the slot's day
X. Other (please specify)

[Answer]: A

## Q2. [Product owner] How the year's slots come into being

The slots must exist before families can sign up.

A. An administrator creates the slots for the whole school year with one button; pressing it again only adds days that are missing, for example after the school year is extended (Recommended)
B. The daily run keeps slots ready a fixed number of weeks ahead
X. Other (please specify)

[Answer]: A

## Q3. [Product owner] What counts towards a family's fair share

The page shows each family's count and the average, with part-year families counted in proportion to their weeks (AC7.2.1).

A. Every slot the family holds this school year counts, past and coming ones. The average is for a family present all year; a part-year family's own share is that average times its weeks divided by the year's weeks. The page shows each family's count beside its own share (Recommended)
B. Only slots already past count; coming slots are not counted until their day
X. Other (please specify)

[Answer]: A

## Q4. [Product owner] When the fair-share reminder goes out

A family below its share gets at most one reminder a month (AC7.2.2).

A. On the first weekday of each month, every family below its share on that day gets one reminder (Recommended: predictable, one date to test)
B. On any day a family is found below its share, at most once per calendar month
X. Other (please specify)

[Answer]: A

## Q5. [Product owner] Which slots the daily empty-slot message lists

Each day every family gets at most one message listing the empty slots of "the next three days" (AC7.3.1). Slots exist only on weekdays, but the daily run also runs at weekends.

A. Slots starting within the next three calendar days, counting from tomorrow; so on a Friday it lists Monday only, and the Saturday and Sunday runs list Monday and Tuesday again (Recommended: matches "three days before" literally)
B. Slots on the next three weekdays; so on a Friday it lists Monday to Wednesday, and nothing is sent at weekends
X. Other (please specify)

[Answer]: A

## Q6. [Product owner] Who edits which information section, and what each duty links to

The page starts with six sections (AC10.1.1). A coordinator edits their own group's sections and a super admin every section (FR10.2). A duty card links to its section (FR10.3).

A. Állatgondozás owns "Reggeli teendők", "Délutáni, esti teendők", "Locsolás", "Szombati takarítás" and "Állatok etetése és ápolása"; Nagytakarítás szervezése owns "Nagytakarítás". Morning slots link to "Reggeli teendők", afternoon slots to "Délutáni, esti teendők", the weekend animal-care duty to "Szombati takarítás" and "Állatok etetése és ápolása", and from March to October the morning and afternoon slots also link to "Locsolás" (Recommended)
B. As A, but no group owns a section: only super admins edit
X. Other (please specify)

[Answer]: A

## Q7. [Product owner] Adding and removing sections

US10.2 asks only for editing. Later units may want more sections, for example questions and answers.

A. Super admins can add a section, choose its owning group and hide or restore one; coordinators only edit the text of their own sections (Recommended)
B. The six sections are fixed; nobody adds or removes sections in this work
X. Other (please specify)

[Answer]: A

## Q8. [Designer] How the section text is written

The starting text has headings, numbered steps, bold warnings and a link (appendices A to D).

A. Simple formatting written in a plain text box: paragraphs, bulleted and numbered lists, bold and links, shown safely so no script can run (Recommended)
B. Plain text only, with line breaks kept
X. Other (please specify)

[Answer]: A
