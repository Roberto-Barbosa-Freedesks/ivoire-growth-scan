import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/store';
import { SEGMENTS } from '../data/scorecard';
import type { DiagnosticInput } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1
  companyName: string;
  segment: string;
  geography: 'nacional' | 'regional';
  geographyDetail: string;
  siteUrl: string;
  isEcommerce: boolean;
  // Step 2
  linkedIn: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  competitorInput: string;
  competitors: string[];
  additionalSiteInput: string;
  additionalSites: string[];
  // Step 3
  contextNotes: string;
}

const INITIAL_FORM: FormData = {
  companyName: '',
  segment: '',
  geography: 'nacional',
  geographyDetail: '',
  siteUrl: '',
  isEcommerce: false,
  linkedIn: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  competitorInput: '',
  competitors: [],
  additionalSiteInput: '',
  additionalSites: [],
  contextNotes: '',
};

const TOTAL_STEPS = 3;

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({
  children,
  required,
  helper,
}: {
  children: React.ReactNode;
  required?: boolean;
  helper?: string;
}) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <label
        style={{
          fontFamily: 'Montserrat',
          fontSize: '10px',
          fontWeight: 700,
          color: '#999999',
          letterSpacing: '1.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {children}
        {required && (
          <span style={{ color: '#FFFF02', fontSize: '12px', lineHeight: 1 }}>*</span>
        )}
      </label>
      {helper && (
        <p
          style={{
            fontFamily: 'Arvo, serif',
            fontSize: '11px',
            color: '#777',
            margin: '4px 0 0',
            lineHeight: 1.4,
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

function StepProgressBar({
  currentStep,
}: {
  currentStep: number;
}) {
  const steps = [
    { label: 'Dados Básicos', icon: '01' },
    { label: 'Canais Digitais', icon: '02' },
    { label: 'Contexto', icon: '03' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        marginBottom: '40px',
      }}
    >
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const color = isCompleted
          ? '#00cc66'
          : isActive
          ? '#FFFF02'
          : '#777';

        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: idx < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div
                className="font-bebas"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: `2px solid ${color}`,
                  background: isActive ? 'rgba(255,255,2,0.08)' : isCompleted ? 'rgba(0,204,102,0.08)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color,
                  flexShrink: 0,
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? `0 0 12px rgba(255,255,2,0.2)` : 'none',
                }}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              <div
                style={{
                  fontFamily: 'Montserrat',
                  fontSize: '10px',
                  fontWeight: 700,
                  color,
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </div>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  background: isCompleted
                    ? '#00cc66'
                    : 'rgba(255,255,255,0.08)',
                  margin: '0 12px',
                  marginBottom: '22px',
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TagList({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (item: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
      {items.map((item) => (
        <span
          key={item}
          className="ivoire-tag"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(item)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: '0',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: '12px',
        marginBottom: '24px',
      }}
    >
      <h2
        className="font-montserrat"
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#FFFF02',
          margin: 0,
          letterSpacing: '2px',
        }}
      >
        {children}
      </h2>
    </div>
  );
}

// ─── Step 1: Dados Básicos ────────────────────────────────────────────────────

function Step1({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <SectionHeader>DADOS BÁSICOS DA EMPRESA</SectionHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <FieldLabel required helper="Nome comercial ou razão social da empresa analisada.">
            NOME DA EMPRESA
          </FieldLabel>
          <input
            className="ivoire-input"
            type="text"
            value={form.companyName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange({ companyName: e.target.value })
            }
            placeholder="Ex: Natura, Nubank, Magazine Luiza..."
          />
        </div>

        <div>
          <FieldLabel required helper="Setor primário de atuação da empresa.">
            SEGMENTO
          </FieldLabel>
          <div style={{ position: 'relative' }}>
            <select
              className="ivoire-select"
              value={form.segment}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onChange({ segment: e.target.value })
              }
            >
              <option value="">Selecione o segmento...</option>
              {SEGMENTS.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
            <div
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#aaa',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <FieldLabel helper="Abrangência geográfica das operações de marketing digital.">
            ABRANGÊNCIA GEOGRÁFICA
          </FieldLabel>
          <div style={{ position: 'relative' }}>
            <select
              className="ivoire-select"
              value={form.geography}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onChange({ geography: e.target.value as 'nacional' | 'regional' })
              }
            >
              <option value="nacional">Nacional</option>
              <option value="regional">Regional</option>
            </select>
            <div
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#aaa',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        {form.geography === 'regional' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <FieldLabel helper="Especifique o estado(s) ou região de atuação.">
              DETALHE DA REGIÃO
            </FieldLabel>
            <input
              className="ivoire-input"
              type="text"
              value={form.geographyDetail}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ geographyDetail: e.target.value })
              }
              placeholder="Ex: São Paulo, Sul do Brasil, Nordeste..."
            />
          </div>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <FieldLabel required helper="URL principal do site institucional ou e-commerce. Inclua https://.">
            URL DO SITE PRINCIPAL
          </FieldLabel>
          <input
            className="ivoire-input"
            type="url"
            value={form.siteUrl}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange({ siteUrl: e.target.value })
            }
            placeholder="https://www.empresa.com.br"
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '16px',
              background: form.isEcommerce
                ? 'rgba(255,255,2,0.06)'
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${form.isEcommerce ? 'rgba(255,255,2,0.2)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: `2px solid ${form.isEcommerce ? '#FFFF02' : 'rgba(255,255,255,0.2)'}`,
                background: form.isEcommerce ? '#FFFF02' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              {form.isEcommerce && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#282828" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <input
              type="checkbox"
              checked={form.isEcommerce}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onChange({ isEcommerce: e.target.checked })
              }
              style={{ display: 'none' }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'Montserrat',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: form.isEcommerce ? '#FFFF02' : '#ffffff',
                }}
              >
                Possui E-commerce
              </div>
              <div
                style={{
                  fontFamily: 'Arvo, serif',
                  fontSize: '11px',
                  color: '#777',
                  marginTop: '2px',
                }}
              >
                Habilita subdimensões de Marketplace e Jornada de Checkout no diagnóstico.
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Canais Digitais ──────────────────────────────────────────────────

function Step2({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
}) {
  const handleAddCompetitor = () => {
    const val = form.competitorInput.trim();
    if (val && !form.competitors.includes(val)) {
      onChange({ competitors: [...form.competitors, val], competitorInput: '' });
    }
  };

  const handleAddSite = () => {
    const val = form.additionalSiteInput.trim();
    if (val && !form.additionalSites.includes(val)) {
      onChange({ additionalSites: [...form.additionalSites, val], additionalSiteInput: '' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Social profiles */}
      <div>
        <SectionHeader>PERFIS EM REDES SOCIAIS</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {[
            {
              key: 'linkedIn' as const,
              label: 'LINKEDIN',
              placeholder: 'https://linkedin.com/company/empresa',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              ),
            },
            {
              key: 'instagram' as const,
              label: 'INSTAGRAM',
              placeholder: 'https://instagram.com/empresa',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              ),
            },
            {
              key: 'tiktok' as const,
              label: 'TIKTOK',
              placeholder: 'https://tiktok.com/@empresa',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.13a8.17 8.17 0 0 0 4.78 1.53V7.21a4.85 4.85 0 0 1-1.01-.52z" />
                </svg>
              ),
            },
            {
              key: 'youtube' as const,
              label: 'YOUTUBE',
              placeholder: 'https://youtube.com/@empresa',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.42C1 8.14 1 12 1 12s0 3.86.46 5.58a2.78 2.78 0 0 0 1.94 1.96C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96C23 15.86 23 12 23 12s0-3.86-.46-5.58z" />
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#282828" />
                </svg>
              ),
            },
          ].map((field) => (
            <div key={field.key}>
              <FieldLabel>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#777' }}>{field.icon}</span>
                  {field.label}
                </span>
              </FieldLabel>
              <input
                className="ivoire-input"
                type="url"
                value={form[field.key]}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  onChange({ [field.key]: e.target.value })
                }
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Competitors */}
      <div>
        <SectionHeader>CONCORRENTES DIRETOS</SectionHeader>
        <FieldLabel helper="Adicione URLs ou nomes dos principais concorrentes para benchmarking. Pressione Enter ou clique em Adicionar.">
          CONCORRENTES
        </FieldLabel>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            className="ivoire-input"
            type="text"
            value={form.competitorInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange({ competitorInput: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCompetitor();
              }
            }}
            placeholder="www.concorrente.com.br"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleAddCompetitor}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Adicionar
          </button>
        </div>
        <TagList
          items={form.competitors}
          onRemove={(item) =>
            onChange({ competitors: form.competitors.filter((c) => c !== item) })
          }
        />
      </div>

      {/* Additional sites */}
      <div>
        <SectionHeader>SITES ADICIONAIS</SectionHeader>
        <FieldLabel helper="Landing pages, blogs, portais regionais, subdomínios relevantes da marca.">
          OUTROS SITES DA MARCA
        </FieldLabel>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            className="ivoire-input"
            type="text"
            value={form.additionalSiteInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange({ additionalSiteInput: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSite();
              }
            }}
            placeholder="blog.empresa.com.br"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleAddSite}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Adicionar
          </button>
        </div>
        <TagList
          items={form.additionalSites}
          onRemove={(item) =>
            onChange({
              additionalSites: form.additionalSites.filter((s) => s !== item),
            })
          }
        />
      </div>
    </div>
  );
}

// ─── Step 3: Contexto Qualitativo ─────────────────────────────────────────────

function Step3({
  form,
  onChange,
}: {
  form: FormData;
  onChange: (updates: Partial<FormData>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <SectionHeader>CONTEXTO QUALITATIVO</SectionHeader>
        <FieldLabel helper="Informações sobre o histórico de marketing, iniciativas recentes, desafios principais, orçamento aproximado ou objetivos estratégicos. Quanto mais contexto, mais preciso será o relatório.">
          NOTAS CONTEXTUAIS
        </FieldLabel>
        <textarea
          className="ivoire-input"
          value={form.contextNotes}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onChange({ contextNotes: e.target.value })
          }
          placeholder="Descreva o contexto do cliente: maturidade percebida, histórico de investimentos em marketing, desafios conhecidos, metas de crescimento, campanhas em andamento, ferramentas que já utilizam..."
          rows={6}
          style={{ resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      {/* Summary */}
      <div>
        <SectionHeader>RESUMO DO DIAGNÓSTICO</SectionHeader>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          {[
            { label: 'Empresa', value: form.companyName || '—' },
            { label: 'Segmento', value: form.segment || '—' },
            { label: 'Site Principal', value: form.siteUrl || '—' },
            {
              label: 'Abrangência',
              value:
                form.geography === 'regional'
                  ? `Regional${form.geographyDetail ? ` — ${form.geographyDetail}` : ''}`
                  : 'Nacional',
            },
            { label: 'E-commerce', value: form.isEcommerce ? 'Sim' : 'Não' },
            {
              label: 'Concorrentes',
              value:
                form.competitors.length > 0
                  ? `${form.competitors.length} cadastrado(s)`
                  : 'Nenhum',
            },
            {
              label: 'Canais Sociais',
              value:
                [form.linkedIn, form.instagram, form.tiktok, form.youtube]
                  .filter(Boolean).length + ' configurado(s)',
            },
            {
              label: 'Sites Adicionais',
              value:
                form.additionalSites.length > 0
                  ? `${form.additionalSites.length} cadastrado(s)`
                  : 'Nenhum',
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '9px',
                  fontFamily: 'Montserrat',
                  fontWeight: 700,
                  color: '#777',
                  letterSpacing: '1.5px',
                  marginBottom: '5px',
                }}
              >
                {item.label.toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: 'Arvo, serif',
                  fontSize: '13px',
                  color: '#ffffff',
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(255,255,2,0.04)',
            border: '1px solid rgba(255,255,2,0.15)',
            borderRadius: '6px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ color: '#FFFF02', flexShrink: 0, marginTop: '1px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p
            style={{
              fontFamily: 'Arvo, serif',
              fontSize: '12px',
              color: '#999999',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Ao confirmar, o sistema iniciará a <strong style={{ color: '#FFFF02' }}>coleta automatizada</strong> de dados públicos do site, redes sociais e concorrentes cadastrados. Este processo pode levar alguns minutos.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NewDiagnosticPage() {
  const navigate = useNavigate();
  const { createDiagnostic } = useAppStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (updates: Partial<FormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    // Clear errors for changed fields
    const clearedErrors = { ...errors };
    Object.keys(updates).forEach((k) => delete clearedErrors[k]);
    setErrors(clearedErrors);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.companyName.trim()) {
        newErrors.companyName = 'Nome da empresa é obrigatório.';
      }
      if (!form.siteUrl.trim()) {
        newErrors.siteUrl = 'URL do site é obrigatória.';
      } else if (
        !form.siteUrl.startsWith('http://') &&
        !form.siteUrl.startsWith('https://')
      ) {
        newErrors.siteUrl = 'URL deve começar com http:// ou https://';
      }
      if (!form.segment) {
        newErrors.segment = 'Selecione o segmento de atuação.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setSubmitting(true);
    try {
      const input: DiagnosticInput = {
        companyName: form.companyName.trim(),
        segment: form.segment,
        geography: form.geography,
        geographyDetail: form.geographyDetail.trim() || undefined,
        siteUrl: form.siteUrl.trim(),
        linkedIn: form.linkedIn.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        tiktok: form.tiktok.trim() || undefined,
        youtube: form.youtube.trim() || undefined,
        competitors: form.competitors.length > 0 ? form.competitors : undefined,
        additionalSites:
          form.additionalSites.length > 0 ? form.additionalSites : undefined,
        contextNotes: form.contextNotes.trim() || undefined,
        isEcommerce: form.isEcommerce,
      };

      const id = createDiagnostic(input);
      navigate(`/diagnostic/${id}/collecting`);
    } catch (err) {
      console.error('Error creating diagnostic:', err);
      setSubmitting(false);
    }
  };

  const hasStepError = Object.keys(errors).length > 0;

  return (
    <div style={{ padding: '40px 48px', minHeight: '100%' }}>
      {/* Page header */}
      <div style={{ marginBottom: '40px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            color: '#777',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'Montserrat',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            padding: 0,
            marginBottom: '20px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FFFF02')}
          onMouseLeave={e => (e.currentTarget.style.color = '#777')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Voltar ao Dashboard
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h1
            className="font-montserrat"
            style={{
              fontSize: '28px',
              fontWeight: 900,
              color: '#ffffff',
              margin: 0,
            }}
          >
            NOVO DIAGNÓSTICO
          </h1>
          <span className="ivoire-tag">Framework 4Cs</span>
        </div>
        <p
          style={{
            fontFamily: 'Arvo, serif',
            fontSize: '14px',
            color: '#999999',
            margin: '8px 0 0',
          }}
        >
          Preencha as informações da empresa para iniciar o diagnóstico de maturidade digital.
        </p>
      </div>

      {/* Form container */}
      <div style={{ maxWidth: '800px' }}>
        <StepProgressBar currentStep={currentStep} />

        {/* Step content */}
        <div
          className="ivoire-card"
          style={{ padding: '40px', marginBottom: '24px' }}
        >
          {currentStep === 1 && (
            <Step1 form={form} onChange={handleChange} />
          )}
          {currentStep === 2 && (
            <Step2 form={form} onChange={handleChange} />
          )}
          {currentStep === 3 && (
            <Step3 form={form} onChange={handleChange} />
          )}
        </div>

        {/* Validation errors summary */}
        {hasStepError && (
          <div
            style={{
              padding: '14px 18px',
              background: 'rgba(255,77,77,0.06)',
              border: '1px solid rgba(255,77,77,0.25)',
              borderRadius: '6px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {Object.values(errors).map((err, i) => (
              <div
                key={i}
                style={{
                  fontFamily: 'Arvo, serif',
                  fontSize: '12px',
                  color: '#ff4d4d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {err}
              </div>
            ))}
          </div>
        )}

        {/* Navigation buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBack}
                disabled={submitting}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Voltar
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Step indicator */}
            <span
              className="font-mono-display"
              style={{ fontSize: '11px', color: '#777' }}
            >
              {currentStep} / {TOTAL_STEPS}
            </span>

            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleNext}
              >
                Próximo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span
                      className="spin"
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(40,40,40,0.3)',
                        borderTop: '2px solid #282828',
                        borderRadius: '50%',
                        display: 'inline-block',
                      }}
                    />
                    Criando...
                  </>
                ) : (
                  <>
                    Iniciar Diagnóstico
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: '64px' }} />
    </div>
  );
}
