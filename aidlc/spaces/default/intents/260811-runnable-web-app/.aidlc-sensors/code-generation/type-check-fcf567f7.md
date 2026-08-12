# type-check finding — code-generation

**Timestamp**: 2026-08-12T11:24:33Z
**Fire id**: fcf567f7
**Output path**: /Users/dev/Development/waldorf-community-task-manager/tests/integration/runtime-shell.test.tsx
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 1,
      "column": 40,
      "message": "Cannot find module '@testing-library/react' or its corresponding type declarations."
    },
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 2,
      "column": 38,
      "message": "Cannot find module 'vitest' or its corresponding type declarations."
    },
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 18,
      "column": 8,
      "message": "Property 'children' is missing in type '{ profile: SyntheticProfile; }' but required in type 'AppShellProps'."
    },
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 19,
      "column": 9,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    },
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 19,
      "column": 28,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    },
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 30,
      "column": 8,
      "message": "Property 'children' is missing in type '{ profile: SyntheticProfile; }' but required in type 'AppShellProps'."
    },
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 31,
      "column": 9,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    },
    {
      "file": "tests/integration/runtime-shell.test.tsx",
      "line": 31,
      "column": 28,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    }
  ],
  "findings_count": 8
}
```
