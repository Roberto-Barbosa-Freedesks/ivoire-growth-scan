import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/store';
import { SUBDIMENSIONS, DIMENSION_CONFIG } from '../data/scorecard';
import { fetchPageSpeedWithTech, scorePerformanceWeb, simulateCollection } from '../services/pagespeed';
import type { TechDetectionResult } from '../services/pagespeed';
import { scoreToLevel } from '../services/scoring';
import type { DimensionKey, CollectionStatus, SubdimensionScore } from '../types';

const DIMENSION_ORDER: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

interface SubdimState {
  id: string;
  status: CollectionStatus;
  preview?: string;
}

function StatusIcon({ status }: { status: CollectionStatus }) {
  if (status === 'completed') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(0, 204, 102, 0.15)',
          border: '1px solid #00cc66',
          color: '#00cc66',
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        ✓
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(255, 77, 77, 0.15)',
          border: '1px solid #ff4d4d',
          color: '#ff4d4d',
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        ✗
      </span>
    );
  }
  if (status === 'collecting') {
    return (
      <span
        className="spin"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,2,0.3)',
          borderTopColor: '#FFFF02',
          flexShrink: 0,
        }}
      />
    );
  }
  // pending or manual
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.2)',
        flexShrink: 0,
      }}
    />
  );
}

function getSourceLabel(subdimId: string): string {
  const subdim = SUBDIMENSIONS.find((s) => s.id === subdimId);
  if (!subdim) return 'API';
  const map: Record<string, string> = {
    automatizado: 'PageSpeed API',
    'semi-automatizado': 'Análise Simulada',
    manual: 'Entrada Manual',
  };
  return map[subdim.collectionType] || 'API';
}

