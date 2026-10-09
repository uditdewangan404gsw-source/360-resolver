import { z } from 'zod'

export const classificationSchema = z.object({
  category: z.enum(['Card payments', 'Digital banking', 'Fees & charges', 'Disputes', 'Other']),
  product: z.string().trim().min(1).max(100),
  severity: z.enum(['Critical', 'High', 'Medium', 'Low']),
  sentiment: z.enum(['Frustrated', 'Negative', 'Neutral', 'Positive']),
  language: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(500),
  recommendedAction: z.string().trim().min(1).max(500),
  possibleFraud: z.boolean(),
  fraudReason: z.string().trim().max(300),
  confidence: z.number().min(0).max(1),
  explanation: z.string().trim().min(1).max(300),
})

export const triageCorrectionSchema = classificationSchema
export type ComplaintClassification = z.infer<typeof classificationSchema>
export type TriageCorrection = z.infer<typeof triageCorrectionSchema>
