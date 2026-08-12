# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:57:48Z
**Fire id**: 9e8f1141
**Output path**: /Users/dev/Development/waldorf-community-task-manager/app/admin/jovahagyasok/[id]/page.tsx
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "app/admin/jovahagyasok/[id]/page.tsx",
      "line": 10,
      "column": 86,
      "message": "Type '\"/admin/jovahagyasok/[id]\"' does not satisfy the constraint 'AppRoutes'."
    },
    {
      "file": "app/admin/jovahagyasok/[id]/page.tsx",
      "line": 11,
      "column": 11,
      "message": "Property 'id' does not exist on type 'unknown'."
    },
    {
      "file": "app/admin/jovahagyasok/[id]/page.tsx",
      "line": 22,
      "column": 7,
      "message": "Type '(Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }) | ... 7 more ... | (Readonly<...> & { ...; })' is not assignable to type 'ApplicationResult<Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type 'ApplicationResult<Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>>'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"recovery\"; data: Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>; }'.\n  Types of property 'data' are incompatible.\n  Type 'Readonly<{ items: readonly Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>[]; }>' is missing the following properties from type 'Readonly<{ id: string; title: string; state: string; version?: number | undefined; }>': id, title, state"
    }
  ],
  "findings_count": 3
}
```
