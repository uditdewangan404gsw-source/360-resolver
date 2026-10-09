create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.profile_role as enum ('manager', 'agent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.complaint_status as enum ('Open', 'In progress', 'Pending customer', 'Resolved');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.complaint_severity as enum ('Critical', 'High', 'Medium', 'Low');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.complaint_channel as enum ('Email', 'Phone', 'Branch', 'Web form', 'Mobile app', 'Social');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.complaint_sentiment as enum ('Frustrated', 'Negative', 'Neutral', 'Positive');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New agent', role public.profile_role not null default 'agent',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create sequence if not exists public.complaint_number_seq start with 28500;
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_number text not null unique default ('CMP-' || lpad(nextval('public.complaint_number_seq')::text, 5, '0')),
  subject text not null check (char_length(subject) between 1 and 120),
  customer_ref text not null check (char_length(customer_ref) between 1 and 32),
  channel public.complaint_channel not null, category text not null,
  severity public.complaint_severity not null default 'Medium', sentiment public.complaint_sentiment not null default 'Neutral',
  assigned_to uuid references public.profiles(id) on delete set null,
  status public.complaint_status not null default 'Open', minutes_to_sla integer not null default 480,
  received_at timestamptz not null default now(), message text not null check (char_length(message) between 1 and 10000),
  summary text not null, recommended_action text not null, response_draft text not null,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.complaint_events (
  id uuid primary key default gen_random_uuid(), complaint_id uuid not null references public.complaints(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null, event_type text not null check (event_type in ('system','agent','customer')),
  title text not null, detail text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(), title text not null unique, category text not null, content text not null,
  updated_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.duplicate_links (
  complaint_a_id uuid not null references public.complaints(id) on delete cascade,
  complaint_b_id uuid not null references public.complaints(id) on delete cascade,
  status text not null default 'suggested' check (status in ('suggested','confirmed','rejected')),
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(),
  primary key (complaint_a_id, complaint_b_id), check (complaint_a_id < complaint_b_id)
);
create index if not exists complaints_status_received_idx on public.complaints (status, received_at desc);
create index if not exists complaints_assigned_status_idx on public.complaints (assigned_to, status);
create index if not exists complaint_events_complaint_created_idx on public.complaint_events (complaint_id, created_at desc);
create index if not exists duplicate_links_b_idx on public.duplicate_links (complaint_b_id);

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name,role) values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1),'New agent'),'agent') on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function private.handle_new_user();
create or replace function private.is_manager() returns boolean language sql stable security invoker set search_path = '' as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='manager'); $$;
revoke all on function private.is_manager() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_manager() to authenticated;

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_events enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.duplicate_links enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists complaints_select_authenticated on public.complaints;
drop policy if exists complaints_insert_authenticated on public.complaints;
drop policy if exists complaints_update_manager_or_assignee on public.complaints;
drop policy if exists complaints_delete_manager on public.complaints;
drop policy if exists complaint_events_select_authenticated on public.complaint_events;
drop policy if exists complaint_events_insert_actor on public.complaint_events;
drop policy if exists knowledge_base_select_authenticated on public.knowledge_base;
drop policy if exists knowledge_base_insert_manager on public.knowledge_base;
drop policy if exists knowledge_base_update_manager on public.knowledge_base;
drop policy if exists knowledge_base_delete_manager on public.knowledge_base;
drop policy if exists duplicate_links_select_authenticated on public.duplicate_links;
drop policy if exists duplicate_links_insert_manager_or_assignee on public.duplicate_links;
drop policy if exists duplicate_links_update_manager_or_assignee on public.duplicate_links;
drop policy if exists duplicate_links_delete_manager on public.duplicate_links;

