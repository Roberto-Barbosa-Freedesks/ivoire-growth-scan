/**
 * Firebase configuration — client-side Auth SDK for GitHub Pages SPA.
 *
 * Setup:
 *   1. console.firebase.google.com → Create project "ivoire-growth-scan"
 *   2. Authentication → Sign-in method → Email/Password → Enable
 *   3. Project settings → Add web app → Copy firebaseConfig values
 *   4. Add to .env.local:
 *      VITE_FIREBASE_API_KEY=...
 *      VITE_FIREBASE_AUTH_DOMAIN=...
 *      VITE_FIREBASE_PROJECT_ID=...
 *      VITE_FIREBASE_APP_ID=...
 *   5. Add same vars to GitHub Secrets (Settings → Secrets → Actions)
 *
 * If vars are absent: isFirebaseConfigured = false → app falls back to demo mode.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

if (isFirebaseConfigured) {
  _app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  _auth = getAuth(_app);
}

export const app = _app;
export const auth = _auth;
