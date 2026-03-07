import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/store';
import { SUBDIMENSIONS, DIMENSION_CONFIG } from '../data/scorecard';
import { fetchPageSpeedWithTech, scorePerformanceWeb } from '../services/pagespeed';
import { fetchClientLogo } from '../services/logo';
import { scrapeUrl } from '../services/htmlScraper';
import { collectSubdimension } from '../services/collection';
import type { TechDetectionResult } from '../services/pagespeed';
import type { ScrapedPageData } from '../services/htmlScraper';
import { scoreToLevel } from '../services/scoring';
import type { DimensionKey, CollectionStatus, SubdimensionScore } from '../types';

const DIMENSION_ORDER: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

interface SubdimState {
  id: string;
  status: CollectionStatus;
  preview?: string;
  reliability?: 'real' | 'manual' | 'insufficient';
}

function StatusIcon({ status }: { status: CollectionStatus }) {
  if (status === 'completed') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(0, 204, 102, 0.15)', border: '1px solid #00cc66',
        color: '#00cc66', fontSize: 13, flexShrink: 0,
      }}>✓</span>
    );
  }
  if (status === 'error') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: '50%',
        background: 'rgba(255, 77, 77, 0.15)', border: '1px solid #ff4d4d',
        color: '#ff4d4d', fontSize: 13, flexShrink: 0,
      }}>✗</span>
    );
  }
  if (status === 'collecting') {
    return (
      <span className="spin" style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: '50%',
        border: '2px solid rgba(255,255,2,0.3)', borderTopColor: '#FFFF02', flexShrink: 0,
      }} />
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0,
    }} />
  );
}