create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy complaints_select_authenticated on public.complaints for select to authenticated using (true);
create policy complaints_insert_authenticated on public.complaints for insert to authenticated with check (created_by=(select auth.uid()));
create policy complaints_update_manager_or_assignee on public.complaints for update to authenticated using ((select private.is_manager()) or assigned_to=(select auth.uid())) with check ((select private.is_manager()) or assigned_to=(select auth.uid()));
create policy complaints_delete_manager on public.complaints for delete to authenticated using ((select private.is_manager()));
create policy complaint_events_select_authenticated on public.complaint_events for select to authenticated using (true);
create policy complaint_events_insert_actor on public.complaint_events for insert to authenticated with check (actor_id=(select auth.uid()) and exists(select 1 from public.complaints c where c.id=complaint_id and (c.created_by=(select auth.uid()) or c.assigned_to=(select auth.uid()) or (select private.is_manager()))));
create policy knowledge_base_select_authenticated on public.knowledge_base for select to authenticated using (true);
create policy knowledge_base_insert_manager on public.knowledge_base for insert to authenticated with check ((select private.is_manager()) and updated_by=(select auth.uid()));
create policy knowledge_base_update_manager on public.knowledge_base for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy knowledge_base_delete_manager on public.knowledge_base for delete to authenticated using ((select private.is_manager()));
create policy duplicate_links_select_authenticated on public.duplicate_links for select to authenticated using (true);
create policy duplicate_links_insert_manager_or_assignee on public.duplicate_links for insert to authenticated with check (created_by=(select auth.uid()) and ((select private.is_manager()) or exists(select 1 from public.complaints c where c.id in (complaint_a_id,complaint_b_id) and c.assigned_to=(select auth.uid()))));
create policy duplicate_links_update_manager_or_assignee on public.duplicate_links for update to authenticated using ((select private.is_manager()) or exists(select 1 from public.complaints c where c.id in (complaint_a_id,complaint_b_id) and c.assigned_to=(select auth.uid()))) with check ((select private.is_manager()) or exists(select 1 from public.complaints c where c.id in (complaint_a_id,complaint_b_id) and c.assigned_to=(select auth.uid())));
create policy duplicate_links_delete_manager on public.duplicate_links for delete to authenticated using ((select private.is_manager()));

revoke all on public.profiles,public.complaints,public.complaint_events,public.knowledge_base,public.duplicate_links from anon,public;
grant select on public.profiles to authenticated;
grant update(display_name,updated_at) on public.profiles to authenticated;
grant select,insert,update,delete on public.complaints to authenticated;
grant select,insert on public.complaint_events to authenticated;
grant select,insert,update,delete on public.knowledge_base to authenticated;
grant select,insert,update,delete on public.duplicate_links to authenticated;
grant all on public.profiles,public.complaints,public.complaint_events,public.knowledge_base,public.duplicate_links to service_role;
grant usage,select on sequence public.complaint_number_seq to authenticated,service_role;

