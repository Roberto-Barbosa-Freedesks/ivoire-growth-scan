import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/store';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NewDiagnosticPage from './pages/NewDiagnosticPage';
import CollectionPage from './pages/CollectionPage';
import ResultsLayout from './pages/results/ResultsLayout';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/ivoire-growth-scan">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="diagnostic/new" element={<NewDiagnosticPage />} />
          <Route path="diagnostic/:id/collecting" element={<CollectionPage />} />
          <Route path="diagnostic/:id/results" element={<ResultsLayout />} />
          <Route path="diagnostic/:id/results/:tab" element={<ResultsLayout />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
