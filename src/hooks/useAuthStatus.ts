import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

/**
 * Estado de autenticação retornado pelo hook useAuthStatus
 */
export interface AuthStatus {
  /** Sessão atual do usuário */
  session: Session | null;
  /** Usuário logado */
  user: User | null;
  /** True se estiver carregando a sessão inicial */
  loading: boolean;
  /** True se o token estiver expirado e aguardando refresh */
  tokenExpired: boolean;
  /** True se o usuário estiver autenticado */
  isAuthenticated: boolean;
  /** Erro de autenticação (se houver) */
  error: string | null;
  /** Força refresh do token */
  refreshSession: () => Promise<void>;
  /** Logout */
  signOut: () => Promise<void>;
}

/**
 * Hook reativo para gerenciamento de estado de autenticação
 *
 * Features:
 * - Listener em tempo real de onAuthStateChange
 * - Detecção de token expirado
 * - Refresh automático de token
 * - Fail closed: logout se refresh falhar
 * - Estado loading apenas na inicialização
 *
 * @example
 * ```tsx
 * const { session, user, loading, isAuthenticated, refreshSession } = useAuthStatus();
 *
 * if (loading) return <Loading />;
 * if (!isAuthenticated) return <Login />;
 *
 * return <Dashboard user={user} />;
 * ```
 */
export const useAuthStatus = (): AuthStatus => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Handler para mudanças de estado de autenticação
   */
  const handleAuthChange = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);

    if (!newSession) {
      // Usuário deslogado
      setTokenExpired(false);
      setError(null);
      return;
    }

    // Verifica se o token está próximo de expirar (menos de 5 minutos)
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = newSession.expires_at ?? 0;
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry < 300) {
      // Token expirando em breve - dispara refresh preventivo
      setTokenExpired(true);
      console.debug("[AUTH] Token expirando em breve, refresh preventivo");
    } else {
      setTokenExpired(false);
    }
  }, []);

  /**
   * Carrega a sessão inicial
   */
  const loadSession = useCallback(async () => {
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      await handleAuthChange(data.session);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = (err as { message?: string })?.message ?? String(err);
      console.error("[AUTH] Erro ao carregar sessão:", errorMessage);
      setError(errorMessage);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [handleAuthChange]);

  /**
   * Refresh manual da sessão
   */
  const refreshSession = useCallback(async () => {
    try {
      setError(null);
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        throw refreshError;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setTokenExpired(false);
    } catch (err: unknown) {
      const errorMessage = (err as { message?: string })?.message ?? String(err);
      console.error("[AUTH] Falha no refresh do token:", errorMessage);
      setError(errorMessage);
      setTokenExpired(false);

      // Fail closed: se refresh falhar, limpa sessão
      setSession(null);
      setUser(null);
    }
  }, []);

  /**
   * Logout
   */
  const signOut = useCallback(async () => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setTokenExpired(false);
    setError(null);
  }, []);

  /**
   * Setup do listener de auth state change
   */
  useEffect(() => {
    // Carrega sessão inicial
    loadSession();

    // Subscribe a mudanças de auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.debug("[AUTH] Evento:", event);

        switch (event) {
          case "INITIAL_SESSION":
            // Sessão restaurada do localStorage ao carregar a página.
            // Sem tratar este evento, a sessão só seria definida quando
            // loadSession() completasse o await getSession(), criando uma
            // janela onde loading=false mas session=null → flash do login.
            handleAuthChange(newSession);
            setLoading(false);
            break;

          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
            handleAuthChange(newSession);
            setLoading(false);
            break;

          case "SIGNED_OUT":
            handleAuthChange(null);
            break;

          case "TOKEN_EXPIRED":
            setTokenExpired(true);
            // Refresh automático
            await refreshSession();
            break;

          case "USER_UPDATED":
            handleAuthChange(newSession);
            break;

          case "MFA_CHALLENGE_VERIFIED":
            // Sessão elevada para aal2 — atualiza estado para que o route guard redirecione
            handleAuthChange(newSession);
            setLoading(false);
            break;

          default:
            break;
        }
      }
    );

    // Cleanup
    return () => {
      subscription.unsubscribe();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [loadSession, handleAuthChange, refreshSession]);

  const isAuthenticated = !!session && !!user;

  return {
    session,
    user,
    loading,
    tokenExpired,
    isAuthenticated,
    error,
    refreshSession,
    signOut,
  };
};
