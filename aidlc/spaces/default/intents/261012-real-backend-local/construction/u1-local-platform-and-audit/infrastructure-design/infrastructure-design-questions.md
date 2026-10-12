# Infrastructure Design Questions: U1 Local platform and audit

U1 has no hosted infrastructure (no deployment workflows exist or are added). Its infrastructure is the local stack on the owner's machine and the database service in CI.

## Q1. How is the local stack run?

A. With the Supabase command-line tool added to the repository as a pinned development dependency (no global install), using its standard local stack and configuration file.
B. With our own container composition file (Postgres, the sign-in service and a mail catcher defined by us), without the Supabase tool.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. With the Supabase command-line tool added to the repository as a pinned development dependency (no global install), using its standard local stack and configuration file.

## Q2. Which parts of the local stack are started?

A. Only what the application needs: Postgres, the sign-in service, the data API and the mail catcher. The data browser (Studio), storage, realtime and edge functions stay off.
B. Everything the standard stack starts, including the data browser, so the owner can look at the tables.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Only what the application needs: Postgres, the sign-in service, the data API and the mail catcher. The data browser (Studio), storage, realtime and edge functions stay off.

## Q3. Which network addresses may reach the local stack? (It uses well-known default keys, so exposure matters.)

A. Loopback only (127.0.0.1): only this machine can reach the database, the data API and the mail catcher.
B. Also the local network, so a phone on the same Wi-Fi can open the app and the mail catcher.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. Loopback only (127.0.0.1): only this machine can reach the database, the data API and the mail catcher.

## Q4. How does CI provide the database for the database-backed tests?

A. CI starts the same local stack with the same command and configuration (most faithful; slower start).
B. CI starts a Postgres service container only and a separate sign-in service container; lighter, but a second way of configuring the stack.
C. Not yet defined.
D. Not applicable.
X. Other (please specify)

[Answer]: A. CI starts the same local stack with the same command and configuration (most faithful; slower start).

## Consolidated Summary Confirmation

- Stack tool: the Supabase command-line tool as a pinned development dependency, standard local stack and configuration file.
- Services started: Postgres, sign-in service, data API and mail catcher only; Studio, storage, realtime and edge functions off.
- Network: loopback only (127.0.0.1).
- CI: the same stack with the same command and configuration.

Does this all look correct before I generate the artifacts?

Looks correct
Request changes

[Answer]: Looks correct
