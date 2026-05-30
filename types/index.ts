export interface Lead {
  id: string
  business: string
  type: string
  phone: string
  address: string
  rating: number
  reviews: number
  siteUrl: string
  bestCallTime: string
  hook: string
  status: string
}

export interface PlaceResult {
  id: string
  displayName: { text: string; languageCode: string }
  formattedAddress: string
  nationalPhoneNumber?: string
  rating?: number
  userRatingCount?: number
  websiteUri?: string
  businessStatus?: string
  regularOpeningHours?: {
    weekdayDescriptions?: string[]
  }
  reviews?: Array<{
    text?: { text: string; languageCode: string }
    rating: number
    authorAttribution?: { displayName: string }
  }>
  primaryTypeDisplayName?: { text: string; languageCode: string }
  types?: string[]
}

export type PipelineEvent =
  | { type: 'status'; message: string }
  | { type: 'skip'; message: string }
  | { type: 'lead'; message: string }
  | { type: 'lead_complete'; message: string; lead: Lead }
  | { type: 'done'; message: string; leads: Lead[] }
  | { type: 'error'; message: string }
