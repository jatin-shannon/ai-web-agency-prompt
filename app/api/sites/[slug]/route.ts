import { NextRequest } from 'next/server'
import { list } from '@vercel/blob'
import { getLeads } from '@/lib/leads-store'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  // Optional share-token protection. If SITE_SHARE_TOKEN is set in env vars,
  // the request must include ?token=<value> to view the site. This lets you
  // share a link with a prospective customer without exposing all sites publicly.
  const shareToken = process.env.SITE_SHARE_TOKEN
  if (shareToken) {
    const provided = request.nextUrl.searchParams.get('token')
    if (provided !== shareToken) {
      return new Response(
        '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:4rem"><h2>Preview unavailable</h2><p>This link requires an access token.</p></body></html>',
        { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    }
  }

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
