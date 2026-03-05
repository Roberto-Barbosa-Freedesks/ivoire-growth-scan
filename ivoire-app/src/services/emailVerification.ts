/**
 * Email Verification Service
 * Uses EmailJS for sending verification codes.
 * Falls back to demo mode (code shown in browser console) if not configured.
 */

const VERIFICATION_STORAGE_KEY = 'ivoire_pending_verifications';
const CODE_EXPIRY_MINUTES = 15;

interface PendingVerification {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
  let code = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (let i = 0; i < 6; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

function getPendingVerifications(): Record<string, PendingVerification> {
  try {
    return JSON.parse(localStorage.getItem(VERIFICATION_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePendingVerifications(data: Record<string, PendingVerification>) {
  localStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(data));
}

export function createVerificationCode(email: string): string {
  const code = generateCode();
  const verifications = getPendingVerifications();

  verifications[email.toLowerCase()] = {
    email: email.toLowerCase(),
    code,
    expiresAt: Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000,
    attempts: 0,
  };

  savePendingVerifications(verifications);
  return code;
}

export function verifyCode(email: string, inputCode: string): { valid: boolean; reason?: string } {
  const verifications = getPendingVerifications();
  const pending = verifications[email.toLowerCase()];

  if (!pending) {
    return { valid: false, reason: 'Código não encontrado. Solicite um novo.' };
  }

  if (Date.now() > pending.expiresAt) {
    delete verifications[email.toLowerCase()];
    savePendingVerifications(verifications);
    return { valid: false, reason: 'Código expirado. Solicite um novo.' };
  }

  if (pending.attempts >= 5) {
    return { valid: false, reason: 'Muitas tentativas inválidas. Solicite um novo código.' };
  }

  if (pending.code.toUpperCase() !== inputCode.toUpperCase().trim()) {
    verifications[email.toLowerCase()].attempts += 1;
    savePendingVerifications(verifications);
    return { valid: false, reason: 'Código incorreto. Tente novamente.' };
  }

  // Code is valid — clean up
  delete verifications[email.toLowerCase()];
  savePendingVerifications(verifications);
  return { valid: true };
}

export function clearVerification(email: string) {
  const verifications = getPendingVerifications();
  delete verifications[email.toLowerCase()];
  savePendingVerifications(verifications);
}

/**
 * Send verification email via EmailJS.
 * If EMAILJS_SERVICE_ID is not configured, logs the code to console (demo mode).
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  emailJSConfig?: { serviceId: string; templateId: string; publicKey: string }
): Promise<{ sent: boolean; demoMode: boolean }> {
  // If EmailJS is configured, use it
  if (emailJSConfig?.serviceId && emailJSConfig?.templateId && emailJSConfig?.publicKey) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: emailJSConfig.serviceId,
          template_id: emailJSConfig.templateId,
          user_id: emailJSConfig.publicKey,
          template_params: {
            to_email: email,
            verification_code: code,
            from_name: 'Ivoire Growth Scan',
            expiry_minutes: CODE_EXPIRY_MINUTES,
          },
        }),
      });

      if (response.ok) {
        return { sent: true, demoMode: false };
      }
    } catch (err) {
      console.warn('EmailJS send failed, falling back to demo mode:', err);
    }
  }

  // Demo mode: log to console
  console.info(
    `%c[Ivoire Growth Scan — Demo Mode]\n%cVerification code for ${email}: %c${code}`,
    'color: #FFFF02; font-weight: bold;',
    'color: #999;',
    'color: #00cc66; font-size: 18px; font-weight: bold;'
  );

  return { sent: false, demoMode: true };
}

/** Simple PBKDF2-like password hash using SubtleCrypto (browser native) */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = 'ivoire-growth-scan-salt-2024'; // static salt for simplicity
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(bits));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}
