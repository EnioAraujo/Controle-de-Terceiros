import { useEffect, useRef, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { I18nProvider } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuthStatus } from "@/hooks/useAuthStatus";

// Lazy load pages para code splitting
const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const MobileLancamentosPage = lazy(() => import("./pages/MobileLancamentosPage"));
const MfaSetupPage = lazy(() => import("./pages/MfaSetupPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoading = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-sm text-gray-500 font-semibold">Carregando…</p>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// APP ROUTES
// ═══════════════════════════════════════════════════════════════

const AppRoutes = () => {
  const navigate = useNavigate();
  const { session, loading, isAuthenticated, tokenExpired } = useAuthStatus();
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    // Se a URL contém token de recuperação, aguarda o evento PASSWORD_RECOVERY
    const isRecoveryUrl = window.location.hash.includes("type=recovery");

    // Se já temos sessão do useAuthStatus, não precisa carregar novamente
    if (session && !isRecoveryUrl) {
      return;
    }

    // Handler de auth state change para casos especiais
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
        return;
      }

      // Ao fazer login (null → sessão válida), verificar MFA pendente
      if (!prevSessionRef.current && session) {
        const hasVerifiedFactor = session.user.factors?.some(
          (f: { status: string }) => f.status === "verified"
        );

        if (hasVerifiedFactor) {
          try {
            const jwtPayload = JSON.parse(
              atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
            ) as { aal?: string };

            if (jwtPayload.aal === "aal1") {
              // MFA pendente: não redireciona
              return;
            }
          } catch { /* ignora erro de decode */ }
        }

        const mode = sessionStorage.getItem("deviceMode");
        if (mode === "mobile") {
          navigate("/mobile", { replace: true });
          prevSessionRef.current = session;
          return;
        }
      }

      // Ao fazer logout, limpar preferência de dispositivo
      if (prevSessionRef.current && !session) {
        sessionStorage.removeItem("deviceMode");
      }

      prevSessionRef.current = session;
    });

    return () => subscription.unsubscribe();
  }, [navigate, session]);

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>Carregando…</div>
      </div>
    );
  }

  // Token expirado - exibe mensagem
  if (tokenExpired && !session) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, color: "#EF4444", fontWeight: 700 }}>Sessão expirada</div>
        <div style={{ fontSize: 14, color: "#64748B" }}>Redirecionando para login…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        <Suspense fallback={<PageLoading />}>
          {session ? <Navigate to="/" replace /> : <LoginPage />}
        </Suspense>
      } />
      <Route path="/" element={
        <Suspense fallback={<PageLoading />}>
          {session ? <Index /> : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/admin" element={
        <Suspense fallback={<PageLoading />}>
          {session ? <AdminPage /> : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/mobile" element={
        <Suspense fallback={<PageLoading />}>
          {session ? <MobileLancamentosPage /> : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/mfa-setup" element={
        <Suspense fallback={<PageLoading />}>
          {session ? <MfaSetupPage /> : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/reset-password" element={
        <Suspense fallback={<PageLoading />}>
          <ResetPasswordPage />
        </Suspense>
      } />
      <Route path="*" element={
        <Suspense fallback={<PageLoading />}>
          <NotFound />
        </Suspense>
      } />
    </Routes>
  );
};

// ═══════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════

const App = () => (
  <ErrorBoundary>
    <I18nProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </I18nProvider>
  </ErrorBoundary>
);

export default App;
