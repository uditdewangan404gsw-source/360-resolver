-- 360° Resolver workspace schema.
-- Additive only: creates the application's tables, helpers, triggers and policies.
-- Existing object-name collisions intentionally fail for review instead of being replaced.
-- Review against the target project's live schema before applying.

create sequence public.complaint_number_seq start with 28500;

create function public.next_complaint_number()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'CMP-' || lpad(nextval('public.complaint_number_seq')::text, 5, '0');
$$;
revoke all on function public.next_complaint_number() from public, anon;
grant execute on function public.next_complaint_number() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  role text not null default 'agent' check (role in ('manager', 'agent'))
);

-- Provision accounts that predate this migration without changing existing profiles.
insert into public.profiles (id, display_name, role)
select
  u.id,
  left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(split_part(u.email, '@', 1), ''), 'New agent'), 100),
  'agent'
from auth.users as u
on conflict (id) do nothing;

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_number text not null unique default public.next_complaint_number()
    check (complaint_number ~ '^CMP-[0-9]{5}$'),
  subject text not null check (char_length(subject) between 1 and 120),
  customer_ref text not null check (char_length(customer_ref) between 1 and 32),
  channel text not null check (channel in ('Email', 'Phone', 'Branch', 'Web form', 'Mobile app', 'Social')),
  category text not null check (char_length(category) between 1 and 100),
  severity text not null default 'Medium' check (severity in ('Critical', 'High', 'Medium', 'Low')),
  sentiment text not null default 'Neutral' check (sentiment in ('Frustrated', 'Negative', 'Neutral', 'Positive')),
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'Open' check (status in ('Open', 'In progress', 'Pending customer', 'Resolved')),
  minutes_to_sla integer not null default 480,
  received_at timestamptz not null default now(),
  sla_due_at timestamptz,
  resolved_at timestamptz,
  message text not null check (char_length(message) between 1 and 10000),
  summary text not null default '',
  recommended_action text not null default '',
  response_draft text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.complaint_events (
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('system', 'agent', 'customer')),
  title text not null check (char_length(title) between 1 and 120),
  detail text not null check (char_length(detail) <= 1000),
  created_at timestamptz not null default now()
);

create table public.duplicate_links (
  complaint_a_id uuid not null references public.complaints(id) on delete cascade,
  complaint_b_id uuid not null references public.complaints(id) on delete cascade,
  status text not null check (status in ('confirmed', 'rejected')),
  created_by uuid not null references auth.users(id) on delete restrict,
  constraint duplicate_links_pair_pk primary key (complaint_a_id, complaint_b_id),
  constraint duplicate_links_distinct_complaints check (complaint_a_id <> complaint_b_id)
);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  category text not null check (char_length(category) between 1 and 100),
  content text not null,
  updated_at timestamptz not null default now()
);

create table public.workspace_settings (
  id boolean primary key default true check (id is true),
  standard_first_response_hours integer not null default 4 check (standard_first_response_hours between 1 and 72),
  critical_response_hours integer not null default 1 check (critical_response_hours between 1 and 24),
  escalation_elapsed_percent integer not null default 75 check (escalation_elapsed_percent between 1 and 99),
  updated_at timestamptz not null default now()
);

create index if not exists complaints_received_at_idx on public.complaints (received_at desc);
create index if not exists complaints_assigned_status_idx on public.complaints (assigned_to, status);
create index if not exists complaints_sla_due_active_idx on public.complaints (sla_due_at) where status <> 'Resolved';
create index if not exists complaint_events_created_at_idx on public.complaint_events (created_at);
create index if not exists complaint_events_complaint_created_idx on public.complaint_events (complaint_id, created_at);
create index if not exists duplicate_links_b_id_idx on public.duplicate_links (complaint_b_id);
create index if not exists knowledge_base_title_idx on public.knowledge_base (title);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger complaints_set_updated_at before update on public.complaints
for each row execute function public.set_updated_at();

create trigger knowledge_base_set_updated_at before update on public.knowledge_base
for each row execute function public.set_updated_at();

create trigger workspace_settings_set_updated_at before update on public.workspace_settings
for each row execute function public.set_updated_at();

-- A newly registered user is always an agent. User-supplied role metadata is ignored.
create function public.handle_new_resolver_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  if resolved_name is null then
    resolved_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'New agent');
  end if;

  insert into public.profiles (id, display_name, role)
  values (new.id, left(resolved_name, 100), 'agent');
  return new;
