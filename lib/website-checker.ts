const DIRECTORY_DOMAINS = [
  // Social / review
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'yelp.com', 'google.com', 'linkedin.com', 'pinterest.com',
  'tripadvisor.com', 'yellowpages.com', 'bbb.org', 'nextdoor.com',
  // Booking / salon platforms (not real independent websites)
  'vagaro.com', 'fresha.com', 'styleseat.com', 'schedulicity.com',
  'mindbodyonline.com', 'mindbody.io', 'booksy.com', 'boulevard.io',
  'glofox.com', 'acuityscheduling.com', 'square.site', 'squareup.com',
  'appointy.com', 'setmore.com', 'simplybook.me', 'genbook.com',
  // Link aggregators
  'linktr.ee', 'linktree.com', 'beacons.ai', 'bio.site',
]

async function tryFetch(url: string, method: 'HEAD' | 'GET'): Promise<Response | null> {
  try {
    return await fetch(url, {
      method,
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadChecker/1.0)' },
    })
  } catch {
    return null
  }
}

function isDirectoryUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return DIRECTORY_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))
  } catch {
    return false
  }
}

export async function checkWebsite(url: string): Promise<boolean> {
  if (isDirectoryUrl(url)) return false

  // Try HEAD first; fall back to GET if blocked (405) or no response
  let res = await tryFetch(url, 'HEAD')

  if (!res || res.status === 405 || res.status === 501) {
    res = await tryFetch(url, 'GET')
  }

  if (!res) return false

  // Check if redirect landed on a directory site
  if (isDirectoryUrl(res.url)) return false

  // 403 = server blocked the bot but the site is real; treat as working
  if (res.status === 403) return true

  return res.ok
}
