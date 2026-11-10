# Practices Discovery Questions

How we should work on matching the app to the spreadsheet. Only what the code and history could not answer is asked here.

## Q1. [Release engineer] Where the real app will live

When the spreadsheet is retired, parents need to reach the app, and the one-off migration needs somewhere to load the real data. Today nothing is hosted online and this work's plan contains no hosting stages. Where will the real app and its data live?

A. Hosted online as part of this work (hosting stages are added to the plan) (Recommended if you want to retire the spreadsheet at the end of this work)
B. Hosted online as a separate piece of work afterwards; this work ends with everything working on your computer
C. Only on your computer for now; parents cannot use it yet
X. Other (please specify)

[Answer]: B

## Q2. [Release engineer] The standing "deploy to a test site" rule

A standing project rule says changes are always deployed to a test site automatically, but no test site exists, so the rule cannot be followed today. What should happen to it?

A. Reword it so it applies only once a hosted site exists (Recommended)
B. Keep it word for word for later
X. Other (please specify)

[Answer]: A

## Q3. [Delivery lead] Build a thin end-to-end slice first?

Build a thin end-to-end slice first? A walking skeleton is a minimal version that runs the whole way through, built first to prove the pieces connect before the real features go in. Here it would be one community-wide rota, from the database to the parent's screen, which you check before the rest is built.

A. Yes, build the thin slice first and let me check it (Recommended)
B. No, build the parts in the planned order
X. Other (please specify)

[Answer]: A

## Q4. [Delivery lead] Half-finished features while we build

Work merges to the main version in small steps, so some new features will be incomplete there for a while. Only you run the app today. Is that fine?

A. Yes, half-finished features may be visible on the main version while only I run it (Recommended)
B. No, keep unfinished features hidden until each is complete
X. Other (please specify)

[Answer]: A

## Q5. [Quality engineer] Testing the rules in the database

The 80% test-coverage figure measures application code and cannot see the rules stored in the database, where most of this work will live. Is a fixed list of must-have tests for every database rule an acceptable replacement there? The list covers: allowed, refused, out of reach, outdated screen, repeated click, and two people acting at once.

A. Yes, use the fixed list for database rules and keep 80% for application code (Recommended)
B. No, I want a different approach (please describe)
X. Other (please specify)

[Answer]: A

## Q6. [Security engineer] The anonymised workbook

The anonymised copy still contains some first names, two family names and a company's phone number that the anonymiser missed. It would be used to build and test the one-off migration script. What should happen before it is used?

A. Fix the anonymiser and re-run it, then you check it again before it is used (Recommended)
B. Use it as it is, because I have checked it
C. Don't use it; build and test against invented data only
X. Other (please specify)

[Answer]: A

## Q7. [Security engineer] Where the migration script is kept

The repository is public. Keeping the script there means the automatic checks run on it, but its code shows how the spreadsheet is laid out (column and sheet names, no personal data). Where should it be kept?

A. In the repository, tested only with an invented workbook (Recommended)
B. Private on my computer, outside the repository, without automatic checks
X. Other (please specify)

[Answer]: A

## Q8. [Designer] How new screens are designed

Your screenshot review compares each built screen with an approved design. Many screens in this work are new. What should they be compared against?

A. The mockups from the mockup stage later in this plan (Recommended)
B. Designs made in Stitch first, as in the restyle
X. Other (please specify)

[Answer]: B

## Q9. [Security engineer] What the checked anonymised copy is for

Follow-up: your answers point two ways. You chose to test the migration script only with an invented workbook (Q7), but you also chose to fix the anonymised copy so it can be used to build and test the script (Q6), and the gap analysis says "developed and tested against the anonymised copy only". An invented workbook cannot prove the script reads the real spreadsheet's layout. How should the two work together?

A. The automatic checks use the invented workbook in the repository; the owner-checked anonymised copy is used for trial runs on your computer only, to prove the script reads the real layout (Recommended)
B. The invented workbook only; the anonymised copy is not used at all
C. The anonymised copy only, on your computer; no invented workbook and no automatic checks on the script
X. Other (please specify)

[Answer]: A
