import type { SkillDefinition } from './types';
import { getSegmentKey, SEGMENT_LABELS, TRAFFIC_THRESHOLDS, AUTHORITY_THRESHOLDS, DOMINANT_CHANNEL } from './segmentConfig';

// ─────────────────────────────────────────────────────────────────────────────
// 1. TRACKING HEALTH
// ─────────────────────────────────────────────────────────────────────────────
const trackingHealthSkill: SkillDefinition = {
  subdimensionId: 'tracking_health',
  subdimensionName: 'Tracking & Health',
  expertPersona:
    'Você é um especialista sênior em Analytics e MarTech com 15+ anos de experiência no mercado brasileiro, profundo conhecedor de GTM, GA4, Meta Pixel e LGPD/Consent Mode v2.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `GTM instalado: ${rawData.gtmPresent ? 'sim' : 'não'}`,
      `GA4 configurado: ${rawData.ga4Configured ? 'sim' : 'não'}`,
      `Meta Pixel: ${rawData.metaPixel ? 'sim' : 'não'}`,
      `LinkedIn Insight Tag: ${rawData.linkedinInsightTag ? 'sim' : 'não'}`,
      `TikTok Pixel: ${rawData.tiktokPixel ? 'sim' : 'não'}`,
      `Hotjar instalado: ${rawData.hotjarInstalled ? 'sim' : 'não'}`,
      `Consent Mode v2: ${rawData.consentModeV2 ? 'sim' : 'não'}`,
      `Total de terceiros: ${rawData.totalThirdParties ?? 'N/D'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise o Tracking & Health de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a cobertura de pixels, qualidade do setup de analytics, conformidade com LGPD/Consent Mode v2 e gaps críticos de mensuração para o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings objetivos sobre o estado de tracking"],"insights":["...2-3 insights estratégicos considerando o contexto de segmento {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    varejo_ecommerce: 'alto',
    saas_b2b_tecnologia: 'alto',
    financeiro_fintech: 'alto',
    moda_lifestyle: 'alto',
    educacao: 'medio',
    saude_bemestar: 'medio',
    imobiliario: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. STACK MARTECH
// ─────────────────────────────────────────────────────────────────────────────
const stackMartechSkill: SkillDefinition = {
  subdimensionId: 'stack_martech',
  subdimensionName: 'Stack MarTech',
  expertPersona:
    'Você é um arquiteto de MarTech e CRM com 18+ anos de experiência, especialista em avaliar e recomendar stacks tecnológicos de marketing para empresas brasileiras de todos os segmentos.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    const categories = Array.isArray(rawData.categoriesCovered) ? rawData.categoriesCovered : [];
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Categorias cobertas: ${categories.length > 0 ? categories.join(', ') : 'nenhuma detectada'}`,
      `Total de tecnologias: ${rawData.totalTechnologies ?? 'N/D'}`,
      `GTM: ${rawData.gtmInstalled ? 'sim' : 'não'}`,
      `GA4: ${rawData.ga4Installed ? 'sim' : 'não'}`,
      `Meta Pixel: ${rawData.metaPixel ? 'sim' : 'não'}`,
      `HubSpot: ${rawData.hubspotInstalled ? 'sim' : 'não'}`,
      `Intercom: ${rawData.intercomInstalled ? 'sim' : 'não'}`,
      `Hotjar: ${rawData.hotjarInstalled ? 'sim' : 'não'}`,
      `Consent Mode v2 / LGPD: ${rawData.consentModeV2 ? 'sim' : 'não'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Stack MarTech de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a completude das categorias de MarTech (analytics, automação, CRM, heat-mapping, consentimento), os gaps para o segmento {{SEGMENT}} e o custo-benefício das ferramentas.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre a stack atual"],"insights":["...2-3 insights estratégicos sobre gaps e oportunidades de stack para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    saas_b2b_tecnologia: 'alto',
    varejo_ecommerce: 'alto',
    financeiro_fintech: 'alto',
    educacao: 'alto',
    saude_bemestar: 'medio',
    servicos_profissionais: 'medio',
    moda_lifestyle: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SEO ON-PAGE & E-E-A-T
// ─────────────────────────────────────────────────────────────────────────────
const seoOnpageSkill: SkillDefinition = {
  subdimensionId: 'seo_onpage_eeat',
  subdimensionName: 'SEO On-Page & E-E-A-T',
  expertPersona:
    'Você é um especialista em SEO técnico e E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) com 15+ anos otimizando sites brasileiros para o Google, com foco em conteúdo, estrutura e autoridade temática.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Title: ${rawData.title ?? 'N/D'} (otimizado: ${rawData.titleOptimized ? 'sim' : 'não'})`,
      `Meta description presente: ${rawData.metaDescPresent ? 'sim' : 'não'}`,
      `H1 count: ${rawData.h1Count ?? 'N/D'} | H1 otimizado: ${rawData.h1Optimized ? 'sim' : 'não'}`,
      `Schema types: ${JSON.stringify(rawData.schemaTypes ?? [])}`,
      `Schema count: ${rawData.schemaCount ?? 0}`,
      `Schema Organization: ${rawData.hasOrganizationSchema ? 'sim' : 'não'}`,
      `Author info (E-E-A-T): ${rawData.hasAuthorInfo ? 'sim' : 'não'}`,
      `Canonical presente: ${rawData.canonicalPresent ? 'sim' : 'não'}`,
      `PageSpeed SEO score: ${rawData.pagespeedSeoScore ?? 'N/D'}/100`,
      `Imagens com alt (%): ${rawData.imagesWithAltPct != null ? `${Number(rawData.imagesWithAltPct).toFixed(0)}%` : 'N/D'}`,
      `Página "Sobre": ${rawData.hasAboutPage ? 'sim' : 'não'}`,
      `Página "Contato": ${rawData.hasContactPage ? 'sim' : 'não'}`,
      `Links internos: ${rawData.internalLinksCount ?? 'N/D'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise o SEO On-Page e E-E-A-T de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a estrutura técnica SEO, sinais de E-E-A-T (experiência, expertise, autoridade, confiabilidade), uso de dados estruturados e conformidade com os critérios do Google para o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 5 findings técnicos objetivos"],"insights":["...2-3 insights estratégicos sobre SEO e E-E-A-T para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    saude_bemestar: 'alto',
    financeiro_fintech: 'alto',
    educacao: 'alto',
    varejo_ecommerce: 'alto',
    saas_b2b_tecnologia: 'medio',
    servicos_profissionais: 'medio',
    imobiliario: 'medio',
    moda_lifestyle: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. SEMÂNTICA & GEO
// ─────────────────────────────────────────────────────────────────────────────
const semanticaGeoSkill: SkillDefinition = {
  subdimensionId: 'semantica_geo',
  subdimensionName: 'Semântica & GEO',
  expertPersona:
    'Você é um especialista em SEO Semântico e GEO (Generative Engine Optimization) com experiência em dados estruturados, schema.org, e otimização para IA generativa (ChatGPT, Gemini, Perplexity) no mercado brasileiro.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    const richResultTypes = Array.isArray(rawData.richResultTypes) ? rawData.richResultTypes : [];
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Schema types: ${JSON.stringify(rawData.schemaTypes ?? [])}`,
      `Schema count: ${rawData.schemaCount ?? 0}`,
      `JSON-LD count: ${rawData.jsonLdCount ?? 0}`,
      `Organization schema: ${rawData.hasOrganization ? 'sim' : 'não'}`,
      `WebSite schema: ${rawData.hasWebSite ? 'sim' : 'não'}`,
      `Rich Results types: ${richResultTypes.length > 0 ? richResultTypes.join(', ') : 'nenhum'}`,
      `Rich Results count: ${rawData.richResultsCount ?? 0}`,
      `Visibilidade GEO: ${rawData.geoVisibility ?? 'N/D'}`,
      `FAQ schema: ${rawData.hasFAQ ? 'sim' : 'não'}`,
      `Product schema: ${rawData.hasProduct ? 'sim' : 'não'}`,
      `Article schema: ${rawData.hasArticle ? 'sim' : 'não'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Semântica & GEO de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie o uso de dados estruturados (schema.org), potencial de rich results no Google e preparo para GEO (Generative Engine Optimization — aparecer em respostas de IAs como ChatGPT, Gemini e Perplexity) considerando o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre dados estruturados e GEO"],"insights":["...2-3 insights sobre oportunidades de schema e visibilidade em IA generativa para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    saude_bemestar: 'alto',
    educacao: 'alto',
    varejo_ecommerce: 'alto',
    alimentacao_restaurantes: 'alto',
    imobiliario: 'medio',
    servicos_profissionais: 'medio',
    saas_b2b_tecnologia: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. PRESENÇA EM VÍDEO & ÁUDIO
// ─────────────────────────────────────────────────────────────────────────────
const presencaVideoAudioSkill: SkillDefinition = {
  subdimensionId: 'presenca_video_audio',
  subdimensionName: 'Presença em Vídeo & Áudio',
  expertPersona:
    'Você é um estrategista de conteúdo audiovisual e Social Media com 12+ anos de experiência no mercado brasileiro, especialista em YouTube, TikTok e estratégias de crescimento de audiência.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `YouTube — inscritos: ${rawData.youtubeSubscribers ?? 'N/D'}`,
      `YouTube — vídeos publicados: ${rawData.youtubeVideos ?? 'N/D'}`,
      `YouTube — visualizações totais: ${rawData.youtubeViews ?? 'N/D'}`,
      `YouTube — verificado: ${rawData.youtubeVerified ? 'sim' : 'não'}`,
      `TikTok — seguidores: ${rawData.tiktokFollowers ?? 'N/D'}`,
      `TikTok — vídeos: ${rawData.tiktokVideos ?? 'N/D'}`,
      `TikTok — curtidas totais: ${rawData.tiktokLikes ?? 'N/D'}`,
      `TikTok — verificado: ${rawData.tiktokVerified ? 'sim' : 'não'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Presença em Vídeo & Áudio de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a maturidade da presença em YouTube e TikTok, engajamento relativo ao segmento {{SEGMENT}}, frequência de publicação e potencial de crescimento de audiência.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre a presença audiovisual"],"insights":["...2-3 insights estratégicos sobre oportunidades de vídeo para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    moda_lifestyle: 'alto',
    alimentacao_restaurantes: 'alto',
    educacao: 'alto',
    saude_bemestar: 'alto',
    varejo_ecommerce: 'medio',
    hospitalidade_turismo: 'medio',
    servicos_profissionais: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. MIX DE TRÁFEGO
// ─────────────────────────────────────────────────────────────────────────────
const mixTrafegoSkill: SkillDefinition = {
  subdimensionId: 'mix_trafego',
  subdimensionName: 'Mix de Tráfego',
  expertPersona:
    'Você é um Head de Performance e Growth Marketing com 20+ anos de experiência no mercado brasileiro, especialista em análise de canais digitais e benchmarking de tráfego por segmento.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    const thresholds = TRAFFIC_THRESHOLDS[seg];
    const dominantChannel = DOMINANT_CHANNEL[seg];
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Visitas mensais: ${rawData.monthlyVisits != null ? Number(rawData.monthlyVisits).toLocaleString('pt-BR') : 'N/D'}`,
      `Ranking global: ${rawData.globalRank != null ? `#${Number(rawData.globalRank).toLocaleString('pt-BR')}` : 'N/D'}`,
      `Taxa de rejeição: ${rawData.bounceRate != null ? `${(Number(rawData.bounceRate) * 100).toFixed(1)}%` : 'N/D'}`,
      `Duração média da visita: ${rawData.avgVisitDuration ?? 'N/D'}`,
      `Páginas por visita: ${rawData.pagesPerVisit ?? 'N/D'}`,
      `Mix de canais: ${JSON.stringify(rawData.channelMix ?? rawData.trafficSources ?? {})}`,
      `Canal dominante no segmento: ${dominantChannel}`,
      `Benchmark ${SEGMENT_LABELS[seg]}: Ativo (3.0) = ${thresholds.nivel3.toLocaleString('pt-BR')} visitas/mês | Exponencial (4.0) = ${thresholds.nivel4.toLocaleString('pt-BR')} visitas/mês`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise o Mix de Tráfego de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a diversificação de canais, dependência excessiva em algum canal, benchmarks de visitas para o segmento {{SEGMENT}} e oportunidades de crescimento de tráfego qualificado.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings objetivos sobre tráfego e canais"],"insights":["...2-3 insights estratégicos com contexto de benchmark para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    varejo_ecommerce: 'alto',
    saas_b2b_tecnologia: 'alto',
    educacao: 'alto',
    moda_lifestyle: 'alto',
    financeiro_fintech: 'medio',
    hospitalidade_turismo: 'medio',
    saude_bemestar: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. MÍDIA PAGA & CRIATIVOS
// ─────────────────────────────────────────────────────────────────────────────
const midiaPagaSkill: SkillDefinition = {
  subdimensionId: 'midia_paga_criativos',
  subdimensionName: 'Mídia Paga & Criativos',
  expertPersona:
    'Você é um especialista em mídia paga e social media com 15+ anos de experiência no Brasil, com domínio de Meta Ads, Google Ads e estratégias de creative testing para diferentes segmentos.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Anúncios ativos (Meta): ${rawData.totalActiveAds ?? 'N/D'}`,
      `Plataformas ativas: ${JSON.stringify(rawData.platforms ?? [])}`,
      `Formatos de anúncio: ${JSON.stringify(rawData.formats ?? [])}`,
      `Anúncios em vídeo: ${rawData.hasVideoAds ? 'sim' : 'não'}`,
      `Facebook — seguidores: ${rawData.fbFollowers ?? 'N/D'}`,
      `Facebook — avaliação: ${rawData.fbRating ?? 'N/D'}/5`,
      `Instagram — seguidores: ${rawData.igFollowers ?? 'N/D'}`,
      `Instagram — posts: ${rawData.igPosts ?? 'N/D'}`,
      `LinkedIn — seguidores: ${rawData.liFollowers ?? 'N/D'}`,
      `LinkedIn — funcionários: ${rawData.liEmployees ?? 'N/D'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Mídia Paga & Criativos de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a sofisticação da estratégia de mídia paga, diversidade de formatos criativos, presença orgânica nas redes sociais e benchmarks de engajamento para o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre mídia paga e social"],"insights":["...2-3 insights estratégicos sobre criativos e canais pagos para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    varejo_ecommerce: 'alto',
    moda_lifestyle: 'alto',
    educacao: 'alto',
    alimentacao_restaurantes: 'alto',
    saude_bemestar: 'medio',
    imobiliario: 'medio',
    saas_b2b_tecnologia: 'medio',
    financeiro_fintech: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. PRESENÇA EM MARKETPLACES
// ─────────────────────────────────────────────────────────────────────────────
const presencaMarketplacesSkill: SkillDefinition = {
  subdimensionId: 'presenca_marketplaces',
  subdimensionName: 'Presença em Marketplaces',
  expertPersona:
    'Você é um especialista em marketplace e e-commerce brasileiro com 14+ anos de experiência, especialista em estratégias de presença em Mercado Livre, Shopee, Amazon Brasil e outros canais de marketplace.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Encontrado no Mercado Livre: ${rawData.mercadoLivreFound ? 'sim' : 'não'}`,
      `Total de listagens: ${rawData.totalListings ?? 'N/D'}`,
      `Status Power Seller: ${rawData.powerSellerStatus ?? 'N/D'}`,
      `Rating positivo: ${rawData.positiveRatingPct != null ? `${rawData.positiveRatingPct}%` : 'N/D'}`,
      `Transações concluídas: ${rawData.completedTransactions != null ? Number(rawData.completedTransactions).toLocaleString('pt-BR') : 'N/D'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Presença em Marketplaces de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a maturidade da operação em marketplaces (Mercado Livre, Shopee, Amazon Brasil), reputação, volume de transações e estratégia omnicanal para o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre a presença em marketplaces"],"insights":["...2-3 insights estratégicos sobre oportunidades de marketplace para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    varejo_ecommerce: 'alto',
    moda_lifestyle: 'alto',
    agronegocio: 'medio',
    industria_manufatura: 'medio',
    alimentacao_restaurantes: 'baixo',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. SEO OFF-PAGE
// ─────────────────────────────────────────────────────────────────────────────
const seoOffpageSkill: SkillDefinition = {
  subdimensionId: 'seo_offpage',
  subdimensionName: 'SEO Off-Page',
  expertPersona:
    'Você é um especialista em SEO Off-Page e Link Building com 16+ anos de experiência no mercado brasileiro, com domínio de análise de autoridade de domínio, perfil de backlinks e estratégias de link building ético.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    const thresholds = AUTHORITY_THRESHOLDS[seg];
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Authority Score (SEMrush): ${rawData.semrushAuthorityScore ?? rawData.authorityScore ?? 'N/D'}`,
      `Domain Rating (Ahrefs): ${rawData.ahrefsDomainRating ?? 'N/D'}`,
      `Open PageRank: ${rawData.openPageRank ?? 'N/D'}`,
      `Total backlinks: ${rawData.totalBacklinks != null ? Number(rawData.totalBacklinks).toLocaleString('pt-BR') : 'N/D'}`,
      `Domínios de referência: ${rawData.referringDomains != null ? Number(rawData.referringDomains).toLocaleString('pt-BR') : 'N/D'}`,
      `Idade do domínio: ${rawData.domainAge ?? 'N/D'}`,
      `robots.txt: ${rawData.hasRobotsTxt ? 'sim' : 'não'}`,
      `sitemap.xml: ${rawData.hasSitemapXml ? 'sim' : 'não'}`,
      `URLs no sitemap: ${rawData.sitemapUrlCount ?? 'N/D'}`,
      `Benchmark ${SEGMENT_LABELS[seg]}: Authority Score Ativo = ${thresholds.nivel3} | Exponencial = ${thresholds.nivel4}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise o SEO Off-Page de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a autoridade de domínio, qualidade e diversidade do perfil de backlinks, maturidade técnica (robots, sitemap) e oportunidades de link building considerando os benchmarks do segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre autoridade e backlinks"],"insights":["...2-3 insights estratégicos sobre off-page SEO para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    saas_b2b_tecnologia: 'alto',
    financeiro_fintech: 'alto',
    saude_bemestar: 'alto',
    varejo_ecommerce: 'alto',
    educacao: 'medio',
    imobiliario: 'medio',
    servicos_profissionais: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. UX/UI & CRO
// ─────────────────────────────────────────────────────────────────────────────
const uxUiCroSkill: SkillDefinition = {
  subdimensionId: 'ux_ui_cro',
  subdimensionName: 'UX/UI & CRO',
  expertPersona:
    'Você é um especialista em UX, Design de Interfaces e CRO (Conversion Rate Optimization) com 14+ anos de experiência no mercado digital brasileiro, especialista em otimizar jornadas de usuário e aumentar taxas de conversão.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Score de acessibilidade: ${rawData.accessibilityScore ?? 'N/D'}/100`,
      `Score mobile (PageSpeed): ${rawData.mobileScore ?? 'N/D'}/100`,
      `Best Practices: ${rawData.bestPracticesScore ?? 'N/D'}/100`,
      `WhatsApp presente: ${rawData.hasWhatsApp ? 'sim' : 'não'}`,
      `Chatbot: ${rawData.hasChatbot ? 'sim' : 'não'}`,
      `CTAs detectados: ${rawData.ctaCount ?? 'N/D'}`,
      `Campos em formulários: ${rawData.formFieldCount ?? 'N/D'}`,
      `Social proof: ${rawData.hasSocialProof ? 'sim' : 'não'}`,
      `Trust signals: ${rawData.hasTrustSignals ? 'sim' : 'não'}`,
      `Urgência/escassez: ${rawData.hasUrgencySignals ? 'sim' : 'não'}`,
      `Site responsivo (mobile): ${rawData.isMobileResponsive ? 'sim' : 'não'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise o UX/UI & CRO de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a qualidade da experiência mobile, acessibilidade, elementos de conversão (CTAs, social proof, trust signals), canais de atendimento e oportunidades de otimização de conversão para o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 5 findings sobre UX, mobile e elementos de conversão"],"insights":["...2-3 insights estratégicos sobre CRO e UX para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    varejo_ecommerce: 'alto',
    financeiro_fintech: 'alto',
    saas_b2b_tecnologia: 'alto',
    saude_bemestar: 'alto',
    educacao: 'medio',
    imobiliario: 'medio',
    moda_lifestyle: 'medio',
    hospitalidade_turismo: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. JORNADA DE CHECKOUT
// ─────────────────────────────────────────────────────────────────────────────
const jornadaCheckoutSkill: SkillDefinition = {
  subdimensionId: 'jornada_checkout',
  subdimensionName: 'Jornada de Checkout',
  expertPersona:
    'Você é um especialista sênior em e-commerce e checkout optimization com 16+ anos de experiência no mercado brasileiro, com profundo conhecimento de plataformas (VTEX, Shopify, WooCommerce, Nuvemshop) e melhores práticas de conversão.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    const paymentMethods = Array.isArray(rawData.paymentMethods) ? rawData.paymentMethods : [];
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Plataforma e-commerce: ${rawData.ecommercePlatform ?? 'não identificada'}`,
      `Métodos de pagamento: ${paymentMethods.length > 0 ? paymentMethods.join(', ') : 'não detectados'}`,
      `PIX disponível: ${rawData.hasPix ? 'sim' : 'não'}`,
      `Indicadores de carrinho: ${rawData.hasCartIndicators ? 'sim' : 'não'}`,
      `Campos no formulário: ${rawData.formFieldCount ?? 'N/D'}`,
      `Análise LLM utilizada: ${rawData.llmUsed ? 'sim' : 'não'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Jornada de Checkout de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a completude do funil de checkout, variedade de métodos de pagamento (com atenção especial ao PIX), fricção na jornada e oportunidades de redução de abandono de carrinho para o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre o checkout e funil de compra"],"insights":["...2-3 insights estratégicos sobre otimização de checkout para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    varejo_ecommerce: 'alto',
    moda_lifestyle: 'alto',
    alimentacao_restaurantes: 'alto',
    saude_bemestar: 'medio',
    educacao: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. REPUTAÇÃO DIGITAL & VOC
// ─────────────────────────────────────────────────────────────────────────────
const reputacaoVocSkill: SkillDefinition = {
  subdimensionId: 'reputacao_voc',
  subdimensionName: 'Reputação Digital & VoC',
  expertPersona:
    'Você é um especialista em Reputação Digital, Customer Experience e Voz do Cliente (VoC) com 15+ anos de experiência no mercado brasileiro, especialista em gestão de reviews, NPS digital e resposta a feedback.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Avaliação Google Maps: ${rawData.googleRating ?? 'N/D'}/5`,
      `Número de reviews: ${rawData.googleReviews != null ? Number(rawData.googleReviews).toLocaleString('pt-BR') : 'N/D'}`,
      `Score de sentimento dos reviews: ${rawData.reviewSentimentScore != null ? `${Number(rawData.reviewSentimentScore).toFixed(1)}/10` : 'N/D'}`,
      `Taxa de resposta do proprietário: ${rawData.ownerResponseRate != null ? `${(Number(rawData.ownerResponseRate) * 100).toFixed(0)}%` : 'N/D'}`,
      `Endereço verificado: ${rawData.address ? 'sim' : 'não'}`,
      `Telefone cadastrado: ${rawData.phone ? 'sim' : 'não'}`,
      `Categorias no Google: ${JSON.stringify(rawData.categories ?? [])}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Reputação Digital & VoC (Voz do Cliente) de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a nota e volume de reviews no Google, qualidade do sentimento, taxa de resposta do proprietário e gestão proativa da reputação digital considerando as expectativas do segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre reputação e reviews"],"insights":["...2-3 insights estratégicos sobre gestão de reputação para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    alimentacao_restaurantes: 'alto',
    saude_bemestar: 'alto',
    hospitalidade_turismo: 'alto',
    servicos_profissionais: 'alto',
    varejo_ecommerce: 'medio',
    imobiliario: 'medio',
    educacao: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 13. AI/ML READINESS
// ─────────────────────────────────────────────────────────────────────────────
const aiMlReadinessSkill: SkillDefinition = {
  subdimensionId: 'ai_ml_readiness',
  subdimensionName: 'AI/ML Readiness',
  expertPersona:
    'Você é um especialista em aplicação de Inteligência Artificial e Machine Learning no marketing digital com 10+ anos de experiência, focado em implementações práticas para empresas brasileiras de todos os portes.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    const chatbotPlatforms = Array.isArray(rawData.chatbotPlatforms) ? rawData.chatbotPlatforms : [];
    const nlpSearchPlatforms = Array.isArray(rawData.nlpSearchPlatforms) ? rawData.nlpSearchPlatforms : [];
    const aiToolsDetected = Array.isArray(rawData.aiToolsDetected) ? rawData.aiToolsDetected : [];
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Chatbot/IA conversacional: ${rawData.hasChatbot ? 'sim' : 'não'}`,
      `Plataformas de chatbot: ${chatbotPlatforms.length > 0 ? chatbotPlatforms.join(', ') : 'nenhuma'}`,
      `Recomendações personalizadas: ${rawData.hasProductRecommendations ? 'sim' : 'não'}`,
      `Busca NLP/IA: ${rawData.hasNlpSearch ? 'sim' : 'não'}`,
      `Plataformas NLP: ${nlpSearchPlatforms.length > 0 ? nlpSearchPlatforms.join(', ') : 'nenhuma'}`,
      `Ferramentas IA detectadas na stack: ${aiToolsDetected.length > 0 ? aiToolsDetected.join(', ') : 'nenhuma'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise o AI/ML Readiness de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie a maturidade no uso de IA e ML no marketing e experiência digital, incluindo chatbots, personalização, busca inteligente e automação, considerando o nível de adoção esperado para o segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre o uso atual de IA/ML"],"insights":["...2-3 insights estratégicos sobre oportunidades de IA para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    saas_b2b_tecnologia: 'alto',
    financeiro_fintech: 'alto',
    varejo_ecommerce: 'alto',
    educacao: 'alto',
    saude_bemestar: 'medio',
    moda_lifestyle: 'medio',
    hospitalidade_turismo: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 14. INTELIGÊNCIA DE DEMANDA
// ─────────────────────────────────────────────────────────────────────────────
const inteligenciaDemandaSkill: SkillDefinition = {
  subdimensionId: 'inteligencia_demanda',
  subdimensionName: 'Inteligência de Demanda',
  expertPersona:
    'Você é um especialista em Inteligência de Mercado e Análise de Demanda Digital com 14+ anos de experiência no Brasil, especialista em mapeamento de intenção de busca, pesquisa de palavras-chave e análise competitiva de demanda.',
  contextBuilder: (rawData, input, score) => {
    const seg = getSegmentKey(input.segment);
    const topQuestions = Array.isArray(rawData.topQuestions) ? (rawData.topQuestions as string[]).slice(0, 5) : [];
    const competitorComparisons = Array.isArray(rawData.competitorComparisons) ? (rawData.competitorComparisons as string[]).slice(0, 3) : [];
    const questionModifiers = Array.isArray(rawData.questionModifiers) ? rawData.questionModifiers : [];
    return [
      `Empresa: ${input.companyName}`,
      `Segmento: ${SEGMENT_LABELS[seg]}`,
      `Score atual: ${score}/4`,
      `Total de termos mapeados: ${rawData.totalItems ?? 'N/D'}`,
      `Total de perguntas: ${rawData.totalQuestions ?? 'N/D'}`,
      `Total de preposições: ${rawData.totalPrepositions ?? 'N/D'}`,
      `Total de comparações: ${rawData.totalComparisons ?? 'N/D'}`,
      `Top perguntas: ${topQuestions.length > 0 ? topQuestions.join(' | ') : 'N/D'}`,
      `Comparações com concorrentes: ${competitorComparisons.length > 0 ? competitorComparisons.join(' | ') : 'N/D'}`,
      `Modificadores de intenção: ${Array.isArray(questionModifiers) ? questionModifiers.slice(0, 5).join(', ') : 'N/D'}`,
      `CPC médio estimado: ${rawData.avgCpc != null ? `R$ ${Number(rawData.avgCpc).toFixed(2)}` : 'N/D'}`,
      `Termos de alta intenção: ${rawData.highIntentCount ?? 'N/D'}`,
      `Volume de busca total mapeado: ${rawData.totalSearchVolume != null ? Number(rawData.totalSearchVolume).toLocaleString('pt-BR') : 'N/D'}`,
    ].join('\n');
  },
  systemPromptTemplate: `{{PERSONA}}

Analise a Inteligência de Demanda de {{COMPANY}} (segmento: {{SEGMENT}}, score atual: {{SCORE}}/4).

Avalie o mapeamento de demanda digital da empresa — perguntas dos consumidores, intenção de busca, comparações com concorrentes e oportunidades de conteúdo para capturar demanda latente no segmento {{SEGMENT}}.

Retorne SOMENTE JSON válido, sem markdown:
{"findings":["...até 4 findings sobre demanda mapeada e intenção de busca"],"insights":["...2-3 insights estratégicos sobre oportunidades de conteúdo e SEO baseadas na demanda para {{SEGMENT}}"],"recommendations":[{"title":"...","what":"...","why":"...","effort":"baixo|medio|alto","timeframe":"imediato|curto_prazo|medio_prazo"}]}`,
  segmentRelevance: {
    saas_b2b_tecnologia: 'alto',
    educacao: 'alto',
    saude_bemestar: 'alto',
    financeiro_fintech: 'alto',
    varejo_ecommerce: 'medio',
    imobiliario: 'medio',
    servicos_profissionais: 'medio',
    moda_lifestyle: 'medio',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY — all 14 skills
// ─────────────────────────────────────────────────────────────────────────────
export const SKILLS_REGISTRY: SkillDefinition[] = [
  trackingHealthSkill,
  stackMartechSkill,
  seoOnpageSkill,
  semanticaGeoSkill,
  presencaVideoAudioSkill,
  mixTrafegoSkill,
  midiaPagaSkill,
  presencaMarketplacesSkill,
  seoOffpageSkill,
  uxUiCroSkill,
  jornadaCheckoutSkill,
  reputacaoVocSkill,
  aiMlReadinessSkill,
  inteligenciaDemandaSkill,
];
