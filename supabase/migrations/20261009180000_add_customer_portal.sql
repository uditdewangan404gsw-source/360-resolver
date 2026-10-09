-- Customer portal additions for the inspected live resolver schema.
-- Additive data changes; policy/grant changes tighten authenticated access.
-- Do not apply until local and remote migration histories have been reconciled.

alter type public.profile_role add value if not exists 'customer';

alter table public.complaints
  add column customer_id uuid references public.profiles(id) on delete restrict,
  add column customer_submission_key uuid,
  add column customer_product text,
  add column customer_transaction_date date,
  add column customer_transaction_amount numeric(14,2),
  add column customer_transaction_reference text;

create unique index complaints_customer_submission_key_idx
  on public.complaints(customer_id, customer_submission_key)
  where customer_submission_key is not null;
create index complaints_customer_received_idx
  on public.complaints(customer_id, received_at desc)
  where customer_id is not null;

alter table public.complaint_events
  add column customer_visible boolean not null default false;

-- Public Auth signup must never create a staff account. Existing staff keep
-- their stored roles; new users require trusted profile administration to be
-- granted an agent or manager role.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
  resolved_role text;
begin
  resolved_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'New user'
  );
  resolved_role := 'customer';
  insert into public.profiles(id, display_name, role)
    values (new.id, left(resolved_name, 100), resolved_role::public.profile_role)
    on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.customer_portal_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role::text from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.customer_portal_role() from public, anon;
grant execute on function public.customer_portal_role() to authenticated;

create or replace function public.customer_owns_complaint(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.complaints c
    where c.id = p_complaint_id
      and c.customer_id = auth.uid()
      and public.customer_portal_role() = 'customer'
  );
$$;
revoke all on function public.customer_owns_complaint(uuid) from public, anon;
grant execute on function public.customer_owns_complaint(uuid) to authenticated;

create or replace function public.customer_can_reply(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.complaints c
    where c.id = p_complaint_id
      and c.customer_id = auth.uid()
      and c.status <> 'Resolved'::public.complaint_status
      and public.customer_portal_role() = 'customer'
  );
$$;
revoke all on function public.customer_can_reply(uuid) from public, anon;
grant execute on function public.customer_can_reply(uuid) to authenticated;

-- Replace broad SELECT policies. PostgreSQL ORs permissive policies, so the
-- prior `USING (true)` policies must not remain alongside ownership policies.
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_staff_or_self on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or public.customer_portal_role() in ('agent', 'manager')
);
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists complaints_select_authenticated on public.complaints;
drop policy if exists complaints_insert_authenticated on public.complaints;
drop policy if exists complaints_update_manager_or_assignee on public.complaints;
drop policy if exists complaints_delete_manager on public.complaints;
create policy complaints_select_staff on public.complaints
for select to authenticated
using (public.customer_portal_role() in ('agent', 'manager'));
create policy complaints_insert_staff on public.complaints
for insert to authenticated
with check (
  public.customer_portal_role() in ('agent', 'manager')
  and created_by = (select auth.uid())
);
create policy complaints_update_staff on public.complaints
for update to authenticated
using (
  public.customer_portal_role() in ('agent', 'manager')
  and (private.is_manager() or assigned_to = (select auth.uid()))
)
with check (
  public.customer_portal_role() in ('agent', 'manager')
  and (private.is_manager() or assigned_to = (select auth.uid()))
);

drop policy if exists complaint_events_select_authenticated on public.complaint_events;
drop policy if exists complaint_events_insert_actor on public.complaint_events;
create policy complaint_events_select_staff on public.complaint_events
for select to authenticated
using (public.customer_portal_role() in ('agent', 'manager'));
create policy complaint_events_select_customer_visible on public.complaint_events
for select to authenticated
using (
  customer_visible
  and public.customer_owns_complaint(complaint_id)
);
create policy complaint_events_insert_staff on public.complaint_events
for insert to authenticated
with check (
  public.customer_portal_role() in ('agent', 'manager')
  and actor_id = (select auth.uid())
  and exists (
    select 1 from public.complaints c
    where c.id = complaint_id
      and (c.created_by = (select auth.uid())
        or c.assigned_to = (select auth.uid())
        or private.is_manager())
  )
);

drop policy if exists workspace_settings_select_authenticated on public.workspace_settings;
create policy workspace_settings_select_staff on public.workspace_settings
for select to authenticated
using (public.customer_portal_role() in ('agent', 'manager'));

-- The live project also has permissive SELECT policies on these staff-only
-- workspace tables. Replace those policies before customer accounts exist.
drop policy if exists duplicate_links_select_authenticated on public.duplicate_links;
create policy duplicate_links_select_staff on public.duplicate_links
for select to authenticated
using (public.customer_portal_role() in ('agent', 'manager'));

