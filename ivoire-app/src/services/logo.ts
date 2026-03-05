/**
 * Client Logo Service
 * Uses Clearbit Logo API (free, no API key required)
 * with multiple fallbacks.
 */

export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

/**
 * Returns a URL for the company logo.
 * Uses Clearbit Logo API: https://logo.clearbit.com/{domain}
 */
export function getLogoUrl(siteUrl: string): string {
  const domain = extractDomain(siteUrl);
  return `https://logo.clearbit.com/${domain}`;
}

/**
 * Try to fetch the logo and return a data URL if successful,
 * or null if not found (so we can show a fallback).
 */
export async function fetchClientLogo(siteUrl: string): Promise<string | null> {
  const domain = extractDomain(siteUrl);

  // Try Clearbit
  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  try {
    const res = await fetch(clearbitUrl);
    if (res.ok && res.headers.get('content-type')?.startsWith('image')) {
      return clearbitUrl;
    }
  } catch {
    // continue
  }

  // Try Google favicon as fallback (higher quality)
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  try {
    const res = await fetch(faviconUrl);
    if (res.ok) {
      return faviconUrl;
    }
  } catch {
    // continue
  }

  return null;
}

/** Generate initials avatar for company if no logo found */
export function getCompanyInitials(companyName: string): string {
  return companyName
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}