insert into public.complaints(complaint_number,subject,customer_ref,channel,category,severity,sentiment,status,minutes_to_sla,received_at,message,summary,recommended_action,response_draft) values
('CMP-28491','Card charged twice at Greenfield Market','CUS-840219','Mobile app','Card payments','Critical','Frustrated','In progress',38,now()-interval '18 minutes','I was charged twice for the same grocery purchase at Greenfield Market yesterday. The first payment was $86.42 and then I saw another $86.42 charge this morning. I need this fixed before my rent payment goes out.','Customer reports a duplicate $86.42 card transaction at Greenfield Market. A second charge posted the following morning, creating concern about an upcoming rent payment.','Verify both transaction IDs in the card ledger. If both are settled, initiate a duplicate-charge investigation and provide a provisional credit review timeline.','Hello, thank you for bringing the duplicate charge to our attention. I understand how concerning this is, especially with an upcoming payment. We are reviewing both $86.42 transactions now and will update you as soon as the review is complete. Your case reference is CMP-28491.'),
('CMP-28490','Mortgage payment not reflected','CUS-771035','Phone','Mortgage servicing','High','Negative','Open',74,now()-interval '29 minutes','My mortgage payment was taken from my checking account four days ago, but the loan portal still says I am late. I called yesterday and was told it would update overnight. It has not.','Payment debited four days prior is not reflected in the mortgage portal despite a previous service call. Customer is concerned about a late-payment marker.','Confirm payment posting and remove any incorrect late status. Explain posting timelines and document the earlier call.','Hello, I’m sorry the payment is not yet showing in your loan portal. We are checking the transfer and your prior call so we can correct any inaccurate status. We will follow up with an update shortly.'),
('CMP-28488','Unable to access online banking','CUS-419802','Web form','Digital banking','Medium','Negative','In progress',192,now()-interval '42 minutes','I have been locked out since the app update. Password reset keeps sending me back to the login screen. I need to transfer money today.','Customer is unable to sign in after a recent app update; password reset loop is blocking an urgent transfer.','Verify identity using approved procedures, check authentication status, and provide an assisted transfer option if eligible.','Hello, we’re sorry you’re having trouble signing in. We can help restore access after completing a quick identity check. If you need to make a transfer today, please let us know and we can review available assisted options.'),
('CMP-28485','Dispute status has not changed','CUS-092761','Email','Disputes','High','Frustrated','Open',268,now()-interval '63 minutes','I submitted a dispute for a $219.00 online order three weeks ago. The merchant never shipped it and the case status has not changed at all.','Customer requests an update on a $219.00 merchandise-not-received dispute submitted three weeks ago.','Review the dispute stage, check for outstanding documentation, and provide a clear next update date.','Hello, thank you for checking in. We are reviewing the current stage of your $219.00 dispute and whether any additional information is needed. We will share a status update and the next expected milestone.'),
('CMP-28482','Unexpected monthly account fee','CUS-621594','Branch','Fees & charges','Medium','Negative','Open',344,now()-interval '76 minutes','I noticed a $12 monthly fee on my statement. I thought this account had no monthly fee when I opened it.','Customer questions a $12 monthly fee and recalls opening an account without monthly charges.','Check the account product, fee waiver eligibility, and the disclosures provided at account opening.','Hello, we can review the $12 fee and the terms for your account. We’ll check whether a waiver applies and explain what options are available.'),
('CMP-28479','Cash withdrawal limit not explained','CUS-348156','Phone','Account access','Low','Neutral','Pending customer',525,now()-interval '91 minutes','I tried to withdraw cash but reached a limit I did not know about. Can someone explain how the daily limit works?','Customer requests a clear explanation of daily cash withdrawal limits after a declined withdrawal.','Explain standard limits and the process for requesting a temporary increase, subject to verification.','Hello, daily cash withdrawal limits help protect your account. We can explain the current limit for your account and review whether a temporary increase is available after verification.'),
('CMP-28476','Cash deposit delayed posting','CUS-510937','Branch','Deposits','Medium','Neutral','In progress',615,now()-interval '106 minutes','I made a cash deposit at the downtown branch yesterday afternoon. It is not showing in my available balance this morning.','Cash deposit made yesterday afternoon is not reflected in the available balance; customer wants posting timing clarified.','Review deposit receipt and availability schedule; confirm whether a standard hold or processing delay applies.','Hello, we’ll review the deposit receipt and posting details for you. Some deposits may have an availability schedule, and we’ll confirm the timing that applies to this transaction.'),
('CMP-28470','Duplicate card transaction at Greenfield Market','CUS-840219','Mobile app','Card payments','High','Frustrated','Open',26,now()-interval '124 minutes','There are two identical charges for $86.42 at Greenfield Market on my card. I only bought groceries once.','Earlier report of two identical $86.42 charges at Greenfield Market; likely related to CMP-28491.','Compare merchant reference numbers and payment status with CMP-28491 before any action. Do not merge or close automatically.','Hello, we’re reviewing the two charges you reported. We’ll compare the transaction details and keep you updated on the outcome.'),
('CMP-28465','Address update confirmation missing','CUS-066408','Social','Account maintenance','Low','Neutral','Resolved',-120,now()-interval '139 minutes','I updated my mailing address last week but never got confirmation. Can you check whether it saved?','Customer needs confirmation that a mailing address update was received and saved.','Confirm the address is on file without repeating sensitive details in an unsecured channel.','Hello, we can confirm the update is on file. For your security, we won’t repeat the address in this message.') on conflict(complaint_number) do nothing;

