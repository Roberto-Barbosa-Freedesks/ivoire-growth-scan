import { useState } from 'react';
import { useAppStore } from '../store/store';
import type { AppSettings } from '../types';

interface Integration {
  key: keyof AppSettings;
  label: string;
  category: string;
  subdimensions: string[];
  cost: string;
  status: 'free' | 'free_limited' | 'paid' | 'unavailable';
  setupUrl: string;
  setupSteps: string[];
  placeholder: string;
  isPassword?: boolean;
  isTextarea?: boolean;
}

const INTEGRATIONS: Integration[] = [
  // ── Always free ──────────────────────────────────────────────────────
  {
    key: 'pageSpeedApiKey',
    label: 'Google PageSpeed Insights API',
    category: 'Performance & Tracking',
    subdimensions: ['Performance Web', 'Tracking Health', 'Stack MarTech'],
    cost: 'Gratuito — 25.000 req/dia',
    status: 'free',
    setupUrl: 'https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com',
    setupSteps: [
      'Acesse console.cloud.google.com',
      'Crie ou selecione um projeto',
      'Ative a "PageSpeed Insights API"',
      'Vá em Credenciais → Criar credencial → Chave de API',
    ],
    placeholder: 'AIzaSy...',
  },
  {
    key: 'googlePlacesApiKey',
    label: 'Google Places API',
    category: 'Reputação Digital',
    subdimensions: ['Reputação Digital & VoC'],
    cost: 'Gratuito até $200/mês (~11k req gratuitos)',
    status: 'free_limited',
    setupUrl: 'https://console.cloud.google.com/apis/library/places-backend.googleapis.com',
    setupSteps: [
      'Acesse console.cloud.google.com',
      'Ative a "Places API"',
      'Vá em Credenciais → Criar credencial → Chave de API',
      'Restrinja a key ao domínio do app (recomendado)',
    ],
    placeholder: 'AIzaSy...',
  },
  // ── Free with account ─────────────────────────────────────────────────
  {
    key: 'metaAccessToken',
    label: 'Meta Ad Library API (Access Token)',
    category: 'Mídia Paga',
    subdimensions: ['Mídia Paga & Criativos'],
    cost: 'Gratuito — requer conta Facebook',
    status: 'free',
    setupUrl: 'https://developers.facebook.com/tools/explorer/',
    setupSteps: [
      'Acesse developers.facebook.com/tools/explorer',
      'Selecione seu App (ou crie um gratuito)',
      'Clique em "Generate Access Token"',
      'Cole o token aqui (válido ~60 dias — renove mensalmente)',
    ],
    placeholder: 'EAABsbCs4...',
    isTextarea: false,
  },
  {
    key: 'openPageRankApiKey',
    label: 'Open PageRank API',
    category: 'SEO Off-Page',
    subdimensions: ['SEO Off-Page & Link Building'],
    cost: 'Gratuito — 10.000 chamadas/hora, sem cartão de crédito',
    status: 'free',
    setupUrl: 'https://www.domcop.com/openpagerank/documentation',
    setupSteps: [
      'Acesse openpagerank.com e clique em "Get a free API key"',
      'Cadastre-se com e-mail (sem cartão de crédito)',
      'Copie a chave da área "My API Keys"',
      'Cole aqui — score de autoridade de backlinks via Common Crawl',
    ],
    placeholder: 'Ex: os0g...xyz (gratuito em openpagerank.com)',
  },
  // ── Apify (plataforma de scraping — substitui todas as APIs pagas) ───────
  {
    key: 'apifyToken',
    label: 'Apify Token',
    category: 'Scrapers & Automação',
    subdimensions: [
      'Mix de Tráfego (SimilarWeb)',
      'SEO Off-Page (SEMrush + Ahrefs)',
      'Reputação VoC (Google Maps 50+ avaliações)',
      'Mídia Paga (Facebook / Instagram)',
      'Vídeo & Áudio (YouTube + TikTok)',
      'Inteligência de Demanda (AnswerThePublic)',
      'Presença LinkedIn (empresa)',
    ],
    cost: 'Gratuito — $5 USD/mês (créditos inclusos) ≈ 55 diagnósticos completos',
    status: 'free',
    setupUrl: 'https://console.apify.com/account/integrations',
    setupSteps: [
      'Acesse console.apify.com com sua conta beto.freedesks@gmail.com',
      'Vá em Settings → Integrations → API tokens',
      'Clique em "Create new token" e copie o token gerado',
      'Cole aqui — substitui SimilarWeb, SEMrush, Ahrefs, Apollo e outras APIs pagas',
      'Crédito gratuito de $5/mês incluso — sem cartão necessário para uso básico',
    ],
    placeholder: 'apify_api_...',
    isPassword: true,
  },
  // ── Claude / Anthropic API (análise LLM de Jornada de Checkout) ──────────
  {
    key: 'claudeApiKey',
    label: 'Claude / Anthropic API Key',
    category: 'Análise com IA',
    subdimensions: ['Jornada de Checkout'],
    cost: 'Pago — claude-haiku ~$0.001/diagnóstico. Primeiro $5 grátis com cartão.',
    status: 'paid',
    setupUrl: 'https://console.anthropic.com/account/keys',
    setupSteps: [
      'Acesse console.anthropic.com e crie uma conta',
      'Vá em API Keys e clique em "Create Key"',
      'Copie a chave (começa com "sk-ant-...")',
      'Cole aqui — análise especialista de UX/CRO/Checkout com Claude Haiku',
      'Opcional: sem a chave, a análise de checkout usa lógica estática como fallback',
    ],
    placeholder: 'sk-ant-api03-...',
    isPassword: true,
  },
];

