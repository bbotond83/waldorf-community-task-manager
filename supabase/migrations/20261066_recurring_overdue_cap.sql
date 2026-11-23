-- U9 owner decision (forward-only; 20261064 is applied and not edited): the overdue notice has an age cap. An occurrence
-- gets its overdue notice only from 3 to 60 days past its due date, the same 60 days after which the screens treat a row as
-- history (BR146.3). Without the cap a row skipped earlier for lack of recipients could be announced months later. The due
-- notice window (0 to 2 days) and everything else is unchanged. create or replace keeps the existing grants.

create or replace function recurring_due_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_moment timestamptz := coalesce(p_now, now());
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_row record;
  v_s recurring_schedules%rowtype;
  v_o record;
  v_recipients uuid[];
  v_n integer;
  v_days integer;
  v_kind text;
  v_created integer := 0;
  v_skipped integer := 0;
  v_local_created integer;
  v_local_skipped integer;
  v_failed uuid[] := '{}'::uuid[];
begin
  for v_row in
    select s.id, s.owner_kind, s.family_id
      from recurring_schedules s
     where s.is_active
       and (s.owner_kind <> 'group'
            or exists (select 1 from groups g where g.id = s.working_group_id and g.status = 'active'))
       and (s.owner_kind <> 'family'
            or exists (select 1 from families f
                        where f.id = s.family_id and f.status = 'active' and f.anonymized_at is null))
     order by s.id
  loop
    begin
      v_local_created := 0;
      v_local_skipped := 0;
      if v_row.owner_kind = 'family' then
        perform 1 from families f where f.id = v_row.family_id for update;
      end if;
      select * into v_s from recurring_schedules s where s.id = v_row.id for update;
      if not found or not v_s.is_active then
        continue;
      end if;
      -- A republished plan: the future occurrences nobody was told about follow the published water weeks (BR143.2).
      if v_s.interval_kind = 'rota_weeks' then
        perform 1 from recurring_occurrences o
         where o.schedule_id = v_s.id and o.status = 'open' and o.due_date > v_today
           and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null
         order by o.id for update;
        delete from recurring_occurrences o
         where o.schedule_id = v_s.id and o.status = 'open' and o.due_date > v_today
           and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null
           and not exists (select 1 from recurring_due_dates(v_s, v_today + 1, v_today + 14) d where d.due_date = o.due_date);
        update recurring_occurrences o set rota_week_id = d.rota_week_id
          from recurring_due_dates(v_s, v_today + 1, v_today + 14) d
         where o.schedule_id = v_s.id and o.due_date = d.due_date and o.status = 'open'
           and o.rota_week_id is distinct from d.rota_week_id;
      end if;
      v_local_created := recurring_create_occurrences(v_s.id, v_today, v_today + 14);
      for v_o in
        select o.id, o.due_date, o.due_notice_sent_at, o.overdue_notice_sent_at
          from recurring_occurrences o
         where o.schedule_id = v_s.id and o.status = 'open' and o.due_date <= v_today
           and ((v_today - o.due_date <= 2 and o.due_notice_sent_at is null and o.overdue_notice_sent_at is null)
                or (v_today - o.due_date between 3 and 60 and o.overdue_notice_sent_at is null))
         order by o.id
           for update
      loop
        v_days := v_today - v_o.due_date;
        v_kind := case when v_days <= 2 then 'recurring_due' else 'recurring_overdue' end;
        v_recipients := recurring_notice_recipients(v_s, v_o.due_date);
        if cardinality(v_recipients) = 0 then
          v_local_skipped := v_local_skipped + 1;
          continue;
        end if;
        v_n := notice_send(v_recipients, v_kind, 'recurring_duty', v_o.id,
                           v_kind || ':' || v_s.id::text || ':' || v_o.due_date::text);
        update recurring_occurrences set
          due_notice_sent_at = case when v_kind = 'recurring_due' then v_moment else due_notice_sent_at end,
          overdue_notice_sent_at = case when v_kind = 'recurring_overdue' then v_moment else overdue_notice_sent_at end
         where id = v_o.id;
        v_local_created := v_local_created + v_n;
      end loop;
      v_created := v_created + v_local_created;
      v_skipped := v_skipped + v_local_skipped;
    exception when others then
      v_failed := v_failed || v_row.id;
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped,
    'detail', case when cardinality(v_failed) = 0 then null
                   else 'failed: ' || array_to_string(v_failed, ', ') end);
end $$;

revoke all on function recurring_due_check(timestamptz) from public, anon, authenticated, service_role;
