import { NextRequest, NextResponse } from 'next/server'
import { getLeads, updateLeadStatus } from '@/lib/leads-store'

export async function GET() {
  return NextResponse.json(getLeads())
}

export async function PATCH(request: NextRequest) {
  const { id, status } = await request.json()
  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
  }
  updateLeadStatus(id, status)
  return NextResponse.json({ success: true })
}
