import { useEffect, useRef, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { I18nProvider } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AdminRoute } from "@/components/AdminRoute";
import { RedirectFornecedor, FornecedorRoute } from "@/components/FornecedorGuard";
import { useAuthStatus, AuthProvider } from "@/hooks/useAuthStatus";

const queryClient = new QueryClient();

// Lazy load pages para code splitting
const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const MobileLancamentosPage = lazy(() => import("./pages/MobileLancamentosPage"));
const MfaSetupPage = lazy(() => import("./pages/MfaSetupPage"));
const FornecedorPage = lazy(() => import("./pages/FornecedorPage"));
const FornecedorMobilePage = lazy(() => import("./pages/FornecedorMobilePage"));
const ResumoAcumuladoPage = lazy(() => import("./pages/ResumoAcumuladoPage"));
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
// MFA HELPERS
// ═══════════════════════════════════════════════════════════════

/** Decodifica o campo `aal` do JWT sem verificar assinatura. Retorna null em caso de falha. */
function decodeSessionAal(session: Session | null): string | null {
  if (!session?.access_token) return null;
  try {
    const payload = JSON.parse(
      atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as { aal?: string };
    return payload.aal ?? null;
  } catch {
    return null;
  }
}

/**
 * Retorna true quando a sessão existe mas o MFA ainda não foi completado:
 * - JWT com aal="aal1" (só senha, sem TOTP)
 * - E o usuário tem pelo menos um factor verificado (MFA configurado)
 */
function hasMfaPending(session: Session | null): boolean {
  if (!session) return false;
  if (decodeSessionAal(session) !== "aal1") return false;
  return !!session.user.factors?.some(
    (f: { status: string }) => f.status === "verified"
  );
}

/** Rota pós-login baseada na preferência de dispositivo gravada no sessionStorage. */
function getPostLoginRoute(): string {
  return sessionStorage.getItem("deviceMode") === "mobile" ? "/mobile" : "/";
}

// ═══════════════════════════════════════════════════════════════
// APP ROUTES
// ═══════════════════════════════════════════════════════════════

const AppRoutes = () => {
  const navigate = useNavigate();
  const { session, loading, isAuthenticated, tokenExpired, isBlocked, isApproved, signOut } = useAuthStatus();
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
            if (decodeSessionAal(session) === "aal1") {
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
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)" }}>
        <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>Carregando…</div>
      </div>
    );
  }

  // Token expirado - exibe mensagem
  if (tokenExpired && !session) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 16, color: "#EF4444", fontWeight: 700 }}>Sessão expirada</div>
        <div style={{ fontSize: 14, color: "#64748B" }}>Redirecionando para login…</div>
      </div>
    );
  }

  // Usuário bloqueado — bloqueia todas as rotas autenticadas
  if (session && isBlocked) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 20, color: "#EF4444", fontWeight: 800, marginBottom: 8 }}>Usuário bloqueado</div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 24 }}>Você foi bloqueado após múltiplas tentativas de login incorretas. Contate o administrador do sistema.</div>
          <button
            onClick={() => signOut()}
            style={{ background: "#F37E38", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer" }}
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  // Conta aguardando aprovação do administrador
  if (session && !isApproved) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 20, color: "#F37E38", fontWeight: 800, marginBottom: 8 }}>Aguardando aprovação</div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 24 }}>Sua conta ainda não foi aprovada por um administrador. Você receberá acesso em breve.</div>
          <button
            onClick={() => signOut()}
            style={{ background: "#EF4444", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer" }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        <Suspense fallback={<PageLoading />}>
          {session && !hasMfaPending(session)
            ? <Navigate to={getPostLoginRoute()} replace />
            : <LoginPage />}
        </Suspense>
      } />
      <Route path="/" element={
        <Suspense fallback={<PageLoading />}>
          {session && !hasMfaPending(session)
            ? <RedirectFornecedor><Index /></RedirectFornecedor>
            : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/admin" element={
        <Suspense fallback={<PageLoading />}>
          {session && !hasMfaPending(session)
            ? <RedirectFornecedor><AdminRoute><AdminPage /></AdminRoute></RedirectFornecedor>
            : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/mobile" element={
        <Suspense fallback={<PageLoading />}>
          {session && !hasMfaPending(session)
            ? <RedirectFornecedor><MobileLancamentosPage /></RedirectFornecedor>
            : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/fornecedor" element={
        <Suspense fallback={<PageLoading />}>
          {session && !hasMfaPending(session)
            ? <FornecedorRoute><FornecedorPage /></FornecedorRoute>
            : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/fornecedor/resumo" element={
        <Suspense fallback={<PageLoading />}>
          {session && !hasMfaPending(session)
            ? <FornecedorRoute><ResumoAcumuladoPage /></FornecedorRoute>
            : <Navigate to="/login" replace />}
        </Suspense>
      } />
      <Route path="/fornecedor/mobile" element={
        <Suspense fallback={<PageLoading />}>
          {session && !hasMfaPending(session)
            ? <FornecedorRoute><FornecedorMobilePage /></FornecedorRoute>
            : <Navigate to="/login" replace />}
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
