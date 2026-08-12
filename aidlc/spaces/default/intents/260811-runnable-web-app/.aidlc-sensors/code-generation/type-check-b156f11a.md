# type-check finding — code-generation

**Timestamp**: 2026-08-12T11:22:57Z
**Fire id**: b156f11a
**Output path**: /Users/dev/Development/waldorf-community-task-manager/app/layout.tsx
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "app/layout.tsx",
      "line": 1,
      "column": 31,
      "message": "Cannot find module 'next' or its corresponding type declarations."
    },
    {
      "file": "app/layout.tsx",
      "line": 2,
      "column": 32,
      "message": "Cannot find module 'react' or its corresponding type declarations."
    },
    {
      "file": "app/layout.tsx",
      "line": 12,
      "column": 5,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    },
    {
      "file": "app/layout.tsx",
      "line": 13,
      "column": 7,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    },
    {
      "file": "app/layout.tsx",
      "line": 13,
      "column": 23,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    },
    {
      "file": "app/layout.tsx",
      "line": 14,
      "column": 5,
      "message": "JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists."
    }
  ],
  "findings_count": 6
}
```
