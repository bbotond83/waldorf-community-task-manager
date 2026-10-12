# External Dependency Map: Real backend, sign-in and seed data

A **Bolt** is one build pass over a piece of the work, ending in something that runs (see `bolt-plan.md`). The work is almost entirely contained in this repository; the outside items are:

| Item | Owner | Lead time | Blocks | If it slips |
|---|---|---|---|---|
| Docker Desktop installed and its licence checked | Owner | Hours (install); licence check by the owner | B1 and every later Bolt | Construction stops at B1; it does not start on mocks (Q3). |
| Node 24 available in the shell | Owner | Minutes (already installed via Homebrew) | All Bolts | Install or point the PATH at Node 24. |
| Supabase local images pulled from a container registry | Container registry (network) | Minutes on first start | B1 | Retry on a better connection; no workaround. |
| Removing `Ovis tábla v2.xlsx` from the whole git history and replacing the remote copy | Owner (manual; the agent must not do it) | One sitting by the owner | Nothing in the build; reported as an open item after B5 | The final report names it as outstanding and the privacy scan keeps the file untracked in the current tree. |
| GitHub Actions service container for the database in CI | GitHub | None | B1 (CI part) | Run database tests only locally until CI can start the service; report it as unverified. |

No approvals or hand-offs from other teams are involved. No real email or SMS provider is involved (out of scope).
