import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { SUBDIMENSIONS, DIMENSION_CONFIG, LEVEL_CONFIG } from '../../data/scorecard';
import { scoreToLevel } from '../../services/scoring';
import type { Diagnostic, DimensionKey, MaturityLevel, SubdimensionScore } from '../../types';
import { InfoTooltip } from '../../components/ui/Tooltip';

interface Props {
  diagnostic: Diagnostic;
  dimensionKey: DimensionKey;
}

const SCORE_COLORS: Record<number, string> = { 1: '#ff4d4d', 2: '#ff9900', 3: '#00cc66', 4: '#FFFF02' };
const LEVEL_COLORS: Record<string, string> = {
  Intuitivo: '#ff4d4d', Reativo: '#ff9900', Ativo: '#00cc66', Exponencial: '#FFFF02',
};

function levelColor(level: string) { return LEVEL_COLORS[level] ?? '#999'; }
function scoreColor(score: number) { return SCORE_COLORS[Math.round(score)] ?? '#FFFF02'; }

function LevelBadge({ level }: { level: MaturityLevel }) {
  return (
    <span
      style={{
        fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
        letterSpacing: 1, textTransform: 'uppercase' as const,
        padding: '3px 8px', borderRadius: 3, display: 'inline-block',
        background: `${levelColor(level)}18`,
        border: `1px solid ${levelColor(level)}50`,
        color: levelColor(level),
      }}
    >
      {level}
    </span>
  );
}

function SourceBadge({ source, dataSources, dataReliability }: {
  source: SubdimensionScore['source'];
  dataSources?: string[];
  dataReliability?: 'real' | 'estimated' | 'manual' | 'insufficient';
}) {
  // If we have real/estimated info from collection, show that instead
  if (dataReliability === 'real') {
    const tooltipContent = (
      <div>
        <div style={{ fontWeight: 700, color: '#00cc66', marginBottom: 4 }}>Dado Real</div>
        <div>Coletado diretamente de API oficial.</div>
        {dataSources && dataSources.length > 0 && (
          <div style={{ marginTop: 6, color: '#aaa' }}>
            Fontes: {dataSources.join(', ')}
          </div>
        )}
      </div>
    );
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
          letterSpacing: 0.8, textTransform: 'uppercase' as const, color: '#00cc66',
          border: '1px solid #00cc66', borderRadius: 2, padding: '2px 6px',
          display: 'inline-block',
        }}>
          Real
        </span>
        <InfoTooltip content={tooltipContent} maxWidth={220} />
      </span>
    );
  }

  if (dataReliability === 'estimated') {
    const tooltipContent = (
      <div>
        <div style={{ fontWeight: 700, color: '#ff9900', marginBottom: 4 }}>Dado Estimado</div>
        <div>Gerado via modelo preditivo. Para dados reais, integre as APIs indicadas.</div>
        {dataSources && dataSources.length > 0 && (
          <div style={{ marginTop: 6, color: '#aaa' }}>
            APIs recomendadas: {dataSources.join(', ')}
          </div>
        )}
      </div>
    );
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
          letterSpacing: 0.8, textTransform: 'uppercase' as const, color: '#ff9900',
          border: '1px solid #ff9900', borderRadius: 2, padding: '2px 6px',
          display: 'inline-block', opacity: 0.9,
        }}>
          Estimado
        </span>
        <InfoTooltip content={tooltipContent} maxWidth={240} />
      </span>
    );
  }

  // Legacy source badges
  const map: Record<string, { label: string; color: string; tip: string }> = {
    auto: { label: 'Automático', color: '#00cc66', tip: 'Coletado automaticamente via API.' },
    manual: { label: 'Manual', color: '#ff9900', tip: 'Dado inserido ou ajustado manualmente.' },
    insufficient: { label: 'Insuficiente', color: '#888', tip: 'Dados insuficientes para avaliação completa.' },
    skipped: { label: 'Ignorado', color: '#555', tip: 'Subdimensão não aplicável ao perfil avaliado.' },
  };
  const cfg = map[source] ?? map['auto'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontSize: 9, fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
        letterSpacing: 0.8, textTransform: 'uppercase' as const, color: cfg.color,
        border: `1px solid ${cfg.color}`, borderRadius: 2, padding: '2px 6px',
        display: 'inline-block', opacity: 0.8,
      }}>
        {cfg.label}
      </span>
      <InfoTooltip content={cfg.tip} maxWidth={200} />
    </span>
  );
}

