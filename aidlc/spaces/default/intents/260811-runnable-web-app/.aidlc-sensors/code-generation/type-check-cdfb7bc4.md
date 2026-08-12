# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:55:45Z
**Fire id**: cdfb7bc4
**Output path**: /Users/dev/Development/waldorf-community-task-manager/app/admin/nyilvantartasok/[id]/page.tsx
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "app/admin/nyilvantartasok/[id]/page.tsx",
      "line": 9,
      "column": 70,
      "message": "Type '\"/admin/nyilvantartasok/[id]\"' does not satisfy the constraint 'AppRoutes'."
    },
    {
      "file": "app/admin/nyilvantartasok/[id]/page.tsx",
      "line": 10,
      "column": 11,
      "message": "Property 'id' does not exist on type 'unknown'."
    }
  ],
  "findings_count": 2
}
```
