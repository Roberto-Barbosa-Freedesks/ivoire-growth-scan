/**
 * Email Service — sends verification codes via EmailJS (Gmail).
 *
 * Setup (5 min, sem DNS):
 *   1. emailjs.com → Create account (grátis, 200 emails/mês)
 *   2. Email Services → Add Service → Gmail → conectar roberto.barbosa@ivoire.ag
 *      → copiar Service ID (ex: "service_xxxxxxx")
 *   3. Email Templates → Create Template:
 *      - Subject: "Código de verificação — Ivoire Growth Scan"
 *      - Body: use variáveis {{to_email}}, {{code}} → colar o HTML abaixo como referência
 *      → copiar Template ID (ex: "template_xxxxxxx")
 *   4. Account → API Keys → copiar Public Key
 *   5. Settings page do app → preencher EmailJS Service ID / Template ID / Public Key
 *      (ou add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY ao .env.local)
 *
 * Template variables esperadas pelo serviço:
 *   {{to_email}}  — destinatário
 *   {{code}}      — código de 6 dígitos
 *   {{year}}      — ano atual
 *
 * Falls back to demo mode (code shown in UI) when EmailJS is not configured.
 */

import emailjs from '@emailjs/browser';

function getEmailJSConfig(): { serviceId: string; templateId: string; publicKey: string } | null {
  // Prioridade: Settings page do app > variáveis de ambiente
  const serviceId =
    (window as unknown as Record<string, unknown>).__emailjsServiceId as string
    ?? import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined
    ?? '';
  const templateId =
    (window as unknown as Record<string, unknown>).__emailjsTemplateId as string
    ?? import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined
    ?? '';
  const publicKey =
    (window as unknown as Record<string, unknown>).__emailjsPublicKey as string
    ?? import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined
    ?? '';

  if (serviceId && templateId && publicKey) return { serviceId, templateId, publicKey };
  return null;
}

// Called by store initializer to inject values from AppSettings into the module
export function configureEmailJS(serviceId: string, templateId: string, publicKey: string): void {
  const w = window as unknown as Record<string, unknown>;
  w.__emailjsServiceId = serviceId;
  w.__emailjsTemplateId = templateId;
  w.__emailjsPublicKey = publicKey;
}

export async function sendVerificationCodeEmail(
  toEmail: string,
  code: string
): Promise<{ sent: boolean; demoMode: boolean }> {
  const config = getEmailJSConfig();

  if (!config) {
    // Demo mode: exibe código no console do browser
    console.info(
      `%c[Ivoire Growth Scan — Demo Mode]\n%cCódigo de verificação para ${toEmail}: %c${code}`,
      'color: #FFFF02; font-weight: bold;',
      'color: #999;',
      'color: #00cc66; font-size: 20px; font-weight: bold;'
    );
    return { sent: false, demoMode: true };
  }

  try {
    await emailjs.send(
      config.serviceId,
      config.templateId,
      {
        to_email: toEmail,
        code,
        year: new Date().getFullYear().toString(),
      },
      { publicKey: config.publicKey }
    );
    return { sent: true, demoMode: false };
  } catch (err) {
    console.warn('[EmailJS] Send failed:', err);
    // Fallback para demo mode em caso de erro
    console.info(
      `%c[Ivoire — fallback] Código: %c${code}`,
      'color: #999;',
      'color: #00cc66; font-size: 20px; font-weight: bold;'
    );
    return { sent: false, demoMode: true };
  }
}

/**
 * HTML de referência para o template EmailJS (cole no editor de template).
 * Variáveis EmailJS: {{to_email}}, {{code}}, {{year}}
 *
 * <!DOCTYPE html>
 * <html><head><meta charset="utf-8"></head>
 * <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
 *   <div style="max-width:480px;margin:40px auto;background:#282828;border-radius:8px;overflow:hidden;">
 *     <div style="background:linear-gradient(90deg,#FFFF02,rgba(255,255,2,0.3));height:3px;"></div>
 *     <div style="padding:40px 36px;">
 *       <div style="font-size:10px;font-weight:700;color:#FFFF02;letter-spacing:3px;margin-bottom:24px;">IVOIRE GROWTH SCAN</div>
 *       <div style="font-size:22px;font-weight:800;color:#ffffff;margin-bottom:8px;">Código de verificação</div>
 *       <div style="font-size:14px;color:#999999;margin-bottom:28px;line-height:1.6;">
 *         Use o código abaixo para confirmar seu cadastro.
 *       </div>
 *       <div style="background:#1e1e1e;border:1px solid rgba(255,255,2,0.25);border-radius:6px;padding:28px;text-align:center;margin-bottom:24px;">
 *         <div style="font-size:42px;font-weight:900;color:#FFFF02;letter-spacing:14px;font-family:monospace;">{{code}}</div>
 *       </div>
 *       <div style="font-size:12px;color:#555555;line-height:1.6;">
 *         Válido por <strong style="color:#999">15 minutos</strong>.<br>
 *         Se não solicitou, ignore este email.
 *       </div>
 *     </div>
 *     <div style="padding:16px 36px;border-top:1px solid rgba(255,255,255,0.05);">
 *       <div style="font-size:11px;color:#444;text-align:center;">
 *         Ivoire Growth Company © {{year}} — Uso restrito a colaboradores autorizados
 *       </div>
 *     </div>
 *   </div>
 * </body></html>
 */