drop policy if exists knowledge_base_select_authenticated on public.knowledge_base;
create policy knowledge_base_select_staff on public.knowledge_base
for select to authenticated
using (public.customer_portal_role() in ('agent', 'manager'));

-- Remove broad table grants (including DELETE/TRUNCATE, which RLS does not
-- constrain), then restore only columns used by the existing staff workflows.
revoke all on public.profiles, public.complaints, public.complaint_events,
  public.workspace_settings from anon, authenticated;
grant select on public.profiles, public.complaints,
  public.workspace_settings to authenticated;
grant select (complaint_id, event_type, title, detail, created_at, customer_visible)
  on public.complaint_events to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;
grant insert (subject, customer_ref, channel, category, severity, sentiment,
  assigned_to, status, minutes_to_sla, received_at, sla_due_at, message, summary,
  recommended_action, response_draft, created_by) on public.complaints to authenticated;
grant update (status, severity, resolved_at, response_draft, assigned_to,
  updated_at, category, sentiment, summary, recommended_action, triage_status,
  triage_source, triage_category, triage_product, triage_severity,
  triage_sentiment, triage_language, triage_summary, triage_recommended_action,
  triage_possible_fraud, triage_fraud_reason, triage_confidence,
  triage_explanation, triage_error, triage_updated_at, triage_reviewed_at)
  on public.complaints to authenticated;
grant insert (complaint_id, actor_id, event_type, title, detail)
  on public.complaint_events to authenticated;
grant insert (id, standard_first_response_hours, critical_response_hours,
  escalation_elapsed_percent, updated_at) on public.workspace_settings to authenticated;
grant update (id, standard_first_response_hours, critical_response_hours,
  escalation_elapsed_percent, updated_at) on public.workspace_settings to authenticated;

create table public.customer_messages (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_kind text not null check (sender_kind in ('customer', 'staff')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index customer_messages_complaint_created_idx
  on public.customer_messages(complaint_id, created_at);
alter table public.customer_messages enable row level security;
create policy customer_messages_select_customer on public.customer_messages
for select to authenticated
using (public.customer_owns_complaint(complaint_id));
create policy customer_messages_select_staff on public.customer_messages
for select to authenticated
using (public.customer_portal_role() in ('agent', 'manager'));
create policy customer_messages_insert_customer on public.customer_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_kind = 'customer'
  and public.customer_can_reply(complaint_id)
);
create policy customer_messages_insert_staff on public.customer_messages
for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and sender_kind = 'staff'
  and public.customer_portal_role() in ('agent', 'manager')
  and exists (select 1 from public.complaints c where c.id = complaint_id)
);
revoke all on public.customer_messages from public, anon, authenticated;
grant select (id, complaint_id, sender_kind, body, created_at)
  on public.customer_messages to authenticated;
grant insert (complaint_id, sender_id, sender_kind, body)
  on public.customer_messages to authenticated;

