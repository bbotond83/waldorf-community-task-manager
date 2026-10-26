# Unit Test Instructions: IPv6 coverage of the stack exposure check

Test strategy: Minimal (one verifiable test per requirement, a happy-path floor for the component, existing suite stays green). Methodology: test-after.

## Framework and Setup

- Node test runner (`node --experimental-strip-types --test`) with Node 24 on the PATH (`export PATH=/opt/homebrew/opt/node@24/bin:$PATH` written before the `&&` chain).
- No Docker and no running stack are needed: the tests inject test doubles for the commands, the port probe and the interface list.

## Unit-Scoped Command

The command runs before any change (it already exists) and after the tests are written:

```
node --experimental-strip-types --test scripts/db/stack.test.ts
```

## Coverage Targets

At least 80% lines, branches and functions across all production source (`npm run test:coverage:domain` covers `scripts/`); the changed functions `externalAddressesFrom`, `formatEndpoint` and the refusal and warning paths are fully exercised.

## Mocking and Stubbing

- `externalAddressesFrom` is pure: tests pass fictitious interface tables (fake names such as `en0` and `lo0`, documentation and unique-local ranges); no test reads the real network of the machine.
- `startStack` and `findExposedPorts` use the existing `fakeDeps` helper; its `externalAddresses` double is changed per test to return a fake IPv6 address, and `isPortOpen` answers by address and port.

## Test Data

Fictitious addresses only: `192.168.0.10`, `2001:db8::10` (documentation range), `fd12:3456:789a::1` (unique-local), `fe80::1`, `febf::1`, `fec0::1`, `127.0.0.1`, `::1`. No real addresses.
