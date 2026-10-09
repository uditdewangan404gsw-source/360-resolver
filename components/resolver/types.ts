export type ViewKey =
  | 'dashboard'
  | 'inbox'
  | 'new'
  | 'sla'
  | 'duplicates'
  | 'analytics'
  | 'knowledge'
  | 'team'
  | 'settings'

export type UserRole = 'Manager' | 'Agent'
export type ComplaintStatus = 'Open' | 'In progress' | 'Pending customer' | 'Resolved'
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type Channel = 'Email' | 'Phone' | 'Branch' | 'Web form' | 'Mobile app' | 'Social'

export type Complaint = {
  id: string
  subject: string
  customerRef: string
  channel: Channel
  category: string
  severity: Severity
  sentiment: 'Frustrated' | 'Negative' | 'Neutral' | 'Positive'
  assignedTo: string
  status: ComplaintStatus
  minutesToSla: number
  received: string
  message: string
  summary: string
  recommendedAction: string
  responseDraft: string
  duplicateIds: string[]
  events: { time: string; title: string; detail: string; type: 'system' | 'agent' | 'customer' }[]
}

export type TeamMember = {
  name: string
  initials: string
  role: UserRole
  active: number
  resolvedToday: number
  avatarColor: string
}

export const navigation: { key: ViewKey; label: string; icon: string; section?: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', section: 'WORKSPACE' },
  { key: 'inbox', label: 'Complaint Inbox', icon: 'Inbox', section: 'WORKSPACE' },
  { key: 'new', label: 'New Complaint', icon: 'CirclePlus', section: 'WORKSPACE' },
  { key: 'sla', label: 'SLA & Escalations', icon: 'AlarmClock', section: 'OPERATIONS' },
  { key: 'duplicates', label: 'Duplicate Clusters', icon: 'Copy', section: 'OPERATIONS' },
  { key: 'analytics', label: 'Trends & Analytics', icon: 'ChartNoAxesCombined', section: 'INSIGHTS' },
  { key: 'knowledge', label: 'Knowledge Base', icon: 'BookOpen', section: 'INSIGHTS' },
  { key: 'team', label: 'Team Management', icon: 'UsersRound', section: 'ADMINISTRATION' },
  { key: 'settings', label: 'Settings', icon: 'Settings2', section: 'ADMINISTRATION' },
]

export const teamMembers: TeamMember[] = [
  { name: 'Priya Shah', initials: 'PS', role: 'Manager', active: 12, resolvedToday: 18, avatarColor: 'bg-violet-100 text-violet-700' },
  { name: 'Marcus Chen', initials: 'MC', role: 'Agent', active: 8, resolvedToday: 14, avatarColor: 'bg-blue-100 text-blue-700' },
  { name: 'Amina Yusuf', initials: 'AY', role: 'Agent', active: 11, resolvedToday: 12, avatarColor: 'bg-emerald-100 text-emerald-700' },
  { name: 'Daniel Brooks', initials: 'DB', role: 'Agent', active: 6, resolvedToday: 16, avatarColor: 'bg-amber-100 text-amber-700' },
  { name: 'Sofia Martinez', initials: 'SM', role: 'Agent', active: 9, resolvedToday: 11, avatarColor: 'bg-rose-100 text-rose-700' },
]

const event = (time: string, title: string, detail: string, type: Complaint['events'][number]['type'] = 'system') => ({ time, title, detail, type })

