/**
 * Google Places API (Find Place + Place Details)
 * Requires: Google Cloud API key with "Places API" enabled.
 * CORS supported when called from browser with valid key + restrictions.
 *
 * Setup: console.cloud.google.com → APIs → Places API → Enable
 * Cost: $0.017/request — first $200/month free (~11k requests/month free).
 */

export interface GooglePlacesResult {
  found: boolean;
  placeId: string | null;
  name: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
  businessStatus: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  openNow: boolean | null;
  priceLevel: number | null;
  score: number; // 1–4
  findings: string[];
  error?: string;
}

const PLACES_API = 'https://maps.googleapis.com/maps/api/place';
const TIMEOUT_MS = 12000;

async function placesFetch(path: string): Promise<Record<string, unknown> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${PLACES_API}${path}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchGooglePlaces(
  companyName: string,
  _siteUrl: string,
  apiKey: string
): Promise<GooglePlacesResult> {
  if (!apiKey) {
    return {
      found: false, placeId: null, name: null, rating: null,
      userRatingsTotal: null, businessStatus: null, address: null,
      phone: null, website: null, openNow: null, priceLevel: null,
      score: 0, findings: [],
      error: 'Google Places API key não configurada — configure em Configurações → Integrações',
    };
  }

  const findings: string[] = [];

  // Step 1: Find Place from Text
  const findParams = new URLSearchParams({
    input: companyName,
    inputtype: 'textquery',
    fields: 'place_id,name,rating,user_ratings_total,business_status,formatted_address',
    language: 'pt-BR',
    key: apiKey,
  });

  const findData = await placesFetch(`/findplacefromtext/json?${findParams}`);

  if (!findData) {
    return {
      found: false, placeId: null, name: null, rating: null,
      userRatingsTotal: null, businessStatus: null, address: null,
      phone: null, website: null, openNow: null, priceLevel: null,
      score: 0, findings: [],
      error: 'Falha ao conectar com Google Places API — verifique a API key e as restrições no Google Cloud Console',
    };
  }

  if (findData.status === 'REQUEST_DENIED') {
    return {
      found: false, placeId: null, name: null, rating: null,
      userRatingsTotal: null, businessStatus: null, address: null,
      phone: null, website: null, openNow: null, priceLevel: null,
      score: 0, findings: [],
      error: `Google Places: Requisição negada — ${(findData.error_message as string) ?? 'verifique as restrições da API key'}. Solução: Google Cloud Console → Credenciais → Restrições HTTP → adicione https://roberto-barbosa-freedesks.github.io/* e http://localhost:5173/*`,
    };
  }

  const candidates = findData.candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates || candidates.length === 0) {
    findings.push(`Empresa "${companyName}" não encontrada no Google Places`);
    return {
      found: false, placeId: null, name: null, rating: null,
      userRatingsTotal: null, businessStatus: null, address: null,
      phone: null, website: null, openNow: null, priceLevel: null,
      score: 1, findings,
    };
  }

  const place = candidates[0];
  const placeId = place.place_id as string | null;

  // Step 2: Get Place Details for richer data
  let phone: string | null = null;
  let website: string | null = null;
  let openNow: boolean | null = null;
  let priceLevel: number | null = null;

  if (placeId) {
    const detailParams = new URLSearchParams({
      place_id: placeId,
      fields: 'formatted_phone_number,website,opening_hours,price_level,rating,user_ratings_total',
      language: 'pt-BR',
      key: apiKey,
    });
    const detailData = await placesFetch(`/details/json?${detailParams}`);
    if (detailData?.status === 'OK') {
      const result = detailData.result as Record<string, unknown> | undefined;
      phone = (result?.formatted_phone_number as string | null) ?? null;
      website = (result?.website as string | null) ?? null;
      const openingHours = result?.opening_hours as Record<string, unknown> | undefined;
      openNow = typeof openingHours?.open_now === 'boolean' ? openingHours.open_now : null;
      priceLevel = typeof result?.price_level === 'number' ? result.price_level : null;
    }
  }

  const rating = typeof place.rating === 'number' ? place.rating : null;
  const reviewCount = typeof place.user_ratings_total === 'number' ? place.user_ratings_total : 0;
  const address = (place.formatted_address as string | null) ?? null;
  const name = (place.name as string | null) ?? null;
  const businessStatus = (place.business_status as string | null) ?? null;

  // Findings
  if (rating !== null) findings.push(`Nota Google: ${rating.toFixed(1)}/5 (${reviewCount.toLocaleString('pt-BR')} avaliações)`);
  else findings.push('Empresa encontrada no Google Places sem avaliações públicas');
  if (businessStatus) findings.push(`Status: ${businessStatus}`);
  if (address) findings.push(`Endereço: ${address}`);
  if (website) findings.push(`Website registrado: ${website}`);
  if (phone) findings.push(`Telefone: ${phone}`);

  // Score
  let score = 1;
  if (rating !== null) {
    if (rating >= 4.5 && reviewCount >= 200) score = 4;
    else if (rating >= 4.0 && reviewCount >= 50) score = 3;
    else if (rating >= 3.5 && reviewCount >= 10) score = 2;
    else if (rating >= 3.0) score = 2;
    else score = 1;
  }
  // Bonus for high review volume
  if (reviewCount >= 1000 && score < 4) score = Math.min(4, score + 1);

  return {
    found: true,
    placeId,
    name,
    rating,
    userRatingsTotal: reviewCount,
    businessStatus,
    address,
    phone,
    website,
    openNow,
    priceLevel,
    score,
    findings,
  };
}
