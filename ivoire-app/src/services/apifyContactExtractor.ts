/**
 * Contact Extraction via Apify actors
 *
 * Actor 1 (emails + phones): anchor/email-phone-extractor
 *   Input:  { urls: [siteUrl], maxItems: 20, proxyConfiguration: { useApifyProxy: true } }
 *   Output: { email?, phone?, emails?: string[], phones?: string[] }
 *
 * Actor 2 (LinkedIn C-level): dev_fusion/Linkedin-Profile-Scraper
 *   Input:  { searchQuery: "<companyName> CEO CMO Diretor Marketing Brasil", maxItems: 5 }
 *   Output: { name?, title?, linkedin_url?, location? }
 *
 * Strategy:
 *   - Run both actors concurrently via Promise.allSettled
 *   - Deduplicate emails (lowercase), filter generic addresses
 *   - Keep only first 3 LinkedIn profiles matching C-level titles
 *   - Return empty result gracefully when apifyToken is missing
 *
 * Cost: ~$0.003–0.01 per run within the $5/mo free tier
 */

import { runApifyActor } from './apifyClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContactInfo {
  emails: string[];
  phones: string[];
  linkedinProfiles: Array<{
    name: string;
    title: string;
    linkedinUrl: string;
    location?: string;
  }>;
  findings: string[];
  dataSources: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Generic/role emails that should be excluded from results */
const GENERIC_EMAIL_PREFIXES = [
  'info', 'contato', 'contact', 'hello', 'ola', 'olá', 'suporte', 'support',
  'vendas', 'sales', 'noreply', 'no-reply', 'nao-responda', 'financeiro',
  'finance', 'admin', 'administracao', 'rh', 'juridico', 'legal', 'ti',
  'webmaster', 'postmaster', 'abuse', 'spam', 'security',
];

/** C-level / senior titles we consider relevant for commercial outreach */
const CLEVEL_TITLE_PATTERNS = [
  /\bceo\b/i,
  /\bcmo\b/i,
  /\bcfo\b/i,
  /\bcto\b/i,
  /\bcoo\b/i,
  /\bdiretor/i,
  /\bdiretora/i,
  /\bvice.presidente\b/i,
  /\bvp\b/i,
  /\bhead\b/i,
  /\bgerente/i,
  /\bsocio/i,
  /\bsócio/i,
  /\bfundador/i,
  /\bco-founder\b/i,
  /\bfounder\b/i,
  /\bpresident/i,
  /\bchief\b/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isGenericEmail(email: string): boolean {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  return GENERIC_EMAIL_PREFIXES.some(prefix => local === prefix || local.startsWith(prefix + '.'));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/\s+/g, ' ');
}

function isCLevel(title: string): boolean {
  return CLEVEL_TITLE_PATTERNS.some(pattern => pattern.test(title));
}

/**
 * Extract emails from a raw Apify result row.
 * Handles both single-value fields and array fields.
 */
function extractEmailsFromRow(row: Record<string, unknown>): string[] {
  const results: string[] = [];

  if (typeof row.email === 'string' && row.email.includes('@')) {
    results.push(row.email);
  }
  if (Array.isArray(row.emails)) {
    for (const e of row.emails) {
      if (typeof e === 'string' && e.includes('@')) results.push(e);
    }
  }

  return results;
}

/**
 * Extract phone numbers from a raw Apify result row.
 */
function extractPhonesFromRow(row: Record<string, unknown>): string[] {
  const results: string[] = [];

  if (typeof row.phone === 'string' && row.phone.length >= 7) {
    results.push(row.phone);
  }
  if (Array.isArray(row.phones)) {
    for (const p of row.phones) {
      if (typeof p === 'string' && p.length >= 7) results.push(p);
    }
  }

  return results;
}

// ─── Empty result ─────────────────────────────────────────────────────────────

