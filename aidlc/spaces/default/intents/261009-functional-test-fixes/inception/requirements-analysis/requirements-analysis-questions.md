# Requirements Analysis Questions: Functional test fixes

Most of the nine fixes are clear and will be written up as you stated them. Four decisions are needed first.

## Question 1: How should opening a notification work?

Today a notification card links straight to the task page (`/szulo/feladatok/<id>`), which is why the menu switches to "Feladatok" and the back link says "Vissza a feladatokhoz". You decided that opening a notification marks it read and that the user stays under Értesítések.

A. Keep opening the existing task page, but carry the notification context along (the address says it came from a notification): the menu keeps Értesítések highlighted, the back link says "Vissza az értesítésekhez" and goes to the notification list, and opening marks that notification read
B. Add a small notification page under Értesítések (title, timing, provider status) that marks it read when opened and has a "Feladat megnyitása" link to the task; the menu and back link stay on Értesítések throughout
X. Other (please specify)

[Answer]: A

## Question 2: What should a parent see on a task that already has a swap or cancellation request waiting?

Today the task page still offers both "Cserekérelem" and "Lemondási kérelem", shows no pending state, and a second submit is refused only after the fact. A swap and a cancellation can currently both be pending on the same task.

A. Show a clear pending notice ("Cserekérelem folyamatban" or "Lemondási kérelem folyamatban") and hide both request links while any request is pending; the request pages show the same notice instead of the form
B. Show the pending notice and hide only the link of the same type, so a parent could still file the other kind
X. Other (please specify)

[Answer]: A

## Question 3: What should happen to the "– Firefox próba" and "– mobil próba" demo entries?

They are copies of the demo tasks and notifications that exist only so the three browser test projects do not disturb each other; a real parent sees them in the lists. Removing them from the demo means the tests must create their own copies.

A. The demo shows only the normal entries; the per-browser copies are created only when the test server runs in test mode (a test-only switch), so tests keep their isolation
B. Keep the copies in the demo data, but filter them out of the lists a parent sees unless the test switch is on
X. Other (please specify)

[Answer]: A

## Question 4: How should the technical text be handled?

On normal screens a user sees "Korreláció corr-…" on Emlékeztetők, the test-scenario selectors ("Betelt kapacitás", "Átmeneti szolgáltatáshiba", "Végleges szolgáltatáshiba", "Forgatókönyv") on task and privacy pages, and "Verzió: 1" on task and record details. Tests use them to drive error cases.

A. Hide them from normal screens; in the local demo they stay available inside one collapsed section titled "Fejlesztői részletek" at the bottom of the page, so tests and developers still reach them
B. Remove them from the screens completely; tests drive the error cases through the page address instead (for example `?scenario=`), and the version and correlation values stay only in hidden form fields
X. Other (please specify)

[Answer]: A
