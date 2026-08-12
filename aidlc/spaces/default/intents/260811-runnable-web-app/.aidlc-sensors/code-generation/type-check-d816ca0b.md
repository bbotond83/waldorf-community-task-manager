# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:55:47Z
**Fire id**: d816ca0b
**Output path**: /Users/dev/Development/waldorf-community-task-manager/app/admin/archivum/[id]/page.tsx
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "app/admin/archivum/[id]/page.tsx",
      "line": 9,
      "column": 85,
      "message": "Type '\"/admin/archivum/[id]\"' does not satisfy the constraint 'AppRoutes'."
    },
    {
      "file": "app/admin/archivum/[id]/page.tsx",
      "line": 10,
      "column": 11,
      "message": "Property 'id' does not exist on type 'unknown'."
    }
  ],
  "findings_count": 2
}
```
