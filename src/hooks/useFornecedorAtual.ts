import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStatus } from "@/hooks/useAuthStatus";

export interface FornecedorAtual {
  fornecedor: string | null;
  isFornecedorUser: boolean;
  loading: boolean;
}

const cache = new Map<string, string | null>();

export const useFornecedorAtual = (): FornecedorAtual => {
  const { user, isAuthenticated } = useAuthStatus();
  const [fornecedor, setFornecedor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    if (!isAuthenticated || !user) {
      setFornecedor(null);
      setLoading(false);
      return;
    }

    if (cache.has(user.id)) {
      setFornecedor(cache.get(user.id) ?? null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const doFetch = (attempt: number) => {
      supabase
        .from("profiles")
        .select("fornecedor")
        .eq("id", user.id)
        .single()
        .then(({ data, error: fetchErr }) => {
          if (cancelled) return;
          if (fetchErr) {
            if (attempt < 3) {
              // Backoff: 1s, 2s, 3s — keeps loading=true to evitar redirect prematuro
              retryTimer = setTimeout(() => doFetch(attempt + 1), attempt * 1000);
              return;
            }
            // 3 tentativas falharam — resolve sem cache para não bloquear forever
            setFornecedor(null);
            setLoading(false);
            return;
          }
          const value = (data?.fornecedor as string | null) ?? null;
          cache.set(user.id, value);
          setFornecedor(value);
          setLoading(false);
        });
    };

    doFetch(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthenticated, user]);

  return {
    fornecedor,
    isFornecedorUser: fornecedor !== null && fornecedor.trim().length > 0,
    loading,
  };
};
