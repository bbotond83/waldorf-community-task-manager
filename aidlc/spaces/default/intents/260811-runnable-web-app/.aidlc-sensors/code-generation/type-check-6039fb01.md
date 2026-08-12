# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:56:51Z
**Fire id**: 6039fb01
**Output path**: /Users/dev/Development/waldorf-community-task-manager/app/admin/feladatok/[id]/page.tsx
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "app/admin/feladatok/[id]/page.tsx",
      "line": 9,
      "column": 82,
      "message": "Type '\"/admin/feladatok/[id]\"' does not satisfy the constraint 'AppRoutes'."
    },
    {
      "file": "app/admin/feladatok/[id]/page.tsx",
      "line": 10,
      "column": 11,
      "message": "Property 'id' does not exist on type 'unknown'."
    },
    {
      "file": "app/admin/feladatok/[id]/page.tsx",
      "line": 24,
      "column": 24,
      "message": "Type '(Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }) | ... 9 more ... | { ...; }' is not assignable to type 'ApplicationResult<Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type 'ApplicationResult<Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"recovery\"; data: Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>; }'.\n  Types of property 'data' are incompatible.\n  Type 'Readonly<{ items: readonly Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>[]; }>' is missing the following properties from type 'Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>': id, title, state"
    }
  ],
  "findings_count": 3
}
```
