-- U7 review fix R-05, narrowed: migration 62 required a decision time on every rejected request, but the target family's
-- decline is also `rejected` and names no decider. Only an approval, a reversal and an administrator's rejection must
-- say when they were decided.
begin;

alter table change_requests drop constraint change_requests_decided_at_check;
alter table change_requests add constraint change_requests_decided_at_check
  check (decided_at is not null
         or not (status in ('approved', 'reversed') or (status = 'rejected' and ended_reason = 'administrator_rejected')));

commit;
