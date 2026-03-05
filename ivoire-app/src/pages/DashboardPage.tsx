import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/store';
import type { Diagnostic, MaturityLevel } from '../types';
import LevelBadge from '../components/ui/LevelBadge';

const LEVEL_COLOR: Record<MaturityLevel, string> = {
  Intuitivo: '#ff4d4d',
  Reativo: '#ff9900',
  Ativo: '#00cc66',
  Exponencial: '#FFFF02',
};

const STATUS_LABEL: Record<Diagnostic['status'], string> = {
  draft: 'Rascunho',
  collecting: 'Coletando',
  manual_input: 'Input Manual',
  processing: 'Processando',
  completed: 'Concluído',
};

const STATUS_COLOR: Record<Diagnostic['status'], string> = {
  draft: '#595959',
  collecting: '#FFFF02',
  manual_input: '#ff9900',
  processing: '#00aaff',
  completed: '#00cc66',
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'BOM DIA';
  if (h < 18) return 'BOA TARDE';
  return 'BOA NOITE';
}

function getAverageLevel(diagnostics: Diagnostic[]): MaturityLevel | null {
  const completed = diagnostics.filter((d) => d.status === 'completed' && d.overallScore);
  if (completed.length === 0) return null;
  const avg = completed.reduce((s, d) => s + (d.overallScore ?? 1), 0) / completed.length;
  if (avg >= 3.25) return 'Exponencial';
  if (avg >= 2.5) return 'Ativo';
  if (avg >= 1.75) return 'Reativo';
  return 'Intuitivo';
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  color?: string;
}

