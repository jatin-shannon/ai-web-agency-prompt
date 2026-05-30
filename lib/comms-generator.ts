import Anthropic from '@anthropic-ai/sdk'
import { Communication, Lead } from '@/types'

const client = new Anthropic()

const COMM_LABELS: Record<Communication['id'], string> = {
  'cold-call':    'Cold Call Script',
  'text-day0':    'Text — Day 0 (after call)',
  'text-day2':    'Text — Day 2 Follow-up',
  'text-day5':    'Text — Day 5 Follow-up',
  'text-day10':   'Text — Day 10 (final)',
}

export async function generateCommunications(lead: Pick<Lead, 'business' | 'type' | 'phone' | 'rating' | 'reviews' | 'address' | 'siteUrl'>): Promise<Communication[]> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Generate personalized outreach scripts for this local business. Return ONLY valid JSON — no explanation, no markdown.

BUSINESS:
Name: ${lead.business}
Type: ${lead.type}
Phone: ${lead.phone}
Address: ${lead.address}
Rating: ${lead.rating}★ (${lead.reviews} reviews)
Site URL: [SITE_URL]

Generate exactly this JSON shape:
{
  "cold-call": "<3-4 sentence cold call script. Natural, direct. Opens with 'Hi, is this the owner of ${lead.business}?'. Mentions you already built their site. Asks if you can text the link. References their rating/reviews naturally.>",
  "text-day0": "<SMS under 160 chars to send right after the call. Casual. Includes [SITE_URL]. References ${lead.business} by name.>",
  "text-day2": "<SMS under 160 chars. Day 2 check-in. Warm, not pushy. References ${lead.business}.>",
  "text-day5": "<SMS under 160 chars. Day 5. Gentle urgency — mention you're taking on more businesses in the area this month.>",
  "text-day10": "<SMS under 160 chars. Final message. Graceful, no pressure close. Wish them well.>"
}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response')

  let raw = content.text.trim()
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

  const parsed = JSON.parse(raw) as Record<Communication['id'], string>

  return (['cold-call', 'text-day0', 'text-day2', 'text-day5', 'text-day10'] as Communication['id'][]).map(id => ({
    id,
    label: COMM_LABELS[id],
    content: parsed[id] ?? '',
    approved: false,
    sent: false,
  }))
}
