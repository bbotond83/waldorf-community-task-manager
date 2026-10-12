-- U1 platform: idempotency records and the audited-operation wrapper (BR3.3, BR3.6, BR3.7).
-- Schema-neutral and pinned like 20261012_platform_audit.sql.

-- The stored result of an operation, keyed by a caller-supplied key. Only a hash of the request and
-- the outcome state with a reference are kept: never a request body or personal data (NFR1.3).
create table idempotency_records (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  operation text not null check (char_length(operation) between 1 and 100 and operation ~ '^[a-z0-9_.:-]+$'),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  result_state text not null check (result_state in ('success', 'validation', 'denied', 'conflict', 'terminal')),
  result_reference uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint idempotency_records_account_operation_key unique (account_id, operation, idempotency_key),
  check (expires_at > created_at)
);
create index idempotency_records_expiry on idempotency_records (expires_at);
alter table idempotency_records enable row level security;
revoke all on idempotency_records from public, anon, authenticated, service_role;

create or replace function platform_result(p_state text, p_reference uuid default null, p_code text default null)
returns jsonb
language sql immutable set search_path from current
as $$ select jsonb_build_object('state', p_state, 'reference', p_reference, 'code', p_code) $$;

-- Looks up (account, operation, key) for the signed-in actor and serializes concurrent calls that
-- share the key, so two simultaneous submissions can never both act (NFR6.5).
-- Returns {status: new | replay | conflict, state, reference}.
create or replace function platform_idempotency_check(p_operation text, p_key text, p_fingerprint text)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare v_account uuid; v_row idempotency_records%rowtype;
begin
  v_account := platform_actor_account();
  perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|' || v_account::text || '|' || p_operation || '|' || p_key, 0));
  select * into v_row from idempotency_records
   where account_id = v_account and operation = p_operation and idempotency_key = p_key;
  if not found or v_row.expires_at <= now() then
    return jsonb_build_object('status', 'new');
  end if;
  if v_row.request_fingerprint = p_fingerprint then
    return jsonb_build_object('status', 'replay', 'state', v_row.result_state, 'reference', v_row.result_reference);
  end if;
  return jsonb_build_object('status', 'conflict');
end $$;

-- Stores a result for 24 hours. An expired row for the same key is replaced in the same statement
-- (insert on conflict), so an expired key behaves as new even before any cleanup ran (BR3.7).
-- A retryable result is never stored: the retry must act again (BR3.6).
create or replace function platform_idempotency_store(
  p_operation text, p_key text, p_fingerprint text, p_state text, p_reference uuid
) returns void
language plpgsql security definer set search_path from current
as $$
declare v_account uuid; v_count integer;
begin
  if p_state is null or p_state not in ('success', 'validation', 'denied', 'conflict', 'terminal') then
    raise exception 'platform: result state % is never stored', coalesce(p_state, 'null') using errcode = '22023';
  end if;
  v_account := platform_actor_account();
  insert into idempotency_records (account_id, operation, idempotency_key, request_fingerprint, result_state, result_reference)
  values (v_account, p_operation, p_key, p_fingerprint, p_state, p_reference)
  on conflict (account_id, operation, idempotency_key) do update
    set request_fingerprint = excluded.request_fingerprint,
        result_state = excluded.result_state,
        result_reference = excluded.result_reference,
        created_at = now(),
        expires_at = now() + interval '24 hours'
    where idempotency_records.expires_at <= now();
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'platform: an unexpired idempotency record already exists' using errcode = '23505';
  end if;
end $$;

