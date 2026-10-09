create table if not exists public.workspace_settings (
  id boolean primary key default true check (id),
  standard_first_response_hours integer not null default 4 check (standard_first_response_hours between 1 and 72),
  critical_response_hours integer not null default 1 check (critical_response_hours between 1 and 24),
  escalation_elapsed_percent integer not null default 75 check (escalation_elapsed_percent between 1 and 99),
  updated_at timestamptz not null default now()
);

alter table public.workspace_settings enable row level security;

drop policy if exists workspace_settings_select_authenticated on public.workspace_settings;
create policy workspace_settings_select_authenticated on public.workspace_settings for select to authenticated using (true);

drop policy if exists workspace_settings_insert_manager on public.workspace_settings;
create policy workspace_settings_insert_manager on public.workspace_settings for insert to authenticated with check ((select private.is_manager()));

drop policy if exists workspace_settings_update_manager on public.workspace_settings;
create policy workspace_settings_update_manager on public.workspace_settings for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));

grant select, insert, update on public.workspace_settings to authenticated;
insert into public.workspace_settings (id) values (true) on conflict (id) do nothing;;
