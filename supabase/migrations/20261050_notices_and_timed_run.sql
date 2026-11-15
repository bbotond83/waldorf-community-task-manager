-- U5 of the Ovis tábla work: notices sent by email through a queue, the daily run with its registry and records, retry
-- rounds and the super admin's view of failures, and U5's removal step (W1 to W8 of functional-spec.md; BR50 to BR56;
-- contracts C1, C2, C8, C9 and C16). The file opens and commits its own transaction, as 20261049 does, because the
-- migration runner adds none: the registries, the new tables, the changed columns and every redefined function succeed
-- or fail together (NFR7.8).
--
-- Technical names stay: a community is `organizations`, a duty is a `task` row (so the contract's target type `duty` is
-- stored as `task`), a notice is a `notifications` row.
--
-- The design in one paragraph. notice_send only queues: it writes the notice and a queued email delivery inside the
-- caller's transaction and never contacts a mail server (outbox, BR50.7). The timed command (scripts/timed-run.ts)
-- sweeps expired claims, claims batches of deliveries with `skip locked`, sends them and records each outcome; the
-- address is looked up at claim time and never stored (BR51.2). The daily run is one function call that runs every
-- registered check in its own sub-block (BR52.2). The three registries (notice kinds, notice target types, timed
-- checks) are written by migration files only: no function writes them and no application role holds a right on
-- them (NFR3.7).
--
-- Facts functions. Every registered target type names a function `(target id, reading parent id, kind)` that returns
-- at most one row: the item's own name, its date (Budapest calendar date) or null, the path of its page, an optional
-- full title that replaces prefix and name (used for the state-dependent swap decisions and for rota_published), and an
-- optional detail line for the notice list. A facts function names no other person or family (BR50.4, BR55.2). The
-- kind is the third argument because the title of two kinds on one request differ (swap_requested and swap_decided).
--
-- Lock order (scalability-design.md, NFR5.7): family row, task rows ascending, assignment rows ascending, then job rows
-- ascending, then delivery rows ascending. Every registered check carries a `lock_step` (1 family rows, 2 task rows,
-- 3 assignment rows, 4 jobs, deliveries and other rows) and the run calls checks in ascending `lock_step`, then name.
--
-- Refusals are raised through U3R00 and rolled back (C1). The claim, the sweep, the outcome record and the run are
-- granted to the service role only; the notice list, mark read, the delivery-problems list and Try again to signed-in
-- accounts (each checks its caller); everything else is internal and granted to nobody.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The three registries. Written by migration files only (NFR3.7).
-- ---------------------------------------------------------------------------------------------------
create table notice_targets (
  target_type text primary key check (target_type ~ '^[a-z][a-z0-9_]{0,59}$'),
  facts_function text not null check (facts_function ~ '^[a-z][a-z0-9_]{0,62}$'),
  added_by text not null check (char_length(added_by) between 1 and 40)
);

create table notice_kinds (
  kind text primary key check (kind ~ '^[a-z][a-z0-9_]{0,59}$'),
  target_type text not null references notice_targets (target_type),
  title_prefix text not null check (char_length(title_prefix) between 1 and 80),
  label text not null check (char_length(label) between 1 and 80),
  added_by text not null check (char_length(added_by) between 1 and 40)
);

-- A check's function takes the run's moment and returns {created, skipped}. A check without a lock step is refused.
create table timed_check_registry (
  check_name text primary key check (check_name ~ '^[a-z][a-z0-9_]{0,79}$'),
  function_name text not null check (function_name ~ '^[a-z][a-z0-9_]{0,62}$'),
  run_kind text not null check (run_kind in ('daily', 'friday_noon')),
  is_active boolean not null default true,
  lock_step integer not null check (lock_step between 1 and 4),
  added_by text not null check (char_length(added_by) between 1 and 40)
);

insert into notice_targets (target_type, facts_function, added_by) values
  ('task', 'notice_facts_task', 'U5'),
  ('change_request', 'notice_facts_change_request', 'U5'),
  ('rota_plan', 'notice_facts_rota_plan', 'U5');

insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('sign_up_confirmed', 'task', 'Jelentkezés megerősítve:', 'Jelentkezés megerősítve', 'U5'),
  ('swap_requested', 'change_request', 'Cserekérés érkezett:', 'Cserekérés', 'U5'),
  ('swap_decided', 'change_request', 'Csere döntés:', 'Csere döntés', 'U5'),
  ('cancellation_decided', 'change_request', 'Lemondás döntés:', 'Lemondás döntés', 'U5'),
  ('place_removed', 'task', 'A helyed törölve:', 'A hely törölve', 'U5'),
  ('reminder_7d', 'task', 'Egy hét múlva:', 'Egy hét múlva emlékeztető', 'U5'),
  ('reminder_24h', 'task', 'Holnap:', 'Holnapi emlékeztető', 'U5'),
  ('rota_published', 'rota_plan', 'Közzétették a beosztást:', 'Beosztás közzétéve', 'U5');

insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('duty_reminders', 'duty_reminders_due_check', 'daily', true, 4, 'U5'),
  ('housekeeping', 'housekeeping_due_check', 'daily', true, 4, 'U5');

alter table notice_targets enable row level security;
alter table notice_kinds enable row level security;
alter table timed_check_registry enable row level security;

-- ---------------------------------------------------------------------------------------------------
-- 2. Notices: kinds and target types become registered values; the task link stays for task-based targets only.
-- ---------------------------------------------------------------------------------------------------
alter table notifications drop constraint notifications_kind_check;
alter table notifications drop constraint notifications_target_type_check;
alter table notifications drop constraint notifications_task_shape;
alter table notifications add constraint notifications_kind_fkey foreign key (kind) references notice_kinds (kind);
alter table notifications add constraint notifications_target_type_fkey
  foreign key (target_type) references notice_targets (target_type);
