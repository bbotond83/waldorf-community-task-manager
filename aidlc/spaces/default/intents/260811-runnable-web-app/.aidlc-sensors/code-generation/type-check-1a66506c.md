# type-check finding — code-generation

**Timestamp**: 2026-08-12T13:23:02Z
**Fire id**: 1a66506c
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/parent-web/synthetic-parent.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/parent-web/synthetic-parent.ts",
      "line": 242,
      "column": 51,
      "message": "Argument of type 'Readonly<{ isRead: true; id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; timing: \"7-day\"; providerStatus: \"simulated-sent\"; } | { ...; } | { ...; }>' is not assignable to parameter of type 'Readonly<{ id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; isRead: false; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }> | Readonly<...> | Readonly<...>'.\n  Type 'Readonly<{ isRead: true; id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }>' is not assignable to type 'Readonly<{ id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; isRead: false; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }> | Readonly<...> | Readonly<...>'.\n  Type 'Readonly<{ isRead: true; id: \"notice-7-day\"; title: \"Egy hét múlva: Lámpás ünnep előkészítése\"; link: \"/szulo/feladatok/duty-assigned\"; timing: \"7-day\"; providerStatus: \"simulated-sent\"; }>' is not assignable to type 'Readonly<{ id: \"notice-stale\"; title: \"Korábbi, már nem aktuális emlékeztető\"; link: \"/szulo/ertesitesek\"; isRead: true; timing: \"stale\"; providerStatus: \"simulated-cancelled\"; }>'.\n  Types of property 'id' are incompatible.\n  Type '\"notice-7-day\"' is not assignable to type '\"notice-stale\"'."
    },
    {
      "file": "src/parent-web/synthetic-parent.ts",
      "line": 345,
      "column": 3,
      "message": "Type 'Readonly<{ subjectId: \"parent-local\" | \"staff-local\" | \"group-admin-local\" | \"kindergarten-admin-local\" | \"super-admin-local\"; authorizationVersion: number; roles: string[]; scopes: Scope[]; runtimeMode: \"synthetic\"; isSynthetic: true; }>' is not assignable to type 'Readonly<{ subjectId: string; authorizationVersion: number; roles: readonly Role[]; scopes: readonly Scope[]; runtimeMode: RuntimeMode; isSynthetic: boolean; }>'.\n  Types of property 'roles' are incompatible.\n  Type 'string[]' is not assignable to type 'readonly Role[]'.\n  Type 'string' is not assignable to type 'Role'."
    }
  ],
  "findings_count": 2
}
```
