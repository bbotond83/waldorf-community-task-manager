-- U2 identity and access: lockout, session removal and housekeeping (BR2.2, BR2.3, BR2.12, BR2.21).
-- These run before or outside a signed-in session. Each is executable only by the server's admin
-- access (the sign-in service's service-role key) and by the schema owner, and checks that itself (BR2.16).

-- True when the keyed email hash is locked: five wrong attempts within 15 minutes lock it for 15 minutes
-- counted from the fifth attempt (BR2.3). Attempts made while locked are never recorded, so the lock
-- cannot extend itself. Not callable by any role: only the functions below use it.
create or replace function identity_sign_in_locked(p_email_hash text) returns boolean
language sql stable set search_path from current
as $$
  select coalesce((
    select max(a.attempted_at) + interval '15 minutes'
      from sign_in_attempts a
     where a.email_hash = p_email_hash
       and a.attempted_at > now() - interval '30 minutes'
       and (select count(*) from sign_in_attempts b
             where b.email_hash = p_email_hash
               and b.attempted_at <= a.attempted_at
               and b.attempted_at > a.attempted_at - interval '15 minutes') >= 5
  ) > now(), false)
$$;

create or replace function sign_in_lockout_check(p_email_hash text) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    return platform_result('validation', null, 'email_hash_invalid');
  end if;
  return platform_result('success', null, case when identity_sign_in_locked(p_email_hash) then 'locked' else 'open' end);
end $$;

create or replace function sign_in_attempt_record(p_email_hash text) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    return platform_result('validation', null, 'email_hash_invalid');
  end if;
  if identity_sign_in_locked(p_email_hash) then
    return platform_result('success', null, 'locked');
  end if;
  insert into sign_in_attempts (email_hash) values (p_email_hash);
  delete from sign_in_attempts
   where id in (select id from sign_in_attempts where email_hash = p_email_hash
                 order by attempted_at desc, id offset 20);
  return platform_result('success', null, 'recorded');
end $$;

create or replace function sign_in_attempt_clear(p_email_hash text, p_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
    return platform_result('validation', null, 'email_hash_invalid');
  end if;
  delete from sign_in_attempts where email_hash = p_email_hash;
  -- The password hook counts per account: a reset or a success clears that count as well.
  if p_user_id is not null then
    delete from sign_in_attempts
     where email_hash = encode(sha256(convert_to('hook:' || p_user_id::text, 'UTF8')), 'hex');
  end if;
  return platform_result('success', null, 'cleared');
end $$;

-- Whether a password reset may be sent for an address (BR2.12): the sign-in service itself would also mail
-- a banned (deactivated) user, so the server asks first and sends only for 'active'. The answer is for the
-- server only and is never shown: the screen answers the same for every address.
create or replace function account_recovery_check(p_email text) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare v_status text;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  select a.status into v_status from accounts a where a.email = lower(btrim(coalesce(p_email, '')));
  return platform_result('success', null, coalesce(v_status, 'unknown'));
end $$;

-- Ends the sessions of a sign-in user: deletes the session rows (the refresh tokens follow). The sign-in
-- service's admin interface has no per-user session removal, so the server calls this function after a
-- deactivation or a password reset (BR2.2, BR2.12). A session to keep may be named.
create or replace function sessions_remove(p_user_id uuid, p_keep_session_id uuid default null) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_count integer;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_user_id is null then
    return platform_result('validation', null, 'user_missing');
  end if;
  delete from auth.sessions where user_id = p_user_id and (p_keep_session_id is null or id <> p_keep_session_id);
  get diagnostics v_count = row_count;
  return platform_result('success', null, 'removed') || jsonb_build_object('removed', v_count);
end $$;

-- Housekeeping (BR2.21, NFR6.7): safe to run at any time and repeatedly. Removes sign-in attempts older
-- than 15 minutes (and all but the newest 20 per hash), sign-in users tagged with an invitation id that
-- have no Account after an hour, and ended invitations 90 days after they ended.
create or replace function identity_housekeeping() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_attempts integer; v_pruned integer; v_users integer; v_invitations integer; v_expired integer;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  delete from sign_in_attempts where attempted_at <= now() - interval '15 minutes';
  get diagnostics v_attempts = row_count;
  delete from sign_in_attempts
   where id in (select id from (
           select id, row_number() over (partition by email_hash order by attempted_at desc, id) as position
             from sign_in_attempts) ranked where ranked.position > 20);
  get diagnostics v_pruned = row_count;
  delete from auth.users u
   where u.raw_app_meta_data ? 'invitation_id'
     and u.created_at < now() - interval '1 hour'
     and not exists (select 1 from accounts a where a.id = u.id);
  get diagnostics v_users = row_count;
  delete from invitations
   where status in ('accepted', 'revoked', 'replaced') and updated_at < now() - interval '90 days';
  get diagnostics v_invitations = row_count;
  select count(*) into v_expired from invitations where status = 'pending' and expires_at <= now();
  return platform_result('success', null, 'done') || jsonb_build_object(
    'attempts_removed', v_attempts + v_pruned, 'users_removed', v_users,
    'invitations_removed', v_invitations, 'invitations_expired', v_expired);
end $$;

revoke all on function
  identity_sign_in_locked(text),
  sign_in_lockout_check(text), sign_in_attempt_record(text), sign_in_attempt_clear(text, uuid),
  account_recovery_check(text), sessions_remove(uuid, uuid), identity_housekeeping()
  from public, anon, authenticated, service_role;
