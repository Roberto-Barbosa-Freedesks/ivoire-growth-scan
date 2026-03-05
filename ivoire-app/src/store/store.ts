import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Diagnostic, User, DiagnosticInput, SubdimensionScore, CollectionStatus, RegisteredUser, AppSettings } from '../types';
import { SUBDIMENSIONS } from '../data/scorecard';
import { finalizeDiagnostic } from '../services/scoring';
import { hashPassword, verifyPassword } from '../services/emailVerification';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  registeredUsers: RegisteredUser[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (email: string, name: string, password: string) => Promise<void>;
  isEmailRegistered: (email: string) => boolean;
  resetPassword: (email: string, newPassword: string) => Promise<boolean>;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Legacy: keep for compatibility
  pageSpeedApiKey: string;
  setPageSpeedApiKey: (key: string) => void;

  // Diagnostics
  diagnostics: Diagnostic[];
  currentDiagnosticId: string | null;
  createDiagnostic: (input: DiagnosticInput) => string;
  updateDiagnostic: (id: string, updates: Partial<Diagnostic>) => void;
  updateSubdimensionScore: (diagnosticId: string, score: SubdimensionScore) => void;
  updateCollectionProgress: (diagnosticId: string, subdimId: string, status: CollectionStatus) => void;
  finalizeDiagnosticById: (id: string) => void;
  setCurrentDiagnostic: (id: string | null) => void;
  getDiagnostic: (id: string) => Diagnostic | undefined;
  deleteDiagnostic: (id: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  pageSpeedApiKey: '',
  youtubeApiKey: '',
  apolloApiKey: '',
  emailJSServiceId: '',
  emailJSTemplateId: '',
  emailJSPublicKey: '',
};

// Pre-seeded admin user (password: ivoire2024)
const INITIAL_ADMIN_PASSWORD_HASH = 'da1e0a8f8f09ca50b7c9c6be0ea2dda5c2fae4da6edf8b2e9c3d6a5f1b7e9c3d';

const INITIAL_REGISTERED_USERS: RegisteredUser[] = [
  {
    id: '1',
    name: 'Roberto Barbosa',
    email: 'roberto@ivoire.ag',
    role: 'admin',
    passwordHash: INITIAL_ADMIN_PASSWORD_HASH,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Demo Ivoire',
    email: 'demo@ivoire.ag',
    role: 'consultor',
    passwordHash: INITIAL_ADMIN_PASSWORD_HASH, // same hash as demo
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      isAuthenticated: false,
      registeredUsers: INITIAL_REGISTERED_USERS,

      login: async (email: string, password: string) => {
        await new Promise((r) => setTimeout(r, 600));

        const emailLower = email.toLowerCase().trim();
        const registeredUsers = get().registeredUsers;
        const found = registeredUsers.find((u) => u.email.toLowerCase() === emailLower);

        if (found) {
          if (!found.emailVerified) {
            return false; // Email not verified yet
          }
          // For the initial admin/demo accounts, accept any password (backward compat)
          // For newly registered users, verify password hash
          const isInitialAccount = ['roberto@ivoire.ag', 'demo@ivoire.ag'].includes(emailLower);
          if (isInitialAccount || found.passwordHash === INITIAL_ADMIN_PASSWORD_HASH) {
            // Initial accounts — accept any @ivoire.ag email/password combo
            if (emailLower.endsWith('@ivoire.ag')) {
              const user: User = {
                id: found.id,
                name: found.name,
                email: found.email,
                role: found.role,
                emailVerified: found.emailVerified,
              };
              set({ user, isAuthenticated: true });
              return true;
            }
          }
          const valid = await verifyPassword(password, found.passwordHash);
          if (valid) {
            const user: User = {
              id: found.id,
              name: found.name,
              email: found.email,
              role: found.role,
              emailVerified: found.emailVerified,
            };
            set({ user, isAuthenticated: true });
            return true;
          }
          return false;
        }

        // Fallback: accept any @ivoire.ag email (for consultants not yet registered)
        if (emailLower.endsWith('@ivoire.ag') && password.length >= 4) {
          const newUser: User = {
            id: Date.now().toString(),
            name: emailLower.split('@')[0].replace('.', ' '),
            email: emailLower,
            role: 'consultor',
            emailVerified: true,
          };
          set({ user: newUser, isAuthenticated: true });
          return true;
        }

        return false;
      },

      logout: () => set({ user: null, isAuthenticated: false, currentDiagnosticId: null }),

      register: async (email: string, name: string, password: string) => {
        const hash = await hashPassword(password);
        const newUser: RegisteredUser = {
          id: Date.now().toString(),
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role: 'consultor',
          passwordHash: hash,
          emailVerified: true, // set true after code verification
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          registeredUsers: [
            ...state.registeredUsers.filter((u) => u.email.toLowerCase() !== email.toLowerCase()),
            newUser,
          ],
        }));
      },

      isEmailRegistered: (email: string) => {
        const emailLower = email.toLowerCase().trim();
        return get().registeredUsers.some((u) => u.email.toLowerCase() === emailLower);
      },

      resetPassword: async (email: string, newPassword: string) => {
        const emailLower = email.toLowerCase().trim();
        const registeredUsers = get().registeredUsers;
        const found = registeredUsers.find((u) => u.email.toLowerCase() === emailLower);
        if (!found) return false;

        const hash = await hashPassword(newPassword);
        set((state) => ({
          registeredUsers: state.registeredUsers.map((u) =>
            u.email.toLowerCase() === emailLower ? { ...u, passwordHash: hash } : u
          ),
        }));
        return true;
      },

      // Settings
      settings: DEFAULT_SETTINGS,
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
          // Keep legacy pageSpeedApiKey in sync
          pageSpeedApiKey: updates.pageSpeedApiKey ?? state.pageSpeedApiKey,
        })),

      // Legacy
      pageSpeedApiKey: '',
      setPageSpeedApiKey: (key) =>
        set((state) => ({
          pageSpeedApiKey: key,
          settings: { ...state.settings, pageSpeedApiKey: key },
        })),

      // Diagnostics
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

      finalizeDiagnosticById: (id) => {
        const diag = get().diagnostics.find((d) => d.id === id);
        if (!diag) return;
        const finalized = finalizeDiagnostic(diag);
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
        registeredUsers: state.registeredUsers,
        diagnostics: state.diagnostics,
        pageSpeedApiKey: state.pageSpeedApiKey,
        settings: state.settings,
      }),
    }
  )
);
