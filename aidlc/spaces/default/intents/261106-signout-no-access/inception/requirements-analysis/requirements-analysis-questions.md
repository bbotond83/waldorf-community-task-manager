# Requirements Analysis Questions: Sign-out on the "Nincs jogosultság" screen

Context from the code scan: the parent, teacher and admin "Nincs jogosultság" screens already show a sign-out button and the Hungarian guidance. The standalone page `app/hozzaferes-megtagadva/page.tsx` does not, and no sign-in path found so far sends people there. The "no role" home page (`app/page.tsx`) already has a sign-out button too.

Please answer each question by choosing a letter, or pick X and write your own answer.

## Question 1: Which screen is the trap?

Which screen should get the fix?

A. Only the standalone page `app/hozzaferes-megtagadva/page.tsx`: add the sign-out button and the guidance text there.
B. The standalone page, and also check every role screen once in the running app before changing anything else.
C. Remove the standalone page and send people to the role screens instead.
D. Not sure yet: reproduce the stuck case in the running app first, then decide.
X. Other (please specify)

[Answer]: B

## Question 2: Explanation text

Which Hungarian explanation should the screen show?

A. Reuse the existing text already used on the other screens: "Ehhez a fiókhoz nem tartozik megfelelő profil. Kérje a csoport adminisztrátorát, hogy kapcsolja össze a fiókját, vagy jelentkezzen ki, és lépjen be másik fiókkal."
B. A shorter new text (I will propose the wording for your approval).
X. Other (please specify)

[Answer]: A

## Question 3: How to prove the fix

How should we check that the sign-out works?

A. An automated test that renders the screen and checks for the button and text, plus a manual check in the running app with a throwaway account.
B. Automated test only.
C. Manual check in the running app only.
X. Other (please specify)

[Answer]: A
