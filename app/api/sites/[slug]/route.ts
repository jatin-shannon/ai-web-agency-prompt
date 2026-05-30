import { NextRequest } from 'next/server'
import { getLeads } from '@/lib/leads-store'

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const leads = getLeads()
  const lead = leads.find(l => l.id === params.slug)

  if (!lead?.htmlContent) {
    return new Response('Site not found', { status: 404 })
  }

  return new Response(lead.htmlContent, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
