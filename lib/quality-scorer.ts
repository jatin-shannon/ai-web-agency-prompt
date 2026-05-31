/**
 * Scores generated HTML on a 0-100 scale by checking for key website elements.
 * Used after site generation to give a quick quality signal without an extra AI call.
 */
export function scoreHtml(html: string): number {
  const lower = html.toLowerCase()
  const imgCount = (html.match(/<img/gi) ?? []).length
  let score = 0

  // Mobile responsive meta viewport (10 pts)
  if (lower.includes('viewport')) score += 10

  // Phone number / call CTA (15 pts)
  if (/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(html) || lower.includes('tel:')) score += 15

  // Address / location / directions (10 pts)
  if (lower.includes('address') || lower.includes('directions') || lower.includes('find us')) score += 10

  // Gallery / images / portfolio (10 pts)
  if (lower.includes('gallery') || lower.includes('portfolio') || imgCount > 3) score += 10

  // Reviews / testimonials (10 pts)
  if (lower.includes('testimonial') || lower.includes('review') || lower.includes('what our')) score += 10

  // Business hours (10 pts)
  if (lower.includes('hours') || lower.includes('monday') || lower.includes('open daily')) score += 10

  // Services / menu / pricing (10 pts)
  if (lower.includes('service') || lower.includes('menu') || lower.includes('pricing') || lower.includes('packages')) score += 10

  // About section (5 pts)
  if (lower.includes('about us') || lower.includes('our story') || lower.includes('who we are')) score += 5

  // Contact / email / form (5 pts)
  if (lower.includes('<form') || lower.includes('contact us') || lower.includes('mailto:')) score += 5

  // Comprehensive content length (15 pts)
  if (html.length > 8000) score += 15
  else if (html.length > 4000) score += 8

  return Math.min(100, score)
}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Basic'
}