alter table notifications add constraint notifications_task_shape check (
  (target_type in ('task', 'change_request') and task_id is not null and task_starts_at is not null)
  or (target_type not in ('task', 'change_request') and task_id is null and task_starts_at is null));

-- ---------------------------------------------------------------------------------------------------
-- 3. Reminder jobs: a due date instead of a due moment, no simulated delivery states, no attempt count (BR53.2).
--    Every record is invented test data, so the simulated attempts are dropped and a job in a simulated retry state
--    becomes cancelled.
-- ---------------------------------------------------------------------------------------------------
alter table reminder_jobs add column due_on date;
update reminder_jobs set due_on = (scheduled_for at time zone 'Europe/Budapest')::date;
alter table reminder_jobs alter column due_on set not null;
update reminder_jobs set status = 'cancelled' where status in ('retryable', 'retrying', 'terminal');
alter table reminder_jobs drop constraint reminder_jobs_status_check;
alter table reminder_jobs add constraint reminder_jobs_status_check
  check (status in ('queued', 'sent', 'stale', 'cancelled', 'skipped'));
drop table reminder_attempts;
alter table reminder_jobs drop column scheduled_for;
alter table reminder_jobs drop column attempt;
drop index reminder_jobs_one_live;
create unique index reminder_jobs_one_live on reminder_jobs (task_id, threshold)
  where status not in ('stale', 'cancelled', 'skipped');
create index reminder_jobs_due on reminder_jobs (status, due_on);
create index reminder_jobs_organization on reminder_jobs (organization_id, status, due_on);

-- ---------------------------------------------------------------------------------------------------
-- 4. Email delivery, the daily run and their records. Row-level security on, no policy and no right for any
--    application role: the screen reads through its list function (NFR3.7). No table holds an address, a message
--    text or a mail server reply (NFR1.2).
-- ---------------------------------------------------------------------------------------------------
create table email_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  notice_id uuid not null unique references notifications (id) on delete cascade,
  parent_id uuid not null,
  kind text not null references notice_kinds (kind),
  target_type text not null references notice_targets (target_type),
  target_id uuid not null,
  -- The item's date at the time of sending, so the failure screen needs no facts call (security-design.md).
  item_date date,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'retry_wait', 'sent', 'failed', 'cancelled')),
  round integer not null default 1 check (round >= 1),
  attempts_in_round integer not null default 0 check (attempts_in_round between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_attempt_at timestamptz,
  finished_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'sending') = (claimed_at is not null)),
  check (status <> 'failed' or attempts_in_round = 3)
);
create trigger email_deliveries_touch_version before update on email_deliveries
  for each row execute function platform_touch_version();
-- The claim, the expiry sweep and the failure groups (performance-design.md).
create index email_deliveries_due on email_deliveries (status, next_attempt_at) where status in ('queued', 'retry_wait');
create index email_deliveries_claimed on email_deliveries (claimed_at) where status = 'sending';
create index email_deliveries_failed_group on email_deliveries (kind, target_type, target_id, status) where status = 'failed';
create index email_deliveries_parent on email_deliveries (parent_id);

create table email_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references email_deliveries (id) on delete cascade,
  round integer not null check (round >= 1),
  attempt_number integer not null check (attempt_number between 1 and 3),
  outcome text not null check (outcome in ('sent', 'failed')),
  reason_code text check (reason_code in ('mail_unavailable', 'mail_rejected', 'claim_expired')),
  occurred_at timestamptz not null default now(),
  check ((outcome = 'failed') = (reason_code is not null)),
  unique (delivery_id, round, attempt_number)
);

create table timed_runs (
  id uuid primary key default gen_random_uuid(),
  run_kind text not null check (run_kind in ('daily', 'friday_noon')),
  run_at timestamptz not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz
);
create index timed_runs_run_at on timed_runs (run_at);

create table timed_check_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references timed_runs (id) on delete cascade,
  check_name text not null,
  run_kind text not null check (run_kind in ('daily', 'friday_noon')),
  started_at timestamptz not null,
  outcome text not null check (outcome in ('success', 'failed', 'missing')),
  created integer not null default 0 check (created >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  -- The database error code only, never the error text, so no data from a row can leak into it.
  error_code text check (char_length(error_code) <= 10),
  check (outcome = 'failed' or error_code is null),
  unique (run_id, check_name)
);
create index timed_check_runs_started on timed_check_runs (started_at);

-- A check record is written once and never changed (state-transitions of functional-spec.md).
create or replace function timed_check_runs_guard_update() returns trigger
language plpgsql set search_path from current
as $$ begin
  raise exception 'timed_check_runs: a check record is never changed' using errcode = '23514';
end $$;
create trigger timed_check_runs_guard_update before update on timed_check_runs
  for each row execute function timed_check_runs_guard_update();

alter table email_deliveries enable row level security;
alter table email_attempts enable row level security;
alter table timed_runs enable row level security;
alter table timed_check_runs enable row level security;

revoke all on notice_targets, notice_kinds, timed_check_registry, email_deliveries, email_attempts, timed_runs,
  timed_check_runs from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 5. Facts functions: one per target type, reproducing today's titles (BR50.4). Internal.