export const initialComplaints: Complaint[] = [
  {
    id: 'CMP-28491', subject: 'Card charged twice at Greenfield Market', customerRef: 'CUS-840219', channel: 'Mobile app', category: 'Card payments', severity: 'Critical', sentiment: 'Frustrated', assignedTo: 'Marcus Chen', status: 'In progress', minutesToSla: 38, received: '09:42 AM',
    message: 'I was charged twice for the same grocery purchase at Greenfield Market yesterday. The first payment was $86.42 and then I saw another $86.42 charge this morning. I need this fixed before my rent payment goes out.',
    summary: 'Customer reports a duplicate $86.42 card transaction at Greenfield Market. A second charge posted the following morning, creating concern about an upcoming rent payment.',
    recommendedAction: 'Verify both transaction IDs in the card ledger. If both are settled, initiate a duplicate-charge investigation and provide a provisional credit review timeline.',
    responseDraft: 'Hello, thank you for bringing the duplicate charge to our attention. I understand how concerning this is, especially with an upcoming payment. We are reviewing both $86.42 transactions now and will update you as soon as the review is complete. Your case reference is CMP-28491.', duplicateIds: ['CMP-28470'],
    events: [event('09:42 AM', 'Complaint received', 'Submitted through the mobile app', 'customer'), event('09:43 AM', 'AI classification complete', 'Card payments · Critical · Frustrated'), event('09:44 AM', 'Assigned to Marcus Chen', 'Auto-assigned by card payments queue', 'agent')],
  },
  {
    id: 'CMP-28490', subject: 'Mortgage payment not reflected', customerRef: 'CUS-771035', channel: 'Phone', category: 'Mortgage servicing', severity: 'High', sentiment: 'Negative', assignedTo: 'Amina Yusuf', status: 'Open', minutesToSla: 74, received: '09:31 AM',
    message: 'My mortgage payment was taken from my checking account four days ago, but the loan portal still says I am late. I called yesterday and was told it would update overnight. It has not.',
    summary: 'Payment debited four days prior is not reflected in the mortgage portal despite a previous service call. Customer is concerned about a late-payment marker.',
    recommendedAction: 'Confirm payment posting and remove any incorrect late status. Explain posting timelines and document the earlier call.',
    responseDraft: 'Hello, I’m sorry the payment is not yet showing in your loan portal. We are checking the transfer and your prior call so we can correct any inaccurate status. We will follow up with an update shortly.', duplicateIds: [],
    events: [event('09:31 AM', 'Complaint received', 'Logged by phone support', 'customer'), event('09:32 AM', 'AI classification complete', 'Mortgage servicing · High · Negative')],
  },
  {
    id: 'CMP-28488', subject: 'Unable to access online banking', customerRef: 'CUS-419802', channel: 'Web form', category: 'Digital banking', severity: 'Medium', sentiment: 'Negative', assignedTo: 'Sofia Martinez', status: 'In progress', minutesToSla: 192, received: '09:18 AM',
    message: 'I have been locked out since the app update. Password reset keeps sending me back to the login screen. I need to transfer money today.',
    summary: 'Customer is unable to sign in after a recent app update; password reset loop is blocking an urgent transfer.',
    recommendedAction: 'Verify identity using approved procedures, check authentication status, and provide an assisted transfer option if eligible.',
    responseDraft: 'Hello, we’re sorry you’re having trouble signing in. We can help restore access after completing a quick identity check. If you need to make a transfer today, please let us know and we can review available assisted options.', duplicateIds: ['CMP-28412'],
    events: [event('09:18 AM', 'Complaint received', 'Submitted through the web form', 'customer'), event('09:20 AM', 'Assigned to Sofia Martinez', 'Digital banking queue', 'agent')],
  },
  {
    id: 'CMP-28485', subject: 'Dispute status has not changed', customerRef: 'CUS-092761', channel: 'Email', category: 'Disputes', severity: 'High', sentiment: 'Frustrated', assignedTo: 'Daniel Brooks', status: 'Open', minutesToSla: 268, received: '08:57 AM',
    message: 'I submitted a dispute for a $219.00 online order three weeks ago. The merchant never shipped it and the case status has not changed at all.',
    summary: 'Customer requests an update on a $219.00 merchandise-not-received dispute submitted three weeks ago.',
    recommendedAction: 'Review the dispute stage, check for outstanding documentation, and provide a clear next update date.',
    responseDraft: 'Hello, thank you for checking in. We are reviewing the current stage of your $219.00 dispute and whether any additional information is needed. We will share a status update and the next expected milestone.', duplicateIds: [],
    events: [event('08:57 AM', 'Complaint received', 'Received via customer service email', 'customer'), event('09:02 AM', 'Routed to Disputes', 'Assigned to Daniel Brooks', 'agent')],
  },
  {
    id: 'CMP-28482', subject: 'Unexpected monthly account fee', customerRef: 'CUS-621594', channel: 'Branch', category: 'Fees & charges', severity: 'Medium', sentiment: 'Negative', assignedTo: 'Unassigned', status: 'Open', minutesToSla: 344, received: '08:44 AM',
    message: 'I noticed a $12 monthly fee on my statement. I thought this account had no monthly fee when I opened it.',
    summary: 'Customer questions a $12 monthly fee and recalls opening an account without monthly charges.',
    recommendedAction: 'Check the account product, fee waiver eligibility, and the disclosures provided at account opening.',
    responseDraft: 'Hello, we can review the $12 fee and the terms for your account. We’ll check whether a waiver applies and explain what options are available.', duplicateIds: [],
    events: [event('08:44 AM', 'Complaint received', 'Walk-in branch referral', 'customer'), event('08:46 AM', 'AI classification complete', 'Fees & charges · Medium · Negative')],
  },
  {
    id: 'CMP-28479', subject: 'Cash withdrawal limit not explained', customerRef: 'CUS-348156', channel: 'Phone', category: 'Account access', severity: 'Low', sentiment: 'Neutral', assignedTo: 'Marcus Chen', status: 'Pending customer', minutesToSla: 525, received: '08:29 AM',
    message: 'I tried to withdraw cash but reached a limit I did not know about. Can someone explain how the daily limit works?',
    summary: 'Customer requests a clear explanation of daily cash withdrawal limits after a declined withdrawal.',
    recommendedAction: 'Explain standard limits and the process for requesting a temporary increase, subject to verification.',
    responseDraft: 'Hello, daily cash withdrawal limits help protect your account. We can explain the current limit for your account and review whether a temporary increase is available after verification.', duplicateIds: [],
    events: [event('08:29 AM', 'Complaint received', 'Logged by phone support', 'customer'), event('08:50 AM', 'Information requested', 'Agent requested preferred callback time', 'agent')],
  },
  {
    id: 'CMP-28476', subject: 'Cash deposit delayed posting', customerRef: 'CUS-510937', channel: 'Branch', category: 'Deposits', severity: 'Medium', sentiment: 'Neutral', assignedTo: 'Amina Yusuf', status: 'In progress', minutesToSla: 615, received: '08:14 AM',
    message: 'I made a cash deposit at the downtown branch yesterday afternoon. It is not showing in my available balance this morning.',
    summary: 'Cash deposit made yesterday afternoon is not reflected in the available balance; customer wants posting timing clarified.',
    recommendedAction: 'Review deposit receipt and availability schedule; confirm whether a standard hold or processing delay applies.',
    responseDraft: 'Hello, we’ll review the deposit receipt and posting details for you. Some deposits may have an availability schedule, and we’ll confirm the timing that applies to this transaction.', duplicateIds: [],
    events: [event('08:14 AM', 'Complaint received', 'Branch referral entered by staff', 'customer'), event('08:22 AM', 'Assigned to Amina Yusuf', 'Deposits queue', 'agent')],
  },
  {
    id: 'CMP-28470', subject: 'Duplicate card transaction at Greenfield Market', customerRef: 'CUS-840219', channel: 'Mobile app', category: 'Card payments', severity: 'High', sentiment: 'Frustrated', assignedTo: 'Marcus Chen', status: 'Open', minutesToSla: 26, received: '07:56 AM',
    message: 'There are two identical charges for $86.42 at Greenfield Market on my card. I only bought groceries once.',
    summary: 'Earlier report of two identical $86.42 charges at Greenfield Market; likely related to CMP-28491.',
    recommendedAction: 'Compare merchant reference numbers and payment status with CMP-28491 before any action. Do not merge or close automatically.',
    responseDraft: 'Hello, we’re reviewing the two charges you reported. We’ll compare the transaction details and keep you updated on the outcome.', duplicateIds: ['CMP-28491'],
    events: [event('07:56 AM', 'Complaint received', 'Submitted through the mobile app', 'customer'), event('08:02 AM', 'Duplicate candidate detected', 'Potentially related to CMP-28491'), event('08:06 AM', 'Assigned to Marcus Chen', 'Card payments queue', 'agent')],
  },
  {
    id: 'CMP-28465', subject: 'Address update confirmation missing', customerRef: 'CUS-066408', channel: 'Social', category: 'Account maintenance', severity: 'Low', sentiment: 'Neutral', assignedTo: 'Sofia Martinez', status: 'Resolved', minutesToSla: -120, received: '07:41 AM',
    message: 'I updated my mailing address last week but never got confirmation. Can you check whether it saved?',
    summary: 'Customer needs confirmation that a mailing address update was received and saved.',
    recommendedAction: 'Confirm the address is on file without repeating sensitive details in an unsecured channel.',
    responseDraft: 'Hello, we can confirm the update is on file. For your security, we won’t repeat the address in this message.', duplicateIds: [],
    events: [event('07:41 AM', 'Complaint received', 'Received through monitored social queue', 'customer'), event('08:10 AM', 'Address update confirmed', 'Resolved by Sofia Martinez', 'agent')],
  },
]

