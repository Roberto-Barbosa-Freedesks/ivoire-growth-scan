/**
 * LinkedIn Company data via Apify
 * Primary actor:  bebity/linkedin-company-detail-scraper
 * Fallback actor: dev_fusionworks/linkedin-company-scraper
 *
 * Replaces Apollo.io — sem API key paga necessária.
 * Usa o Apify Token já configurado na plataforma.
 *
 * Input: LinkedIn company page URL from DiagnosticInput.linkedIn
 *   e.g. "https://www.linkedin.com/company/ivoire-ag/"
 *
 * Output fields probed (actors may return either camelCase or snake_case):
 *   name / companyName
 *   followersCount / followers / followerCount
 *   employeeCount / employees / staffCount / companySize
 *   foundedYear / founded / yearFounded
 *   headquarters / location / city
 *   industry / industries
 *   description / about
 *   specialties (string[] or comma-separated string)
 *   companyType (PUBLIC, PRIVATE, NONPROFIT, etc.)
 *   website
 *
 * Scoring (LinkedIn organic presence 1–4):
 *   Score 1: < 1.000 seguidores ou canal não encontrado
 *   Score 2: 1.000–10.000 seguidores
 *   Score 3: 10.000–100.000 seguidores
 *   Score 4: 100.000+ seguidores
 *   +1 bonus se employeeCount > 500 (empresa com massa crítica no LinkedIn)
 *   +1 bonus se foundedYear exists (empresa com histórico verificado)
 *
 * Cost: ~$0.005–0.01 per company
 * Free tier ($5/mo): ~500–1.000 lookups/month
 */

import { runApifyActor } from './apifyClient';

export interface LinkedInResult {
  found: boolean;
  companyName: string | null;
  linkedInUrl: string | null;
  followers: number | null;
  employees: number | null;          // exact count or midpoint of range
  employeeRange: string | null;      // e.g. "51-200", "501-1000"
  foundedYear: number | null;
  headquarters: string | null;
  industry: string | null;
  specialties: string[];
  companyType: string | null;        // PUBLIC | PRIVATE | NONPROFIT | etc.
  description: string | null;
  website: string | null;
  score: number;                     // 1–4
  findings: string[];
  dataSources: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/[^0-9.]/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

/** Parse employee range like "51-200" → midpoint 125 */
function parseEmployeeRange(val: unknown): { count: number | null; range: string | null } {
  if (val === null || val === undefined) return { count: null, range: null };
  const s = String(val).trim();

  // Already a number
  const direct = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!isNaN(direct) && direct > 0 && !s.includes('-')) return { count: direct, range: null };

  // Range like "51-200" or "51–200"
  const match = s.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)/);
  if (match) {
    const lo = parseInt(match[1].replace(/,/g, ''), 10);
    const hi = parseInt(match[2].replace(/,/g, ''), 10);
    return { count: Math.round((lo + hi) / 2), range: `${lo}–${hi}` };
  }

  // Text ranges like "1-10 employees" → try numeric extraction
  const textNum = s.match(/(\d+)/);
  if (textNum) return { count: parseInt(textNum[1], 10), range: s };

  return { count: null, range: s || null };
}

