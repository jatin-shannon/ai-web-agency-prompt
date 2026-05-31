export interface Communication {
  id: 'cold-call' | 'text-day0' | 'text-day2' | 'text-day5' | 'text-day10' | 'email-intro'
  label: string
  content: string
  approved: boolean
  sent: boolean
}

export interface ActivityEntry {
  id: string
  ts: string
  type: 'call' | 'text' | 'email' | 'meeting' | 'note'
  text: string
}

export interface Lead {
  id: string
  business: string
  type: string
  phone: string
  address: string
  rating: number
  reviews: number
  siteUrl?: string           // present only after build phase
  shareToken?: string        // random token for password-protected share links
  bestCallTime: string
  hook: string
  status: string
  stage: 'discovered' | 'built'
  communications: Communication[]
  openingHours?: string[]   // stored during discovery for later site generation
  htmlContent?: string
  notes?: string
  followUpDate?: string      // ISO date string e.g. "2026-06-15"
  activityLog?: ActivityEntry[]
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
  | { type: 'lead_discovered'; message: string; lead: Lead }
  | { type: 'lead_complete'; message: string; lead: Lead }
  | { type: 'done'; message: string; leads: Lead[] }
  | { type: 'error'; message: string }
