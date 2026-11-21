-- U13 of the Ovis tábla work: the community's lending library. Books with an owner, borrowing with an optional "until when"
-- date, the owner's return, "tell me when it is back" requests, the two book notices, the reminder to a leaving family,
-- and the functions later units call: the daily check, the removal block (C16) and the one-off load (C17)
-- (W1 to W8 of functional-spec.md; BR130 to BR140; contracts C1, C2, C3, C6, C8, C9, C16, C17, C20). The file opens and
-- commits its own transaction, as 20261048 to 20261056 do, because the migration runner adds none: the tables, the
-- registry rows and every function succeed or fail together (NFR7.5). It adds objects and rows only and changes no
-- existing row.
-- Technical names stay: a book is `books`, one borrowing is a `loans` row, a request to be told is a `return_watches`
-- row. A book belongs to the whole community, so it carries no working group.
--
-- Lock order of every command (scalability-design.md, NFR5.6): the book row first (the last step of the C1 order), then
-- its loan row, then its watch rows by ascending id. No command touches two books. A row-based command reads the row's
-- book id without a lock, locks the book, then locks the row and re-checks it. The removal block locks the family first,
-- then the affected books ascending, then loans and watches ascending. The daily check takes no book lock: this is an
-- accepted exception (BR136.2).
--
-- Refusals are raised through U3R00 and rolled back (C1). Every function pins its search path, starts with `revoke all`
-- and gets an explicit grant or none. The signed-in commands and reads are granted to `authenticated` and check their
-- caller themselves; the daily check, the removal pair, the load, the helpers and the notice facts function are internal.
begin;

-- ---------------------------------------------------------------------------------------------------
-- 1. The three tables. Row-level security on, no policy and no right for any application role: the screens read through
--    the read functions below (NFR1.4). Links to people are typed ids with no foreign key (ADR-001), checked inside the
--    functions, so the lifecycle of a parent or family never fails on a library row. No column links a book to a child,
--    a contact detail or a family's health (NFR1.2).
-- ---------------------------------------------------------------------------------------------------
create table books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  authors text not null check (char_length(authors) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  owner_parent_id uuid,
  owner_name text check (owner_name is null or char_length(owner_name) between 1 and 200),
  source_key text unique check (source_key is null or char_length(source_key) between 1 and 200),
  removed_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An owner is a parent or a typed name, never both (BR131.2, BR132.1).
  check (not (owner_parent_id is not null and owner_name is not null)),
  -- A typed owner name only ever comes with the spreadsheet row's key (BR140.1).
  check (owner_name is null or source_key is not null)
);
create index books_organization on books (organization_id, removed_at);
create index books_owner on books (owner_parent_id) where owner_parent_id is not null;
create trigger books_touch_version before update on books
  for each row execute function platform_touch_version();

create table loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  book_id uuid not null references books (id),
  borrower_parent_id uuid,
  borrower_family_id uuid,
  borrowed_at timestamptz not null default now(),
  until date,
  returned_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A return is not before the borrowing; the date is not before the day of borrowing. The "not before today, at most a
  -- year ahead" limit is checked by the function when the date is set, so the table never raises a raw check error for
  -- a date the rule accepted (BR133.3).
  check (returned_at is null or returned_at >= borrowed_at),
  check (until is null or until >= (borrowed_at at time zone 'Europe/Budapest')::date),
  -- The parent and the family are cleared together (BR139.1).
  check ((borrower_parent_id is null) = (borrower_family_id is null))
);
-- One open loan per book: the last guard if a lock were ever skipped (BR133.2). It also answers "who holds it".
create unique index loans_one_open_per_book on loans (book_id) where returned_at is null;
create index loans_book on loans (book_id, borrowed_at, id);
create index loans_borrower_family on loans (borrower_family_id) where borrower_family_id is not null;
create index loans_borrower_parent on loans (borrower_parent_id) where borrower_parent_id is not null;
create trigger loans_touch_version before update on loans
  for each row execute function platform_touch_version();

create table return_watches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  book_id uuid not null references books (id),
  parent_id uuid not null,
  created_at timestamptz not null default now(),
  unique (book_id, parent_id)
);
create index return_watches_parent on return_watches (parent_id);

alter table books enable row level security;
alter table loans enable row level security;
alter table return_watches enable row level security;
revoke all on books, loans, return_watches from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 2. The audit action list gains the five actions of BR139.2; every earlier action stays valid (NFR4.1).
-- ---------------------------------------------------------------------------------------------------
alter table audit_events drop constraint audit_events_action_check;
alter table audit_events add constraint audit_events_action_check check (action in (
  'role.grant', 'role.revoke', 'role.first_super_admin',
  'approval.approve', 'approval.reject',
  'import.commit',
  'lifecycle.anonymize', 'lifecycle.delete', 'lifecycle.hold_place', 'lifecycle.hold_release',
  'account.deactivate', 'account.reactivate',
  'rota.publish', 'rota.discard',
  'profile.sharing_changed', 'account.password_changed', 'account.email_change_requested',
  'account.email_changed', 'family.added', 'parent.added', 'parent.removed', 'invitation.sent',
  'family.standing_set', 'weekend_pick.assign',
  'event.cancelled', 'event.organiser_marked', 'event.organiser_unmarked', 'event.signup_removed',
  'event.offer_removed', 'event.name_cleared', 'event.removal_applied',
  'library_book_returned_by_admin', 'library_book_changed_by_admin', 'library_book_removed_by_admin',
  'library_owner_changed_by_admin', 'library_removal_applied'
));

