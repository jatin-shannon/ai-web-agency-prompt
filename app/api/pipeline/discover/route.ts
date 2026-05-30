import { NextRequest } from 'next/server'
import { searchBusinesses } from '@/lib/places'
import { checkWebsite } from '@/lib/website-checker'
import { saveLead, clearLeads } from '@/lib/leads-store'
import { currentSpendUsd, remainingBudgetUsd, monthlyBudgetUsd } from '@/lib/usage-tracker'
import { Lead, PlaceResult } from '@/types'

export const maxDuration = 60

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

        const modeDesc = searchMode === 'radius' && placeId ? `within ${radiusKm} km of ${city}` : city
        send({ type: 'status', message: `Scanning for leads in ${modeDesc}…` })

        const spent = currentSpendUsd().toFixed(2)
        const remaining = remainingBudgetUsd().toFixed(2)
        const budget = monthlyBudgetUsd().toFixed(2)
        send({
          type: 'status',
          message: `Google budget: $${spent} spent · $${remaining} remaining of $${budget}/month limit`,
        })

        send({ type: 'status', message: 'Searching 14 business categories on Google Maps…' })

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

        send({ type: 'status', message: `Found ${businesses.length} listings — checking for working websites…` })

        const leads: Lead[] = []

        for (const biz of businesses) {
          if (leads.length >= 30) break

          const name = biz.displayName.text

          if (biz.businessStatus && biz.businessStatus !== 'OPERATIONAL') {
            send({ type: 'skip', message: `${name} — not operational` })
            continue
          }
          if ((biz.userRatingCount ?? 0) < 5) {
            send({ type: 'skip', message: `${name} — fewer than 5 reviews` })
            continue
          }
          if (!biz.nationalPhoneNumber) {
            send({ type: 'skip', message: `${name} — no phone number` })
            continue
          }

          if (biz.websiteUri) {
            const working = await checkWebsite(biz.websiteUri)
            if (working) {
              send({ type: 'skip', message: `${name} — has a working website` })
              continue
            }
            // Facebook / Yelp / Instagram pages are not real websites — business qualifies
          }

          const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

          const lead: Lead = {
            id: slug,
            business: name,
            type: biz.primaryTypeDisplayName?.text ?? 'Local Business',
            phone: biz.nationalPhoneNumber!,
            address: biz.formattedAddress,
            rating: biz.rating ?? 0,
            reviews: biz.userRatingCount ?? 0,
            bestCallTime: getBestCallTime(biz.regularOpeningHours),
            hook: `${biz.rating ?? 0}★ · ${biz.userRatingCount ?? 0} reviews · no website`,
            status: '🔴 Not Contacted',
            stage: 'discovered',
            communications: [],
            openingHours: biz.regularOpeningHours?.weekdayDescriptions,
          }

          saveLead(lead)
          leads.push(lead)
          send({
            type: 'lead_discovered',
            message: `${name} · ${biz.rating ?? 'N/A'}★ · ${biz.userRatingCount ?? 0} reviews`,
            lead,
          })
        }

        send({
          type: 'done',
          message: leads.length > 0
            ? `Found ${leads.length} qualified lead${leads.length !== 1 ? 's' : ''} — select which to build, then click Build Sites`
            : 'No qualified leads found — try a different city or expand your search',
          leads,
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
