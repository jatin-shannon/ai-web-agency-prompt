import { NextRequest, NextResponse } from 'next/server'
import {
  getLeads,
  updateLeadStatus,
  updateCommunication,
  updateLeadNotes,
  updateFollowUpDate,
  addActivityEntry,
} from '@/lib/leads-store'
import { ActivityEntry } from '@/types'

export async function GET() {
  return NextResponse.json(getLeads())
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  if (body.status !== undefined) {
    updateLeadStatus(id, body.status)
    return NextResponse.json({ ok: true })
  }

  if (body.commId) {
    updateCommunication(id, body.commId, {
      content: body.content,
      approved: body.approved,
      sent: body.sent,
    })
    return NextResponse.json({ ok: true })
  }

  if (body.notes !== undefined) {
    updateLeadNotes(id, body.notes)
    return NextResponse.json({ ok: true })
  }

  if ('followUpDate' in body) {
    updateFollowUpDate(id, body.followUpDate ?? null)
    return NextResponse.json({ ok: true })
  }

  if (body.activityEntry) {
    addActivityEntry(id, body.activityEntry as ActivityEntry)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}