-- ---------------------------------------------------------------------------------------------------
-- 3. The search helper (NFR9.1): lower case with the Hungarian accents folded, no extension. The matching uses `strpos`
--    on the folded text, so `%`, `_` and the escape character in the search text are plain characters.
-- ---------------------------------------------------------------------------------------------------
create or replace function library_fold(p_text text) returns text
language sql immutable set search_path from current
as $$
  select translate(lower(coalesce(p_text, '')),
                   'áéíóöőúüűÁÉÍÓÖŐÚÜŰ', 'aeiooouuuaeiooouuu')
$$;

-- ---------------------------------------------------------------------------------------------------
-- 4. The notice registries (C8): the book is something a notice can point to, and the two book notice kinds. The facts
--    function names the book and, for the reminder, the changeover date, and the path of its page; it never names a
--    holder, an owner, another watcher or a contact detail (BR137.1, NFR10.1). It answers for a removed book and for the
--    service role too, because a notice for a removed book is still delivered and its link answers as an unknown book.
-- ---------------------------------------------------------------------------------------------------
create or replace function book_notice_facts(p_target_id uuid, p_parent_id uuid, p_kind text)
returns table (item_name text, item_date date, path text, full_title text, detail text)
language sql stable security definer set search_path from current
as $$
  select b.title,
         case when p_kind = 'book_return_due'
              then changeover_date(school_year_for(school_today(), b.organization_id)) end,
         '/szulo/konyvtar/' || b.id::text,
         null::text,
         case when p_kind = 'book_return_due'
              then 'Az év váltásának napja: '
                   || to_char(changeover_date(school_year_for(school_today(), b.organization_id)), 'YYYY. MM. DD.') end
    from books b
    join parents p on p.id = p_parent_id and p.organization_id = b.organization_id
   where b.id = p_target_id
$$;

insert into notice_targets (target_type, facts_function, added_by) values
  ('book', 'book_notice_facts', 'u13-library');

insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values
  ('book_returned', 'book', 'Könyv visszaérkezett:', 'Könyv visszaérkezett', 'u13-library'),
  ('book_return_due', 'book', 'Könyvet vissza kell vinni:', 'Könyvet vissza kell vinni', 'u13-library');

-- ---------------------------------------------------------------------------------------------------
-- 5. Helpers. Internal. Each raises through U3R00, so the caller's block answers with the envelope.
-- ---------------------------------------------------------------------------------------------------

-- Is this parent an owner with rights: an active parent of an active family (BR134.1)? A typed name and a removed owner
-- have none.
create or replace function library_owner_has_rights(p_owner_parent_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce((select true from parents p join families f on f.id = p.family_id
                    where p.id = p_owner_parent_id and p.status = 'active' and f.status = 'active'), false)
$$;

-- Does the caller own this book with rights? The caller is the linked parent of the signed-in account.
create or replace function library_caller_owns(p_owner_parent_id uuid) returns boolean
language sql stable security definer set search_path from current
as $$
  select coalesce(p_owner_parent_id = identity_linked_parent(), false)
$$;

-- Why a named owner is not acceptable (BR131.2): null when the parent is an active parent of the community with an
-- account; 'unknown' for an id nobody has or of another community; 'not_a_parent' for a removed parent or one with no
-- account.
create or replace function library_owner_problem(p_parent_id uuid, p_org uuid) returns text
language plpgsql stable security definer set search_path from current
as $$
declare v_status text; v_account uuid; v_family_status text;
begin
  select p.status, p.account_id, f.status into v_status, v_account, v_family_status
    from parents p join families f on f.id = p.family_id
   where p.id = p_parent_id and p.organization_id = p_org;
  if not found then
    return 'unknown';
  end if;
  if v_status <> 'active' or v_family_status <> 'active' or v_account is null then
    return 'not_a_parent';
  end if;
  return null;
end $$;

-- The book of a community, locked, for a command of the owner or a super admin (BR132.1, BR132.2, BR134.1, BR134.2). A
-- missing book and a book out of reach give the same denied result for a caller who is not a super admin (NFR3.2). The
-- owner with rights and a super admin pass; for a return a super admin passes only when no owner has rights. A removed
-- book is refused after the authorization, so a caller who may not touch the book learns nothing about it.
create or replace function library_lock_book_for_owner(p_book_id uuid, p_org uuid, p_for_return boolean) returns books
language plpgsql security definer set search_path from current
as $$
declare v_book books%rowtype; v_owner boolean; v_super boolean;
begin
  if p_book_id is null then
    perform platform_abort('validation', 'request_invalid');
  end if;
  select * into v_book from books b where b.id = p_book_id and b.organization_id = p_org for update;
  if not found then
    perform platform_deny_unless_super(p_org);
    perform platform_field_invalid('book_id', 'not_found');
  end if;
  v_owner := library_caller_owns(v_book.owner_parent_id) and library_owner_has_rights(v_book.owner_parent_id);
  v_super := coalesce(has_super_scope(p_org), false);
  if not (v_owner or (v_super and (not p_for_return or not library_owner_has_rights(v_book.owner_parent_id)))) then
    perform platform_abort('denied', 'authorization_denied');
  end if;
  if v_book.removed_at is not null then
    perform platform_abort('conflict', 'BOOK_REMOVED');
  end if;
  return v_book;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 6. The reads (W2; BR130.1, BR130.2). Every signed-in reader of the community reads every book, a teacher included; a
--    caller outside the community, or with no session, gets a denied refusal and never an empty list (C1, NFR4.9). Each
--    read returns one document, so a page needs one call (NFR9.4). The people are built from the display functions of C6
--    only: no contact detail, no child, and a typed owner name without a link (NFR1.2). A removed person shows as
--    korábbi tag. A removed book is left out of the list and answers as if it did not exist.
-- ---------------------------------------------------------------------------------------------------
create or replace function library_list(p_search text default null) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_query text;
  v_items jsonb;
  v_parent uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  v_parent := identity_linked_parent();
  v_query := library_fold(btrim(coalesce(p_search, '')));
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'title', b.title, 'authors', b.authors, 'description', b.description, 'version', b.version,
           'owner', jsonb_build_object(
             'kind', case when b.owner_parent_id is not null then 'parent'
                          when b.owner_name is not null then 'typed' else 'former' end,
             'display_name', case when b.owner_parent_id is not null
                                  then coalesce(parent_display_name(b.owner_parent_id), 'korábbi tag')
                                  when b.owner_name is not null then b.owner_name
                                  else 'korábbi tag' end),
           'state', case when l.id is null then 'available' else 'borrowed' end,
           'holder_display_name', case when l.id is null then null
                                       else coalesce(parent_display_name(l.borrower_parent_id), 'korábbi tag') end,
           'until', l.until,
           'is_own', coalesce(v_parent is not null and b.owner_parent_id = v_parent, false),
           'borrowed_by_me', coalesce(v_parent is not null and l.borrower_parent_id = v_parent, false))
         order by library_fold(b.title), b.id), '[]'::jsonb)
    into v_items
    from books b
    left join loans l on l.book_id = b.id and l.returned_at is null
   where b.organization_id = v_org and b.removed_at is null
     and (v_query = ''
          or strpos(library_fold(b.title), v_query) > 0
          or strpos(library_fold(b.authors), v_query) > 0);
  return platform_result('success', null, null) || jsonb_build_object(
    'items', v_items,
    'caller', jsonb_build_object('can_add', v_parent is not null or coalesce(has_super_scope(v_org), false)));
