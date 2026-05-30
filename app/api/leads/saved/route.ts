import { NextResponse } from 'next/server'
import { list, del } from '@vercel/blob'
import { Lead } from '@/types'

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ leads: [] })
  }
  try {
    const { blobs } = await list({ prefix: 'leads/' })
    const jsonBlobs = blobs.filter(b => b.pathname.endsWith('.json'))
    const leads = (
      await Promise.all(
        jsonBlobs.map(b =>
          fetch(b.url)
            .then(r => r.json() as Promise<Lead>)
            .catch(() => null),
        ),
      )
    ).filter((l): l is Lead => l !== null)
    return NextResponse.json({ leads })
  } catch {
    return NextResponse.json({ leads: [] })
  }
}

export async function DELETE() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: true })
  }
  try {
    const { blobs } = await list({ prefix: 'leads/' })
    if (blobs.length > 0) await del(blobs.map(b => b.url))
  } catch { /* non-fatal */ }
  return NextResponse.json({ ok: true })
}
