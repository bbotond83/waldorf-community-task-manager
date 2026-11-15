# NFR Requirements Questions: u5-reminders-and-email

Most of U5's non-functional targets already follow from `requirements.md` (NFR1 to NFR11), the Unit's `functional-spec.md` and `rules.md`, and today's code (the existing mail adapter, the service-role-only entry points, 15-minute retry rounds of 3 tries). These two points are not settled anywhere yet. Contains no names or contact details.

## Q1. [Privacy] How long are finished email records and daily-run records kept?

Every email try and every daily-run check leaves a small record (status, time, error code; never the address or the text). Nothing deletes them today, so the tables only grow. The in-app notices are not affected.

A. Email records (sent, failed, cancelled) and their tries are deleted 90 days after they finish; run and check records 30 days after the run, by the daily run's own housekeeping (Recommended: long enough to answer "did that email go out?", then gone)
B. Deleted 30 days after they finish, all kinds
C. Kept until the parent is removed
X. Other (please specify)

[Answer]: A

## Q2. [Performance] How many emails may one delivery pass send, and how long may it run?

A pass takes the oldest due emails first (BR51.1 says at most 50). A rota publishing notice to about 20 families, or a reminder run, may queue 40 or more at once. The pass runs every 15 minutes and after each daily run.

A. At most 50 per pass, a pass stops starting new sends after 2 minutes, and what is left goes in the next pass (Recommended: a stuck mail server cannot hold the run, and 50 covers the whole community in one go)
B. At most 20 per pass and 1 minute
C. No time limit, only the 50 cap
X. Other (please specify)

[Answer]: A
