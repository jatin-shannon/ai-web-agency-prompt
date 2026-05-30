import fs from 'fs'
import path from 'path'
import { Lead } from '@/types'

const LEADS_FILE = path.join(process.cwd(), 'data', 'leads.json')

export function getLeads(): Lead[] {
  try {
    if (!fs.existsSync(LEADS_FILE)) return []
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')) as Lead[]
  } catch {
    return []
  }
}

export function saveLead(lead: Lead): void {
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true })
  const leads = getLeads()
  const idx = leads.findIndex(l => l.id === lead.id)
  if (idx >= 0) leads[idx] = lead
  else leads.push(lead)
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2))
}

export function updateLeadStatus(id: string, status: string): void {
  const leads = getLeads()
  const lead = leads.find(l => l.id === id)
  if (!lead) return
  lead.status = status
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2))
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
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2))
}

export function clearLeads(): void {
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true })
  fs.writeFileSync(LEADS_FILE, '[]')

  const sitesDir = path.join(process.cwd(), 'public', 'sites')
  if (fs.existsSync(sitesDir)) {
    for (const f of fs.readdirSync(sitesDir)) {
      if (f.endsWith('.html')) {
        fs.unlinkSync(path.join(sitesDir, f))
      }
    }
  }
}
