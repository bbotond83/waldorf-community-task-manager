# type-check finding — code-generation

**Timestamp**: 2026-08-12T12:31:50Z
**Fire id**: 36132938
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/application/validation.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/application/validation.ts",
      "line": 22,
      "column": 7,
      "message": "Type 'ApplicationResult<{ toString: () => string; charAt: (pos: number) => string; charCodeAt: (index: number) => number; concat: (...strings: string[]) => string; indexOf: (searchString: string, position?: number | undefined) => number; ... 46 more ...; [Symbol.iterator]: () => StringIterator<...>; }>' is not assignable to type 'ApplicationResult<string>'.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type 'ApplicationResult<string>'.\n  Type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...' is not assignable to type 'Readonly<{ code: string; presentationCode: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").PresentationCode; focusTarget: string; announcement: import(\"/Users/dev/Development/waldorf-community-task-manager/src/application/contracts\").AnnouncementMode; evi...'. Two different types with this name exist, but they are unrelated.\n  Type 'Readonly<{ code: string; presentationCode: PresentationCode; focusTarget: string; announcement: AnnouncementMode; evidenceId?: string | undefined; }> & { ...; }' is not assignable to type '{ state: \"empty\"; data?: string | undefined; }'.\n  Types of property 'data' are incompatible.\n  Type 'Readonly<{ toString: () => string; charAt: (pos: number) => string; charCodeAt: (index: number) => number; concat: (...strings: string[]) => string; indexOf: (searchString: string, position?: number | undefined) => number; ... 46 more ...; [Symbol.iterator]: () => StringIterator<...>; }> | undefined' is not assignable to type 'string | undefined'.\n  Type 'Readonly<{ toString: () => string; charAt: (pos: number) => string; charCodeAt: (index: number) => number; concat: (...strings: string[]) => string; indexOf: (searchString: string, position?: number | undefined) => number; ... 46 more ...; [Symbol.iterator]: () => StringIterator<...>; }>' is not assignable to type 'string'."
    }
  ],
  "findings_count": 1
}
```
