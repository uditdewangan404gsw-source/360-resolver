alter table public.complaints add column if not exists sla_due_at timestamptz;
alter table public.complaints add column if not exists resolved_at timestamptz;

update public.complaints as complaint
set sla_due_at = complaint.received_at + make_interval(hours => case when complaint.severity = 'Critical' then settings.critical_response_hours else settings.standard_first_response_hours end),
    resolved_at = case when complaint.status = 'Resolved' then coalesce(complaint.resolved_at, complaint.updated_at) else null end
from public.workspace_settings as settings
where settings.id = true
  and (complaint.sla_due_at is null or (complaint.status = 'Resolved' and complaint.resolved_at is null));

grant select, insert, update on public.complaints to authenticated;;