-- ---------------------------------------------------------------------------------------------------
create or replace function notice_facts_task(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select t.title, (t.starts_at at time zone 'Europe/Budapest')::date, '/szulo/feladatok/' || t.id::text,
         null::text, null::text
    from tasks t
    join parents p on p.id = p_parent_id and p.organization_id = t.organization_id
   where t.id = p_target_id
$$;

create or replace function notice_facts_change_request(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select t.title, (t.starts_at at time zone 'Europe/Budapest')::date, '/szulo/cserek',
         case p_kind
           when 'swap_decided' then case
             when r.status in ('applied', 'approved') then 'Csere jóváhagyva: ' || t.title
             when r.status in ('rejected', 'withdrawn') then 'Csere elutasítva: ' || t.title end
           when 'cancellation_decided' then case
             when r.status = 'approved' then 'Lemondás jóváhagyva: ' || t.title
             when r.status = 'rejected' then 'Lemondás elutasítva: ' || t.title end
         end,
         null::text
    from change_requests r
    join tasks t on t.id = r.source_task_id
    join parents p on p.id = p_parent_id and p.organization_id = r.organization_id
   where r.id = p_target_id
$$;

-- The rota notice has no item name of its own: the title is a full title, and the detail line lists the weeks of the
-- reading parent's own family only (BR23.4, NFR10).
create or replace function notice_facts_rota_plan(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select 'Belső takarítás'::text, null::date, '/szulo/beosztas', 'Közzétették a beosztást',
         'Belső takarítás, a ti heteitek: ' || coalesce((
           select string_agg(to_char(w.week_start, 'YYYY. MM. DD.') || ' – ' || to_char(w.week_start + 6, 'MM. DD.'),
                             '; ' order by w.week_start)
             from rota_weeks w
             join parents pr on pr.id = p_parent_id and pr.family_id = w.family_id
            where w.plan_id = p.id and p.status = 'published'), '-')
    from rota_plans p
    join parents reader on reader.id = p_parent_id and reader.organization_id = p.organization_id
   where p.id = p_target_id
$$;

-- The title, item, date, path and detail of one notice for one reading parent, through the registry (BR50.4). A facts
-- function that raises, or an item that no longer exists, gives the prefix and "Törölt tétel" with no link, for that
-- notice only. The function name comes from the registry and is quoted; the search path is pinned.
create or replace function notice_describe(p_kind text, p_target_type text, p_target_id uuid, p_parent_id uuid)
returns table (title text, item_name text, item_date date, path text, detail text)
language plpgsql stable security definer set search_path from current
as $$
declare
  v_prefix text;
  v_function text;
  v_name text;
  v_date date;
  v_path text;
  v_full text;
  v_detail text;
  v_title text;
begin
  select k.title_prefix into v_prefix from notice_kinds k where k.kind = p_kind;
  select g.facts_function into v_function from notice_targets g where g.target_type = p_target_type;
  if v_function is not null then
    begin
      execute format('select f.item_name, f.item_date, f.path, f.full_title, f.detail from %I($1, $2, $3) f', v_function)
        into v_name, v_date, v_path, v_full, v_detail
        using p_target_id, p_parent_id, p_kind;
    exception when others then
      v_name := null;
    end;
  end if;
  if v_name is null then
    v_title := coalesce(v_prefix, 'Értesítés') || ' Törölt tétel';
    return query select v_title, null::text, null::date, null::text, null::text;
  else
    v_title := coalesce(v_full, v_prefix || ' ' || v_name);
    return query select v_title, v_name, v_date, v_path, v_detail;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. notice_send (C8): one notice and one queued email for each named parent who is active and has an active account
--    (BR50.1, BR50.6). Internal: called by feature functions inside their own transaction and by the checks of the daily
--    run. The community comes from the caller for a signed-in call and from the parent for a service-role call
--    (NFR3.2). A repeated once key creates nothing for that parent (BR50.2). A refusal is raised through U3R00 so the
--    caller's block rolls back (BR50.3). Nothing here contacts a mail server (BR50.7).
--    The core also takes a reminder job id, which is required for the two duty-reminder kinds and refused for every
--    other kind (a duty-reminder notice has a job and every other notice has none).
-- ---------------------------------------------------------------------------------------------------
create or replace function notice_send_core(
  p_parent_ids uuid[], p_kind text, p_target_type text, p_target_id uuid, p_once_key text, p_job_id uuid
) returns integer
language plpgsql security definer set search_path from current
as $$
declare
  v_kind notice_kinds%rowtype;
  v_system boolean := platform_caller_is_system();
  v_org uuid;
  v_task_id uuid;
  v_task_starts timestamptz;
  v_first uuid;
  v_date date;
  v_count integer := 0;
begin
  select * into v_kind from notice_kinds where kind = p_kind;
  if not found then
    perform platform_abort('validation', 'NOTICE_KIND_UNKNOWN');
  end if;
  if not exists (select 1 from notice_targets g where g.target_type = p_target_type) then
    perform platform_abort('validation', 'NOTICE_TARGET_UNKNOWN');
  end if;
  if p_parent_ids is null or cardinality(p_parent_ids) = 0 or p_target_id is null
     or p_once_key is null or char_length(p_once_key) not between 1 and 300
     or v_kind.target_type <> p_target_type
     or (p_kind in ('reminder_7d', 'reminder_24h')) <> (p_job_id is not null) then
    perform platform_abort('validation', 'NOTICE_REQUEST_INVALID');
  end if;

  if p_target_type = 'task' then
    select t.id, t.starts_at into v_task_id, v_task_starts from tasks t where t.id = p_target_id;
  elsif p_target_type = 'change_request' then
    select t.id, t.starts_at into v_task_id, v_task_starts
      from change_requests r join tasks t on t.id = r.source_task_id where r.id = p_target_id;
  end if;
  if p_target_type in ('task', 'change_request') and v_task_id is null then
    perform platform_abort('validation', 'NOTICE_REQUEST_INVALID');
  end if;

  if not v_system then
    v_org := identity_actor_organization();
  end if;

  select p.id into v_first
    from parents p join accounts a on a.id = p.account_id
   where p.id = any (p_parent_ids) and p.status = 'active' and a.status = 'active'
     and (v_system or p.organization_id = v_org)
   order by p.id
   limit 1;
  if v_first is null then
    return 0;
  end if;
  select d.item_date into v_date from notice_describe(p_kind, p_target_type, p_target_id, v_first) d;

  with eligible as (
    select p.id, p.organization_id
      from parents p join accounts a on a.id = p.account_id
     where p.id = any (p_parent_ids) and p.status = 'active' and a.status = 'active'
       and (v_system or p.organization_id = v_org)
     order by p.id
  ), created as (
    insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at,
                               reminder_job_id, dedupe_key)
    select e.organization_id, e.id, p_kind, p_target_type, p_target_id, v_task_id, v_task_starts, p_job_id,
           p_once_key || ':' || e.id::text
      from eligible e
    on conflict (dedupe_key) do nothing
    returning id, parent_id, organization_id
  ), queued as (
    insert into email_deliveries (organization_id, notice_id, parent_id, kind, target_type, target_id, item_date)
    select c.organization_id, c.id, c.parent_id, p_kind, p_target_type, p_target_id, v_date from created c
    returning 1
  )
  select count(*)::integer into v_count from queued;
  return v_count;
end $$;

create or replace function notice_send(
  p_parent_ids uuid[], p_kind text, p_target_type text, p_target_id uuid, p_once_key text
) returns integer
language plpgsql security definer set search_path from current
as $$
begin
  return notice_send_core(p_parent_ids, p_kind, p_target_type, p_target_id, p_once_key, null);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. The parent's list and mark-read. The title and link come from the registries and the facts functions; the
--    simulated delivery field is gone; the list is a page of the 50 newest (NFR9.1).
-- ---------------------------------------------------------------------------------------------------
create or replace function notification_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parent uuid;
  v_items jsonb := '[]'::jsonb;
  v_row record;
  v_d record;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_parent := notification_actor_parent();
  if v_parent is null then
    return platform_result('success', null, null) || jsonb_build_object('items', '[]'::jsonb);
  end if;
  for v_row in
    select n.id, n.kind, n.target_type, n.target_ref, n.read_at, n.created_at, n.task_starts_at,
           t.status as task_status, t.starts_at as task_start, j.status as job_status, r.status as request_status
      from notifications n
      left join tasks t on t.id = n.task_id
      left join reminder_jobs j on j.id = n.reminder_job_id
      left join change_requests r on n.target_type = 'change_request' and r.id = n.target_ref
     where n.parent_id = v_parent
     order by n.created_at desc, n.id desc
     limit 50
  loop
    select * into v_d from notice_describe(v_row.kind, v_row.target_type, v_row.target_ref, v_parent);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_row.id,
      'title', v_d.title,
      'text', v_d.detail,
      'link', v_d.path,
      'is_read', v_row.read_at is not null,
      'timing', case
        when v_row.kind in ('reminder_7d', 'reminder_24h') then case
          when v_row.job_status = 'cancelled' or v_row.task_status = 'cancelled' then 'cancelled'
          when v_row.job_status = 'stale' or v_row.task_start is distinct from v_row.task_starts_at then 'stale'
          when v_row.kind = 'reminder_7d' then '7-day'
          else '24-hour' end
        else case
          when v_row.task_status = 'cancelled' or (v_row.kind = 'swap_requested' and v_row.request_status = 'withdrawn')
            then 'cancelled'
          else 'within-threshold' end end,
      'created_at', v_row.created_at));
  end loop;
  return platform_result('success', null, null) || jsonb_build_object('items', v_items);
