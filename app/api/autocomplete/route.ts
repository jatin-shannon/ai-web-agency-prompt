import { NextRequest } from 'next/server'

type Suggestion = { label: string; placeId: string }
type RawSuggestion = { placePrediction?: { text?: { text?: string }; placeId?: string } }

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) return Response.json({ suggestions: [] })

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) return Response.json({ suggestions: [] })

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: q,
        includedPrimaryTypes: ['locality', 'sublocality', 'neighborhood', 'administrative_area_level_2'],
      }),
    })

    if (!res.ok) return Response.json({ suggestions: [] })

    const data = await res.json()
    const suggestions: Suggestion[] = ((data.suggestions ?? []) as RawSuggestion[])
      .map(s => ({
        label: s.placePrediction?.text?.text ?? '',
        placeId: s.placePrediction?.placeId ?? '',
      }))
      .filter(s => s.label && s.placeId)

    return Response.json({ suggestions })
  } catch {
    return Response.json({ suggestions: [] })
  }
}
