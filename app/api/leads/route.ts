import { NextRequest, NextResponse } from 'next/server'
import { getLeads, updateLeadStatus, updateCommunication } from '@/lib/leads-store'

export async function GET() {
  return NextResponse.json(getLeads())
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Status update
  if (body.status) {
    updateLeadStatus(id, body.status)
    return NextResponse.json({ success: true })
  }

  // Communication update
  if (body.commId) {
    updateCommunication(id, body.commId, {
      content: body.content,
      approved: body.approved,
      sent: body.sent,
    })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}