end $$;

create or replace function notification_mark_read(p_notification_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_parent uuid;
  v_row notifications%rowtype;
  v_d record;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_parent := notification_actor_parent();
  if v_parent is null or p_notification_id is null then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  update notifications set read_at = coalesce(read_at, now())
   where id = p_notification_id and parent_id = v_parent
  returning * into v_row;
  if not found then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select * into v_d from notice_describe(v_row.kind, v_row.target_type, v_row.target_ref, v_parent);
  return platform_result('success', v_row.id, null) || jsonb_build_object('link', v_d.path);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 8. The planner plans a due date (BR53.2). The week-ahead job is due seven days before the Budapest date of the
--    duty's start and the day-before job one day before. A job that was skipped for this start is never planned again
--    (BR53.4), and the planner no longer knows the simulated states. Recipient rules are those of 20261047.
-- ---------------------------------------------------------------------------------------------------
create or replace function reminder_plan(p_task_id uuid) returns void
language plpgsql security definer set search_path from current
as $$
declare
  v_task tasks%rowtype;
  v_setting jsonb;
  v_families uuid[];
  v_threshold text;
  v_days integer;
  v_job reminder_jobs%rowtype;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    return;
  end if;
  v_setting := reminder_setting_for(v_task.organization_id);

  update reminder_jobs set status = 'stale'
   where task_id = v_task.id and status not in ('stale', 'cancelled', 'skipped') and task_starts_at <> v_task.starts_at;

  if not ((v_setting->>'enabled')::boolean and v_task.status = 'open' and v_task.starts_at > now()) then
    update reminder_jobs set status = 'cancelled' where task_id = v_task.id and status = 'queued';
    return;
  end if;

  if v_setting->>'scope' = 'group' and v_task.group_id is null then
    select coalesce(array_agg(f.id order by f.id), '{}'::uuid[]) into v_families
      from families f
     where f.organization_id = v_task.organization_id and f.status = 'active';
  elsif v_setting->>'scope' = 'group' then
    select coalesce(array_agg(distinct f.id order by f.id), '{}'::uuid[]) into v_families
      from families f
      join parents p on p.family_id = f.id and p.status = 'active'
      join group_memberships m on m.parent_id = p.id
     where f.organization_id = v_task.organization_id and f.status = 'active'
       and m.group_id = v_task.group_id and m.status = 'active';
  else
    select coalesce(array_agg(distinct a.family_id order by a.family_id), '{}'::uuid[]) into v_families
      from assignments a join families f on f.id = a.family_id
     where a.task_id = v_task.id and a.status <> 'removed' and f.status = 'active';
  end if;

  foreach v_threshold in array array['7d', '24h'] loop
    v_days := case v_threshold when '7d' then 7 else 1 end;
    select * into v_job from reminder_jobs
     where task_id = v_task.id and threshold = v_threshold and status not in ('stale', 'cancelled', 'skipped');
    if not found then
      if cardinality(v_families) = 0 then
        continue;
      end if;
      -- A job that was skipped for this very start is not planned again.
      if exists (select 1 from reminder_jobs s
                  where s.task_id = v_task.id and s.threshold = v_threshold and s.status = 'skipped'
                    and s.task_starts_at = v_task.starts_at) then
        continue;
      end if;
      insert into reminder_jobs (organization_id, task_id, threshold, task_starts_at, due_on, correlation_id)
      values (v_task.organization_id, v_task.id, v_threshold, v_task.starts_at,
              (v_task.starts_at at time zone 'Europe/Budapest')::date - v_days,
              reminder_correlation(v_task.id, v_threshold, v_task.starts_at))
      returning * into v_job;
    end if;

    -- A job that was sent or ended never runs again: nobody is added to it (or brought back into it).
    if v_job.status = 'queued' then
      insert into reminder_recipients (organization_id, reminder_job_id, family_id)
      select v_task.organization_id, v_job.id, wanted from unnest(v_families) as wanted
      on conflict (reminder_job_id, family_id) do update set status = 'active', updated_at = now()
        where reminder_recipients.status <> 'active';
    end if;
    update reminder_recipients set status = 'removed', updated_at = now()
     where reminder_job_id = v_job.id and status = 'active' and not (family_id = any (v_families));

    if cardinality(v_families) = 0 and v_job.status = 'queued' then
      update reminder_jobs set status = 'cancelled' where id = v_job.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 9. The checks of U5: the duty reminders (W4) and housekeeping (BR52.8). Each takes the run's moment and returns
--    {created, skipped}. Internal: reached through the registry only.
-- ---------------------------------------------------------------------------------------------------

-- Sends each due job once to the parents of its active recipient families (BR53.3, BR53.4). Job rows are locked in
-- ascending id order, so two overlapping checks send each job once. The family and duty state is read without a lock
-- for update, so the check cannot invert the lock order.
create or replace function duty_reminders_due_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_today date := (p_now at time zone 'Europe/Budapest')::date;
  v_job reminder_jobs%rowtype;
  v_task tasks%rowtype;
  v_parents uuid[];
  v_created integer := 0;
  v_skipped integer := 0;
begin
  for v_job in
    select * from reminder_jobs j where j.status = 'queued' and j.due_on <= v_today order by j.id for update
  loop
    select * into v_task from tasks where id = v_job.task_id;
    if not found or v_task.status <> 'open' or v_task.starts_at <= p_now then
      update reminder_jobs set status = 'cancelled' where id = v_job.id;
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_task.starts_at <> v_job.task_starts_at then
      update reminder_jobs set status = 'stale' where id = v_job.id;
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_job.threshold = '7d' and exists (
         select 1 from reminder_jobs s
          where s.task_id = v_job.task_id and s.threshold = '24h' and s.status in ('queued', 'sent')
            and s.due_on <= v_today and s.task_starts_at = v_task.starts_at) then
      update reminder_jobs set status = 'skipped' where id = v_job.id;
      v_skipped := v_skipped + 1;
      continue;
    end if;
    select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into v_parents
      from reminder_recipients r
      join parents p on p.family_id = r.family_id and p.organization_id = v_job.organization_id
     where r.reminder_job_id = v_job.id and r.status = 'active' and p.status = 'active' and p.account_id is not null;
    if cardinality(v_parents) > 0 then
      perform notice_send_core(v_parents,
        case v_job.threshold when '7d' then 'reminder_7d' else 'reminder_24h' end,
        'task', v_job.task_id, 'reminder:' || v_job.id::text, v_job.id);
    end if;
    update reminder_jobs set status = 'sent' where id = v_job.id;
    v_created := v_created + 1;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end $$;

-- Prunes old records: deliveries and their tries 90 days after they finish, run and check records 30 days after the
-- run (BR52.8). No check reads these records to decide what is due: once keys and job states alone prevent a resend,
-- so pruning can never cause one (NFR1.7). Delivery rows are locked in ascending id order.
create or replace function housekeeping_due_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_ids uuid[];
  v_deliveries integer := 0;
  v_checks integer := 0;
  v_runs integer := 0;
begin
  select coalesce(array_agg(d.id order by d.id), '{}'::uuid[]) into v_ids
    from (select e.id from email_deliveries e
           where e.status in ('sent', 'failed', 'cancelled') and e.finished_at < p_now - interval '90 days'
           order by e.id for update) d;
  delete from email_deliveries where id = any (v_ids);
  get diagnostics v_deliveries = row_count;
  delete from timed_check_runs where started_at < p_now - interval '30 days';
  get diagnostics v_checks = row_count;
  delete from timed_runs r
   where r.run_at < p_now - interval '30 days'
     and not exists (select 1 from timed_check_runs c where c.run_id = r.id);
  get diagnostics v_runs = row_count;
  return jsonb_build_object('created', 0, 'skipped', 0, 'deleted_deliveries', v_deliveries,
                            'deleted_check_records', v_checks, 'deleted_runs', v_runs);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 10. The daily run (C9, BR52). Service role only. Fixes one moment, runs every active check of the run kind in its own
--     sub-block (a failure undoes only that check's changes and is recorded with the database error code; a registered
--     function that does not exist is recorded as missing), in ascending lock step then name.
-- ---------------------------------------------------------------------------------------------------
create or replace function timed_checks_run_system(p_run_kind text, p_moment timestamptz default null)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_run uuid;
  v_moment timestamptz;
  v_check record;
  v_started timestamptz;
  v_result jsonb;
  v_checks jsonb := '[]'::jsonb;
  v_outcome text;
  v_created integer;
  v_skipped integer;
  v_code text;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_run_kind is null or p_run_kind not in ('daily', 'friday_noon') then
    return platform_result('validation', null, 'run_kind_invalid');
  end if;
  v_moment := coalesce(p_moment, now());
  insert into timed_runs (run_kind, run_at) values (p_run_kind, v_moment) returning id into v_run;

  for v_check in
    select c.check_name, c.function_name from timed_check_registry c
     where c.run_kind = p_run_kind and c.is_active
     order by c.lock_step, c.check_name
  loop
    v_started := clock_timestamp();
    v_outcome := 'success';
    v_created := 0;
    v_skipped := 0;
    v_code := null;
    if to_regprocedure(format('%I(timestamptz)', v_check.function_name)) is null then
      v_outcome := 'missing';
    else
      begin
        execute format('select %I($1)', v_check.function_name) into v_result using v_moment;
        v_created := coalesce((v_result->>'created')::integer, 0);
        v_skipped := coalesce((v_result->>'skipped')::integer, 0);
      exception when others then
        v_outcome := 'failed';
        v_code := sqlstate;
        v_created := 0;
        v_skipped := 0;
      end;
    end if;
    insert into timed_check_runs (run_id, check_name, run_kind, started_at, outcome, created, skipped, error_code)
    values (v_run, v_check.check_name, p_run_kind, v_started, v_outcome, v_created, v_skipped, v_code);
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'check', v_check.check_name, 'outcome', v_outcome, 'created', v_created, 'skipped', v_skipped,
      'error_code', v_code));
  end loop;

  update timed_runs set finished_at = clock_timestamp() where id = v_run;
  return platform_result('success', v_run, null) || jsonb_build_object('checks', v_checks);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 11. The delivery pass: claim, sweep and record (BR51). Service role only.
