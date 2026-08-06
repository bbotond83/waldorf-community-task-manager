# type-check finding — code-generation

**Timestamp**: 2026-08-06T11:59:10Z
**Fire id**: 9ecc32a6
**Output path**: /Users/dev/Development/waldorf-community-task-manager/src/notifications/notification-service.ts
**Pass**: false

## Findings

```json
{
  "pass": false,
  "errors": [
    {
      "file": "src/notifications/notification-service.ts",
      "line": 16,
      "column": 290,
      "message": "Argument of type '(this: undefined, recipientId: string) => { jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; }[] | { jobId: string; status: \"sent\" | \"retry_scheduled\" | \"at_least_once\"; deliveryGuarantee: \"at_least_once\" | \"provider_idempotent\"; }[]' is not assignable to parameter of type '(this: undefined, value: string, index: number, array: string[]) => { jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; } | readonly { jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; }[]'.\n  Type '{ jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; }[] | { jobId: string; status: \"sent\" | \"retry_scheduled\" | \"at_least_once\"; deliveryGuarantee: \"at_least_once\" | \"provider_idempotent\"; }[]' is not assignable to type '{ jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; } | readonly { jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; }[]'.\n  Type '{ jobId: string; status: \"sent\" | \"retry_scheduled\" | \"at_least_once\"; deliveryGuarantee: \"at_least_once\" | \"provider_idempotent\"; }[]' is not assignable to type '{ jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; } | readonly { jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; }[]'.\n  Type '{ jobId: string; status: \"sent\" | \"retry_scheduled\" | \"at_least_once\"; deliveryGuarantee: \"at_least_once\" | \"provider_idempotent\"; }[]' is not assignable to type 'readonly { jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; }[]'.\n  Type '{ jobId: string; status: \"sent\" | \"retry_scheduled\" | \"at_least_once\"; deliveryGuarantee: \"at_least_once\" | \"provider_idempotent\"; }' is not assignable to type '{ jobId: string; status: \"queued\"; deliveryGuarantee: \"provider_idempotent\"; }'.\n  Types of property 'status' are incompatible.\n  Type '\"sent\" | \"retry_scheduled\" | \"at_least_once\"' is not assignable to type '\"queued\"'.\n  Type '\"sent\"' is not assignable to type '\"queued\"'."
    }
  ],
  "findings_count": 1
}
```
