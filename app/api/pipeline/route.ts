import { NextRequest } from 'next/server'
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
        send({ type: 'status', message: `Starting pipeline for ${city}…` })

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
          businesses = await searchBusinesses(city)
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

          send({ type: 'status', message: `Writing call scripts for ${name}…` })
          let communications: Lead['communications'] = []
          try {
            const partialLead = {
              id: slug,
              business: name,
              type: biz.primaryTypeDisplayName?.text ?? 'Local Business',
              phone: biz.nationalPhoneNumber!,
              address: biz.formattedAddress,
              rating: biz.rating ?? 0,
              reviews: biz.userRatingCount ?? 0,
              siteUrl: `/api/sites/${slug}`,
              bestCallTime: getBestCallTime(biz.regularOpeningHours),
              hook: `${biz.rating ?? 0}★ · ${biz.userRatingCount ?? 0} reviews · no website`,
              status: '🔴 Not Contacted',
              communications: [],
            }
            communications = await generateCommunications(partialLead)
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
            siteUrl: `/api/sites/${slug}`,
            bestCallTime: getBestCallTime(biz.regularOpeningHours),
            hook: `${biz.rating ?? 0}★ · ${biz.userRatingCount ?? 0} reviews · no website`,
            status: '🔴 Not Contacted',
            communications,
            htmlContent: siteHtml,
          }

          saveLead(lead)
          leads.push(lead)

          // Don't send htmlContent over SSE — too large
          const { htmlContent: _, ...leadWithoutHtml } = lead
          send({ type: 'lead_complete', message: `Site + scripts ready for ${name}`, lead: leadWithoutHtml })
        }

        send({
          type: 'done',
          message: `Pipeline complete — ${leads.length} lead${leads.length !== 1 ? 's' : ''} generated`,
          leads: leads.map(({ htmlContent: _, ...l }) => l),
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
