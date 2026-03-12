/**
 * Firebase Auth Service — client-side email/password authentication.
 *
 * Used when isFirebaseConfigured = true (VITE_FIREBASE_API_KEY is set).
 * Falls back to demo mode (any @ivoire.ag email) when Firebase is not configured.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';

export { isFirebaseConfigured };
export type { FirebaseUser };

/** Only @ivoire.ag emails are allowed */
export function validateIvoireEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@ivoire.ag');
}

export async function loginFirebase(
  email: string,
  password: string
): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase não está configurado. Adicione VITE_FIREBASE_API_KEY ao .env.local');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function registerFirebase(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase não está configurado');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: displayName.trim() });
  return cred.user;
}

export async function sendPasswordResetFirebase(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase não está configurado');
  await sendPasswordResetEmail(auth, email);
}

export async function logoutFirebase(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/** Map Firebase error codes to user-friendly Portuguese messages */
export function translateFirebaseError(code: string): string {
  const map: Record<string, string> = {
    'auth/user-not-found': 'Email não encontrado. Verifique ou crie sua conta.',
    'auth/wrong-password': 'Senha incorreta. Tente novamente.',
    'auth/invalid-credential': 'Email ou senha incorretos.',
    'auth/email-already-in-use': 'Este email já está cadastrado. Faça login.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Erro de rede. Verifique sua conexão.',
    'auth/invalid-email': 'Email inválido.',
    'auth/user-disabled': 'Esta conta foi desativada. Contate o administrador.',
  };
  return map[code] ?? 'Erro de autenticação. Tente novamente.';
}