function ReliabilityBadge({ reliability }: { reliability?: SubdimState['reliability'] }) {
  if (!reliability) return null;
  if (reliability === 'real') {
    return (
      <span style={{ fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#00cc66', border: '1px solid rgba(0,204,102,0.3)', borderRadius: 2, padding: '1px 5px', letterSpacing: 0.5 }}>
        REAL
      </span>
    );
  }
  if (reliability === 'insufficient') {
    return (
      <span style={{ fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#ff9900', border: '1px solid rgba(255,153,0,0.3)', borderRadius: 2, padding: '1px 5px', letterSpacing: 0.5 }}>
        SEM DADOS
      </span>
    );
  }
  return null;
}

export default function CollectionPage() {
  const { id: diagnosticId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDiagnostic, updateSubdimensionScore, updateCollectionProgress, finalizeDiagnosticById, updateDiagnostic, settings } =
    useAppStore();

  const diagnostic = diagnosticId ? getDiagnostic(diagnosticId) : undefined;

  const [subdimStates, setSubdimStates] = useState<Record<string, SubdimState>>(() => {
    const initial: Record<string, SubdimState> = {};
    SUBDIMENSIONS.forEach((sd) => { initial[sd.id] = { id: sd.id, status: 'pending' }; });
    return initial;
  });

  const [completedCount, setCompletedCount] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
  const [logoFetched, setLogoFetched] = useState(false);
  const [htmlFetched, setHtmlFetched] = useState(false);
  const hasStarted = useRef(false);
  const techRef = useRef<TechDetectionResult | undefined>(undefined);
  const scrapedRef = useRef<ScrapedPageData | null>(null);

  const relevantSubdims = SUBDIMENSIONS.filter((sd) => {
    if (sd.isConditional && !diagnostic?.input.isEcommerce) return false;
    return true;
  });

  const totalCount = relevantSubdims.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (!diagnosticId || !diagnostic || hasStarted.current) return;
    hasStarted.current = true;

    const siteUrl = diagnostic.input.siteUrl;
    const normalizedUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

    async function runCollection() {
      // ── Step 0: Fetch client logo (non-critical) ───────────────────────
      try {
        const logoUrl = await fetchClientLogo(siteUrl);
        if (logoUrl) {
          updateDiagnostic(diagnosticId!, {
            input: { ...diagnostic!.input, clientLogoUrl: logoUrl },
          });
          setLogoFetched(true);
        }
      } catch {
        // Logo fetch is non-critical
      }

      // ── Step 1: PageSpeed + HTML scraping in PARALLEL ─────────────────
      // Both are needed by multiple subdimensions — fetch once, share.
      const [pageSpeedResult, scrapedData] = await Promise.allSettled([
        fetchPageSpeedWithTech(normalizedUrl, settings.pageSpeedApiKey || undefined),
        scrapeUrl(normalizedUrl),
      ]);

      let mobileData: ReturnType<typeof scorePerformanceWeb> extends never ? never : Parameters<typeof scorePerformanceWeb>[0] | undefined;
      let desktopData: Parameters<typeof scorePerformanceWeb>[1] | undefined;

      if (pageSpeedResult.status === 'fulfilled') {
        techRef.current = pageSpeedResult.value.tech;
        mobileData = pageSpeedResult.value.mobile;
        desktopData = pageSpeedResult.value.desktop;
      }

      if (scrapedData.status === 'fulfilled' && scrapedData.value) {
        scrapedRef.current = scrapedData.value;
        setHtmlFetched(true);
      }

      // ── Step 2: Collect each subdimension sequentially ────────────────
      for (const subdim of relevantSubdims) {
        setSubdimStates((prev) => ({ ...prev, [subdim.id]: { ...prev[subdim.id], status: 'collecting' } }));
        updateCollectionProgress(diagnosticId!, subdim.id, 'collecting');

        try {
          let score = 1;
          let rawData: Record<string, unknown> = {};
          let source: 'auto' | 'manual' | 'insufficient' = 'insufficient';
          let preview = '';
          let dataReliability: 'real' | 'manual' | 'insufficient' = 'insufficient';
          let dataSources: string[] = [];

          // ── Performance Web: use PageSpeed (already fetched) ──────────
          if (subdim.id === 'performance_web') {
            if (pageSpeedResult.status === 'fulfilled') {
              const { mobile, desktop, tech } = pageSpeedResult.value;
              const perfScore = scorePerformanceWeb(mobile, desktop);
              score = perfScore;
              rawData = { mobile, desktop, tech };
              source = 'auto';
              dataReliability = 'real';
              dataSources = ['Google PageSpeed Insights API'];
              preview = `Mobile: ${mobile.mobileScore}/100 · LCP: ${mobile.lcp.toFixed(1)}s · GTM: ${tech.gtmInstalled ? 'Sim' : 'Não'} · GA4: ${tech.ga4Installed ? 'Sim' : 'Não'}`;
            } else {
              score = 1;
              rawData = { error: 'PageSpeed API indisponível — verifique a API key e a URL do site' };
              source = 'insufficient';
              dataReliability = 'insufficient';
              dataSources = [];
              preview = 'PageSpeed indisponível';
            }
          } else {
            // ── All other subdimensions: real collection dispatcher ─────
            const context = {
              tech: techRef.current,
              mobile: mobileData ? {
                accessibilityScore: mobileData.accessibilityScore,
                bestPracticesScore: mobileData.bestPracticesScore,
                seoScore: mobileData.seoScore,
                mobileScore: mobileData.mobileScore,
                desktopScore: mobileData.desktopScore,
              } : undefined,
              desktop: desktopData ? {
                accessibilityScore: desktopData.accessibilityScore,
                bestPracticesScore: desktopData.bestPracticesScore,
                seoScore: desktopData.seoScore,
                mobileScore: desktopData.mobileScore,
                desktopScore: desktopData.desktopScore,
              } : undefined,
              scraped: scrapedRef.current,
            };

            const result = await collectSubdimension(subdim.id, diagnostic!.input, settings, context);
            score = result.score;
            rawData = result.data;
            source = result.source;
            dataReliability = result.dataReliability;
            dataSources = result.dataSources;

            // Build preview from real data
            if (result.source !== 'insufficient') {
              const previewEntries = Object.entries(result.data)
                .filter(([k]) => !['findings', 'note', 'error', 'instructions', 'status', 'reason', 'requiredConfig', 'adSamples', 'sellers'].includes(k))
                .slice(0, 3);
              preview = previewEntries
                .map(([k, v]) => {
                  const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
                  const val =
                    typeof v === 'boolean' ? (v ? 'Sim' : 'Não') :
                    Array.isArray(v) ? (v.filter(Boolean).slice(0, 2).join(', ') || 'N/A') :
                    typeof v === 'number' ? v.toLocaleString('pt-BR') :
                    v === null || v === undefined ? 'N/D' :
                    String(v).substring(0, 40);
                  return `${label}: ${val}`;
                })
                .join(' · ');
            } else {
              preview = result.error ?? 'Dados insuficientes — configure a API necessária em Configurações';
            }
          }

          const clampedScore = Math.max(1, Math.min(4, Math.round(score * 10) / 10));
          const level = scoreToLevel(clampedScore);

          const subdimScore: SubdimensionScore = {
            subdimensionId: subdim.id,
            name: subdim.name,
            dimension: subdim.dimension,
            score: clampedScore,
            level,
            source,
            rawData,
            collectionStatus: 'completed',
            isConditional: subdim.isConditional,
            dataReliability,
            dataSources,
          };

          updateSubdimensionScore(diagnosticId!, subdimScore);
          updateCollectionProgress(diagnosticId!, subdim.id, 'completed');

          setSubdimStates((prev) => ({
            ...prev,
            [subdim.id]: { id: subdim.id, status: 'completed', preview, reliability: dataReliability },
          }));
          setCompletedCount((c) => c + 1);
        } catch (err) {
          updateCollectionProgress(diagnosticId!, subdim.id, 'error');
          setSubdimStates((prev) => ({
            ...prev,
            [subdim.id]: { ...prev[subdim.id], status: 'error', preview: `Erro: ${err instanceof Error ? err.message : 'desconhecido'}` },
          }));
          setCompletedCount((c) => c + 1);
        }
      }

      finalizeDiagnosticById(diagnosticId!);
      setIsFinalized(true);
    }

    runCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosticId]);

  useEffect(() => {
    if (isFinalized && diagnosticId) {
      const timer = setTimeout(() => {
        navigate(`/diagnostic/${diagnosticId}/results`);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isFinalized, diagnosticId, navigate]);

  if (!diagnostic) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
        <p>Diagnóstico não encontrado.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#282828', padding: '48px 48px 80px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div className="ivoire-tag" style={{ marginBottom: 16 }}>Coleta em Andamento</div>
        <h1 className="font-bebas" style={{ fontSize: 42, color: '#fff', margin: 0, letterSpacing: 2 }}>
          Analisando{' '}
          <span style={{ color: '#FFFF02' }}>{diagnostic.input.companyName}</span>
        </h1>
        <p style={{ color: '#999', marginTop: 8, fontSize: 14 }}>{diagnostic.input.siteUrl}</p>
      </div>

      {/* Status badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {logoFetched && (
          <div style={{ padding: '6px 12px', background: 'rgba(0,204,102,0.06)', border: '1px solid rgba(0,204,102,0.2)', borderRadius: 4, fontSize: 11, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
            ✓ Logo extraído
          </div>
        )}
        {htmlFetched && (
          <div style={{ padding: '6px 12px', background: 'rgba(0,204,102,0.06)', border: '1px solid rgba(0,204,102,0.2)', borderRadius: 4, fontSize: 11, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
            ✓ HTML analisado (SEO + Schema + UX)
          </div>
        )}
        {techRef.current && (
          <div style={{ padding: '6px 12px', background: 'rgba(0,204,102,0.06)', border: '1px solid rgba(0,204,102,0.2)', borderRadius: 4, fontSize: 11, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
            ✓ PageSpeed coletado
          </div>
        )}
      </div>

      {/* Data sources notice */}
      <div style={{ marginBottom: 24, padding: '12px 16px', background: 'rgba(255,255,2,0.04)', border: '1px solid rgba(255,255,2,0.1)', borderRadius: 6 }}>
        <div className="font-montserrat" style={{ fontSize: 9, color: '#FFFF02', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Fontes de Dados Reais
        </div>
        <div style={{ fontSize: 11, color: '#888', fontFamily: 'Arvo, serif', lineHeight: 1.7 }}>
          <strong style={{ color: '#ccc' }}>Sempre reais:</strong> PageSpeed API · HTML scraping (SEO, Schema, UX) · Mercado Livre API<br />
          <strong style={{ color: '#ccc' }}>Real se configurado:</strong> YouTube API · TikTok (Apify) · Google Places API · Meta Ad Library · Facebook/Instagram (Apify)<br />
          <strong style={{ color: '#ccc' }}>Apify ativo:</strong> SimilarWeb (Mix de Tráfego) · SEMrush (SEO Off-Page) · Google Maps 50 avaliações (Reputação)<br />
          <span style={{ color: '#FFFF02', cursor: 'pointer' }} onClick={() => navigate('/settings')}>→ Configurar Integrações</span>
        </div>
      </div>

      {/* Overall progress */}
      <div className="ivoire-card" style={{ padding: '24px 28px', marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="font-montserrat" style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}>
            Progresso Geral
          </span>
          <span className="font-bebas" style={{ fontSize: 28, color: '#FFFF02', letterSpacing: 1 }}>
            {progressPct}%
          </span>
        </div>
        <div className="progress-bar" style={{ height: 6 }}>
          <div className="progress-bar-fill" style={{ width: `${progressPct}%`, height: '100%' }} />
        </div>
        <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
          {completedCount} de {totalCount} subdimensões coletadas
          {isFinalized && (
            <span style={{ color: '#00cc66', marginLeft: 12 }}>✓ Análise concluída — redirecionando…</span>
          )}
        </p>
      </div>

      {/* Dimensions */}
      {DIMENSION_ORDER.map((dimKey) => {
        const dimSubdims = relevantSubdims.filter((sd) => sd.dimension === dimKey);
        if (dimSubdims.length === 0) return null;
        const dimConfig = DIMENSION_CONFIG[dimKey];
        const dimCompleted = dimSubdims.filter((sd) => subdimStates[sd.id]?.status === 'completed').length;

        return (
          <div key={dimKey} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <h2 className="font-montserrat" style={{ fontSize: 13, fontWeight: 700, color: dimConfig.color, letterSpacing: 2, margin: 0, textTransform: 'uppercase' }}>
                {dimConfig.label}
              </h2>
              <span style={{ fontSize: 11, color: '#666', fontFamily: 'Montserrat, sans-serif' }}>{dimCompleted}/{dimSubdims.length}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dimSubdims.map((sd) => {
                const state = subdimStates[sd.id];
                const status = state?.status || 'pending';
                const isActive = status === 'collecting';
                const isDone = status === 'completed';
                const isInsufficient = state?.reliability === 'insufficient';

                return (
                  <div
                    key={sd.id}
                    className="ivoire-card"
                    style={{
                      padding: '14px 18px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      borderColor: isActive
                        ? 'rgba(255,255,2,0.35)'
                        : isDone && !isInsufficient ? 'rgba(0,204,102,0.2)'
                        : isDone && isInsufficient ? 'rgba(255,153,0,0.15)'
                        : 'rgba(255,255,255,0.06)',
                      transition: 'border-color 0.3s ease',
                    }}
                  >
                    <StatusIcon status={status} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="font-montserrat" style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#FFFF02' : isDone ? '#fff' : '#888' }}>
                          {sd.name}
                        </span>
                        {isDone && <ReliabilityBadge reliability={state?.reliability} />}
                        {sd.isConditional && (
                          <span style={{ fontSize: 9, color: '#FFFF02', border: '1px solid rgba(255,255,2,0.3)', borderRadius: 2, padding: '1px 5px', fontFamily: 'Montserrat, sans-serif', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
                            E-COMM
                          </span>
                        )}
                      </div>

                      {state?.preview && isDone && (
                        <p style={{
                          fontSize: 11,
                          color: isInsufficient ? '#ff9900' : '#777',
                          margin: '4px 0 0',
                          fontFamily: 'Arvo, serif',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {state.preview}
                        </p>
                      )}
                      {isActive && (
                        <p className="pulse-yellow" style={{ fontSize: 11, color: '#FFFF02', margin: '4px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
                          Coletando dados…
                        </p>
                      )}
                    </div>

                    {status === 'completed' && !isInsufficient && <span style={{ fontSize: 10, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Concluído</span>}
                    {status === 'completed' && isInsufficient && <span style={{ fontSize: 10, color: '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Config. necessária</span>}
                    {status === 'error' && <span style={{ fontSize: 10, color: '#ff4d4d', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Erro</span>}
                    {status === 'pending' && <span style={{ fontSize: 10, color: '#555', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Aguardando</span>}
                    {status === 'collecting' && <span style={{ fontSize: 10, color: '#FFFF02', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Coletando</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <p style={{ color: '#444', fontSize: 12, fontFamily: 'Montserrat, sans-serif' }}>
          Não feche esta janela durante a coleta
        </p>
      </div>
    </div>
  );
}
