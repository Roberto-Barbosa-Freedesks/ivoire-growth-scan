import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Diagnostic, User, DiagnosticInput, SubdimensionScore, CollectionStatus } from '../types';
import { SUBDIMENSIONS } from '../data/scorecard';
import { finalizeDiagnostic } from '../services/scoring';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Settings
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

const DEMO_USERS: User[] = [
  { id: '1', name: 'Ana Carolina', email: 'ana@ivoire.com.br', role: 'consultor' },
  { id: '2', name: 'Roberto Barbosa', email: 'roberto@ivoire.com.br', role: 'admin' },
  { id: '3', name: 'Demo', email: 'demo@ivoire.com.br', role: 'consultor' },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      isAuthenticated: false,

      login: async (email: string, _password: string) => {
        await new Promise((r) => setTimeout(r, 800));
        const user = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (user) {
          set({ user, isAuthenticated: true });
          return true;
        }
        // Also accept any @ivoire.com.br
        if (email.endsWith('@ivoire.com.br')) {
          const newUser: User = {
            id: Date.now().toString(),
            name: email.split('@')[0],
            email,
            role: 'consultor',
          };
          set({ user: newUser, isAuthenticated: true });
          return true;
        }
        return false;
      },

      logout: () => set({ user: null, isAuthenticated: false, currentDiagnosticId: null }),

      // Settings
      pageSpeedApiKey: '',
      setPageSpeedApiKey: (key) => set({ pageSpeedApiKey: key }),

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
        diagnostics: state.diagnostics,
        pageSpeedApiKey: state.pageSpeedApiKey,
      }),
    }
  )
);
