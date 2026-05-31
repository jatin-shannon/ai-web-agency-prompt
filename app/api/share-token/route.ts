import { NextResponse } from 'next/server'

// Returns the SITE_SHARE_TOKEN to authenticated users so the client can build
// shareable preview URLs without exposing the token in client-side bundles.
export async function GET() {
  return NextResponse.json({ token: process.env.SITE_SHARE_TOKEN ?? null })
}