export default function CollectionPage() {
  const { id: diagnosticId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDiagnostic, updateSubdimensionScore, updateCollectionProgress, finalizeDiagnosticById, pageSpeedApiKey } =
    useAppStore();

  const diagnostic = diagnosticId ? getDiagnostic(diagnosticId) : undefined;

  const [subdimStates, setSubdimStates] = useState<Record<string, SubdimState>>(() => {
    const initial: Record<string, SubdimState> = {};
    SUBDIMENSIONS.forEach((sd) => {
      initial[sd.id] = { id: sd.id, status: 'pending' };
    });
    return initial;
  });

  const [completedCount, setCompletedCount] = useState(0);
  const [isFinalized, setIsFinalized] = useState(false);
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
      for (const subdim of relevantSubdims) {
        // Update status to collecting
        setSubdimStates((prev) => ({
          ...prev,
          [subdim.id]: { ...prev[subdim.id], status: 'collecting' },
        }));
        updateCollectionProgress(diagnosticId!, subdim.id, 'collecting');

        try {
          let score = 2;
          let rawData: Record<string, unknown> = {};
          let source: 'auto' | 'manual' | 'insufficient' = 'auto';
          let preview = '';

          if (subdim.id === 'performance_web') {
            try {
              const { mobile, desktop, tech } = await fetchPageSpeedWithTech(siteUrl, pageSpeedApiKey || undefined);
              realTechRef.current = tech;
              score = scorePerformanceWeb(mobile, desktop);
              rawData = { mobile, desktop, tech };
              source = 'auto';
              preview = `Mobile: ${mobile.mobileScore}/100 · LCP: ${mobile.lcp.toFixed(1)}s · GTM: ${tech.gtmInstalled ? 'Sim' : 'Não'} · GA4: ${tech.ga4Installed ? 'Sim' : 'Não'}`;
            } catch {
              // Fallback to simulation if PageSpeed API fails
              const result = await simulateCollection(subdim.id, siteUrl);
              score = result.score;
              rawData = result.data;
              source = result.source;
              preview = `Score simulado: ${score}/4 (API indisponível)`;
            }
          } else {
            const result = await simulateCollection(subdim.id, siteUrl, realTechRef.current);
            score = result.score;
            rawData = result.data;
            source = result.source;

            // Build preview from data
            const dataEntries = Object.entries(result.data).slice(0, 2);
            preview = dataEntries
              .map(([k, v]) => {
                const valStr =
                  typeof v === 'boolean'
                    ? v
                      ? 'Sim'
                      : 'Não'
                    : Array.isArray(v)
                    ? v.filter(Boolean).join(', ') || 'N/A'
                    : typeof v === 'number'
                    ? String(Math.round(v as number))
                    : String(v);
                const keyLabel = k.replace(/_/g, ' ');
                return `${keyLabel}: ${valStr}`;
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
          };

          updateSubdimensionScore(diagnosticId!, subdimScore);
          updateCollectionProgress(diagnosticId!, subdim.id, 'completed');

          setSubdimStates((prev) => ({
            ...prev,
            [subdim.id]: { id: subdim.id, status: 'completed', preview },
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

      // All done — finalize
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
    <div
      style={{
        minHeight: '100vh',
        background: '#282828',
        padding: '48px 48px 80px',
        maxWidth: 860,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div className="ivoire-tag" style={{ marginBottom: 16 }}>
          Coleta em Andamento
        </div>
        <h1
          className="font-bebas"
          style={{ fontSize: 42, color: '#fff', margin: 0, letterSpacing: 2 }}
        >
          Analisando{' '}
          <span style={{ color: '#FFFF02' }}>{diagnostic.input.companyName}</span>
        </h1>
        <p style={{ color: '#999', marginTop: 8, fontSize: 14 }}>
          {diagnostic.input.siteUrl}
        </p>
      </div>

      {/* Overall progress */}
      <div
        className="ivoire-card"
        style={{ padding: '24px 28px', marginBottom: 40 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <span
            className="font-montserrat"
            style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}
          >
            Progresso Geral
          </span>
          <span
            className="font-bebas"
            style={{ fontSize: 28, color: '#FFFF02', letterSpacing: 1 }}
          >
            {progressPct}%
          </span>
        </div>
        <div className="progress-bar" style={{ height: 6 }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPct}%`, height: '100%' }}
          />
        </div>
        <p style={{ color: '#666', fontSize: 12, marginTop: 10 }}>
          {completedCount} de {totalCount} subdimensões coletadas
          {isFinalized && (
            <span style={{ color: '#00cc66', marginLeft: 12 }}>
              ✓ Análise concluída — redirecionando...
            </span>
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
            {/* Dimension header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h2
                className="font-montserrat"
                style={{ fontSize: 13, fontWeight: 700, color: dimConfig.color, letterSpacing: 2, margin: 0, textTransform: 'uppercase' }}
              >
                {dimConfig.label}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  color: '#666',
                  fontFamily: 'Montserrat, sans-serif',
                }}
              >
                {dimCompleted}/{dimSubdims.length}
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            </div>

            {/* Subdimension rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dimSubdims.map((sd) => {
                const state = subdimStates[sd.id];
                const status = state?.status || 'pending';
                const isActive = status === 'collecting';
                const isDone = status === 'completed';

                return (
                  <div
                    key={sd.id}
                    className="ivoire-card"
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      borderColor: isActive
                        ? 'rgba(255,255,2,0.35)'
                        : isDone
                        ? 'rgba(0,204,102,0.2)'
                        : 'rgba(255,255,255,0.06)',
                      transition: 'border-color 0.3s ease',
                    }}
                  >
                    <StatusIcon status={status} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          className="font-montserrat"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: isActive ? '#FFFF02' : isDone ? '#fff' : '#888',
                          }}
                        >
                          {sd.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: '#555',
                            fontFamily: 'Montserrat, sans-serif',
                            fontWeight: 500,
                            letterSpacing: 0.5,
                            textTransform: 'uppercase',
                          }}
                        >
                          {getSourceLabel(sd.id)}
                        </span>
                        {sd.isConditional && (
                          <span
                            style={{
                              fontSize: 9,
                              color: '#FFFF02',
                              border: '1px solid rgba(255,255,2,0.3)',
                              borderRadius: 2,
                              padding: '1px 5px',
                              fontFamily: 'Montserrat, sans-serif',
                              letterSpacing: 0.5,
                              textTransform: 'uppercase',
                              fontWeight: 700,
                            }}
                          >
                            E-COMM
                          </span>
                        )}
                      </div>

                      {state?.preview && isDone && (
                        <p
                          style={{
                            fontSize: 11,
                            color: '#666',
                            margin: '4px 0 0',
                            fontFamily: 'Arvo, serif',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {state.preview}
                        </p>
                      )}

                      {isActive && (
                        <p
                          className="pulse-yellow"
                          style={{
                            fontSize: 11,
                            color: '#FFFF02',
                            margin: '4px 0 0',
                            fontFamily: 'Montserrat, sans-serif',
                          }}
                        >
                          Coletando dados...
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    {status === 'completed' && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#00cc66',
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Concluído
                      </span>
                    )}
                    {status === 'error' && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#ff4d4d',
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Erro
                      </span>
                    )}
                    {status === 'pending' && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#444',
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 600,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Aguardando
                      </span>
                    )}
                    {status === 'collecting' && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#FFFF02',
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Coletando
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <p style={{ color: '#444', fontSize: 12, fontFamily: 'Montserrat, sans-serif' }}>
          Não feche esta janela durante a coleta
        </p>
      </div>
    </div>
  );
}
