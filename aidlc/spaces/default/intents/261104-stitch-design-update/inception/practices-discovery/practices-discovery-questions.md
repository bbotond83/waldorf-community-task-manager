# Practices Discovery Questions

Your team's working practices were already agreed earlier, so these questions only cover what the code and settings could not settle for this restyle.

## Q1. [Delivery] Build a thin first slice before the rest?

Build a thin end-to-end slice first? A walking skeleton is a minimal version that runs the whole way through, built first to prove the pieces connect before the real features go in. For this restyle that would mean doing the fonts and the shared look first, checking them, and only then restyling the screens one flow at a time. Your team rules say to do this when the plan enables it. How should this restyle go?

A. Yes: fonts and shared look first, you check them, then one flow at a time (recommended)
B. No: do everything as one piece and check it at the end
C. Fonts and shared look first, then all the screens together
X. Other (please specify)

[Answer]: A

## Q2. [Operations] How should the staging wording read?

Your stored rules say changes deploy to staging automatically, but nothing is set up for that yet, so this restyle will not appear on any staging site by itself. Which wording do you want to keep?

A. Keep the wording as the goal, and note that nothing is deployed yet (recommended)
B. Reword it so it says plainly that nothing deploys until a hosting project is linked
X. Other (please specify)

[Answer]: X. I have a local backend which allows me to run the app locally and test all the changes

## Q3. [Release] Which build-records rule do you keep?

One stored rule asks for a signed "attestation" (a signed proof of how a build was made) when a deployable build exists. The newer team text says the build records are deliberately unsigned and are not attestations. Which one is the rule you want?

A. Keep unsigned records only, and drop the older attestation rule (recommended)
B. Keep the older rule: sign builds with attestations once a deployable build exists
X. Other (please specify)

[Answer]: A

## Q4. [Quality] Extra check for the style file?

The browser tests catch broken layouts, but nothing checks the style file (`app/globals.css`) for mistakes on its own, such as a typo or unused rules. Do you want an extra check added for this change?

A. No: the existing tests are enough for this change (recommended)
B. Yes: add a style-file check as part of this work (more effort, earlier warnings)
X. Other (please specify)

[Answer]: B

## Q5. [Quality] Check that the new look matches the design?

The existing tests catch contrast and layout problems, but not whether a screen looks like the Stitch design. How should the look be checked?

A. You review each screen yourself against the Stitch design, with a screenshot from me (recommended)
B. Add automatic picture-comparison tests as well (more effort, can be fragile)
X. Other (please specify)

[Answer]: A

## Q6. [Engineering] Fix tool versions during this work?

Some tools (React, the accessibility checker, the browser test runner) are set to always take the newest version, so a check could start failing on its own. What do you want during this work?

A. Leave them as they are (recommended: changing them is outside a look-only change)
B. Fix their versions now so the results stay the same
X. Other (please specify)

[Answer]: B