function ScoreBar({ score, max = 4 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: scoreColor(score), borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <span className="font-bebas" style={{ fontSize: 18, color: scoreColor(score), minWidth: 28 }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

// Metric gauge for raw values (e.g. LCP, mobile score)
function MetricGauge({ value, label, unit, max, good, color }: {
  value: number; label: string; unit: string; max: number; good: boolean; color: string;
}) {
  const pct = Math.min(1, value / max);
  const r = 36, cx = 50, cy = 50;
  const startAngle = Math.PI * 0.8, endAngle = Math.PI * 2.2;
  const sweepAngle = (endAngle - startAngle) * pct;
  const arcStart = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const arcEnd = { x: cx + r * Math.cos(startAngle + sweepAngle), y: cy + r * Math.sin(startAngle + sweepAngle) };
  const fullEnd = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const largeArc = sweepAngle > Math.PI ? 1 : 0;
  const totalArc = endAngle - startAngle;
  const fullLargeArc = totalArc > Math.PI ? 1 : 0;

  const displayVal = value < 10 ? value.toFixed(2) : Math.round(value).toString();

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={100} height={72} viewBox="0 0 100 72">
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${fullLargeArc} 1 ${fullEnd.x} ${fullEnd.y}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} strokeLinecap="round"
        />
        {pct > 0 && (
          <path
            d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
            fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={14} fontFamily="'Bebas Neue', sans-serif">
          {displayVal}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#888" fontSize={8} fontFamily="Montserrat, sans-serif">
          {unit}
        </text>
      </svg>
      <div style={{ fontSize: 9, color: good ? '#00cc66' : '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: 0.5, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// Boolean check row
function CheckRow({ label, value, tooltip }: { label: string; value: boolean; tooltip?: string }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        background: value ? 'rgba(0,204,102,0.05)' : 'rgba(255,255,255,0.02)',
        borderRadius: 4, border: `1px solid ${value ? 'rgba(0,204,102,0.2)' : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <span style={{ fontSize: 14 }}>{value ? '✓' : '○'}</span>
      <span style={{ fontSize: 12, color: value ? '#ccc' : '#888', fontFamily: 'Arvo, serif', flex: 1 }}>{label}</span>
      {tooltip && <InfoTooltip content={tooltip} maxWidth={220} />}
    </div>
  );
}

// Traffic pie chart
function TrafficPie({ channels }: { channels: Record<string, number> }) {
  const COLORS = ['#00cc66', '#FFFF02', '#ff9900', '#00aaff', '#cc66ff'];
  const data = Object.entries(channels)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  return (
    <div>
      <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        Mix de Canais
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
            dataKey="value" nameKey="name" label={false}
            labelLine={false}
          >
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Legend formatter={(v) => <span style={{ fontSize: 11, color: '#999' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function decodeHTMLEntities(str: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

function formatRawValue(value: unknown): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) { const f = value.filter(Boolean); return f.length > 0 ? f.map(i => decodeHTMLEntities(String(i))).join(', ') : 'N/A'; }
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return decodeHTMLEntities(String(value));
}
function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// Technical rationale per subdimension
function getTechnicalRationale(subdimId: string): string | null {
  const rationales: Record<string, string> = {
    performance_web: 'Core Web Vitals são ranking factors diretos no Google Search. Sites com LCP > 2.5s perdem posições e têm taxa de rejeição até 32% maior (Google, 2023). Mobile Score < 50 compromete indexação mobile-first.',
    seo_onpage: 'SEO on-page controla como o Googlebot interpreta e rankeia cada página. Title tags, meta descriptions e heading hierarchy são os sinais mais controláveis e de maior ROI imediato em organic search.',
    seo_offpage: 'Authority Score reflete confiança do domínio aos olhos do Google. Domínios com DA > 40 competem em keywords de alta concorrência. A diversidade de referring domains pesa mais que volume bruto de backlinks.',
    conteudo_blog: 'Conteúdo de blog é o principal driver de tráfego orgânico de topo de funil. Frequência de publicação > 4x/mês correlaciona com 3.5x mais tráfego (HubSpot). Artigos com 1500+ palavras rankeiam 2x mais que conteúdos curtos.',
    presenca_social: 'Presença social validada = prova social + amplificação de conteúdo. Engajamento > 3% no Instagram indica audiência ativa. LinkedIn é o canal de maior CPL qualificado para B2B.',
    presenca_video_audio: 'Vídeo representa 82% do tráfego global de internet (Cisco). Canais YouTube com > 10k inscritos têm autoridade de marca estabelecida. Podcasts geram média de 7x mais engajamento que posts de texto.',
    mix_trafego: 'Diversificação de canais reduz dependência e volatilidade. Dependência > 70% em orgânico expõe a updates de algoritmo; > 70% em pago cria fragilidade financeira. Mix balanceado = crescimento sustentável.',
    paid_media: 'Mídia paga bem estruturada deve ter ROAS > 3x para ser sustentável. Full-funnel coverage (awareness + consideração + conversão) reduz CPA em até 40% vs. campanhas only-bottom funnel.',
    tracking_health: 'Tracking preciso é a base de toda decisão de marketing. Sem GA4 + Consent Mode v2, as campanhas operam sem dados de conversão confiáveis — o que inviabiliza otimização por ROAS ou CPA.',
    stack_martech: 'Stack MarTech adequado ao estágio da empresa reduz fricção operacional e aumenta velocidade de execução. CDP indica maturidade avançada; ausência de ferramenta de automação limita escalabilidade.',
    conversao_cro: 'CRO (Conversion Rate Optimization) é a alavanca de maior ROI: dobrar a taxa de conversão equivale a dobrar o budget sem aumentar custos de aquisição. Acima de 3% é benchmark de mercado para e-commerce.',
    checkout_ux: 'Abandono de carrinho médio é 70% (Baymard Institute). Checkout em 1 etapa, Apple Pay e trust badges reduzem abandono em até 35%. Cada campo extra no formulário aumenta abandono em ~10%.',
    reputacao_voc: 'Google Rating > 4.5 e volume > 100 reviews aumentam CTR em 15-25% nas SERPs locais. Reclame Aqui com Índice de Solução < 70% é sinal de alerta para e-commerce e serviços financeiros.',
    analytics_insights: 'Dashboards de performance em tempo real reduzem tempo de decisão de semanas para horas. Empresas data-driven têm 23x mais probabilidade de adquirir clientes e 6x mais de reter (McKinsey).',
  };
  return rationales[subdimId] ?? null;
}

// Rich visualization for specific subdimensions
function SubdimVisuals({ score }: { score: SubdimensionScore }) {
  const raw = score.rawData ?? {};

  if (score.subdimensionId === 'performance_web') {
    const mobile = raw.mobile as { mobileScore?: number; lcp?: number; cls?: number; fcp?: number; accessibilityScore?: number; seoScore?: number } | undefined;
    const desktop = raw.desktop as { desktopScore?: number } | undefined;
    const tech = raw.tech as { gtmInstalled?: boolean; ga4Installed?: boolean; metaPixel?: boolean; consentModeV2?: boolean } | undefined;

    if (!mobile) return null;
    const lcp = mobile.lcp ?? 0;
    const cls = mobile.cls ?? 0;
    const mobileScore = mobile.mobileScore ?? 0;
    const desktopScore = desktop?.desktopScore ?? 0;
    const acc = mobile.accessibilityScore ?? 0;
    const seo = mobile.seoScore ?? 0;

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            Core Web Vitals & PageSpeed
          </div>
          <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(0,204,102,0.1)', border: '1px solid rgba(0,204,102,0.3)', borderRadius: 3, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
            Google PageSpeed Insights API
          </span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <MetricGauge value={mobileScore} label="Mobile Score" unit="/100" max={100} good={mobileScore >= 75} color={mobileScore >= 90 ? '#FFFF02' : mobileScore >= 75 ? '#00cc66' : mobileScore >= 50 ? '#ff9900' : '#ff4d4d'} />
          <MetricGauge value={desktopScore} label="Desktop Score" unit="/100" max={100} good={desktopScore >= 90} color={desktopScore >= 90 ? '#FFFF02' : desktopScore >= 75 ? '#00cc66' : '#ff9900'} />
          <MetricGauge value={Math.min(lcp, 6)} label={`LCP ${lcp.toFixed(1)}s`} unit="s" max={6} good={lcp < 2.5} color={lcp < 1.5 ? '#FFFF02' : lcp < 2.5 ? '#00cc66' : lcp < 4 ? '#ff9900' : '#ff4d4d'} />
          <MetricGauge value={Math.min(cls * 10, 3)} label={`CLS ${cls.toFixed(2)}`} unit="CLS" max={3} good={cls < 0.1} color={cls < 0.1 ? '#00cc66' : cls < 0.25 ? '#ff9900' : '#ff4d4d'} />
          <MetricGauge value={acc} label="Acessibilidade" unit="/100" max={100} good={acc >= 80} color={acc >= 90 ? '#00cc66' : acc >= 70 ? '#ff9900' : '#ff4d4d'} />
          <MetricGauge value={seo} label="SEO Score" unit="/100" max={100} good={seo >= 80} color={seo >= 90 ? '#00cc66' : seo >= 70 ? '#ff9900' : '#ff4d4d'} />
        </div>
        {tech && (
          <div style={{ marginTop: 16 }}>
            <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Tecnologias Detectadas (via PageSpeed)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <CheckRow label="Google Tag Manager" value={!!tech.gtmInstalled} tooltip="Detectado via script googletagmanager.com no HTML da página." />
              <CheckRow label="GA4 / Google Analytics" value={!!tech.ga4Installed} tooltip="Detectado via google-analytics.com ou analytics.google.com." />
              <CheckRow label="Meta Pixel (Facebook)" value={!!tech.metaPixel} tooltip="Detectado via connect.facebook.net — essencial para remarketing Meta." />
              <CheckRow label="Consent Mode v2" value={!!tech.consentModeV2} tooltip="Detectado via cookiebot, onetrust ou gtag consentmode — obrigatório para LGPD/GDPR." />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (score.subdimensionId === 'tracking_health') {
    const gtm = raw.gtmPresent as boolean ?? false;
    const ga4 = raw.ga4Configured as boolean ?? false;
    const meta = raw.metaPixel as boolean ?? false;
    const li = raw.linkedinInsightTag as boolean ?? false;
    const consent = raw.consentModeV2 as boolean ?? false;
    const hotjar = raw.hotjarInstalled as boolean ?? false;
    const conflicts = raw.tagConflicts as number ?? 0;

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            Tracking Stack Detectado
          </div>
          <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(0,204,102,0.1)', border: '1px solid rgba(0,204,102,0.3)', borderRadius: 3, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
            Google PageSpeed API
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          <CheckRow label="Google Tag Manager" value={gtm} tooltip="Centraliza a gestão de tags sem deploy de código — reduz tempo de implementação em 80%." />
          <CheckRow label="GA4 Configurado" value={ga4} tooltip="Mensuração de sessões, eventos e conversões com modelo de dados orientado a eventos." />
          <CheckRow label="Meta Pixel" value={meta} tooltip="Essencial para campanhas de remarketing no Meta Ads e otimização por conversões." />
          <CheckRow label="LinkedIn Insight Tag" value={li} tooltip="Necessário para remarketing e rastreamento de conversão B2B no LinkedIn Campaign Manager." />
          <CheckRow label="Hotjar / Heatmaps" value={hotjar} tooltip="Análise comportamental de UX com gravações de sessão, mapas de calor e funis de conversão." />
          <CheckRow label="Consent Mode v2" value={consent} tooltip="Obrigatório para conformidade com LGPD e GDPR. Permite modelagem de conversão mesmo sem cookies." />
        </div>
        {conflicts > 0 && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 4 }}>
            <span style={{ fontSize: 12, color: '#ff4d4d', fontFamily: 'Arvo, serif' }}>
              {conflicts} conflito(s) de tag detectado(s). Risco de dupla contagem de conversões.
            </span>
          </div>
        )}
      </div>
    );
  }

  if (score.subdimensionId === 'stack_martech') {
    const total = raw.totalTechnologies as number ?? 0;
    const categories = raw.categoriesCovered as string[] ?? [];
    const gtm = raw.gtmInstalled as boolean ?? false;
    const ga4 = raw.ga4Installed as boolean ?? false;
    const cdp = raw.cdpInstalled as boolean ?? false;

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            Stack MarTech
          </div>
          <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(0,204,102,0.1)', border: '1px solid rgba(0,204,102,0.3)', borderRadius: 3, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
            PageSpeed + BuiltWith
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
          {[
            { label: 'Total de Tecnologias', value: String(total), color: total > 15 ? '#00cc66' : '#ff9900' },
            { label: 'GTM Instalado', value: gtm ? 'Sim' : 'Não', color: gtm ? '#00cc66' : '#ff4d4d' },
            { label: 'GA4 Configurado', value: ga4 ? 'Sim' : 'Não', color: ga4 ? '#00cc66' : '#ff4d4d' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <div className="font-bebas" style={{ fontSize: 22, color }}>{value}</div>
              <div style={{ fontSize: 10, color: '#888', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
        {categories.length > 0 && (
          <div>
            <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Categorias Cobertas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categories.filter(Boolean).map((cat) => (
                <span key={cat} style={{ fontSize: 11, color: '#FFFF02', background: 'rgba(255,255,2,0.08)', border: '1px solid rgba(255,255,2,0.2)', borderRadius: 3, padding: '3px 8px', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                  {cat}
                </span>
              ))}
            </div>
          </div>
        )}
        {cdp && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,204,102,0.06)', border: '1px solid rgba(0,204,102,0.2)', borderRadius: 4 }}>
            <span style={{ fontSize: 12, color: '#00cc66', fontFamily: 'Arvo, serif' }}>
              CDP/Data Platform detectado — maturidade avançada em gestão de dados de cliente.
            </span>
          </div>
        )}
      </div>
    );
  }

  if (score.subdimensionId === 'mix_trafego') {
    const channels = raw.channels as Record<string, number> | undefined;
    const traffic = raw.trafficEstimate as number ?? 0;
    const trend = raw.trend12m as string ?? '';

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            Mix de Tráfego
          </div>
          <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', borderRadius: 3, color: '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
            Estimado · SimilarWeb
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Tráfego/Mês (estimado)', value: traffic > 0 ? traffic.toLocaleString('pt-BR') : 'N/A', color: traffic > 500000 ? '#FFFF02' : traffic > 50000 ? '#00cc66' : traffic > 5000 ? '#ff9900' : '#ff4d4d' },
            { label: 'Tendência 12m', value: trend || 'N/A', color: trend === 'crescimento' ? '#00cc66' : '#ff9900' },
            { label: 'Canais Ativos', value: channels ? String(Object.keys(channels).length) : 'N/A', color: '#FFFF02' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <div className="font-bebas" style={{ fontSize: 20, color }}>{value}</div>
              <div style={{ fontSize: 10, color: '#888', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
        {channels && Object.keys(channels).length > 0 && <TrafficPie channels={channels} />}
      </div>
    );
  }

  if (score.subdimensionId === 'presenca_video_audio') {
    const hasChannel = raw.hasChannel as boolean ?? false;
    const subscribers = raw.subscribers as number | null ?? null;
    const videoCount = raw.videoCount as number | null ?? null;
    const viewCount = raw.viewCount as number | null ?? null;
    const isReal = score.dataReliability === 'real';

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            Presença em Vídeo
          </div>
          {isReal ? (
            <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(0,204,102,0.1)', border: '1px solid rgba(0,204,102,0.3)', borderRadius: 3, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
              YouTube Data API v3
            </span>
          ) : (
            <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', borderRadius: 3, color: '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
              {hasChannel ? 'Canal Detectado · Sem API Key' : 'Estimado'}
            </span>
          )}
        </div>

        {!hasChannel ? (
          <div style={{ padding: '12px 16px', background: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: '#ff9900', fontFamily: 'Arvo, serif' }}>
              Nenhum canal YouTube detectado. Presença em vídeo é um diferencial competitivo crescente — considere criar conteúdo regular.
            </span>
          </div>
        ) : subscribers !== null ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              {
                label: 'Inscritos',
                value: subscribers > 999999 ? `${(subscribers / 1000000).toFixed(1)}M` : subscribers > 999 ? `${(subscribers / 1000).toFixed(1)}K` : String(subscribers),
                color: subscribers >= 100000 ? '#FFFF02' : subscribers >= 10000 ? '#00cc66' : subscribers >= 1000 ? '#ff9900' : '#ff4d4d',
              },
              {
                label: 'Vídeos',
                value: videoCount !== null ? String(videoCount) : 'N/A',
                color: (videoCount ?? 0) >= 50 ? '#00cc66' : '#ff9900',
              },
              {
                label: 'Visualizações',
                value: viewCount !== null ? (viewCount > 999999 ? `${(viewCount / 1000000).toFixed(1)}M` : viewCount > 999 ? `${(viewCount / 1000).toFixed(1)}K` : String(viewCount)) : 'N/A',
                color: '#FFFF02',
              },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                <div className="font-bebas" style={{ fontSize: 22, color }}>{value}</div>
                <div style={{ fontSize: 10, color: '#888', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '12px 16px', background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.2)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: '#ff9900', fontFamily: 'Arvo, serif' }}>
              Canal YouTube detectado via URL, mas métricas reais requerem YouTube Data API v3. Configure a chave em Configurações para dados precisos.
            </span>
          </div>
        )}
      </div>
    );
  }

  if (score.subdimensionId === 'seo_offpage') {
    const authority = raw.authorityScore as number ?? 0;
    const backlinks = raw.totalBacklinks as number ?? 0;
    const domains = raw.referringDomains as number ?? 0;
    const toxic = raw.toxicLinks as number ?? 0;

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            SEO Off-Page
          </div>
          <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', borderRadius: 3, color: '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
            Estimado · Semrush / Moz
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Authority Score', value: String(authority), color: authority >= 40 ? '#00cc66' : authority >= 20 ? '#ff9900' : '#ff4d4d', tooltip: 'Domain Authority 0–100 (Semrush/Moz). Score ≥ 40 é competitivo em keywords de média dificuldade.' },
            { label: 'Backlinks Totais', value: backlinks > 999 ? `${(backlinks / 1000).toFixed(1)}K` : String(backlinks), color: '#FFFF02', tooltip: 'Volume total de backlinks apontando para o domínio. Mais importante é a diversidade de domínios únicos.' },
            { label: 'Domínios Referência', value: String(domains), color: domains >= 100 ? '#00cc66' : '#ff9900', tooltip: 'Número de domínios únicos referenciando o site — métrica mais importante que volume bruto de links.' },
            { label: 'Links Tóxicos', value: String(toxic), color: toxic === 0 ? '#00cc66' : '#ff9900', tooltip: 'Links de sites de spam ou penalizados. Links tóxicos podem prejudicar rankings — use Google Disavow se necessário.' },
          ].map(({ label, value, color, tooltip }) => (
            <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                <InfoTooltip content={tooltip} maxWidth={240} />
              </div>
              <div className="font-bebas" style={{ fontSize: 22, color }}>{value}</div>
              <div style={{ fontSize: 10, color: '#888', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (score.subdimensionId === 'reputacao_voc') {
    const gRating = raw.googleRating as number ?? 0;
    const gReviews = raw.googleReviews as number ?? 0;
    const raScore = raw.reclaimeAquiScore as number ?? 0;
    const raSolution = raw.reclaimeAquiSolutionIndex as number ?? 0;

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
            Reputação & VOC
          </div>
          <span style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', borderRadius: 3, color: '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
            Estimado · Google Places / Reclame Aqui
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Google Rating', value: gRating.toFixed(1) + '★', color: gRating >= 4.5 ? '#00cc66' : gRating >= 4.0 ? '#ff9900' : '#ff4d4d', tooltip: 'Avaliação no Google Meu Negócio. ≥ 4.5 é excelente; < 4.0 impacta CTR nas SERPs locais.' },
            { label: 'Reviews Google', value: gReviews > 999 ? `${(gReviews / 1000).toFixed(1)}K` : String(gReviews), color: '#FFFF02', tooltip: 'Volume de avaliações — sinal de social proof. Mais de 100 reviews é o benchmark mínimo para credibilidade.' },
            { label: 'Reclame Aqui', value: raScore.toFixed(1), color: raScore >= 8 ? '#00cc66' : raScore >= 6 ? '#ff9900' : '#ff4d4d', tooltip: 'Score 0–10 no Reclame Aqui. ≥ 8 = "Ótimo"; 6–7.9 = "Bom"; < 6 = risco de reputação.' },
            { label: 'Índice Solução', value: `${raSolution.toFixed(0)}%`, color: raSolution >= 80 ? '#00cc66' : raSolution >= 60 ? '#ff9900' : '#ff4d4d', tooltip: '% de reclamações respondidas e resolvidas. ≥ 80% demonstra comprometimento com o cliente.' },
          ].map(({ label, value, color, tooltip }) => (
            <div key={label} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                <InfoTooltip content={tooltip} maxWidth={240} />
              </div>
              <div className="font-bebas" style={{ fontSize: 22, color }}>{value}</div>
              <div style={{ fontSize: 10, color: '#888', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function NextLevelTip({ score, subdimDef }: {
  score: SubdimensionScore;
  subdimDef: (typeof SUBDIMENSIONS)[0] | undefined;
}) {
  const nextScore = Math.min(4, Math.round(score.score) + 1) as 1 | 2 | 3 | 4;
  if (nextScore <= Math.round(score.score) || !subdimDef?.levels[nextScore]) return null;

  const nextLevelName = scoreToLevel(nextScore);
  return (
    <div style={{
      marginTop: 14, padding: '10px 14px',
      background: 'rgba(255,255,2,0.04)', border: '1px solid rgba(255,255,2,0.12)', borderRadius: 6,
    }}>
      <div className="font-montserrat" style={{ fontSize: 9, color: '#FFFF02', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>
        Para chegar ao nível {nextLevelName}:
      </div>
      <p style={{ fontSize: 12, color: '#bbb', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>
        {subdimDef.levels[nextScore]}
      </p>
    </div>
  );
}

function SubdimRow({ score, subdimDef, isExpanded, onToggle }: {
  score: SubdimensionScore;
  subdimDef: (typeof SUBDIMENSIONS)[0] | undefined;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const level = score.level ?? scoreToLevel(score.score);
  const levelCfg = LEVEL_CONFIG[level];
  const rationale = getTechnicalRationale(score.subdimensionId);

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s ease' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '18px 22px',
          display: 'grid', gridTemplateColumns: '1fr 200px auto auto auto',
          alignItems: 'center', gap: 16, textAlign: 'left',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
      >
        <div>
          <span className="font-montserrat" style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
            {score.name}
          </span>
          {score.isConditional && (
            <span style={{
              marginLeft: 8, fontSize: 9, color: '#FFFF02',
              border: '1px solid rgba(255,255,2,0.3)', borderRadius: 2,
              padding: '1px 5px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
              letterSpacing: 0.5, textTransform: 'uppercase' as const,
            }}>E-COMM</span>
          )}
          {subdimDef?.description && (
            <div style={{ fontSize: 11, color: '#888', fontFamily: 'Arvo, serif', marginTop: 3 }}>
              {subdimDef.description.slice(0, 80)}{subdimDef.description.length > 80 ? '…' : ''}
            </div>
          )}
        </div>

        <ScoreBar score={score.score} />

        <LevelBadge level={level} />
        <SourceBadge
          source={score.source}
          dataSources={score.dataSources}
          dataReliability={score.dataReliability}
        />
        <span style={{ color: '#aaa', fontSize: 14, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', display: 'inline-block' }}>
          ▾
        </span>
      </button>

      {isExpanded && (
        <div style={{ padding: '0 22px 22px 22px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Rich visuals for specific subdimensions */}
          <SubdimVisuals score={score} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
            {/* Left: Description + Level definition */}
            <div>
              {subdimDef?.description && (
                <div style={{ marginBottom: 14 }}>
                  <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    Sobre Esta Subdimensão
                  </div>
                  <p style={{ fontSize: 12, color: '#aaa', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>
                    {subdimDef.description}
                  </p>
                </div>
              )}

              <div>
                <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  Critério Atual — {level}
                </div>
                <div style={{
                  padding: '10px 14px', borderRadius: 6,
                  background: levelCfg?.bg ?? 'rgba(255,255,255,0.03)',
                  border: `1px solid ${levelCfg?.color ?? '#555'}40`,
                }}>
                  <p style={{ fontSize: 12, color: '#ccc', fontFamily: 'Arvo, serif', lineHeight: 1.6, margin: 0 }}>
                    {subdimDef?.levels[score.score as 1 | 2 | 3 | 4] ?? 'Definição não disponível.'}
                  </p>
                </div>
              </div>

              <NextLevelTip score={score} subdimDef={subdimDef} />

              {subdimDef?.kpis && (
                <div style={{ marginTop: 14 }}>
                  <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    KPIs Avaliados
                  </div>
                  <p style={{ fontSize: 11, color: '#aaa', fontFamily: 'Arvo, serif', lineHeight: 1.5, margin: 0 }}>
                    {subdimDef.kpis}
                  </p>
                </div>
              )}

              {/* Technical & Strategic Rationale */}
              {rationale && (
                <div style={{
                  marginTop: 14, padding: '12px 14px',
                  background: 'rgba(255,255,255,0.02)', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderLeft: '3px solid rgba(255,255,2,0.3)',
                }}>
                  <div className="font-montserrat" style={{ fontSize: 9, color: '#FFFF02', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    Racional Técnico & Estratégico
                  </div>
                  <p style={{ fontSize: 11, color: '#aaa', fontFamily: 'Arvo, serif', lineHeight: 1.65, margin: 0 }}>
                    {rationale}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Raw data table */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Dados Coletados
                </div>
                {score.dataReliability === 'real' && (
                  <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(0,204,102,0.1)', border: '1px solid rgba(0,204,102,0.3)', borderRadius: 2, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                    Real
                  </span>
                )}
                {score.dataReliability === 'estimated' && (
                  <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)', borderRadius: 2, color: '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                    Estimado
                  </span>
                )}
              </div>
              {Object.keys(score.rawData ?? {}).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {Object.entries(score.rawData ?? {})
                    .filter(([k, v]) => v !== undefined && !['mobile', 'desktop', 'tech'].includes(k))
                    .slice(0, 14)
                    .map(([k, v]) => (
                      <div key={k} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                        padding: '5px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <span style={{ fontSize: 11, color: '#999', fontFamily: 'Montserrat, sans-serif', fontWeight: 500 }}>
                          {formatKey(k)}
                        </span>
                        <span style={{
                          fontSize: 11, fontFamily: 'Arvo, serif', textAlign: 'right', maxWidth: 160, wordBreak: 'break-word',
                          color: typeof v === 'boolean' ? (v ? '#00cc66' : '#ff4d4d') : '#ccc',
                          fontWeight: typeof v === 'boolean' ? 700 : 400,
                        }}>
                          {formatRawValue(v)}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ fontSize: 12, color: '#888', fontFamily: 'Arvo, serif', margin: 0, lineHeight: 1.5 }}>
                    Dados detalhados requerem integração com APIs externas (SimilarWeb, Semrush, etc.).
                  </p>
                </div>
              )}

              {/* Source attribution */}
              {score.dataSources && score.dataSources.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {score.dataSources.map((src) => (
                    <span key={src} style={{
                      fontSize: 9, padding: '2px 6px',
                      background: score.dataReliability === 'real' ? 'rgba(0,204,102,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${score.dataReliability === 'real' ? 'rgba(0,204,102,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 3,
                      color: score.dataReliability === 'real' ? '#00cc66' : '#888',
                      fontFamily: 'Montserrat, sans-serif', fontWeight: 600,
                    }}>
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Horizontal bar chart comparing all subdimensions in this dimension
function SubdimBarChart({ scores }: { scores: SubdimensionScore[] }) {
  const data = scores
    .filter((s) => s.source !== 'skipped')
    .map((s) => ({
      name: s.name.length > 22 ? s.name.slice(0, 20) + '…' : s.name,
      score: s.score,
      fill: scoreColor(s.score),
    }));

  return (
    <div>
      <div className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        Comparativo de Scores
      </div>
      <ResponsiveContainer width="100%" height={data.length * 44 + 20}>
        <BarChart data={data} layout="vertical" barSize={16} margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
          <XAxis type="number" domain={[0, 4]} ticks={[1, 2, 3, 4]} tick={{ fill: '#888', fontSize: 10, fontFamily: 'Montserrat, sans-serif' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={180} tick={{ fill: '#999', fontSize: 11, fontFamily: 'Arvo, serif' }} axisLine={false} tickLine={false} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12, fontFamily: 'Arvo, serif', color: '#ccc' }}
            formatter={(v: number | undefined) => v != null ? [`${v.toFixed(1)} / 4.0 — ${scoreToLevel(v)}`, 'Score'] : ['', 'Score']}
          />
          <Bar dataKey="score" radius={[0, 3, 3, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Radar-like radial chart for dimension score
function DimensionRadial({ score }: { score: number }) {
  const data = [{ name: 'Score', value: score, fill: scoreColor(score) }];
  return (
    <ResponsiveContainer width={120} height={120}>
      <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="90%" data={data} startAngle={225} endAngle={-45}>
        <RadialBar dataKey="value" background={{ fill: 'rgba(255,255,255,0.05)' }} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

export default function DimensionPage({ diagnostic, dimensionKey }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const dimConfig = DIMENSION_CONFIG[dimensionKey];
  const dimScore = diagnostic.dimensionScores?.find((d) => d.key === dimensionKey);
  const level = dimScore?.level ?? 'Intuitivo';
  const score = dimScore?.score ?? 1;

  const dimensionSubdims = diagnostic.subdimensionScores.filter((s) => s.dimension === dimensionKey);
  const relevantSubdims = dimensionSubdims.filter((s) => s.source !== 'skipped');

  const realCount = relevantSubdims.filter((s) => s.dataReliability === 'real').length;
  const estimatedCount = relevantSubdims.filter((s) => s.dataReliability === 'estimated').length;

  const avgScore = relevantSubdims.length > 0
    ? relevantSubdims.reduce((sum, s) => sum + s.score, 0) / relevantSubdims.length
    : 1;

  const bestSubdim = relevantSubdims.reduce((a, b) => a.score > b.score ? a : b, relevantSubdims[0]);
  const worstSubdim = relevantSubdims.reduce((a, b) => a.score < b.score ? a : b, relevantSubdims[0]);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
      {/* Dimension header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 32, alignItems: 'center', marginBottom: 36 }}>
        {/* Radial score */}
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <DimensionRadial score={score} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="font-bebas" style={{ fontSize: 28, color: scoreColor(score), lineHeight: 1 }}>{score.toFixed(2)}</span>
            <span style={{ fontSize: 9, color: '#888', fontFamily: 'Montserrat, sans-serif' }}>/4.0</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="font-montserrat" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: dimConfig.color, marginBottom: 4 }}>
            Dimensão
          </div>
          <h1 className="font-bebas" style={{ fontSize: 48, color: '#fff', margin: 0, letterSpacing: 2, lineHeight: 1 }}>
            {dimConfig.name}
          </h1>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <LevelBadge level={level} />
            <span style={{ fontSize: 12, color: '#888', fontFamily: 'Arvo, serif' }}>{relevantSubdims.length} subdimensões avaliadas</span>
            {realCount > 0 && (
              <span style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(0,204,102,0.1)', border: '1px solid rgba(0,204,102,0.25)', borderRadius: 3, color: '#00cc66', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                {realCount} real{realCount > 1 ? 'is' : ''}
              </span>
            )}
            {estimatedCount > 0 && (
              <span style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(255,153,0,0.08)', border: '1px solid rgba(255,153,0,0.2)', borderRadius: 3, color: '#ff9900', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                {estimatedCount} estimado{estimatedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Score Médio', value: avgScore.toFixed(2), color: scoreColor(avgScore) },
            { label: 'Melhor', value: bestSubdim?.score?.toFixed(1) ?? '–', color: '#00cc66' },
            { label: 'Gap Crítico', value: worstSubdim?.score?.toFixed(1) ?? '–', color: '#ff4d4d' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '6px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: 10, color: '#888', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
              <span className="font-bebas" style={{ fontSize: 20, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bar chart comparison */}
      <div className="ivoire-card" style={{ padding: '24px 28px', marginBottom: 28 }}>
        <SubdimBarChart scores={dimensionSubdims} />
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto auto auto', gap: 16, padding: '10px 22px', alignItems: 'center' }}>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Subdimensão</span>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Score</span>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Nível</span>
        <span className="font-montserrat" style={{ fontSize: 10, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>Fonte</span>
        <span />
      </div>

      {/* Subdimension rows */}
      <div className="ivoire-card" style={{ overflow: 'hidden' }}>
        {dimensionSubdims.length === 0 ? (
          <p style={{ padding: 24, color: '#888', fontFamily: 'Arvo, serif', textAlign: 'center' }}>
            Nenhuma subdimensão disponível.
          </p>
        ) : (
          dimensionSubdims.map((s) => {
            const subdimDef = SUBDIMENSIONS.find((sd) => sd.id === s.subdimensionId);
            return (
              <SubdimRow
                key={s.subdimensionId}
                score={s}
                subdimDef={subdimDef}
                isExpanded={expandedId === s.subdimensionId}
                onToggle={() => toggleExpand(s.subdimensionId)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
