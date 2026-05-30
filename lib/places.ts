import { PlaceResult } from '@/types'
import { assertBudget, recordSearches } from '@/lib/usage-tracker'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.websiteUri',
  'places.reviews',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'places.types',
].join(',')

const SEARCH_CATEGORIES = [
  'independent restaurant',
  'barbershop OR nail salon OR beauty salon',
  'auto repair shop OR mechanic shop',
  'plumber OR electrician OR handyman',
  'pet groomer OR dog daycare',
  'florist OR boutique',
]

export async function searchBusinesses(city: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured')

  // Throws if this run would push monthly Google spend over budget
  assertBudget(SEARCH_CATEGORIES.length)

  const results: PlaceResult[] = []
  const seen = new Set<string>()

  for (const category of SEARCH_CATEGORIES) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${category} in ${city}`,
        maxResultCount: 10,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Google Places API error ${response.status}: ${err}`)
    }

    const data = await response.json()

    for (const place of data.places ?? []) {
      if (!seen.has(place.id)) {
        seen.add(place.id)
        results.push(place as PlaceResult)
      }
    }

    recordSearches(1)

    // Respect rate limits
    await new Promise(r => setTimeout(r, 300))
  }

  return results
}