create or replace function public.submit_customer_complaint(
  p_submission_key uuid,
  p_subject text,
  p_category text,
  p_product text,
  p_description text,
  p_transaction_date date default null,
  p_transaction_amount numeric default null,
  p_transaction_reference text default null
)
returns table (id uuid, complaint_number text, received_at timestamptz,
  status public.complaint_status, sla_due_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  inserted_id uuid;
  target_hours integer;
begin
  uid := auth.uid();
  if uid is null or public.customer_portal_role() <> 'customer' then
    raise exception 'Not authorized';
  end if;
  if p_submission_key is null
    or char_length(btrim(p_subject)) not between 1 and 120
    or char_length(btrim(p_category)) not between 1 and 100
    or char_length(btrim(p_product)) not between 1 and 60
    or char_length(btrim(p_description)) not between 10 and 10000
    or (p_transaction_amount is not null and p_transaction_amount < 0)
    or char_length(coalesce(p_transaction_reference, '')) > 100 then
    raise exception 'Invalid complaint details';
  end if;
  select coalesce(ws.standard_first_response_hours, 4) into target_hours
    from public.workspace_settings ws where ws.id = true;
  target_hours := coalesce(target_hours, 4);

  insert into public.complaints (
    subject, customer_ref, channel, category, severity, sentiment, assigned_to,
    status, minutes_to_sla, received_at, sla_due_at, message, summary,
    recommended_action, response_draft, created_by, customer_id,
    customer_submission_key, triage_status, triage_error
  ) values (
    btrim(p_subject), 'Customer', 'Web form'::public.complaint_channel,
    left(btrim(p_category), 100), 'Medium'::public.complaint_severity,
    'Neutral'::public.complaint_sentiment, null, 'Open'::public.complaint_status,
    target_hours * 60, now(), now() + make_interval(hours => target_hours),
    btrim(p_description), '', '', '', uid, uid, p_submission_key,
    'failed', 'Saved. Staff triage can be started from the existing workspace.'
  ) on conflict (customer_id, customer_submission_key)
    where customer_submission_key is not null do nothing
  returning public.complaints.id into inserted_id;

  if inserted_id is null then
    return query select c.id, c.complaint_number, c.received_at, c.status, c.sla_due_at
      from public.complaints c
      where c.customer_id = uid and c.customer_submission_key = p_submission_key;
    return;
  end if;

  update public.complaints c set
    customer_product = left(btrim(p_product), 60),
    customer_transaction_date = p_transaction_date,
    customer_transaction_amount = p_transaction_amount,
    customer_transaction_reference = nullif(btrim(p_transaction_reference), '')
  where c.id = inserted_id;

  insert into public.complaint_events(
    complaint_id, actor_id, event_type, title, detail, customer_visible
  ) values (
    inserted_id, uid, 'system', 'Complaint received',
    'Your complaint was submitted successfully.', true
  );

  return query select c.id, c.complaint_number, c.received_at, c.status, c.sla_due_at
    from public.complaints c where c.id = inserted_id;
end;
$$;
revoke all on function public.submit_customer_complaint(uuid,text,text,text,text,date,numeric,text) from public, anon;
grant execute on function public.submit_customer_complaint(uuid,text,text,text,text,date,numeric,text) to authenticated;

create or replace function public.get_customer_complaints()
returns table (
  id uuid, complaint_number text, subject text, category text, product text,
  description text, status public.complaint_status, received_at timestamptz,
  updated_at timestamptz, sla_due_at timestamptz, sla_risk_at timestamptz,
  resolved_at timestamptz, transaction_date date, transaction_amount numeric,
  transaction_reference text, assigned_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.complaint_number, c.subject, c.category, c.customer_product,
    c.message, c.status, c.received_at, c.updated_at, c.sla_due_at,
    c.received_at + make_interval(secs =>
      (extract(epoch from (c.sla_due_at - c.received_at))::integer *
       (100 - coalesce((select ws.escalation_elapsed_percent
         from public.workspace_settings ws where ws.id = true), 75)) / 100)),
    c.resolved_at, c.customer_transaction_date, c.customer_transaction_amount,
    c.customer_transaction_reference, p.display_name
  from public.complaints c
  left join public.profiles p on p.id = c.assigned_to
  where c.customer_id = auth.uid()
    and public.customer_portal_role() = 'customer'
  order by c.received_at desc;
$$;

create or replace function public.get_customer_complaint_events(p_complaint_id uuid)
returns table (event_type text, title text, detail text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.event_type, e.title, e.detail, e.created_at
  from public.complaint_events e
  join public.complaints c on c.id = e.complaint_id
  where c.id = p_complaint_id
    and c.customer_id = auth.uid()
    and public.customer_portal_role() = 'customer'
    and e.customer_visible
  order by e.created_at asc;
$$;
revoke all on function public.get_customer_complaints() from public, anon;
revoke all on function public.get_customer_complaint_events(uuid) from public, anon;
grant execute on function public.get_customer_complaints() to authenticated;
grant execute on function public.get_customer_complaint_events(uuid) to authenticated;

create or replace function public.record_customer_portal_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  public_title text;
  public_detail text;
begin
  if new.customer_id is null then return new; end if;
  if new.status is distinct from old.status then
    public_title := case new.status
      when 'Open' then 'Complaint received'
      when 'In progress' then 'Investigation started'
      when 'Pending customer' then 'Information requested'
      when 'Resolved' then 'Complaint resolved'
      else 'Complaint updated' end;
    public_detail := case new.status
      when 'Open' then 'Your complaint is in the customer-care queue.'
      when 'In progress' then 'Customer care is reviewing your complaint.'
      when 'Pending customer' then 'Customer care needs more information. Check your conversation for details.'
      when 'Resolved' then 'Customer care marked this complaint as resolved.'
      else 'Your complaint status has been updated.' end;
    insert into public.complaint_events(
      complaint_id, actor_id, event_type, title, detail, customer_visible
    ) values (new.id, auth.uid(), 'agent', public_title, public_detail, true);
  elsif new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    insert into public.complaint_events(
      complaint_id, actor_id, event_type, title, detail, customer_visible
    ) values (new.id, auth.uid(), 'agent', 'Complaint assigned',
      'A customer-care case officer has been assigned.', true);
  end if;
  return new;
end;
$$;
create trigger complaints_customer_portal_status_event
after update of status, assigned_to on public.complaints
for each row execute function public.record_customer_portal_status_event();

