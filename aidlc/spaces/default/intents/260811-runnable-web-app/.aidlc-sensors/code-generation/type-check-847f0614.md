# type-check finding — code-generation

**Timestamp**: 2026-08-12T14:49:53Z
**Fire id**: 847f0614
**Output path**: /Users/dev/Development/waldorf-community-task-manager/app/admin/import/page.tsx
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "app/admin/import/page.tsx",
      "line": 27,
      "column": 8,
      "message": "Property 'actions' is missing in type '{ preview: Readonly<{ id: string; fingerprint: string; changedRows: readonly string[]; conflicts: readonly Readonly<{ id: string; rowLabel: string; message: string; resolution?: \"keep-existing\" | \"use-import\" | undefined; }>[]; step: 1 | ... 5 more ... | 7; fixtureId: string; totalRows: number; state: \"preview\" | .....' but required in type 'Readonly<{ preview?: Readonly<{ id: string; fingerprint: string; changedRows: readonly string[]; conflicts: readonly Readonly<{ id: string; rowLabel: string; message: string; resolution?: \"keep-existing\" | \"use-import\" | undefined; }>[]; step: 1 | ... 5 more ... | 7; fixtureId: string; totalRows: number; state: \"pre...'."
    }
  ],
  "findings_count": 1
}
```
