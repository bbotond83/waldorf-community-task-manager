-- U2 identity and access, review repair (code review of 2026-10-20, Major 2).
--
-- The sign-in service lets any signed-in person change their own sign-in email through its own interface,
-- and with confirmations off the change takes effect at once. `accounts.email` is not updated, so the two
-- drift apart: a person could take the address of someone with a pending invitation (the invitee's account
-- creation then fails and no admin path fixes it), and password reset looks the old address up in
-- `accounts` and silently sends nothing. This service has no setting that turns self-service email change
-- off, so the table itself refuses it: every update that changes `email` or starts an email change
-- (`email_change`) on the sign-in user table is rejected.
--
-- Nothing in U2 changes a sign-in email. A later unit that must do so (an admin correcting an address)
-- sets the transaction-local setting `app.identity_email_change` to `allowed` in the same transaction,
-- and keeps `accounts.email` in step there. The sign-in service's own connection cannot set it, so its
-- self-service route stays closed.
--
-- The trigger is global to the database (one user table), so it is created only when the migration runs
-- against the default schema; worker schemas share it. The function is internal: no role can execute it.

create or replace function identity_block_email_change() returns trigger
language plpgsql security definer set search_path from current
as $$
begin
  if coalesce(current_setting('app.identity_email_change', true), '') = 'allowed' then
    return new;
  end if;
  raise exception 'identity: changing the sign-in email is not allowed' using errcode = '42501';
end $$;

revoke all on function identity_block_email_change() from public, anon, authenticated, service_role;

do $$
begin
  if current_schema() = 'public' then
    drop trigger if exists identity_block_email_change on auth.users;
    create trigger identity_block_email_change before update on auth.users
      for each row
      when (old.email is distinct from new.email
            or coalesce(old.email_change, '') is distinct from coalesce(new.email_change, ''))
      execute function identity_block_email_change();
  end if;
end $$;
