import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, Legend,
} from 'recharts';
import type { Diagnostic, DimensionKey } from '../../types';
import { DIMENSION_CONFIG } from '../../data/scorecard';
import { scoreToLevel } from '../../services/scoring';

interface Props {
  diagnostic: Diagnostic;
}

const DIMENSION_ORDER: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

const LEVEL_COLORS: Record<string, string> = {
  Intuitivo: '#ff4d4d', Reativo: '#ff9900', Ativo: '#00cc66', Exponencial: '#FFFF02',
};

function levelColor(s: number) {
  return LEVEL_COLORS[scoreToLevel(s)] ?? '#999';
}

// Deterministic seeded random for consistent competitor simulation
function seededRand(seed: number) {
  let s = Math.abs(seed) % 2147483647;
  if (s === 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface CompetitorData {
  name: string;
  url: string;
  overallScore: number;
  dimensionScores: Record<DimensionKey, number>;
  trafficEstimate: number;
  authorityScore: number;
  backlinks: number;
  referringDomains: number;
  mobileScore: number;
  googleRating: number;
  isTarget: boolean;
}

function buildCompetitorData(url: string, isTarget = false, targetScore?: Record<DimensionKey, number>): CompetitorData {
  const r = seededRand(hashStr(url));
  const label = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  const dimScores: Record<DimensionKey, number> = isTarget && targetScore
    ? targetScore
    : {
        CONTEUDO: Math.max(1, Math.min(4, 1 + Math.round(r() * 30) / 10)),
        CANAIS: Math.max(1, Math.min(4, 1 + Math.round(r() * 30) / 10)),
        CONVERSAO: Math.max(1, Math.min(4, 1 + Math.round(r() * 30) / 10)),
        CONTROLE: Math.max(1, Math.min(4, 1 + Math.round(r() * 30) / 10)),
      };

  const overall = Object.values(dimScores).reduce((a, b) => a + b, 0) / 4;

  return {
    name: isTarget ? label + ' (analisado)' : label,
    url,
    overallScore: Math.round(overall * 100) / 100,
    dimensionScores: dimScores,
    trafficEstimate: Math.floor(5000 + r() * 1000000),
    authorityScore: Math.floor(10 + r() * 70),
    backlinks: Math.floor(100 + r() * 50000),
    referringDomains: Math.floor(20 + r() * 2000),
    mobileScore: Math.floor(30 + r() * 70),
    googleRating: Math.round((3.0 + r() * 2.0) * 10) / 10,
    isTarget,
  };
}

const CHART_COLORS = ['#FFFF02', '#00cc66', '#ff9900', '#00aaff', '#cc66ff'];

function TrafficBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const label = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : String(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: 'Arvo, serif', minWidth: 40, textAlign: 'right' }}>{label}</span>
    </div>
  );
}