function emptyResult(): ContactInfo {
  return {
    emails: [],
    phones: [],
    linkedinProfiles: [],
    findings: [],
    dataSources: [],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch public contact information for a company.
 *
 * @param siteUrl        - Company website URL (e.g. "https://example.com.br")
 * @param companyName    - Company name used for LinkedIn search query
 * @param linkedinUrl    - Optional company LinkedIn page URL (not currently used by search actor)
 * @param apifyToken     - Apify API token (VITE_APIFY_TOKEN)
 */
export async function fetchContacts(
  siteUrl: string,
  companyName: string,
  _linkedinUrl: string | undefined,
  apifyToken: string
): Promise<ContactInfo> {
  if (!apifyToken) return emptyResult();

  // ── Run both actors concurrently ──────────────────────────────────────────
  const [emailResult, linkedinResult] = await Promise.allSettled([
    // Actor 1: email + phone extraction from the website
    runApifyActor<Record<string, unknown>>(
      'anchor/email-phone-extractor',
      {
        urls: [siteUrl],
        maxItems: 20,
        proxyConfiguration: { useApifyProxy: true },
      },
      apifyToken,
      { timeoutSecs: 90 }
    ),

    // Actor 2: LinkedIn C-level profiles via search
    runApifyActor<Record<string, unknown>>(
      'dev_fusion/Linkedin-Profile-Scraper',
      {
        searchQuery: `${companyName} CEO CMO Diretor Marketing Brasil`,
        maxItems: 5,
      },
      apifyToken,
      { timeoutSecs: 120 }
    ),
  ]);

  const result = emptyResult();

  // ── Process emails + phones ───────────────────────────────────────────────
  if (emailResult.status === 'fulfilled' && emailResult.value.length > 0) {
    const rawEmails: string[] = [];
    const rawPhones: string[] = [];

    for (const row of emailResult.value) {
      rawEmails.push(...extractEmailsFromRow(row));
      rawPhones.push(...extractPhonesFromRow(row));
    }

    // Deduplicate emails (lowercase) and filter generic ones
    const seen = new Set<string>();
    for (const email of rawEmails) {
      const normalized = normalizeEmail(email);
      if (!seen.has(normalized) && !isGenericEmail(normalized)) {
        seen.add(normalized);
        result.emails.push(normalized);
      }
    }

    // Deduplicate phones
    const seenPhones = new Set<string>();
    for (const phone of rawPhones) {
      const normalized = normalizePhone(phone);
      if (!seenPhones.has(normalized)) {
        seenPhones.add(normalized);
        result.phones.push(normalized);
      }
    }

    result.dataSources.push('anchor/email-phone-extractor via Apify');
  }

  // ── Process LinkedIn profiles ─────────────────────────────────────────────
  if (linkedinResult.status === 'fulfilled' && linkedinResult.value.length > 0) {
    const profiles: ContactInfo['linkedinProfiles'] = [];

    for (const row of linkedinResult.value) {
      if (typeof row !== 'object' || row === null) continue;
      const name = String(row.name ?? row.fullName ?? row.full_name ?? '').trim();
      const title = String(row.title ?? row.headline ?? row.position ?? row.jobTitle ?? '').trim();
      const linkedinUrl =
        String(row.linkedin_url ?? row.linkedinUrl ?? row.profileUrl ?? row.url ?? '').trim();

      if (!name || !title) continue;
      if (!isCLevel(title)) continue;

      profiles.push({
        name,
        title,
        linkedinUrl,
        location: row.location ? String(row.location).trim() : undefined,
      });
    }

    // Keep at most the first 3 C-level profiles
    result.linkedinProfiles = profiles.slice(0, 3);

    if (result.linkedinProfiles.length > 0) {
      result.dataSources.push('dev_fusion/Linkedin-Profile-Scraper via Apify');
    }
  }

  // ── Build findings ────────────────────────────────────────────────────────
  if (result.emails.length > 0) {
    result.findings.push(`✓ ${result.emails.length} e-mail(s) público(s) encontrado(s)`);
  }
  if (result.phones.length > 0) {
    result.findings.push(`✓ ${result.phones.length} telefone(s) encontrado(s)`);
  }
  if (result.linkedinProfiles.length > 0) {
    const names = result.linkedinProfiles.map(p => `${p.name} (${p.title})`).join(', ');
    result.findings.push(`✓ Contatos C-level no LinkedIn: ${names}`);
  }
  if (result.emails.length === 0 && result.phones.length === 0 && result.linkedinProfiles.length === 0) {
    result.findings.push('Nenhum contato público encontrado via scraping');
  }

  return result;
}
