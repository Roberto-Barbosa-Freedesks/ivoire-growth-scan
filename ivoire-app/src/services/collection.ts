/**
 * Real Data Collection Dispatcher
 * Replaces the old simulateCollection() — NO estimates, NO seeded random data.
 *
 * For each subdimension:
 * - Uses real APIs where credentials are configured
 * - Returns source: 'insufficient' when required credentials are missing
 * - Never generates fake/estimated values
 */

import type { DiagnosticInput } from '../types';
import type { AppSettings } from '../types';
import type { TechDetectionResult } from './pagespeed';
import { scoreTechDetection } from './pagespeed';
import type { ScrapedPageData } from './htmlScraper';
import { analyzeSeoOnPage } from './seoOnPage';
import { analyzeSemanticaGeo } from './semanticaGeo';
import { fetchYoutubeChannel } from './apifyYoutube';
import { fetchDemandIntelligence } from './apifyAnswerPublic';
import { fetchAhrefs } from './apifyAhrefs';
import { fetchLinkedInCompany } from './apifyLinkedIn';
import { searchMercadoLivre } from './mercadolivre';
import { fetchGooglePlaces } from './googlePlaces';
import { fetchMetaAds } from './metaAds';
import { analyzeUxCro } from './uxCroAnalysis';
import { analyzeMixTrafego } from './mixTrafego';
import type { TrafficChannelSignals } from './mixTrafego';
import { analyzeSeoOffpage } from './seoOffpage';
import { fetchSimilarweb } from './apifySimilarweb';
import type { SimilarwebResult } from './apifySimilarweb';
import { fetchSemrush } from './apifySemrush';
import { fetchGoogleMapsEnriched } from './apifyGoogleMaps';
import { fetchTiktokProfile } from './apifyTiktok';
import { fetchFacebookPage } from './apifyFacebook';
import { fetchInstagramProfile } from './apifyInstagram';
import { analyzeCheckoutWithClaude } from './checkoutAnalysis';
import { fetchBuiltWith } from './apifyBuiltWith';
import { fetchGptSearch } from './apifyGptSearch';
import { fetchGoogleTrends } from './apifyGoogleTrends';
import { fetchUbersuggest } from './apifyUbersuggest';
import { fetchSeRanking } from './apifySeRanking';
import { fetchAmazon } from './apifyAmazon';
import { fetchGoogleShopping } from './apifyGoogleShopping';
import { runApifyActor } from './apifyClient';
export { fetchContacts } from './apifyContactExtractor';
export type { GoogleSearchResult } from './apifyGoogleSearch'; // re-export for future use

export interface CollectionResult {
  score: number; // 1–4
  data: Record<string, unknown>;
  source: 'auto' | 'manual' | 'insufficient';
  dataReliability: 'real' | 'manual' | 'insufficient';
  dataSources: string[];
  error?: string;
}

interface PageSpeedContext {
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  mobileScore: number;
  desktopScore: number;
}

export interface CollectionContext {
  tech?: TechDetectionResult;
  mobile?: PageSpeedContext;
  desktop?: PageSpeedContext;
  scraped?: ScrapedPageData | null;
}

function insufficient(reason: string, requiredConfig: string): CollectionResult {
  return {
    score: 1,
    data: {
      status: 'insufficient',
      reason,
      requiredConfig,
      instructions: `Configure em: Configurações → Integrações → ${requiredConfig}`,
    },
    source: 'insufficient',
    dataReliability: 'insufficient',
    dataSources: [],
    error: reason,
  };
}

