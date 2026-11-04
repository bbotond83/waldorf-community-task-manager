# Requirements Analysis Questions

Most of this restyle is already decided: the ten starred Stitch screens, Hungarian copy kept, accessibility kept, no new features, a CSS linter, five pinned tool versions, and an owner check of every screen by screenshot. These questions cover only what is still open.

## Q1. [Product] Which existing screen is "Saját vállalásaim"?

One of the ten starred Stitch screens is called "Saját vállalásaim" ("my commitments"). The app has no page with that name. Since this change adds no new features, it has to be shown on a screen that already exists. Which one?

A. The parent task list (`/szulo/feladatok`), looking at the parent's own signups (recommended: it is where a parent already sees their own tasks)
B. The swap requests page (`/szulo/cserek`)
C. Leave it out: it would need a new page, so it is outside a look-only change
X. Other (please specify)

[Answer]: A

## Q2. [Design] Which fonts should the app use?

The Stitch design uses Vollkorn (a warm serif) for headings and Karla (a clean sans-serif) for body text. Today the app uses the system font. Fonts will be stored inside the app, so nothing is loaded from Google.

A. Both: Vollkorn for headings and Karla for body text, as in the Stitch design (recommended)
B. Vollkorn for headings only; keep the system font for body text (less to download)
C. Karla only
X. Other (please specify)

[Answer]: A

## Q3. [Engineering] How should the font files be added?

Both options keep the files inside the app and work with the current security policy. The difference is how they are wired in.

A. With Next.js's built-in font loading (`next/font/local`): file names are generated, files are preloaded automatically (recommended)
B. With a plain `@font-face` rule and files under `public/fonts`: simpler to read, but no automatic preload
X. Other (please specify)

[Answer]: A

## Q4. [Design] What wins if a Stitch colour is too faint to read?

The automatic accessibility checks fail a colour pair when text contrast is below 4.5 to 1 (3 to 1 for large text and controls). The Stitch palette may contain pairs that fail this.

A. Accessibility wins: I darken just that colour until it passes and keep the rest of the Stitch look (recommended)
B. Keep the current app colour for that item
C. Ask you each time it happens
X. Other (please specify)

[Answer]: A

## Q5. [Product] What about screens Stitch does not show?

The app has more screens than the ten starred ones: notifications, swap requests, password reset, invitation, most admin pages and the teacher schedule. They will pick up the new fonts, colours and cards from the shared look. Should any of them be restyled on their own?

A. No: they only inherit the shared look; I restyle just the ten starred screens (recommended)
B. Yes, also restyle the screens on the main parent, teacher and admin paths after the ten are done
X. Other (please specify)

[Answer]: A

## Q6. [Engineering] Remove the unused profile-picker styles?

About 100 lines of the stylesheet style a profile-picker screen that no longer exists (nothing in the pages uses them). Removing them makes the restyle smaller and safer to change later.

A. Remove them in the first step, after checking that no page uses them (recommended)
B. Leave them alone
X. Other (please specify)

[Answer]: A
