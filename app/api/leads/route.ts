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
  return NextResponse.json(await getLeads())
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  if (body.status !== undefined) {
    await updateLeadStatus(id, body.status)
    return NextResponse.json({ ok: true })
  }

  if (body.commId) {
    await updateCommunication(id, body.commId, {
      content: body.content,
      approved: body.approved,
      sent: body.sent,
    })
    return NextResponse.json({ ok: true })
  }

  if (body.notes !== undefined) {
    await updateLeadNotes(id, body.notes)
    return NextResponse.json({ ok: true })
  }

  if ('followUpDate' in body) {
    await updateFollowUpDate(id, body.followUpDate ?? null)
    return NextResponse.json({ ok: true })
  }

  if (body.activityEntry) {
    await addActivityEntry(id, body.activityEntry as ActivityEntry)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}
