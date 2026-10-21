-- U2 identity and access, review repair (code review of 2026-10-20, Minor 5).
--
-- After a deactivation or reactivation the server bans or un-bans the sign-in user. When that call fails three
-- times the account status and the ban disagree and nothing used to retry it: a reactivated person stayed
-- unable to sign in. This function lists the accounts whose status and sign-in ban disagree, so the server's
-- housekeeping can repeat the ban or the ban-lift. The database already refuses a deactivated account whatever
-- the ban says (BR2.2), so an un-banned deactivated account is never a way in; the reconcile only closes the gap.
-- Executable only by the server's admin access. At most 100 accounts per call.

create or replace function identity_ban_mismatches() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  return platform_result('success', null, 'done') || jsonb_build_object('accounts', coalesce((
    select jsonb_agg(jsonb_build_object('account_id', m.id, 'status', m.status))
      from (select a.id, a.status
              from accounts a join auth.users u on u.id = a.id
             where (a.status = 'deactivated' and not coalesce(u.banned_until > now(), false))
                or (a.status = 'active' and coalesce(u.banned_until > now(), false))
             order by a.updated_at, a.id
             limit 100) m), '[]'::jsonb));
end $$;

revoke all on function identity_ban_mismatches() from public, anon, authenticated, service_role;
grant execute on function identity_ban_mismatches() to service_role;
