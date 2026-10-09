-- Idempotent triage metadata for the linked project. The live database already
-- has these fields, but they are absent from its migration ledger. IF NOT EXISTS
-- lets this migration record that schema without replacing existing values.
alter table public.complaints
  add column if not exists triage_status text not null default 'pending',
  add column if not exists triage_source text,
  add column if not exists triage_category text,
  add column if not exists triage_product text,
  add column if not exists triage_severity text,
  add column if not exists triage_sentiment text,
  add column if not exists triage_language text,
  add column if not exists triage_summary text,
  add column if not exists triage_recommended_action text,
  add column if not exists triage_possible_fraud boolean,
  add column if not exists triage_fraud_reason text,
  add column if not exists triage_confidence numeric(4,3),
  add column if not exists triage_explanation text,
  add column if not exists triage_error text,
  add column if not exists triage_updated_at timestamptz,
  add column if not exists triage_reviewed_at timestamptz;

grant update (category, severity, sentiment, summary, recommended_action,
  triage_status, triage_source, triage_category, triage_product, triage_severity,
  triage_sentiment, triage_language, triage_summary, triage_recommended_action,
  triage_possible_fraud, triage_fraud_reason, triage_confidence,
  triage_explanation, triage_error, triage_updated_at, triage_reviewed_at)
  on public.complaints to authenticated;
