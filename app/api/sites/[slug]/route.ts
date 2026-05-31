import { NextRequest } from 'next/server'
import { list } from '@vercel/blob'
import { getLeads } from '@/lib/leads-store'
import { Lead } from '@/types'

async function findLead(slug: string): Promise<Lead | null> {
  // 1. Fast path: in-memory /tmp store (same Vercel instance)
  const leads = getLeads()
  const local = leads.find(l => l.id === slug)
  if (local) return local

  // 2. Fallback: fetch lead JSON from Blob (cross-instance / cold-start)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: `leads/${slug}.json` })
      if (blobs.length > 0) {
        const res = await fetch(blobs[0].url)
        if (res.ok) return (await res.json()) as Lead
      }
    } catch {}
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' }
  const provided = request.nextUrl.searchParams.get('token')

  const lead = await findLead(params.slug)

  // Token check: if the lead has a shareToken, the request must supply it.
  // No shareToken on the lead = site is publicly accessible (backward compat).
  if (lead?.shareToken && provided !== lead.shareToken) {
    return new Response(
      '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:4rem"><h2>Preview unavailable</h2><p>This preview link is no longer valid.</p></body></html>',
      { status: 403, headers: htmlHeaders },
    )
  }

  if (lead?.htmlContent) {
    return new Response(lead.htmlContent, { headers: htmlHeaders })
  }

  // Fetch HTML from Blob when htmlContent isn't in /tmp
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: `sites/${params.slug}.html` })
      if (blobs.length > 0) {
        const res = await fetch(blobs[0].url)
        if (res.ok) {
          return new Response(await res.text(), { headers: htmlHeaders })
        }
      }
    } catch {}
  }

  return new Response('Site not found', { status: 404 })
}
