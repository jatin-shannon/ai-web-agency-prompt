import fs from 'fs'
import { ActivityEntry, Lead } from '@/types'

// /tmp is the only writable directory in Vercel serverless functions
const LEADS_FILE = '/tmp/leads.json'

export function getLeads(): Lead[] {
  try {
    if (!fs.existsSync(LEADS_FILE)) return []
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')) as Lead[]
  } catch {
    return []
  }
}

function write(leads: Lead[]): void {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads))
}

export function saveLead(lead: Lead): void {
  const leads = getLeads()
  const idx = leads.findIndex(l => l.id === lead.id)
  if (idx >= 0) leads[idx] = lead
  else leads.push(lead)
  write(leads)
}

export function updateLeadStatus(id: string, status: string): void {
  const leads = getLeads()
  const lead = leads.find(l => l.id === id)
  if (!lead) return
  lead.status = status
  write(leads)
}

export function updateLeadNotes(id: string, notes: string): void {
  const leads = getLeads()
  const lead = leads.find(l => l.id === id)
  if (!lead) return
  lead.notes = notes
  write(leads)
}

export function updateFollowUpDate(id: string, followUpDate: string | null): void {
  const leads = getLeads()
  const lead = leads.find(l => l.id === id)
  if (!lead) return
  if (followUpDate) lead.followUpDate = followUpDate
  else delete lead.followUpDate
  write(leads)
}

export function addActivityEntry(leadId: string, entry: ActivityEntry): void {
  const leads = getLeads()
  const lead = leads.find(l => l.id === leadId)
  if (!lead) return
  lead.activityLog = [...(lead.activityLog ?? []), entry]
  write(leads)
}

export function updateCommunication(
  leadId: string,
  commId: string,
  patch: { content?: string; approved?: boolean; sent?: boolean },
): void {
  const leads = getLeads()
  const lead = leads.find(l => l.id === leadId)
  if (!lead) return
  const comm = lead.communications?.find(c => c.id === commId)
  if (!comm) return
  if (patch.content !== undefined) comm.content = patch.content
  if (patch.approved !== undefined) comm.approved = patch.approved
  if (patch.sent !== undefined) comm.sent = patch.sent
  write(leads)
}

export function clearLeads(): void {
  write([])
}

