import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { I18nProvider } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MobileLancamentosPage from "./pages/MobileLancamentosPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Componente interno que fica dentro do BrowserRouter para poder usar useNavigate
const AppRoutes = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const prevSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    // Se a URL contém token de recuperação, aguarda o evento PASSWORD_RECOVERY
    // antes de definir loading=false para evitar flash da página principal
    const isRecoveryUrl = window.location.hash.includes("type=recovery");

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!isRecoveryUrl) setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setSession(session);
        navigate("/reset-password", { replace: true });
        setLoading(false);
        return;
      }
      // Ao fazer login (null → sessão válida), redirecionar por deviceMode
      if (!prevSessionRef.current && session) {
        const mode = sessionStorage.getItem("deviceMode");
        if (mode === "mobile") {
          setSession(session);
          setLoading(false);
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
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F0F2F5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <div style={{ fontSize: 14, color: "#64748B", fontWeight: 600 }}>Carregando…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={session ? <Index /> : <Navigate to="/login" replace />} />
      <Route path="/admin" element={session ? <AdminPage /> : <Navigate to="/login" replace />} />
      <Route path="/mobile" element={session ? <MobileLancamentosPage /> : <Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;