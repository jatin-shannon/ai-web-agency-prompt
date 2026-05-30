import Anthropic from '@anthropic-ai/sdk'
import { PlaceResult } from '@/types'

const client = new Anthropic()

export async function generateSite(place: PlaceResult): Promise<string> {
  const name = place.displayName.text
  const type = place.primaryTypeDisplayName?.text ?? 'Local Business'
  const phone = place.nationalPhoneNumber ?? ''
  const phoneDigits = phone.replace(/\D/g, '')
  const hours = place.regularOpeningHours?.weekdayDescriptions?.join('\n') ?? 'Call for hours'
  const reviewTexts = (place.reviews ?? [])
    .slice(0, 4)
    .filter(r => r.text?.text)
    .map(r => `"${r.text!.text}" — ${r.authorAttribution?.displayName ?? 'Customer'}, ${r.rating}★`)
    .join('\n')

  const requestParams = {
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [
      {
        role: 'user' as const,
        content: `Build a complete, polished, single-file HTML website for this local business. Output ONLY valid HTML starting with <!DOCTYPE html> — no markdown, no backticks, no explanation. Just the raw HTML file.

BUSINESS DATA:
Name: ${name}
Type: ${type}
Address: ${place.formattedAddress}
Phone: ${phone}
Rating: ${place.rating ?? 'N/A'} stars (${place.userRatingCount ?? 0} reviews)
Hours:
${hours}
${reviewTexts ? `\nReal customer reviews:\n${reviewTexts}` : ''}

DESIGN REQUIREMENTS:
- Parallax scrolling hero section — full-viewport, use a real Unsplash image URL matching this exact business type
- Smooth scroll-triggered fade/slide animations using Intersection Observer (no dependencies)
- Glassmorphism or frosted-glass accent cards where appropriate
- Color palette and typography tuned to this business type (e.g. taqueria → warm terracotta/cream; barbershop → navy/gold; dental → clean white/teal)
- Fully mobile responsive with hamburger nav for screens below 768px
- Hover effects on buttons, service cards, gallery images
- Real Unsplash photo URLs for all images — use direct image URLs (e.g. https://images.unsplash.com/photo-...) matched to the business type

REQUIRED SECTIONS (in this order):
1. NAV — sticky, translucent on scroll, logo/name + links
2. HERO — full-viewport parallax image, large display font, tagline pulled from review sentiment, primary CTA button, star rating badge if 4.5+
3. ABOUT — 2–3 paragraphs, human copywriter voice. Reference real specifics. NEVER open with "Welcome to ${name}! We are passionate about..."
4. SERVICES/MENU — use CSS grid cards. Restaurants: realistic menu by category (Appetizers, Mains, Drinks, Desserts) with prices. Service businesses: service cards with description + price range.
5. GALLERY — 4–6 Unsplash images in a CSS grid or masonry. Add HTML comment on each: <!-- Replace with your own photo -->
6. REVIEWS — real quotes from the data above, displayed as cards with name, star rating, and quote. If fewer than 3 provided, add realistic filler and mark: <!-- Suggested — replace with real review -->
7. LOCATION & HOURS — address, hours table, click-to-call: <a href="tel:+1${phoneDigits}">${phone}</a>, map placeholder: <!-- Embed Google Maps iframe here -->
8. FOOTER — name, address, phone, placeholder social icons, copyright ${new Date().getFullYear()}

COPYWRITING RULES:
- Every word of copy is unique to this exact business
- Sound like a talented human copywriter who visited the place — warm, specific, real
- Mention specifics from the reviews if any are provided
- CTAs feel natural: "Come hungry" / "Book your spot" / "Call us today" — not generic "Click here"
- Match the voice to the business personality

Put all CSS in <style> tags in <head>. Put all JS in <script> tags before </body>. No external CSS or JS libraries — vanilla only.`,
      },
    ],
  }

  // Retry up to 3 times on transient network errors ("Load failed", connection reset, etc.)
  let lastErr: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const message = await client.messages.create(requestParams)
      const content = message.content[0]
      if (content.type !== 'text') throw new Error('Unexpected Claude response type')

      let html = content.text.trim()
      // Strip any accidental markdown code fences
      html = html.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()

      return html
    } catch (err) {
      lastErr = err
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  throw lastErr
}
