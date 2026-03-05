import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/store';
import { SUBDIMENSIONS, DIMENSION_CONFIG } from '../data/scorecard';
import { fetchPageSpeedWithTech, scorePerformanceWeb, simulateCollection } from '../services/pagespeed';
import { fetchClientLogo } from '../services/logo';
import type { TechDetectionResult } from '../services/pagespeed';
import { scoreToLevel } from '../services/scoring';
import type { DimensionKey, CollectionStatus, SubdimensionScore } from '../types';

const DIMENSION_ORDER: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

interface SubdimState {
  id: string;
  status: CollectionStatus;
  preview?: string;
  reliability?: 'real' | 'estimated';
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

function getSourceLabel(subdimId: string): string {
  const subdim = SUBDIMENSIONS.find((s) => s.id === subdimId);
  if (!subdim) return 'API';
  const map: Record<string, string> = {
    automatizado: 'PageSpeed API',
    'semi-automatizado': 'Coleta Automatizada',
    manual: 'Entrada Manual',
  };
  return map[subdim.collectionType] || 'API';
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
  const hasStarted = useRef(false);
  const realTechRef = useRef<TechDetectionResult | undefined>(undefined);

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

    async function runCollection() {
      // Step 0: Fetch client logo
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

      for (const subdim of relevantSubdims) {
        setSubdimStates((prev) => ({ ...prev, [subdim.id]: { ...prev[subdim.id], status: 'collecting' } }));
        updateCollectionProgress(diagnosticId!, subdim.id, 'collecting');

        try {
          let score = 2;
          let rawData: Record<string, unknown> = {};
          let source: 'auto' | 'manual' | 'insufficient' = 'auto';
          let preview = '';
          let dataReliability: 'real' | 'estimated' = 'estimated';
          let dataSources: string[] = [];

          if (subdim.id === 'performance_web') {
            try {
              const { mobile, desktop, tech } = await fetchPageSpeedWithTech(siteUrl, settings.pageSpeedApiKey || undefined);
              realTechRef.current = tech;
              score = scorePerformanceWeb(mobile, desktop);
              rawData = { mobile, desktop, tech };
              source = 'auto';
              dataReliability = 'real';
              dataSources = ['Google PageSpeed Insights API'];
              preview = `Mobile: ${mobile.mobileScore}/100 · LCP: ${mobile.lcp.toFixed(1)}s · GTM: ${tech.gtmInstalled ? 'Sim' : 'Não'} · GA4: ${tech.ga4Installed ? 'Sim' : 'Não'}`;
            } catch {
              const result = await simulateCollection(subdim.id, siteUrl);
              score = result.score;
              rawData = { ...result.data, dataSource: 'PageSpeed API indisponível — dados estimados' };
              source = result.source;
              dataReliability = 'estimated';
              dataSources = ['Estimado (API indisponível)'];
              preview = `Score estimado: ${score}/4`;
            }
          } else {
            const result = await simulateCollection(subdim.id, siteUrl, realTechRef.current, {
              youtubeUrl: diagnostic!.input.youtube || undefined,
              youtubeApiKey: settings.youtubeApiKey || undefined,
            });
            score = result.score;
            rawData = result.data;
            source = result.source;
            dataReliability = result.dataReliability;
            dataSources = result.dataSources;

            // Build preview
            const previewEntries = Object.entries(result.data)
              .filter(([k]) => !['dataSource', 'note'].includes(k))
              .slice(0, 2);
            preview = previewEntries
              .map(([k, v]) => {
                const valStr =
                  typeof v === 'boolean' ? (v ? 'Sim' : 'Não') :
                  Array.isArray(v) ? v.filter(Boolean).join(', ') || 'N/A' :
                  typeof v === 'number' ? String(Math.round(v as number)) :
                  v === null ? 'N/D' :
                  String(v);
                return `${k.replace(/_/g, ' ')}: ${valStr}`;
              })
              .join(' · ');
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
        } catch {
          updateCollectionProgress(diagnosticId!, subdim.id, 'error');
          setSubdimStates((prev) => ({
            ...prev,
            [subdim.id]: { ...prev[subdim.id], status: 'error', preview: 'Falha na coleta' },
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

      {/* Logo fetch status */}
      {logoFetched && (
        <div style={{ marginBottom: 16, padding: '8px 14px', background: 'rgba(0,204,102,0.06)', border: '1px solid rgba(0,204,102,0.15)', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#00cc66', fontSize: 13 }}>✓</span>
          <span style={{ fontSize: 11, color: '#888', fontFamily: 'Arvo, serif' }}>Logo oficial extraído via Clearbit</span>
        </div>
      )}

      {/* Data reliability notice */}
      <div style={{ marginBottom: 24, padding: '12px 16px', background: 'rgba(255,255,2,0.04)', border: '1px solid rgba(255,255,2,0.1)', borderRadius: 6 }}>
        <div className="font-montserrat" style={{ fontSize: 9, color: '#FFFF02', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Fontes de Dados
        </div>
        <p style={{ fontSize: 11, color: '#888', fontFamily: 'Arvo, serif', margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: '#ccc' }}>Performance & Tracking:</strong> Dados reais via Google PageSpeed Insights API
          {settings.youtubeApiKey && <span> · <strong style={{ color: '#ccc' }}>YouTube:</strong> Dados reais via YouTube Data API v3</span>}
          <br />
          <strong style={{ color: '#ccc' }}>Demais subdimensões:</strong> Estimativas baseadas em algoritmos determinísticos.{' '}
          Configure <strong style={{ color: '#FFFF02' }}>SimilarWeb, Semrush e outras APIs</strong> nas configurações para dados reais.
        </p>
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
                const isReal = state?.reliability === 'real';

                return (
                  <div
                    key={sd.id}
                    className="ivoire-card"
                    style={{
                      padding: '14px 18px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      borderColor: isActive
                        ? 'rgba(255,255,2,0.35)'
                        : isDone ? 'rgba(0,204,102,0.2)' : 'rgba(255,255,255,0.06)',
                      transition: 'border-color 0.3s ease',
                    }}
                  >
                    <StatusIcon status={status} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span className="font-montserrat" style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#FFFF02' : isDone ? '#fff' : '#888' }}>
                          {sd.name}
                        </span>
                        <span style={{ fontSize: 10, color: '#555', fontFamily: 'Montserrat, sans-serif', fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                          {getSourceLabel(sd.id)}
                        </span>
                        {isDone && isReal && (
                          <span style={{ fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#00cc66', border: '1px solid rgba(0,204,102,0.3)', borderRadius: 2, padding: '1px 5px', letterSpacing: 0.5 }}>
                            REAL
                          </span>
                        )}
                        {isDone && !isReal && (
                          <span style={{ fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#777', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, padding: '1px 5px', letterSpacing: 0.5 }}>
                            ESTIMADO
                          </span>
                        )}
                        {sd.isConditional && (
                          <span style={{ fontSize: 9, color: '#FFFF02', border: '1px solid rgba(255,255,2,0.3)', borderRadius: 2, padding: '1px 5px', fontFamily: 'Montserrat, sans-serif', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>
                            E-COMM
                          </span>
                        )}
                      </div>

                      {state?.preview && isDone && (
                        <p style={{ fontSize: 11, color: '#777', margin: '4px 0 0', fontFamily: 'Arvo, serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {state.preview}
                        </p>
                      )}
                      {isActive && (
                        <p className="pulse-yellow" style={{ fontSize: 11, color: '#FFFF02', margin: '4px 0 0', fontFamily: 'Montserrat, sans-serif' }}>
                          Coletando dados…
                        </p>
                      )}
                    </div>

                    {status === 'completed' && <span style={{ fontSize: 10, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Concluído</span>}
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
