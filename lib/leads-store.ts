import fs from 'fs'
import { FieldValue } from 'firebase-admin/firestore'
import { getDb, isFirebaseConfigured } from './firebase-admin'
import { ActivityEntry, Lead } from '@/types'

// ── /tmp fallback (same-instance, ephemeral) ─────────────────────────────────

const LEADS_FILE = '/tmp/leads.json'

function readTmp(): Lead[] {
  try {
    if (!fs.existsSync(LEADS_FILE)) return []
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')) as Lead[]
  } catch { return [] }
}

function writeTmp(leads: Lead[]): void {
  try { fs.writeFileSync(LEADS_FILE, JSON.stringify(leads)) } catch {}
}

// ── Firestore operations ──────────────────────────────────────────────────────

const COL = 'leads'

async function fsGetLeads(): Promise<Lead[]> {
  const snap = await getDb().collection(COL).orderBy('createdAt').get()
  return snap.docs.map(d => d.data() as Lead)
}

async function fsSave(lead: Lead): Promise<void> {
  const now = new Date().toISOString()
  await getDb().collection(COL).doc(lead.id).set(
    { ...lead, updatedAt: now, createdAt: (lead as Lead & { createdAt?: string }).createdAt ?? now },
    { merge: true },
  )
}

async function fsPatch(id: string, patch: Record<string, unknown>): Promise<void> {
  await getDb().collection(COL).doc(id).update({ ...patch, updatedAt: new Date().toISOString() })
}

async function fsClear(): Promise<void> {
  const snap = await getDb().collection(COL).get()
  const batch = getDb().batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

// ── Public API (async, Firestore-first) ──────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  if (isFirebaseConfigured()) {
    try {
      const leads = await fsGetLeads()
      writeTmp(leads) // keep /tmp warm for the site proxy route
      return leads
    } catch (err) {
      console.error('Firestore getLeads failed, using /tmp:', err)
    }
  }
  return readTmp()
}

export async function saveLead(lead: Lead): Promise<void> {
  if (isFirebaseConfigured()) {
    try { await fsSave(lead) } catch (err) { console.error('Firestore saveLead failed:', err) }
  }
  // Always update /tmp so the site proxy route can serve HTML without Firestore
  const leads = readTmp()
  const idx = leads.findIndex(l => l.id === lead.id)
  if (idx >= 0) leads[idx] = lead; else leads.push(lead)
  writeTmp(leads)
}

export async function updateLeadStatus(id: string, status: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try { await fsPatch(id, { status }) } catch (err) { console.error('Firestore updateStatus failed:', err) }
  }
  const leads = readTmp()
  const lead = leads.find(l => l.id === id)
  if (lead) { lead.status = status; writeTmp(leads) }
}

export async function updateLeadNotes(id: string, notes: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try { await fsPatch(id, { notes }) } catch (err) { console.error('Firestore updateNotes failed:', err) }
  }
  const leads = readTmp()
  const lead = leads.find(l => l.id === id)
  if (lead) { lead.notes = notes; writeTmp(leads) }
}

export async function updateFollowUpDate(id: string, followUpDate: string | null): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await fsPatch(id, { followUpDate: followUpDate ?? FieldValue.delete() })
    } catch (err) { console.error('Firestore updateFollowUp failed:', err) }
  }
  const leads = readTmp()
  const lead = leads.find(l => l.id === id)
  if (lead) {
    if (followUpDate) lead.followUpDate = followUpDate; else delete lead.followUpDate
    writeTmp(leads)
  }
}

export async function addActivityEntry(leadId: string, entry: ActivityEntry): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await getDb().collection(COL).doc(leadId).update({
        activityLog: FieldValue.arrayUnion(entry),
        updatedAt: new Date().toISOString(),
      })
    } catch (err) { console.error('Firestore addActivity failed:', err) }
  }
  const leads = readTmp()
  const lead = leads.find(l => l.id === leadId)
  if (lead) {
    lead.activityLog = [...(lead.activityLog ?? []), entry]
    writeTmp(leads)
  }
}

export async function updateCommunication(
  leadId: string,
  commId: string,
  patch: { content?: string; approved?: boolean; sent?: boolean },
): Promise<void> {
  const leads = readTmp()
  const lead = leads.find(l => l.id === leadId)
  if (lead) {
    const comm = lead.communications?.find(c => c.id === commId)
    if (comm) {
      if (patch.content !== undefined) comm.content = patch.content
      if (patch.approved !== undefined) comm.approved = patch.approved
      if (patch.sent !== undefined) comm.sent = patch.sent
      writeTmp(leads)
    }
  }
  if (isFirebaseConfigured()) {
    try {
      // Re-read the updated lead from /tmp and persist the full comms array
      const updated = readTmp().find(l => l.id === leadId)
      if (updated) await fsPatch(leadId, { communications: updated.communications })
    } catch (err) { console.error('Firestore updateComm failed:', err) }
  }
}

export async function clearLeads(): Promise<void> {
  if (isFirebaseConfigured()) {
    try { await fsClear() } catch (err) { console.error('Firestore clearLeads failed:', err) }
  }
  writeTmp([])
}
