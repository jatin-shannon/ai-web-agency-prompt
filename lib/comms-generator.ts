import Anthropic from '@anthropic-ai/sdk'
import { Communication, Lead } from '@/types'

const client = new Anthropic()

const COMM_LABELS: Record<Communication['id'], string> = {
  'cold-call':    'Cold Call Script',
  'text-day0':    'Text — Day 0 (after call)',
  'text-day2':    'Text — Day 2 Follow-up',
  'text-day5':    'Text — Day 5 Follow-up',
  'text-day10':   'Text — Day 10 (final)',
  'email-intro':  'Email — Introduction',
}

const COMM_IDS: Communication['id'][] = [
  'cold-call', 'text-day0', 'text-day2', 'text-day5', 'text-day10', 'email-intro',
]

export async function generateCommunications(lead: Pick<Lead, 'business' | 'type' | 'phone' | 'rating' | 'reviews' | 'address' | 'siteUrl'>): Promise<Communication[]> {
  const requestParams = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user' as const,
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
  "text-day10": "<SMS under 160 chars. Final message. Graceful, no pressure close. Wish them well.>",
  "email-intro": "<Professional intro email. Format as: Subject: [subject line]\\n\\n[2-3 paragraph body — introduce yourself, mention you built their site and why it matters to their business, include [SITE_URL], end with a clear next step]. Sign off with your name placeholder. Under 300 words total.>"
}`,
      },
    ],
  }

  let raw: string | undefined
  let lastErr: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const message = await client.messages.create(requestParams)
      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Unexpected Claude response')
      raw = content.text.trim()
      break
    } catch (err) {
      lastErr = err
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  if (raw === undefined) throw lastErr

  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

  const parsed = JSON.parse(raw) as Record<Communication['id'], string>

  return COMM_IDS.map(id => ({
    id,
    label: COMM_LABELS[id],
    content: parsed[id] ?? '',
    approved: false,
    sent: false,
  }))
}
