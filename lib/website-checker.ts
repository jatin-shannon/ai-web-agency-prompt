const DIRECTORY_DOMAINS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'yelp.com', 'google.com', 'linkedin.com', 'pinterest.com',
  'tripadvisor.com', 'yellowpages.com', 'bbb.org',
]

export async function checkWebsite(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')

    if (DIRECTORY_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
      return false
    }

    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadChecker/1.0)' },
    })

    // Check if the redirect landed on a directory site
    const finalHostname = new URL(response.url).hostname.replace(/^www\./, '')
    if (DIRECTORY_DOMAINS.some(d => finalHostname === d || finalHostname.endsWith(`.${d}`))) {
      return false
    }

    return response.ok
  } catch {
    return false
  }
}
