/**
 * Mercado Livre Public API
 * 100% free — no API key required — CORS enabled.
 * Searches for brand presence, seller reputation, and listing volume.
 */

export interface MercadoLivreSeller {
  id: number;
  nickname: string;
  permalink?: string;
  powerSellerStatus: string | null;
  levelId: string | null;
  completedTransactions: number;
  canceledTransactions: number;
  positiveRatingPct: number | null;
}

export interface MercadoLivreResult {
  found: boolean;
  totalListings: number;
  sellers: MercadoLivreSeller[];
  topSeller: MercadoLivreSeller | null;
  score: number; // 1–4
  findings: string[];
  error?: string;
}

const ML_API = 'https://api.mercadolibre.com';
const TIMEOUT_MS = 12000;

async function mlFetch(path: string): Promise<Record<string, unknown> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${ML_API}${path}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function searchMercadoLivre(
  companyName: string,
  _siteUrl: string
): Promise<MercadoLivreResult> {
  const findings: string[] = [];

  // Search listings by company name
  const searchData = await mlFetch(
    `/sites/MLB/search?q=${encodeURIComponent(companyName)}&limit=10&offset=0`
  );

  if (!searchData) {
    return {
      found: false,
      totalListings: 0,
      sellers: [],
      topSeller: null,
      score: 1,
      findings: ['Erro ao consultar Mercado Livre API'],
      error: 'Falha na conexão com Mercado Livre API',
    };
  }

  const paging = searchData.paging as { total?: number } | undefined;
  const totalListings = paging?.total ?? 0;

  if (totalListings === 0) {
    findings.push(`Nenhum resultado encontrado para "${companyName}" no Mercado Livre`);
    return { found: false, totalListings: 0, sellers: [], topSeller: null, score: 1, findings };
  }

  findings.push(`${totalListings} listagem(ns) encontrada(s) para "${companyName}"`);

  // Collect unique seller IDs from results
  const results = (searchData.results as Array<Record<string, unknown>>) ?? [];
  const sellerIdMap = new Map<number, number>();
  for (const item of results) {
    const seller = item.seller as Record<string, unknown> | undefined;
    const id = seller?.id as number | undefined;
    if (id) sellerIdMap.set(id, (sellerIdMap.get(id) ?? 0) + 1);
  }

  // Fetch details for top sellers (up to 3)
  const sellers: MercadoLivreSeller[] = [];
  const topSellerIds = [...sellerIdMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  for (const sellerId of topSellerIds) {
    const sellerData = await mlFetch(`/users/${sellerId}`);
    if (!sellerData) continue;

    const rep = sellerData.seller_reputation as Record<string, unknown> | undefined;
    const txs = rep?.transactions as Record<string, unknown> | undefined;
    const ratings = rep?.ratings as Record<string, unknown> | undefined;

    const positiveRaw = ratings?.positive;
    const positiveRatingPct =
      typeof positiveRaw === 'number' ? Math.round(positiveRaw * 100) : null;

    sellers.push({
      id: sellerId,
      nickname: String(sellerData.nickname ?? `Vendedor #${sellerId}`),
      permalink: sellerData.permalink as string | undefined,
      powerSellerStatus: (rep?.power_seller_status as string | null) ?? null,
      levelId: (rep?.level_id as string | null) ?? null,
      completedTransactions: (txs?.completed as number) ?? 0,
      canceledTransactions: (txs?.canceled as number) ?? 0,
      positiveRatingPct,
    });
  }

  const topSeller = sellers[0] ?? null;

  if (topSeller) {
    findings.push(`Vendedor principal: ${topSeller.nickname}`);
    if (topSeller.powerSellerStatus) {
      findings.push(`Power Seller: ${topSeller.powerSellerStatus}`);
    }
    if (topSeller.positiveRatingPct !== null) {
      findings.push(`Avaliações positivas: ${topSeller.positiveRatingPct}%`);
    }
    if (topSeller.completedTransactions > 0) {
      findings.push(`Transações concluídas: ${topSeller.completedTransactions.toLocaleString('pt-BR')}`);
    }
  }

  // Score based on presence, volume and reputation
  let score = 1;
  const ps = topSeller?.powerSellerStatus?.toLowerCase();
  if (ps === 'platinum' && (topSeller?.positiveRatingPct ?? 0) >= 95) {
    score = 4;
  } else if (ps === 'gold' || ps === 'platinum') {
    score = 3;
  } else if (topSeller?.completedTransactions && topSeller.completedTransactions > 100) {
    score = 2;
  } else if (totalListings > 0) {
    score = 2;
  }

  return {
    found: true,
    totalListings,
    sellers,
    topSeller,
    score,
    findings,
  };
}
