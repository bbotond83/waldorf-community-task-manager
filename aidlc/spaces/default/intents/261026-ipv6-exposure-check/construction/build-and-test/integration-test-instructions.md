# Integration Test Instructions: IPv6 coverage of the stack exposure check

Strategy: Minimal. The change has no cross-unit boundary; its logic is covered by unit tests with injected test doubles.

## What crosses a boundary

`startStack` combines the address list, the port probe and the Docker and Supabase commands. The existing `startStack` tests in `scripts/db/stack.test.ts` already exercise that combination with doubles, and the new IPv6 tests add the refusal and the acknowledged-warning paths.

## Commands

| Scope | Command |
|---|---|
| This change | `node --experimental-strip-types --test scripts/db/stack.test.ts` |
| All tooling tests | `npm run test:scripts` |
| Whole stack-free suite | `npm test` |

## Real-environment check (owner)

With Docker Desktop running and the stack started by the owner, `npm run db:start` on a machine that has an IPv6 address confirms two things the tests cannot: that Node accepts `<link-local address>%<interface>` as the connect target, and that a published port reachable on an IPv6 address is refused. This stays outstanding evidence until the owner runs it.