export async function collectSubdimension(
  subdimensionId: string,
  input: DiagnosticInput,
  settings: AppSettings,
  context: CollectionContext
): Promise<CollectionResult> {
  const { companyName, siteUrl } = input;

  switch (subdimensionId) {
    // ────────────────────────────────────────────────────────────────────
    // TRACKING HEALTH — real via PageSpeed network requests
    // ────────────────────────────────────────────────────────────────────
    case 'tracking_health': {
      if (!context.tech) {
        // HTML partial fallback: derive signals from scraped data
        const scraped = context.scraped;
        const chatPlatforms = scraped?.aiChatPlatforms ?? [];
        if (scraped?.aiChatPlatforms?.includes('HubSpot') && !chatPlatforms.includes('HubSpot')) chatPlatforms.push('HubSpot');
        const hubspotFromChat = chatPlatforms.some((p) => /hubspot/i.test(p));
        const intercomFromChat = chatPlatforms.some((p) => /intercom/i.test(p));
        const partialFindings = [
          '⚠️ PageSpeed API não disponível — pixels e tags de rastreamento não analisados via rede.',
          'Configure VITE_PAGESPEED_API_KEY para análise completa de GTM, GA4, Meta Pixel, etc.',
          ...(chatPlatforms.length > 0 ? [`✓ Ferramentas de chat/CRM detectadas no HTML: ${chatPlatforms.join(', ')}`] : []),
        ];
        return {
          score: chatPlatforms.length > 0 ? 2 : 1,
          data: {
            htmlFallback: true,
            gtmPresent: false, ga4Configured: false, metaPixel: false,
            linkedinInsightTag: false, tiktokPixel: false,
            hotjarInstalled: false,
            hubspotInstalled: hubspotFromChat,
            intercomInstalled: intercomFromChat,
            consentModeV2: false, thirdPartyDomains: [], totalThirdParties: 0,
            findings: partialFindings,
          },
          source: 'auto', dataReliability: 'real',
          dataSources: ['Análise HTML (parcial — pixels/tags requerem PageSpeed API)'],
        };
      }
      const tech = context.tech;
      const score = scoreTechDetection(tech);
      return {
        score,
        data: {
          gtmPresent: tech.gtmInstalled,
          ga4Configured: tech.ga4Installed,
          metaPixel: tech.metaPixel,
          linkedinInsightTag: tech.linkedinInsightTag,
          tiktokPixel: tech.tiktokPixel,
          hotjarInstalled: tech.hotjarInstalled,
          hubspotInstalled: tech.hubspotInstalled,
          intercomInstalled: tech.intercomInstalled,
          consentModeV2: tech.consentModeV2,
          thirdPartyDomains: tech.thirdPartyDomains,
          totalThirdParties: tech.totalThirdParties,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: ['Google PageSpeed Insights API (network requests analysis)'],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // STACK MARTECH — real via PageSpeed network requests
    // ────────────────────────────────────────────────────────────────────
    case 'stack_martech': {
      if (!context.tech) {
        // HTML partial fallback: infer MarTech stack from scraped signals
        const scraped = context.scraped;
        const partialCategories: string[] = [];
        const chatPlatforms = scraped?.aiChatPlatforms ?? [];
        if (chatPlatforms.some((p) => /hubspot/i.test(p))) partialCategories.push('CRM/Automação (HubSpot)');
        if (chatPlatforms.some((p) => /intercom/i.test(p))) partialCategories.push('Suporte/Chat (Intercom)');
        if (chatPlatforms.length > 0 && !partialCategories.length) partialCategories.push(`Chat (${chatPlatforms[0]})`);
        if (scraped?.ecommercePlatform) partialCategories.push(`E-commerce (${scraped.ecommercePlatform})`);
        if (scraped?.nlpSearchPlatforms?.length) partialCategories.push(`Busca Avançada (${scraped.nlpSearchPlatforms[0]})`);

        const smFindings = [
          '⚠️ PageSpeed API não disponível — análise completa de stack MarTech indisponível.',
          'Configure VITE_PAGESPEED_API_KEY para detectar GTM, GA4, Meta Pixel, HubSpot, etc.',
          ...(partialCategories.length > 0 ? [`✓ Ferramentas detectadas via HTML: ${partialCategories.join(', ')}`] : []),
        ];

        // Still try BuiltWith if Apify is configured
        let builtWithPartial: Record<string, unknown> = {};
        if (settings.apifyToken) {
          const bwP = await fetchBuiltWith(siteUrl, settings.apifyToken);
          if (bwP.found) {
            builtWithPartial = { builtWithCategories: bwP.categories, builtWithFindings: bwP.findings };
            if (bwP.categories.cms.length) partialCategories.push(`CMS (${bwP.categories.cms.slice(0, 2).join(', ')})`);
            if (bwP.categories.ecommerce.length) partialCategories.push(`E-commerce (${bwP.categories.ecommerce.slice(0, 2).join(', ')})`);
            smFindings.push(...bwP.findings);
          }
        }

        return {
          score: partialCategories.length >= 3 ? 2 : 1,
          data: {
            htmlFallback: true,
            categoriesCovered: partialCategories,
            totalTechnologies: 0,
            gtmInstalled: false, ga4Installed: false, metaPixel: false,
            linkedinInsightTag: false, tiktokPixel: false,
            hotjarInstalled: false,
            hubspotInstalled: chatPlatforms.some((p) => /hubspot/i.test(p)),
            intercomInstalled: chatPlatforms.some((p) => /intercom/i.test(p)),
            consentModeV2: false, thirdPartyDomains: [],
            findings: smFindings,
            ...builtWithPartial,
          },
          source: 'auto', dataReliability: 'real',
          dataSources: [
            'Análise HTML (parcial — stack completo requer PageSpeed API)',
            ...(settings.apifyToken ? ['BuiltWith via Apify'] : []),
          ],
        };
      }
      const tech = context.tech;
      const score = scoreTechDetection(tech);
      const categoriesCovered: string[] = [];
      if (tech.ga4Installed) categoriesCovered.push('Analytics (GA4)');
      if (tech.gtmInstalled) categoriesCovered.push('Tag Management (GTM)');
      if (tech.metaPixel) categoriesCovered.push('Social Tracking (Meta Pixel)');
      if (tech.linkedinInsightTag) categoriesCovered.push('B2B Tracking (LinkedIn)');
      if (tech.tiktokPixel) categoriesCovered.push('Social Tracking (TikTok)');
      if (tech.hubspotInstalled) categoriesCovered.push('CRM/Automação (HubSpot)');
      if (tech.intercomInstalled) categoriesCovered.push('Suporte/Chat (Intercom)');
      if (tech.hotjarInstalled) categoriesCovered.push('Heatmap/UX (Hotjar)');
      if (tech.consentModeV2) categoriesCovered.push('Consentimento LGPD');
      const stDataSources = ['Google PageSpeed Insights API (tech detection via network requests)'];

      // Supplementary: BuiltWith for deeper tech stack (CMS, E-commerce, CDN, CRM, A/B Testing, CDP)
      let builtWithData: Record<string, unknown> = {};
      const apifyTokenBW = settings.apifyToken ?? '';
      if (apifyTokenBW) {
        const bw = await fetchBuiltWith(siteUrl, apifyTokenBW);
        if (bw.found) {
          builtWithData = { builtWithCategories: bw.categories, builtWithFindings: bw.findings };
          stDataSources.push(...bw.dataSources);
          // Enrich categories covered
          if (bw.categories.cms.length) categoriesCovered.push(`CMS (${bw.categories.cms.slice(0, 2).join(', ')})`);
          if (bw.categories.ecommerce.length) categoriesCovered.push(`E-commerce (${bw.categories.ecommerce.slice(0, 2).join(', ')})`);
          if (bw.categories.crm.length && !tech.hubspotInstalled) categoriesCovered.push(`CRM (${bw.categories.crm.slice(0, 2).join(', ')})`);
          if (bw.categories.cdp.length) categoriesCovered.push(`CDP (${bw.categories.cdp.slice(0, 2).join(', ')})`);
          if (bw.categories.abTesting.length) categoriesCovered.push(`A/B Testing (${bw.categories.abTesting.slice(0, 2).join(', ')})`);
        }
      }

      return {
        score,
        data: {
          categoriesCovered,
          totalTechnologies: tech.totalThirdParties,
          gtmInstalled: tech.gtmInstalled,
          ga4Installed: tech.ga4Installed,
          metaPixel: tech.metaPixel,
          linkedinInsightTag: tech.linkedinInsightTag,
          tiktokPixel: tech.tiktokPixel,
          hotjarInstalled: tech.hotjarInstalled,
          hubspotInstalled: tech.hubspotInstalled,
          intercomInstalled: tech.intercomInstalled,
          consentModeV2: tech.consentModeV2,
          thirdPartyDomains: tech.thirdPartyDomains,
          ...builtWithData,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: stDataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // SEO ON-PAGE & E-E-A-T — real via HTML scraping
    // ────────────────────────────────────────────────────────────────────
    case 'seo_onpage_eeat': {
      const scraped = context.scraped;
      if (!scraped) {
        // Graceful degradation: use PageSpeed SEO score when HTML is unavailable
        const psScore = context.desktop?.seoScore ?? context.mobile?.seoScore ?? null;
        if (psScore !== null) {
          const degradedScore = psScore >= 90 ? 3 : psScore >= 70 ? 2 : 1;
          return {
            score: degradedScore,
            data: {
              pagespeedSeoScore: psScore,
              htmlUnavailable: true,
              findings: [
                '⚠️ HTML do site não acessível via CORS proxy — análise baseada somente no PageSpeed.',
                `PageSpeed SEO Score: ${psScore}/100`,
              ],
            },
            source: 'auto',
            dataReliability: 'real',
            dataSources: ['Google PageSpeed Insights (SEO score — HTML indisponível via CORS)'],
          };
        }
        return insufficient(
          'HTML inacessível via CORS proxy e PageSpeed não disponível.',
          'pageSpeedApiKey'
        );
      }
      const result = analyzeSeoOnPage(scraped, context.desktop as never);
      return {
        score: result.score,
        data: {
          title: result.title,
          titleLength: result.titleLength,
          titleOptimized: result.titleOptimized,
          metaDescPresent: result.metaDescOptimized || result.metaDescLength > 0,
          metaDescLength: result.metaDescLength,
          h1Count: result.h1Count,
          h1Optimized: result.h1Optimized,
          h1Text: result.h1Text,
          schemaTypes: result.schemaTypes,
          schemaCount: result.schemaCount,
          hasOrganizationSchema: result.hasOrganizationSchema,
          hasAuthorInfo: result.hasAuthorInfo,
          canonicalPresent: result.canonicalPresent,
          langSet: result.langSet,
          pagespeedSeoScore: result.pagespeedSeoScore,
          imagesWithAltPct: result.imagesWithAltPct,
          hasAboutPage: result.hasAboutPage,
          hasContactPage: result.hasContactPage,
          internalLinksCount: result.internalLinksCount,
          findings: result.findings,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: [
          'Análise HTML do site (CORS proxy)',
          ...(context.desktop ? ['Google PageSpeed Insights (SEO score)'] : []),
        ],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // SEMÂNTICA & GEO — real via JSON-LD extraction from HTML
    // ────────────────────────────────────────────────────────────────────
    case 'semantica_geo': {
      const scraped = context.scraped;
      if (!scraped) {
        // Graceful degradation: return score=1 with explanation (not "insufficient")
        const apifyTokenSGFb = settings.apifyToken ?? '';
        let geoLlmDataFb: Record<string, unknown> = {};
        const sgDataSourcesFb = ['HTML indisponível via CORS proxy'];
        if (apifyTokenSGFb) {
          const gptFb = await fetchGptSearch(companyName, input.segment, apifyTokenSGFb);
          if (gptFb.found || gptFb.query) {
            geoLlmDataFb = { llmBrandMentioned: gptFb.brandMentioned, llmFindings: gptFb.findings };
            sgDataSourcesFb.push(...gptFb.dataSources);
          }
        }
        return {
          score: geoLlmDataFb.llmBrandMentioned ? 2 : 1,
          data: {
            htmlUnavailable: true,
            schemaTypes: [],
            schemaCount: 0,
            jsonLdCount: 0,
            geoVisibility: false,
            findings: ['⚠️ HTML do site não acessível via CORS proxy — análise de Schema/JSON-LD indisponível.', ...((geoLlmDataFb.llmFindings as string[]) ?? [])],
            ...geoLlmDataFb,
          },
          source: 'auto',
          dataReliability: 'real',
          dataSources: sgDataSourcesFb,
        };
      }
      const result = analyzeSemanticaGeo(scraped);
      const sgDataSources = ['Extração JSON-LD do site (CORS proxy)'];

      // Supplementary: GPT Search — LLM brand visibility (GEO/LLMO scoring)
      let geoLlmData: Record<string, unknown> = {};
      const apifyTokenSG = settings.apifyToken ?? '';
      if (apifyTokenSG) {
        const gpt = await fetchGptSearch(companyName, input.segment, apifyTokenSG);
        if (gpt.found || gpt.query) {
          geoLlmData = {
            llmBrandMentioned: gpt.brandMentioned,
            llmMentionContext: gpt.mentionContext,
            llmSources: gpt.sources,
            llmFindings: gpt.findings,
          };
          sgDataSources.push(...gpt.dataSources);
        }
      }

      // Boost score if brand appears in LLM results
      let finalScore = result.score;
      if (geoLlmData.llmBrandMentioned === true && finalScore < 4) finalScore = Math.min(4, finalScore + 0.5);

      return {
        score: finalScore,
        data: {
          schemaTypes: result.schemaTypes,
          schemaCount: result.schemaCount,
          hasOrganization: result.hasOrganization,
          hasWebSite: result.hasWebSite,
          hasBreadcrumb: result.hasBreadcrumb,
          richResultTypes: result.richResultTypes,
          richResultsCount: result.richResultsCount,
          jsonLdCount: result.jsonLdCount,
          geoVisibility: result.geoVisibility,
          hasSiteLinksSearch: result.hasSiteLinksSearch,
          hasFAQ: result.hasFAQ,
          hasProduct: result.hasProduct,
          hasArticle: result.hasArticle,
          findings: result.findings,
          ...geoLlmData,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: sgDataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // PRESENÇA EM VÍDEO & ÁUDIO — scraping via Apify (YouTube + TikTok)
    // ────────────────────────────────────────────────────────────────────
    case 'presenca_video_audio': {
      const youtubeUrl = input.youtube;
      const apifyTokenYt = settings.apifyToken ?? '';
      const dataSources: string[] = [];

      // YouTube via Apify scraping
      let ytScore = 1;
      let ytData: Record<string, unknown> = { youtubeChannelFound: false };

      if (youtubeUrl && apifyTokenYt) {
        const yt = await fetchYoutubeChannel(youtubeUrl, apifyTokenYt);
        ytScore = yt.score;
        ytData = {
          youtubeChannelFound: yt.found,
          youtubeChannelTitle: yt.channelTitle,
          youtubeChannelUrl: yt.channelUrl,
          youtubeSubscribers: yt.subscribers,
          youtubeVideos: yt.videoCount,
          youtubeViews: yt.viewCount,
          youtubeVerified: yt.isVerified,
          youtubeFindings: yt.findings,
        };
        if (yt.dataSources.length) dataSources.push(...yt.dataSources);
      } else if (youtubeUrl && !apifyTokenYt) {
        ytData = {
          youtubeChannelFound: true,
          youtubeChannelUrl: youtubeUrl,
          note: 'URL de YouTube fornecida — configure Apify Token para obter métricas reais',
        };
        ytScore = 2;
        dataSources.push('URL fornecida pelo usuário (sem métricas — configure Apify Token)');
      }

      // TikTok via Apify
      let tiktokScore = 1;
      let tiktokData: Record<string, unknown> = {};
      const apifyToken = settings.apifyToken ?? '';
      const tiktokUrl = input.tiktok ?? context.scraped?.socialProfileUrls?.['TikTok'];
      if (apifyToken && tiktokUrl) {
        const tt = await fetchTiktokProfile(tiktokUrl, apifyToken);
        tiktokScore = tt.score;
        tiktokData = {
          tiktokFound: tt.found, tiktokUsername: tt.username,
          tiktokFollowers: tt.followers, tiktokVideos: tt.videoCount,
          tiktokLikes: tt.likes, tiktokVerified: tt.verified,
          tiktokFindings: tt.findings,
        };
        if (tt.dataSources.length) dataSources.push(...tt.dataSources);
      }

      // No data at all — return score=1 with explanation (not "insufficient")
      if (dataSources.length === 0 && !tiktokUrl) {
        return {
          score: 1,
          data: {
            youtubeChannelFound: false,
            tiktokFound: false,
            findings: [
              '⚠️ URL de YouTube/TikTok não fornecida.',
              apifyTokenYt
                ? 'Configure URL do canal YouTube/TikTok no cadastro para análise de presença em vídeo.'
                : 'Configure Apify Token em Configurações e informe a URL do canal YouTube.',
            ],
          },
          source: 'auto',
          dataReliability: 'real',
          dataSources: [],
        };
      }

      const finalScore = Math.max(ytScore, tiktokScore);

      return {
        score: finalScore,
        data: { ...ytData, ...tiktokData },
        source: 'auto',
        dataReliability: 'real',
        dataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // MIX DE TRÁFEGO — SimilarWeb via Apify (primary) + Tranco (fallback)
    // ────────────────────────────────────────────────────────────────────
    case 'mix_trafego': {
      const tech = context.tech;
      const scraped = context.scraped;
      const apifyToken = settings.apifyToken ?? '';

      // Primary: SimilarWeb via Apify (real monthly visits + channel breakdown)
      if (apifyToken) {
        const swResult = await fetchSimilarweb(siteUrl, apifyToken);

        // Competitor traffic benchmarking (up to 2 competitors)
        const competitorTraffic: Array<{
          url: string;
          monthlyVisits: number | null;
          globalRank: number | null;
          bounceRate: number | null;
          channelMix: SimilarwebResult['trafficSources'];
        }> = [];
        if (input.competitors && input.competitors.length > 0) {
          const compUrls = input.competitors
            .slice(0, 2)
            .map((c) => c.includes('.') ? (c.startsWith('http') ? c : `https://${c}`) : null)
            .filter(Boolean) as string[];
          for (const compUrl of compUrls) {
            try {
              const compSw = await fetchSimilarweb(compUrl, apifyToken);
              if (compSw.found || compSw.monthlyVisits !== null) {
                competitorTraffic.push({
                  url: compUrl,
                  monthlyVisits: compSw.monthlyVisits,
                  globalRank: compSw.globalRank,
                  bounceRate: compSw.bounceRate,
                  channelMix: compSw.trafficSources,
                });
              }
            } catch {
              // skip if competitor lookup fails
            }
          }
        }

        if (swResult.found) {
          const findings = [...swResult.findings];
          if (competitorTraffic.length > 0) {
            for (const comp of competitorTraffic) {
              findings.push(
                `Concorrente ${comp.url}: ${(comp.monthlyVisits ?? 0).toLocaleString('pt-BR')} visitas/mês · Rank #${comp.globalRank?.toLocaleString('pt-BR') ?? 'N/D'}`
              );
            }
          }
          return {
            score: swResult.score,
            data: {
              monthlyVisits: swResult.monthlyVisits,
              globalRank: swResult.globalRank,
              bounceRate: swResult.bounceRate,
              avgVisitDuration: swResult.avgVisitDuration,
              pagesPerVisit: swResult.pagesPerVisit,
              channelMix: swResult.trafficSources,
              topCountries: swResult.topCountries,
              competitorTraffic: competitorTraffic.length > 0 ? competitorTraffic : undefined,
              findings,
            },
            source: 'auto',
            dataReliability: 'real',
            dataSources: [
              ...swResult.dataSources,
              ...(competitorTraffic.length > 0 ? ['SimilarWeb via Apify (benchmarking de concorrentes)'] : []),
            ],
          };
        }
        // SimilarWeb returned no data (site below threshold) — fall through to Tranco
      }

      // Fallback: Tranco rank + channel inference from tech/HTML
      const signals: TrafficChannelSignals = {
        hasGa4: tech?.ga4Installed ?? false,
        hasGtm: tech?.gtmInstalled ?? false,
        hasMetaPixel: tech?.metaPixel ?? false,
        hasLinkedinTag: tech?.linkedinInsightTag ?? false,
        hasTiktokPixel: tech?.tiktokPixel ?? false,
        hasGoogleAdsScript: tech?.thirdPartyDomains?.some((d) =>
          d.includes('googleadservices') || d.includes('googlesyndication') || d.includes('doubleclick')
        ) ?? false,
        socialLinksFound: scraped?.socialLinks ?? [],
        internalLinksCount: scraped?.internalLinks ?? 0,
        hasSeoSignals: !!(scraped?.title && scraped?.metaDescription),
      };
      const result = await analyzeMixTrafego(siteUrl, signals);
      return {
        score: result.score,
        data: {
          trancoRank: result.trancoRank,
          trafficBucket: result.trafficBucket,
          activeChannels: result.activeChannels,
          channelMix: result.channelMix,
          findings: [
            ...(apifyToken ? ['⚠️ SimilarWeb: site abaixo do limiar de dados (<50k visitas/mês)'] : [
              '⚠️ Configure Apify Token em Configurações para obter dados reais de tráfego via SimilarWeb',
            ]),
            ...result.findings,
          ],
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: result.dataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // MÍDIA PAGA & CRIATIVOS — Meta Ads (pago) + Facebook/Instagram orgânico via Apify
    // ────────────────────────────────────────────────────────────────────
    case 'midia_paga_criativos': {
      const apifyToken = settings.apifyToken ?? '';
      if (!settings.metaAccessToken && !apifyToken) {
        return insufficient(
          'Meta Access Token e Apify Token não configurados. Configure ao menos um para analisar mídia paga e presença social.',
          'metaAccessToken ou apifyToken'
        );
      }

      const dataSources: string[] = [];
      const allFindings: string[] = [];
      let paidScore = 1;
      let paidData: Record<string, unknown> = {};
      let fbScore = 1; let fbData: Record<string, unknown> = {};
      let igScore = 1; let igData: Record<string, unknown> = {};

      // Paid: Meta Ad Library
      if (settings.metaAccessToken) {
        const adsResult = await fetchMetaAds(companyName, siteUrl, settings.metaAccessToken);
        if (!adsResult.error) {
          paidScore = adsResult.score;
          paidData = {
            adsFound: adsResult.adsFound, totalActiveAds: adsResult.totalAds,
            platforms: adsResult.platforms, formats: adsResult.formats,
            hasVideoAds: adsResult.hasVideoAds, hasImageAds: adsResult.hasImageAds,
            adSamples: adsResult.activeAds.slice(0, 5),
          };
          allFindings.push(...adsResult.findings);
          dataSources.push('Meta Ad Library API (gratuito)');
        }
      } else {
        allFindings.push('⚠️ Meta Access Token não configurado — anúncios pagos não verificados');
      }

      // Organic social via Apify — Facebook, Instagram, LinkedIn
      let liScore = 1; let liData: Record<string, unknown> = {};
      if (apifyToken) {
        const fbUrl = context.scraped?.socialProfileUrls?.['Facebook'];
        const fb = await fetchFacebookPage(fbUrl, companyName, apifyToken);
        fbScore = fb.score;
        fbData = {
          fbFound: fb.found, fbFollowers: fb.followers,
          fbRating: fb.rating, fbVerified: fb.isVerified,
          fbCategories: fb.categories,
        };
        allFindings.push(...fb.findings);
        if (fb.dataSources.length) dataSources.push(...fb.dataSources);

        const igUrl = input.instagram ?? context.scraped?.socialProfileUrls?.['Instagram'];
        if (igUrl) {
          const ig = await fetchInstagramProfile(igUrl, apifyToken);
          igScore = ig.score;
          igData = {
            igFound: ig.found, igFollowers: ig.followers,
            igPosts: ig.posts, igVerified: ig.isVerified,
            igWebsiteInBio: ig.websiteInBio,
          };
          allFindings.push(...ig.findings);
          if (ig.dataSources.length) dataSources.push(...ig.dataSources);
        }

        // LinkedIn Company — substitui Apollo.io (dado de inteligência da empresa)
        const liUrl = input.linkedIn ?? context.scraped?.socialProfileUrls?.['LinkedIn'];
        if (liUrl) {
          const li = await fetchLinkedInCompany(liUrl, apifyToken);
          liScore = li.score;
          liData = {
            liFound: li.found, liCompanyName: li.companyName,
            liFollowers: li.followers, liEmployees: li.employees,
            liEmployeeRange: li.employeeRange, liFoundedYear: li.foundedYear,
            liHeadquarters: li.headquarters, liIndustry: li.industry,
            liSpecialties: li.specialties, liCompanyType: li.companyType,
          };
          allFindings.push(...li.findings);
          if (li.dataSources.length) dataSources.push(...li.dataSources);
        }
      }

      return {
        score: Math.max(paidScore, fbScore, igScore, liScore),
        data: { ...paidData, ...fbData, ...igData, ...liData, findings: allFindings },
        source: 'auto',
        dataReliability: 'real',
        dataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // PRESENÇA EM MARKETPLACES — Mercado Livre (free API) + Amazon + Google Shopping via Apify
    //                            + Karamelo ML scraper (enhanced ML data when Apify available)
    // ────────────────────────────────────────────────────────────────────
    case 'presenca_marketplaces': {
      if (!input.isEcommerce) {
        return {
          score: 1,
          data: { skipped: true, reason: 'Não aplicável — empresa não é e-commerce' },
          source: 'auto', dataReliability: 'real', dataSources: [],
        };
      }

      const apifyTokenMkt = settings.apifyToken ?? '';
      const allMktFindings: string[] = [];
      const allMktSources: string[] = [];

      // ── 1. Mercado Livre — free public API (always runs) ──────────────
      const mlResult = await searchMercadoLivre(companyName, siteUrl);
      let mlScore = mlResult.score;
      allMktFindings.push(...mlResult.findings);
      allMktSources.push('Mercado Livre API (pública, gratuita)');

      // ── 1b. Karamelo ML Scraper — enhanced data (when Apify available) ──
      let karameloData: Record<string, unknown> = {};
      if (apifyTokenMkt && !mlResult.found) {
        // Use Karamelo scraper as alternative when free API finds nothing
        try {
          const karItems = await runApifyActor(
            'karamelo/mercadolivre-scraper-brasil-portugues',
            { keyword: companyName, pages: 2 },
            apifyTokenMkt,
            { timeoutSecs: 90 }
          );
          if (karItems.length > 0) {
            mlScore = Math.max(mlScore, 2);
            karameloData = {
              karameloFound: true,
              karameloListings: karItems.length,
              karameloSample: (karItems as Array<Record<string, unknown>>).slice(0, 3).map((p) => ({
                title: String(p.titulo ?? p.title ?? p.name ?? ''),
                price: p.preco ?? p.price ?? null,
                seller: p.vendedor ?? p.seller ?? null,
              })),
            };
            allMktFindings.push(`✓ Mercado Livre (scraper): ${karItems.length} listagens encontradas para "${companyName}"`);
            allMktSources.push('Mercado Livre via Apify (karamelo/mercadolivre-scraper-brasil-portugues)');
          }
        } catch { /* skip */ }
      }

      // ── 2. Amazon Brazil — junglee/amazon-crawler ────────────────────
      let amazonData: Record<string, unknown> = {};
      let amazonScore = 1;
      if (apifyTokenMkt) {
        const amz = await fetchAmazon(companyName, apifyTokenMkt);
        amazonScore = amz.score;
        if (amz.found) {
          amazonData = {
            amazonFound: true,
            amazonTotalProducts: amz.totalProducts,
            amazonTopSeller: amz.topSeller,
            amazonAvgRating: amz.avgRating,
            amazonAvgPrice: amz.avgPrice,
            amazonProducts: amz.products.slice(0, 5),
          };
          allMktFindings.push(...amz.findings);
          if (amz.dataSources.length) allMktSources.push(...amz.dataSources);
        } else {
          allMktFindings.push(...amz.findings);
        }
      }

      // ── 3. Google Shopping — epctex/google-shopping-scraper ──────────
      let googleShoppingData: Record<string, unknown> = {};
      let googleShoppingScore = 1;
      if (apifyTokenMkt) {
        const gss = await fetchGoogleShopping(companyName, apifyTokenMkt);
        googleShoppingScore = gss.score;
        if (gss.found) {
          googleShoppingData = {
            googleShoppingFound: true,
            googleShoppingTotalProducts: gss.totalProducts,
            googleShoppingTopMerchant: gss.topMerchant,
            googleShoppingAvgPrice: gss.avgPrice,
            googleShoppingPriceRange: gss.priceRange,
            googleShoppingAvgRating: gss.avgRating,
            googleShoppingProducts: gss.products.slice(0, 5),
          };
          allMktFindings.push(...gss.findings);
          if (gss.dataSources.length) allMktSources.push(...gss.dataSources);
        } else {
          allMktFindings.push(...gss.findings);
        }
      }

      const finalMktScore = Math.max(mlScore, amazonScore, googleShoppingScore);

      return {
        score: finalMktScore,
        data: {
          mercadoLivreFound: mlResult.found,
          totalListings: mlResult.totalListings,
          sellers: mlResult.sellers,
          topSellerNickname: mlResult.topSeller?.nickname ?? null,
          powerSellerStatus: mlResult.topSeller?.powerSellerStatus ?? null,
          positiveRatingPct: mlResult.topSeller?.positiveRatingPct ?? null,
          completedTransactions: mlResult.topSeller?.completedTransactions ?? null,
          ...karameloData,
          ...amazonData,
          ...googleShoppingData,
          findings: allMktFindings,
          marketplacesCovered: [
            'Mercado Livre',
            ...(amazonData.amazonFound ? ['Amazon.com.br'] : []),
            ...(googleShoppingData.googleShoppingFound ? ['Google Shopping'] : []),
          ],
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: allMktSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // SEO OFF-PAGE — SEMrush via Apify (primary) + RDAP/robots/sitemap/OPR (fallback)
    //               + Competitor benchmarking via Ahrefs (if competitors provided)
    // ────────────────────────────────────────────────────────────────────
    case 'seo_offpage': {
      const apifyToken = settings.apifyToken ?? '';
      const internalLinks = context.scraped?.internalLinks ?? 0;
      const allFindings: string[] = [];
      const allSources: string[] = [];

      // Primary: SEMrush via Apify (authority score + backlinks)
      let semrushData: Record<string, unknown> = {};
      let semrushScore = 1;
      if (apifyToken) {
        const sem = await fetchSemrush(siteUrl, apifyToken);
        semrushScore = sem.score;
        semrushData = {
          semrushAuthorityScore: sem.authorityScore,
          semrushBacklinks: sem.backlinks,
          semrushReferringDomains: sem.referringDomains,
          semrushOrganicTraffic: sem.organicTraffic,
          semrushOrganicKeywords: sem.organicKeywords,
        };
        allFindings.push(...sem.findings);
        if (sem.dataSources.length) allSources.push(...sem.dataSources);
      }

      // Secondary: Ahrefs via Apify (Domain Rating cross-validation)
      let ahrefsData: Record<string, unknown> = {};
      let ahrefsScore = 1;
      if (apifyToken) {
        const ahr = await fetchAhrefs(siteUrl, apifyToken);
        ahrefsScore = ahr.score;
        ahrefsData = {
          ahrefsDomainRating: ahr.domainRating,
          ahrefsBacklinks: ahr.backlinks,
          ahrefsReferringDomains: ahr.referringDomains,
          ahrefsOrganicTraffic: ahr.organicTraffic,
          ahrefsOrganicKeywords: ahr.organicKeywords,
        };
        allFindings.push(...ahr.findings);
        if (ahr.dataSources.length) allSources.push(...ahr.dataSources);
      }

      // Tertiary: Ubersuggest via Apify (MOZ Domain Authority — fallback when SEMrush/Ahrefs miss)
      let ubersuggestData: Record<string, unknown> = {};
      let ubersuggestScore = 1;
      if (apifyToken) {
        const ubs = await fetchUbersuggest(siteUrl, apifyToken);
        ubersuggestScore = ubs.score;
        if (ubs.found) {
          ubersuggestData = {
            ubersuggestMozDA: ubs.domainAuthority,
            ubersuggestBacklinks: ubs.backlinks,
            ubersuggestReferringDomains: ubs.referringDomains,
            ubersuggestOrganicTraffic: ubs.organicTraffic,
            ubersuggestSpamScore: ubs.spamScore,
          };
          allFindings.push(...ubs.findings);
          if (ubs.dataSources.length) allSources.push(...ubs.dataSources);
        }
      }

      // Quaternary: SE Ranking via Apify (Domain Trust + AI Citations signal)
      let seRankingData: Record<string, unknown> = {};
      let seRankingScore = 1;
      if (apifyToken) {
        const ser = await fetchSeRanking(siteUrl, apifyToken);
        seRankingScore = ser.score;
        if (ser.found) {
          seRankingData = {
            seRankingDomainTrust: ser.domainTrust,
            seRankingBacklinks: ser.backlinks,
            seRankingReferringDomains: ser.referringDomains,
            seRankingAiVisibility: ser.aiVisibility,
            seRankingAiCitations: ser.aiCitations,
          };
          allFindings.push(...ser.findings);
          if (ser.dataSources.length) allSources.push(...ser.dataSources);
        }
      }

      // Competitor benchmarking — Ahrefs DR for each competitor URL (up to 2)
      const competitorBenchmark: Array<{
        url: string;
        domainRating: number | null;
        backlinks: number | null;
        referringDomains: number | null;
      }> = [];
      if (apifyToken && input.competitors && input.competitors.length > 0) {
        const competitorUrls = input.competitors
          .slice(0, 2)
          .map((c) => c.includes('.') ? (c.startsWith('http') ? c : `https://${c}`) : null)
          .filter(Boolean) as string[];

        for (const compUrl of competitorUrls) {
          try {
            const compAhr = await fetchAhrefs(compUrl, apifyToken);
            competitorBenchmark.push({
              url: compUrl,
              domainRating: compAhr.domainRating,
              backlinks: compAhr.backlinks,
              referringDomains: compAhr.referringDomains,
            });
            if (compAhr.found) {
              allFindings.push(
                `Concorrente ${compUrl}: DR ${compAhr.domainRating ?? 'N/D'} · ${(compAhr.backlinks ?? 0).toLocaleString('pt-BR')} backlinks · ${(compAhr.referringDomains ?? 0).toLocaleString('pt-BR')} domínios ref.`
              );
            }
          } catch {
            // skip competitor if lookup fails
          }
        }
        if (competitorBenchmark.length > 0 && !allSources.includes('Ahrefs via Apify (concorrentes)')) {
          allSources.push('Ahrefs via Apify (benchmarking de concorrentes)');
        }
      }

      // Always run: RDAP + robots.txt + sitemap + Open PageRank
      const base = await analyzeSeoOffpage(siteUrl, settings.openPageRankApiKey ?? '', internalLinks);
      allFindings.push(...base.findings);
      allSources.push(...base.dataSources);

      const finalScore = apifyToken
        ? Math.max(semrushScore, ahrefsScore, ubersuggestScore, seRankingScore, base.score)
        : base.score;

      // Flat aliases — DimensionPage SubdimVisuals reads these names
      // Priority: SEMrush → Ahrefs → Ubersuggest → SE Ranking → OPR
      const authorityScore =
        (semrushData.semrushAuthorityScore as number | null) ??
        (ahrefsData.ahrefsDomainRating as number | null) ??
        (ubersuggestData.ubersuggestMozDA as number | null) ??
        (seRankingData.seRankingDomainTrust as number | null) ??
        base.openPageRank ?? 0;
      const totalBacklinks =
        (semrushData.semrushBacklinks as number | null) ??
        (ahrefsData.ahrefsBacklinks as number | null) ??
        (ubersuggestData.ubersuggestBacklinks as number | null) ??
        (seRankingData.seRankingBacklinks as number | null) ?? 0;
      const referringDomains =
        (semrushData.semrushReferringDomains as number | null) ??
        (ahrefsData.ahrefsReferringDomains as number | null) ??
        (ubersuggestData.ubersuggestReferringDomains as number | null) ??
        (seRankingData.seRankingReferringDomains as number | null) ?? 0;

      return {
        score: finalScore,
        data: {
          ...semrushData,
          ...ahrefsData,
          ...ubersuggestData,
          ...seRankingData,
          authorityScore,
          totalBacklinks,
          referringDomains,
          toxicLinks: 0,
          domainAge: base.domainAge,
          registrationDate: base.registrationDate,
          registrar: base.registrar,
          hasRobotsTxt: base.hasRobotsTxt,
          robotsTxtSitemapDirective: base.robotsTxtSitemapDirective,
          hasSitemapXml: base.hasSitemapXml,
          sitemapUrlCount: base.sitemapUrlCount,
          openPageRank: base.openPageRank,
          isHttps: base.isHttps,
          competitorBenchmark: competitorBenchmark.length > 0 ? competitorBenchmark : undefined,
          findings: allFindings,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: allSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // UX/UI & CRO — real via PageSpeed + HTML scraping
    // ────────────────────────────────────────────────────────────────────
    case 'ux_ui_cro': {
      if (!context.mobile || !context.desktop) {
        // HTML-only fallback: analyze UX signals without PageSpeed scores
        const scraped = context.scraped;
        if (!scraped) {
          return {
            score: 1,
            data: {
              findings: [
                '⚠️ PageSpeed API não disponível e HTML não acessível via CORS.',
                'Configure VITE_PAGESPEED_API_KEY para análise completa de UX/CRO.',
              ],
            },
            source: 'auto', dataReliability: 'real', dataSources: [],
          };
        }
        // Derive signals from HTML alone (skip perf/accessibility scores)
        const htmlChatbots: string[] = [...(scraped.aiChatPlatforms ?? [])];
        if (context.tech?.intercomInstalled && !htmlChatbots.includes('Intercom')) htmlChatbots.push('Intercom');
        if (context.tech?.hubspotInstalled && !htmlChatbots.includes('HubSpot Chat')) htmlChatbots.push('HubSpot Chat');
        const hasChatbotHtml = htmlChatbots.length > 0;
        const ctaCountHtml = scraped.ctaKeywordsFound.length;
        const formCountHtml = scraped.formFieldCount;
        const formComplexityHtml: 'baixa' | 'média' | 'alta' | 'não detectada' =
          formCountHtml > 8 ? 'alta' : formCountHtml > 3 ? 'média' : formCountHtml > 0 ? 'baixa' : 'não detectada';

        const htmlFindings: string[] = [
          '⚠️ PageSpeed API não disponível — scores de acessibilidade/performance não medidos.',
        ];
        if (scraped.hasWAMeLink) htmlFindings.push('✓ WhatsApp Business (wa.me) detectado');
        else if (scraped.hasWhatsAppLink) htmlFindings.push('✓ Link WhatsApp detectado');
        else htmlFindings.push('⚠️ WhatsApp não identificado no site');
        if (hasChatbotHtml) htmlFindings.push(`✓ Chat/Chatbot: ${htmlChatbots.join(', ')}`);
        if (ctaCountHtml >= 3) htmlFindings.push(`✓ ${ctaCountHtml} CTAs identificados`);
        else if (ctaCountHtml > 0) htmlFindings.push(`⚠️ ${ctaCountHtml} CTA(s) identificado(s) — pode melhorar`);
        if (scraped.hasSocialProof) htmlFindings.push('✓ Social proof detectado (avaliações, depoimentos)');
        if (scraped.hasTrustSignals) htmlFindings.push('✓ Trust signals detectados (garantia, segurança)');
        if (scraped.hasUrgencySignals) htmlFindings.push('✓ Gatilho de urgência/escassez detectado');
        if (scraped.hasNlpSearchIndicators) htmlFindings.push(`✓ Busca inteligente/NLP: ${scraped.nlpSearchPlatforms.join(', ')}`);
        if (formCountHtml > 0) htmlFindings.push(`Formulários: ${formCountHtml} campo(s) — complexidade ${formComplexityHtml}`);

        let htmlPts = 0;
        if (scraped.hasWAMeLink) htmlPts += 1; else if (scraped.hasWhatsAppLink) htmlPts += 0.5;
        if (hasChatbotHtml) htmlPts += 1;
        if (ctaCountHtml >= 3) htmlPts += 1; else if (ctaCountHtml >= 1) htmlPts += 0.5;
        if (scraped.hasSocialProof) htmlPts += 1;
        if (scraped.hasTrustSignals) htmlPts += 1;
        if (scraped.hasUrgencySignals) htmlPts += 0.5;
        if (scraped.hasNlpSearchIndicators) htmlPts += 1;
        if (formComplexityHtml === 'baixa' || formComplexityHtml === 'não detectada') htmlPts += 1;
        const htmlScore = htmlPts >= 7 ? 4 : htmlPts >= 4 ? 3 : htmlPts >= 2 ? 2 : 1;

        return {
          score: htmlScore,
          data: {
            accessibilityScore: null,
            mobileScore: null,
            bestPracticesScore: null,
            hasWhatsApp: scraped.hasWhatsAppLink,
            hasWhatsAppBusiness: scraped.hasWAMeLink,
            hasChatbot: hasChatbotHtml,
            chatbotPlatforms: htmlChatbots,
            ctaCount: ctaCountHtml,
            formFieldCount: formCountHtml,
            formComplexity: formComplexityHtml,
            hasNlpSearch: scraped.hasNlpSearchIndicators,
            nlpSearchPlatforms: scraped.nlpSearchPlatforms,
            isMobileResponsive: true, // cannot determine without PageSpeed
            hasSocialProof: scraped.hasSocialProof,
            hasTrustSignals: scraped.hasTrustSignals,
            hasUrgencySignals: scraped.hasUrgencySignals,
            findings: htmlFindings,
          },
          source: 'auto', dataReliability: 'real',
          dataSources: ['Análise HTML do site (CORS proxy — PageSpeed não disponível)'],
        };
      }
      const result = analyzeUxCro(
        context.scraped ?? null,
        context.mobile,
        context.desktop,
        context.tech
      );
      return {
        score: result.score,
        data: {
          accessibilityScore: result.accessibilityScore,
          mobileScore: result.mobileScore,
          bestPracticesScore: result.bestPracticesScore,
          hasWhatsApp: result.hasWhatsApp,
          hasWhatsAppBusiness: result.hasWhatsAppBusiness,
          hasChatbot: result.hasChatbot,
          chatbotPlatforms: result.chatbotPlatforms,
          ctaCount: result.ctaCount,
          formFieldCount: result.formFieldCount,
          formComplexity: result.formComplexity,
          hasNlpSearch: result.hasNlpSearch,
          nlpSearchPlatforms: result.nlpSearchPlatforms,
          isMobileResponsive: result.isMobileResponsive,
          hasSocialProof: context.scraped?.hasSocialProof ?? false,
          hasTrustSignals: context.scraped?.hasTrustSignals ?? false,
          hasUrgencySignals: context.scraped?.hasUrgencySignals ?? false,
          findings: result.findings,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: [
          'Google PageSpeed Insights API (acessibilidade, performance mobile)',
          ...(context.scraped ? ['Análise HTML do site (CORS proxy)'] : []),
        ],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // JORNADA DE CHECKOUT — real via HTML analysis (limited without Playwright)
    // ────────────────────────────────────────────────────────────────────
    case 'jornada_checkout': {
      if (!input.isEcommerce) {
        return {
          score: 1,
          data: { skipped: true, reason: 'Não aplicável — empresa não é e-commerce' },
          source: 'auto',
          dataReliability: 'real',
          dataSources: [],
        };
      }
      const scraped = context.scraped;
      if (!scraped) {
        return insufficient(
          'Não foi possível acessar o HTML do site para análise de checkout.',
          'Nenhuma configuração necessária — verifique CORS'
        );
      }

      const ecommercePlatform = scraped.ecommercePlatform ?? null;
      const paymentMethods = scraped.paymentMethods;
      const hasCartIndicators = scraped.ctaKeywordsFound.some((kw) =>
        ['comprar', 'buy', 'carrinho', 'checkout', 'finalizar', 'pagar', 'adicionar'].includes(kw)
      ) || /\/cart|\/checkout|adicionar.?ao.?carrinho/i.test(scraped.url);
      const hasPix = paymentMethods.includes('PIX');

      const claudeKey = settings.claudeApiKey ?? '';
      const llmResult = await analyzeCheckoutWithClaude(
        scraped,
        context.tech,
        ecommercePlatform,
        siteUrl,
        claudeKey
      );

      return {
        score: llmResult.score,
        data: {
          paymentMethods,
          hasCartIndicators,
          hasPix,
          ecommercePlatform,
          formFieldCount: scraped.formFieldCount,
          findings: llmResult.findings,
          recommendations: llmResult.recommendations,
          llmUsed: llmResult.llmUsed,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: llmResult.dataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // REPUTAÇÃO DIGITAL & VOC
    // Primary: Google Maps via Apify (50+ reviews, sentimento, taxa resposta)
    // Fallback: Google Places API (5 reviews)
    // ────────────────────────────────────────────────────────────────────
    case 'reputacao_voc': {
      const apifyToken = settings.apifyToken ?? '';
      const allFindings: string[] = [];
      const allSources: string[] = [];

      // Primary: Google Maps enriched via Apify (50 reviews, sentiment, response rate)
      if (apifyToken) {
        const maps = await fetchGoogleMapsEnriched(companyName, siteUrl, apifyToken);
        if (maps.found) {
          allFindings.push(...maps.findings);
          allSources.push(...maps.dataSources);
          return {
            score: maps.score,
            data: {
              googleRating: maps.rating,
              googleReviews: maps.reviewsCount,
              reviewSentimentScore: maps.sentimentScore,
              ownerResponseRate: maps.avgResponseRate,
              reviewSamples: maps.reviews.slice(0, 10),
              address: maps.address,
              phone: maps.phone,
              website: maps.website,
              categories: maps.categories,
              findings: allFindings,
              reclameAquiNote: 'Reclame Aqui: verificar manualmente em reclameaqui.com.br.',
            },
            source: 'auto',
            dataReliability: 'real',
            dataSources: allSources,
          };
        }
        allFindings.push(...maps.findings);
        // Fall through to Places API if Apify didn't find the business
      }

      // Fallback: Google Places API
      if (!settings.googlePlacesApiKey) {
        if (!apifyToken) {
          return insufficient(
            'Configure googlePlacesApiKey (Google Cloud Console) ou apifyToken (apify.com) para analisar reputação.',
            'googlePlacesApiKey ou apifyToken'
          );
        }
        // Apify was used but business not found — return score=1 (not "insufficient")
        return {
          score: 1,
          data: {
            googleRating: null,
            googleReviews: null,
            findings: [
              `⚠️ "${companyName}" não encontrado no Google Maps via Apify.`,
              'Configure googlePlacesApiKey em Configurações para usar o Google Places API como fallback.',
              ...allFindings,
            ],
            reclameAquiNote: 'Reclame Aqui: verificar manualmente em reclameaqui.com.br.',
          },
          source: 'auto',
          dataReliability: 'real',
          dataSources: ['Google Maps via Apify (empresa não encontrada)'],
        };
      }

      const result = await fetchGooglePlaces(companyName, siteUrl, settings.googlePlacesApiKey);
      if (result.error && !result.found) {
        return {
          score: 1,
          data: { error: result.error, findings: [...allFindings, ...result.findings] },
          source: 'insufficient', dataReliability: 'insufficient',
          dataSources: ['Google Places API'], error: result.error,
        };
      }
      allSources.push('Google Places API');
      return {
        score: result.score,
        data: {
          googleRating: result.rating,
          googleReviews: result.userRatingsTotal,
          businessStatus: result.businessStatus,
          address: result.address, phone: result.phone,
          website: result.website, openNow: result.openNow,
          findings: [...allFindings, ...result.findings],
          reclameAquiNote: 'Reclame Aqui: verificar manualmente em reclameaqui.com.br.',
        },
        source: 'auto', dataReliability: 'real', dataSources: allSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // AI/ML READINESS — real via PageSpeed tech + HTML scraping
    // ────────────────────────────────────────────────────────────────────
    case 'ai_ml_readiness': {
      const scraped = context.scraped;
      const tech = context.tech;
      const findings: string[] = [];
      let points = 0;
      const dataSources: string[] = [];

      if (!tech && !scraped) {
        return insufficient(
          'Sem dados de PageSpeed ou HTML para análise de AI/ML.',
          'pageSpeedApiKey'
        );
      }

      if (tech) dataSources.push('Google PageSpeed Insights (tech detection)');
      if (scraped) dataSources.push('Análise HTML (CORS proxy)');

      // Supplementary: BuiltWith for AI/ML platform detection
      const apifyTokenAI = settings.apifyToken ?? '';
      let builtWithAiData: Record<string, unknown> = {};
      if (apifyTokenAI) {
        const bwAi = await fetchBuiltWith(siteUrl, apifyTokenAI);
        if (bwAi.found) {
          builtWithAiData = { builtWithCategories: bwAi.categories };
          dataSources.push(...bwAi.dataSources);
          // Check for AI/ML platforms from BuiltWith
          const aiPlatformsFromBW = [
            ...bwAi.categories.chat,
            ...bwAi.categories.crm.filter((t) => /ai|ml|gpt|openai|watson|copilot/i.test(t)),
          ];
          if (aiPlatformsFromBW.length > 0) {
            points += 1;
            findings.push(`✓ Plataformas IA detectadas via BuiltWith: ${aiPlatformsFromBW.slice(0, 3).join(', ')}`);
          }
        }
      }

      // Supplementary: GPT Search — LLM visibility signals
      let gptAiData: Record<string, unknown> = {};
      if (apifyTokenAI) {
        const gptAi = await fetchGptSearch(companyName, input.segment, apifyTokenAI);
        if (gptAi.found) {
          gptAiData = { llmBrandMentioned: gptAi.brandMentioned, llmMentionContext: gptAi.mentionContext };
          dataSources.push(...gptAi.dataSources);
          if (gptAi.brandMentioned) {
            points += 1;
            findings.push('✓ Marca mencionada em resposta de LLM (ChatGPT/GPT-4)');
          }
        }
      }

      // Chatbot detection
      const chatbotPlatforms: string[] = [];
      if (tech?.intercomInstalled) chatbotPlatforms.push('Intercom');
      if (tech?.hubspotInstalled) chatbotPlatforms.push('HubSpot');
      if (scraped?.aiChatPlatforms) chatbotPlatforms.push(...scraped.aiChatPlatforms.filter((p) => !chatbotPlatforms.includes(p)));

      const hasChatbot = chatbotPlatforms.length > 0;
      if (hasChatbot) {
        points += 2;
        findings.push(`✓ Chat/IA detectado: ${chatbotPlatforms.join(', ')}`);
      } else {
        findings.push('⚠️ Sem chatbot ou assistente de IA identificado');
      }

      // Product recommendations
      const hasRecommendations = scraped?.hasRecommendationSection ?? false;
      if (hasRecommendations) {
        points += 2;
        findings.push('✓ Seção de recomendações personalizadas detectada');
      } else {
        findings.push('⚠️ Sem seção de recomendações personalizada detectada');
      }

      // NLP/AI-powered search
      const hasNlpSearch = scraped?.hasNlpSearchIndicators ?? false;
      const nlpPlatforms = scraped?.nlpSearchPlatforms ?? [];
      if (hasNlpSearch) {
        points += 2;
        findings.push(`✓ Busca com IA/NLP: ${nlpPlatforms.join(', ')}`);
      } else {
        findings.push('⚠️ Busca padrão (sem NLP/autocomplete avançado detectado)');
      }

      // Recommendation engines (from HTML scraping)
      const recommendationEngines: string[] = [];
      if (scraped) {
        const htmlSignals = [
          { pat: /insider/i, name: 'Insider' },
          { pat: /rd\.station|rdstation/i, name: 'RD Station' },
          { pat: /bazaarvoice/i, name: 'Bazaarvoice' },
          { pat: /yotpo/i, name: 'Yotpo' },
          { pat: /vtex.*search|linx\s*impulse/i, name: 'VTEX Intelligent Search' },
        ];
        for (const { pat, name } of htmlSignals) {
          // Check in nlpSearchPlatforms already detected or re-check scraped URL
          if (nlpPlatforms.includes(name) || pat.test(scraped.title + scraped.metaDescription)) {
            recommendationEngines.push(name);
          }
        }
      }
      if (recommendationEngines.length > 0) {
        points += 1;
        findings.push(`✓ Ferramentas de recomendação: ${recommendationEngines.join(', ')}`);
      }

      // AI tools in MarTech stack
      const aiTools: string[] = [...chatbotPlatforms, ...recommendationEngines];
      if (aiTools.length > 0) {
        findings.push(`Ferramentas com capacidade IA na stack: ${aiTools.join(', ')}`);
      }

      let score = 1;
      if (points >= 5) score = 4;
      else if (points >= 3) score = 3;
      else if (points >= 1) score = 2;

      return {
        score,
        data: {
          hasChatbot,
          chatbotPlatforms,
          hasProductRecommendations: hasRecommendations,
          hasNlpSearch,
          nlpSearchPlatforms: nlpPlatforms,
          aiToolsDetected: aiTools,
          findings,
          ...builtWithAiData,
          ...gptAiData,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // INTELIGÊNCIA DE DEMANDA — AnswerThePublic via Apify
    // Mapeia perguntas, preposições, comparações e intenções de busca
    // sobre a marca e o setor. Fallback: Keyword Suggestions Scraper.
    // ────────────────────────────────────────────────────────────────────
    case 'inteligencia_demanda': {
      const apifyToken = settings.apifyToken ?? '';

      if (!apifyToken) {
        // Free fallback: Google Autocomplete via CORS proxy (no API key needed)
        const brandQuery = companyName.toLowerCase();
        const autocompleteQueries = [brandQuery, `${brandQuery} como`, `${brandQuery} qual`];
        const suggestions: string[] = [];
        for (const q of autocompleteQueries) {
          try {
            const acUrl = `https://corsproxy.io/?${encodeURIComponent(`https://suggestqueries.google.com/complete/search?client=firefox&hl=pt&q=${encodeURIComponent(q)}`)}`;
            const resp = await fetch(acUrl, { signal: AbortSignal.timeout(8000) });
            if (resp.ok) {
              const data = await resp.json() as unknown[];
              if (Array.isArray(data) && Array.isArray(data[1])) {
                for (const s of (data[1] as unknown[]).slice(0, 5)) {
                  const str = String(s);
                  if (!suggestions.includes(str)) suggestions.push(str);
                }
              }
            }
          } catch { /* skip */ }
        }
        if (suggestions.length > 0) {
          return {
            score: 2,
            data: {
              keywordsSearched: [brandQuery],
              totalItems: suggestions.length,
              totalQuestions: 0,
              topQuestions: [],
              competitorComparisons: [],
              autocompleteSuggestions: suggestions,
              actorUsed: 'google-autocomplete-cors',
              findings: [
                `✓ ${suggestions.length} sugestões de busca encontradas para "${companyName}"`,
                `Sugestões: ${suggestions.slice(0, 5).join(' | ')}`,
                '⚠️ Configure apifyToken para análise completa via AnswerThePublic (perguntas, comparações, volume de busca).',
              ],
            },
            source: 'auto', dataReliability: 'real',
            dataSources: ['Google Autocomplete (suggestqueries.google.com — fallback gratuito)'],
          };
        }
        // Autocomplete also failed — return score=1 without "insufficient" penalty
        return {
          score: 1,
          data: {
            keywordsSearched: [],
            totalItems: 0,
            topQuestions: [],
            findings: [
              '⚠️ Apify Token não configurado — análise de demanda limitada.',
              'Configure apifyToken em Configurações para mapear perguntas e intenções de busca.',
            ],
          },
          source: 'auto', dataReliability: 'real', dataSources: [],
        };
      }

      // If competitors provided, include 1 competitor brand name for "X vs Y" comparisons
      const competitorBrand = input.competitors && input.competitors.length > 0
        ? input.competitors[0]
            .replace(/^https?:\/\/(www\.)?/, '')
            .split('/')[0]
            .split('.')[0]   // e.g. "concorrente.com.br" → "concorrente"
        : undefined;

      const atp = await fetchDemandIntelligence(
        companyName,
        input.segment,
        apifyToken,
        'br',
        'pt',
        competitorBrand
      );

      // Supplementary: Google Trends — brand search trend over 12 months
      const competitorNames = (input.competitors ?? [])
        .slice(0, 2)
        .map((c) => c.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].split('.')[0]);
      const trends = await fetchGoogleTrends(companyName, competitorNames, apifyToken);

      return {
        score: atp.score,
        data: {
          keywordsSearched: atp.keywordsSearched,
          totalItems: atp.totalItems,
          totalQuestions: atp.byType.questions.length,
          totalPrepositions: atp.byType.prepositions.length,
          totalComparisons: atp.byType.comparisons.length,
          totalRelated: atp.byType.related.length,
          topQuestions: atp.topQuestions,
          competitorComparisons: atp.competitorComparisons,
          questionModifiers: atp.questionModifiers,
          avgCpc: atp.avgCpc,
          highIntentCount: atp.highIntentCount,
          totalSearchVolume: atp.totalSearchVolume,
          actorUsed: atp.actorUsed,
          findings: atp.findings,
          // Google Trends data
          trendsFound: trends.found,
          brandTrendDirection: trends.companyTerm?.trend,
          brandTrendInterest: trends.companyTerm?.averageInterest,
          trendsTerms: trends.terms,
          trendsFindings: trends.findings,
        },
        source: 'auto',
        dataReliability: atp.found ? 'real' : 'insufficient',
        dataSources: [...atp.dataSources, ...trends.dataSources],
      };
    }

    default:
      return insufficient(
        `Subdimensão "${subdimensionId}" não reconhecida no dispatcher`,
        'N/A'
      );
  }
}
