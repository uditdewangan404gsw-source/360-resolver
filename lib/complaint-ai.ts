import 'server-only'

import { z } from 'zod'
import { classificationSchema, type ComplaintClassification } from '@/lib/complaint-triage-schema'

export { classificationSchema }
export type { ComplaintClassification }
export const responseDraftSchema = z.object({ response: z.string().trim().min(20).max(5000) })
export type PolicySource = { id: string; title: string; category: string; updatedAt: string }

export const complaintRequestSchema = z.object({ complaintNumber: z.string().regex(/^CMP-\d{5}$/) })
export const responseApprovalSchema = z.object({
  complaintNumber: z.string().regex(/^CMP-\d{5}$/),
  draft: responseDraftSchema.shape.response,
  sources: z.array(z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    category: z.string().min(1).max(100),
    updatedAt: z.string().datetime(),
  })).max(10),
})

export async function getAuthenticatedAgent() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { supabase, user: null, profile: null }
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('id,role').eq('id', user.id).maybeSingle()
  if (profileError || !profile || !['agent', 'manager'].includes(profile.role)) return { supabase, user: null, profile: null }
  return { supabase, user, profile }
}

export async function generateStructuredOutput<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T>> {
  const { generateText, gateway, Output } = await import('ai')
  const result = await generateText({
    model: gateway('google/gemini-2.5-flash'),
    output: Output.object({ schema }),
    prompt,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(15_000),
  })
  return schema.parse(result.output)
}

export function deterministicClassification(input: { subject: string; message: string; category: string; severity: string }): ComplaintClassification {
  const text = `${input.subject} ${input.message}`.toLowerCase()
  const fraudTerms = ['fraud', 'unauthorized', 'not my transaction', 'stolen', 'scam', 'identity theft']
  const possibleFraud = fraudTerms.some((term) => text.includes(term))
  const severity: ComplaintClassification['severity'] = possibleFraud || /urgent|immediately|threat|emergency/.test(text)
    ? 'Critical'
    : /angry|furious|unacceptable|again|third time|complaint/.test(text) ? 'High'
      : input.severity === 'Critical' || input.severity === 'High' ? input.severity as ComplaintClassification['severity'] : 'Medium'
  const sentiment: ComplaintClassification['sentiment'] = /thank|great|pleased|appreciate/.test(text)
    ? 'Positive'
    : /angry|furious|unacceptable|frustrat/.test(text) ? 'Frustrated'
      : /bad|wrong|poor|problem|issue|disappointed|failed|cannot|can't|unable/.test(text) ? 'Negative' : 'Neutral'
  const category = /card|payment|transaction|charge/.test(text) ? 'Card payments'
    : /login|password|app|online|digital/.test(text) ? 'Digital banking'
      : /fee|charge|interest/.test(text) ? 'Fees & charges'
        : /dispute|refund|chargeback/.test(text) ? 'Disputes' : input.category || 'Other'
  const product = /credit card|debit card|card/.test(text) ? 'Payment card'
    : /mobile app|online banking|login|password/.test(text) ? 'Digital banking'
      : /loan|mortgage/.test(text) ? 'Loan' : 'Unspecified'
  const allowedCategory = CATEGORY_VALUES.includes(input.category as typeof CATEGORY_VALUES[number]) ? input.category as typeof CATEGORY_VALUES[number] : 'Other'
  return classificationSchema.parse({
    category: CATEGORY_VALUES.includes(category as typeof CATEGORY_VALUES[number]) ? category as typeof CATEGORY_VALUES[number] : allowedCategory, product, severity, sentiment, language: 'Unknown; confirm with customer',
    summary: `Customer reports: ${input.message.trim().slice(0, 420)}`,
    recommendedAction: possibleFraud
      ? 'Prioritize a human review, verify the transaction through approved internal systems, and follow the applicable fraud escalation policy.'
      : 'Review the reported issue against approved policy, verify relevant records, and have an agent determine the next customer update.',
    possibleFraud,
    fraudReason: possibleFraud ? 'Fraud-related wording was detected; this is a review flag, not a finding.' : '',
    confidence: 0.35,
    explanation: 'Deterministic keyword fallback; this is not an AI-generated classification and needs human review.',
  })
}

export function isAiProviderConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY)
}

export async function classifyComplaint(input: { subject: string; message: string; category: string; severity: string }): Promise<{ result: ComplaintClassification; source: 'ai' | 'fallback' }> {
  if (!isAiProviderConfigured()) return { result: deterministicClassification(input), source: 'fallback' }
  const result = await generateStructuredOutput(classificationSchema, [
    'Classify this customer complaint for an agent to review. Return only the schema fields.',
    'Use category exactly from: Card payments, Digital banking, Fees & charges, Disputes, Other.',
    'Use the existing severity and sentiment enums. Give concise summary and safe next action.',
    'possibleFraud is only a review indicator, never a fraud finding. Never recommend automatically closing a complaint.',
    'Set confidence between 0 and 1 and explain key evidence briefly. Do not repeat account identifiers.',
    `Current category: ${input.category}; current severity: ${input.severity}`,
    `Subject: ${input.subject}`,
    `Customer message: ${input.message}`,
  ].join('\n\n'))
  return { result, source: 'ai' }
}

export function deterministicResponseDraft(input: { subject: string; complaintNumber: string; article: { title: string; content: string } }) {
  const excerpt = input.article.content.trim().replace(/\s+/g, ' ').slice(0, 360)
  return responseDraftSchema.parse({ response: `Hello,\n\nThank you for contacting us about ${input.subject}. We have recorded your concern under reference ${input.complaintNumber} and are reviewing it in line with our approved guidance, "${input.article.title}." That guidance states: ${excerpt}${excerpt.length === 360 ? '…' : ''}\n\nA member of our team will review the details and follow up with an update. This draft is for agent review and has not been sent.` })
}

export function toPolicySource(article: { id: string; title: string; category: string; updated_at: string }): PolicySource {
  return { id: article.id, title: article.title, category: article.category, updatedAt: article.updated_at }
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

export const AI_MODEL = 'google/gemini-2.5-flash'
export const AI_FALLBACK_NOTICE = 'AI unavailable; a deterministic fallback was used. Review carefully before approval.'
export const KNOWLEDGE_APPROVAL_NOTICE = 'Only manager-approved knowledge articles are used as policy context.'
export const NO_AUTOMATIC_DELIVERY_NOTICE = 'Nothing is sent to the customer.'
export const REQUEST_BODY_LIMIT = 16_000
export const ARTICLE_CONTEXT_LIMIT = 8_000
export const MAX_POLICY_SOURCES = 10
export const RESPONSE_DRAFT_LIMIT = 5_000
export const CLASSIFICATION_SUMMARY_LIMIT = 500
export const CLASSIFICATION_ACTION_LIMIT = 500
export const FRAUD_REASON_LIMIT = 300
export const AI_REQUEST_TIMEOUT = 15_000
export const AI_RETRIES = 0
export const ROLE_MANAGER = 'manager'
export const ROLE_AGENT = 'agent'
export const SENTIMENT_VALUES = ['Frustrated', 'Negative', 'Neutral', 'Positive'] as const
export const SEVERITY_VALUES = ['Critical', 'High', 'Medium', 'Low'] as const
export const CATEGORY_VALUES = ['Card payments', 'Digital banking', 'Fees & charges', 'Disputes', 'Other'] as const