-- ---------------------------------------------------------------------------------------------------

-- Records one try's outcome and moves the delivery on (BR51.3, BR51.5). Returns the new status, or null when the
-- record is ignored because the delivery is not sending, the round or try number do not match, or it is gone.
create or replace function email_delivery_record(
  p_delivery_id uuid, p_round integer, p_attempt integer, p_outcome text, p_reason text
) returns text
language plpgsql security definer set search_path from current
as $$
declare
  v_d email_deliveries%rowtype;
  v_status text;
begin
  select * into v_d from email_deliveries where id = p_delivery_id for update;
  if not found or v_d.status <> 'sending' or v_d.round <> p_round or v_d.attempts_in_round <> p_attempt then
    return null;
  end if;
  insert into email_attempts (delivery_id, round, attempt_number, outcome, reason_code)
  values (v_d.id, v_d.round, v_d.attempts_in_round, p_outcome, case when p_outcome = 'failed' then p_reason end);
  v_status := case
    when p_outcome = 'sent' then 'sent'
    when v_d.attempts_in_round < 3 then 'retry_wait'
    else 'failed' end;
  update email_deliveries
     set status = v_status,
         claimed_at = null,
         last_attempt_at = now(),
         next_attempt_at = case when v_status = 'retry_wait' then now() + interval '15 minutes' else next_attempt_at end,
         finished_at = case when v_status = 'retry_wait' then null else now() end
   where id = v_d.id;
  return v_status;
