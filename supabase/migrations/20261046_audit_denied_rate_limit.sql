-- Denied-call audit rate limit (follow-up B3; finding R-02 of the U1 review). Owner decision of 2026-10-27: at most
-- 20 denied audit events per account in any sliding 60 minutes. Forward-only: the merged files 20261012 and 20261013
-- are not edited. Schema-neutral like the files before it (every function pins its own schema with
-- `set search_path from current`).
--
-- Why: every refused call by a signed-in account writes one 'denied' audit event, so one account could fill the
-- append-only audit table by repeating a refused call. The limit applies in platform_audit_write, the single place
-- every audit event is written:
--   - only 'denied' events are limited; 'success' events are always written and are never counted;
--   - the system account (the operator command, the seed, the housekeeping) is exempt;
--   - the caller's result is unchanged: platform_finish_operation still returns and stores 'denied', so the call and
--     its replay answer exactly as before; only the event over the limit is not written;
--   - concurrent denied calls of the same account are serialized by a per-account transaction lock, so the count is
--     exact and never lets a 21st event through.
-- Suppressed denials are not counted anywhere; the first 20 in each hour remain as evidence.

-- 1. The count is served by a partial index on denied events only (additive; nothing else uses it).
create index if not exists audit_events_actor_denied
  on audit_events (actor_account_id, occurred_at desc) where outcome = 'denied';

-- 2. The audit write, limited. Same signature and return type as in 20261012. It returns null (and writes nothing)
-- when a denied event is over the limit; the only caller that writes denied events, platform_finish_operation, ignores
-- the return value (`perform`), and the direct callers pass 'success', which is never limited.
create or replace function platform_audit_write(
  p_action text, p_target_type text, p_target_id uuid, p_organization_id uuid,
  p_group_id uuid, p_outcome text, p_details text
) returns uuid
language plpgsql security definer set search_path from current
as $$
declare
  -- Owner decision of 2026-10-27 (follow-up B3): 20 denied events per account per sliding 60 minutes.
  c_denied_limit constant integer := 20;
  c_denied_window constant interval := interval '60 minutes';
  v_account uuid;
  v_recent integer;
  v_id uuid;
begin
  v_account := platform_actor_account();
  if p_outcome = 'denied' and v_account <> platform_system_account() then
    perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|audit-denied|' || v_account::text, 0));
    select count(*) into v_recent
      from audit_events
     where actor_account_id = v_account
       and outcome = 'denied'
       and occurred_at > now() - c_denied_window;
    if v_recent >= c_denied_limit then
      return null;
    end if;
  end if;
  insert into audit_events (actor_account_id, actor_role, action, target_type, target_id,
                            organization_id, group_id, outcome, details)
  values (v_account, platform_actor_role(p_organization_id), p_action, p_target_type,
          p_target_id, p_organization_id, p_group_id, p_outcome, p_details)
  returning id into v_id;
  return v_id;
end $$;

-- Function rights, restated unchanged: no application role may call the audit write directly.
revoke all on function platform_audit_write(text, text, uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
