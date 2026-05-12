import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { useFornecedorAtual } from "@/hooks/useFornecedorAtual";

export interface UserScope {
  isAdmin: boolean;
  isFornecedorUser: boolean;
  fornecedor: string | null;
  loading: boolean;
  adminCheckError: boolean;
}

// Cache de SUCESSO apenas. Erro nunca é cacheado — fail-closed (A07) com retry em remount.
const adminCache = new Map<string, boolean>();

export const useUserScope = (): UserScope => {
  const { user, isAuthenticated } = useAuthStatus();
  const { fornecedor, isFornecedorUser, loading: fornLoading } = useFornecedorAtual();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminCheckError, setAdminCheckError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    if (!isAuthenticated || !user) {
      setIsAdmin(false);
      setAdminLoading(false);
      setAdminCheckError(false);
      return;
    }
    if (adminCache.has(user.id)) {
      setIsAdmin(adminCache.get(user.id) === true);
      setAdminLoading(false);
      setAdminCheckError(false);
      return;
    }

    setAdminLoading(true);
    setAdminCheckError(false);

    const doFetch = (attempt: number) => {
      supabase.rpc("is_admin").then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (attempt < 3) {
            // Backoff exponencial: 500ms / 1s / 2s — alinhado com useFornecedorAtual.
            retryTimer = setTimeout(() => doFetch(attempt + 1), 500 * 2 ** (attempt - 1));
            return;
          }
          // 3 tentativas falharam — fail-closed (A07): isAdmin=false, mas NÃO cacheia.
          // Remount/auth-change permitirá nova tentativa.
          if (import.meta.env.DEV) console.error("[useUserScope] is_admin RPC falhou:", error.message);
          setIsAdmin(false);
          setAdminCheckError(true);
          setAdminLoading(false);
          return;
        }
        const value = data === true;
        adminCache.set(user.id, value);
        setIsAdmin(value);
        setAdminCheckError(false);
        setAdminLoading(false);
      });
    };

    doFetch(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthenticated, user]);

  return {
    isAdmin,
    isFornecedorUser,
    fornecedor,
    loading: fornLoading || adminLoading,
    adminCheckError,
  };
};
