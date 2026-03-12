import { useMemo, useState } from 'react';
import { generateDemoContacts } from '../../services/apollo';
import { DIMENSION_CONFIG, LEVEL_CONFIG } from '../../data/scorecard';
import { scoreToLevel } from '../../services/scoring';
import type { Diagnostic, DimensionKey } from '../../types';
import type { ApolloContact } from '../../services/apollo';

interface Props {
  diagnostic: Diagnostic;
}

const DIMENSION_ORDER: DimensionKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

const LEVEL_COLORS: Record<string, string> = {
  Intuitivo: '#ff4d4d', Reativo: '#ff9900', Ativo: '#00cc66', Exponencial: '#FFFF02',
};

function ContactCard({ contact, index }: { contact: ApolloContact; index: number }) {
  const [imgError, setImgError] = useState(false);
  const initial = (contact.firstName?.[0] || contact.name?.[0] || '?').toUpperCase();

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px', padding: '20px 22px',
      transition: 'border-color 0.2s ease',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,2,0.3)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Avatar */}
        <div style={{ flexShrink: 0 }}>
          {contact.photoUrl && !imgError ? (
            <img
              src={contact.photoUrl} alt={contact.name}
              onError={() => setImgError(true)}
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }}
            />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,2,0.12)', border: '2px solid rgba(255,255,2,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Bebas Neue, cursive', fontSize: '20px', color: '#FFFF02',
            }}>
              {initial}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div className="font-montserrat" style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', marginBottom: '2px' }}>
                {contact.name}
              </div>
              <div style={{ fontSize: '12px', color: '#FFFF02', fontFamily: 'Arvo, serif', fontWeight: 700 }}>
                {contact.title}
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px', padding: '2px 8px',
              fontSize: '9px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#e6e1e1', letterSpacing: '0.8px',
              flexShrink: 0,
            }}>
              #{index + 1}
            </div>
          </div>

          {/* Contact details */}
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {contact.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <a href={`mailto:${contact.email}`} style={{ fontSize: '12px', color: '#00cc66', fontFamily: 'Arvo, serif', textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}>
                  {contact.email}
                </a>
              </div>
            )}
            {contact.linkedinUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#0077b5" stroke="none">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
                  <circle cx="4" cy="4" r="2" fill="#0077b5"/>
                </svg>
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: '#4fa3d6', fontFamily: 'Arvo, serif', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', display: 'block' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}>
                  {contact.linkedinUrl.replace('https://www.linkedin.com/in/', 'linkedin.com/in/')}
                </a>
              </div>
            )}
            {(contact.city || contact.country) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span style={{ fontSize: '11px', color: '#c9c9c9', fontFamily: 'Arvo, serif' }}>
                  {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Seniority badge */}
          {contact.seniority && (
            <div style={{ marginTop: '8px' }}>
              <span style={{
                fontSize: '9px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.8px',
                textTransform: 'uppercase', padding: '2px 7px', borderRadius: '3px',
                background: 'rgba(255,255,2,0.08)', border: '1px solid rgba(255,255,2,0.2)', color: '#FFFF02',
              }}>
                {contact.seniority.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SummaryPage({ diagnostic }: Props) {
  const contacts = useMemo(
    () => generateDemoContacts(diagnostic.input.companyName),
    [diagnostic.input.companyName]
  );
  const apolloLoading = false;
  const isDemo = true;

  const overallScore = diagnostic.overallScore ?? 0;
  const overallLevel = diagnostic.overallLevel ?? 'Intuitivo';
  const levelCfg = LEVEL_CONFIG[overallLevel];
  const dimensionScores = diagnostic.dimensionScores ?? [];

  // Gaps and strengths
  const subdims = diagnostic.subdimensionScores.filter((s) => s.source !== 'skipped');
  const gaps = subdims.filter((s) => s.score <= 1.74).sort((a, b) => a.score - b.score);
  const strengths = subdims.filter((s) => s.score >= 2.5).sort((a, b) => b.score - a.score);
  const topRecommendations = (diagnostic.recommendations || []).slice(0, 3);

  function scoreColor(score: number) {
    const level = scoreToLevel(score);
    return LEVEL_COLORS[level] ?? '#FFFF02';
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div className="ivoire-tag" style={{ marginBottom: 12 }}>Resumo Executivo & Abordagem Comercial</div>
        <h1 className="font-bebas" style={{ fontSize: 42, color: '#fff', margin: '0 0 4px', letterSpacing: 2 }}>
          {diagnostic.input.companyName}
        </h1>
        <p style={{ fontSize: 13, color: '#c9c9c9', fontFamily: 'Arvo, serif', margin: 0 }}>
          {diagnostic.input.segment} · {diagnostic.input.siteUrl}
          {diagnostic.input.geography === 'regional' && diagnostic.input.geographyDetail
            ? ` · ${diagnostic.input.geographyDetail}` : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Overall score summary */}
        <div className="ivoire-card" style={{ padding: '24px 26px' }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#e6e1e1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Score Global de Maturidade
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div>
              <span className="font-bebas" style={{ fontSize: 72, color: scoreColor(overallScore), lineHeight: 1 }}>{overallScore.toFixed(1)}</span>
              <span className="font-bebas" style={{ fontSize: 28, color: '#444' }}>/4.0</span>
            </div>
            <div>
              <div style={{
                fontSize: 13, fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
                color: levelCfg.color, marginBottom: 4,
              }}>{overallLevel}</div>
              <p style={{ fontSize: 12, color: '#c9c9c9', fontFamily: 'Arvo, serif', lineHeight: 1.5, margin: 0, maxWidth: 180 }}>
                {levelCfg.shortDesc}
              </p>
            </div>
          </div>

          {/* Dimension grid */}
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {DIMENSION_ORDER.map((dimKey) => {
              const dimScore = dimensionScores.find((d) => d.key === dimKey);
              const sc = dimScore?.score ?? 1;
              return (
                <div key={dimKey} style={{ textAlign: 'center', padding: '8px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="font-bebas" style={{ fontSize: 22, color: scoreColor(sc), lineHeight: 1 }}>{sc.toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: '#e6e1e1', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 0.5, marginTop: 3 }}>
                    {DIMENSION_CONFIG[dimKey].label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Executive narrative */}
        <div className="ivoire-card" style={{ padding: '24px 26px' }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#e6e1e1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Diagnóstico Executivo
          </div>
          {diagnostic.executiveNarrative && (
            <p style={{ fontSize: 13, color: '#ccc', fontFamily: 'Arvo, serif', lineHeight: 1.8, margin: '0 0 16px', borderLeft: '2px solid rgba(255,255,2,0.3)', paddingLeft: 14 }}>
              {diagnostic.executiveNarrative}
            </p>
          )}

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
            {[
              { label: 'Gaps Críticos', value: gaps.length, color: '#ff4d4d' },
              { label: 'Forças', value: strengths.length, color: '#00cc66' },
              { label: 'Recomendações', value: (diagnostic.recommendations || []).length, color: '#FFFF02' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '10px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="font-bebas" style={{ fontSize: 28, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: '#e6e1e1', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gaps & Strengths */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        {/* Gaps críticos */}
        <div className="ivoire-card" style={{ padding: '20px 22px' }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#ff4d4d', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
            Gaps Críticos — Oportunidades de Melhoria
          </div>
          {gaps.length === 0 ? (
            <p style={{ fontSize: 12, color: '#e6e1e1', fontFamily: 'Arvo, serif' }}>Sem gaps críticos identificados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gaps.slice(0, 5).map((s) => (
                <div key={s.subdimensionId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'rgba(255,77,77,0.04)', borderRadius: 4, border: '1px solid rgba(255,77,77,0.12)' }}>
                  <span className="font-bebas" style={{ fontSize: 18, color: scoreColor(s.score), minWidth: 26 }}>{s.score.toFixed(1)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#ccc', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#e6e1e1', fontFamily: 'Arvo, serif' }}>{DIMENSION_CONFIG[s.dimension].name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Forças */}
        <div className="ivoire-card" style={{ padding: '20px 22px' }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#00cc66', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
            Forças — Diferenciais Competitivos
          </div>
          {strengths.length === 0 ? (
            <p style={{ fontSize: 12, color: '#e6e1e1', fontFamily: 'Arvo, serif' }}>Nenhuma força identificada no nível atual.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {strengths.slice(0, 5).map((s) => (
                <div key={s.subdimensionId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'rgba(0,204,102,0.04)', borderRadius: 4, border: '1px solid rgba(0,204,102,0.12)' }}>
                  <span className="font-bebas" style={{ fontSize: 18, color: scoreColor(s.score), minWidth: 26 }}>{s.score.toFixed(1)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#ccc', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#e6e1e1', fontFamily: 'Arvo, serif' }}>{DIMENSION_CONFIG[s.dimension].name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top 3 Recommendations */}
      {topRecommendations.length > 0 && (
        <div className="ivoire-card" style={{ padding: '20px 22px', marginBottom: 32 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#FFFF02', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Top 3 Recomendações Prioritárias para Abordagem Comercial
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {topRecommendations.map((rec, i) => (
              <div key={rec.id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(255,255,2,0.12)', border: '1px solid rgba(255,255,2,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontFamily: 'Bebas Neue, cursive', color: '#FFFF02', flexShrink: 0,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 10, color: '#FFFF02', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5 }}>
                    {DIMENSION_CONFIG[rec.dimension].label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#fff', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, lineHeight: 1.4 }}>{rec.title}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: '#c9c9c9', fontFamily: 'Arvo, serif', lineHeight: 1.5 }}>{rec.what.slice(0, 100)}{rec.what.length > 100 ? '…' : ''}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                    background: rec.effort === 'baixo' ? 'rgba(0,204,102,0.1)' : rec.effort === 'alto' ? 'rgba(255,77,77,0.1)' : 'rgba(255,153,0,0.1)',
                    border: `1px solid ${rec.effort === 'baixo' ? 'rgba(0,204,102,0.3)' : rec.effort === 'alto' ? 'rgba(255,77,77,0.3)' : 'rgba(255,153,0,0.3)'}`,
                    color: rec.effort === 'baixo' ? '#00cc66' : rec.effort === 'alto' ? '#ff4d4d' : '#ff9900',
                  }}>
                    {rec.effort === 'baixo' ? 'Baixo esforço' : rec.effort === 'alto' ? 'Alto esforço' : 'Médio esforço'}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,2,0.08)', border: '1px solid rgba(255,255,2,0.2)', color: '#FFFF02' }}>
                    {rec.timeframe === 'imediato' ? 'Imediato' : rec.timeframe === 'curto_prazo' ? 'Curto prazo' : 'Médio prazo'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="font-montserrat" style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
              Contatos para Abordagem Comercial
            </div>
            <p style={{ fontSize: 12, color: '#c9c9c9', fontFamily: 'Arvo, serif', margin: 0 }}>
              Lideranças identificadas em <strong style={{ color: '#ccc' }}>{diagnostic.input.companyName}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {isDemo && (
              <span style={{ fontSize: 10, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 1, padding: '4px 10px', borderRadius: 3, background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', color: '#ff9900' }}>
                DEMO
              </span>
            )}
          </div>
        </div>

        {apolloLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: 12 }}>
            <span className="spin" style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#FFFF02', borderRadius: '50%', display: 'inline-block' }} />
            <span style={{ fontSize: 13, color: '#c9c9c9', fontFamily: 'Arvo, serif' }}>Carregando contatos…</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {contacts.map((contact, i) => (
              <ContactCard key={contact.id} contact={contact} index={i} />
            ))}
          </div>
        )}

        {/* Approach strategies */}
        <div style={{ marginTop: 32, padding: '22px 24px', background: 'rgba(255,255,2,0.03)', border: '1px solid rgba(255,255,2,0.1)', borderRadius: 8 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#FFFF02', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Estratégias de Abordagem Recomendadas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              {
                icon: '→',
                title: 'Abordagem Direta',
                desc: 'Entre em contato via email ou telefone com uma proposta personalizada baseada nos gaps críticos identificados.',
                color: '#FFFF02',
              },
              {
                icon: '◈',
                title: 'Social Selling (LinkedIn)',
                desc: 'Conecte-se com os decisores no LinkedIn, compartilhe conteúdo relevante e construa relacionamento antes da abordagem.',
                color: '#4fa3d6',
              },
              {
                icon: '✉',
                title: 'Email + LinkedIn',
                desc: 'Sequência coordenada de email e mensagens no LinkedIn com insights específicos sobre os resultados do diagnóstico.',
                color: '#00cc66',
              },
            ].map(({ icon, title, desc, color }) => (
              <div key={title} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 18, marginBottom: 8, color }}>{icon}</div>
                <div className="font-montserrat" style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{title}</div>
                <p style={{ fontSize: 11, color: '#c9c9c9', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Source attribution */}
        <div style={{ marginTop: 16, padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: 10, color: '#e6e1e1', fontFamily: 'Arvo, serif' }}>
            Contatos via <strong style={{ color: '#c9c9c9' }}>Apollo.io</strong> · Prioridade: lideranças de marketing (C-Suite, VP, Director, Manager)
            {isDemo && ' · Dados de demonstração — configure API Key para dados reais'}
          </span>
        </div>
      </div>
    </div>
  );
}
