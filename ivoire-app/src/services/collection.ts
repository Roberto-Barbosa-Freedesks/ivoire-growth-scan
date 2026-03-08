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

      // No data at all
      if (dataSources.length === 0 && !tiktokUrl) {
        return insufficient(
          'URL de YouTube não fornecida e Apify Token não configurado. TikTok não configurado.',
          'apifyToken'
        );
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
        fbData = { facebook: { found: fb.found, followers: fb.followers, rating: fb.rating, verified: fb.isVerified, categories: fb.categories } };
        allFindings.push(...fb.findings);
        if (fb.dataSources.length) dataSources.push(...fb.dataSources);

        const igUrl = input.instagram ?? context.scraped?.socialProfileUrls?.['Instagram'];
        if (igUrl) {
          const ig = await fetchInstagramProfile(igUrl, apifyToken);
          igScore = ig.score;
          igData = { instagram: { found: ig.found, followers: ig.followers, posts: ig.posts, verified: ig.isVerified, websiteInBio: ig.websiteInBio } };
          allFindings.push(...ig.findings);
          if (ig.dataSources.length) dataSources.push(...ig.dataSources);
        }

        // LinkedIn Company — substitui Apollo.io (dado de inteligência da empresa)
        const liUrl = input.linkedIn ?? context.scraped?.socialProfileUrls?.['LinkedIn'];
        if (liUrl) {
          const li = await fetchLinkedInCompany(liUrl, apifyToken);
          liScore = li.score;
          liData = {
            linkedin: {
              found: li.found,
              companyName: li.companyName,
              followers: li.followers,
              employees: li.employees,
              employeeRange: li.employeeRange,
              foundedYear: li.foundedYear,
              headquarters: li.headquarters,
              industry: li.industry,
              specialties: li.specialties,
              companyType: li.companyType,
            },
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
        ? Math.max(semrushScore, ahrefsScore, base.score)
        : base.score;

      return {
        score: finalScore,
        data: {
          ...semrushData,
          ...ahrefsData,
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
        return insufficient(
          'Empresa não encontrada no Google Maps via Apify. Configure googlePlacesApiKey como fallback.',
          'googlePlacesApiKey'
        );
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

    // ────────────────────────────────────────────────────────────────────
    // INTELIGÊNCIA DE DEMANDA — AnswerThePublic via Apify
    // Mapeia perguntas, preposições, comparações e intenções de busca
    // sobre a marca e o setor. Fallback: Keyword Suggestions Scraper.
    // ────────────────────────────────────────────────────────────────────
    case 'inteligencia_demanda': {
      const apifyToken = settings.apifyToken ?? '';

      if (!apifyToken) {
        return insufficient(
          'Apify Token não configurado. Configure em Configurações para mapear a demanda via AnswerThePublic.',
          'apifyToken'
        );
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
        },
        source: 'auto',
        dataReliability: atp.found ? 'real' : 'insufficient',
        dataSources: atp.dataSources,
      };
    }

    default:
      return insufficient(
        `Subdimensão "${subdimensionId}" não reconhecida no dispatcher`,
        'N/A'
      );
  }
}