end $$;

-- Takes up to p_limit due emails, oldest first, skipping rows another pass holds (BR51.1). The try is counted in the
-- same statement as the claim. A parent who is no longer active, or has no active account, is cancelled and no address
-- is returned (BR51.2). The address is returned for this call only.
create or replace function notice_email_claim(p_limit integer default 10) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_d email_deliveries%rowtype;
  v_email text;
  v_describe record;
  v_items jsonb := '[]'::jsonb;
  v_cancelled integer := 0;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    return platform_result('validation', null, 'request_invalid');
  end if;
  for v_d in
    select * from email_deliveries d
     where d.status in ('queued', 'retry_wait') and d.next_attempt_at <= now()
     order by d.next_attempt_at, d.id
     limit p_limit
       for update skip locked
  loop
    select a.email into v_email
      from parents p join accounts a on a.id = p.account_id
     where p.id = v_d.parent_id and p.status = 'active' and a.status = 'active';
    if v_email is null then
      update email_deliveries set status = 'cancelled', finished_at = now() where id = v_d.id;
      v_cancelled := v_cancelled + 1;
      continue;
    end if;
    update email_deliveries set status = 'sending', claimed_at = now(), attempts_in_round = attempts_in_round + 1
     where id = v_d.id
    returning * into v_d;
    select * into v_describe from notice_describe(v_d.kind, v_d.target_type, v_d.target_id, v_d.parent_id);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'delivery_id', v_d.id, 'round', v_d.round, 'attempt', v_d.attempts_in_round, 'email', v_email,
      'title', v_describe.title, 'item_name', v_describe.item_name, 'item_date', v_describe.item_date,
      'path', v_describe.path));
  end loop;
  return platform_result('success', null, null)
    || jsonb_build_object('items', v_items, 'cancelled', v_cancelled);
end $$;

-- Records a try that was claimed more than 10 minutes ago and never recorded as failed with claim_expired (BR51.4).
-- Rows another pass holds are skipped.
create or replace function notice_email_sweep() returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_d email_deliveries%rowtype;
  v_swept integer := 0;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  for v_d in
    select * from email_deliveries d
     where d.status = 'sending' and d.claimed_at < now() - interval '10 minutes'
     order by d.id
       for update skip locked
  loop
    if email_delivery_record(v_d.id, v_d.round, v_d.attempts_in_round, 'failed', 'claim_expired') is not null then
      v_swept := v_swept + 1;
    end if;
  end loop;
  return platform_result('success', null, null) || jsonb_build_object('swept', v_swept);
end $$;

