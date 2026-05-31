import Anthropic from '@anthropic-ai/sdk'
import { PlaceResult } from '@/types'

const client = new Anthropic()

function getCategoryRequirements(type: string): string {
  const t = type.toLowerCase()

  if (
    t.includes('restaurant') || t.includes('cafe') || t.includes('bakery') ||
    t.includes('pizza') || t.includes('sushi') || t.includes('taco') ||
    t.includes('burger') || t.includes('diner') || t.includes('bistro') ||
    t.includes('food') || t.includes('kitchen') || t.includes('eatery')
  ) {
    return `CATEGORY: Restaurant / Food & Beverage
- Hero CTA: "View Menu" scrolling to menu section
- SERVICES/MENU section: Full menu by category — Appetizers, Mains, Drinks, Desserts — with realistic prices ($8–$28 range). At least 4 items per category with enticing descriptions.
- Add an "Order Online" or "Reserve a Table" secondary CTA button linking to tel:
- Feature a "Today's Special" highlight card above the menu grid
- Include an online ordering note: <!-- Replace href with your online ordering link (DoorDash, Uber Eats, etc.) -->
- Color palette: warm and appetizing — deep terracotta, cream, or rich burgundy depending on cuisine`
  }

  if (
    t.includes('barber') || t.includes('hair') || t.includes('nail') ||
    t.includes('beauty') || t.includes('salon') || t.includes('lash') ||
    t.includes('wax') || t.includes('brow')
  ) {
    return `CATEGORY: Barbershop / Hair & Beauty Salon
- Hero CTA: "Book Now" (scrolls to services or links tel:)
- SERVICES section: Cards for each service with name, description, duration (e.g. "45 min"), and price. At least 6 services.
- Add a "Walk-ins Welcome" badge in the hero if hours suggest it
- Include a "Meet the Team" section with 2–3 placeholder staff cards (name, title, short bio)
- Booking note: <!-- Replace button href with your booking link (Square Appointments, Booksy, etc.) -->
- Color palette: clean and modern — navy/gold for barbers; blush/cream for salons`
  }

  if (
    t.includes('massage') || t.includes('spa') || t.includes('wellness') ||
    t.includes('facial') || t.includes('therapy') || t.includes('acupuncture') ||
    t.includes('chiropractic') || t.includes('holistic')
  ) {
    return `CATEGORY: Massage / Spa / Wellness
- Hero CTA: "Book a Session" (links tel:)
- SERVICES section: Treatment cards with name, duration, price, and a 1-sentence benefit description. Include at least: Swedish Massage, Deep Tissue, Hot Stone, Facial, Body Wrap.
- Add a "Membership / Package" section with 3 package tiers (e.g. Single Visit, Monthly, Quarterly) with pricing
- Include a soothing "First Visit" welcome note section
- Booking note: <!-- Replace href with your booking link (MindBody, Square Appointments, etc.) -->
- Color palette: calm and luxurious — sage green, warm stone, or deep plum/gold`
  }

  if (
    t.includes('gym') || t.includes('fitness') || t.includes('yoga') ||
    t.includes('pilates') || t.includes('personal trainer') || t.includes('crossfit') ||
    t.includes('martial art') || t.includes('boxing') || t.includes('dance')
  ) {
    return `CATEGORY: Fitness / Gym / Yoga Studio
- Hero CTA: "Start Your Free Trial" (links tel:)
- SERVICES section: Class/program cards with name, description, schedule note, and price. Include membership tiers (Drop-in, Monthly, Annual) with pricing.
- Add a "Class Schedule" section with a visual weekly grid (Mon–Sun, 3 classes per day placeholders)
- Include a transformation/results testimonial callout section
- Membership note: <!-- Replace links with your actual signup/booking system (Mindbody, Glofox, etc.) -->
- Color palette: energetic — bold navy/orange, black/lime, or deep red/white`
  }

  if (
    t.includes('auto') || t.includes('mechanic') || t.includes('car') ||
    t.includes('tire') || t.includes('oil change') || t.includes('collision') ||
    t.includes('body shop') || t.includes('transmission')
  ) {
    return `CATEGORY: Auto Repair / Mechanic
- Hero CTA: "Get a Free Quote" (links tel:) with a "Book Service" secondary button
- SERVICES section: Service cards with name, description, and price range. Must include: Oil Change, Brake Service, Tire Rotation, Engine Diagnostics, AC Service, Transmission Service.
- Add a "Why Choose Us" section: Certified Technicians, Warranty on Parts & Labor, Loaner Vehicles
- Include an "Emergency? Call Now" urgency banner with the phone number prominently displayed
- Add an appointment request note: <!-- Replace with your scheduling system link -->
- Color palette: professional and trustworthy — dark charcoal/orange or navy/silver`
  }

  if (
    t.includes('plumb') || t.includes('electric') || t.includes('hvac') ||
    t.includes('handyman') || t.includes('contractor') || t.includes('roofing') ||
    t.includes('painting') || t.includes('construction') || t.includes('renovation')
  ) {
    return `CATEGORY: Home Services / Trades
- Hero CTA: "Get a Free Estimate" (links tel:) — make it large and impossible to miss
- SERVICES section: Service area cards with name, common jobs listed, and "From $X" pricing. Include at least 6 services.
- Add a "Service Area" section listing neighborhoods/suburbs covered
- Add a "Request a Quote" section with a simple HTML form (name, phone, job type dropdown, message) — note: <!-- Wire form to your preferred form service (Formspree, Netlify Forms, etc.) -->
- Add an "Available 24/7 for Emergencies" badge if applicable
- Color palette: dependable — navy/white, forest green/cream, or slate/orange`
  }

  if (
    t.includes('pet') || t.includes('groom') || t.includes('dog') ||
    t.includes('cat') || t.includes('vet') || t.includes('animal') ||
    t.includes('kennel') || t.includes('daycare')
  ) {
    return `CATEGORY: Pet Services / Grooming / Veterinary
- Hero CTA: "Book Your Pet's Appointment" (links tel:)
- SERVICES section: Service cards by pet type (Dog, Cat, Small Animals) with services and prices. Include Full Groom, Bath & Brush, Nail Trim, Teeth Cleaning, Daycare.
- Add a "Meet Our Team" section with friendly staff bios
- Include a "Pet Safety & Care" trust section (certifications, handling approach, emergency protocols)
- Add a "New Client Special" discount callout banner
- Booking note: <!-- Replace with your booking link (Time to Pet, 123Pet, etc.) -->
- Color palette: friendly and warm — mint/coral, sky blue/yellow, or warm cream/teal`
  }

  if (
    t.includes('clean') || t.includes('maid') || t.includes('janitor') ||
    t.includes('laundry') || t.includes('dry clean')
  ) {
    return `CATEGORY: Cleaning Service
- Hero CTA: "Get a Free Quote" (links tel:)
- SERVICES section: Package cards — Standard Clean, Deep Clean, Move-In/Move-Out, Post-Construction, Recurring Weekly/Bi-weekly. Each with what's included and a starting price.
- Add a "What We Clean" checklist section with checkmarks (Kitchen, Bathrooms, Bedrooms, Windows, etc.)
- Include a "Satisfaction Guarantee" trust badge section
- Add a "Request a Quote" form: name, phone, property type (House/Apt/Office), sq footage dropdown
- Color palette: clean and fresh — crisp white/sky blue or mint/white`
  }

  if (
    t.includes('landscap') || t.includes('lawn') || t.includes('garden') ||
    t.includes('tree') || t.includes('irrigation') || t.includes('sprinkler')
  ) {
    return `CATEGORY: Landscaping / Lawn Care
- Hero CTA: "Get a Free Quote" (links tel:)
- SERVICES section: Seasonal service cards — Spring Cleanup, Regular Mowing, Fertilization, Mulching, Leaf Removal, Snow Removal, Irrigation. Each with description and price range.
- Add a "Before & After" gallery section (4 before/after pairs as side-by-side images)
- Include a "Service Packages" section: Basic (mowing only), Standard (mowing + edging + blowing), Premium (full care)
- Service area note prominently displayed
- Color palette: natural and fresh — deep green/cream, earthy brown/sage`
  }

  if (
    t.includes('photo') || t.includes('portrait') || t.includes('wedding photo') ||
    t.includes('videograph') || t.includes('studio')
  ) {
    return `CATEGORY: Photography / Videography
- Hero CTA: "Book a Session" (links tel:)
- SERVICES section: Package cards with session type (Portrait, Wedding, Commercial, Events), what's included (hours, edited photos count, prints), and price.
- Gallery section: extra emphasis — 8–10 portfolio images in a masonry layout
- Add a "How It Works" 3-step section: Book → Shoot → Receive Your Gallery
- Include a "Client Favorites" testimonials section with photos if available
- Booking note: <!-- Replace with your booking/inquiry form link -->
- Color palette: creative and premium — deep charcoal/gold, black/white/accent, or dusty rose/cream`
  }

  if (
    t.includes('mov') || t.includes('removalist') || t.includes('storage') ||
    t.includes('shipping') || t.includes('delivery')
  ) {
    return `CATEGORY: Moving / Removal Services
- Hero CTA: "Get a Free Moving Quote" (links tel:) — very prominent
- SERVICES section: Service cards — Local Move, Long Distance, Packing & Unpacking, Storage, Piano/Specialty Moving. Each with what's included and an estimated price range.
- Add a "How It Works" section: Get Quote → Schedule → We Move → You Settle In
- Include a "Free Moving Checklist" download callout (a button that says "Download Checklist" — note: <!-- Link to a PDF checklist -->)
- Add a trust section: Insured & Licensed, Background-Checked Crew, No Hidden Fees
- Color palette: strong and reliable — navy/gold, dark charcoal/orange`
  }

  if (
    t.includes('cater') || t.includes('food truck') || t.includes('event food') ||
    t.includes('personal chef')
  ) {
    return `CATEGORY: Catering / Food Truck
- Hero CTA: "Request a Quote" or "Book Us for Your Event" (links tel:)
- SERVICES section: Menu cards by cuisine/style with price-per-head ranges. Include event types: Corporate, Weddings, Birthday, Private Dinners, Street Events.
- Add an "Events We've Catered" section with photo gallery and event types
- Include a "Book Your Event" inquiry section with form: event date, guest count, event type, message
- Add a "Minimum Order / Availability" info callout
- Color palette: festive and appetizing — warm gold/cream, bold red/white, or earthy terracotta`
  }

  if (
    t.includes('florist') || t.includes('flower') || t.includes('boutique') ||
    t.includes('gift') || t.includes('retail') || t.includes('shop')
  ) {
    return `CATEGORY: Retail / Florist / Boutique
- Hero CTA: "Shop Now" or "Order Today" (links tel: or to shop)
- SERVICES/PRODUCTS section: Product category cards — Seasonal Arrangements, Wedding Flowers, Sympathy, Corporate, Gifts. Each with description and price range.
- Add a "Same-Day Delivery Available" urgency banner if applicable
- Include a "Custom Orders" section with a simple inquiry note
- Add a "Popular Arrangements" featured product grid
- Color palette: fresh and elegant — soft pinks/greens for florists; brand-specific for boutiques`
  }

  // Default for any other business type
  return `CATEGORY: Local Service Business
- Hero CTA: prominent "Call Us Today" button linking to tel: and a "Get a Free Quote" secondary button
- SERVICES section: At least 6 service cards with name, description, and price range
- Add a "Why Choose Us" section: 3–4 differentiators with icons (experience, guarantee, response time, etc.)
- Include a simple contact/quote request form
- Color palette: professional and trustworthy, appropriate to the industry`
}

