# Performance Test Instructions: B3 denied-call audit rate limit

## Scope

No performance NFR with a numeric target exists for this change, so no load test is generated. NFR3 (bounded cost) is a structural requirement: the per-account count must be served by an index, not a scan of the whole audit table.

## How it is checked

- `tests/database/audit-denied-limit.test.ts` (test 7) asserts that the partial index `audit_events_actor_denied (actor_account_id, occurred_at desc) where outcome = 'denied'` exists in each schema.
- Optional manual check on the local stack, as the schema owner:

```sql
explain select count(*) from audit_events
 where actor_account_id = '00000000-0000-4000-8000-000000000001' and outcome = 'denied'
   and occurred_at > now() - interval '60 minutes';
```

The plan should use `audit_events_actor_denied` (on a small table Postgres may still choose a sequential scan; that is expected and not a defect).

## Contention

The per-account lock serializes only denied calls of the same account. Test 6 (25 simultaneous denials for one account) exercises the lock path. Calls of different accounts take different locks.
