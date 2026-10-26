# Requirements: IPv6 coverage of the stack exposure check

## Intent analysis

`npm run db:start` starts the local Supabase stack. The Supabase CLI publishes the stack's ports on all network interfaces, and the stack's default keys are public knowledge, so anyone who can reach those ports can read and change the local database. The start command therefore checks, before it reports success, that none of the published ports answers on a non-loopback address of this machine. If one does, it refuses unless the owner acknowledges with `DB_ALLOW_ALL_INTERFACES=1` (or `--allow-all-interfaces`), meaning a host firewall rule keeps the ports closed to others.

Today the check only looks at the machine's IPv4 addresses. A machine with a LAN, unique-local or global IPv6 address passes the check while the ports are reachable on that address. The review of the platform unit (finding R-01, Major) recorded this gap. This work closes it.

Origin: finding R-01 of the U1 code review; group A of `follow-ups/minor-findings-plan.md`.

## Functional requirements

- **FR1** The exposure check covers IPv6 addresses.
  - **FR1.1** The list of addresses to probe includes every non-internal IPv6 address of the machine in addition to the non-internal IPv4 addresses. Internal (loopback) addresses of either family are never probed.
  - **FR1.2** A link-local IPv6 address (the `fe80::/10` range) is probed with its interface scope (`<address>%<interface name>`), because it cannot be reached without one. All other IPv6 addresses are probed as they are.
  - **FR1.3** When any published port answers on any listed address, IPv4 or IPv6, `db:start` refuses to report success and names the address and port, exactly as it does for IPv4 today.
  - **FR1.4** When no published port answers on any listed address, the check passes as before.
- **FR2** The owner's acknowledgement rule is unchanged.
  - **FR2.1** `DB_ALLOW_ALL_INTERFACES=1` (or `--allow-all-interfaces`) still turns the refusal into a warning that names the reachable addresses, and is set only by the owner when starting the stack; this change sets it nowhere. (The existing CI workflow sets it for its throwaway runner; that predates this change and stays as it is.)
- **FR3** Text matches behaviour.
  - **FR3.1** Any message, `--help` text, README line or unit code summary that says only IPv4 addresses are checked is updated to say that IPv4 and IPv6 are checked.

## Non-functional requirements

- **NFR1** Safety: the change never weakens the check. An address that was probed before is still probed; a probe error on one address never ends the check early or hides a reachable port on another.
- **NFR2** Determinism: the address list is built by a pure function over the operating system's interface table, tested with fictitious tables; no test depends on the real network of the machine it runs on.
- **NFR3** Performance: probes keep the existing 1500 ms timeout per address and port; the number of probes grows only with the number of IPv6 addresses.
- **NFR4** Quality gates: strict type check, lint, format check and the unit tests pass; line, branch and function coverage of production source stays at or above 80%.

## Constraints

- Node 24 on macOS and Linux (CI); `os.networkInterfaces()` reports the family as `"IPv4"` or `"IPv6"` and gives link-local addresses without a scope, so the scope is added from the interface name.
- No new dependency.
- The stack itself is not started by tests (they use injected test doubles); a real `db:start` run is the owner's.

## Assumptions

- Docker Desktop on macOS usually publishes ports on IPv4 only, so the gap is mostly latent on the owner's Mac. The check is still required because a Linux host or a different Docker setup may publish on IPv6.
- Probing a link-local address with the interface name as scope is accepted by Node's `net.connect` on macOS and Linux.

## Out of scope

- Changing how the CLI publishes ports, or binding the stack to loopback only.
- Probing other protocols, UDP ports or services outside `PUBLISHED_PORTS`.
- The other follow-up findings (groups B to F of the plan); each has its own branch.

## Open questions

None.
