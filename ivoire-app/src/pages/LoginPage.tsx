import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAppStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha para continuar.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const success = await login(email.trim(), password);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Acesso negado. Use um email @ivoire.ag válido.');
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#282828',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left panel — branding */}
      <div
        style={{
          width: '45%',
          background: 'rgba(0,0,0,0.5)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative background grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,2,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,2,0.03) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            pointerEvents: 'none',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #FFFF02, rgba(255,255,2,0.1))',
          }}
        />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="font-montserrat"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#595959',
              letterSpacing: '3px',
              marginBottom: '48px',
            }}
          >
            IVOIRE.COM.BR
          </div>

          <div
            className="font-montserrat"
            style={{
              fontSize: '72px',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 0.9,
              letterSpacing: '-1px',
            }}
          >
            IVOIRE
          </div>
          <div
            className="font-montserrat"
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#FFFF02',
              letterSpacing: '6px',
              marginTop: '8px',
            }}
          >
            GROWTH SCAN
          </div>
          <div
            style={{
              fontFamily: 'Arvo, serif',
              fontSize: '15px',
              fontStyle: 'italic',
              color: '#999999',
              marginTop: '6px',
              letterSpacing: '0.5px',
            }}
          >
            LIGHT
          </div>

          <div
            style={{
              height: '2px',
              background: 'linear-gradient(90deg, #FFFF02, transparent)',
              width: '80px',
              marginTop: '28px',
              marginBottom: '24px',
            }}
          />

          <p
            style={{
              fontFamily: 'Arvo, serif',
              fontSize: '14px',
              color: '#999999',
              lineHeight: 1.7,
              maxWidth: '340px',
              margin: 0,
            }}
          >
            A primeira Marketing Growth Company do Brasil.
            <br />
            Diagnóstico de maturidade digital baseado no{' '}
            <span style={{ color: '#FFFF02', fontStyle: 'italic' }}>Framework 4Cs Ivoire</span>.
          </p>
        </div>

        {/* Maturity levels legend */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontSize: '9px',
              fontFamily: 'Montserrat',
              fontWeight: 700,
              color: '#595959',
              letterSpacing: '2px',
              marginBottom: '14px',
            }}
          >
            NÍVEIS DE MATURIDADE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { name: 'Intuitivo', color: '#ff4d4d', range: '1.0 – 1.74' },
              { name: 'Reativo', color: '#ff9900', range: '1.75 – 2.49' },
              { name: 'Ativo', color: '#00cc66', range: '2.50 – 3.24' },
              { name: 'Exponencial', color: '#FFFF02', range: '3.25 – 4.00' },
            ].map((lvl) => (
              <div key={lvl.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: lvl.color,
                    boxShadow: `0 0 6px ${lvl.color}80`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'Montserrat',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: lvl.color,
                    letterSpacing: '0.5px',
                    width: '90px',
                  }}
                >
                  {lvl.name}
                </span>
                <span
                  className="font-mono-display"
                  style={{
                    fontSize: '10px',
                    color: '#595959',
                  }}
                >
                  {lvl.range}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 64px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '380px' }}>
          {/* Form header */}
          <div style={{ marginBottom: '40px' }}>
            <div
              className="font-montserrat"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#FFFF02',
                letterSpacing: '3px',
                marginBottom: '12px',
              }}
            >
              ACESSO AO SISTEMA
            </div>
            <h1
              className="font-montserrat"
              style={{
                fontSize: '28px',
                fontWeight: 800,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Entre na sua conta
            </h1>
            <p
              style={{
                fontFamily: 'Arvo, serif',
                fontSize: '13px',
                color: '#999999',
                marginTop: '8px',
                lineHeight: 1.5,
              }}
            >
              Restrito a consultores Ivoire autorizados.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontFamily: 'Montserrat',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#999999',
                  letterSpacing: '1.5px',
                  marginBottom: '8px',
                }}
              >
                EMAIL
              </label>
              <input
                id="email"
                type="email"
                className="ivoire-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@ivoire.ag"
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontFamily: 'Montserrat',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#999999',
                  letterSpacing: '1.5px',
                  marginBottom: '8px',
                }}
              >
                SENHA
              </label>
              <input
                id="password"
                type="password"
                className="ivoire-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {/* Error state */}
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(255,77,77,0.08)',
                  border: '1px solid rgba(255,77,77,0.3)',
                  borderRadius: '4px',
                  fontFamily: 'Arvo, serif',
                  fontSize: '13px',
                  color: '#ff4d4d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: '13px' }}
            >
              {loading ? (
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
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div
            style={{
              marginTop: '32px',
              padding: '16px',
              background: 'rgba(255,255,2,0.04)',
              border: '1px solid rgba(255,255,2,0.1)',
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                fontSize: '9px',
                fontFamily: 'Montserrat',
                fontWeight: 700,
                color: '#FFFF02',
                letterSpacing: '1.5px',
                marginBottom: '8px',
              }}
            >
              ACESSO DEMO
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
              Use qualquer email{' '}
              <span style={{ color: '#FFFF02', fontWeight: 700 }}>@ivoire.ag</span>
              <br />
              Demo:{' '}
              <span style={{ color: '#B7B7B7' }}>demo@ivoire.ag</span>{' '}
              / qualquer senha
            </p>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: '40px',
              textAlign: 'center',
              fontFamily: 'Arvo, serif',
              fontSize: '11px',
              color: '#595959',
            }}
          >
            Ivoire Growth Company &copy; {new Date().getFullYear()}
            <br />
            <span style={{ fontSize: '10px' }}>Uso restrito a colaboradores autorizados</span>
          </div>
        </div>
      </div>
    </div>
  );
}
