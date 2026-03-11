import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/store';
import { createVerificationCode, sendVerificationEmail, verifyCode } from '../services/emailVerification';

type AuthMode = 'login' | 'register_email' | 'register_verify' | 'register_password' | 'forgot_email' | 'forgot_verify' | 'forgot_reset';

const BASE_URL = import.meta.env.BASE_URL || '/';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isEmailRegistered, resetPassword, settings } = useAppStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [demoCodeVisible, setDemoCodeVisible] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function resetForm() {
    setEmail('');
    setName('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setError('');
    setSuccess('');
    setDemoCodeVisible('');
    setShowPassword(false);
  }

  function switchMode(m: AuthMode) {
    resetForm();
    setMode(m);
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha.');
      return;
    }
    if (!email.endsWith('@ivoire.ag')) {
      setError('Acesso restrito a emails @ivoire.ag.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const ok = await login(email.trim(), password);
      if (ok) {
        navigate('/dashboard');
      } else {
        setError('Email ou senha incorretos. Verifique seus dados.');
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Register Step 1: Email ─────────────────────────────────────────────────
  const handleRegisterEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Informe seu email.'); return; }
    if (!email.endsWith('@ivoire.ag')) { setError('Acesso restrito a emails @ivoire.ag.'); return; }
    if (!name.trim()) { setError('Informe seu nome.'); return; }

    setError('');
    setLoading(true);
    try {
      const code = createVerificationCode(email.trim());
      const { demoMode } = await sendVerificationEmail(
        email.trim(),
        code,
        settings.emailJSServiceId ? {
          serviceId: settings.emailJSServiceId,
          templateId: settings.emailJSTemplateId,
          publicKey: settings.emailJSPublicKey,
        } : undefined
      );

      if (demoMode) {
        setDemoCodeVisible(code);
        setSuccess(`Modo demo ativo. Código gerado: ${code}`);
      } else {
        setSuccess(`Código enviado para ${email}. Verifique sua caixa de entrada.`);
      }
      setMode('register_verify');
    } catch {
      setError('Erro ao enviar código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Register Step 2: Verify Code ───────────────────────────────────────────
  const handleVerifyCode = (e: FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) { setError('Informe o código de verificação.'); return; }
    const result = verifyCode(email.trim(), verificationCode.trim());
    if (result.valid) {
      setError('');
      setSuccess('Email verificado! Agora crie sua senha.');
      setMode(mode === 'register_verify' ? 'register_password' : 'forgot_reset');
    } else {
      setError(result.reason || 'Código inválido.');
    }
  };

  // ── Register Step 3: Set Password ──────────────────────────────────────────
  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setError('');
    setLoading(true);
    try {
      await register(email.trim(), name.trim(), password);
      const ok = await login(email.trim(), password);
      if (ok) {
        navigate('/dashboard');
      }
    } catch {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Step 1: Email ──────────────────────────────────────────
  const handleForgotEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Informe seu email.'); return; }
    if (!email.endsWith('@ivoire.ag')) { setError('Acesso restrito a emails @ivoire.ag.'); return; }
    if (!isEmailRegistered(email.trim())) {
      setError('Email não encontrado. Faça seu cadastro primeiro.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const code = createVerificationCode(email.trim());
      const { demoMode } = await sendVerificationEmail(
        email.trim(),
        code,
        settings.emailJSServiceId ? {
          serviceId: settings.emailJSServiceId,
          templateId: settings.emailJSTemplateId,
          publicKey: settings.emailJSPublicKey,
        } : undefined
      );
      if (demoMode) {
        setDemoCodeVisible(code);
        setSuccess(`Modo demo. Código: ${code}`);
      } else {
        setSuccess(`Código enviado para ${email}.`);
      }
      setMode('forgot_verify');
    } catch {
      setError('Erro ao enviar código.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Step 3: Reset ─────────────────────────────────────────
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }
    setError('');
    setLoading(true);
    try {
      const ok = await resetPassword(email.trim(), password);
      if (ok) {
        setSuccess('Senha redefinida com sucesso!');
        setTimeout(() => switchMode('login'), 1500);
      } else {
        setError('Erro ao redefinir senha.');
      }
    } catch {
      setError('Erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared resend code ─────────────────────────────────────────────────────
  const handleResendCode = async () => {
    setLoading(true);
    try {
      const code = createVerificationCode(email.trim());
      const { demoMode } = await sendVerificationEmail(
        email.trim(),
        code,
        settings.emailJSServiceId ? {
          serviceId: settings.emailJSServiceId,
          templateId: settings.emailJSTemplateId,
          publicKey: settings.emailJSPublicKey,
        } : undefined
      );
      if (demoMode) { setDemoCodeVisible(code); setSuccess(`Novo código: ${code}`); }
      else setSuccess('Novo código enviado.');
    } finally {
      setLoading(false);
    }
  };

  // ── Titles and descriptions by mode ───────────────────────────────────────
  const modeConfig: Record<AuthMode, { title: string; subtitle: string; action: string }> = {
    login: { title: 'Acesse sua conta', subtitle: 'Restrito a consultores Ivoire autorizados.', action: 'Entrar' },
    register_email: { title: 'Criar conta', subtitle: 'Informe seu email @ivoire.ag para começar.', action: 'Enviar código de verificação' },
    register_verify: { title: 'Verificar email', subtitle: `Código de acesso enviado para ${email}`, action: 'Verificar código' },
    register_password: { title: 'Criar senha', subtitle: 'Defina uma senha segura para sua conta.', action: 'Criar conta' },
    forgot_email: { title: 'Recuperar senha', subtitle: 'Informe seu email para receber o código.', action: 'Enviar código' },
    forgot_verify: { title: 'Verificar email', subtitle: `Código enviado para ${email}`, action: 'Verificar código' },
    forgot_reset: { title: 'Nova senha', subtitle: 'Defina sua nova senha.', action: 'Redefinir senha' },
  };

  const { title, subtitle, action } = modeConfig[mode];

  // ── Form submit dispatch ───────────────────────────────────────────────────
  const handleSubmit = (e: FormEvent) => {
    if (mode === 'login') return handleLogin(e);
    if (mode === 'register_email') return handleRegisterEmail(e);
    if (mode === 'register_verify') return handleVerifyCode(e);
    if (mode === 'register_password') return handleSetPassword(e);
    if (mode === 'forgot_email') return handleForgotEmail(e);
    if (mode === 'forgot_verify') return handleVerifyCode(e);
    if (mode === 'forgot_reset') return handleResetPassword(e);
    e.preventDefault();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#282828', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Left panel — branding */}
      <div style={{
        width: '45%', background: 'rgba(0,0,0,0.5)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 56px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,2,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,2,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px', pointerEvents: 'none',
        }} />
        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #FFFF02, rgba(255,255,2,0.1))' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="font-montserrat" style={{ fontSize: '11px', fontWeight: 700, color: '#c9c9c9', letterSpacing: '3px', marginBottom: '32px' }}>
            IVOIRE.COM.BR
          </div>

          {/* Official Ivoire logo — PNG assinatura */}
          <img
            src={`${BASE_URL}ivoire-logo-yellow.png`}
            alt="Ivoire"
            style={{ width: '220px', height: 'auto', marginBottom: '12px', display: 'block', mixBlendMode: 'multiply' as const }}
            onError={(e) => {
              // Fallback to text if image fails
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          <div className="font-montserrat" style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', letterSpacing: '5px', marginTop: '4px' }}>
            GROWTH SCAN
          </div>
          <div style={{ fontFamily: 'Arvo, serif', fontSize: '12px', fontStyle: 'italic', color: '#aaaaaa', marginTop: '6px', letterSpacing: '1px' }}>
            diagnostic engine v1.0
          </div>

          <div style={{ height: '2px', background: 'linear-gradient(90deg, #FFFF02, transparent)', width: '80px', marginTop: '28px', marginBottom: '24px' }} />

          <p style={{ fontFamily: 'Arvo, serif', fontSize: '14px', color: '#999999', lineHeight: 1.7, maxWidth: '340px', margin: 0 }}>
            A primeira Marketing Growth Company do Brasil.
            <br />
            Diagnóstico de maturidade digital baseado no{' '}
            <span style={{ color: '#FFFF02', fontStyle: 'italic' }}>Framework 4Cs Ivoire</span>.
          </p>
        </div>

        {/* Maturity levels */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '9px', fontFamily: 'Montserrat', fontWeight: 700, color: '#c9c9c9', letterSpacing: '2px', marginBottom: '14px' }}>
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
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: lvl.color, boxShadow: `0 0 6px ${lvl.color}80`, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Montserrat', fontSize: '11px', fontWeight: 700, color: lvl.color, letterSpacing: '0.5px', width: '90px' }}>{lvl.name}</span>
                <span className="font-mono-display" style={{ fontSize: '10px', color: '#c9c9c9' }}>{lvl.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Mode indicator */}
          <div className="font-montserrat" style={{ fontSize: '11px', fontWeight: 700, color: '#FFFF02', letterSpacing: '3px', marginBottom: '12px' }}>
            {mode === 'login' ? 'ACESSO AO SISTEMA' :
             mode.startsWith('register') ? 'NOVO CADASTRO' : 'RECUPERAR SENHA'}
          </div>

          {/* Step indicator for multi-step flows */}
          {mode.startsWith('register') && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
              {['register_email', 'register_verify', 'register_password'].map((step, idx) => {
                const steps = ['register_email', 'register_verify', 'register_password'];
                const currentIdx = steps.indexOf(mode);
                const isComplete = idx < currentIdx;
                const isActive = idx === currentIdx;
                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      border: `2px solid ${isComplete ? '#00cc66' : isActive ? '#FFFF02' : 'rgba(255,255,255,0.2)'}`,
                      background: isComplete ? 'rgba(0,204,102,0.1)' : isActive ? 'rgba(255,255,2,0.1)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
                      color: isComplete ? '#00cc66' : isActive ? '#FFFF02' : '#555',
                    }}>
                      {isComplete ? '✓' : idx + 1}
                    </div>
                    {idx < 2 && <div style={{ width: '24px', height: '1px', background: isComplete ? '#00cc66' : 'rgba(255,255,255,0.1)' }} />}
                  </div>
                );
              })}
              <span style={{ fontSize: '10px', color: '#c9c9c9', fontFamily: 'Montserrat, sans-serif', marginLeft: '4px' }}>
                {mode === 'register_email' ? 'Email' : mode === 'register_verify' ? 'Verificação' : 'Senha'}
              </span>
            </div>
          )}

          <h1 className="font-montserrat" style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px', lineHeight: 1.2 }}>
            {title}
          </h1>
          <p style={{ fontFamily: 'Arvo, serif', fontSize: '13px', color: '#999999', marginTop: 0, marginBottom: '28px', lineHeight: 1.5 }}>
            {subtitle}
          </p>

          {/* Demo code display */}
          {demoCodeVisible && (
            <div style={{ marginBottom: '16px', padding: '14px 16px', background: 'rgba(255,153,0,0.08)', border: '1px solid rgba(255,153,0,0.3)', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'Montserrat', fontWeight: 700, color: '#ff9900', letterSpacing: '1.5px', marginBottom: '6px' }}>
                MODO DEMO — CÓDIGO DE VERIFICAÇÃO
              </div>
              <div className="font-bebas" style={{ fontSize: '36px', color: '#FFFF02', letterSpacing: '8px' }}>
                {demoCodeVisible}
              </div>
              <p style={{ fontSize: '11px', color: '#c9c9c9', fontFamily: 'Arvo, serif', margin: '6px 0 0' }}>
                Configure EmailJS nas Configurações para envio real de emails.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email field */}
            {['login', 'register_email', 'forgot_email'].includes(mode) && (
              <div>
                <label style={{ display: 'block', fontFamily: 'Montserrat', fontSize: '10px', fontWeight: 700, color: '#999', letterSpacing: '1.5px', marginBottom: '7px' }}>
                  EMAIL
                </label>
                <input
                  type="email" className="ivoire-input"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@ivoire.ag" autoComplete="email" autoFocus disabled={loading}
                />
              </div>
            )}

            {/* Name field (register only) */}
            {mode === 'register_email' && (
              <div>
                <label style={{ display: 'block', fontFamily: 'Montserrat', fontSize: '10px', fontWeight: 700, color: '#999', letterSpacing: '1.5px', marginBottom: '7px' }}>
                  NOME COMPLETO
                </label>
                <input
                  type="text" className="ivoire-input"
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome" autoComplete="name" disabled={loading}
                />
              </div>
            )}

            {/* Verification code field */}
            {['register_verify', 'forgot_verify'].includes(mode) && (
              <div>
                <label style={{ display: 'block', fontFamily: 'Montserrat', fontSize: '10px', fontWeight: 700, color: '#999', letterSpacing: '1.5px', marginBottom: '7px' }}>
                  CÓDIGO DE VERIFICAÇÃO
                </label>
                <input
                  type="text" className="ivoire-input"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX" autoFocus autoComplete="one-time-code"
                  maxLength={6} disabled={loading}
                  style={{ letterSpacing: '6px', fontSize: '18px', textAlign: 'center', fontFamily: 'Bebas Neue, cursive' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#e6e1e1', fontFamily: 'Arvo, serif' }}>
                    Expira em 15 minutos
                  </span>
                  <button type="button" onClick={handleResendCode} disabled={loading}
                    style={{ background: 'none', border: 'none', color: '#FFFF02', fontSize: '11px', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, padding: 0 }}>
                    Reenviar código
                  </button>
                </div>
              </div>
            )}

            {/* Password fields */}
            {['login', 'register_password', 'forgot_reset'].includes(mode) && (
              <div>
                <label style={{ display: 'block', fontFamily: 'Montserrat', fontSize: '10px', fontWeight: 700, color: '#999', letterSpacing: '1.5px', marginBottom: '7px' }}>
                  {mode === 'login' ? 'SENHA' : 'NOVA SENHA'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'} className="ivoire-input"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    disabled={loading} style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#c9c9c9', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {['register_password', 'forgot_reset'].includes(mode) && (
                  <div style={{ marginTop: '4px', fontSize: '10px', color: password.length >= 8 ? '#00cc66' : '#666', fontFamily: 'Arvo, serif' }}>
                    {password.length >= 8 ? '✓ Mínimo de 8 caracteres' : '• Mínimo de 8 caracteres'}
                  </div>
                )}
              </div>
            )}

            {/* Confirm password */}
            {['register_password', 'forgot_reset'].includes(mode) && (
              <div>
                <label style={{ display: 'block', fontFamily: 'Montserrat', fontSize: '10px', fontWeight: 700, color: '#999', letterSpacing: '1.5px', marginBottom: '7px' }}>
                  CONFIRMAR SENHA
                </label>
                <input
                  type={showPassword ? 'text' : 'password'} className="ivoire-input"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" disabled={loading}
                />
                {confirmPassword && (
                  <div style={{ marginTop: '4px', fontSize: '10px', color: password === confirmPassword ? '#00cc66' : '#ff4d4d', fontFamily: 'Arvo, serif' }}>
                    {password === confirmPassword ? '✓ As senhas coincidem' : '• As senhas não coincidem'}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: '4px', fontFamily: 'Arvo, serif', fontSize: '12px', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* Success */}
            {success && !demoCodeVisible && (
              <div style={{ padding: '10px 14px', background: 'rgba(0,204,102,0.08)', border: '1px solid rgba(0,204,102,0.3)', borderRadius: '4px', fontFamily: 'Arvo, serif', fontSize: '12px', color: '#00cc66' }}>
                ✓ {success}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: '13px', marginTop: '4px' }}>
              {loading ? (
                <span className="spin" style={{ width: '14px', height: '14px', border: '2px solid rgba(40,40,40,0.3)', borderTop: '2px solid #282828', borderRadius: '50%', display: 'inline-block' }} />
              ) : action}
            </button>
          </form>

          {/* Forgot password link (login mode only) */}
          {mode === 'login' && (
            <div style={{ marginTop: '14px', textAlign: 'right' }}>
              <button type="button" onClick={() => switchMode('forgot_email')}
                style={{ background: 'none', border: 'none', color: '#FFFF02', fontSize: '12px', cursor: 'pointer', fontFamily: 'Arvo, serif', padding: 0, opacity: 0.8, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                Esqueci minha senha
              </button>
            </div>
          )}

          {/* Mode switch links */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            {mode === 'login' ? (
              <p style={{ fontFamily: 'Arvo, serif', fontSize: '12px', color: '#e6e1e1', margin: 0 }}>
                Primeiro acesso?{' '}
                <button type="button" onClick={() => switchMode('register_email')}
                  style={{ background: 'none', border: 'none', color: '#FFFF02', fontSize: '12px', cursor: 'pointer', fontFamily: 'Arvo, serif', padding: 0, fontWeight: 700 }}>
                  Criar conta
                </button>
              </p>
            ) : (
              <button type="button" onClick={() => switchMode('login')}
                style={{ background: 'none', border: 'none', color: '#c9c9c9', fontSize: '12px', cursor: 'pointer', fontFamily: 'Arvo, serif', padding: 0, display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                Voltar ao login
              </button>
            )}
          </div>

          {/* Demo hint (login only) */}
          {mode === 'login' && (
            <div style={{ marginTop: '28px', padding: '14px 16px', background: 'rgba(255,255,2,0.04)', border: '1px solid rgba(255,255,2,0.1)', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontFamily: 'Montserrat', fontWeight: 700, color: '#FFFF02', letterSpacing: '1.5px', marginBottom: '7px' }}>
                ACESSO DEMO
              </div>
              <p style={{ fontFamily: 'Arvo, serif', fontSize: '12px', color: '#c9c9c9', margin: 0, lineHeight: 1.6 }}>
                Use <span style={{ color: '#FFFF02', fontWeight: 700 }}>demo@ivoire.ag</span> com qualquer senha
                <br />
                ou qualquer email <span style={{ color: '#FFFF02' }}>@ivoire.ag</span>
              </p>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '32px', textAlign: 'center', fontFamily: 'Arvo, serif', fontSize: '11px', color: '#444' }}>
            Ivoire Growth Company &copy; {new Date().getFullYear()}
            <br />
            <span style={{ fontSize: '10px' }}>Uso restrito a colaboradores autorizados</span>
          </div>
        </div>
      </div>
    </div>
  );
}