end;
$$;

create trigger on_auth_user_created_resolver_profile
after insert on auth.users
for each row execute function public.handle_new_resolver_user();

create function public.current_resolver_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles as p where p.id = (select auth.uid());
$$;

revoke all on function public.current_resolver_role() from public, anon;
grant execute on function public.current_resolver_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_events enable row level security;
alter table public.duplicate_links enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.workspace_settings enable row level security;

create policy "resolver profiles readable by workspace" on public.profiles
for select to authenticated
using (public.current_resolver_role() in ('agent', 'manager'));
-- No authenticated INSERT/UPDATE/DELETE policy on profiles: role changes must be
-- performed by a trusted database administrator, never by client-supplied data.

create policy "resolver complaints readable by workspace" on public.complaints
for select to authenticated
using (public.current_resolver_role() in ('agent', 'manager'));

create policy "resolver agents and managers create complaints" on public.complaints
for insert to authenticated
with check (
  public.current_resolver_role() in ('agent', 'manager')
  and created_by = (select auth.uid())
  and assigned_to = (select auth.uid())
);

create policy "resolver agents and managers update complaints" on public.complaints
for update to authenticated
using (public.current_resolver_role() in ('agent', 'manager'))
with check (public.current_resolver_role() in ('agent', 'manager'));
-- No DELETE policy: complaint and audit history cannot be removed by the app.

create policy "resolver events readable by workspace" on public.complaint_events
for select to authenticated
using (public.current_resolver_role() in ('agent', 'manager'));

create policy "resolver users append complaint events" on public.complaint_events
for insert to authenticated
with check (
  public.current_resolver_role() in ('agent', 'manager')
  and actor_id = (select auth.uid())
  and exists (select 1 from public.complaints c where c.id = complaint_id)
);
-- No UPDATE/DELETE policies: event history is append-only.

create policy "resolver duplicate links readable by workspace" on public.duplicate_links
for select to authenticated
using (public.current_resolver_role() in ('agent', 'manager'));

create policy "resolver users create duplicate decisions" on public.duplicate_links
for insert to authenticated
with check (
  public.current_resolver_role() in ('agent', 'manager')
  and created_by = (select auth.uid())
);

create policy "resolver users update duplicate decisions" on public.duplicate_links
for update to authenticated
using (public.current_resolver_role() in ('agent', 'manager'))
with check (
  public.current_resolver_role() in ('agent', 'manager')
  and created_by = (select auth.uid())
);

create policy "resolver knowledge readable by workspace" on public.knowledge_base
for select to authenticated
using (public.current_resolver_role() in ('agent', 'manager'));
-- Knowledge articles are read-only because the repository has no write action.

create policy "resolver workspace settings readable by workspace" on public.workspace_settings
for select to authenticated
using (public.current_resolver_role() in ('agent', 'manager'));

create policy "resolver managers insert workspace settings" on public.workspace_settings
for insert to authenticated
with check (public.current_resolver_role() = 'manager');

create policy "resolver managers update workspace settings" on public.workspace_settings
for update to authenticated
using (public.current_resolver_role() = 'manager')
with check (public.current_resolver_role() = 'manager');

revoke all on public.profiles, public.complaints, public.complaint_events,
  public.duplicate_links, public.knowledge_base, public.workspace_settings from public, anon, authenticated;
grant select on public.profiles, public.complaints, public.complaint_events,
  public.duplicate_links, public.knowledge_base, public.workspace_settings to authenticated;
grant insert (subject, customer_ref, channel, category, severity, sentiment, assigned_to,
  status, minutes_to_sla, received_at, sla_due_at, message, summary, recommended_action,
  response_draft, created_by) on public.complaints to authenticated;
grant update (status, severity, resolved_at, response_draft, assigned_to, updated_at)
  on public.complaints to authenticated;
grant insert (complaint_id, actor_id, event_type, title, detail) on public.complaint_events to authenticated;
grant insert (complaint_a_id, complaint_b_id, status, created_by) on public.duplicate_links to authenticated;
grant update (status, created_by) on public.duplicate_links to authenticated;
grant insert (id, standard_first_response_hours, critical_response_hours,
  escalation_elapsed_percent, updated_at) on public.workspace_settings to authenticated;
grant update (id, standard_first_response_hours, critical_response_hours,
  escalation_elapsed_percent, updated_at) on public.workspace_settings to authenticated;
grant usage, select on sequence public.complaint_number_seq to authenticated;