function parseSpecialties(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string' && val.trim()) {
    return val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function calcScore(r: LinkedInResult): number {
  if (!r.found || r.followers === null) return 1;
  let pts = 0;
  if (r.followers >= 100_000) pts += 3;
  else if (r.followers >= 10_000) pts += 2;
  else if (r.followers >= 1_000) pts += 1;

  if (r.employees !== null && r.employees >= 500) pts += 1;
  if (r.foundedYear !== null) pts += 1;

  if (pts >= 4) return 4;
  if (pts >= 3) return 3;
  if (pts >= 2) return 2;
  if (pts >= 1) return 2; // found but small
  return 1;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function fetchLinkedInCompany(
  linkedInUrl: string | undefined,
  apifyToken: string
): Promise<LinkedInResult> {
  const empty: LinkedInResult = {
    found: false, companyName: null, linkedInUrl: null, followers: null,
    employees: null, employeeRange: null, foundedYear: null, headquarters: null,
    industry: null, specialties: [], companyType: null, description: null,
    website: null, score: 1, findings: [], dataSources: [],
  };

  if (!linkedInUrl || !apifyToken) return empty;

  // Normalize URL — ensure it points to company page
  const url = linkedInUrl.startsWith('http')
    ? linkedInUrl
    : `https://www.linkedin.com/company/${linkedInUrl.replace(/^@/, '')}`;

  // ── 1. Try primary: bebity/linkedin-company-detail-scraper ───────────────
  let items: Record<string, unknown>[] = [];
  let actorLabel = 'bebity/linkedin-company-detail-scraper';

  try {
    items = await runApifyActor<Record<string, unknown>>(
      'bebity/linkedin-company-detail-scraper',
      { startUrls: [{ url }], proxy: { useApifyProxy: true } },
      apifyToken,
      { timeoutSecs: 90 }
    );
  } catch {
    // silent — try fallback
  }

  // ── 2. Fallback: dev_fusionworks/linkedin-company-scraper ────────────────
  if (!items.length) {
    actorLabel = 'dev_fusionworks/linkedin-company-scraper';
    try {
      items = await runApifyActor<Record<string, unknown>>(
        'dev_fusionworks/linkedin-company-scraper',
        { urls: [url] },
        apifyToken,
        { timeoutSecs: 90 }
      );
    } catch {
      return {
        ...empty,
        linkedInUrl: url,
        findings: [`⚠️ Erro ao acessar LinkedIn via Apify: ${url}`],
        dataSources: [`LinkedIn via Apify (${actorLabel})`],
      };
    }
  }

  if (!items.length) {
    return {
      ...empty,
      linkedInUrl: url,
      findings: [`⚠️ Empresa não encontrada no LinkedIn: ${url}`],
      dataSources: [`LinkedIn via Apify (${actorLabel})`],
    };
  }

  const d = items[0];

  const empParsed = parseEmployeeRange(
    d.employeeCount ?? d.employees ?? d.staffCount ?? d.companySize ?? d.numEmployees
  );

  const result: LinkedInResult = {
    found: true,
    companyName: d.name ? String(d.name) : d.companyName ? String(d.companyName) : null,
    linkedInUrl: url,
    followers: num(d.followersCount ?? d.followers ?? d.followerCount ?? d.numFollowers),
    employees: empParsed.count,
    employeeRange: empParsed.range,
    foundedYear: num(d.foundedYear ?? d.founded ?? d.yearFounded),
    headquarters: d.headquarters
      ? String(d.headquarters)
      : d.location ? String(d.location) : d.city ? String(d.city) : null,
    industry: d.industry
      ? String(d.industry)
      : Array.isArray(d.industries) && d.industries.length ? String(d.industries[0]) : null,
    specialties: parseSpecialties(d.specialties ?? d.speciality),
    companyType: d.companyType ? String(d.companyType) : d.type ? String(d.type) : null,
    description: d.description
      ? String(d.description).slice(0, 500)
      : d.about ? String(d.about).slice(0, 500) : null,
    website: d.website ? String(d.website) : d.websiteUrl ? String(d.websiteUrl) : null,
    score: 1,
    findings: [],
    dataSources: [`LinkedIn via Apify (${actorLabel})`],
  };

  // ── Build findings ────────────────────────────────────────────────────────
  if (result.companyName)
    result.findings.push(`✓ LinkedIn corporativo: ${result.companyName}`);
  if (result.followers !== null)
    result.findings.push(`✓ ${result.followers.toLocaleString('pt-BR')} seguidores no LinkedIn`);
  if (result.employees !== null)
    result.findings.push(
      result.employeeRange
        ? `${result.employees.toLocaleString('pt-BR')} colaboradores (faixa: ${result.employeeRange})`
        : `${result.employees.toLocaleString('pt-BR')} colaboradores`
    );
  if (result.foundedYear)
    result.findings.push(`Fundada em ${result.foundedYear} (${new Date().getFullYear() - result.foundedYear} anos de mercado)`);
  if (result.headquarters)
    result.findings.push(`Sede: ${result.headquarters}`);
  if (result.industry)
    result.findings.push(`Setor: ${result.industry}`);
  if (result.specialties.length > 0)
    result.findings.push(`Especialidades: ${result.specialties.slice(0, 5).join(', ')}`);

  result.score = calcScore(result);
  return result;
}