end $$;

-- One book with where it is now, the holder, the caller's own request and what the caller may do (W2, W3, W4, W5, W7).
-- The loan carries its own version for the borrower's date change; the book carries the version for every other command.
create or replace function library_get(p_book_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_org uuid;
  v_book books%rowtype;
  v_loan loans%rowtype;
  v_parent uuid;
  v_family uuid;
  v_super boolean;
  v_owns boolean;
  v_rights boolean;
  v_open boolean;
  v_watching boolean;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if not can_read_community() then
    return platform_result('denied', null, 'authorization_denied');
  end if;
  v_org := identity_actor_organization();
  select * into v_book from books b where b.id = p_book_id and b.organization_id = v_org and b.removed_at is null;
  if not found then
    return platform_result('denied', null, 'BOOK_UNAVAILABLE');
  end if;
  v_parent := identity_linked_parent();
  v_family := (select p.family_id from parents p where p.id = v_parent);
  v_super := coalesce(has_super_scope(v_org), false);
  v_rights := library_owner_has_rights(v_book.owner_parent_id);
  v_owns := v_rights and v_parent is not null and v_book.owner_parent_id = v_parent;
  select * into v_loan from loans l where l.book_id = p_book_id and l.returned_at is null;
  v_open := found;
  v_watching := v_parent is not null
                and exists (select 1 from return_watches w where w.book_id = p_book_id and w.parent_id = v_parent);
  return platform_result('success', p_book_id, null) || jsonb_build_object(
    'book', jsonb_build_object(
      'id', v_book.id, 'title', v_book.title, 'authors', v_book.authors, 'description', v_book.description,
      'version', v_book.version,
      'owner', jsonb_build_object(
        'kind', case when v_book.owner_parent_id is not null then 'parent'
                     when v_book.owner_name is not null then 'typed' else 'former' end,
        'display_name', case when v_book.owner_parent_id is not null
                             then coalesce(parent_display_name(v_book.owner_parent_id), 'korábbi tag')
                             when v_book.owner_name is not null then v_book.owner_name
                             else 'korábbi tag' end),
      'state', case when v_open then 'borrowed' else 'available' end),
    'loan', case when v_open then jsonb_build_object(
        'id', v_loan.id, 'version', v_loan.version, 'until', v_loan.until, 'borrowed_at', v_loan.borrowed_at,
        'holder_display_name', coalesce(parent_display_name(v_loan.borrower_parent_id), 'korábbi tag'),
        'is_mine', coalesce(v_parent is not null and v_loan.borrower_parent_id = v_parent, false)) end,
    'caller', jsonb_build_object(
      'can_edit', coalesce(v_owns or v_super, false),
      'can_remove', coalesce((v_owns or v_super) and not v_open, false),
      'can_borrow', coalesce(v_parent is not null and v_family is not null and not v_open and not v_owns, false),
      'can_return', coalesce(v_open and (v_owns or (v_super and not v_rights)), false),
      'can_set_until', coalesce(v_open and v_parent is not null and v_loan.borrower_parent_id = v_parent, false),
      'can_watch', coalesce(v_open and v_parent is not null and not v_owns and not v_watching, false)
                   and v_loan.borrower_parent_id is distinct from v_parent
                   and v_book.owner_parent_id is distinct from v_parent,
      'is_watching', coalesce(v_watching, false)));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 7. Function rights (C1, NFR3.7). Every function starts with no rights. The two reads go to signed-in accounts and check
--    their caller themselves; the helpers and the notice facts function stay with nobody.
-- ---------------------------------------------------------------------------------------------------
revoke all on function
  library_fold(text),
  book_notice_facts(uuid, uuid, text),
  library_owner_has_rights(uuid),
  library_caller_owns(uuid),
  library_owner_problem(uuid, uuid),
  library_lock_book_for_owner(uuid, uuid, boolean),
  library_list(text),
  library_get(uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  library_list(text),
  library_get(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 8. Add, change and remove a book (W1, W7; BR131.1, BR131.2, BR132.1, BR132.2, BR139.2). A second press of Add with the
--    same key adds one book. A change by a super admin who is not the owner, a change of owner by a super admin and the
--    removal by a super admin who is not the owner write one audit entry in the same transaction, so a failed audit write
--    rolls the change back; the entry holds the action, the actor and the book id and never a title, an author, a name
--    or a description.
-- ---------------------------------------------------------------------------------------------------
create or replace function library_book_add(
  p_idempotency_key text, p_title text, p_authors text, p_description text, p_owner_parent_id uuid default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.book_add';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_title text;
  v_authors text;
  v_description text;
  v_owner uuid;
  v_problem text;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', coalesce(p_title, ''), coalesce(p_authors, ''),
    coalesce(p_description, ''), coalesce(p_owner_parent_id::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := identity_linked_parent();
    -- A parent, a group admin or a super admin adds; a teacher has none of these (BR131.1).
    if v_parent is null and not coalesce(has_super_scope(v_org), false) then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    v_title := btrim(coalesce(p_title, ''));
    v_authors := btrim(coalesce(p_authors, ''));
    v_description := nullif(btrim(coalesce(p_description, '')), '');
    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if char_length(v_authors) not between 1 and 200 then
      perform platform_field_invalid('authors');
    end if;
    if char_length(v_description) > 1000 then
      perform platform_field_invalid('description');
    end if;
    -- The owner is the adder unless another active parent is named (BR131.2).
    v_owner := coalesce(p_owner_parent_id, v_parent);
    if v_owner is null then
      perform platform_field_invalid('owner', 'unknown');
    end if;
    v_problem := library_owner_problem(v_owner, v_org);
    if v_problem is not null then
      perform platform_field_invalid('owner', v_problem);
    end if;
    insert into books (organization_id, title, authors, description, owner_parent_id)
    values (v_org, v_title, v_authors, v_description, v_owner)
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null) || jsonb_build_object('version', 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function library_book_change(
  p_idempotency_key text, p_book_id uuid, p_expected_version integer,
  p_title text, p_authors text, p_description text, p_owner_parent_id uuid default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.book_change';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_book books%rowtype;
  v_title text;
  v_authors text;
  v_description text;
  v_problem text;
  v_owner uuid;
  v_owner_changed boolean;
  v_by_owner boolean;
  v_super boolean;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_book_id::text, p_expected_version::text,
    coalesce(p_title, ''), coalesce(p_authors, ''), coalesce(p_description, ''),
    coalesce(p_owner_parent_id::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_book := library_lock_book_for_owner(p_book_id, v_org, false);
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_book.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_title := btrim(coalesce(p_title, ''));
    v_authors := btrim(coalesce(p_authors, ''));
    v_description := nullif(btrim(coalesce(p_description, '')), '');
    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if char_length(v_authors) not between 1 and 200 then
      perform platform_field_invalid('authors');
    end if;
    if char_length(v_description) > 1000 then
      perform platform_field_invalid('description');
    end if;
    v_owner := coalesce(p_owner_parent_id, v_book.owner_parent_id);
    v_owner_changed := p_owner_parent_id is not null and p_owner_parent_id is distinct from v_book.owner_parent_id;
    if v_owner_changed then
      v_problem := library_owner_problem(p_owner_parent_id, v_org);
      if v_problem is not null then
        perform platform_field_invalid('owner', v_problem);
      end if;
      -- A new owner who holds the book is refused; a watch of the new owner on it is deleted, so a holder or a watcher
      -- never becomes the owner (BR132.1). The loan row, then the watch rows, are locked ascending.
      perform 1 from loans l where l.book_id = p_book_id and l.returned_at is null for update;
      if exists (select 1 from loans l where l.book_id = p_book_id and l.returned_at is null
                    and l.borrower_parent_id = p_owner_parent_id) then
        perform platform_field_invalid('owner', 'holder_or_owner');
      end if;
      perform 1 from return_watches w where w.book_id = p_book_id and w.parent_id = p_owner_parent_id
       order by w.id for update;
      delete from return_watches where book_id = p_book_id and parent_id = p_owner_parent_id;
    end if;
    v_by_owner := library_caller_owns(v_book.owner_parent_id) and library_owner_has_rights(v_book.owner_parent_id);
    v_super := coalesce(has_super_scope(v_org), false);
    update books
       set title = v_title, authors = v_authors, description = v_description,
           owner_parent_id = v_owner,
           owner_name = case when v_owner_changed then null else owner_name end
     where id = p_book_id
     returning version into v_new_version;
    if v_owner_changed and v_super then
      perform platform_audit_write('library_owner_changed_by_admin', 'book', p_book_id, v_org, null, 'success', null);
    elsif not v_by_owner then
      perform platform_audit_write('library_book_changed_by_admin', 'book', p_book_id, v_org, null, 'success', null);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_book_id);
    return platform_result('success', p_book_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function library_book_remove(p_idempotency_key text, p_book_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.book_remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_book books%rowtype;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_book_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_book := library_lock_book_for_owner(p_book_id, v_org, false);
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_book.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    -- The loan row, then the watch rows, are locked ascending after the book.
    perform 1 from loans l where l.book_id = p_book_id and l.returned_at is null for update;
    if found then
      perform platform_abort('conflict', 'BOOK_ON_LOAN');
    end if;
    perform 1 from return_watches w where w.book_id = p_book_id order by w.id for update;
    delete from return_watches where book_id = p_book_id;
    update books set removed_at = now() where id = p_book_id returning version into v_new_version;
    if not (library_caller_owns(v_book.owner_parent_id) and library_owner_has_rights(v_book.owner_parent_id)) then
      perform platform_audit_write('library_book_removed_by_admin', 'book', p_book_id, v_org, null, 'success', null);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_book_id);
    return platform_result('success', p_book_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  library_book_add(text, text, text, text, uuid),
  library_book_change(text, uuid, integer, text, text, text, uuid),
  library_book_remove(text, uuid, integer)
  from public, anon, authenticated, service_role;

grant execute on function
  library_book_add(text, text, text, text, uuid),
  library_book_change(text, uuid, integer, text, text, text, uuid),
  library_book_remove(text, uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 9. Borrow, set the date, return and the watches (W3, W4, W5; BR133.1 to BR135.2). The book row is locked first in every
--    command, then its loan row, then its watch rows ascending. The return sends the watchers' notice and ends their
--    requests in the same transaction: a raised error rolls all of it back, a failed email later never does (BR135.2).
-- ---------------------------------------------------------------------------------------------------

-- Why an "until when" date is not acceptable (BR133.3): not before today and not more than one year ahead, in Budapest
-- dates. Null when the date is empty or inside the range.
create or replace function library_until_problem(p_until date) returns text
language sql stable set search_path from current
as $$
  select case when p_until is null then null
              when p_until < school_today() then 'before_today'
              when p_until > school_today() + 365 then 'too_far' end
$$;

create or replace function library_book_borrow(
  p_idempotency_key text, p_book_id uuid, p_expected_version integer, p_until date default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.book_borrow';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_family uuid;
  v_book books%rowtype;
  v_problem text;
  v_loan_id uuid;
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_book_id::text, p_expected_version::text,
    coalesce(p_until::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := identity_linked_parent();
    v_family := (select p.family_id from parents p where p.id = v_parent);
    -- A teacher, or a caller with no family, is refused as for every family-based command (BR133.1).
    if v_parent is null or v_family is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_book_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_book from books b where b.id = p_book_id and b.organization_id = v_org for update;
    if not found then
      perform platform_field_invalid('book', 'not_found');
    end if;
    if v_book.removed_at is not null then
      perform platform_abort('conflict', 'BOOK_REMOVED');
    end if;
    if v_book.owner_parent_id is not distinct from v_parent then
      perform platform_field_invalid('book', 'own_book');
    end if;
    -- Read under the book lock, so the second of two borrowers at once finds the first one's loan (BR133.2).
    perform 1 from loans l where l.book_id = p_book_id and l.returned_at is null for update;
    if found then
      perform platform_abort('conflict', 'BOOK_NOT_AVAILABLE');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_book.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_problem := library_until_problem(p_until);
    if v_problem is not null then
      perform platform_field_invalid('until', v_problem);
    end if;
    insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, until)
    values (v_org, p_book_id, v_parent, v_family, p_until)
    returning id into v_loan_id;
    perform 1 from return_watches w where w.book_id = p_book_id and w.parent_id = v_parent order by w.id for update;
    delete from return_watches where book_id = p_book_id and parent_id = v_parent;
    update books set updated_at = now() where id = p_book_id returning version into v_new_version;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_loan_id);
    return platform_result('success', v_loan_id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function library_loan_set_until(
  p_idempotency_key text, p_loan_id uuid, p_expected_version integer, p_until date default null
) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.loan_set_until';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_book_id uuid;
  v_loan loans%rowtype;
  v_problem text;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_loan_id::text, p_expected_version::text,
    coalesce(p_until::text, '')), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := identity_linked_parent();
    if v_parent is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    -- Only the borrower finds the loan: a real loan of another parent and a made-up id fail the same lookup with the same
    -- denied result (NFR3.2). The book of a loan never changes, so it is read before the lock.
    select l.book_id into v_book_id from loans l
     where l.id = p_loan_id and l.organization_id = v_org and l.borrower_parent_id = v_parent;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    perform 1 from books b where b.id = v_book_id for update;
    select * into v_loan from loans l where l.id = p_loan_id and l.borrower_parent_id = v_parent for update;
    if not found then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if v_loan.returned_at is not null then
      perform platform_abort('conflict', 'BOOK_NOT_ON_LOAN');
    end if;
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    if p_expected_version <> v_loan.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    v_problem := library_until_problem(p_until);
    if v_problem is not null then
      perform platform_field_invalid('until', v_problem);
    end if;
    update loans set until = p_until where id = p_loan_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_loan_id);
    return platform_result('success', p_loan_id, null) || jsonb_build_object('version', v_loan.version + 1);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function library_book_return(p_idempotency_key text, p_book_id uuid, p_expected_version integer)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.book_return';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_book books%rowtype;
  v_loan loans%rowtype;
  v_gone boolean;
  v_recipients uuid[];
  v_new_version integer;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(concat_ws('|', p_book_id::text, p_expected_version::text), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_book := library_lock_book_for_owner(p_book_id, v_org, true);
    if p_expected_version is null then
      perform platform_field_invalid('expected_version');
    end if;
    -- The version is checked first: a screen that is out of date gets VERSION_CONFLICT, and BOOK_NOT_ON_LOAN comes only
    -- with a current version (BR134.1). The screen shows the same text for both.
    if p_expected_version <> v_book.version then
      perform platform_abort('conflict', 'VERSION_CONFLICT');
    end if;
    select * into v_loan from loans l where l.book_id = p_book_id and l.returned_at is null for update;
    if not found then
      perform platform_abort('conflict', 'BOOK_NOT_ON_LOAN');
    end if;
    -- A borrower who was removed meanwhile loses the links of the loan in the same step (BR139.1).
    v_gone := v_loan.borrower_parent_id is not null
              and (parent_display_name(v_loan.borrower_parent_id) = 'korábbi tag'
                   or family_display_name(v_loan.borrower_family_id) = 'korábbi tag');
    update loans
       set returned_at = now(),
           borrower_parent_id = case when v_gone then null else borrower_parent_id end,
           borrower_family_id = case when v_gone then null else borrower_family_id end
     where id = v_loan.id;
    update books set updated_at = now() where id = p_book_id returning version into v_new_version;
    -- The watchers other than the person recording the return are told once; then every request ends (BR135.2). A
    -- refusal from the notice function is a fault and rolls the return back.
    perform 1 from return_watches w where w.book_id = p_book_id order by w.id for update;
    select coalesce(array_agg(w.parent_id order by w.parent_id), '{}'::uuid[]) into v_recipients
      from return_watches w
     where w.book_id = p_book_id and w.parent_id is distinct from identity_linked_parent();
    if cardinality(v_recipients) > 0 then
      perform notice_send(v_recipients, 'book_returned', 'book', p_book_id, 'book_returned:' || v_loan.id::text);
    end if;
    delete from return_watches where book_id = p_book_id;
    if not (library_caller_owns(v_book.owner_parent_id) and library_owner_has_rights(v_book.owner_parent_id)) then
      perform platform_audit_write('library_book_returned_by_admin', 'book', p_book_id, v_org, null, 'success', null);
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_loan.id);
    return platform_result('success', v_loan.id, null) || jsonb_build_object('version', v_new_version);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

create or replace function library_watch_add(p_idempotency_key text, p_book_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.watch_add';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
  v_book books%rowtype;
  v_loan loans%rowtype;
  v_id uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_book_id::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := identity_linked_parent();
    if v_parent is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_book_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    select * into v_book from books b where b.id = p_book_id and b.organization_id = v_org for update;
    if not found then
      perform platform_field_invalid('book', 'not_found');
    end if;
    if v_book.removed_at is not null then
      perform platform_abort('conflict', 'BOOK_REMOVED');
    end if;
    select * into v_loan from loans l where l.book_id = p_book_id and l.returned_at is null for update;
    if not found then
      perform platform_abort('conflict', 'BOOK_AVAILABLE');
    end if;
    if v_loan.borrower_parent_id is not distinct from v_parent or v_book.owner_parent_id is not distinct from v_parent then
      perform platform_field_invalid('book', 'holder_or_owner');
    end if;
    if exists (select 1 from return_watches w where w.book_id = p_book_id and w.parent_id = v_parent) then
      perform platform_abort('conflict', 'ALREADY_WATCHING');
    end if;
    insert into return_watches (organization_id, book_id, parent_id) values (v_org, p_book_id, v_parent)
    returning id into v_id;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', v_id);
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

-- Taking the request back succeeds whether or not there was one (BR135.1), and a book that is missing or of another
-- community changes nothing and answers the same way.
create or replace function library_watch_remove(p_idempotency_key text, p_book_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  c_operation constant text := 'library.watch_remove';
  v_org uuid;
  v_fingerprint text;
  v_check jsonb;
  v_detail text;
  v_parent uuid;
begin
  if not current_session_is_active() then
    return platform_result('denied', null, 'session_inactive');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    return platform_result('validation', null, 'idempotency_key_invalid');
  end if;
  v_org := identity_actor_organization();
  v_fingerprint := encode(sha256(convert_to(coalesce(p_book_id::text, ''), 'UTF8')), 'hex');
  v_check := platform_idempotency_check(c_operation, p_idempotency_key, v_fingerprint);
  if v_check->>'status' = 'replay' then
    return platform_result(v_check->>'state', (v_check->>'reference')::uuid, 'replayed');
  elsif v_check->>'status' = 'conflict' then
    return platform_result('conflict', null, 'idempotency_key_reused');
  end if;

  begin
    v_parent := identity_linked_parent();
    if v_parent is null then
      perform platform_abort('denied', 'authorization_denied');
    end if;
    if p_book_id is null then
      perform platform_abort('validation', 'request_invalid');
    end if;
    perform 1 from books b where b.id = p_book_id and b.organization_id = v_org for update;
    if found then
      perform 1 from return_watches w where w.book_id = p_book_id and w.parent_id = v_parent order by w.id for update;
      delete from return_watches where book_id = p_book_id and parent_id = v_parent;
    end if;
    perform platform_idempotency_store(c_operation, p_idempotency_key, v_fingerprint, 'success', p_book_id);
    return platform_result('success', p_book_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  library_until_problem(date),
  library_book_borrow(text, uuid, integer, date),
  library_loan_set_until(text, uuid, integer, date),
  library_book_return(text, uuid, integer),
  library_watch_add(text, uuid),
  library_watch_remove(text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  library_book_borrow(text, uuid, integer, date),
  library_loan_set_until(text, uuid, integer, date),
  library_book_return(text, uuid, integer),
  library_watch_add(text, uuid),
  library_watch_remove(text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 10. The daily check (W6; BR136.1, BR136.2, BR137.1, NFR7.4, NFR7.6). Internal: called by U5's daily run through the
--     registry row below, never granted to a signed-in role. It takes the moment of the run, reads only open loans, and
--     returns how many notices it created and how many loans it skipped because nobody new needed telling. For every open
--     loan of a leaving family whose book is not removed, from the changeover date minus 30 days up to the day before the
--     changeover date (Budapest dates), every active parent of the family with an account gets one notice through
--     `notice_send`, once for each loan and parent. A later run in the window still sends what is not yet sent; a second
--     run sends nothing new. No book lock is taken (accepted exception, BR136.2): a return recorded during a run can
--     still produce one extra reminder for a book that has just come back.
-- ---------------------------------------------------------------------------------------------------
create or replace function library_due_check(p_now timestamptz) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_today date := (coalesce(p_now, now()) at time zone 'Europe/Budapest')::date;
  v_org uuid;
  v_year uuid;
  v_change date;
  v_loan record;
  v_recipients uuid[];
  v_n integer;
  v_created integer := 0;
  v_skipped integer := 0;
begin
  for v_org in
    select distinct l.organization_id from loans l where l.returned_at is null order by l.organization_id
  loop
    v_year := school_year_for(v_today, v_org);
    if v_year is null then
      continue;
    end if;
    v_change := changeover_date(v_year);
    if v_change is null or v_today < v_change - 30 or v_today >= v_change then
      continue;
    end if;
    for v_loan in
      select l.id, l.book_id, l.borrower_family_id
        from loans l
        join books b on b.id = l.book_id and b.removed_at is null
       where l.organization_id = v_org and l.returned_at is null and l.borrower_family_id is not null
         and l.borrower_family_id in (select f from families_with_standing(v_year, 'leaving') f)
       order by l.id
    loop
      select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_recipients
        from parents p
       where p.family_id = v_loan.borrower_family_id and p.status = 'active' and p.account_id is not null;
      if cardinality(v_recipients) = 0 then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      v_n := notice_send(v_recipients, 'book_return_due', 'book', v_loan.book_id, 'book_return_due:' || v_loan.id::text);
      if v_n > 0 then
        v_created := v_created + v_n;
      else
        v_skipped := v_skipped + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end $$;

-- The check is registered in the daily run (C9): run kind daily, active, and the highest lock step the registry accepts
-- so it runs after the existing checks. U5's function is not edited.
insert into timed_check_registry (check_name, function_name, run_kind, is_active, lock_step, added_by) values
  ('library_return_due', 'library_due_check', 'daily', true, 4, 'u13-library');

-- ---------------------------------------------------------------------------------------------------
-- 11. The removal block (C16; BR139.1). Internal: U14 calls it. For a parent, or for every parent of a family, it deletes
--     the subject's return watches, clears the borrower links of the subject's closed loans (the rows stay, so a book's
--     history stays whole), clears the owner link of the subject's books (the books stay in the list and show korábbi tag
--     as owner), and flags without changing the open loans the subject still holds: nothing is stored as a flag, the
--     flag is the list of opaque loan ids the block returns. Preview and apply return `to_clear` (watches plus cleared
--     loans plus cleared owners), `to_flag` and `held_loan_ids`, with no title and no name. A subject that holds nothing,
--     or any other subject kind, gets zero counts. Apply locks the family first, then every affected book ascending, then
--     the loan rows and the watch rows ascending (BR138.1).
-- ---------------------------------------------------------------------------------------------------
create or replace function library_removal_preview(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql stable security definer set search_path from current
as $$
declare
  v_parents uuid[];
  v_family uuid;
  v_clear integer;
  v_held uuid[];
begin
  if p_subject_kind = 'parent' then
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.id = p_subject_id;
  elsif p_subject_kind = 'family' then
    v_family := p_subject_id;
    select coalesce(array_agg(p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0, 'held_loan_ids', '[]'::jsonb);
  end if;
  select (select count(*) from return_watches w where w.parent_id = any (v_parents))
       + (select count(*) from loans l
           where l.returned_at is not null
             and (l.borrower_parent_id = any (v_parents) or (v_family is not null and l.borrower_family_id = v_family)))
       + (select count(*) from books b where b.owner_parent_id = any (v_parents))
    into v_clear;
  select coalesce(array_agg(l.id order by l.id), '{}'::uuid[]) into v_held
    from loans l
   where l.returned_at is null
     and (l.borrower_parent_id = any (v_parents) or (v_family is not null and l.borrower_family_id = v_family));
  return jsonb_build_object('to_clear', v_clear, 'to_flag', cardinality(v_held), 'held_loan_ids', to_jsonb(v_held));
end $$;

create or replace function library_removal_apply(p_subject_kind text, p_subject_id uuid) returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_org uuid;
  v_parents uuid[];
  v_family uuid;
  v_books uuid[];
  v_held uuid[];
  v_count integer := 0;
  v_rows integer;
begin
  if p_subject_kind = 'parent' then
    select p.organization_id, p.family_id into v_org, v_family from parents p where p.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0, 'held_loan_ids', '[]'::jsonb);
    end if;
    v_parents := array[p_subject_id];
  elsif p_subject_kind = 'family' then
    select f.organization_id into v_org from families f where f.id = p_subject_id;
    if not found then
      return jsonb_build_object('to_clear', 0, 'to_flag', 0, 'held_loan_ids', '[]'::jsonb);
    end if;
    v_family := p_subject_id;
    select coalesce(array_agg(p.id order by p.id), '{}'::uuid[]) into v_parents from parents p where p.family_id = p_subject_id;
  else
    return jsonb_build_object('to_clear', 0, 'to_flag', 0, 'held_loan_ids', '[]'::jsonb);
  end if;

  -- The family first (taking a row this transaction already holds is harmless), then every affected book ascending.
  perform 1 from families f where f.id = v_family for update;
  select coalesce(array_agg(x.book_id order by x.book_id), '{}'::uuid[]) into v_books
    from (
      select b.id as book_id from books b where b.owner_parent_id = any (v_parents)
      union
      select w.book_id from return_watches w where w.parent_id = any (v_parents)
      union
      select l.book_id from loans l
       where l.borrower_parent_id = any (v_parents) or (p_subject_kind = 'family' and l.borrower_family_id = v_family)
    ) x;
  perform 1 from books b where b.id = any (v_books) order by b.id for update;
  perform 1 from loans l
   where l.book_id = any (v_books)
     and (l.borrower_parent_id = any (v_parents) or (p_subject_kind = 'family' and l.borrower_family_id = v_family))
   order by l.id for update;
  perform 1 from return_watches w where w.book_id = any (v_books) and w.parent_id = any (v_parents) order by w.id for update;

  select coalesce(array_agg(l.id order by l.id), '{}'::uuid[]) into v_held
    from loans l
   where l.returned_at is null
     and (l.borrower_parent_id = any (v_parents) or (p_subject_kind = 'family' and l.borrower_family_id = v_family));

  delete from return_watches where parent_id = any (v_parents);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update loans set borrower_parent_id = null, borrower_family_id = null
   where returned_at is not null
     and (borrower_parent_id = any (v_parents) or (p_subject_kind = 'family' and borrower_family_id = v_family));
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;
  update books set owner_parent_id = null where owner_parent_id = any (v_parents);
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  perform platform_audit_write('library_removal_applied', p_subject_kind, p_subject_id, v_org, null, 'success',
                               'cleared:' || v_count::text || ':flagged:' || cardinality(v_held)::text);
  return jsonb_build_object('to_clear', v_count, 'to_flag', cardinality(v_held), 'held_loan_ids', to_jsonb(v_held));
end $$;

-- ---------------------------------------------------------------------------------------------------
-- 12. The one-off load (C17; BR140.1). Service role only; one book per call; a second call with the same source key
--     creates nothing and returns the stored result. The payload holds a title, authors and an optional description as
--     in BR131.1, and exactly one of `owner_parent_id` (an active parent of the community the script found in the loaded
--     directory) or `owner_name` (a typed name with no rights). The book loads as available: where a book is now is not
--     migrated. A bad row is refused with a validation envelope that names the field and never a cell value, and the
--     next rows are unaffected. The load is a one-off run by the migration script, which reports counts only, so it
--     writes no audit entry.
-- ---------------------------------------------------------------------------------------------------
create or replace function migration_load_book(p_source_key text, p_organization_id uuid, p_book jsonb)
returns jsonb
language plpgsql security definer set search_path from current
as $$
declare
  v_detail text;
  v_existing uuid;
  v_title text;
  v_authors text;
  v_description text;
  v_owner uuid;
  v_owner_name text;
  v_problem text;
  v_id uuid;
begin
  if not platform_caller_is_system() then
    return platform_result('denied', null, 'admin_access_required');
  end if;
  if p_source_key is null or char_length(p_source_key) not between 1 and 200
     or p_organization_id is null or p_book is null or jsonb_typeof(p_book) <> 'object'
     or not exists (select 1 from organizations o where o.id = p_organization_id) then
    return platform_result('validation', null, 'request_invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_schema() || '|load-book|' || p_source_key, 0));
  select b.id into v_existing from books b where b.source_key = p_source_key;
  if found then
    return platform_result('success', v_existing, 'replayed');
  end if;

  begin
    v_title := btrim(coalesce(p_book->>'title', ''));
    v_authors := btrim(coalesce(p_book->>'authors', ''));
    v_description := nullif(btrim(coalesce(p_book->>'description', '')), '');
    v_owner_name := nullif(btrim(coalesce(p_book->>'owner_name', '')), '');
    if char_length(v_title) not between 1 and 200 then
      perform platform_field_invalid('title');
    end if;
    if char_length(v_authors) not between 1 and 200 then
      perform platform_field_invalid('authors');
    end if;
    if char_length(v_description) > 1000 then
      perform platform_field_invalid('description');
    end if;
    if nullif(p_book->>'owner_parent_id', '') is not null then
      v_owner := platform_try_uuid(p_book->>'owner_parent_id');
      if v_owner is null then
        perform platform_field_invalid('owner_parent_id');
      end if;
      if v_owner_name is not null then
        perform platform_field_invalid('owner', 'one_only');
      end if;
      v_problem := library_owner_problem(v_owner, p_organization_id);
      if v_problem is not null then
        perform platform_field_invalid('owner_parent_id', v_problem);
      end if;
    elsif v_owner_name is null then
      perform platform_field_invalid('owner', 'one_required');
    elsif char_length(v_owner_name) > 200 then
      perform platform_field_invalid('owner_name');
    end if;
    insert into books (organization_id, title, authors, description, owner_parent_id, owner_name, source_key)
    values (p_organization_id, v_title, v_authors, v_description, v_owner, v_owner_name, p_source_key)
    returning id into v_id;
    return platform_result('success', v_id, null);
  exception when sqlstate 'U3R00' then
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb;
  end;
end $$;

revoke all on function
  library_due_check(timestamptz),
  library_removal_preview(text, uuid),
  library_removal_apply(text, uuid),
  migration_load_book(text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- The load is the one internal function the service role holds, as migration_load_family is (C17).
grant execute on function migration_load_book(text, uuid, jsonb) to service_role;

commit;
