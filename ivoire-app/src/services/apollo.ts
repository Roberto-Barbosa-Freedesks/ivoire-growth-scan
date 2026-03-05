/**
 * Apollo.io People Search API
 * Used to find relevant contacts at the analyzed company.
 * Requires an Apollo.io API key.
 *
 * Documentation: https://apolloio.github.io/apollo-api-docs/
 */

export interface ApolloContact {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  email?: string;
  linkedinUrl?: string;
  photoUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  organizationName?: string;
  seniority?: string;
  departments?: string[];
}

export interface ApolloSearchResult {
  contacts: ApolloContact[];
  total: number;
  isDemo: boolean;
  error?: string;
}

/** Target job titles for commercial prospecting */
const TARGET_TITLES = [
  'Chief Marketing Officer',
  'VP of Marketing',
  'VP Marketing',
  'Director of Marketing',
  'Marketing Director',
  'Head of Marketing',
  'Marketing Manager',
  'General Manager',
  'CEO',
  'President',
  'Founder',
  'Co-Founder',
  'Owner',
  'Partner',
  'Director',
  'Managing Director',
];

/** Target seniority levels */
const TARGET_SENIORITY = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director', 'manager', 'senior'];

/**
 * Search for contacts at a company domain via Apollo.io API.
 * Note: Apollo.io may restrict CORS from browsers.
 * In that case, the error is surfaced gracefully.
 */
export async function searchApolloContacts(
  siteUrl: string,
  apiKey: string
): Promise<ApolloSearchResult> {
  if (!apiKey) {
    return {
      contacts: [],
      total: 0,
      isDemo: true,
      error: 'API key não configurada. Configure em Configurações → Integrações.',
    };
  }

  // Extract domain
  let domain = siteUrl;
  try {
    const u = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
    domain = u.hostname.replace(/^www\./, '');
  } catch {
    domain = siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  const payload = {
    api_key: apiKey,
    q_organization_domains: domain,
    contact_email_status: ['verified', 'guessed', 'unavailable', 'bounced', 'pending_manual_fulfillment'],
    person_titles: TARGET_TITLES,
    person_seniorities: TARGET_SENIORITY,
    per_page: 5,
    page: 1,
  };

  try {
    // Try Apollo API directly (works if CORS is allowed)
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Apollo API error ${res.status}: ${errText}`);
    }

    const data = await res.json();

    const contacts: ApolloContact[] = (data.people || []).map((p: Record<string, unknown>) => ({
      id: (p.id as string) || String(Math.random()),
      name: (p.name as string) || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      firstName: (p.first_name as string) || '',
      lastName: (p.last_name as string) || '',
      title: (p.title as string) || '',
      email: (p.email as string) || undefined,
      linkedinUrl: (p.linkedin_url as string) || undefined,
      photoUrl: (p.photo_url as string) || undefined,
      city: (p.city as string) || undefined,
      state: (p.state as string) || undefined,
      country: (p.country as string) || undefined,
      organizationName: ((p.organization as { name?: string } | undefined)?.name) || undefined,
      seniority: (p.seniority as string) || undefined,
      departments: (p.departments as string[]) || undefined,
    }));

    return {
      contacts,
      total: data.pagination?.total_entries || contacts.length,
      isDemo: false,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // CORS or network error — return structured error
    if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      return {
        contacts: [],
        total: 0,
        isDemo: false,
        error: 'Erro de CORS: A API Apollo.io requer um proxy server. Configure um backend ou use a extensão Apollo diretamente.',
      };
    }

    return {
      contacts: [],
      total: 0,
      isDemo: false,
      error: `Erro na busca: ${errorMessage}`,
    };
  }
}

/**
 * Generate demo contacts for testing without an API key.
 * Based on domain name as seed for determinism.
 */
export function generateDemoContacts(companyName: string): ApolloContact[] {
  const titles = [
    'Chief Marketing Officer',
    'VP de Marketing',
    'Head de Growth',
    'Gerente de Marketing Digital',
    'Diretora de Marketing',
  ];

  const firstNames = ['Ana', 'Carlos', 'Mariana', 'Roberto', 'Juliana'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Ferreira'];
  const seniorities = ['c_suite', 'vp', 'director', 'director', 'manager'];

  return Array.from({ length: 5 }, (_, i) => ({
    id: `demo_${i}`,
    name: `${firstNames[i]} ${lastNames[i]}`,
    firstName: firstNames[i],
    lastName: lastNames[i],
    title: titles[i],
    email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`,
    linkedinUrl: `https://www.linkedin.com/in/${firstNames[i].toLowerCase()}-${lastNames[i].toLowerCase()}-demo`,
    organizationName: companyName,
    seniority: seniorities[i],
  }));
}