-- Records the outcome of one claimed try: sent, or failed with the reason class (BR51.3). A repeat, or a record for a
-- try that is no longer the claimed one, changes nothing and returns the current status (BR51.5). No address, text or
-- server reply is accepted.
create or replace function notice_email_record(
  p_delivery_id uuid, p_round integer, p_attempt integer, p_outcome text, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_status text;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  if p_delivery_id is null or p_round is null or p_attempt is null
     or p_outcome is null or p_outcome not in ('sent', 'failed')
     or (p_outcome = 'failed' and (p_reason is null or p_reason not in ('mail_unavailable', 'mail_rejected', 'claim_expired')))
     or (p_outcome = 'sent' and p_reason is not null) then
    return platform_result('validation', null, 'request_invalid');
  end if;
  v_status := email_delivery_record(p_delivery_id, p_round, p_attempt, p_outcome, p_reason);
  if v_status is null then
    return platform_result('success', p_delivery_id, 'ignored')
      || jsonb_build_object('status', (select d.status from email_deliveries d where d.id = p_delivery_id));
  end if;
  return platform_result('success', p_delivery_id, null) || jsonb_build_object('status', v_status);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. The super admin's view of failures and Try again (BR54). Signed-in, body-checked.
-- ---------------------------------------------------------------------------------------------------

-- Failed emails grouped by kind and item, and the failed or missing checks of the last 30 days. A group is titled by the
-- kind's label and the item's date from the delivery record, with no facts call; the result holds no address, no
-- parent name and no family name (BR54.2, NFR1.3). The try count of a delivery is the number of tries ever made.
create or replace function delivery_problems_list() returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_groups jsonb;
  v_checks jsonb;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  v_org := identity_actor_organization();
  if v_org is null or not has_super_scope(v_org) then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', g.kind, 'kind_label', g.label, 'target_type', g.target_type, 'target_id', g.target_id,
           'item_date', g.item_date,
           'title', g.label || coalesce(' – ' || to_char(g.item_date, 'YYYY. MM. DD.'), ''),
           'latest_try_at', g.latest, 'failed_count', g.n, 'reason', g.reason, 'deliveries', g.deliveries)
         order by g.latest desc, g.target_id), '[]'::jsonb)
    into v_groups
    from (
      select d.kind, k.label, d.target_type, d.target_id, max(d.item_date) as item_date,
             max(d.last_attempt_at) as latest, count(*)::integer as n,
             jsonb_agg(jsonb_build_object('id', d.id, 'try_count', (d.round - 1) * 3 + d.attempts_in_round)
                       order by d.id) as deliveries,
             (select a.reason_code from email_attempts a join email_deliveries x on x.id = a.delivery_id
               where x.organization_id = v_org and x.status = 'failed' and x.kind = d.kind
                 and x.target_type = d.target_type and x.target_id = d.target_id and a.outcome = 'failed'
               order by a.occurred_at desc, a.id desc limit 1) as reason
        from email_deliveries d join notice_kinds k on k.kind = d.kind
       where d.organization_id = v_org and d.status = 'failed'
       group by d.kind, k.label, d.target_type, d.target_id
    ) g;
  select coalesce(jsonb_agg(jsonb_build_object(
           'check_name', c.check_name, 'run_kind', c.run_kind, 'started_at', c.started_at,
           'outcome', c.outcome, 'error_code', c.error_code,
           'created', c.created, 'skipped', c.skipped) order by c.started_at desc, c.id), '[]'::jsonb)
    into v_checks
    from timed_check_runs c
   where c.outcome in ('failed', 'missing') and c.started_at >= now() - interval '30 days';
  return platform_result('success', null, null) || jsonb_build_object('groups', v_groups, 'checks', v_checks);
end $$;