export const volumeData = [
  { day: 'Mon', received: 112, resolved: 98 },
  { day: 'Tue', received: 128, resolved: 116 },
  { day: 'Wed', received: 105, resolved: 119 },
  { day: 'Thu', received: 149, resolved: 121 },
  { day: 'Fri', received: 137, resolved: 130 },
  { day: 'Sat', received: 88, resolved: 95 },
  { day: 'Sun', received: 94, resolved: 82 },
]

export const categoryData = [
  { name: 'Card payments', value: 31, color: '#315fce' },
  { name: 'Digital banking', value: 24, color: '#5482df' },
  { name: 'Fees & charges', value: 18, color: '#7aa0ea' },
  { name: 'Disputes', value: 15, color: '#a4beef' },
  { name: 'Other', value: 12, color: '#d0dcf4' },
]

export const channelData = [
  { name: 'Mobile app', value: 38 },
  { name: 'Phone', value: 26 },
  { name: 'Web form', value: 17 },
  { name: 'Branch', value: 12 },
  { name: 'Email / social', value: 7 },
]

export const policyArticles = [
  { title: 'Card transaction disputes', category: 'Cards', updated: 'Updated 2 days ago', text: 'How to investigate duplicate, unauthorized, or incorrectly posted card transactions. Verify transaction status and merchant references before offering next steps.' },
  { title: 'Digital banking access recovery', category: 'Digital banking', updated: 'Updated 1 week ago', text: 'Identity verification steps, password reset troubleshooting, and safe assisted access options for customers locked out of digital banking.' },
  { title: 'Account fees and waivers', category: 'Accounts', updated: 'Updated 3 days ago', text: 'Overview of common account fees, eligibility requirements for waivers, and how to explain account-specific terms clearly.' },
  { title: 'Mortgage payment posting', category: 'Loans', updated: 'Updated 6 days ago', text: 'Payment posting timelines, suspense account checks, and how to correct inaccurate delinquency indicators.' },
  { title: 'Customer communication standards', category: 'Service', updated: 'Updated 1 day ago', text: 'Use empathetic, plain-language responses. Never promise an outcome before review. Confirm next steps and expected updates.' },
  { title: 'Complaint handling and escalation', category: 'Service', updated: 'Updated 4 days ago', text: 'Record the customer’s concern accurately, keep ownership clear, and escalate high-impact cases using the configured routing rules.' },
]

export function formatSla(minutes: number) {
  if (minutes < 0) return 'Overdue'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return `${hours}h ${remaining}m`
}

export function isAtRisk(complaint: Complaint) {
  return complaint.minutesToSla <= 120 && complaint.status !== 'Resolved'
}

export function makeComplaint(input: Pick<Complaint, 'subject' | 'customerRef' | 'channel' | 'category' | 'severity' | 'message'>, currentCount: number): Complaint {
  const id = `CMP-${String(28500 + currentCount).padStart(5, '0')}`
  return {
    ...input, id, sentiment: 'Neutral', assignedTo: 'Unassigned', status: 'Open', minutesToSla: 480,
    received: 'Just now', summary: `Customer reports: ${input.message.slice(0, 138)}${input.message.length > 138 ? '…' : ''}`,
    recommendedAction: 'Review the customer’s concern, verify the relevant account records, and confirm the next update with the customer.',
    responseDraft: `Hello, thank you for contacting us about ${input.subject.toLowerCase()}. We’re reviewing your concern and will follow up with an update. Your case reference is ${id}.`,
    duplicateIds: [], events: [{ time: 'Just now', title: 'Complaint received', detail: 'Created in the Resolver demo workspace', type: 'customer' }],
  }
}
