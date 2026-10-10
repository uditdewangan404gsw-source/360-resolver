# 360° Resolver

AI-assisted banking complaint operations workspace built with Next.js, React, TypeScript, and Supabase.

## Environment

Configure these values in `.env.local` for local development and in the deployment environment for production:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL used by browser and server clients. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable/anon key. Keep this to the public key intended for client use; Row Level Security must remain enabled. |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | Optional | Email confirmation redirect override. Defaults to the current origin's `/auth/callback`. Configure the matching callback URL in Supabase Auth. |

Never put a Supabase service-role/secret key in a `NEXT_PUBLIC_*` variable or browser code. This application uses the authenticated user's session and RLS policies.

## Database migration

The linked Supabase project already contains the workspace schema. Its four recorded remote migrations have been fetched into `supabase/migrations/` with their original versions. The incompatible, un-applied local baseline proposal is preserved at `supabase/archive/20261009000000_create_resolver_workspace_unapplied.sql`; it is intentionally outside the active migration directory so it cannot be pushed over existing tables.

The Supabase migration history includes an additive classification migration from an earlier version. The current application no longer reads or writes those legacy fields; they remain in the database and migration history so existing deployments are not changed destructively. The portal migration follows the fetched remote migrations and this schema reconciliation.

Before deployment, confirm the project ref, create a schema and data backup, review the local-only migrations, then run `npx supabase migration list`. The expected state is that the four fetched migrations match remote and the classification, customer-portal, and atomic complaint activity migrations are local-only. Run `npx supabase db push --dry-run` and confirm it lists only those local migrations before using `npx supabase db push`. The dry run does not apply changes. Never use `db reset` against a database containing data. After the push, re-run the migration list and test staff and two separate customer sessions before production use.

## Complaint and event write behavior

Complaint creation saves the complaint and appends its activity entry. Status, priority, and assignment changes write their activity events in the same database transaction as the complaint update.

## Commands

## Customer portal

Customer pages are available at `/customer/login`, `/customer/register`, `/customer/dashboard`, `/customer/complaints/new`, `/customer/complaints/[id]`, and `/customer/profile`. Signup uses the same Supabase Auth project and email-confirmation callback. The revised auth trigger gives every new public signup the `customer` role; an administrator must provision staff roles through trusted database administration. Staff server actions check the database profile role.

The additive migration `supabase/migrations/20261009180000_add_customer_portal.sql` adds customer ownership and a retry key to the existing `complaints` records, a customer-visible event flag, private in-app messages, customer-safe read functions, and the idempotent complaint-submission function. Customer complaint reads go through a security-definer function that returns only portal fields; direct table reads remain blocked by the existing staff-only complaint RLS policy. Customer messages are scoped by a security-definer ownership predicate. No storage bucket, outbound email/SMS provider, scheduler, or attachments are configured.

The supplied live policies had broad `SELECT true` on complaints, events, profiles, duplicate links, knowledge base, and workspace settings, plus table-wide grants. The portal migration replaces those relevant policies with role/ownership-limited policies, removes broad delete/truncate grants from the portal's core tables, and limits selected message/event columns so customer sessions do not receive staff actor IDs. Customers read complaint data only through safe server functions. Review the migration before applying, then verify Customer A cannot read Customer B's complaint, messages, or events; customers cannot alter ownership, role, assignment, status or SLA fields; and staff workflows still work.

SLA tracking uses the stored `sla_due_at` computed from `workspace_settings.standard_first_response_hours` in calendar hours. The live schema does not confirm an implemented business-hour calendar, holidays, paused time, or persisted breach timestamp; automated escalation/reminder scheduling and outbound notification delivery are not configured. The portal shows the stored deadline and elapsed overdue time and distinguishes the SLA from a resolution estimate. There is no recorded resolution commitment or resolution summary in the inspected schema, so the portal reports that no estimate is available. Attachments are not accepted until private storage and authorization are configured.

```sh
pnpm install
pnpm dev
pnpm build
```
