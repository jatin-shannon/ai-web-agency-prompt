import { NextRequest } from 'next/server'
import { put } from '@vercel/blob'
import { searchBusinesses } from '@/lib/places'
import { checkWebsite } from '@/lib/website-checker'
import { generateSite } from '@/lib/site-generator'
import { generateCommunications } from '@/lib/comms-generator'
import { saveLead, clearLeads } from '@/lib/leads-store'
import { currentSpendUsd, remainingBudgetUsd, monthlyBudgetUsd } from '@/lib/usage-tracker'
import { Lead, PlaceResult } from '@/types'

function getBestCallTime(hours?: PlaceResult['regularOpeningHours']): string {
  if (!hours?.weekdayDescriptions?.length) return 'Business hours'
  const tuesday = hours.weekdayDescriptions[1] ?? ''
  if (tuesday.toLowerCase().includes('closed')) return 'Mon–Sat, 10am–12pm'
  return 'Tue–Thu, 10am–12pm'
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const city: string = (body.city ?? '').trim()
  const placeId: string = (body.placeId ?? '').trim()
  const searchMode: string = body.searchMode ?? 'area'
  const radiusKm: number = Math.max(1, Math.min(50, Number(body.radiusKm) || 5))

  if (!city) {
    return new Response('City is required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        clearLeads()

        const modeDesc =
          searchMode === 'radius' && placeId ? `within ${radiusKm} km of ${city}` : city
        send({ type: 'status', message: `Starting pipeline for ${modeDesc}…` })

        const spent = currentSpendUsd().toFixed(2)
        const remaining = remainingBudgetUsd().toFixed(2)
        const budget = monthlyBudgetUsd().toFixed(2)
        send({
          type: 'status',
          message: `Google budget: $${spent} spent · $${remaining} remaining of $${budget}/month limit`,
        })

        send({ type: 'status', message: 'Searching Google Maps for businesses…' })

        let businesses: PlaceResult[]
        try {
          businesses = await searchBusinesses(
            city,
            searchMode === 'radius' && placeId ? { placeId, radiusKm } : undefined,
          )
        } catch (err) {
          send({ type: 'error', message: `Google Places API error: ${String(err)}` })
          controller.close()
          return
        }

        send({ type: 'status', message: `Found ${businesses.length} listings to evaluate…` })

        const leads: Lead[] = []

        for (const biz of businesses) {
          if (leads.length >= 15) break

          const name = biz.displayName.text

          if (biz.businessStatus && biz.businessStatus !== 'OPERATIONAL') {
            send({ type: 'skip', message: `Skipping ${name} — not operational` })
            continue
          }
          if ((biz.userRatingCount ?? 0) < 5) {
            send({ type: 'skip', message: `Skipping ${name} — fewer than 5 reviews` })
            continue
          }
          if (!biz.nationalPhoneNumber) {
            send({ type: 'skip', message: `Skipping ${name} — no phone number` })
            continue
          }

          if (biz.websiteUri) {
            send({ type: 'status', message: `Checking ${name}'s website…` })
            const working = await checkWebsite(biz.websiteUri)
            if (working) {
              send({ type: 'skip', message: `Skipping ${name} — has a working website` })
              continue
            }
            // Facebook / Yelp / Instagram pages are treated as no real website — business qualifies
          }

          send({
            type: 'lead',
            message: `Qualified: ${name} · ${biz.rating ?? 'N/A'}★ · ${biz.userRatingCount ?? 0} reviews`,
          })
          send({ type: 'status', message: `Building website for ${name}…` })

          let siteHtml: string
          try {
            siteHtml = await generateSite(biz)
          } catch (err) {
            send({ type: 'error', message: `Failed to generate site for ${name}: ${String(err)}` })
            continue
          }

          const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

          // Upload HTML to Vercel Blob for a stable, globally-accessible URL.
          // Falls back to the /api/sites route when BLOB_READ_WRITE_TOKEN is not set.
          let siteUrl = `/api/sites/${slug}`
          if (process.env.BLOB_READ_WRITE_TOKEN) {
            try {
              const blob = await put(`sites/${slug}.html`, siteHtml, {
                access: 'public',
                contentType: 'text/html',
                addRandomSuffix: false,
              })
              siteUrl = blob.url
            } catch (err) {
              send({ type: 'status', message: `Blob upload failed for ${name}, using fallback URL` })
            }
          }

          send({ type: 'status', message: `Writing call scripts for ${name}…` })
          let communications: Lead['communications'] = []
          try {
            communications = await generateCommunications({
              business: name,
              type: biz.primaryTypeDisplayName?.text ?? 'Local Business',
              phone: biz.nationalPhoneNumber!,
              address: biz.formattedAddress,
              rating: biz.rating ?? 0,
              reviews: biz.userRatingCount ?? 0,
              siteUrl,
            })
          } catch (err) {
            send({ type: 'error', message: `Comms generation failed for ${name}: ${String(err)}` })
          }

          const lead: Lead = {
            id: slug,
            business: name,
            type: biz.primaryTypeDisplayName?.text ?? 'Local Business',
            phone: biz.nationalPhoneNumber!,
            address: biz.formattedAddress,
            rating: biz.rating ?? 0,
            reviews: biz.userRatingCount ?? 0,
            siteUrl,
            bestCallTime: getBestCallTime(biz.regularOpeningHours),
            hook: `${biz.rating ?? 0}★ · ${biz.userRatingCount ?? 0} reviews · no website`,
            status: '🔴 Not Contacted',
            communications,
            // Only store htmlContent when Blob is not available (fallback path)
            htmlContent: process.env.BLOB_READ_WRITE_TOKEN ? undefined : siteHtml,
          }

          saveLead(lead)
          leads.push(lead)

          const { htmlContent: _h, ...leadForStream } = lead
          send({ type: 'lead_complete', message: `Site + scripts ready for ${name}`, lead: leadForStream })
        }

        send({
          type: 'done',
          message: `Pipeline complete — ${leads.length} lead${leads.length !== 1 ? 's' : ''} generated`,
          leads: leads.map(({ htmlContent: _h, ...l }) => l),
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