export async function generateSite(place: PlaceResult, extraInstructions?: string): Promise<string> {
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

  const categoryRequirements = getCategoryRequirements(type)

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

${categoryRequirements}

DESIGN REQUIREMENTS:
- Parallax scrolling hero section — full-viewport, use a real Unsplash image URL matching this exact business type
- Smooth scroll-triggered fade/slide animations using Intersection Observer (no dependencies)
- Glassmorphism or frosted-glass accent cards where appropriate
- Color palette and typography as specified in the category requirements above
- Fully mobile responsive with hamburger nav for screens below 768px
- Hover effects on buttons, service cards, gallery images
- Real Unsplash photo URLs for all images — use direct image URLs (e.g. https://images.unsplash.com/photo-...) matched to the business type

REQUIRED SECTIONS (in this order):
1. NAV — sticky, translucent on scroll, logo/name + links
2. HERO — full-viewport parallax image, large display font, tagline pulled from review sentiment, primary CTA as specified above, star rating badge if 4.5+
3. ABOUT — 2–3 paragraphs, human copywriter voice. Reference real specifics. NEVER open with "Welcome to ${name}! We are passionate about..."
4. SERVICES/MENU — as specified in category requirements above
5. CATEGORY-SPECIFIC SECTION — include the additional section(s) specified in category requirements
6. GALLERY — 4–6 Unsplash images in a CSS grid or masonry. Add HTML comment on each: <!-- Replace with your own photo -->
7. REVIEWS — real quotes from the data above, displayed as cards with name, star rating, and quote. If fewer than 3 provided, add realistic filler and mark: <!-- Suggested — replace with real review -->
8. LOCATION & HOURS — address, hours table, click-to-call: <a href="tel:+1${phoneDigits}">${phone}</a>, map placeholder: <!-- Embed Google Maps iframe here -->
9. FOOTER — name, address, phone, placeholder social icons, copyright ${new Date().getFullYear()}

COPYWRITING RULES:
- Every word of copy is unique to this exact business
- Sound like a talented human copywriter who visited the place — warm, specific, real
- Mention specifics from the reviews if any are provided
- CTAs feel natural: "Come hungry" / "Book your spot" / "Call us today" — not generic "Click here"
- Match the voice to the business personality

Put all CSS in <style> tags in <head>. Put all JS in <script> tags before </body>. No external CSS or JS libraries — vanilla only.${extraInstructions ? `

ADDITIONAL INSTRUCTIONS FROM CLIENT:
${extraInstructions}` : ''}`,
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