const CATEGORY_ORDER = [
  'Scrapers & Automação',
  'Análise com IA',
  'Performance & Tracking',
  'Reputação Digital',
  'Mídia Paga',
  'SEO Off-Page',
];

const STATUS_CONFIG = {
  free: { label: 'GRATUITO', color: '#00cc66' },
  free_limited: { label: 'GRATUITO*', color: '#00cc66' },
  paid: { label: 'PAGO', color: '#ff9900' },
  unavailable: { label: 'INDISPONÍVEL', color: '#ff4d4d' },
};

function IntegrationCard({
  integration,
  value,
  onChange,
}: {
  integration: Integration;
  value: string;
  onChange: (val: string) => void;
}) {
  const [showSetup, setShowSetup] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasValue = value.trim().length > 0;
  const statusCfg = STATUS_CONFIG[integration.status];

  return (
    <div
      className="ivoire-card"
      style={{
        padding: '20px 24px',
        borderColor: hasValue ? 'rgba(0,204,102,0.2)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="font-montserrat" style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {integration.label}
            </span>
            <span style={{
              fontSize: 8, fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
              color: statusCfg.color, border: `1px solid ${statusCfg.color}40`,
              borderRadius: 2, padding: '1px 5px', letterSpacing: 0.5,
            }}>
              {statusCfg.label}
            </span>
            {hasValue && (
              <span style={{
                fontSize: 8, fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
                color: '#00cc66', border: '1px solid rgba(0,204,102,0.3)',
                borderRadius: 2, padding: '1px 5px', letterSpacing: 0.5,
              }}>
                CONFIGURADO
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#666', fontFamily: 'Arvo, serif', margin: 0 }}>
            {integration.cost}
          </p>
          <p style={{ fontSize: 11, color: '#555', fontFamily: 'Montserrat, sans-serif', margin: '4px 0 0', letterSpacing: 0.3 }}>
            Ativa: {integration.subdimensions.join(', ')}
          </p>
        </div>

        <a
          href={integration.setupUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 10, color: '#FFFF02', fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700, letterSpacing: 0.5, textDecoration: 'none',
            border: '1px solid rgba(255,255,2,0.3)', borderRadius: 3,
            padding: '4px 8px', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          Configurar ↗
        </a>
      </div>

      {/* Input */}
      {integration.status !== 'unavailable' && (
        <div style={{ position: 'relative' }}>
          <input
            type={integration.isPassword && !visible ? 'password' : 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={integration.placeholder}
            disabled={integration.status === 'paid' && !hasValue}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${hasValue ? 'rgba(0,204,102,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 4,
              padding: '8px 36px 8px 12px',
              color: hasValue ? '#fff' : '#555',
              fontSize: 12,
              fontFamily: 'Major Mono Display, monospace',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {integration.isPassword && value && (
            <button
              onClick={() => setVisible((v) => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12,
              }}
            >
              {visible ? '🙈' : '👁'}
            </button>
          )}
        </div>
      )}

      {/* Setup steps toggle */}
      <button
        onClick={() => setShowSetup((s) => !s)}
        style={{
          background: 'none', border: 'none', color: '#555', fontSize: 10,
          fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 0.5,
          cursor: 'pointer', marginTop: 8, padding: 0, textDecoration: 'underline',
        }}
      >
        {showSetup ? '▲ Ocultar instruções' : '▼ Ver como configurar'}
      </button>

      {showSetup && (
        <ol style={{ margin: '10px 0 0', paddingLeft: 18 }}>
          {integration.setupSteps.map((step, i) => (
            <li key={i} style={{ fontSize: 11, color: '#777', fontFamily: 'Arvo, serif', marginBottom: 4, lineHeight: 1.5 }}>
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings } = useAppStore();
  const [saved, setSaved] = useState(false);
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });

  const handleChange = (key: keyof AppSettings, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const categorized = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: INTEGRATIONS.filter((i) => i.category === cat),
  })).filter((c) => c.items.length > 0);

  const configuredCount = INTEGRATIONS.filter((i) => localSettings[i.key]?.trim()).length;
  const freeTotal = INTEGRATIONS.filter((i) => i.status === 'free' || i.status === 'free_limited').length;

  return (
    <div style={{ minHeight: '100vh', background: '#282828', padding: '48px 48px 80px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div className="ivoire-tag" style={{ marginBottom: 16 }}>Configurações</div>
        <h1 className="font-bebas" style={{ fontSize: 42, color: '#fff', margin: 0, letterSpacing: 2 }}>
          Integrações de <span style={{ color: '#FFFF02' }}>Dados Reais</span>
        </h1>
        <p style={{ color: '#666', marginTop: 8, fontSize: 14, fontFamily: 'Arvo, serif' }}>
          Configure as APIs para garantir dados 100% reais em cada subdimensão.
          Sem estimativas — sem dados aleatórios.
        </p>
      </div>

      {/* Summary card */}
      <div className="ivoire-card" style={{ padding: '20px 24px', marginBottom: 36, borderColor: 'rgba(255,255,2,0.15)' }}>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="font-bebas" style={{ fontSize: 36, color: '#FFFF02', letterSpacing: 2 }}>
              {configuredCount}/{INTEGRATIONS.length}
            </div>
            <div style={{ fontSize: 10, color: '#666', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              Integrações configuradas
            </div>
          </div>
          <div>
            <div className="font-bebas" style={{ fontSize: 36, color: '#00cc66', letterSpacing: 2 }}>
              {freeTotal}
            </div>
            <div style={{ fontSize: 10, color: '#666', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              APIs 100% gratuitas disponíveis
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              style={{
                background: saved ? 'rgba(0,204,102,0.15)' : 'rgba(255,255,2,0.1)',
                border: `1px solid ${saved ? 'rgba(0,204,102,0.4)' : 'rgba(255,255,2,0.3)'}`,
                color: saved ? '#00cc66' : '#FFFF02',
                padding: '10px 24px',
                borderRadius: 4,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {saved ? '✓ Salvo' : 'Salvar configurações'}
            </button>
          </div>
        </div>
      </div>

      {/* Integration groups */}
      {categorized.map(({ category, items }) => (
        <div key={category} style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 className="font-montserrat" style={{ fontSize: 11, fontWeight: 700, color: '#FFFF02', letterSpacing: 2, margin: 0, textTransform: 'uppercase' }}>
              {category}
            </h2>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((integration) => (
              <IntegrationCard
                key={integration.key}
                integration={integration}
                value={localSettings[integration.key] ?? ''}
                onChange={(val) => handleChange(integration.key, val)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Save button (bottom) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button
          onClick={handleSave}
          style={{
            background: saved ? 'rgba(0,204,102,0.15)' : '#FFFF02',
            border: 'none',
            color: saved ? '#00cc66' : '#282828',
            padding: '12px 32px',
            borderRadius: 4,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 1,
            cursor: 'pointer',
          }}
        >
          {saved ? '✓ Configurações salvas' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