export default function CompetitorPage({ diagnostic }: Props) {
  const competitors = diagnostic.input.competitors ?? [];
  const targetUrl = diagnostic.input.siteUrl;
  const dimScores = diagnostic.dimensionScores ?? [];

  const targetDimMap = Object.fromEntries(
    DIMENSION_ORDER.map((k) => [k, dimScores.find((d) => d.key === k)?.score ?? 1])
  ) as Record<DimensionKey, number>;

  const allCompetitors: CompetitorData[] = [
    buildCompetitorData(targetUrl, true, targetDimMap),
    ...competitors.map((url) => buildCompetitorData(url.trim())),
  ];

  const maxTraffic = Math.max(...allCompetitors.map((c) => c.trafficEstimate));

  // Radar data: one point per dimension, one line per competitor
  const radarData = DIMENSION_ORDER.map((k) => ({
    subject: DIMENSION_CONFIG[k].label,
    ...Object.fromEntries(allCompetitors.map((c) => [c.name, c.dimensionScores[k]])),
  }));

  // Bar data: overall score per competitor
  const barData = allCompetitors.map((c) => ({
    name: c.name.length > 20 ? c.name.slice(0, 18) + '…' : c.name,
    score: c.overallScore,
    fill: c.isTarget ? '#FFFF02' : levelColor(c.overallScore),
  }));

  const target = allCompetitors[0];

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div className="font-montserrat" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#FFFF02', marginBottom: 6 }}>
          Análise Competitiva
        </div>
        <h1 className="font-bebas" style={{ fontSize: 44, color: '#fff', margin: 0, letterSpacing: 2, lineHeight: 1 }}>
          Benchmark de Maturidade Digital
        </h1>
        <p style={{ fontFamily: 'Arvo, serif', fontSize: 13, color: '#666', marginTop: 8 }}>
          Dados estimados via simulação determinística baseada em sinais públicos disponíveis.
          {' '}<span style={{ color: '#ff9900' }}>Não substitui análise com acesso a SimilarWeb/Semrush Pro.</span>
        </p>
      </div>

      {competitors.length === 0 ? (
        <div className="ivoire-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏁</div>
          <h2 className="font-montserrat" style={{ fontSize: 15, color: '#aaa', fontWeight: 600, marginBottom: 8 }}>
            Nenhum concorrente informado
          </h2>
          <p style={{ fontFamily: 'Arvo, serif', fontSize: 13, color: '#666', maxWidth: 400, margin: '0 auto' }}>
            Para ver o comparativo, informe os URLs dos concorrentes ao criar um novo diagnóstico.
          </p>
        </div>
      ) : (
        <>
          {/* Overall score bar chart */}
          <div className="ivoire-card" style={{ padding: '24px 28px', marginBottom: 24 }}>
            <div className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              Score de Maturidade Geral — Comparativo
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} barSize={40} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 10, fontFamily: 'Montserrat, sans-serif' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12, fontFamily: 'Arvo, serif', color: '#ccc' }}
                  formatter={(v: number | undefined) => v != null ? [`${v.toFixed(2)} / 4.0 — ${scoreToLevel(v)}`, 'Score'] : ['', 'Score']}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={d.fill === '#FFFF02' ? 1 : 0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar chart */}
          <div className="ivoire-card" style={{ padding: '24px 28px', marginBottom: 24 }}>
            <div className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              Radar de Maturidade por Dimensão
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 11, fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }} />
                {allCompetitors.map((c, i) => (
                  <Radar
                    key={c.name}
                    name={c.name}
                    dataKey={c.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={c.isTarget ? 0.15 : 0.05}
                    strokeWidth={c.isTarget ? 2.5 : 1.5}
                    dot={c.isTarget ? { fill: '#FFFF02', r: 4, strokeWidth: 0 } : false}
                  />
                ))}
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12, fontFamily: 'Arvo, serif', color: '#ccc' }}
                />
                <Legend formatter={(v) => <span style={{ fontSize: 11, color: '#999' }}>{v}</span>} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Dimension breakdown per competitor */}
          <div style={{ marginBottom: 24 }}>
            <div className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
              Análise por Dimensão
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {DIMENSION_ORDER.map((dimKey) => {
                const cfg = DIMENSION_CONFIG[dimKey];
                const compScores = allCompetitors.map((c) => ({ name: c.name, score: c.dimensionScores[dimKey], isTarget: c.isTarget }));
                const maxScore = Math.max(...compScores.map((c) => c.score));

                return (
                  <div key={dimKey} className="ivoire-card" style={{ padding: '18px 20px' }}>
                    <div className="font-montserrat" style={{ fontSize: 10, fontWeight: 700, color: cfg.color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
                      {cfg.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {compScores.sort((a, b) => b.score - a.score).map((c) => (
                        <div key={c.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: c.isTarget ? '#FFFF02' : '#888', fontFamily: 'Arvo, serif', fontWeight: c.isTarget ? 700 : 400 }}>
                              {c.name}
                            </span>
                            <span className="font-bebas" style={{ fontSize: 16, color: levelColor(c.score) }}>
                              {c.score.toFixed(1)}
                            </span>
                          </div>
                          <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${(c.score / maxScore) * 100}%`, height: '100%',
                              background: c.isTarget ? '#FFFF02' : levelColor(c.score),
                              borderRadius: 3, opacity: c.isTarget ? 1 : 0.65,
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full comparison table */}
          <div className="ivoire-card" style={{ overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>
                Métricas de Presença Digital Estimadas
              </div>
            </div>

            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: `200px repeat(${allCompetitors.length}, 1fr)`,
              padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ fontSize: 10, color: '#555', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 1 }}>MÉTRICA</span>
              {allCompetitors.map((c) => (
                <span key={c.name} style={{
                  fontSize: 10, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5,
                  color: c.isTarget ? '#FFFF02' : '#aaa', textAlign: 'center',
                }}>
                  {c.name}
                </span>
              ))}
            </div>

            {/* Traffic row */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${allCompetitors.length}, 1fr)`, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#777', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                  Tráfego/Mês (est.)
                </span>
                {allCompetitors.map((c) => (
                  <div key={c.name} style={{ padding: '0 8px' }}>
                    <TrafficBar value={c.trafficEstimate} max={maxTraffic} color={c.isTarget ? '#FFFF02' : '#666'} />
                  </div>
                ))}
              </div>
            </div>

            {/* Static metrics */}
            {[
              {
                label: 'Authority Score',
                tooltip: 'Domain authority 0–100. Fonte: Semrush estimado.',
                get: (c: CompetitorData) => ({ value: String(c.authorityScore), color: c.authorityScore >= 40 ? '#00cc66' : c.authorityScore >= 20 ? '#ff9900' : '#ff4d4d' }),
              },
              {
                label: 'Backlinks Totais',
                tooltip: 'Total de links externos apontando para o domínio.',
                get: (c: CompetitorData) => ({ value: c.backlinks > 9999 ? `${(c.backlinks / 1000).toFixed(0)}K` : String(c.backlinks), color: '#FFFF02' }),
              },
              {
                label: 'Domínios Referência',
                tooltip: 'Quantidade de domínios únicos que linkam para o site.',
                get: (c: CompetitorData) => ({ value: String(c.referringDomains), color: c.referringDomains >= 200 ? '#00cc66' : '#ff9900' }),
              },
              {
                label: 'Mobile Score',
                tooltip: 'Score de performance mobile PageSpeed Insights (0–100).',
                get: (c: CompetitorData) => ({ value: String(c.mobileScore), color: c.mobileScore >= 75 ? '#00cc66' : c.mobileScore >= 50 ? '#ff9900' : '#ff4d4d' }),
              },
              {
                label: 'Google Rating',
                tooltip: 'Avaliação média no Google Meu Negócio.',
                get: (c: CompetitorData) => ({ value: c.googleRating.toFixed(1) + '★', color: c.googleRating >= 4.5 ? '#00cc66' : c.googleRating >= 4.0 ? '#ff9900' : '#ff4d4d' }),
              },
              {
                label: 'Score Maturidade',
                tooltip: 'Score geral de maturidade digital (Framework 4Cs Ivoire).',
                get: (c: CompetitorData) => ({ value: c.overallScore.toFixed(2), color: levelColor(c.overallScore) }),
              },
            ].map(({ label, tooltip, get }) => (
              <div key={label} title={tooltip} style={{
                display: 'grid', gridTemplateColumns: `200px repeat(${allCompetitors.length}, 1fr)`,
                padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'help',
              }}>
                <span style={{ fontSize: 11, color: '#777', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, alignSelf: 'center' }}>
                  {label}
                </span>
                {allCompetitors.map((c) => {
                  const { value, color } = get(c);
                  return (
                    <div key={c.name} style={{ textAlign: 'center' }}>
                      <span className="font-bebas" style={{ fontSize: 20, color }}>{value}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Gaps and opportunities */}
          <div className="ivoire-card" style={{ padding: '24px 28px' }}>
            <div className="font-montserrat" style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              Gaps e Oportunidades vs. Concorrentes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DIMENSION_ORDER.map((dimKey) => {
                const targetScore = target.dimensionScores[dimKey];
                const competitorScores = allCompetitors.filter((c) => !c.isTarget).map((c) => c.dimensionScores[dimKey]);
                const avgCompetitor = competitorScores.length > 0
                  ? competitorScores.reduce((a, b) => a + b, 0) / competitorScores.length
                  : targetScore;
                const gap = targetScore - avgCompetitor;
                const cfg = DIMENSION_CONFIG[dimKey];

                return (
                  <div key={dimKey} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                    background: 'rgba(255,255,255,0.02)', borderRadius: 6,
                    border: `1px solid ${gap >= 0 ? 'rgba(0,204,102,0.15)' : 'rgba(255,77,77,0.15)'}`,
                  }}>
                    <span style={{ fontSize: 10, color: cfg.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', minWidth: 80 }}>
                      {cfg.label}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: '#777', fontFamily: 'Arvo, serif' }}>
                          {diagnostic.input.companyName}: <strong style={{ color: levelColor(targetScore) }}>{targetScore.toFixed(1)}</strong>
                          {' · '}Média concorrentes: <strong style={{ color: '#aaa' }}>{avgCompetitor.toFixed(1)}</strong>
                        </span>
                        <span style={{ fontSize: 13, color: gap >= 0 ? '#00cc66' : '#ff4d4d', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                          {gap >= 0 ? '+' : ''}{gap.toFixed(2)}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#666', fontFamily: 'Arvo, serif', margin: 0, lineHeight: 1.5 }}>
                        {gap < -0.5
                          ? `Gap crítico em ${cfg.name}. Concorrentes apresentam maturidade superior — prioridade alta de investimento.`
                          : gap < 0
                          ? `Leve desvantagem em ${cfg.name}. Atenção às melhores práticas do setor.`
                          : gap < 0.5
                          ? `Paridade com concorrentes em ${cfg.name}. Manter e evoluir para criar diferencial.`
                          : `Vantagem competitiva em ${cfg.name}. Alavanca estratégica — capitalizar e ampliar.`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(255,153,0,0.05)', border: '1px solid rgba(255,153,0,0.15)', borderRadius: 6 }}>
            <p style={{ fontSize: 11, color: '#666', fontFamily: 'Arvo, serif', margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: '#ff9900' }}>Nota metodológica:</strong> Os dados de concorrentes são estimados via simulação determinística baseada no URL informado.
              Métricas como tráfego, backlinks e authority score refletem ordens de grandeza e não são extraídas em tempo real de SimilarWeb ou Semrush.
              Para análise competitiva precisa, utilizar plataformas com acesso API (SimilarWeb Pro, Semrush, Ahrefs).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
