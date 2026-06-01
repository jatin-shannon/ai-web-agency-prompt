import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { put } from '@vercel/blob'
import { generateSite } from '@/lib/site-generator'
import { generateCommunications } from '@/lib/comms-generator'
import { scoreHtml } from '@/lib/quality-scorer'
import { getLeads, saveLead } from '@/lib/leads-store'
import { Lead, PlaceResult } from '@/types'

// Vercel Pro allows up to 300s; Hobby plan caps at 60s.
// Site generation with Claude takes ~15-30s per lead.
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const body = await request.json()
  const leadIds: string[] = body.leadIds ?? []
  const clientLeads: Lead[] = body.leads ?? []
  const extraInstructions: string = (body.extraInstructions ?? '').trim()

  if (leadIds.length === 0) {
    return new Response('leadIds is required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const source = clientLeads.length > 0 ? clientLeads : await getLeads()
        const toBuild = source.filter(l => leadIds.includes(l.id))

        if (toBuild.length === 0) {
          send({ type: 'error', message: 'No matching leads found — run discovery first' })
          controller.close()
          return
        }

        send({ type: 'status', message: `Building ${toBuild.length} site${toBuild.length !== 1 ? 's' : ''}…` })

        const built: Lead[] = []

        for (const lead of toBuild) {
          send({ type: 'status', message: `Generating website for ${lead.business}…` })

          // Reconstruct a PlaceResult-compatible object from the stored lead data
          const placeInput = {
            id: lead.id,
            displayName: { text: lead.business, languageCode: 'en' },
            formattedAddress: lead.address,
            nationalPhoneNumber: lead.phone,
            rating: lead.rating,
            userRatingCount: lead.reviews,
            primaryTypeDisplayName: { text: lead.type, languageCode: 'en' },
            regularOpeningHours: lead.openingHours
              ? { weekdayDescriptions: lead.openingHours }
              : undefined,
          } as PlaceResult

          let siteHtml: string
          try {
            siteHtml = await generateSite(placeInput, extraInstructions || undefined)
          } catch (err) {
            send({ type: 'error', message: `Site generation failed for ${lead.business}: ${String(err)}` })
            continue
          }

          const siteUrl = `/api/sites/${lead.id}`
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
              await put(`sites/${lead.id}.html`, siteHtml, {
                access: 'public',
                contentType: 'text/html',
                addRandomSuffix: false,
              })
              // Do NOT use blob.url as siteUrl — Vercel Blob CDN serves HTML with
              // Content-Disposition: attachment, causing browsers to download instead of render.
              // Always proxy through /api/sites/[slug] which sets the correct headers.
            } catch {
              send({ type: 'status', message: `Blob upload failed for ${lead.business}, site still accessible via preview` })
            }
          }

          send({ type: 'status', message: `Writing outreach scripts for ${lead.business}…` })
          let communications: Lead['communications'] = []
          try {
            communications = await generateCommunications({
              business: lead.business,
              type: lead.type,
              phone: lead.phone,
              address: lead.address,
              rating: lead.rating,
              reviews: lead.reviews,
              siteUrl,
            })
          } catch (err) {
            send({ type: 'error', message: `Script generation failed for ${lead.business}: ${String(err)}` })
          }

          const siteScore = scoreHtml(siteHtml)

          const updatedLead: Lead = {
            ...lead,
            stage: 'built',
            siteUrl,
            shareToken: lead.shareToken ?? randomBytes(16).toString('hex'),
            communications,
            siteScore,
            htmlContent: siteHtml,  // always stored — Blob is CDN cache, not the only copy
          }

          await saveLead(updatedLead)
          built.push(updatedLead)

          // Also upload to Blob CDN for faster delivery on repeat views.
          // Strip htmlContent from Blob JSON to keep it small (Firestore is the source of truth).
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
              const { htmlContent: _j, ...leadForBlob } = updatedLead
              await put(`leads/${lead.id}.json`, JSON.stringify(leadForBlob), {
                access: 'public',
                contentType: 'application/json',
                addRandomSuffix: false,
              })
            } catch { /* non-fatal */ }
          }

          const { htmlContent: _h, ...leadForStream } = updatedLead
          send({
            type: 'lead_complete',
            message: `Site + scripts ready for ${lead.business}`,
            lead: leadForStream,
          })
        }

        send({
          type: 'done',
          message: `Done — ${built.length} of ${toBuild.length} site${toBuild.length !== 1 ? 's' : ''} built`,
          leads: built.map(({ htmlContent: _h, ...l }) => l),
        })
      } catch (err) {
        send({ type: 'error', message: `Unexpected error: ${String(err)}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