insert into public.complaint_events(complaint_id,event_type,title,detail,created_at)
select c.id,e.event_type,e.title,e.detail,now()-e.ago from (values
('CMP-28491','customer','Complaint received','Submitted through the mobile app',interval '18 minutes'),('CMP-28491','system','AI classification complete','Card payments · Critical · Frustrated',interval '17 minutes'),('CMP-28491','system','Awaiting agent assignment','New workspace sample',interval '16 minutes'),('CMP-28490','customer','Complaint received','Logged by phone support',interval '29 minutes'),('CMP-28490','system','AI classification complete','Mortgage servicing · High · Negative',interval '28 minutes'),('CMP-28488','customer','Complaint received','Submitted through the web form',interval '42 minutes'),('CMP-28488','system','AI classification complete','Digital banking · Medium · Negative',interval '40 minutes'),('CMP-28485','customer','Complaint received','Received via customer service email',interval '63 minutes'),('CMP-28485','system','Routed to Disputes','Awaiting review',interval '58 minutes'),('CMP-28482','customer','Complaint received','Walk-in branch referral',interval '76 minutes'),('CMP-28482','system','AI classification complete','Fees & charges · Medium · Negative',interval '74 minutes'),('CMP-28479','customer','Complaint received','Logged by phone support',interval '91 minutes'),('CMP-28479','system','Information requested','Agent requested preferred callback time',interval '70 minutes'),('CMP-28476','customer','Complaint received','Branch referral entered by staff',interval '106 minutes'),('CMP-28476','system','AI classification complete','Deposits · Medium · Neutral',interval '98 minutes'),('CMP-28470','customer','Complaint received','Submitted through the mobile app',interval '124 minutes'),('CMP-28470','system','Duplicate candidate detected','Potentially related to CMP-28491',interval '118 minutes'),('CMP-28465','customer','Complaint received','Received through monitored social queue',interval '139 minutes'),('CMP-28465','agent','Address update confirmed','Sample record marked resolved',interval '110 minutes')) e(case_number,event_type,title,detail,ago) join public.complaints c on c.complaint_number=e.case_number where not exists(select 1 from public.complaint_events x where x.complaint_id=c.id and x.title=e.title);
insert into public.duplicate_links(complaint_a_id,complaint_b_id,status)
select least(a.id,b.id),greatest(a.id,b.id),'suggested' from public.complaints a join public.complaints b on b.complaint_number='CMP-28491' where a.complaint_number='CMP-28470' on conflict do nothing;
insert into public.knowledge_base(title,category,content) values
('Card transaction disputes','Cards','How to investigate duplicate, unauthorized, or incorrectly posted card transactions. Verify transaction status and merchant references before offering next steps.'),
('Digital banking access recovery','Digital banking','Identity verification steps, password reset troubleshooting, and safe assisted access options for customers locked out of digital banking.'),
('Account fees and waivers','Accounts','Overview of common account fees, eligibility requirements for waivers, and how to explain account-specific terms clearly.'),
('Mortgage payment posting','Loans','Payment posting timelines, suspense account checks, and how to correct inaccurate delinquency indicators.'),
('Customer communication standards','Service','Use empathetic, plain-language responses. Never promise an outcome before review. Confirm next steps and expected updates.'),
('Complaint handling and escalation','Service','Record the customer’s concern accurately, keep ownership clear, and escalate high-impact cases using configured routing rules.') on conflict(title) do nothing;;
