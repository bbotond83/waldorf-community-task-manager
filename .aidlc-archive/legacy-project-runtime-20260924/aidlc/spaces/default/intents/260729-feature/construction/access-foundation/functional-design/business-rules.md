# Business Rules

## Access Rules

- Server policy and RLS both must allow an action before data is returned.
- Role scope applies to every route, record query, and mutation.
- Revoked roles/scopes deny the next protected request and require reauthorization.

## Denial Rules

- UI displays `Nincs jogosultság`; API returns a generic authorization denial.
- Denials never disclose whether a protected record or field exists.
- Role/scope changes and privileged denials retain redacted audit evidence.
