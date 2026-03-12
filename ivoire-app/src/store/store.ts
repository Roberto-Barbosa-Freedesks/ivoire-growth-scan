import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Diagnostic, User, DiagnosticInput, SubdimensionScore, CollectionStatus, AppSettings } from '../types';
import { SUBDIMENSIONS } from '../data/scorecard';
import { finalizeDiagnostic } from '../services/scoring';
import { loginFirebase, isFirebaseConfigured, type FirebaseUser } from '../services/authService';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { configureEmailJS } from '../services/resendEmailService';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Legacy compat
  pageSpeedApiKey: string;
  setPageSpeedApiKey: (key: string) => void;

  // Diagnostics
  diagnostics: Diagnostic[];
  currentDiagnosticId: string | null;
  createDiagnostic: (input: DiagnosticInput) => string;
  updateDiagnostic: (id: string, updates: Partial<Diagnostic>) => void;
  updateSubdimensionScore: (diagnosticId: string, score: SubdimensionScore) => void;
  updateCollectionProgress: (diagnosticId: string, subdimId: string, status: CollectionStatus) => void;
  finalizeDiagnosticById: (id: string) => Promise<void>;
  setCurrentDiagnostic: (id: string | null) => void;
  getDiagnostic: (id: string) => Diagnostic | undefined;
  deleteDiagnostic: (id: string) => void;

  // Internal: set user from Firebase onAuthStateChanged
  _setUserFromFirebase: (fbUser: FirebaseUser | null) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  pageSpeedApiKey: import.meta.env.VITE_PAGESPEED_API_KEY ?? '',
  emailJSServiceId: '',
  emailJSTemplateId: '',
  emailJSPublicKey: '',
  googlePlacesApiKey: import.meta.env.VITE_GOOGLE_PLACES_API_KEY ?? '',
  metaAccessToken: import.meta.env.VITE_META_ACCESS_TOKEN ?? '',
  openPageRankApiKey: import.meta.env.VITE_OPEN_PAGERANK_API_KEY ?? '',
  apifyToken: import.meta.env.VITE_APIFY_TOKEN ?? '',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Auth ────────────────────────────────────────────────────────────────
      user: null,
      isAuthenticated: false,
      firebaseUser: null,

      login: async (email: string, password: string) => {
        const emailLower = email.toLowerCase().trim();

        // Primary: Firebase Auth (when configured)
        if (isFirebaseConfigured) {
          try {
            const fbUser = await loginFirebase(emailLower, password);
            const user: User = {
              id: fbUser.uid,
              name: fbUser.displayName ?? emailLower.split('@')[0].replace(/\./g, ' '),
              email: fbUser.email ?? emailLower,
              role: 'consultor',
              emailVerified: fbUser.emailVerified,
            };
            set({ user, isAuthenticated: true, firebaseUser: fbUser });
            return true;
          } catch {
            return false;
          }
        }

        // Fallback: Demo mode — accept any @ivoire.ag email
        if (emailLower.endsWith('@ivoire.ag') && password.length >= 4) {
          const user: User = {
            id: Date.now().toString(),
            name: emailLower.split('@')[0].replace(/\./g, ' '),
            email: emailLower,
            role: 'consultor',
            emailVerified: true,
          };
          set({ user, isAuthenticated: true });
          return true;
        }

        return false;
      },

      logout: () => {
        if (isFirebaseConfigured && auth) {
          signOut(auth).catch(console.warn); // fire-and-forget
        }
        set({ user: null, isAuthenticated: false, firebaseUser: null, currentDiagnosticId: null });
      },

      // Called by onAuthStateChanged in App.tsx
      _setUserFromFirebase: (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const user: User = {
            id: fbUser.uid,
            name: fbUser.displayName ?? fbUser.email?.split('@')[0].replace(/\./g, ' ') ?? 'Usuário',
            email: fbUser.email ?? '',
            role: 'consultor',
            emailVerified: fbUser.emailVerified,
          };
          set({ user, isAuthenticated: true, firebaseUser: fbUser });
        } else {
          // Firebase says user is logged out
          const { isAuthenticated } = get();
          if (isAuthenticated && isFirebaseConfigured) {
            // Only clear if we were using Firebase (not demo mode)
            set({ user: null, isAuthenticated: false, firebaseUser: null });
          }
        }
      },

      // ── Settings ────────────────────────────────────────────────────────────
      settings: DEFAULT_SETTINGS,
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
          pageSpeedApiKey: updates.pageSpeedApiKey ?? state.pageSpeedApiKey,
        }));
        // Sync EmailJS config whenever settings change
        const merged = { ...get().settings, ...updates };
        if (merged.emailJSServiceId && merged.emailJSTemplateId && merged.emailJSPublicKey) {
          configureEmailJS(merged.emailJSServiceId, merged.emailJSTemplateId, merged.emailJSPublicKey);
        }
      },

      // Legacy
      pageSpeedApiKey: '',
      setPageSpeedApiKey: (key) =>
        set((state) => ({
          pageSpeedApiKey: key,
          settings: { ...state.settings, pageSpeedApiKey: key },
        })),

      // ── Diagnostics ─────────────────────────────────────────────────────────
      diagnostics: [],
      currentDiagnosticId: null,

      createDiagnostic: (input: DiagnosticInput) => {
        const id = `diag_${Date.now()}`;
        const initialScores: SubdimensionScore[] = SUBDIMENSIONS.map((sd) => ({
          subdimensionId: sd.id,
          name: sd.name,
          dimension: sd.dimension,
          score: 1,
          level: 'Intuitivo' as const,
          source: 'insufficient' as const,
          rawData: {},
          collectionStatus: 'pending' as const,
          isConditional: sd.isConditional,
          notes: undefined,
          dataReliability: 'estimated' as const,
          dataSources: sd.dataSources,
        }));

        const newDiagnostic: Diagnostic = {
          id,
          input,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          collectionProgress: Object.fromEntries(SUBDIMENSIONS.map((sd) => [sd.id, 'pending'])),
          subdimensionScores: initialScores,
        };

        set((state) => ({
          diagnostics: [newDiagnostic, ...state.diagnostics],
          currentDiagnosticId: id,
        }));

        return id;
      },

      updateDiagnostic: (id, updates) => {
        set((state) => ({
          diagnostics: state.diagnostics.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        }));
      },

      updateSubdimensionScore: (diagnosticId, score) => {
        set((state) => ({
          diagnostics: state.diagnostics.map((d) => {
            if (d.id !== diagnosticId) return d;
            const existing = d.subdimensionScores.findIndex(
              (s) => s.subdimensionId === score.subdimensionId
            );
            const updated =
              existing >= 0
                ? d.subdimensionScores.map((s, i) => (i === existing ? score : s))
                : [...d.subdimensionScores, score];
            return { ...d, subdimensionScores: updated, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      updateCollectionProgress: (diagnosticId, subdimId, status) => {
        set((state) => ({
          diagnostics: state.diagnostics.map((d) =>
            d.id === diagnosticId
              ? {
                  ...d,
                  collectionProgress: { ...d.collectionProgress, [subdimId]: status },
                  updatedAt: new Date().toISOString(),
                }
              : d
          ),
        }));
      },

      finalizeDiagnosticById: async (id) => {
        const diag = get().diagnostics.find((d) => d.id === id);
        if (!diag) return;
        const claudeApiKey = get().settings.claudeApiKey ?? '';
        const apifyToken = get().settings.apifyToken ?? '';
        const finalized = await finalizeDiagnostic(diag, claudeApiKey || undefined, apifyToken || undefined);
        set((state) => ({
          diagnostics: state.diagnostics.map((d) => (d.id === id ? finalized : d)),
        }));
      },

      setCurrentDiagnostic: (id) => set({ currentDiagnosticId: id }),

      getDiagnostic: (id) => get().diagnostics.find((d) => d.id === id),

      deleteDiagnostic: (id) => {
        set((state) => ({
          diagnostics: state.diagnostics.filter((d) => d.id !== id),
          currentDiagnosticId: state.currentDiagnosticId === id ? null : state.currentDiagnosticId,
        }));
      },
    }),
    {
      name: 'ivoire-growth-scan',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        diagnostics: state.diagnostics,
        pageSpeedApiKey: state.pageSpeedApiKey,
        settings: state.settings,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>;
        const mergedSettings = { ...currentState.settings };
        if (persisted.settings) {
          (Object.keys(currentState.settings) as Array<keyof AppSettings>).forEach((k) => {
            const envVal = currentState.settings[k];
            const storedVal = persisted.settings![k];
            mergedSettings[k] = envVal || storedVal || '';
          });
        }
        // Sync EmailJS on hydration
        if (mergedSettings.emailJSServiceId && mergedSettings.emailJSTemplateId && mergedSettings.emailJSPublicKey) {
          configureEmailJS(mergedSettings.emailJSServiceId, mergedSettings.emailJSTemplateId, mergedSettings.emailJSPublicKey);
        }
        return { ...currentState, ...persisted, settings: mergedSettings };
      },
    }
  )
);
