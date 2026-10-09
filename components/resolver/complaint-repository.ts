'use client'

import { initialComplaints, makeComplaint, type Complaint } from './types'

export type NewComplaintInput = Pick<Complaint, 'subject' | 'customerRef' | 'channel' | 'category' | 'severity' | 'message'>

export interface ComplaintRepository {
  getSnapshot(): Complaint[]
  getServerSnapshot(): Complaint[]
  subscribe(listener: () => void): () => void
  list(): Promise<Complaint[]>
  getById(id: string): Promise<Complaint | null>
  create(input: NewComplaintInput): Promise<Complaint>
  update(id: string, changes: Partial<Complaint>): Promise<Complaint | null>
}

export class MockComplaintRepository implements ComplaintRepository {
  private complaints = initialComplaints.map((complaint) => ({
    ...complaint,
    duplicateIds: [...complaint.duplicateIds],
    events: complaint.events.map((event) => ({ ...event })),
  }))
  private listeners = new Set<() => void>()

  getSnapshot = () => this.complaints
  getServerSnapshot = () => initialComplaints

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async list() {
    return this.getSnapshot()
  }

  async getById(id: string) {
    return this.complaints.find((complaint) => complaint.id === id) ?? null
  }

  async create(input: NewComplaintInput) {
    const complaint = makeComplaint(input, this.complaints.length)
    this.complaints = [complaint, ...this.complaints]
    this.publish()
    return complaint
  }

  async update(id: string, changes: Partial<Complaint>) {
    const current = this.complaints.find((complaint) => complaint.id === id)
    if (!current) return null

    const updated = { ...current, ...changes, id: current.id }
    this.complaints = this.complaints.map((complaint) => complaint.id === id ? updated : complaint)
    this.publish()
    return updated
  }

  private publish() {
    this.listeners.forEach((listener) => listener())
  }
}

export const complaintRepository: ComplaintRepository = new MockComplaintRepository()

export function subscribeToComplaints(listener: () => void) {
  return complaintRepository.subscribe(listener)
}

export function getComplaintSnapshot() {
  return complaintRepository.getSnapshot()
}

export function getServerComplaintSnapshot() {
  return complaintRepository.getServerSnapshot()
}

export function createComplaintRecord(input: NewComplaintInput) {
  return complaintRepository.create(input)
}

export function updateComplaintRecord(id: string, changes: Partial<Complaint>) {
  return complaintRepository.update(id, changes)
}

export function getComplaintById(id: string) {
  return complaintRepository.getById(id)
}

export function listComplaints() {
  return complaintRepository.list()
}

/** Replace this in-memory adapter with a Supabase-backed ComplaintRepository when persistence is enabled. */
export type { Complaint }

export const complaintSeed = initialComplaints

export const complaintPersistenceContract = {
  list: () => complaintRepository.list(),
  getById: (id) => complaintRepository.getById(id),
  create: (input) => complaintRepository.create(input),
  update: (id, changes) => complaintRepository.update(id, changes),
} as const

export const complaintExternalStore = {
  subscribe: subscribeToComplaints,
  getSnapshot: getComplaintSnapshot,
  getServerSnapshot: getServerComplaintSnapshot,
}

export const complaintApi = {
  list: listComplaints,
  getById: getComplaintById,
  create: createComplaintRecord,
  update: updateComplaintRecord,
  subscribe: subscribeToComplaints,
}
