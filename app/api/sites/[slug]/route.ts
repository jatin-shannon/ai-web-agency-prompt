import { NextRequest } from 'next/server'
import { list } from '@vercel/blob'
import { getLeads } from '@/lib/leads-store'

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' }

  // 1. Try in-memory /tmp store (fast path — works on same Vercel instance)
  const leads = getLeads()
  const lead = leads.find(l => l.id === params.slug)
  if (lead?.htmlContent) {
    return new Response(lead.htmlContent, { headers: htmlHeaders })
  }

  // 2. Fetch from Vercel Blob (cross-instance fallback and post-tab-close recovery).
  //    We proxy through here so the browser always receives text/html without any
  //    Content-Disposition: attachment header that Blob CDN would add.
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
