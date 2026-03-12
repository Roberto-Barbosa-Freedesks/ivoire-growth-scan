/**
 * Resend Email Service — sends verification codes from roberto.barbosa@ivoire.ag.
 *
 * Setup:
 *   1. resend.com → Create account → Add Domain → ivoire.ag
 *   2. Add DKIM + SPF DNS records to ivoire.ag nameservers
 *   3. API Keys → Create key (scope: send:emails only) → copy key
 *   4. Add to .env.local: VITE_RESEND_API_KEY=re_...
 *   5. Add to GitHub Secrets: VITE_RESEND_API_KEY
 *
 * Falls back to demo mode (code shown in UI) when API key is absent.
 */

const RESEND_API = 'https://api.resend.com/emails';
const SENDER = 'Ivoire Growth Scan <roberto.barbosa@ivoire.ag>';

export async function sendVerificationCodeEmail(
  toEmail: string,
  code: string
): Promise<{ sent: boolean; demoMode: boolean }> {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY as string | undefined;

  if (!apiKey) {
    // Demo mode: log code to browser console
    console.info(
      `%c[Ivoire Growth Scan — Demo Mode]\n%cCódigo de verificação para ${toEmail}: %c${code}`,
      'color: #FFFF02; font-weight: bold;',
      'color: #999;',
      'color: #00cc66; font-size: 20px; font-weight: bold;'
    );
    return { sent: false, demoMode: true };
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SENDER,
      to: toEmail,
      subject: 'Código de verificação — Ivoire Growth Scan',
      html: buildEmailHtml(code),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.warn('[Resend] Send failed:', res.status, err);
    // Fall back to demo mode on error
    console.info(
      `%c[Ivoire — Demo fallback] Código: %c${code}`,
      'color: #999;',
      'color: #00cc66; font-size: 20px; font-weight: bold;'
    );
    return { sent: false, demoMode: true };
  }

  return { sent: true, demoMode: false };
}

function buildEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#282828;border-radius:8px;overflow:hidden;">
    <div style="background:linear-gradient(90deg,#FFFF02,rgba(255,255,2,0.3));height:3px;"></div>
    <div style="padding:40px 36px;">
      <div style="font-size:10px;font-weight:700;color:#FFFF02;letter-spacing:3px;margin-bottom:24px;">
        IVOIRE GROWTH SCAN
      </div>
      <div style="font-size:22px;font-weight:800;color:#ffffff;margin-bottom:8px;">
        Código de verificação
      </div>
      <div style="font-size:14px;color:#999999;margin-bottom:28px;line-height:1.6;">
        Use o código abaixo para confirmar seu cadastro no Ivoire Growth Scan.
      </div>
      <div style="background:#1e1e1e;border:1px solid rgba(255,255,2,0.25);border-radius:6px;padding:28px;text-align:center;margin-bottom:24px;">
        <div style="font-size:42px;font-weight:900;color:#FFFF02;letter-spacing:14px;font-family:monospace;">
          ${code}
        </div>
      </div>
      <div style="font-size:12px;color:#555555;line-height:1.6;">
        Este código é válido por <strong style="color:#999">15 minutos</strong>.<br>
        Se você não solicitou este código, ignore este email.
      </div>
    </div>
    <div style="padding:16px 36px;border-top:1px solid rgba(255,255,255,0.05);">
      <div style="font-size:11px;color:#444;text-align:center;">
        Ivoire Growth Company © ${new Date().getFullYear()} — Uso restrito a colaboradores autorizados
      </div>
    </div>
  </div>
</body>
</html>`;
}
