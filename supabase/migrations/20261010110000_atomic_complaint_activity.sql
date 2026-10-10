-- Record complaint workflow changes from the database so the complaint update
-- and its audit entry commit or roll back together.
create or replace function public.record_customer_portal_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  public_title text;
  public_detail text;
  visible_to_customer boolean := new.customer_id is not null;
begin
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
  elsif new.assigned_to is distinct from old.assigned_to then
    public_title := case when new.assigned_to is null then 'Complaint unassigned' else 'Complaint assigned' end;
    public_detail := case when new.assigned_to is null then 'The complaint no longer has an assigned case officer.' else 'A customer-care case officer has been assigned.' end;
  elsif new.severity is distinct from old.severity then
    public_title := 'Complaint priority updated';
    public_detail := 'Priority changed to ' || new.severity || '.';
    visible_to_customer := false;
  else
    return new;
  end if;

  insert into public.complaint_events(
    complaint_id, actor_id, event_type, title, detail, customer_visible
  ) values (new.id, auth.uid(), 'agent', public_title, public_detail, visible_to_customer);
  return new;
end;
$$;

drop trigger if exists complaints_customer_portal_status_event on public.complaints;
create trigger complaints_customer_portal_status_event
after update of status, assigned_to, severity on public.complaints
for each row execute function public.record_customer_portal_status_event();
