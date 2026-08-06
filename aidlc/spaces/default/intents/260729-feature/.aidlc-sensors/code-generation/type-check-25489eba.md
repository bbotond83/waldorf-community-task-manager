# type-check finding — code-generation

**Timestamp**: 2026-08-06T11:26:56Z
**Fire id**: 25489eba
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/parent-experience/parent-experience-service.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/parent-experience/parent-experience-service.ts",
      "line": 14,
      "column": 97,
      "message": "Type '{ readAt?: string | undefined; id: string; title: string; link: string; }[]' is not assignable to type 'NotificationItem[]'.\n  Property 'recipientId' is missing in type '{ readAt?: string | undefined; id: string; title: string; link: string; }' but required in type 'NotificationItem'."
    }
  ],
  "findings_count": 1
}
```