function StatCard({ label, value, sub, accent, color }: StatCardProps) {
  return (
    <div
      className="ivoire-card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        borderColor: accent ? 'rgba(255,255,2,0.2)' : undefined,
      }}
    >
      <div
        style={{
          fontSize: '9px',
          fontFamily: 'Montserrat',
          fontWeight: 700,
          color: '#595959',
          letterSpacing: '1.5px',
        }}
      >
        {label}
      </div>
      <div
        className="font-bebas"
        style={{
          fontSize: '42px',
          lineHeight: 1,
          color: color || (accent ? '#FFFF02' : '#ffffff'),
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: '11px',
            color: '#595959',
            fontFamily: 'Arvo',
            marginTop: '2px',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
}

function DeleteButton({ onClick }: DeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Excluir diagnóstico"
      style={{
        background: 'transparent',
        border: '1px solid rgba(255,77,77,0.2)',
        borderRadius: '4px',
        padding: '6px 10px',
        color: 'rgba(255,77,77,0.6)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,77,77,0.6)';
        (e.currentTarget as HTMLButtonElement).style.color = '#ff4d4d';
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,77,77,0.08)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,77,77,0.2)';
        (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,77,77,0.6)';
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4h6v2" />
      </svg>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, diagnostics, deleteDiagnostic } = useAppStore();

  const completed = diagnostics.filter((d) => d.status === 'completed');
  const inProgress = diagnostics.filter((d) =>
    ['draft', 'collecting', 'manual_input', 'processing'].includes(d.status)
  );
  const avgLevel = getAverageLevel(diagnostics);

  const handleDiagnosticClick = (diag: Diagnostic) => {
    if (diag.status === 'completed') {
      navigate(`/diagnostic/${diag.id}/results`);
    } else if (diag.status === 'collecting') {
      navigate(`/diagnostic/${diag.id}/collecting`);
    } else {
      navigate(`/diagnostic/${diag.id}/manual`);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este diagnóstico?')) {
      deleteDiagnostic(id);
    }
  };

  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const firstName = user?.name?.split(' ')[0] ?? 'Consultor';

  return (
    <div style={{ padding: '40px 48px', minHeight: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '40px',
        }}
      >
        <div>
          <div
            className="font-montserrat"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#FFFF02',
              letterSpacing: '3px',
              marginBottom: '6px',
            }}
          >
            {getGreeting()},
          </div>
          <h1
            className="font-montserrat"
            style={{
              fontSize: '36px',
              fontWeight: 900,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1,
            }}
          >
            {firstName.toUpperCase()}
          </h1>
          <div
            style={{
              fontFamily: 'Arvo, serif',
              fontSize: '13px',
              color: '#595959',
              marginTop: '8px',
              textTransform: 'capitalize',
            }}
          >
            {today}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => navigate('/diagnostic/new')}
          style={{ flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          NOVO DIAGNÓSTICO
        </button>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '40px',
        }}
      >
        <StatCard
          label="TOTAL DIAGNÓSTICOS"
          value={diagnostics.length}
          sub="desde o início"
          accent
        />
        <StatCard
          label="NÍVEL MÉDIO DA BASE"
          value={avgLevel ?? '—'}
          sub={avgLevel ? 'média ponderada' : 'sem dados suficientes'}
          color={avgLevel ? LEVEL_COLOR[avgLevel] : '#595959'}
        />
        <StatCard
          label="EM ANDAMENTO"
          value={inProgress.length}
          sub="aguardando conclusão"
          color="#ff9900"
        />
        <StatCard
          label="CONCLUÍDOS"
          value={completed.length}
          sub="com relatório gerado"
          color="#00cc66"
        />
      </div>

      <div className="ivoire-divider" />

      {/* Diagnostics list */}
      <div style={{ marginTop: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            className="font-montserrat"
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '1px',
            }}
          >
            DIAGNÓSTICOS
          </h2>
          {diagnostics.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                color: '#595959',
                fontFamily: 'Arvo',
              }}
            >
              {diagnostics.length} {diagnostics.length === 1 ? 'registro' : 'registros'}
            </span>
          )}
        </div>

        {diagnostics.length === 0 ? (
          /* Empty state */
          <div
            className="ivoire-card"
            style={{
              padding: '64px 40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                border: '1px solid rgba(255,255,2,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFF02" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.5}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <h3
              className="font-montserrat"
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
              }}
            >
              Nenhum diagnóstico ainda
            </h3>
            <p
              style={{
                fontFamily: 'Arvo, serif',
                fontSize: '14px',
                color: '#999999',
                margin: 0,
                maxWidth: '380px',
                lineHeight: 1.6,
              }}
            >
              Inicie o primeiro diagnóstico de maturidade digital para um cliente. O processo leva de 5 a 15 minutos.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/diagnostic/new')}
              style={{ marginTop: '8px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              INICIAR PRIMEIRO DIAGNÓSTICO
            </button>
          </div>
        ) : (
          /* Table-style list */
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto',
                gap: '16px',
                padding: '12px 24px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {['EMPRESA', 'SEGMENTO', 'STATUS', 'DATA', 'SCORE', ''].map((col, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '9px',
                    fontFamily: 'Montserrat',
                    fontWeight: 700,
                    color: '#595959',
                    letterSpacing: '1.5px',
                  }}
                >
                  {col}
                </div>
              ))}
            </div>

            {/* Rows */}
            {diagnostics.map((diag, idx) => (
              <div
                key={diag.id}
                onClick={() => handleDiagnosticClick(diag)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr auto',
                  gap: '16px',
                  padding: '16px 24px',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  borderBottom: idx < diagnostics.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  alignItems: 'center',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,2,0.04)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
                }}
              >
                {/* Company */}
                <div>
                  <div
                    className="font-montserrat"
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#ffffff',
                      marginBottom: '3px',
                    }}
                  >
                    {diag.input.companyName}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#595959',
                      fontFamily: 'Arvo',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    {diag.input.siteUrl}
                  </div>
                </div>

                {/* Segment */}
                <div
                  style={{
                    fontSize: '12px',
                    color: '#999999',
                    fontFamily: 'Arvo',
                  }}
                >
                  {diag.input.segment}
                </div>

                {/* Status */}
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '3px 10px',
                      borderRadius: '3px',
                      background: `${STATUS_COLOR[diag.status]}15`,
                      border: `1px solid ${STATUS_COLOR[diag.status]}30`,
                      fontFamily: 'Montserrat',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: STATUS_COLOR[diag.status],
                      letterSpacing: '0.5px',
                    }}
                  >
                    {diag.status === 'collecting' && (
                      <span
                        className="pulse-yellow"
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: STATUS_COLOR[diag.status],
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {STATUS_LABEL[diag.status]}
                  </span>
                </div>

                {/* Date */}
                <div
                  className="font-mono-display"
                  style={{
                    fontSize: '11px',
                    color: '#595959',
                  }}
                >
                  {formatDate(diag.createdAt)}
                </div>

                {/* Score */}
                <div>
                  {diag.status === 'completed' && diag.overallScore && diag.overallLevel ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        className="font-bebas"
                        style={{
                          fontSize: '24px',
                          color: LEVEL_COLOR[diag.overallLevel],
                          lineHeight: 1,
                        }}
                      >
                        {diag.overallScore.toFixed(1)}
                      </span>
                      <LevelBadge level={diag.overallLevel} size="sm" />
                    </div>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#595959',
                        fontFamily: 'Arvo',
                        fontStyle: 'italic',
                      }}
                    >
                      —
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleDiagnosticClick(diag)}
                    title="Abrir diagnóstico"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '6px 10px',
                      color: '#999999',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,2,0.4)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#FFFF02';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#999999';
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <DeleteButton onClick={(e) => handleDelete(e as unknown as React.MouseEvent, diag.id)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom padding */}
      <div style={{ height: '48px' }} />
    </div>
  );
}
