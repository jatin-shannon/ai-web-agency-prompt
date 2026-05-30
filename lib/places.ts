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
  'independent restaurant OR cafe OR bakery',
  'barbershop OR nail salon OR beauty salon',
  'auto repair shop OR mechanic shop',
  'plumber OR electrician OR handyman',
  'pet groomer OR dog daycare OR veterinarian',
  'florist OR boutique OR gift shop',
  'house cleaning service OR maid service OR janitorial',
  'landscaping OR lawn care OR gardening service',
  'painting contractor OR house painter',
  'massage therapist OR day spa OR wellness center',
  'personal trainer OR yoga studio OR fitness studio',
  'photographer OR photography studio',
  'moving company OR moving service',
  'catering service OR food truck',
]

async function getPlaceCoords(
  placeId: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'location',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    const loc = data.location
    if (loc?.latitude != null && loc?.longitude != null) {
      return { lat: loc.latitude, lng: loc.longitude }
    }
  } catch {}
  return null
}

export async function searchBusinesses(
  city: string,
  opts?: { placeId?: string; radiusKm?: number },
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured')

  assertBudget(SEARCH_CATEGORIES.length)

  // Resolve location restriction when a placeId + radius are both provided.
  // Uses locationRestriction (strict) rather than locationBias so radius searches
  // don't return businesses outside the selected catchment area.
  let locationRestriction: object | undefined
  if (opts?.placeId && opts?.radiusKm) {
    const coords = await getPlaceCoords(opts.placeId, apiKey)
    if (coords) {
      locationRestriction = {
        circle: {
          center: { latitude: coords.lat, longitude: coords.lng },
          radius: opts.radiusKm * 1000,
        },
      }
    }
  }

  const results: PlaceResult[] = []
  const seen = new Set<string>()

  for (const category of SEARCH_CATEGORIES) {
    const body: Record<string, unknown> = {
      textQuery: `${category} in ${city}`,
      maxResultCount: 20,
    }
    if (locationRestriction) body.locationRestriction = locationRestriction

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
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
    await new Promise(r => setTimeout(r, 300))
  }

  return results
}
