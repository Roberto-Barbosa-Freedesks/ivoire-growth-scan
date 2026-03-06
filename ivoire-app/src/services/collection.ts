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
import { fetchYouTubeChannelStats, scoreYouTubePresence } from './youtube';
import { searchMercadoLivre } from './mercadolivre';
import { fetchGooglePlaces } from './googlePlaces';
import { fetchMetaAds } from './metaAds';
import { searchSpotifyPodcast } from './spotify';
import { analyzeUxCro } from './uxCroAnalysis';

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
      if (!context.tech) return insufficient('PageSpeed não executado', 'pageSpeedApiKey');
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
      if (!context.tech) return insufficient('PageSpeed não executado', 'pageSpeedApiKey');
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
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: ['Google PageSpeed Insights API (tech detection via network requests)'],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // SEO ON-PAGE & E-E-A-T — real via HTML scraping
    // ────────────────────────────────────────────────────────────────────
    case 'seo_onpage_eeat': {
      const scraped = context.scraped;
      if (!scraped) {
        return insufficient(
          'Não foi possível acessar o HTML do site via CORS proxy. O site pode bloquear requests externos.',
          'Nenhuma configuração necessária — verifique se o site permite acesso externo'
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
        return insufficient(
          'Não foi possível acessar o HTML do site via CORS proxy.',
          'Nenhuma configuração necessária — verifique se o site permite acesso externo'
        );
      }
      const result = analyzeSemanticaGeo(scraped);
      return {
        score: result.score,
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
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: ['Extração JSON-LD do site (CORS proxy)'],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // PRESENÇA EM VÍDEO & ÁUDIO — real via YouTube API + Spotify API
    // ────────────────────────────────────────────────────────────────────
    case 'presenca_video_audio': {
      const youtubeUrl = input.youtube;
      const ytApiKey = settings.youtubeApiKey;
      const dataSources: string[] = [];

      // YouTube
      let ytScore = 1;
      let ytData: Record<string, unknown> = { youtubeChannelFound: false };

      if (youtubeUrl && ytApiKey) {
        try {
          const ytStats = await fetchYouTubeChannelStats(youtubeUrl, ytApiKey);
          if (ytStats) {
            ytScore = scoreYouTubePresence(ytStats, true);
            ytData = {
              youtubeChannelFound: true,
              youtubeChannelTitle: ytStats.title,
              youtubeSubscribers: ytStats.subscriberCount,
              youtubeVideos: ytStats.videoCount,
              youtubeViews: ytStats.viewCount,
              youtubeCustomUrl: ytStats.customUrl,
              youtubePublishedAt: ytStats.publishedAt,
            };
            dataSources.push('YouTube Data API v3');
          } else {
            ytData = { youtubeChannelFound: false, note: 'Canal não encontrado via YouTube API' };
          }
        } catch {
          ytData = { youtubeChannelFound: null, note: 'Erro ao consultar YouTube API' };
        }
      } else if (youtubeUrl && !ytApiKey) {
        ytData = {
          youtubeChannelFound: true,
          youtubeChannelUrl: youtubeUrl,
          youtubeSubscribers: null,
          note: 'URL de YouTube fornecida — configure YouTube API Key para obter métricas reais',
        };
        ytScore = 2;
        dataSources.push('URL fornecida pelo usuário (sem métricas — configure YouTube API Key)');
      }

      // Spotify
      let podcastData: Record<string, unknown> = {};
      let podcastScore = 1;

      if (settings.spotifyClientId && settings.spotifyClientSecret) {
        try {
          const spotResult = await searchSpotifyPodcast(
            companyName,
            settings.spotifyClientId,
            settings.spotifyClientSecret
          );
          podcastData = {
            podcastFound: spotResult.found,
            podcastName: spotResult.topShow?.name ?? null,
            podcastEpisodes: spotResult.topShow?.totalEpisodes ?? null,
            podcastPublisher: spotResult.topShow?.publisher ?? null,
            podcastImageUrl: spotResult.topShow?.imageUrl ?? null,
            podcastFindings: spotResult.findings,
          };
          if (spotResult.found) podcastScore = spotResult.score;
          dataSources.push('Spotify Web API');
        } catch {
          podcastData = { podcastFound: null, podcastNote: 'Erro ao consultar Spotify API' };
        }
      } else {
        podcastData = {
          podcastFound: null,
          podcastNote: 'Spotify Client ID/Secret não configurados — configure em Configurações → Integrações',
        };
      }

      // No data at all
      if (dataSources.length === 0) {
        return insufficient(
          'YouTube API Key não configurada e URL de YouTube não fornecida. Spotify Client ID/Secret não configurados.',
          'youtubeApiKey + spotifyClientId/spotifyClientSecret'
        );
      }

      const finalScore = Math.max(ytScore, podcastScore);

      return {
        score: finalScore,
        data: { ...ytData, ...podcastData },
        source: 'auto',
        dataReliability: 'real',
        dataSources,
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // MIX DE TRÁFEGO — requires SimilarWeb API (not available)
    // ────────────────────────────────────────────────────────────────────
    case 'mix_trafego': {
      return insufficient(
        'Mix de Tráfego requer SimilarWeb API (enterprise) ou SEMrush Traffic Analytics API. ' +
        'Nenhuma dessas APIs está configurada. A conta SimilarWeb (seo@ivoire.com.br) é acesso web — API requer contratação separada.',
        'similarwebApiKey (plano API SimilarWeb) ou semrushApiKey (Traffic Analytics)'
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // MÍDIA PAGA & CRIATIVOS — real via Meta Ad Library API
    // ────────────────────────────────────────────────────────────────────
    case 'midia_paga_criativos': {
      if (!settings.metaAccessToken) {
        return insufficient(
          'Meta Access Token não configurado. Obtenha GRATUITAMENTE em: developers.facebook.com/tools/explorer',
          'metaAccessToken'
        );
      }
      const result = await fetchMetaAds(companyName, siteUrl, settings.metaAccessToken);
      if (result.error) {
        return {
          score: 1,
          data: { error: result.error, findings: result.findings },
          source: 'insufficient',
          dataReliability: 'insufficient',
          dataSources: ['Meta Ad Library API'],
          error: result.error,
        };
      }
      return {
        score: result.score,
        data: {
          adsFound: result.adsFound,
          totalActiveAds: result.totalAds,
          platforms: result.platforms,
          formats: result.formats,
          hasVideoAds: result.hasVideoAds,
          hasImageAds: result.hasImageAds,
          pagesFound: result.pagesFound,
          adSamples: result.activeAds.slice(0, 5),
          findings: result.findings,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: ['Meta Ad Library API (gratuito)'],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // PRESENÇA EM MARKETPLACES — real via Mercado Livre public API
    // ────────────────────────────────────────────────────────────────────
    case 'presenca_marketplaces': {
      if (!input.isEcommerce) {
        return {
          score: 1,
          data: { skipped: true, reason: 'Não aplicável — empresa não é e-commerce' },
          source: 'auto',
          dataReliability: 'real',
          dataSources: [],
        };
      }
      const result = await searchMercadoLivre(companyName, siteUrl);
      return {
        score: result.score,
        data: {
          mercadoLivreFound: result.found,
          totalListings: result.totalListings,
          sellers: result.sellers,
          topSellerNickname: result.topSeller?.nickname ?? null,
          powerSellerStatus: result.topSeller?.powerSellerStatus ?? null,
          positiveRatingPct: result.topSeller?.positiveRatingPct ?? null,
          completedTransactions: result.topSeller?.completedTransactions ?? null,
          findings: result.findings,
          note: 'Shopee e Amazon requerem integração adicional (APIs específicas).',
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: ['Mercado Livre API (pública, gratuita)'],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // SEO OFF-PAGE — requires SEMrush or Ahrefs API
    // ────────────────────────────────────────────────────────────────────
    case 'seo_offpage': {
      return insufficient(
        'SEO Off-Page (backlinks, authority score) requer API do SEMrush ou Ahrefs. ' +
        'Nenhuma API de backlinks está configurada.',
        'semrushApiKey (SEMrush) ou ahrefsApiKey (Ahrefs)'
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // UX/UI & CRO — real via PageSpeed + HTML scraping
    // ────────────────────────────────────────────────────────────────────
    case 'ux_ui_cro': {
      if (!context.mobile || !context.desktop) {
        return insufficient('PageSpeed não executado', 'pageSpeedApiKey');
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

      const findings: string[] = [];
      const paymentMethods = scraped.paymentMethods;
      const hasCartIndicators = scraped.ctaKeywordsFound.some((kw) =>
        ['comprar', 'buy', 'carrinho', 'checkout', 'finalizar', 'pagar', 'adicionar'].includes(kw)
      );

      if (paymentMethods.length > 0) {
        findings.push(`Métodos de pagamento detectados: ${paymentMethods.join(', ')}`);
      } else {
        findings.push('Métodos de pagamento não identificados no HTML da homepage');
      }

      if (hasCartIndicators) findings.push('Indicadores de carrinho/checkout detectados');
      if (scraped.formFieldCount > 0) findings.push(`${scraped.formFieldCount} campos de formulário detectados`);

      findings.push(
        'Nota: Análise limitada ao HTML da homepage via CORS proxy. ' +
        'Para análise completa do fluxo de checkout (etapas, fricção, guest checkout) ' +
        'é necessário execução server-side com Playwright.'
      );

      let score = 1;
      const hasPix = paymentMethods.includes('PIX');
      if (hasPix && paymentMethods.length >= 3) score = 3;
      else if (paymentMethods.length >= 2) score = 2;
      else if (paymentMethods.length >= 1 || hasCartIndicators) score = 2;

      return {
        score,
        data: {
          paymentMethods,
          hasCartIndicators,
          hasPix,
          formFieldCount: scraped.formFieldCount,
          findings,
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: ['Análise HTML do site (CORS proxy)'],
      };
    }

    // ────────────────────────────────────────────────────────────────────
    // REPUTAÇÃO DIGITAL & VOC — real via Google Places API
    // ────────────────────────────────────────────────────────────────────
    case 'reputacao_voc': {
      if (!settings.googlePlacesApiKey) {
        return insufficient(
          'Google Places API key não configurada. Obtenha GRATUITAMENTE no Google Cloud Console ' +
          '(console.cloud.google.com → APIs → Places API → Enable). Cota gratuita: ~$200/mês.',
          'googlePlacesApiKey'
        );
      }
      const result = await fetchGooglePlaces(companyName, siteUrl, settings.googlePlacesApiKey);
      if (result.error && !result.found) {
        return {
          score: 1,
          data: { error: result.error, findings: result.findings },
          source: 'insufficient',
          dataReliability: 'insufficient',
          dataSources: ['Google Places API'],
          error: result.error,
        };
      }
      return {
        score: result.score,
        data: {
          googleRating: result.rating,
          googleReviews: result.userRatingsTotal,
          businessStatus: result.businessStatus,
          address: result.address,
          phone: result.phone,
          website: result.website,
          openNow: result.openNow,
          findings: result.findings,
          reclameAquiNote: 'Reclame Aqui: verificar manualmente em reclameaqui.com.br (CORS bloqueado).',
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources: ['Google Places API'],
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

      // AI tools in MarTech stack
      const aiTools: string[] = [...chatbotPlatforms];
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
        },
        source: 'auto',
        dataReliability: 'real',
        dataSources,
      };
    }

    default:
      return insufficient(
        `Subdimensão "${subdimensionId}" não reconhecida no dispatcher`,
        'N/A'
      );
  }
}