-- Closes an operation: writes the audit event for a success or a denial (same transaction as the
-- change, BR3.3) and stores the result. Other states (validation, conflict, terminal) change
-- nothing and write no event, but are stored so a repeat returns the same answer.
create or replace function platform_finish_operation(
  p_operation text, p_key text, p_fingerprint text,
  p_action text, p_target_type text, p_target_id uuid, p_organization_id uuid, p_group_id uuid,
  p_state text, p_reference uuid, p_code text, p_details text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  if p_state in ('success', 'denied') then
    perform platform_audit_write(p_action, p_target_type, p_target_id, p_organization_id, p_group_id, p_state, p_details);
  end if;
  perform platform_idempotency_store(p_operation, p_key, p_fingerprint, p_state, p_reference);
  return platform_result(p_state, p_reference, p_code);
end $$;

-- Housekeeping: removes expired rows. Run by seed and reset, and by the operator on a hosted database.
create or replace function platform_cleanup_expired() returns integer
language plpgsql security definer set search_path from current
as $$
declare v_count integer;
begin
  delete from idempotency_records where expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function
  platform_result(text, uuid, text),
  platform_idempotency_check(text, text, text),
  platform_idempotency_store(text, text, text, text, uuid),
  platform_finish_operation(text, text, text, text, text, uuid, uuid, uuid, text, uuid, text, text),
  platform_cleanup_expired()
  from public, anon, authenticated, service_role;
grant execute on function platform_cleanup_expired() to service_role;

-- The first named audited change functions: placing and releasing a lifecycle hold (BR3.5).
-- They show the pattern later units follow: idempotency check, authorization, change, then
-- platform_finish_operation. Authorization here: a super administrator or the system actor.
create or replace function lifecycle_hold_place(
  p_idempotency_key text, p_target_type text, p_target_id uuid, p_organization_id uuid, p_reason text
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'lifecycle.hold_place';
  v_fingerprint text;
  v_check jsonb;
  v_id uuid;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_target_type, p_target_id::text, p_organization_id::text, p_reason), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  if p_target_type is null or p_target_id is null or p_organization_id is null then
    return platform_result('validation', null, 'hold_target_missing');
  end if;
  if platform_actor_role(p_organization_id) not in ('super_admin', 'system') then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'lifecycle.hold_place',
      p_target_type, p_target_id, p_organization_id, null, 'denied', null, 'authorization_denied', null);
  end if;
  if p_reason is null or char_length(p_reason) not between 1 and 300 or p_reason !~ '^[a-z0-9_.:-]+$' then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'lifecycle.hold_place',
      p_target_type, p_target_id, p_organization_id, null, 'validation', null, 'hold_reason_invalid', null);
  end if;
  if exists (select 1 from lifecycle_holds where target_type = p_target_type and target_id = p_target_id and released_at is null) then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'lifecycle.hold_place',
      p_target_type, p_target_id, p_organization_id, null, 'conflict', null, 'hold_already_open', null);
  end if;

  insert into lifecycle_holds (target_type, target_id, organization_id, reason, placed_by_account_id)
  values (p_target_type, p_target_id, p_organization_id, p_reason, platform_actor_account())
  returning id into v_id;
  return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'lifecycle.hold_place',
    p_target_type, p_target_id, p_organization_id, null, 'success', v_id, null, p_reason);
end $$;

create or replace function lifecycle_hold_release(
  p_idempotency_key text, p_hold_id uuid, p_expected_version integer
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'lifecycle.hold_release';
  v_fingerprint text;
  v_check jsonb;
  v_hold lifecycle_holds%rowtype;
  v_count integer;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_hold_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  select * into v_hold from lifecycle_holds where id = p_hold_id for update;
  if not found or p_expected_version is null then
    return platform_result('validation', null, 'hold_not_found');
  end if;
  if platform_actor_role(v_hold.organization_id) not in ('super_admin', 'system') then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'lifecycle.hold_release',
      v_hold.target_type, v_hold.target_id, v_hold.organization_id, null, 'denied', null, 'authorization_denied', null);
  end if;

  update lifecycle_holds set released_at = now()
   where id = p_hold_id and version = p_expected_version and released_at is null;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'lifecycle.hold_release',
      v_hold.target_type, v_hold.target_id, v_hold.organization_id, null, 'conflict', null, 'hold_version_stale', null);
  end if;
  return platform_finish_operation(c_operation, p_idempotency_key, v_fingerprint, 'lifecycle.hold_release',
    v_hold.target_type, v_hold.target_id, v_hold.organization_id, null, 'success', p_hold_id, null, 'hold_released');
end $$;

revoke all on function
  lifecycle_hold_place(text, text, uuid, uuid, text),
  lifecycle_hold_release(text, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function
  lifecycle_hold_place(text, text, uuid, uuid, text),
  lifecycle_hold_release(text, uuid, integer)
  to authenticated, service_role;
