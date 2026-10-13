-- U2 identity and access: the password-verification hook (owner decision on direct brute force, BR2.3).
-- The sign-in service calls this function, as its own database role, for every password attempt, whether it
-- comes from the app's sign-in screen or from a direct call to the service. Five wrong passwords within
-- 15 minutes lock the account for 15 minutes counted from the fifth attempt (the same rule as the screen's
-- lockout): while locked even the right password is rejected, attempts made while locked are not recorded
-- (the lock never extends itself), and a right password clears the count. The attempts are counted per
-- account under an advisory lock, so parallel attempts cannot all pass. The answer to a person is the same
-- generic failure as for a wrong password. The key is a SHA-256 of the account id, in the same table as the
-- screen's attempts (which use a keyed hash of the email, so the two never collide).

create or replace function password_verification_hook(event jsonb) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_user text := event ->> 'user_id';
  v_valid boolean := coalesce((event ->> 'valid')::boolean, false);
  v_key text;
begin
  -- Only the sign-in service's own database role (and the schema owner, for tests) may call this.
  if session_user not in ('supabase_auth_admin', 'postgres') then
    raise exception 'password_verification_hook: caller not allowed' using errcode = '42501';
  end if;
  if v_user is null then
    return jsonb_build_object('decision', 'continue');
  end if;
  v_key := encode(sha256(convert_to('hook:' || v_user, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|password_hook|' || v_key, 0));
  if identity_sign_in_locked(v_key) then
    return jsonb_build_object('decision', 'reject', 'message', 'Too many failed attempts');
  end if;
  if v_valid then
    delete from sign_in_attempts where email_hash = v_key;
  else
    insert into sign_in_attempts (email_hash) values (v_key);
    delete from sign_in_attempts
     where id in (select id from sign_in_attempts where email_hash = v_key
                   order by attempted_at desc, id offset 20);
  end if;
  return jsonb_build_object('decision', 'continue');
end $$;

revoke all on function password_verification_hook(jsonb) from public, anon, authenticated, service_role;
grant execute on function password_verification_hook(jsonb) to supabase_auth_admin;
do $$
begin
  execute format('grant usage on schema %I to supabase_auth_admin', current_schema());
end $$;