-- Try again (BR54.3, BR54.4): the screen sends the group key and the (delivery id, try count) list it showed.
-- Deliveries are locked in ascending id order. No failed email in the group: REMINDER_NOT_RETRYABLE (two admins at
-- once give one new round). A listed email that is no longer failed, is not in the group, or has another try count:
-- REMINDER_STALE. Otherwise exactly the listed emails start a new round with no tries, due at once; a failure that
-- joined the group later is not listed and stays failed. No audit event, as before.
create or replace function delivery_retry(
  p_idempotency_key text, p_kind text, p_target_type text, p_target_id uuid, p_expected jsonb
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'delivery.retry';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_failed integer;
  v_changed integer;
  v_restarted integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(
    concat_ws('|', p_kind, p_target_type, p_target_id::text, p_expected::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    if v_org is null or not has_super_scope(v_org) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_expected is not null and jsonb_typeof(p_expected) = 'array' and jsonb_array_length(p_expected) > 5000 then
      perform platform_abort('validation', 'REMINDER_TOO_LARGE');
    end if;
    if p_kind is null or p_target_type is null or p_target_id is null or p_expected is null
       or jsonb_typeof(p_expected) <> 'array' or jsonb_array_length(p_expected) not between 1 and 5000
       or exists (select 1 from jsonb_array_elements(p_expected) e
                   where jsonb_typeof(e) <> 'object'
                      or coalesce(e->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                      or coalesce(e->>'try_count', '') !~ '^[0-9]{1,6}$') then
      perform platform_field_invalid('expected');
    end if;

    perform 1 from email_deliveries d
     where d.organization_id = v_org
       and ((d.kind = p_kind and d.target_type = p_target_type and d.target_id = p_target_id)
            or d.id in (select (e->>'id')::uuid from jsonb_array_elements(p_expected) e))
     order by d.id for update;

    select count(*) into v_failed from email_deliveries d
     where d.organization_id = v_org and d.kind = p_kind and d.target_type = p_target_type
       and d.target_id = p_target_id and d.status = 'failed';
    if v_failed = 0 then
      perform platform_abort('conflict', 'REMINDER_NOT_RETRYABLE');
    end if;

    select count(*) into v_changed
      from jsonb_to_recordset(p_expected) as x(id uuid, try_count integer)
      left join email_deliveries d
        on d.id = x.id and d.organization_id = v_org and d.status = 'failed'
       and d.kind = p_kind and d.target_type = p_target_type and d.target_id = p_target_id
     where d.id is null or (d.round - 1) * 3 + d.attempts_in_round <> x.try_count;
    if v_changed > 0 then
      perform platform_abort('invalidated', 'REMINDER_STALE');
    end if;

    update email_deliveries d
       set status = 'queued', round = d.round + 1, attempts_in_round = 0, next_attempt_at = now(),
           claimed_at = null, finished_at = null
     where d.id in (select (e->>'id')::uuid from jsonb_array_elements(p_expected) e);
    get diagnostics v_restarted = row_count;

    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_target_id);
    return platform_result('success', p_target_id, null) || jsonb_build_object('restarted', v_restarted);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 13. U5's removal step (C16, BR56.1). Internal; called from the lifecycle functions only. Preview counts, apply does the
--     same and returns the same counts. Order: the family row (locked by the caller first), the family's reminder job
--     rows ascending, then the parents' delivery rows ascending. An email already handed to the mail server may arrive
--     once; its late outcome finds no row and is ignored (BR51.5).
-- ---------------------------------------------------------------------------------------------------
create or replace function notifications_removal_parents(p_subject_kind text, p_subject_id uuid) returns uuid[]
language plpgsql stable security definer set search_path from current
as $$
begin
  if p_subject_kind = 'parent' then
    return array[p_subject_id];
  elsif p_subject_kind = 'family' then
    return coalesce((select array_agg(p.id order by p.id) from parents p where p.family_id = p_subject_id), '{}'::uuid[]);
  end if;
  raise exception 'notifications: unknown subject kind' using errcode = '22023';
end $$;

create or replace function notifications_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[] := notifications_removal_parents(p_subject_kind, p_subject_id);
begin
  return jsonb_build_object(
    'to_clear', (select count(*)::integer from notifications n where n.parent_id = any (v_parents)),
    'to_flag', case when p_subject_kind = 'family' then
      (select count(*)::integer from reminder_recipients r where r.family_id = p_subject_id and r.status = 'active')
      else 0 end);
end $$;

-- The shared body of the lifecycle hook (which deletes the recipient rows) and of the C16 apply (which marks them
-- removed). Returns the same counts as the preview.
create or replace function notifications_remove_core(p_family_id uuid, p_parent_ids uuid[], p_delete_recipients boolean)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_parents uuid[] := coalesce(p_parent_ids, '{}'::uuid[]);
  v_notices integer;
  v_flagged integer := 0;
begin
  if p_family_id is not null then
    perform 1 from reminder_jobs j
     where j.id in (select r.reminder_job_id from reminder_recipients r where r.family_id = p_family_id)
     order by j.id for update;
  end if;
  perform 1 from email_deliveries d where d.parent_id = any (v_parents) order by d.id for update;
  delete from email_deliveries where parent_id = any (v_parents);
  delete from notifications where parent_id = any (v_parents);
  get diagnostics v_notices = row_count;
  if p_family_id is not null then
    select count(*)::integer into v_flagged from reminder_recipients r
     where r.family_id = p_family_id and r.status = 'active';
    if p_delete_recipients then
      delete from reminder_recipients where family_id = p_family_id;
    else
      update reminder_recipients set status = 'removed', updated_at = now()
       where family_id = p_family_id and status = 'active';
    end if;
    update reminder_jobs j set status = 'cancelled'
     where j.status = 'queued'
       and exists (select 1 from reminder_recipients r where r.reminder_job_id = j.id and r.family_id = p_family_id)
       and not exists (select 1 from reminder_recipients r where r.reminder_job_id = j.id and r.status = 'active');
  end if;
  return jsonb_build_object('to_clear', v_notices, 'to_flag', v_flagged);
end $$;

create or replace function notifications_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
begin
  return notifications_remove_core(
    case when p_subject_kind = 'family' then p_subject_id end,
    notifications_removal_parents(p_subject_kind, p_subject_id), false);
end $$;

-- The lifecycle hook of 20261038 keeps its name and signature; it now clears the deliveries too, in lock order.
create or replace function notification_after_lifecycle(p_family_id uuid, p_parent_ids uuid[]) returns void
language plpgsql security definer set search_path from current
as $$
begin
  perform notifications_remove_core(p_family_id, p_parent_ids, true);
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 14. What goes: the simulated tick and the simulated reminder screen's functions (BR53.5), and the link helper that
--     the facts functions replace.
-- ---------------------------------------------------------------------------------------------------
drop function reminder_run_jobs(uuid);
drop function reminder_run_due(uuid);
drop function reminder_run_due_system(uuid);
drop function reminder_list(text);
drop function reminder_retry(text, uuid, integer);
drop function notification_link(text, uuid);

-- ---------------------------------------------------------------------------------------------------
-- 15. Function rights. Every new function starts with revoke all, then an explicit grant (C1).
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  timed_check_runs_guard_update(),
  notice_facts_task(uuid, uuid, text),
  notice_facts_change_request(uuid, uuid, text),
  notice_facts_rota_plan(uuid, uuid, text),
  notice_describe(text, text, uuid, uuid),
  notice_send_core(uuid[], text, text, uuid, text, uuid),
  notice_send(uuid[], text, text, uuid, text),
  duty_reminders_due_check(timestamptz),
  housekeeping_due_check(timestamptz),
  email_delivery_record(uuid, integer, integer, text, text),
  notifications_removal_parents(text, uuid),
  notifications_removal_preview(text, uuid),
  notifications_remove_core(uuid, uuid[], boolean),
  notifications_removal_apply(text, uuid),
  notification_after_lifecycle(uuid, uuid[]),
  reminder_plan(uuid)
  from public, anon, authenticated, service_role;

revoke all on function
  timed_checks_run_system(text, timestamptz),
  notice_email_claim(integer),
  notice_email_sweep(),
  notice_email_record(uuid, integer, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function
  timed_checks_run_system(text, timestamptz),
  notice_email_claim(integer),
  notice_email_sweep(),
  notice_email_record(uuid, integer, integer, text, text)
  to service_role;

revoke all on function
  notification_list(),
  notification_mark_read(uuid),
  delivery_problems_list(),
  delivery_retry(text, text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function
  notification_list(),
  notification_mark_read(uuid),
  delivery_problems_list(),
  delivery_retry(text, text, text, uuid, jsonb)
  to authenticated;

commit;
