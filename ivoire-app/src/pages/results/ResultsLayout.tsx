import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/store';
import { LEVEL_CONFIG } from '../../data/scorecard';
import { exportToDOCX } from '../../services/export/docx';
import { exportToPPTX } from '../../services/export/pptx';
import OverviewPage from './OverviewPage';
import DimensionPage from './DimensionPage';
import InsightsPage from './InsightsPage';
import RecommendationsPage from './RecommendationsPage';
import type { DimensionKey } from '../../types';

type TabKey = 'overview' | 'CONTEUDO' | 'CANAIS' | 'CONVERSAO' | 'CONTROLE' | 'insights' | 'recommendations';

interface Tab {
  key: TabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'CONTEUDO', label: 'Conteúdo' },
  { key: 'CANAIS', label: 'Canais' },
  { key: 'CONVERSAO', label: 'Conversão' },
  { key: 'CONTROLE', label: 'Controle' },
  { key: 'insights', label: 'Insights' },
  { key: 'recommendations', label: 'Recomendações' },
];

const DIMENSION_TABS: TabKey[] = ['CONTEUDO', 'CANAIS', 'CONVERSAO', 'CONTROLE'];

export default function ResultsLayout() {
  const { id: diagnosticId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDiagnostic } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isExporting, setIsExporting] = useState<'docx' | 'pptx' | null>(null);

  const diagnostic = diagnosticId ? getDiagnostic(diagnosticId) : undefined;

  if (!diagnostic) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 16,
          color: '#999',
        }}
      >
        <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 16 }}>
          Diagnóstico não encontrado.
        </p>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          Voltar ao Início
        </button>
      </div>
    );
  }

  const overallScore = diagnostic.overallScore ?? 0;
  const overallLevel = diagnostic.overallLevel ?? 'Intuitivo';
  const levelCfg = LEVEL_CONFIG[overallLevel];

  async function handleExportDOCX() {
    if (!diagnostic || isExporting) return;
    setIsExporting('docx');
    try {
      await exportToDOCX(diagnostic);
    } finally {
      setIsExporting(null);
    }
  }

  async function handleExportPPTX() {
    if (!diagnostic || isExporting) return;
    setIsExporting('pptx');
    try {
      await exportToPPTX(diagnostic);
    } finally {
      setIsExporting(null);
    }
  }

  function renderContent() {
    if (activeTab === 'overview') return <OverviewPage diagnostic={diagnostic!} />;
    if (DIMENSION_TABS.includes(activeTab)) {
      return <DimensionPage diagnostic={diagnostic!} dimensionKey={activeTab as DimensionKey} />;
    }
    if (activeTab === 'insights') return <InsightsPage diagnostic={diagnostic!} />;
    if (activeTab === 'recommendations') return <RecommendationsPage diagnostic={diagnostic!} />;
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#282828' }}>
      {/* Results Header */}
      <div
        style={{
          background: 'rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '24px 48px 0',
        }}
      >
        {/* Top row: company + actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          {/* Company info + score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div>
              <div className="ivoire-tag" style={{ marginBottom: 8 }}>
                Diagnóstico Concluído
              </div>
              <h1
                className="font-montserrat"
                style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}
              >
                {diagnostic.input.companyName}
              </h1>
              <p style={{ color: '#666', fontSize: 12, margin: '4px 0 0', fontFamily: 'Arvo, serif' }}>
                {diagnostic.input.siteUrl} · {diagnostic.input.segment}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: '#666', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                  Score
                </div>
                <span
                  className="font-bebas"
                  style={{ fontSize: 36, color: '#FFFF02', lineHeight: 1 }}
                >
                  {overallScore.toFixed(1)}
                </span>
                <span style={{ fontSize: 16, color: '#555', fontFamily: 'Bebas Neue, cursive' }}>/4.0</span>
              </div>
              <div
                style={{
                  width: 1,
                  height: 40,
                  background: 'rgba(255,255,255,0.1)',
                }}
              />
              <div>
                <div style={{ fontSize: 10, color: '#666', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                  Nível
                </div>
                <span
                  className={`font-montserrat level-${overallLevel.toLowerCase()}`}
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                  }}
                >
                  {overallLevel}
                </span>
                <p style={{ fontSize: 10, color: '#666', margin: '2px 0 0', fontFamily: 'Arvo, serif', maxWidth: 140 }}>
                  {levelCfg?.shortDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button
              className="btn-secondary"
              onClick={handleExportDOCX}
              disabled={isExporting !== null}
              style={{ fontSize: 13, padding: '10px 18px' }}
            >
              {isExporting === 'docx' ? (
                <span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
              ) : (
                '↓'
              )}
              DOCX
            </button>
            <button
              className="btn-secondary"
              onClick={handleExportPPTX}
              disabled={isExporting !== null}
              style={{ fontSize: 13, padding: '10px 18px' }}
            >
              {isExporting === 'pptx' ? (
                <span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
              ) : (
                '↓'
              )}
              PPTX
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <nav style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="font-montserrat"
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #FFFF02' : '2px solid transparent',
                  color: isActive ? '#FFFF02' : '#666',
                  fontFamily: 'Montserrat, sans-serif',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease, border-color 0.2s ease',
                  marginBottom: -1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = '#ccc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = '#666';
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div style={{ padding: '40px 48px' }}>
        {renderContent()}
      </div>
    </div>
  );
}
